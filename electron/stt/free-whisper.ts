/**
 * Free OSS speech-to-text — no Gemini / paid STT.
 *
 * 1. Hugging Face Inference — openai/whisper-* (MIT)
 * 2. Local Xenova/whisper-tiny via @huggingface/transformers
 *    (ffmpeg → 16 kHz WAV → wavefile → Float32Array — no AudioContext)
 *
 * Browser Web Speech stays primary in the renderer.
 */
// @ts-nocheck

import { app } from 'electron';
import { spawn, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { WaveFile } from 'wavefile';
import { getDecryptedKey } from '../config/store';
import { getFeatureFlag } from '../config/flags';
import { resolveFfmpeg } from '../system/binaries';
import { isResolved } from '../system/resolve-binary';
import { sileroOrEnergyVad } from './vad';
import { apiRateLimiter, rateLimitOrThrow } from '../security/rate-limiter';

type AsrPipe = (input: Float32Array | string, opts?: Record<string, unknown>) => Promise<{ text?: string }>;

let localAsr: AsrPipe | null = null;
let localAsrLoading: Promise<AsrPipe> | null = null;
let loadedModelId = '';

const HF_WHISPER_MODELS = ['openai/whisper-large-v3-turbo', 'openai/whisper-tiny', 'openai/whisper-base'];

/** Resolve local Whisper model — turbo when flagged/env set. */
export function resolveWhisperModelId(): string {
  const env = (process.env.JARVIS_WHISPER_MODEL || getDecryptedKey('WHISPER_MODEL') || '').trim();
  if (env) return env;
  try {
    if (getFeatureFlag('voice.whisperTurbo')) {
      return 'onnx-community/whisper-large-v3-turbo';
    }
  } catch {
    /* flags may be uninitialized in unit tests */
  }
  return 'Xenova/whisper-base';
}

const HF_ENDPOINTS = (model: string) => [
  `https://router.huggingface.co/hf-inference/models/${model}`,
  `https://api-inference.huggingface.co/models/${model}`,
];

/**
 * Resolved ffmpeg path, or null.
 *
 * Never the bare string 'ffmpeg': on this machine that name resolves to a
 * zero-byte WinGet symlink which spawn cannot follow, and the resulting
 * `exit 3199971767` gave no hint at the cause. See system/resolve-binary.ts.
 */
function ffmpegPath(): string | null {
  const r = resolveFfmpeg(getDecryptedKey('FFMPEG_PATH') || undefined);
  return isResolved(r) ? r.path : null;
}

export function hasFfmpeg(): boolean {
  const exe = ffmpegPath();
  if (!exe) return false;
  try {
    const r = spawnSync(exe, ['-version'], { windowsHide: true, encoding: 'utf8' });
    return r.status === 0;
  } catch {
    return false;
  }
}

/** Human-readable ffmpeg state for diagnostics. */
export function ffmpegDetail(): string {
  const r = resolveFfmpeg(getDecryptedKey('FFMPEG_PATH') || undefined);
  return r.detail;
}

async function loadLocalWhisper(): Promise<AsrPipe> {
  const modelId = resolveWhisperModelId();
  if (localAsr && loadedModelId === modelId) return localAsr;
  if (localAsrLoading) return localAsrLoading;
  localAsrLoading = (async () => {
    const { pipeline, env } = await import('@huggingface/transformers');
    env.cacheDir = path.join(app.getPath('userData'), 'whisper-cache');
    env.allowLocalModels = true;
    env.allowRemoteModels = true;
    const asr = (await pipeline('automatic-speech-recognition', modelId, {
      dtype: 'q8',
    })) as unknown as AsrPipe;
    localAsr = asr;
    loadedModelId = modelId;
    return asr;
  })();
  return localAsrLoading;
}

/** Load the ONNX Whisper weights at idle so the first utterance is not a 20s stall. */
export async function warmLocalWhisper(): Promise<{ ok: boolean; err?: string }> {
  try {
    await loadLocalWhisper();
    return { ok: true };
  } catch (e: unknown) {
    localAsrLoading = null;
    return { ok: false, err: String((e as Error)?.message ?? e).slice(0, 200) };
  }
}

function writeTempAudio(audioBase64: string, mimeType: string): string {
  const ext = mimeType.includes('wav')
    ? 'wav'
    : mimeType.includes('ogg')
      ? 'ogg'
      : mimeType.includes('mp4')
        ? 'mp4'
        : 'webm';
  const file = path.join(
    os.tmpdir(),
    `jarvis-stt-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`,
  );
  fs.writeFileSync(file, Buffer.from(audioBase64, 'base64'));
  return file;
}

function ffmpegToWav(inputPath: string): Promise<string> {
  const out = path.join(os.tmpdir(), `jarvis-stt-${Date.now()}.wav`);
  return new Promise((resolve, reject) => {
    const exe = ffmpegPath();
    if (!exe) {
      reject(
        new Error(
          'ffmpeg nicht auffindbar. Der PATH-Eintrag ist ein Symlink, dem der App-Prozess nicht folgen kann. ' +
            'Pfad zur echten ffmpeg.exe unter Admin → Connectors als FFMPEG_PATH hinterlegen.',
        ),
      );
      return;
    }
    const ff = spawn(exe, ['-y', '-i', inputPath, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', out], {
      windowsHide: true,
    });
    let err = '';
    ff.stderr.on('data', (d: Buffer) => {
      err += d.toString();
    });
    ff.on('error', (e) => reject(e));
    ff.on('close', (code) => {
      if (code === 0 && fs.existsSync(out) && fs.statSync(out).size > 44) resolve(out);
      else reject(new Error(`ffmpeg exit ${code}: ${err.slice(-180)}`));
    });
  });
}

/** WAV path → Float32Array @ 16 kHz mono for Whisper (Node-safe). */
function wavPathToFloat32(wavPath: string): Float32Array {
  const buf = fs.readFileSync(wavPath);
  const wav = new WaveFile(buf);
  wav.toBitDepth('32f');
  wav.toSampleRate(16000);
  let audioData = wav.getSamples();
  if (Array.isArray(audioData)) {
    if (audioData.length > 1) {
      const SCALING = Math.SQRT2;
      for (let i = 0; i < audioData[0].length; i++) {
        audioData[0][i] = (SCALING * (audioData[0][i] + audioData[1][i])) / 2;
      }
    }
    audioData = audioData[0];
  }
  if (audioData instanceof Float32Array) return audioData;
  return Float32Array.from(Array.from(audioData as ArrayLike<number>));
}

/** Synthesize a short beep WAV (for self-test without mic). */
export function makeTestWavBase64(seconds = 0.6): { audioBase64: string; mimeType: string } {
  const sampleRate = 16000;
  const n = Math.floor(sampleRate * seconds);
  const pcm = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * 440 * t) * 0.25;
    pcm.writeInt16LE(Math.max(-32767, Math.min(32767, Math.floor(sample * 32767))), i * 2);
  }
  const wav = new WaveFile();
  wav.fromScratch(1, sampleRate, '16', pcm);
  const b64 = Buffer.from(wav.toBuffer()).toString('base64');
  return { audioBase64: b64, mimeType: 'audio/wav' };
}

async function hfWhisperTranscribe(audioBase64: string, mimeType: string): Promise<string> {
  rateLimitOrThrow(apiRateLimiter, 'hf-whisper');
  const token =
    getDecryptedKey('HF_TOKEN') || getDecryptedKey('HUGGINGFACE_TOKEN') || process.env.HF_TOKEN || '';
  const buf = Buffer.from(audioBase64, 'base64');
  let last = '';
  for (const model of HF_WHISPER_MODELS) {
    for (const url of HF_ENDPOINTS(model)) {
      try {
        const headers: Record<string, string> = {
          'Content-Type': mimeType || 'audio/webm',
        };
        if (token) headers.Authorization = `Bearer ${token}`;
        const res = await fetch(url, {
          method: 'POST',
          headers,
          body: buf,
          signal: AbortSignal.timeout(20_000),
        });
        if (res.status === 503) {
          await new Promise((r) => setTimeout(r, 3000));
          continue;
        }
        if (!res.ok) {
          last = `HF ${model} ${res.status}`;
          continue;
        }
        const data = (await res.json()) as { text?: string; error?: string };
        if (data.error) {
          last = data.error;
          continue;
        }
        const text = (data.text ?? '').trim();
        if (text) return text;
      } catch (e: unknown) {
        last = String((e as Error)?.message ?? e);
      }
    }
  }
  throw new Error(last || 'Hugging Face Whisper unavailable');
}

/** Drop known Whisper hallucinations / empty noise transcripts. */
export function sanitizeTranscript(raw: string): string {
  const t = raw.replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (t.length < 2) return '';
  if (/^\[silence\]$/i.test(t)) return '';
  // Only drop exact/near-exact known Whisper spam — not short real German replies.
  if (
    /^(untertitel der amara\.org-community|thanks for watching|thank you for watching|amara\.org|♪+|♫+|\[Musik\]|\[Music\]|\[Applause\]|\[Laughter\])\.?$/i.test(
      t,
    )
  ) {
    return '';
  }
  return t;
}

function audioRms(audio: Float32Array): number {
  if (audio.length === 0) return 0;
  let energy = 0;
  const step = Math.max(1, Math.floor(audio.length / 4000));
  let n = 0;
  for (let i = 0; i < audio.length; i += step) {
    energy += audio[i] * audio[i];
    n += 1;
  }
  return Math.sqrt(energy / Math.max(1, n));
}

/** Soft clips stay below Whisper's usable range — peak-normalize without clipping hard. */
function normalizePeak(audio: Float32Array, targetPeak = 0.7): Float32Array {
  let peak = 0;
  for (let i = 0; i < audio.length; i++) {
    const a = Math.abs(audio[i]);
    if (a > peak) peak = a;
  }
  if (peak < 0.001 || peak >= 0.2) return audio;
  const gain = Math.min(12, targetPeak / peak);
  const out = new Float32Array(audio.length);
  for (let i = 0; i < audio.length; i++) out[i] = Math.max(-1, Math.min(1, audio[i] * gain));
  return out;
}

async function localWhisperTranscribe(audioBase64: string, mimeType: string): Promise<string> {
  const isWav = /wav/i.test(mimeType);
  if (!isWav && !hasFfmpeg()) {
    throw new Error('Nicht-WAV-Audio braucht ffmpeg — Voice sendet jetzt WAV, bitte App neu starten.');
  }
  const raw = writeTempAudio(audioBase64, mimeType);
  const temps = [raw];
  try {
    let wavPath = raw;
    // WAV from the renderer is already 16 kHz PCM. ffmpeg is only for leftovers.
    if (!isWav) {
      wavPath = await ffmpegToWav(raw);
      temps.push(wavPath);
    }
    const audio = wavPathToFloat32(wavPath);
    const vad = sileroOrEnergyVad(audio);
    if (!vad.speech) return '';
    const rms = vad.rms || audioRms(audio);

    // Quiet mics → Whisper often returns "". Boost soft clips before ASR.
    const peaked = normalizePeak(audio, 0.7);
    const asr = await loadLocalWhisper();
    const opts = { language: 'german', task: 'transcribe', sampling_rate: 16_000 } as const;
    let out = await asr(peaked, opts);
    let text = sanitizeTranscript((out?.text ?? '').trim());
    if (!text) {
      // Retry without forced language — some clips mis-detect under forced DE.
      out = await asr(peaked, { task: 'transcribe', sampling_rate: 16_000 });
      text = sanitizeTranscript((out?.text ?? '').trim());
    }
    if (!text) {
      console.warn(
        `[STT] empty transcript · samples=${audio.length} rms=${rms.toFixed(4)} peakBoosted=${audioRms(peaked).toFixed(4)}`,
      );
    }
    return text;
  } finally {
    for (const f of temps) {
      try {
        fs.unlinkSync(f);
      } catch {
        /* ignore */
      }
    }
  }
}

/**
 * Transcribe audio. Empty string = no usable speech (not an error).
 * Only throws when the engine itself fails.
 */
export async function freeTranscribe(audioBase64: string, mimeType: string): Promise<string> {
  const canLocal = hasFfmpeg() || /wav/i.test(mimeType);
  if (canLocal) {
    try {
      // Local empty means silence / rejected clip — do NOT fall through to HF
      // (HF is often unreachable and turned "nothing heard" into a hard error).
      return await localWhisperTranscribe(audioBase64, mimeType);
    } catch (e: unknown) {
      const localErr = String((e as Error)?.message ?? e).slice(0, 120);
      try {
        const t = await hfWhisperTranscribe(audioBase64, mimeType);
        if (t) return sanitizeTranscript(t);
      } catch (hfE: unknown) {
        throw new Error(
          `STT fehlgeschlagen (local:${localErr} | hf:${String((hfE as Error)?.message ?? hfE).slice(0, 80)}). Tippe den Befehl.`,
        );
      }
      throw new Error(`STT fehlgeschlagen (local:${localErr}). Tippe den Befehl.`);
    }
  }
  try {
    return sanitizeTranscript(await hfWhisperTranscribe(audioBase64, mimeType));
  } catch (e: unknown) {
    throw new Error(
      `STT fehlgeschlagen (hf:${String((e as Error)?.message ?? e).slice(0, 100)}). Tippe den Befehl.`,
    );
  }
}

export function freeSttStatus(): { engine: string; note: string; ffmpeg: boolean; model: string } {
  const model = loadedModelId || resolveWhisperModelId();
  return {
    engine: localAsr ? `whisper-local:${model}` : 'whisper-local',
    note: `Renderer PCM→WAV → ${model} (local) + energy/Silero VAD. ffmpeg only for leftover non-WAV.`,
    ffmpeg: hasFfmpeg(),
    model,
  };
}

export type FreeSttProbe = {
  ok: boolean;
  ffmpeg: boolean;
  localOk: boolean;
  hfOk: boolean;
  detail: string;
  ms: number;
  engine?: string;
};

/** Live probe for Voice overlay — local WAV→Whisper only. HF is optional and non-blocking. */
export async function probeFreeStt(): Promise<FreeSttProbe> {
  const t0 = Date.now();
  const ffmpeg = hasFfmpeg();
  const warm = await warmLocalWhisper();
  if (!warm.ok) {
    return {
      ok: false,
      ffmpeg,
      localOk: false,
      hfOk: false,
      detail: `whisper load: ${warm.err ?? 'failed'}`,
      ms: Date.now() - t0,
      engine: resolveWhisperModelId(),
    };
  }
  const { audioBase64, mimeType } = makeTestWavBase64(0.6);
  let localOk = false;
  let detail: string;
  try {
    const text = await localWhisperTranscribe(audioBase64, mimeType);
    localOk = true;
    detail = `local whisper ok (${text.slice(0, 40) || 'tone'})`;
  } catch (e: unknown) {
    detail = `local:${String((e as Error)?.message ?? e).slice(0, 100)}`;
  }
  // HF is legacy fallback only — never block READY on it.
  let hfOk = false;
  if (!localOk) {
    try {
      await hfWhisperTranscribe(audioBase64, mimeType);
      hfOk = true;
      detail = 'HF whisper ok (local failed)';
    } catch (e: unknown) {
      detail += ` | hf:${String((e as Error)?.message ?? e).slice(0, 50)}`;
    }
  }
  return {
    ok: localOk || hfOk,
    ffmpeg,
    localOk,
    hfOk,
    detail,
    ms: Date.now() - t0,
    engine: localAsr ? `whisper-local:${loadedModelId}` : resolveWhisperModelId(),
  };
}
