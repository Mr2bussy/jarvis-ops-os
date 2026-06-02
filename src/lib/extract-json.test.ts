import { describe, it, expect } from 'vitest';
import { extractJson } from './extract-json';

describe('extractJson', () => {
  it('parses a bare JSON object', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it('extracts JSON from a ```json fenced block', () => {
    const t = 'Here you go:\n```json\n{"title":"X","items":[]}\n```\nThanks!';
    expect(extractJson(t)).toEqual({ title: 'X', items: [] });
  });

  it('extracts JSON from a plain ``` fenced block', () => {
    expect(extractJson('```\n{"ok":true}\n```')).toEqual({ ok: true });
  });

  it('strips prose surrounding the object', () => {
    expect(extractJson('Sure! {"n":42} done')).toEqual({ n: 42 });
  });

  it('handles nested objects (first { to last })', () => {
    expect(extractJson('{"a":{"b":2}}')).toEqual({ a: { b: 2 } });
  });

  it('returns null for empty input', () => {
    expect(extractJson('')).toBeNull();
  });

  it('returns null when no object delimiters are present', () => {
    expect(extractJson('no json here')).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    expect(extractJson('{"a": }')).toBeNull();
  });
});
