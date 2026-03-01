# Railway Relay — Troubleshooting

The WebSocket relay runs on Railway and multiplexes AIS (vessels) and OpenSky (aircraft) streams. Here's how to interpret common log messages and fix issues.

## Log messages explained

### `AISSTREAM_API_KEY not set — AIS stream disabled`

**Cause:** No AIS API key configured.

**Fix:** Add `AISSTREAM_API_KEY` to your Railway service environment variables.

1. Railway dashboard → your relay service → Variables
2. Add `AISSTREAM_API_KEY` = your key from [aisstream.io](https://aisstream.io) (free tier)

---

### `OpenSky host unreachable from this environment (Railway IP likely blocked)`

**Cause:** OpenSky Network blocks requests from many datacenter IPs (including Railway). This is a network-level block, not an auth issue.

**Fix options:**

1. **Accept it** — Aircraft layer will be disabled; AIS (vessels) and the rest of the platform still work if you have `AISSTREAM_API_KEY`.

2. **Use a proxy** — Route OpenSky requests through a residential proxy or a VPS that isn't blocked. Requires code changes to the relay.

3. **Different host** — Deploy the relay to a provider whose IPs OpenSky doesn't block (e.g. some residential-friendly hosts). Trial and error.

**Note:** `OPENSKY_CLIENT_ID` and `OPENSKY_CLIENT_SECRET` help with rate limits and API access once the host *is* reachable. They do **not** bypass IP blocking.

---

### `SIGTERM` / `Stopping Container` / `npm error signal SIGTERM`

**Cause:** Railway sends SIGTERM when it stops a container (redeploy, scale-down, etc.). The relay shuts down gracefully.

**Status:** Normal. The relay handles SIGTERM and exits cleanly. The "npm error" is cosmetic — npm reports any signal-terminated process as failed even when exit code is 0.

---

## Required env vars (Railway)

| Variable | Required | Purpose |
|----------|----------|---------|
| `AISSTREAM_API_KEY` | Yes (for vessels) | AISStream.io WebSocket for real-time vessel positions |
| `OPENSKY_CLIENT_ID` | Optional | OpenSky OAuth2 — only helps if host is reachable |
| `OPENSKY_CLIENT_SECRET` | Optional | OpenSky OAuth2 |
| `PORT` | Auto-set by Railway | Default 8080 |

---

## WebSocket connection failing (1006, connection refused)

**Cause:** The client is using the wrong relay URL, or the relay service is down/sleeping.

**Fix:**

1. **Get your Railway URL** — Railway dashboard → your relay service → Settings → Networking → Public Networking. The domain will look like `yc-hedge-fund-relay-production.up.railway.app` (or similar).

2. **Set `VITE_RELAY_URL`** in your `.env` and Vercel (if deployed):
   ```
   VITE_RELAY_URL=wss://YOUR-ACTUAL-RAILWAY-DOMAIN.up.railway.app/ws
   ```

3. **Redeploy** — Vite bakes `VITE_*` vars at build time. After changing `.env`, rebuild and redeploy the frontend.

**Note:** If you renamed the relay from `atlas-relay` to `yc-hedge-fund-relay`, the Railway URL changed. Update `VITE_RELAY_URL` to the new domain.

---

## Health check

The relay exposes:

- `GET /` — Service info
- `GET /health` — `{ status, clients, uptime }`
- `WS /ws` — WebSocket endpoint

Use `/health` for Railway health checks if needed.
