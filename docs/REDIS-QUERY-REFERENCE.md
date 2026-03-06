# Redis Query Reference — YC Hedge Fund (Atlas)

Reference for querying the Upstash Redis instance used by the API. Use for debugging, data inspection, and admin tasks.

---

## Option 1: redis-cli (Interactive)

Use the standard Redis CLI for interactive queries. Get the connection string from [Upstash Console](https://console.upstash.com) → your database → **Connect** → copy the `redis-cli` command.

```bash
# Connect (TLS enabled by default)
redis-cli -u rediss://:YOUR_PASSWORD@YOUR_ENDPOINT:YOUR_PORT
```

Or with explicit flags:

```bash
redis-cli --tls -h YOUR_ENDPOINT -p YOUR_PORT -a YOUR_PASSWORD
```

**Note:** The password is from the Redis protocol section in the console, not the REST token. Endpoint/port/password are shown in the "Redis Connect" area.

### Example redis-cli commands

```bash
# Once connected, run Redis commands directly:

# Get a user
GET user:trader1

# Get portfolio
GET portfolio:trader1

# List keys matching pattern (careful: blocks on large DBs)
KEYS user:*
KEYS portfolio:*

# SCAN (safer for production)
SCAN 0 MATCH user:* COUNT 100
SCAN 0 MATCH portfolio:* COUNT 100

# Leaderboard (sorted set)
ZRANGE leaderboard:monthly 0 9 REV WITHSCORES
ZREVRANK leaderboard:monthly trader1
ZCARD leaderboard:monthly

# Session (if you have a token)
GET session:abc123...
```

---

## Option 2: REST API (curl)

Uses `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` from your `.env` or Vercel.

```bash
# GET key
curl -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN" \
  "$UPSTASH_REDIS_REST_URL/get/user/trader1"

# SCAN keys
curl -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN" \
  "$UPSTASH_REDIS_REST_URL/scan/0/match/user:*/count/100"

# Leaderboard top 10
curl -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN" \
  "$UPSTASH_REDIS_REST_URL/zrange/leaderboard:monthly/0/9/rev/withscores"
```

---

## Option 3: Node/TypeScript (@upstash/redis)

**Environment:** `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (from `.env` or Vercel).

**Client:** `@upstash/redis` (already in `package.json`).

---

## Key Schema Overview

| Prefix | Type | TTL | Description |
|--------|------|-----|-------------|
| `user:{username}` | String (JSON) | — | User record (id, email, passwordHash, displayName) |
| `email:{email}` | String | — | Email → username lookup |
| `session:{token}` | String (JSON) | 30 days | Session data (userId, username, email, displayName, expiresAt) |
| `ratelimit:login:{ip}` | String (int) | 15 min | Failed login attempts per IP |
| `portfolio:{username}` | String (JSON) | — | Full portfolio state |
| `portfolio:{username}:archived:{ts}` | String (JSON) | 90 days | Archived portfolio before reset |
| `trades:{username}` | String (JSON) | — | Array of trade objects |
| `performance:{username}` | String (JSON) | 5 min | Cached performance metrics |
| `leaderboard:{period}` | Sorted Set | — | Username → return score (weekly/monthly/quarterly/yearly) |
| `leaderboard:prev_rank:{period}:{username}` | String | 7 days | Previous rank for rank-change indicator |
| `market:*`, `gdelt:*`, `osint:*`, `rss:*` | String (JSON) | varies | API response cache |

---

## Quick Query Script (Node/TypeScript)

Create `scripts/redis-query.ts` and run with `npx tsx scripts/redis-query.ts`:

```typescript
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// List all keys matching a pattern (use SCAN for production)
async function keys(pattern: string): Promise<string[]> {
  const allKeys: string[] = [];
  let cursor: number | string = 0;
  do {
    const [next, results] = await redis.scan(cursor, { match: pattern, count: 100 });
    cursor = next;
    allKeys.push(...(results as string[]));
  } while (cursor !== 0 && cursor !== '0');
  return allKeys;
}

// Example: get all users
const userKeys = await keys('user:*');
for (const k of userKeys) {
  const val = await redis.get(k);
  console.log(k, JSON.stringify(val, null, 2));
}
```

---

## Query Examples by Category

### 1. Users

```javascript
// Get user by username
const user = await redis.get('user:trader1');
// Returns: { id, email, username, passwordHash, displayName?, createdAt }

// Get username by email
const username = await redis.get('email:user@example.com');
// Returns: "trader1" (string)

// List all user keys
const [, userKeys] = await redis.scan(0, { match: 'user:*', count: 100 });
```

### 2. Sessions

```javascript
// Get session by token (token is in Authorization header, not stored as key)
// To list sessions you'd need to SCAN for session:*
const [, sessionKeys] = await redis.scan(0, { match: 'session:*', count: 100 });
// Then: redis.get(sessionKeys[0]) to inspect
```

### 3. Portfolios

```javascript
// Get portfolio for a user
const portfolio = await redis.get('portfolio:trader1');
// Returns: { cash, positions, closedTrades, realizedPnl, highWaterMark, maxDrawdown,
//            dailyStartValue, equityCurve, savedAt }

// List all portfolios
const [, portKeys] = await redis.scan(0, { match: 'portfolio:*', count: 100 });
const activePortfolios = portKeys.filter((k: string) => !k.includes(':archived:'));
```

### 4. Leaderboard (Sorted Sets)

```javascript
// Get top 10 for monthly period
const top = await redis.zrange('leaderboard:monthly', 0, 9, { rev: true, withScores: true });
// Returns: [username, score, username, score, ...]
// Score = returnPct * 10000 (e.g. 0.08 → 800)

// Get user's rank (0-based)
const rank = await redis.zrevrank('leaderboard:monthly', 'trader1');

// Get user's score
const score = await redis.zscore('leaderboard:monthly', 'trader1');

// Count total on leaderboard
const count = await redis.zcard('leaderboard:monthly');

// All periods: leaderboard:weekly, leaderboard:monthly, leaderboard:quarterly, leaderboard:yearly
```

### 5. Trades

```javascript
// Get trade history for user
const trades = await redis.get('trades:trader1');
// Returns: array of { id, symbol, direction, strategy, ... appendedAt }
```

### 6. Performance Cache

```javascript
// Get cached performance metrics
const perf = await redis.get('performance:trader1');
// Returns: { sharpeRatio, maxDrawdown, ... } or null if expired
```

### 7. Rate Limits

```javascript
// Check login rate limit for an IP
const attempts = await redis.get('ratelimit:login:192.168.1.1');
```

### 8. API Cache Keys (withCache)

| Key Pattern | TTL | Content |
|-------------|-----|---------|
| `market:quotes:v2` or `market:quotes:{symbols}` | 60s | Yahoo stock quotes |
| `market:crypto:v2` | 60s | CoinGecko crypto prices |
| `market:stream:v1` | 30s | Finnhub stream quotes |
| `market:radar` | 300s | Macro radar (Fear & Greed, BTC, etc.) |
| `gdelt:events:v3` | 1200s | GDELT events |
| `gdacs:alerts` | 1800s | GDACS disaster alerts |
| `osint:polymarket` | 300s | Polymarket prediction markets |
| `osint:polymarket-metrics` | varies | Polymarket metrics |
| `osint:polymarket-history:{ids}:{interval}` | varies | Polymarket history |
| `osint:aircraft:v2` | 60s | Aircraft positions |
| `rss:{hash}` | 600s | RSS feed proxy cache |

---

## Data Schemas

### user:{username}
```json
{
  "id": "u_xxx_yyy",
  "email": "user@example.com",
  "username": "trader1",
  "passwordHash": "...",
  "displayName": "Alpha Hunter",
  "createdAt": 1700000000000
}
```

### session:{token}
```json
{
  "userId": "u_xxx_yyy",
  "username": "trader1",
  "email": "user@example.com",
  "displayName": "Alpha Hunter",
  "createdAt": 1700000000000,
  "expiresAt": 1702592000000
}
```

### portfolio:{username}
```json
{
  "cash": 1000000,
  "positions": [{ "symbol": "AAPL", "quantity": 10, "marketValue": 1500, ... }],
  "closedTrades": [...],
  "realizedPnl": 0,
  "highWaterMark": 1008000,
  "maxDrawdown": 0,
  "dailyStartValue": 1000000,
  "equityCurve": [{ "timestamp": 1700000000000, "totalValue": 1008000, ... }],
  "savedAt": 1700000000000
}
```

### leaderboard:{period} (Sorted Set)
- **Member:** username (string)
- **Score:** returnPct × 10000 (e.g. 8% → 800)
- **Periods:** weekly, monthly, quarterly, yearly

---

## Useful One-Liners

```javascript
// All registered users
const [, users] = await redis.scan(0, { match: 'user:*' });

// All portfolios (excl. archived)
const [, ports] = await redis.scan(0, { match: 'portfolio:*' });
const activePorts = ports.filter(k => !k.includes(':archived:'));

// Monthly leaderboard top 20
await redis.zrange('leaderboard:monthly', 0, 19, { rev: true, withScores: true });

// Decode leaderboard score to return %
// score 800 → 8%, score -150 → -1.5%
```

---

## TTL Reference

| Key | TTL |
|-----|-----|
| `session:*` | 30 days |
| `ratelimit:login:*` | 15 min |
| `leaderboard:prev_rank:*` | 7 days |
| `portfolio:*:archived:*` | 90 days |
| `performance:*` | 5 min |
| Cache keys | 60s–1200s (see table above) |
