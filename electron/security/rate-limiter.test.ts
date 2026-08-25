// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { TokenBucketRateLimiter } from './rate-limiter';

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
});
