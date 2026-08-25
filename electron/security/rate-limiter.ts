/**
 * Token-bucket rate limiter for IPC and external API calls.
 */
// @ts-nocheck

export interface RateLimiterOptions {
  capacity: number;
  refillPerSec: number;
}

interface Bucket {
  tokens: number;
  lastRefill: number;
}

export class TokenBucketRateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(private readonly opts: RateLimiterOptions) {}

  /** Returns true if allowed, false if rate-limited. */
  tryConsume(key: string, cost = 1): boolean {
    const now = Date.now();
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { tokens: this.opts.capacity, lastRefill: now };
      this.buckets.set(key, bucket);
    }
    const elapsed = (now - bucket.lastRefill) / 1000;
    bucket.tokens = Math.min(this.opts.capacity, bucket.tokens + elapsed * this.opts.refillPerSec);
    bucket.lastRefill = now;
    if (bucket.tokens < cost) return false;
    bucket.tokens -= cost;
    return true;
  }

  reset(key?: string): void {
    if (key) this.buckets.delete(key);
    else this.buckets.clear();
  }
}

/** Default limiters for common surfaces. */
export const ipcRateLimiter = new TokenBucketRateLimiter({ capacity: 60, refillPerSec: 10 });
export const apiRateLimiter = new TokenBucketRateLimiter({ capacity: 30, refillPerSec: 5 });

export function rateLimitOrThrow(limiter: TokenBucketRateLimiter, key: string): void {
  if (!limiter.tryConsume(key)) {
    throw new Error(`Rate limit exceeded for ${key}`);
  }
}
