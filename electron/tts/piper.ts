/**
 * Local Piper TTS — spawn piper binary when installed; else report fallback.
 * Install: scripts/install-piper.ps1  (or docs/PIPER-TTS.md)
 */
// @ts-nocheck

import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { getDecryptedKey } from '../config/store';

export interface PiperStatus {
  available: boolean;
  binary?: string;
  model?: string;
  detail: string;
}

function resolvePiperBinary(): string | null {
  const fromConfig = getDecryptedKey('PIPER_PATH') || process.env.PIPER_PATH || '';
  const candidates = [
    fromConfig,
    path.join(os.homedir(), 'AppData', 'Local', 'jarvis-piper', 'piper', 'piper.exe'),
    path.join(process.cwd(), 'tools', 'piper', 'piper.exe'),
    'piper',
  ].filter(Boolean);
  for (const c of candidates) {
    if (c === 'piper') continue;
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function resolveVoiceModel(): string | null {
  const fromConfig = getDecryptedKey('PIPER_MODEL') || process.env.PIPER_MODEL || '';
  const candidates = [
    fromConfig,
    path.join(os.homedir(), 'AppData', 'Local', 'jarvis-piper', 'voices', 'de_DE-thorsten-medium.onnx'),
    path.join(process.cwd(), 'tools', 'piper', 'voices', 'de_DE-thorsten-medium.onnx'),
  ].filter(Boolean);
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

export function piperStatus(): PiperStatus {
  const binary = resolvePiperBinary();
  const model = resolveVoiceModel();
  if (!binary) {
    return {
      available: false,
      detail: 'Piper nicht installiert — SpeechSynthesis-Fallback. Siehe docs/PIPER-TTS.md',
    };
  }
  if (!model) {
    return {
      available: false,
      binary,
      detail: 'Piper binary da, aber kein .onnx Voice-Model (PIPER_MODEL)',
    };
  }
  return { available: true, binary, model, detail: 'Piper bereit' };
}

/** Synthesize text to a WAV path. Returns null when Piper unavailable. */
export async function piperSynthesize(
  text: string,
  outWav?: string,
): Promise<{ ok: true; path: string } | { ok: false; reason: string }> {
  const st = piperStatus();
  if (!st.available || !st.binary || !st.model) {
    return { ok: false, reason: st.detail };
  }
  const out = outWav ?? path.join(os.tmpdir(), `jarvis-piper-${Date.now()}.wav`);
  return new Promise((resolve) => {
    const child = spawn(st.binary!, ['--model', st.model!, '--output_file', out], {
      windowsHide: true,
    });
    let err = '';
    child.stderr.on('data', (d: Buffer) => {
      err += d.toString();
    });
    child.on('error', (e) => resolve({ ok: false, reason: String(e.message) }));
    child.stdin.write(text.slice(0, 4000));
    child.stdin.end();
    child.on('close', (code) => {
      if (code === 0 && fs.existsSync(out) && fs.statSync(out).size > 44) {
        resolve({ ok: true, path: out });
      } else {
        resolve({ ok: false, reason: `piper exit ${code}: ${err.slice(-160)}` });
      }
    });
  });
}
