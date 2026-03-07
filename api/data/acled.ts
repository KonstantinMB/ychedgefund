/**
 * ACLED Conflict Events Edge Function
 *
 * Fetches conflict events from the Armed Conflict Location & Event Data Project.
 * Uses OAuth authentication with token caching. 1-hour cache.
 */

import { withCors } from '../_cors';
import { withCache } from '../_cache';

export const config = { runtime: 'edge' };

interface AcledRawEvent {
  event_id_cnty: string;
  event_date: string;
  event_type: string;
  country: string;
  latitude: string;
  longitude: string;
  fatalities: string;
  notes: string;
}

interface AcledEvent {
  id: string;
  date: number;
  type: string;
  country: string;
  lat: number;
  lon: number;
  fatalities: number;
  notes: string;
}

interface OAuthTokenResponse {
  token_type: string;
  expires_in: number;
  access_token: string;
  refresh_token: string;
}

function normalizeEvent(raw: AcledRawEvent): AcledEvent {
  return {
    id: raw.event_id_cnty,
    date: new Date(raw.event_date).getTime(),
    type: raw.event_type,
    country: raw.country,
    lat: parseFloat(raw.latitude),
    lon: parseFloat(raw.longitude),
    fatalities: parseInt(raw.fatalities, 10) || 0,
    notes: raw.notes ?? '',
  };
}

/**
 * Get ACLED OAuth access token (cached for 24 hours)
 */
async function getAccessToken(): Promise<string | null> {
  const email = process.env.ACLED_EMAIL;
  const password = process.env.ACLED_PASSWORD;

  if (!email || !password) {
    console.error('[ACLED] Missing credentials in environment variables');
    return null;
  }

  try {
    // Try to get cached token first
    const cachedToken = await withCache<string>('acled:oauth_token', 86400, async () => {
      // Request new OAuth token
      const formData = new URLSearchParams({
        username: email,
        password: password,
        grant_type: 'password',
        client_id: 'acled',
      });

      const tokenRes = await fetch('https://acleddata.com/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      if (!tokenRes.ok) {
        const errorText = await tokenRes.text();
        throw new Error(`ACLED OAuth error: ${tokenRes.status} - ${errorText}`);
      }

      const tokenData: OAuthTokenResponse = await tokenRes.json();
      return tokenData.access_token;
    });

    return cachedToken;
  } catch (error) {
    console.error('[ACLED] OAuth token fetch failed:', error);
    return null;
  }
}

export default withCors(async (_req: Request) => {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return new Response(
      JSON.stringify({
        events: [],
        count: 0,
        source: 'acled',
        error: 'Authentication failed - check ACLED_EMAIL and ACLED_PASSWORD',
        timestamp: Date.now(),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const events = await withCache<AcledEvent[]>('acled:events', 3600, async () => {
    // Get recent events (last 30 days, limit 500)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const startDate = thirtyDaysAgo.toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];

    const url =
      `https://acleddata.com/api/acled/read` +
      `?limit=500` +
      `&event_date=${startDate}|${today}` +
      `&event_date_where=BETWEEN` +
      `&fields=event_id_cnty,event_date,event_type,country,latitude,longitude,fatalities,notes`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`ACLED data fetch error: ${res.status} - ${errorText}`);
    }

    const data: { data?: AcledRawEvent[] } = await res.json();
    return (data.data || []).map(normalizeEvent);
  });

  return new Response(
    JSON.stringify({ events, count: events.length, source: 'acled', timestamp: Date.now() }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
      },
    }
  );
});
