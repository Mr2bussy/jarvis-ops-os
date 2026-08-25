/**
 * JARVIS voice capture — PCM → 16 kHz WAV in the renderer.
 *
 * Why this replaces MediaRecorder + ffmpeg:
 *   Electron MediaRecorder emits WebM/Opus that system ffmpeg often cannot open
 *   (exit 3199971767 / "Error opening input file"). Hugging Face STT is also
 *   frequently unreachable. The reliable path is: capture float PCM via
 *   AudioContext, encode a real WAV here, hand it to local Whisper which already
 *   speaks WAV natively. No ffmpeg on the hot path.
 */
// @ts-nocheck

export type VoicePhase = 'idle' | 'calibrating' | 'listening' | 'speech' | 'processing';

export interface VoicePipelineOptions {
  onUtterance: (audio: { base64: string; mimeType: string; ms: number }) => void;
  onLevel?: (level: number) => void;
  onPhase?: (phase: VoicePhase) => void;
  onError?: (message: string) => void;
  /** Silence needed to close an utterance. Default 900 ms. */
  silenceMs?: number;
  /** Utterances shorter than this are discarded. Default 350 ms. */
  minSpeechMs?: number;
  /** Hard cap. Default 12 s. */
  maxSpeechMs?: number;
  /** Higher = easier to trigger (0.5–2.5). Default 1. */
  sensitivity?: number;
  /** Optional MediaDeviceInfo.deviceId */
  deviceId?: string;
  /** When true, speech is only captured while manualGate is open. */
  pushToTalk?: boolean;
}

const TARGET_RATE = 16_000;

function resampleLinear(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return input;
  if (input.length === 0) return input;
  const ratio = fromRate / toRate;
  const outLen = Math.max(1, Math.floor(input.length / ratio));
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const src = i * ratio;
    const i0 = Math.floor(src);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const t = src - i0;
    out[i] = input[i0] * (1 - t) + input[i1] * t;
  }
  return out;
}

/** 16-bit mono WAV as base64 (no ffmpeg). */
export function encodeWavBase64(samples: Float32Array, sampleRate: number): string {
  const n = samples.length;
  const dataSize = n * 2;
  const buf = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buf);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);
  let o = 44;
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    o += 2;
  }
  const bytes = new Uint8Array(buf);
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

export class VoicePipeline {
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private raf = 0;

  private pcmChunks: Float32Array[] = [];
  private pcmSamples = 0;
  private speaking = false;
  private speechStartedAt = 0;
  private lastLoudAt = 0;
  private phase: VoicePhase = 'idle';
  private muted = false;
  private manualGate = false;

  private noiseFloor = 0.012;
  private calibrationFrames = 0;
  private calibrationSum = 0;

  private readonly opts: Required<
    Omit<VoicePipelineOptions, 'onLevel' | 'onPhase' | 'onError' | 'deviceId'>
  > &
    Pick<VoicePipelineOptions, 'onLevel' | 'onPhase' | 'onError' | 'deviceId'>;

  constructor(options: VoicePipelineOptions) {
    this.opts = {
      silenceMs: 900,
      minSpeechMs: 350,
      maxSpeechMs: 12_000,
      sensitivity: 1,
      pushToTalk: false,
      ...options,
    };
  }

  get currentPhase(): VoicePhase {
    return this.phase;
  }

  setMuted(muted: boolean): void {
    if (this.muted === muted) return;
    this.muted = muted;
    if (muted) {
      this.speaking = false;
      this.pcmChunks = [];
      this.pcmSamples = 0;
      this.setPhase(this.stream ? 'listening' : 'idle');
    }
  }

  /** Push-to-talk: hold gate open while the operator presses. */
  setManualGate(open: boolean): void {
    this.manualGate = open;
    if (!this.opts.pushToTalk || this.muted) return;
    if (open && !this.speaking) {
      this.pcmChunks = [];
      this.pcmSamples = 0;
      this.speaking = true;
      this.speechStartedAt = performance.now();
      this.lastLoudAt = this.speechStartedAt;
      this.setPhase('speech');
    } else if (!open && this.speaking) {
      this.closeUtterance(performance.now() - this.speechStartedAt);
    }
  }

  /** Re-run ambient noise floor measurement. */
  recalibrate(): void {
    if (!this.stream) return;
    this.speaking = false;
    this.pcmChunks = [];
    this.pcmSamples = 0;
    this.calibrationFrames = 0;
    this.calibrationSum = 0;
    this.setPhase('calibrating');
  }

  updateTuning(patch: {
    silenceMs?: number;
    minSpeechMs?: number;
    maxSpeechMs?: number;
    sensitivity?: number;
    pushToTalk?: boolean;
  }): void {
    if (patch.silenceMs != null) this.opts.silenceMs = patch.silenceMs;
    if (patch.minSpeechMs != null) this.opts.minSpeechMs = patch.minSpeechMs;
    if (patch.maxSpeechMs != null) this.opts.maxSpeechMs = patch.maxSpeechMs;
    if (patch.sensitivity != null) this.opts.sensitivity = Math.max(0.5, Math.min(2.5, patch.sensitivity));
    if (patch.pushToTalk != null) this.opts.pushToTalk = patch.pushToTalk;
  }

  private setPhase(p: VoicePhase) {
    if (this.phase === p) return;
    this.phase = p;
    this.opts.onPhase?.(p);
  }

  async start(): Promise<void> {
    if (this.stream) return;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          ...(this.opts.deviceId ? { deviceId: { exact: this.opts.deviceId } } : {}),
        },
        video: false,
      });
    } catch (err: unknown) {
      const e = err as { name?: string; message?: string };
      this.opts.onError?.(
        e?.name === 'NotAllowedError'
          ? 'Mikrofon blockiert — Zugriff in den Windows-Datenschutzeinstellungen erlauben.'
          : e?.name === 'NotFoundError'
            ? 'Kein Mikrofon gefunden.'
            : `Mikrofon-Fehler: ${e?.message ?? String(err)}`,
      );
      this.setPhase('idle');
      return;
    }

    const AudioCtor: typeof AudioContext =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioCtor();
    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch {
        /* continue — some hosts resume on first user gesture only */
      }
    }
    const source = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.2;
    source.connect(this.analyser);

    // ScriptProcessor is deprecated but works in Electron without CSP/worklet friction.
    const bufferSize = 4096;
    this.processor = this.ctx.createScriptProcessor(bufferSize, 1, 1);
    this.processor.onaudioprocess = (ev) => {
      if (this.muted || !this.speaking) return;
      const input = ev.inputBuffer.getChannelData(0);
      this.pcmChunks.push(new Float32Array(input));
      this.pcmSamples += input.length;
    };
    source.connect(this.processor);
    const mute = this.ctx.createGain();
    mute.gain.value = 0;
    this.processor.connect(mute);
    mute.connect(this.ctx.destination);

    this.calibrationFrames = 0;
    this.calibrationSum = 0;
    this.setPhase('calibrating');
    this.loop();
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    try {
      this.processor?.disconnect();
    } catch {
      /* ignore */
    }
    this.processor = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.analyser = null;
    this.pcmChunks = [];
    this.pcmSamples = 0;
    this.speaking = false;
    this.setPhase('idle');
  }

  private level(): number {
    if (!this.analyser) return 0;
    const buf = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    return Math.sqrt(sum / buf.length);
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    if (!this.analyser) return;

    if (this.muted) {
      this.opts.onLevel?.(0);
      return;
    }

    const rms = this.level();
    const now = performance.now();

    if (this.phase === 'calibrating') {
      this.calibrationSum += rms;
      this.calibrationFrames += 1;
      if (this.calibrationFrames >= 30) {
        this.noiseFloor = Math.max(0.006, (this.calibrationSum / this.calibrationFrames) * 1.4);
        this.setPhase('listening');
      }
      this.opts.onLevel?.(0);
      return;
    }

    const sens = Math.max(0.5, Math.min(2.5, this.opts.sensitivity || 1));
    const openAt = this.noiseFloor * (3.4 / sens);
    const closeAt = this.noiseFloor * (1.8 / sens);
    this.opts.onLevel?.(Math.min(1, rms / Math.max(openAt, 0.0001)));

    if (this.opts.pushToTalk) {
      // Gate controlled by setManualGate — level only drives the HUD meter.
      if (this.speaking && rms > closeAt) this.lastLoudAt = now;
      return;
    }

    if (!this.speaking) {
      if (rms < this.noiseFloor) this.noiseFloor = this.noiseFloor * 0.95 + rms * 0.05;
      if (rms > openAt) {
        this.pcmChunks = [];
        this.pcmSamples = 0;
        this.speaking = true;
        this.speechStartedAt = now;
        this.lastLoudAt = now;
        this.setPhase('speech');
      }
      return;
    }

    if (rms > closeAt) this.lastLoudAt = now;

    const silentFor = now - this.lastLoudAt;
    const spokenFor = now - this.speechStartedAt;
    if (silentFor >= this.opts.silenceMs || spokenFor >= this.opts.maxSpeechMs) {
      this.closeUtterance(spokenFor - silentFor);
    }
  };

  private closeUtterance(speechMs: number): void {
    this.speaking = false;
    this.setPhase('processing');

    if (speechMs < this.opts.minSpeechMs || this.pcmSamples < TARGET_RATE * 0.2) {
      this.pcmChunks = [];
      this.pcmSamples = 0;
      this.setPhase('listening');
      return;
    }

    const merged = new Float32Array(this.pcmSamples);
    let offset = 0;
    for (const chunk of this.pcmChunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    this.pcmChunks = [];
    this.pcmSamples = 0;

    const fromRate = this.ctx?.sampleRate || 48_000;
    const pcm16k = resampleLinear(merged, fromRate, TARGET_RATE);
    try {
      const base64 = encodeWavBase64(pcm16k, TARGET_RATE);
      this.opts.onUtterance({ base64, mimeType: 'audio/wav', ms: Math.round(speechMs) });
    } catch (e: unknown) {
      this.opts.onError?.(`WAV-Kodierung fehlgeschlagen: ${String((e as Error)?.message ?? e)}`);
    } finally {
      if (this.phase === 'processing') this.setPhase('listening');
    }
  }
}

export function isElectronRenderer(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.jarvisBridge) return true;
  return /electron/i.test(navigator.userAgent);
}

/** Web Speech is never usable inside Electron. */
export function hasUsableWebSpeech(): boolean {
  if (isElectronRenderer()) return false;
  const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
  return Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition);
}
