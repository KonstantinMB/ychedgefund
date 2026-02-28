# CLAUDE.md — Project Atlas

## What This Project Is
An AI-powered global intelligence dashboard with paper trading capabilities. WorldMonitor-class frontend (deck.gl globe, real-time data, intelligence analytics) with hedge fund strategy visualization built in. Built from scratch — no forks.

## Reference Architecture
Study https://github.com/koala73/worldmonitor for patterns. It is an AGPL-3.0 open-source project by Elie Habib. We are NOT forking it — we study its architecture and reimplement from scratch. Key patterns to follow:
- Edge function structure: one thin proxy per data source in /api/
- 3-tier caching: in-memory Map → Upstash Redis → upstream fetch, with stale-on-error fallback
- Client-side intelligence compute: CII, convergence detection, anomaly detection all run in browser
- No traditional database: all state in Redis + localStorage + static JSON
- Globe: deck.gl layers on dark MapLibre basemap
- News: RSS proxy with domain allowlist, source tier weighting
- AI pipeline: Groq → OpenRouter → browser T5 fallback chain with Redis dedup

When building a specific component, fetch the relevant WorldMonitor source file from GitHub for reference:
- Edge functions: https://github.com/koala73/worldmonitor/tree/main/api
- Architecture docs: https://github.com/koala73/worldmonitor/blob/main/README.md
- Technical docs: https://github.com/koala73/worldmonitor/blob/main/docs/DOCUMENTATION.md

## Tech Stack
- **Frontend**: Vanilla TypeScript + Vite (NO React, NO Next.js — keep bundle <300KB gzipped)
- **Globe**: deck.gl + MapLibre GL JS (free, no Mapbox license)
- **API Layer**: Vercel Edge Functions (serverless, /api/ directory)
- **Cache**: Upstash Redis (3-tier: memory → Redis → upstream)
- **WebSocket Relay**: Railway server for AIS + OpenSky + blocked RSS feeds
- **AI**: Groq (Llama 3.1 8B) with Redis dedup, browser T5 fallback
- **State**: Client-side reactive store + localStorage + Redis for cross-session
- **No traditional database in MVP** — this is intentional, following WorldMonitor's proven pattern
- **Dark theme only** — intelligence dashboard aesthetic (#0a0f0a background)

## Key Design Decisions
1. Vanilla TS, not React — WorldMonitor uses zero frameworks at ~250KB bundle. Framework overhead kills real-time dashboard performance.
2. All intelligence computation runs client-side in the browser — no backend ML dependency.
3. Static datasets (military bases, cables, nuclear sites, pipelines, financial centers) are JSON files in /src/data/ baked into the Vite build.
4. Paper trading engine runs entirely client-side with localStorage persistence.
5. Edge functions are thin proxies: fetch upstream → normalize schema → cache in Redis → return JSON.
6. Every data source is a public API with a free tier. No paid data dependencies in MVP.

## File Structure
```
atlas/
├── CLAUDE.md                    ← You are here
├── api/                         ← Vercel Edge Functions
│   ├── _cors.ts                 ← CORS middleware (allowlist our domains + localhost)
│   ├── _cache.ts                ← 3-tier cache (memory → Redis → upstream)
│   ├── data/                    ← OSINT data source adapters
│   │   ├── gdelt.ts             ← GDELT news events (15-min cache, no key)
│   │   ├── usgs.ts              ← Earthquakes (5-min cache, no key)
│   │   ├── acled.ts             ← Conflict events (1-hr cache, free key)
│   │   ├── firms.ts             ← NASA fire detection (10-min cache, free key)
│   │   ├── gdacs.ts             ← Disaster alerts (30-min cache, no key)
│   │   └── eonet.ts             ← NASA natural events (1-hr cache, no key)
│   ├── market/                  ← Financial data adapters
│   │   ├── finnhub.ts           ← Stock quotes (30-sec cache, free key 60 req/min)
│   │   ├── coingecko.ts         ← Crypto prices (1-min cache, demo key)
│   │   ├── yahoo.ts             ← Fallback market data (1-min cache, no key)
│   │   ├── fred.ts              ← Economic indicators (6-hr cache, free key)
│   │   ├── fear-greed.ts        ← Sentiment index (1-hr cache, no key)
│   │   └── stablecoins.ts       ← Peg monitoring (5-min cache)
│   ├── osint/                   ← OSINT-specific adapters
│   │   ├── opensky.ts           ← Aircraft (via Railway relay, free account)
│   │   ├── ais.ts               ← Vessels (via Railway relay, free key)
│   │   ├── sanctions.ts         ← OpenSanctions bulk (daily cache, no key)
│   │   └── polymarket.ts        ← Prediction markets (5-min cache, no key)
│   ├── rss/
│   │   ├── proxy.ts             ← Domain-allowlisted RSS proxy
│   │   └── feeds.json           ← 50+ feed definitions with source tiers
│   ├── ai/
│   │   ├── summarize.ts         ← LLM brief generation (Groq free tier)
│   │   ├── classify.ts          ← Threat classification
│   │   └── sentiment.ts         ← News sentiment scoring
│   └── trading/                 ← Paper trading state API
│       ├── portfolio.ts         ← Portfolio state (Redis-backed)
│       ├── signals.ts           ← Generated signals endpoint
│       └── performance.ts       ← Strategy metrics
├── relay/                       ← Railway WebSocket relay server
│   ├── index.ts                 ← Express + WebSocket server
│   ├── ais-stream.ts            ← AISStream.io multiplexer
│   ├── opensky-auth.ts          ← OpenSky OAuth2 proxy
│   ├── rss-blocked.ts           ← Proxy for Vercel-blocked feeds
│   └── railway.toml
├── src/                         ← Frontend (Vite + vanilla TS)
│   ├── index.html
│   ├── main.ts
│   ├── styles/
│   ├── globe/                   ← deck.gl globe + layers
│   │   ├── globe.ts             ← Globe init (deck.gl + MapLibre)
│   │   ├── layers/              ← One file per toggleable layer
│   │   └── controls.ts          ← Layer toggle UI
│   ├── panels/                  ← Right-side panels
│   │   ├── panel-manager.ts     ← Layout, resize, collapse
│   │   ├── news-feed.ts         ← Real-time news with clustering
│   │   ├── ai-insights.ts       ← LLM briefs
│   │   ├── country-instability.ts ← CII rankings
│   │   ├── strategic-risk.ts    ← Risk gauge
│   │   ├── markets.ts           ← Financial data panel
│   │   ├── signals.ts           ← Trading signals with confidence
│   │   └── portfolio.ts         ← Paper portfolio P&L
│   ├── trading/                 ← Paper trading engine (client-side)
│   │   ├── engine.ts            ← Core state machine
│   │   ├── portfolio.ts         ← Position tracking, P&L
│   │   ├── signals.ts           ← Signal generation from intelligence
│   │   ├── strategies/          ← geopolitical.ts, sentiment.ts, macro.ts
│   │   ├── risk.ts              ← Position limits, drawdown tracking
│   │   └── mock-data.ts         ← Pre-generated 12-month trade history
│   ├── intelligence/            ← Client-side analytics
│   │   ├── instability.ts       ← Country Instability Index (CII)
│   │   ├── convergence.ts       ← Geographic event convergence
│   │   ├── anomaly.ts           ← Welford's temporal baseline
│   │   ├── surge.ts             ← Military surge detection
│   │   └── cascade.ts           ← Infrastructure cascade model
│   ├── lib/                     ← Shared utilities
│   │   ├── cache.ts             ← Client-side request cache
│   │   ├── websocket.ts         ← WebSocket manager (auto-reconnect)
│   │   ├── state.ts             ← Reactive store (simple pub/sub)
│   │   ├── geo.ts               ← Haversine, grid binning
│   │   └── formatters.ts        ← Numbers, dates, currencies
│   └── data/                    ← Static datasets (JSON, baked into build)
│       ├── military-bases.json
│       ├── nuclear-facilities.json
│       ├── undersea-cables.json
│       ├── pipelines.json
│       ├── conflict-zones.json
│       ├── chokepoints.json
│       ├── financial-centers.json
│       └── geo-asset-mapping.json  ← Country → affected assets mapping
├── docs/
│   ├── PRD.md
│   ├── MVP-PLAN.md
│   └── DATA-SOURCES.md
├── scripts/
│   ├── setup.sh
│   └── generate-mock-trades.ts
├── package.json
├── vite.config.ts
├── tsconfig.json
├── vercel.json
└── .env.example

```

## Data Sources (All Free/Public)
### No API Key Required
- GDELT: `api.gdeltproject.org` — global news events, 15-min updates, tone scoring
- USGS: `earthquake.usgs.gov` — earthquakes, real-time GeoJSON
- GDACS: `gdacs.org/xml/rss.xml` — disaster alerts
- NASA EONET: `eonet.gsfc.nasa.gov/api/v3/events` — natural events
- Google News RSS: `news.google.com/rss/topics/*` — 50+ topic feeds
- Yahoo Finance: `query1.finance.yahoo.com` — stock/forex/crypto quotes
- mempool.space: `mempool.space/api` — Bitcoin data
- alternative.me: `api.alternative.me/fng/` — Fear & Greed Index
- Polymarket: `gamma-api.polymarket.com/events` — prediction markets
- OpenSanctions: `data.opensanctions.org` — sanctions bulk data
- CFTC COT: `cftc.gov/dea/newcot/deafut.txt` — futures positioning

### Free API Key Required
- Finnhub: `finnhub.io` — 60 req/min, real-time US quotes
- CoinGecko: `api.coingecko.com` — 30 req/min, 10K+ crypto coins
- FRED: `api.stlouisfed.org` — 120 req/min, 816K economic series
- SEC EDGAR: `data.sec.gov` — 10 req/sec, just set User-Agent header
- OpenSky: `opensky-network.org` — aircraft positions
- AISStream.io: `stream.aisstream.io` — vessel AIS via WebSocket
- NASA FIRMS: `firms.modaps.eosdis.nasa.gov` — satellite fire detection
- ACLED: `api.acleddata.com` — conflict events (free for non-commercial)
- Groq: `api.groq.com` — LLM inference (14.4K tokens/min free)
- EIA: `api.eia.gov` — US energy data (9K req/hr)

## Infrastructure
| Service | Provider | Plan | Cost |
|---------|----------|------|------|
| Frontend + Edge Functions | Vercel | Hobby (free) | $0 |
| WebSocket Relay | Railway | Pay-per-use | ~$5/mo |
| Cache + State | Upstash Redis | Pay-per-request | ~$0-10/mo |
| AI Inference | Groq | Free tier | $0 |
| **Total** | | | **$5-15/mo** |

## Paper Trading Configuration
```typescript
const PAPER_CONFIG = {
  startingCapital: 1_000_000,
  maxPositionPct: 0.10,         // 10% max single position
  maxSectorPct: 0.30,           // 30% max sector exposure
  maxDailyLossPct: 0.05,        // 5% daily loss = halt
  maxDrawdownPct: 0.15,         // 15% drawdown = reduce size 50%
  slippageBps: 5,               // 0.05% simulated slippage
  commissionPerTrade: 0,        // Commission-free (Alpaca model)
};
```

## Three MVP Trading Strategies
1. **Geopolitical Risk → Asset Mapping**: CII Z-score spikes trigger longs/shorts in correlated ETFs via geo-asset-mapping.json
2. **News Sentiment Momentum**: GDELT 4-hour rolling tone by sector, threshold triggers at ±3.0
3. **Macro Indicator Divergence**: FRED yield curve, unemployment claims, CPI → sector rotation

## Current Build Status
<!-- UPDATE THIS AFTER EACH SESSION -->
- [x] Phase 0: Foundation (repo, tooling, CORS, 3-tier cache, state management, WebSocket) ✅
- [ ] Phase 1: Globe + static layers (deck.gl, 12+ toggleable layers)
- [ ] Phase 2: Live data + news (edge functions, RSS proxy, markets panel)
- [ ] Phase 3: Intelligence engine (CII, convergence, anomaly, AI briefs)
- [ ] Phase 4: Paper trading + signals (engine, 3 strategies, portfolio UI)
- [ ] Phase 5: Polish + deploy (WebSocket, Cmd+K, PWA, production deploy)

## Coding Conventions
- Vanilla TypeScript — NO React, NO Vue, NO Angular, NO Svelte
- Direct DOM manipulation (document.createElement, appendChild, etc.)
- CSS variables for theming, no CSS-in-JS
- Edge functions export `config = { runtime: 'edge' }` and default handler
- All edge functions use the _cache.ts wrapper for consistent caching
- camelCase for variables/functions, PascalCase for classes/interfaces
- One layer per file in /src/globe/layers/
- One panel per file in /src/panels/
- Interfaces defined before implementations
- No console.log in production code — use structured logging
