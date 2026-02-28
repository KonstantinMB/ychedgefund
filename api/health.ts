/**
 * Health check endpoint
 *
 * Simple test endpoint to verify edge function infrastructure is working.
 * Tests CORS wrapper and basic edge runtime functionality.
 */

import { withCors } from './_cors';

export const config = { runtime: 'edge' };

export default withCors(async (req: Request) => {
  const url = new URL(req.url);
  const includeEnv = url.searchParams.get('env') === 'true';

  const response = {
    status: 'ok',
    timestamp: Date.now(),
    date: new Date().toISOString(),
    edge: {
      runtime: 'edge',
      region: process.env.VERCEL_REGION || 'unknown',
    },
  };

  // Include environment check if requested (for debugging)
  if (includeEnv) {
    (response as any).env = {
      hasRedis: !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN),
      nodeEnv: process.env.NODE_ENV || 'development',
    };
  }

  return new Response(JSON.stringify(response, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
});
