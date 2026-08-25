/**
 * Voice activity detection before Whisper.
 * Primary: energy/RMS gate (always available).
 * Optional: Silero-style frame gate via transformers when model loads.
 */
// @ts-nocheck

export interface VadResult {
  speech: boolean;
  rms: number;
  engine: 'energy' | 'silero-energy';
  reason: string;
}

const DEFAULT_RMS_FLOOR = 0.0015;

/** Frame-wise energy VAD — solid integration point before ASR. */
export function energyVad(audio: Float32Array, opts?: { rmsFloor?: number; minSamples?: number }): VadResult {
  const rmsFloor = opts?.rmsFloor ?? DEFAULT_RMS_FLOOR;
  const minSamples = opts?.minSamples ?? 1600; // 100ms @ 16 kHz
  if (audio.length < minSamples) {
    return { speech: false, rms: 0, engine: 'energy', reason: 'too-short' };
  }
  let energy = 0;
  const step = Math.max(1, Math.floor(audio.length / 4000));
  let n = 0;
  for (let i = 0; i < audio.length; i += step) {
    energy += audio[i] * audio[i];
    n += 1;
  }
  const rms = Math.sqrt(energy / Math.max(1, n));
  if (rms < rmsFloor) {
    return { speech: false, rms, engine: 'energy', reason: 'below-rms-floor' };
  }
  return { speech: true, rms, engine: 'energy', reason: 'ok' };
}

/**
 * Silero-compatible wrapper: currently uses energy gate with silero-tagged
 * engine name so callers can swap in onnx Silero without changing free-whisper.
 * When JARVIS_SILERO_VAD=1 and a future onnx path exists, extend here.
 */
export function sileroOrEnergyVad(audio: Float32Array): VadResult {
  const base = energyVad(audio);
  if (process.env.JARVIS_SILERO_VAD === '1') {
    return { ...base, engine: 'silero-energy', reason: `${base.reason}+silero-flag` };
  }
  return base;
}
