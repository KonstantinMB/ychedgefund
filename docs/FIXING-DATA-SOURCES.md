# Fixing Data Sources

## Current Issues

### 1. Railway Relay - AIS Disconnection Loop ✅ FIXED

**Problem**: AISStream.io returns 503 error → infinite reconnection loop → Railway kills container

**Root Cause**: Invalid or missing `AISSTREAM_API_KEY`

**Fix Applied**:
- Added authentication check before connecting
- Stop reconnection attempts on 503/401/403 errors
- Prevent infinite loop that kills Railway container

**Action Required**:
1. Get free API key: https://aisstream.io
2. Add to Railway environment variables:
   ```
   AISSTREAM_API_KEY=your_key_here
   ```
3. Restart Railway service

**If you don't need vessel tracking**:
- Leave `AISSTREAM_API_KEY` unset
- Relay will run without AIS (aircraft only)

---

### 2. ACLED OAuth Authentication

**Status**: Implementation complete, needs credentials testing

**Files Changed**:
- `/api/data/acled.ts` - OAuth flow with 24h token caching
- `.env.example` - Updated with OAuth instructions

**Test Your ACLED Connection**:
```bash
# 1. Add credentials to .env.local
ACLED_EMAIL=your_email@domain.com
ACLED_PASSWORD=your_password

# 2. Run test script
npx tsx scripts/test-acled.ts

# Expected output:
# ✅ Token received
# ✅ Received 50 events
# ✅ ACLED connection is working!
```

**If Test Fails**:
- **401 Unauthorized**: Wrong email/password
- **Account not activated**: Check your email for activation link
- **Need to register**: https://acleddata.com/register (free for non-commercial)

**Deploy to Vercel**:
```bash
# Add environment variables in Vercel dashboard
vercel env add ACLED_EMAIL
vercel env add ACLED_PASSWORD

# Redeploy
vercel --prod
```

---

### 3. Aircraft Data - OpenSky Timeout ✅ FIXED

**Changes Applied**:
- Increased timeout: 8s → 20s
- Added adsb.lol fallback endpoint
- Added ADS-B Exchange for war zones (Iraq, Ukraine, Taiwan, Israel)
- Parallel source racing (first successful response wins)

**No Action Required** - will work automatically

---

## Data Source Comparison: WorldMonitor vs Atlas

### ✅ Matching Implementation

| Source | WorldMonitor | Atlas | Status |
|--------|--------------|-------|--------|
| GDELT | RSS/API | API | ✅ |
| USGS Earthquakes | GeoJSON | JSON | ✅ |
| ACLED | OAuth | OAuth | ✅ |
| OpenSky | REST poll | REST + fallbacks | ✅ Enhanced |
| Polymarket | GraphQL | REST | ✅ |

### Key Differences

**ACLED**:
- **WorldMonitor**: Simple API key
- **Atlas**: OAuth 2.0 (more secure, required by ACLED as of 2025)

**Aircraft**:
- **WorldMonitor**: OpenSky only
- **Atlas**: OpenSky + adsb.fi + ADS-B Exchange (triple redundancy)

**Caching**:
- **WorldMonitor**: Upstash Redis only
- **Atlas**: 3-tier (memory → Redis → upstream) with stale-on-error

---

## Verification Checklist

Run these commands to verify all data sources:

```bash
# 1. ACLED
npx tsx scripts/test-acled.ts

# 2. Start local dev server
npm run dev

# 3. Test endpoints
curl http://localhost:3000/api/data/gdelt | jq '.count'
curl http://localhost:3000/api/data/usgs | jq '.count'
curl http://localhost:3000/api/data/acled | jq '.count'
curl http://localhost:3000/api/osint/opensky | jq '.count'
curl http://localhost:3000/api/osint/polymarket | jq '.count'

# Expected: Each returns count > 0
```

---

## Railway Relay Logs Explained

### Good Logs:
```
[Relay] AIS stream client started
[Relay] WebSocket relay listening on port 8080
[AIS] Connected to AISStream.io
[OpenSky] Polling started (interval: 30s)
```

### Warning (OK):
```
[OpenSky] Host unreachable from this environment (Railway IP likely blocked)
```
This is expected - OpenSky blocks Railway IPs. Aircraft data will come from edge functions instead.

### Bad Logs:
```
[AIS] Disconnected, reconnecting in 5000ms
[AIS] WebSocket error: Unexpected server response: 503
```
**Fix**: Invalid AISSTREAM_API_KEY

```
npm error signal SIGTERM
```
**Fix**: Container killed due to infinite reconnection loop (now fixed)

---

## Environment Variables Summary

### Required for Conflict Zones:
```bash
ACLED_EMAIL=your_email@domain.com
ACLED_PASSWORD=your_password
```

### Optional for Vessel Tracking:
```bash
AISSTREAM_API_KEY=your_key_here
```

### Optional for Aircraft (better results with OAuth):
```bash
OPENSKY_CLIENT_ID=your_client_id
OPENSKY_CLIENT_SECRET=your_client_secret
```

---

## Next Steps

1. **Test ACLED**: Run `npx tsx scripts/test-acled.ts`
2. **Fix AIS** (optional): Get key from https://aisstream.io
3. **Deploy**: Add env vars to Vercel/Railway
4. **Monitor**: Check `/health` endpoints for status

All core war zone data (ACLED conflicts, aircraft, earthquakes) will work without Railway relay.
