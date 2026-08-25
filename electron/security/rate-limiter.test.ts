// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { TokenBucketRateLimiter, rateLimitOrThrow } from './rate-limiter';

describe('token bucket rate limiter', () => {
  it('allows burst then limits', () => {
    const lim = new TokenBucketRateLimiter({ capacity: 3, refillPerSec: 0 });
    expect(lim.tryConsume('ipc:test')).toBe(true);
    expect(lim.tryConsume('ipc:test')).toBe(true);
    expect(lim.tryConsume('ipc:test')).toBe(true);
    expect(lim.tryConsume('ipc:test')).toBe(false);
  });

  it('isolates keys', () => {
    const lim = new TokenBucketRateLimiter({ capacity: 1, refillPerSec: 0 });
    expect(lim.tryConsume('a')).toBe(true);
    expect(lim.tryConsume('b')).toBe(true);
    expect(lim.tryConsume('a')).toBe(false);
  });

  it('reset clears one key or all buckets', () => {
    const lim = new TokenBucketRateLimiter({ capacity: 1, refillPerSec: 0 });
    expect(lim.tryConsume('a')).toBe(true);
    expect(lim.tryConsume('a')).toBe(false);
    lim.reset('a');
    expect(lim.tryConsume('a')).toBe(true);
    expect(lim.tryConsume('b')).toBe(true);
    lim.reset();
    expect(lim.tryConsume('b')).toBe(true);
  });

  it('rateLimitOrThrow surfaces a clear error when exhausted', () => {
    const lim = new TokenBucketRateLimiter({ capacity: 1, refillPerSec: 0 });
    rateLimitOrThrow(lim, 'chat');
    expect(() => rateLimitOrThrow(lim, 'chat')).toThrow(/Rate limit exceeded for chat/);
  });
});
