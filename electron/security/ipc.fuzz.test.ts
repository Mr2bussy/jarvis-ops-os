/**
 * IPC fuzz — adversarial / oversized / wrong-type payloads against Zod handlers.
 */
// @ts-nocheck

import { describe, it, expect } from 'vitest';
import {
  validate,
  CompletePayload,
  WriteFilePayload,
  ReadFilePath,
  Mt5Payload,
  ConfigSetKey,
  AppsAddPayload,
  PathOnlyPayload,
  assertNoBlobPayload,
} from './ipc';

const OVERSIZE = 'x'.repeat(6_000_000);

describe('IPC fuzz payloads', () => {
  it.each([
    [null],
    [undefined],
    [42],
    ['string-not-object'],
    [[]],
    [{ messages: 'nope' }],
    [{ messages: [{ role: 'system', content: 'x' }] }],
    [{ messages: [{ role: 'user', content: 'x'.repeat(200_000) }] }],
    [{ messages: Array.from({ length: 60 }, () => ({ role: 'user', content: 'hi' })) }],
  ])('rejects complete fuzz case %#', (payload) => {
    expect(() => validate(CompletePayload, payload)).toThrow(/IPC validation failed/);
  });

  it.each([
    [{}],
    [{ filePath: 'a'.repeat(5000), content: 'ok' }],
    [{ filePath: 'ok.txt', content: OVERSIZE }],
    [{ filePath: 'ok.txt', content: 123 }],
    [{ filePath: null, content: 'x' }],
  ])('rejects write-file fuzz case %#', (payload) => {
    expect(() => validate(WriteFilePayload, payload)).toThrow(/IPC validation failed/);
  });

  it.each([[''], ['a'.repeat(5000)], [null], [123], [{ path: '/x' }]])(
    'rejects read-path fuzz case %#',
    (payload) => {
      expect(() => validate(ReadFilePath, payload)).toThrow(/IPC validation failed/);
    },
  );

  it.each([
    [{ host: 'h', port: 0, endpoint: 'a' }],
    [{ host: 'h', port: 99999, endpoint: 'a' }],
    [{ host: '', port: 1234, endpoint: 'a' }],
    [{ host: 'h', port: 1234, endpoint: 'e'.repeat(300) }],
    [{ host: 'h', port: '1234', endpoint: 'a' }],
  ])('rejects mt5 fuzz case %#', (payload) => {
    expect(() => validate(Mt5Payload, payload)).toThrow(/IPC validation failed/);
  });

  it.each([
    [{ name: '', value: 'x' }],
    [{ name: 'K', value: 'v'.repeat(30_000) }],
    [{ name: 1, value: 'x' }],
  ])('rejects config fuzz case %#', (payload) => {
    expect(() => validate(ConfigSetKey, payload)).toThrow(/IPC validation failed/);
  });

  it.each([
    [{ name: 'App', path: 'C:\\x.exe', kind: 'dll' }],
    [{ name: 'App', path: 'p'.repeat(5000), kind: 'exe' }],
    [{ name: '', path: 'C:\\x.exe', kind: 'exe' }],
  ])('rejects apps-add fuzz case %#', (payload) => {
    expect(() => validate(AppsAddPayload, payload)).toThrow(/IPC validation failed/);
  });

  it('accepts path-only payload under limit', () => {
    expect(validate(PathOnlyPayload, { path: 'C:\\Users\\zac\\doc.pdf' })).toEqual({
      path: 'C:\\Users\\zac\\doc.pdf',
    });
  });

  it('rejects blob-shaped file transfer (path-not-blob policy)', () => {
    expect(() =>
      assertNoBlobPayload({
        path: 'doc.pdf',
        base64: 'AAAA',
        blob: new ArrayBuffer(8),
      }),
    ).toThrow(/path-not-blob/i);
  });

  it('allows path-only without blob fields', () => {
    expect(() => assertNoBlobPayload({ path: 'doc.pdf' })).not.toThrow();
  });
});
