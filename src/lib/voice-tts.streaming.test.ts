// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { chunkTextForTts, softenForSpeech } from './voice-tts';

describe('chunkTextForTts', () => {
  it('returns empty for blank', () => {
    expect(chunkTextForTts('')).toEqual([]);
  });

  it('keeps short text as one chunk', () => {
    expect(chunkTextForTts('Hallo Welt.')).toEqual(['Hallo Welt.']);
  });

  it('splits long multi-sentence replies', () => {
    const text = Array.from({ length: 12 }, (_, i) => `Satz Nummer ${i + 1} ist ziemlich lang.`).join(' ');
    const chunks = chunkTextForTts(text, 80);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.length <= 120)).toBe(true);
    expect(softenForSpeech(chunks.join(' ')).length).toBeGreaterThan(50);
  });
});
