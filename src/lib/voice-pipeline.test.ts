// @ts-nocheck
import { describe, expect, it } from 'vitest';
import { encodeWavBase64 } from './voice-pipeline';

describe('encodeWavBase64', () => {
  it('writes a valid RIFF/WAVE header for 16 kHz mono PCM', () => {
    const samples = new Float32Array(1600);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.sin((i / 16000) * 2 * Math.PI * 440) * 0.2;
    const b64 = encodeWavBase64(samples, 16000);
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const ascii = (start: number, n: number) => String.fromCharCode(...bytes.slice(start, start + n));
    expect(ascii(0, 4)).toBe('RIFF');
    expect(ascii(8, 4)).toBe('WAVE');
    expect(ascii(12, 4)).toBe('fmt ');
    expect(ascii(36, 4)).toBe('data');
    expect(bytes.length).toBe(44 + 1600 * 2);
    const sampleRate = bytes[24] | (bytes[25] << 8) | (bytes[26] << 16) | (bytes[27] << 24);
    expect(sampleRate).toBe(16000);
  });
});
