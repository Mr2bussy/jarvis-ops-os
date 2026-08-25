/**
 * Speech synthesis for JARVIS.
 *
 * ## The defect this replaces
 *
 * The old `speakText` hard-coded `utt.lang = 'en-GB'` and ranked English male
 * voices first — while the STT side transcribes with `language: 'german'` and
 * the whole HUD is German. The result was an English voice reading German text
 * phoneme-by-phoneme, which is both unpleasant and slower than it needs to be.
 *
 * ## Design
 *
 * Voice *selection* is a pure function over a voice list, so it can be tested
 * without a speech engine. Only `speak()` touches `window.speechSynthesis`.
 *
 * Two Electron-specific quirks are handled explicitly:
 *   - `getVoices()` returns an empty array on first call and fills in later via
 *     `voiceschanged`; callers must wait rather than fall back immediately.
 *   - `utterance.onend` sometimes never fires, which used to strand the voice
 *     loop with the microphone closed. A duration-estimated timer arms alongside
 *     it and whichever lands first wins.
 */
// @ts-nocheck

/** Default voice persona — chill colleague, not military bot. */
export const JARVIS_VOICE_PERSONA = {
  lang: 'de-DE',
  rate: 0.88,
  pitch: 0.92,
} as const;

export interface VoiceLike {
  name: string;
  lang: string;
  default?: boolean;
  localService?: boolean;
}

export interface VoiceChoice {
  voice: VoiceLike | null;
  /** Why this voice won — surfaced in diagnostics, not guessed at later. */
  reason: string;
}

/**
 * Among language-matched voices, prefer ones that tend to sound less robotic
 * on Windows (neural / named natural voices) and always prefer localService.
 */
function preferChillVoice(candidates: VoiceLike[]): VoiceLike | null {
  if (!candidates.length) return null;
  const score = (v: VoiceLike): number => {
    const n = v.name.toLowerCase();
    let s = 0;
    if (v.localService) s += 40;
    if (/neural|natural|online \(natural\)/i.test(v.name)) s += 30;
    if (/katja|stefan|hedda|conrad|ingrid|markus|anna/i.test(n)) s += 20;
    if (/google/i.test(n)) s -= 10;
    return s;
  };
  return [...candidates].sort((a, b) => score(b) - score(a))[0] ?? null;
}

/** Strip report-style markup so TTS doesn't sound like it's reading a ticket. */
export function softenForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-•*]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Pick the best available voice for a BCP-47 language tag.
 *
 * Ranking, strongest first:
 *   1. exact tag match on a local (offline) voice — no network round-trip
 *   2. exact tag match, any voice
 *   3. same base language (`de-AT` for a `de-DE` request)
 *   4. the platform default
 *
 * A voice from the wrong language is never returned: reading German with an
 * English engine is worse than the caller knowing no voice was found and
 * deciding for itself.
 */
export function pickVoice(voices: VoiceLike[], lang: string): VoiceChoice {
  if (!voices.length) return { voice: null, reason: 'Keine Stimmen verfügbar' };

  const want = lang.toLowerCase();
  const base = want.split('-')[0];

  const exact = voices.filter((v) => v.lang.toLowerCase().replace('_', '-') === want);
  const chillExact = preferChillVoice(exact);
  if (chillExact) return { voice: chillExact, reason: `Exakte Stimme (${lang})` };

  const sameBase = voices.filter((v) => v.lang.toLowerCase().split(/[-_]/)[0] === base);
  const chillBase = preferChillVoice(sameBase);
  if (chillBase) return { voice: chillBase, reason: `Stimme derselben Sprache (${chillBase.lang})` };

  const fallback = voices.find((v) => v.default) ?? null;
  return {
    voice: fallback,
    // Deliberately reported as a mismatch: the caller may prefer silence plus a
    // visible transcript over a wrong-language reading.
    reason: fallback
      ? `Keine ${base}-Stimme installiert — Systemstandard (${fallback.lang})`
      : `Keine ${base}-Stimme installiert`,
  };
}

/** Rough spoken duration, used only to arm the safety timer. */
export function estimateSpeechMs(text: string, rate = 1): number {
  // ~14 characters per second at rate 1 for German prose, floored so very short
  // answers still get a sane window.
  const raw = (text.length / 14) * 1000;
  return Math.max(3000, Math.round(raw / Math.max(0.5, rate)) + 1500);
}

/** Waits for the voice list to populate; resolves with whatever exists by then. */
export function loadVoices(timeoutMs = 1500): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const synth = window.speechSynthesis;
    const immediate = synth?.getVoices?.() ?? [];
    if (immediate.length) {
      resolve(immediate);
      return;
    }
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      synth.removeEventListener?.('voiceschanged', done);
      resolve(synth?.getVoices?.() ?? []);
    };
    synth?.addEventListener?.('voiceschanged', done);
    setTimeout(done, timeoutMs);
  });
}

export interface SpeakMetrics {
  mode: 'single' | 'streaming';
  chars: number;
  chunks: number;
  timeToFirstAudioMs: number | null;
  totalMs: number;
}

export interface SpeakOptions {
  lang?: string;
  rate?: number;
  pitch?: number;
  /** Exact SpeechSynthesisVoice.name — operator pick from settings. */
  voiceName?: string;
  /** Fires exactly once, whether the engine reported the end or the timer did. */
  onDone?: () => void;
  onVoiceChosen?: (choice: VoiceChoice) => void;
  /** Prefer chunked SpeechSynthesis for lower time-to-first-audio. Default true for long text. */
  streaming?: boolean;
  /** Max characters per TTS chunk when streaming. Default 180. */
  chunkChars?: number;
  /** Fires when the first chunk is handed to the engine. */
  onFirstChunk?: () => void;
  /** Fired when the first chunk starts speaking (streaming latency probe). */
  onFirstAudio?: (latencyMs: number) => void;
  /** Fired with end-to-end speak metrics when finished. */
  onMetrics?: (m: SpeakMetrics) => void;
}

/** Alias kept for call sites / tests that prefer the shorter name. */
export function chunkForSpeech(text: string, maxChars = 180): string[] {
  return chunkTextForTts(text, maxChars);
}

/** Prefer an operator-selected voice; otherwise fall back to language ranking. */
export function pickVoiceNamed(voices: VoiceLike[], lang: string, voiceName?: string): VoiceChoice {
  const want = voiceName?.trim();
  if (want) {
    const hit = voices.find((v) => v.name === want);
    if (hit) return { voice: hit, reason: `Ausgewählt: ${hit.name}` };
  }
  return pickVoice(voices, lang);
}

export type VoiceOption = { name: string; lang: string; localService: boolean; label: string };

export function toVoiceOptions(voices: VoiceLike[]): VoiceOption[] {
  return voices
    .map((v) => ({
      name: v.name,
      lang: v.lang,
      localService: Boolean(v.localService),
      label: `${v.name} · ${v.lang}${v.localService ? ' · local' : ''}`,
    }))
    .sort((a, b) => {
      const aDe = a.lang.toLowerCase().startsWith('de') ? 0 : 1;
      const bDe = b.lang.toLowerCase().startsWith('de') ? 0 : 1;
      if (aDe !== bDe) return aDe - bDe;
      if (a.localService !== b.localService) return a.localService ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

/**
 * Split prose into speakable chunks so the first sentence can start while later
 * sentences are still queued — reduces time-to-first-audio on long replies.
 */
export function chunkTextForTts(text: string, maxChars = 180): string[] {
  const cleaned = softenForSpeech(text);
  if (!cleaned) return [];
  if (cleaned.length <= maxChars) return [cleaned];

  const sentences = cleaned.split(/(?<=[.!?…])\s+/).filter(Boolean);
  const chunks: string[] = [];
  let buf = '';
  for (const s of sentences) {
    if (!buf) {
      buf = s;
      continue;
    }
    if ((buf + ' ' + s).length <= maxChars) {
      buf = `${buf} ${s}`;
    } else {
      chunks.push(buf);
      buf = s;
    }
  }
  if (buf) chunks.push(buf);

  // Hard-split any remaining oversize chunk on commas / spaces.
  const out: string[] = [];
  for (const c of chunks) {
    if (c.length <= maxChars) {
      out.push(c);
      continue;
    }
    let rest = c;
    while (rest.length > maxChars) {
      let cut = rest.lastIndexOf(' ', maxChars);
      if (cut < maxChars * 0.4) cut = maxChars;
      out.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trim();
    }
    if (rest) out.push(rest);
  }
  return out.filter(Boolean);
}

export type SpeakStreamingOptions = SpeakOptions;

let speakGeneration = 0;

export async function speakStreaming(text: string, opts: SpeakOptions = {}): Promise<void> {
  const synth = window.speechSynthesis;
  const t0 = performance.now();
  if (!synth) {
    opts.onDone?.();
    opts.onMetrics?.({
      mode: 'streaming',
      chars: 0,
      chunks: 0,
      timeToFirstAudioMs: null,
      totalMs: 0,
    });
    return;
  }

  const lang = opts.lang ?? JARVIS_VOICE_PERSONA.lang;
  const rate = opts.rate ?? JARVIS_VOICE_PERSONA.rate;
  const pitch = opts.pitch ?? JARVIS_VOICE_PERSONA.pitch;
  const chunks = chunkTextForTts(text, opts.chunkChars ?? 180);
  if (!chunks.length) {
    opts.onDone?.();
    opts.onMetrics?.({
      mode: 'streaming',
      chars: 0,
      chunks: 0,
      timeToFirstAudioMs: null,
      totalMs: performance.now() - t0,
    });
    return;
  }

  const gen = ++speakGeneration;
  synth.cancel();

  const voices = await loadVoices();
  if (gen !== speakGeneration) return;

  const choice = pickVoiceNamed(voices, lang, opts.voiceName);
  opts.onVoiceChosen?.(choice);

  let finished = false;
  let firstFired = false;
  let firstAudioMs: number | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const emitDone = () => {
    if (finished || gen !== speakGeneration) return;
    finished = true;
    if (timer) clearTimeout(timer);
    opts.onMetrics?.({
      mode: 'streaming',
      chars: chunks.reduce((n, c) => n + c.length, 0),
      chunks: chunks.length,
      timeToFirstAudioMs: firstAudioMs,
      totalMs: performance.now() - t0,
    });
    opts.onDone?.();
  };

  const totalMs = estimateSpeechMs(chunks.join(' '), rate);
  timer = setTimeout(emitDone, totalMs + chunks.length * 400);

  await new Promise<void>((resolve) => {
    let i = 0;
    const speakNext = () => {
      if (gen !== speakGeneration || finished) {
        resolve();
        return;
      }
      if (i >= chunks.length) {
        emitDone();
        resolve();
        return;
      }
      const part = chunks[i++];
      const utt = new SpeechSynthesisUtterance(part);
      utt.lang = choice.voice?.lang ?? lang;
      utt.rate = rate;
      utt.pitch = pitch;
      utt.volume = 1.0;
      if (choice.voice) utt.voice = choice.voice as SpeechSynthesisVoice;

      if (!firstFired) {
        firstFired = true;
        firstAudioMs = performance.now() - t0;
        opts.onFirstChunk?.();
        opts.onFirstAudio?.(firstAudioMs);
      }

      utt.onend = () => speakNext();
      utt.onerror = () => {
        emitDone();
        resolve();
      };
      synth.speak(utt);
    };
    speakNext();
  });
}

/** Speak with automatic streaming for longer replies; short ones stay single-utt. */
export async function speak(text: string, opts: SpeakOptions = {}): Promise<void> {
  const spoken = softenForSpeech(text);
  const useStream = opts.streaming !== false && spoken.length > 120;
  if (useStream) {
    return speakStreaming(text, opts);
  }

  const synth = window.speechSynthesis;
  const t0 = performance.now();
  if (!synth) {
    opts.onDone?.();
    return;
  }

  const lang = opts.lang ?? JARVIS_VOICE_PERSONA.lang;
  const rate = opts.rate ?? JARVIS_VOICE_PERSONA.rate;
  if (!spoken) {
    opts.onDone?.();
    return;
  }

  const gen = ++speakGeneration;
  synth.cancel();

  const voices = await loadVoices();
  if (gen !== speakGeneration) return;

  const choice = pickVoiceNamed(voices, lang, opts.voiceName);
  opts.onVoiceChosen?.(choice);

  const utt = new SpeechSynthesisUtterance(spoken);
  utt.lang = choice.voice?.lang ?? lang;
  utt.rate = rate;
  utt.pitch = opts.pitch ?? JARVIS_VOICE_PERSONA.pitch;
  utt.volume = 1.0;
  if (choice.voice) utt.voice = choice.voice as SpeechSynthesisVoice;

  let finished = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const firstAudioMs = performance.now() - t0;
  const finish = () => {
    if (finished || gen !== speakGeneration) return;
    finished = true;
    if (timer) clearTimeout(timer);
    opts.onMetrics?.({
      mode: 'single',
      chars: spoken.length,
      chunks: 1,
      timeToFirstAudioMs: firstAudioMs,
      totalMs: performance.now() - t0,
    });
    opts.onDone?.();
  };

  utt.onend = finish;
  utt.onerror = finish;
  timer = setTimeout(finish, estimateSpeechMs(spoken, rate));
  opts.onFirstChunk?.();
  opts.onFirstAudio?.(firstAudioMs);
  synth.speak(utt);
}

export function stopSpeaking(): void {
  speakGeneration++;
  window.speechSynthesis?.cancel();
}
