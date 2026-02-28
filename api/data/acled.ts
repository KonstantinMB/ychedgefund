/**
 * ACLED Conflict Events Edge Function
 *
 * Fetches conflict events from the Armed Conflict Location & Event Data Project.
 * Requires free API key + email. 1-hour cache.
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

interface AcledResponse {
  data: AcledRawEvent[];
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

export default withCors(async (_req: Request) => {
  const apiKey = process.env.ACLED_API_KEY;
  const email = process.env.ACLED_EMAIL;

  if (!apiKey || !email) {
    return new Response(
      JSON.stringify({
        events: [],
        count: 0,
        source: 'acled',
        error: 'API key not configured',
        timestamp: Date.now(),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const events = await withCache<AcledEvent[]>('acled:events', 3600, async () => {
    const url =
      `https://api.acleddata.com/acled/read` +
      `?key=${apiKey}&email=${encodeURIComponent(email)}` +
      `&limit=100` +
      `&fields=event_id_cnty,event_date,event_type,country,latitude,longitude,fatalities,notes` +
      `&format=json`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`ACLED upstream error: ${res.status}`);

    const data: AcledResponse = await res.json();
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
