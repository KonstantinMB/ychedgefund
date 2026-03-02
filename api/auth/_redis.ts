/**
 * Auth Redis client — shared across auth edge functions
 */

import { Redis } from '@upstash/redis';

let redisClient: Redis | null = null;

export function getAuthRedis(): Redis | null {
  if (redisClient) return redisClient;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;

  try {
    redisClient = new Redis({ url, token });
    return redisClient;
  } catch {
    return null;
  }
}

export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
export const RATE_LIMIT_TTL_SECONDS = 15 * 60; // 15 min
export const MAX_LOGIN_ATTEMPTS = 5;
