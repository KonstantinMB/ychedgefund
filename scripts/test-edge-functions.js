#!/usr/bin/env node
/**
 * Edge Function Test Suite
 *
 * Tests the Phase 0 edge function infrastructure:
 * - CORS middleware
 * - 3-tier caching system
 * - Health check endpoint
 * - Cache test endpoint
 */

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✓ ${message}`);
    passed++;
  } else {
    console.error(`✗ ${message}`);
    failed++;
  }
}

async function testHealthEndpoint() {
  console.log('\n=== Testing Health Endpoint ===');

  try {
    const healthModule = await import('../api/health.ts');
    const handler = healthModule.default;

    const request = new Request('http://localhost:3000/api/health?env=true', {
      headers: { 'Origin': 'http://localhost:3000' },
    });
    const response = await handler(request);
    const data = await response.json();

    assert(response.status === 200, 'Health endpoint returns 200');
    assert(data.status === 'ok', 'Health status is ok');
    assert(data.timestamp > 0, 'Health timestamp is present');
    assert(data.edge.runtime === 'edge', 'Runtime is edge');
    assert(response.headers.get('Content-Type')?.includes('application/json'), 'Content-Type is JSON');
    assert(response.headers.get('Access-Control-Allow-Origin') === 'http://localhost:3000', 'CORS headers present with allowed origin');

    console.log('Response sample:', {
      status: data.status,
      timestamp: data.timestamp,
      runtime: data.edge.runtime,
    });
  } catch (error) {
    console.error('Health endpoint failed:', error.message);
    failed++;
  }
}

async function testCacheEndpoint() {
  console.log('\n=== Testing Cache System ===');

  try {
    const cacheModule = await import('../api/cache-test.ts');
    const handler = cacheModule.default;

    // Test 1: Upstream fetch
    console.log('\n1. Testing upstream fetch...');
    const start1 = Date.now();
    const req1 = new Request('http://localhost:3000/api/cache-test?ttl=60');
    const res1 = await handler(req1);
    const data1 = await res1.json();
    const duration1 = Date.now() - start1;

    assert(res1.status === 200, 'Cache endpoint returns 200');
    assert(data1.success === true, 'Response is successful');
    assert(data1.data.message, 'Data contains message');
    assert(data1.meta.duration >= 100, 'Upstream fetch took > 100ms (simulated delay)');
    assert(data1.meta.likelyCacheTier === 'upstream', 'First call fetched from upstream');

    console.log(`  Duration: ${duration1}ms`);
    console.log(`  Cache tier: ${data1.meta.likelyCacheTier}`);

    // Test 2: Memory cache hit
    console.log('\n2. Testing memory cache...');
    const start2 = Date.now();
    const req2 = new Request('http://localhost:3000/api/cache-test?ttl=60');
    const res2 = await handler(req2);
    const data2 = await res2.json();
    const duration2 = Date.now() - start2;

    assert(res2.status === 200, 'Cached response returns 200');
    assert(data2.data.randomValue === data1.data.randomValue, 'Cached data matches original');
    assert(data2.meta.duration < 50, 'Memory cache hit took < 50ms');
    assert(data2.meta.likelyCacheTier === 'memory', 'Second call hit memory cache');

    console.log(`  Duration: ${duration2}ms`);
    console.log(`  Cache tier: ${data2.meta.likelyCacheTier}`);
    console.log(`  Speedup: ${Math.round(duration1 / duration2)}x faster`);

    // Test 3: Force refresh
    console.log('\n3. Testing force refresh...');
    const req3 = new Request('http://localhost:3000/api/cache-test?refresh=true');
    const res3 = await handler(req3);
    const data3 = await res3.json();

    assert(res3.status === 200, 'Force refresh returns 200');
    assert(data3.data.randomValue !== data2.data.randomValue, 'Force refresh fetches new data');
    assert(data3.meta.likelyCacheTier === 'upstream', 'Force refresh fetches from upstream');

    console.log(`  Cache tier: ${data3.meta.likelyCacheTier}`);
    console.log(`  New random value: ${data3.data.randomValue}`);
  } catch (error) {
    console.error('Cache endpoint failed:', error.message);
    console.error(error.stack);
    failed++;
  }
}

async function testCORSHeaders() {
  console.log('\n=== Testing CORS Middleware ===');

  try {
    const healthModule = await import('../api/health.ts');
    const handler = healthModule.default;

    // Test with allowed origin
    const req1 = new Request('http://localhost:3000/api/health', {
      headers: {
        'Origin': 'http://localhost:3000',
      },
    });
    const res1 = await handler(req1);

    assert(res1.headers.get('Access-Control-Allow-Origin') === 'http://localhost:3000', 'CORS origin header set for localhost');
    assert(res1.headers.get('Access-Control-Allow-Credentials') === 'true', 'CORS credentials enabled');

    // Test OPTIONS preflight
    const req2 = new Request('http://localhost:3000/api/health', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:3001',
      },
    });
    const res2 = await handler(req2);

    assert(res2.status === 204, 'OPTIONS request returns 204');
    assert(res2.headers.get('Access-Control-Allow-Methods'), 'CORS methods header present');
    assert(res2.headers.get('Access-Control-Allow-Headers'), 'CORS headers header present');

    console.log('CORS headers:', {
      origin: res1.headers.get('Access-Control-Allow-Origin'),
      methods: res2.headers.get('Access-Control-Allow-Methods'),
      credentials: res1.headers.get('Access-Control-Allow-Credentials'),
    });
  } catch (error) {
    console.error('CORS test failed:', error.message);
    failed++;
  }
}

// Run all tests
(async () => {
  console.log('Edge Function Test Suite');
  console.log('========================\n');

  await testHealthEndpoint();
  await testCacheEndpoint();
  await testCORSHeaders();

  console.log('\n========================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('========================\n');

  if (failed > 0) {
    process.exit(1);
  }
})();
