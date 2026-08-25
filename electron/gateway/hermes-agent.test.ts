// @ts-nocheck
import { describe, expect, it } from 'vitest';
import { stripHermesNoise, isHermesSessionMiss } from './hermes-agent';

describe('stripHermesNoise', () => {
  it('keeps the answer and drops session metadata', () => {
    const raw = 'PONG\n\nsession_id: 20260824_193349_41c519\n';
    expect(stripHermesNoise(raw)).toBe('PONG');
  });

  it('drops API failure banners', () => {
    expect(stripHermesNoise('API call failed after 3 retries: Connection error.')).toBe('');
  });

  it('never surfaces a missing-session CLI hint as the reply', () => {
    const raw =
      "No session found matching 'jarvis-voice'.\nUse 'hermes sessions list' to see available sessions.";
    expect(stripHermesNoise(raw)).toBe('');
    expect(isHermesSessionMiss(raw)).toBe(true);
  });
});
