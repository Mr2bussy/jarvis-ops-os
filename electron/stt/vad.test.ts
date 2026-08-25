// @ts-nocheck
import { describe, expect, it } from 'vitest';
import { energyVad, sileroOrEnergyVad } from './vad';

describe('vad', () => {
  it('rejects short / silent audio', () => {
    const silent = new Float32Array(800);
    expect(energyVad(silent).speech).toBe(false);
  });

  it('accepts loud tone', () => {
    const tone = new Float32Array(3200);
    for (let i = 0; i < tone.length; i++) tone[i] = Math.sin(i / 10) * 0.5;
    const r = sileroOrEnergyVad(tone);
    expect(r.speech).toBe(true);
    expect(r.rms).toBeGreaterThan(0.01);
  });
});
