/**
 * Cache system test endpoint
 *
 * Demonstrates the 3-tier caching system in action.
 * Returns cache hit/miss information and timing data.
 */

import { withCors } from './_cors';
import { withCache } from './_cache';

export const config = { runtime: 'edge' };

export default withCors(async (req: Request) => {
  const url = new URL(req.url);
  const forceRefresh = url.searchParams.get('refresh') === 'true';
  const ttl = parseInt(url.searchParams.get('ttl') || '60', 10);

  const startTime = Date.now();

  try {
    // Use unique key if force refresh, otherwise use standard key
    const cacheKey = forceRefresh ? `test:cache:${Date.now()}` : 'test:cache';

    // Simulate upstream API call with the cache wrapper
    const data = await withCache(cacheKey, ttl, async () => {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 100));

      return {
        message: 'This data was fetched from upstream',
        fetchedAt: new Date().toISOString(),
        randomValue: Math.random(),
      };
    });

    const duration = Date.now() - startTime;

    return new Response(
      JSON.stringify(
        {
          success: true,
          data,
          meta: {
            duration,
            ttl,
            // If duration < 50ms, likely came from memory cache
            // If duration < 100ms, likely came from Redis
            // If duration > 100ms, likely fetched from upstream
            likelyCacheTier:
              duration < 50
                ? 'memory'
                : duration < 100
                ? 'redis'
                : 'upstream',
            timestamp: Date.now(),
          },
        },
        null,
        2
      ),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        timestamp: Date.now(),
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
