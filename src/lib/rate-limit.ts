import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// In-memory rate limiter for local development
class InMemoryLimiter {
  private store = new Map<string, { count: number; reset: number }>();
  private max: number;
  private windowMs: number;

  constructor(max: number, windowMs: number) {
    this.max = max;
    this.windowMs = windowMs;
  }

  async limit(key: string): Promise<{ remaining: number }> {
    const now = Date.now();
    const existing = this.store.get(key);

    if (!existing || now > existing.reset) {
      this.store.set(key, { count: 1, reset: now + this.windowMs });
      return { remaining: this.max - 1 };
    }

    if (existing.count >= this.max) {
      return { remaining: 0 };
    }

    existing.count++;
    return { remaining: this.max - existing.count };
  }
}

// Redis-based rate limiter for production
let redisLimiter: Ratelimit | null = null;
let memoryLimiter: InMemoryLimiter | null = null;

const globalMemoryState = globalThis as typeof globalThis & {
  __kryptaMemoryLimiter?: InMemoryLimiter;
};

function getLimiter(): InMemoryLimiter | Ratelimit {
  if (!redisLimiter && process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    redisLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, "60 s"),
      analytics: true,
    });
  }

  if (!memoryLimiter) {
    memoryLimiter = globalMemoryState.__kryptaMemoryLimiter ?? new InMemoryLimiter(10, 60000);
    globalMemoryState.__kryptaMemoryLimiter = memoryLimiter;
  }

  return redisLimiter || memoryLimiter;
}

export async function rateLimit(key: string, maxRequests: number, window: string) {
  const limiter = getLimiter();

  if (limiter instanceof Ratelimit) {
    const result = await limiter.limit(key);
    return {
      success: result.success,
      remaining: result.remaining,
      limit: result.limit,
      reset: result.reset,
    };
  }

  // In-memory limiter
  const result = await limiter.limit(key);
  return {
    success: result.remaining > 0,
    remaining: result.remaining,
    limit: maxRequests,
    reset: Date.now() + 60000,
  };
}

// Pre-configured limiters for different endpoints
export const apiLimiter = (key: string) => rateLimit(`api:${key}`, 100, "60 s");
export const webhookLimiter = (key: string) => rateLimit(`webhook:${key}`, 1000, "60 s");
export const authLimiter = (key: string) => rateLimit(`auth:${key}`, 5, "15 m");
