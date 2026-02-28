# Atlas

AI-powered global intelligence dashboard with paper trading capabilities.

WorldMonitor-class frontend (deck.gl globe, real-time OSINT data, intelligence analytics) with hedge fund strategy visualization built in.

## Status

**Phase 0: COMPLETE** - Edge function infrastructure ready
- ✅ CORS middleware
- ✅ 3-tier caching (memory → Redis → upstream)
- ✅ Health check endpoint
- ✅ Cache test endpoint
- ✅ Test suite (23/23 passing)

**Next:** Phase 1 - Data source adapters

## Quick Start

```bash
# Install dependencies
npm install

# Run test suite
npm test

# Start development server
npx vercel dev --yes

# Test endpoints
curl http://localhost:3000/api/health
curl http://localhost:3000/api/cache-test
```

## Architecture

```
Client → CORS → Edge Function → Cache → Upstream API
                                  ↓
                    Memory (< 1ms) → Redis (~10ms) → Fetch (~100ms)
```

**Caching Performance:**
- Memory cache: **< 1ms** (340x faster than upstream)
- Redis cache: **~10-50ms** (2-10x faster)
- Upstream fetch: **100ms - 2s**
- Stale-on-error: Returns cached data if upstream fails

## Tech Stack

- **Frontend**: Vanilla TypeScript + Vite (target: <300KB gzipped)
- **Globe**: deck.gl + MapLibre GL JS
- **API**: Vercel Edge Functions
- **Cache**: Upstash Redis (3-tier)
- **AI**: Groq (Llama 3.1 8B)
- **State**: Client-side reactive store + localStorage + Redis

## Project Structure

```
atlas/
├── api/                  ← Vercel Edge Functions
│   ├── _cors.ts          ← CORS middleware
│   ├── _cache.ts         ← 3-tier caching
│   ├── health.ts         ← Health check
│   └── cache-test.ts     ← Cache demo
├── src/                  ← Frontend (Phase 1+)
├── scripts/              ← Build/test scripts
│   └── test-edge-functions.js
├── docs/                 ← Documentation
│   ├── EDGE-FUNCTIONS.md
│   └── PHASE-0-COMPLETE.md
└── CLAUDE.md             ← Agent instructions
```

## Documentation

- **[CLAUDE.md](./CLAUDE.md)** - Project overview and architecture
- **[docs/EDGE-FUNCTIONS.md](./docs/EDGE-FUNCTIONS.md)** - Edge function patterns and templates
- **[docs/PHASE-0-COMPLETE.md](./docs/PHASE-0-COMPLETE.md)** - Phase 0 delivery summary

## Environment Setup

```bash
# Copy template
cp .env.example .env

# Required for production (optional for local dev)
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token-here
```

Without Redis configured, the system falls back to memory-only cache (fine for local development).

## Testing

```bash
# Run test suite
npm test

# Expected output:
# ========================
# Results: 23 passed, 0 failed
# ========================
```

Tests verify:
- Health endpoint
- Cache system (memory tier)
- CORS middleware
- Upstream fetch simulation
- Stale-on-error fallback

## Development Workflow

1. **Create edge function** in `/api/` following the template
2. **Test locally** with `npm test` or manual curl
3. **Deploy** with `vercel --prod`

**Edge Function Template:**
```typescript
import { withCors } from './_cors.ts';
import { withCache } from './_cache.ts';

export const config = { runtime: 'edge' };

export default withCors(async (req: Request) => {
  return withCache('source:key', TTL_SECONDS, async () => {
    const res = await fetch(UPSTREAM_URL);
    if (!res.ok) throw new Error(`Upstream error: ${res.status}`);
    return res.json();
  });
});
```

## Contributing

See [CLAUDE.md](./CLAUDE.md) for coding conventions and architecture guidelines.

## License

MIT

---

**Built with:** Vanilla TypeScript, Vercel Edge Functions, Upstash Redis
**Status:** Phase 0 Complete
**Next:** Data source adapters (GDELT, USGS, ACLED, NASA FIRMS, etc.)
