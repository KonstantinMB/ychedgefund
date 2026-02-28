/**
 * OpenSky Aircraft Positions Edge Function
 *
 * Uses OAuth2 client_credentials (OPENSKY_CLIENT_ID / OPENSKY_CLIENT_SECRET) when set.
 * Falls back to anonymous access (heavily rate-limited from shared datacenter IPs).
 * Returns empty array gracefully on any failure — never 500s.
 */

import { withCors } from '../_cors';
import { withCache } from '../_cache';

export const config = { runtime: 'edge' };

// State vector field indices per OpenSky API docs
const IDX_ICAO24 = 0;
const IDX_CALLSIGN = 1;
const IDX_ORIGIN_COUNTRY = 2;
const IDX_LON = 5;
const IDX_LAT = 6;
const IDX_GEO_ALTITUDE = 7;
const IDX_ON_GROUND = 8;
const IDX_VELOCITY = 9;
const IDX_HEADING = 10;

const OPENSKY_URL =
  'https://opensky-network.org/api/states/all?lamin=-90&lomin=-180&lamax=90&lomax=180';
const OPENSKY_TOKEN_URL =
  'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';

type StateVector = (string | number | boolean | null)[];

interface OpenSkyResponse {
  time: number;
  states: StateVector[] | null;
}

interface Aircraft {
  icao24: string;
  callsign: string;
  country: string;
  lat: number;
  lon: number;
  altitude: number;
  velocity: number;
  heading: number;
}

// ── OAuth2 token (edge functions are stateless, token fetched per cold start) ──

async function fetchBearerToken(): Promise<string | null> {
  const clientId = (typeof process !== 'undefined' ? process.env.OPENSKY_CLIENT_ID : undefined)
    ?? (globalThis as Record<string, unknown>)['OPENSKY_CLIENT_ID'] as string | undefined;
  const clientSecret = (typeof process !== 'undefined' ? process.env.OPENSKY_CLIENT_SECRET : undefined)
    ?? (globalThis as Record<string, unknown>)['OPENSKY_CLIENT_SECRET'] as string | undefined;

  if (!clientId || !clientSecret) return null;

  try {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    });

    const res = await fetch(OPENSKY_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) return null;
    const json = await res.json() as { access_token: string };
    return json.access_token ?? null;
  } catch {
    return null;
  }
}

function normalizeState(s: StateVector): Aircraft | null {
  if (s[IDX_ON_GROUND] === true) return null;

  const lat = s[IDX_LAT] as number | null;
  const lon = s[IDX_LON] as number | null;
  if (lat == null || lon == null || isNaN(lat) || isNaN(lon)) return null;

  return {
    icao24: String(s[IDX_ICAO24] ?? '').trim(),
    callsign: String(s[IDX_CALLSIGN] ?? '').trim(),
    country: String(s[IDX_ORIGIN_COUNTRY] ?? '').trim(),
    lat,
    lon,
    altitude: Number(s[IDX_GEO_ALTITUDE] ?? 0),
    velocity: Number(s[IDX_VELOCITY] ?? 0),
    heading: Number(s[IDX_HEADING] ?? 0),
  };
}

export default withCors(async (_req: Request) => {
  // Authenticated requests get 10-second cache; anonymous stay at 5 min
  const isAuthenticated = !!(
    (typeof process !== 'undefined' ? process.env.OPENSKY_CLIENT_ID : undefined)
    ?? (globalThis as Record<string, unknown>)['OPENSKY_CLIENT_ID']
  );
  const cacheTtl = isAuthenticated ? 10 : 300;

  let aircraft: Aircraft[] = [];
  try {
    aircraft = await withCache<Aircraft[]>('osint:aircraft', cacheTtl, async () => {
      // Get OAuth2 token if credentials are available
      const token = await fetchBearerToken();

      const headers: Record<string, string> = {
        'User-Agent': 'Atlas/1.0 (intelligence dashboard)',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(OPENSKY_URL, { headers });

      // Rate-limited or blocked — return empty rather than error
      if (res.status === 429 || res.status === 403 || res.status === 503) return [];
      if (!res.ok) throw new Error(`OpenSky upstream error: ${res.status}`);

      const data: OpenSkyResponse = await res.json();
      const states = data.states ?? [];

      const results: Aircraft[] = [];
      for (const state of states) {
        if (results.length >= 1000) break;
        const ac = normalizeState(state);
        if (ac) results.push(ac);
      }

      return results;
    });
  } catch {
    // Any error (Upstash overload, network failure) → return empty, never 500
    aircraft = [];
  }

  return new Response(
    JSON.stringify({
      aircraft,
      count: aircraft.length,
      source: 'opensky',
      authenticated: isAuthenticated,
      timestamp: Date.now(),
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `public, s-maxage=${cacheTtl}, stale-while-revalidate=${cacheTtl * 2}`,
      },
    }
  );
});
