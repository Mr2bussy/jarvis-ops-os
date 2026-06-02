import { describe, it, expect } from 'vitest';
import { validate, WriteFilePayload, CompletePayload, ReadFilePath, Mt5Payload } from './ipc';

describe('validate / IPC schemas', () => {
  it('accepts a valid write-file payload', () => {
    const p = validate(WriteFilePayload, { filePath: 'C:/x/y.txt', content: 'hi' });
    expect(p.filePath).toBe('C:/x/y.txt');
  });

  it('rejects a write-file payload missing content', () => {
    expect(() => validate(WriteFilePayload, { filePath: 'a' })).toThrow(/validation failed/i);
  });

  it('rejects a null/non-object payload', () => {
    expect(() => validate(WriteFilePayload, null)).toThrow(/validation failed/i);
  });

  it('accepts a valid completion payload', () => {
    const p = validate(CompletePayload, { messages: [{ role: 'user', content: 'hi' }], maxTokens: 256 });
    expect(p.messages).toHaveLength(1);
  });

  it('rejects a completion payload with an invalid role', () => {
    expect(() => validate(CompletePayload, { messages: [{ role: 'system', content: 'x' }] })).toThrow(
      /validation failed/i,
    );
  });

  it('rejects an empty messages array', () => {
    expect(() => validate(CompletePayload, { messages: [] })).toThrow(/validation failed/i);
  });

  it('validates a read-file path string', () => {
    expect(validate(ReadFilePath, 'C:/a/b')).toBe('C:/a/b');
    expect(() => validate(ReadFilePath, '')).toThrow(/validation failed/i);
  });

  it('validates an mt5 payload and rejects an out-of-range port', () => {
    expect(validate(Mt5Payload, { host: 'localhost', port: 1234, endpoint: 'account' }).port).toBe(1234);
    expect(() => validate(Mt5Payload, { host: 'localhost', port: 99999, endpoint: 'account' })).toThrow(
      /validation failed/i,
    );
  });
});
