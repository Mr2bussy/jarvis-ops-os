// @ts-nocheck
import { describe, it, expect } from 'vitest';
import {
  pickVoice,
  pickVoiceNamed,
  toVoiceOptions,
  softenForSpeech,
  estimateSpeechMs,
  type VoiceLike,
} from './voice-tts';

const v = (name: string, lang: string, extra: Partial<VoiceLike> = {}): VoiceLike => ({
  name,
  lang,
  ...extra,
});

describe('pickVoice', () => {
  it('prefers an exact-language local voice over a remote one', () => {
    const voices = [v('Google Deutsch', 'de-DE'), v('Microsoft Katja', 'de-DE', { localService: true })];
    const c = pickVoice(voices, 'de-DE');
    expect(c.voice?.name).toBe('Microsoft Katja');
    expect(c.reason).toMatch(/Exakte Stimme/i);
  });

  it('takes an exact match even when no local voice exists', () => {
    const c = pickVoice([v('Google Deutsch', 'de-DE'), v('Daniel', 'en-GB')], 'de-DE');
    expect(c.voice?.name).toBe('Google Deutsch');
  });

  it('accepts a regional sibling before giving up on the language', () => {
    // de-AT is still German; reading German prose with it beats an English engine.
    const c = pickVoice(
      [v('Microsoft Hedda', 'de-AT', { localService: true }), v('Daniel', 'en-GB')],
      'de-DE',
    );
    expect(c.voice?.name).toBe('Microsoft Hedda');
    expect(c.reason).toMatch(/derselben Sprache/i);
  });

  it('normalises underscore locale tags that some engines report', () => {
    const c = pickVoice([v('Stimme', 'de_DE', { localService: true })], 'de-DE');
    expect(c.voice?.name).toBe('Stimme');
  });

  it('is case-insensitive about the requested tag', () => {
    const c = pickVoice([v('Katja', 'de-DE', { localService: true })], 'DE-de');
    expect(c.voice?.name).toBe('Katja');
  });

  it('reports a wrong-language fallback as a mismatch rather than a match', () => {
    // This is the regression under test: the old code silently read German with
    // an English voice and told nobody.
    const c = pickVoice([v('Daniel', 'en-GB', { default: true })], 'de-DE');
    expect(c.voice?.name).toBe('Daniel');
    expect(c.reason).toMatch(/Keine de-Stimme installiert/i);
  });

  it('returns no voice when the list is empty', () => {
    const c = pickVoice([], 'de-DE');
    expect(c.voice).toBeNull();
    expect(c.reason).toMatch(/Keine Stimmen/i);
  });

  it('returns no voice when nothing matches and there is no platform default', () => {
    const c = pickVoice([v('Daniel', 'en-GB'), v('Amelie', 'fr-FR')], 'de-DE');
    expect(c.voice).toBeNull();
  });
});

describe('estimateSpeechMs', () => {
  it('never returns a window shorter than the floor', () => {
    expect(estimateSpeechMs('Ja.')).toBeGreaterThanOrEqual(3000);
  });

  it('grows with the length of the text', () => {
    const short = estimateSpeechMs('Kurz.');
    const long = estimateSpeechMs('Kurz.'.repeat(200));
    expect(long).toBeGreaterThan(short);
  });

  it('shortens the window as the speaking rate rises', () => {
    const text = 'Ein mittellanger Satz, der eine Weile zum Sprechen braucht.'.repeat(5);
    expect(estimateSpeechMs(text, 2)).toBeLessThan(estimateSpeechMs(text, 1));
  });

  it('does not blow up on an absurdly low rate', () => {
    expect(Number.isFinite(estimateSpeechMs('Test', 0))).toBe(true);
  });
});

describe('pickVoiceNamed', () => {
  it('honours an exact operator pick', () => {
    const voices = [v('Google Deutsch', 'de-DE'), v('Microsoft Katja', 'de-DE', { localService: true })];
    const c = pickVoiceNamed(voices, 'de-DE', 'Google Deutsch');
    expect(c.voice?.name).toBe('Google Deutsch');
    expect(c.reason).toMatch(/Ausgewählt/i);
  });

  it('falls back to language ranking when the pick is missing', () => {
    const voices = [v('Microsoft Katja', 'de-DE', { localService: true })];
    const c = pickVoiceNamed(voices, 'de-DE', 'Missing Voice');
    expect(c.voice?.name).toBe('Microsoft Katja');
  });
});

describe('toVoiceOptions', () => {
  it('sorts German local voices first', () => {
    const opts = toVoiceOptions([
      v('Zulu', 'en-US'),
      v('Katja', 'de-DE', { localService: true }),
      v('Google DE', 'de-DE'),
    ]);
    expect(opts[0]?.name).toBe('Katja');
  });
});

describe('softenForSpeech', () => {
  it('strips markdown so TTS does not read stars', () => {
    expect(softenForSpeech('**Ready** — `ok`')).toBe('Ready — ok');
  });
});
