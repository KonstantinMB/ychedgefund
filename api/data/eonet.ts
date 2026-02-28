/**
 * NASA EONET Natural Events Edge Function
 *
 * Fetches open natural events from NASA's Earth Observatory Natural Event Tracker.
 * No API key required. 1-hour cache.
 */

import { withCors } from '../_cors';
import { withCache } from '../_cache';

export const config = { runtime: 'edge' };

interface EonetGeometry {
  date: string;
  type: string;
  coordinates: number | number[] | number[][];
}

interface EonetRawEvent {
  id: string;
  title: string;
  categories: Array<{ id: string; title: string }>;
  geometries: EonetGeometry[];
  sources?: Array<{ id: string; url: string }>;
}

interface NasaEvent {
  id: string;
  title: string;
  category: string;
  lat: number;
  lon: number;
  date: number;
  source: string;
}

const EONET_URL = 'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=50';

function extractCoordinates(geometry: EonetGeometry): { lat: number; lon: number } | null {
  if (!geometry?.coordinates) return null;

  const coords = geometry.coordinates;

  // Point: [lon, lat]
  if (Array.isArray(coords) && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
    return { lon: coords[0] as number, lat: coords[1] as number };
  }

  // LineString: [[lon, lat], ...]
  if (Array.isArray(coords) && Array.isArray(coords[0])) {
    const first = coords[0] as number[];
    if (typeof first[0] === 'number' && typeof first[1] === 'number') {
      return { lon: first[0], lat: first[1] };
    }
  }

  return null;
}

function normalize(raw: { events?: EonetRawEvent[] }): NasaEvent[] {
  if (!Array.isArray(raw.events)) return [];

  const result: NasaEvent[] = [];

  for (const ev of raw.events) {
    if (!ev.geometries?.length) continue;

    // Use the most recent geometry
    const geometry = ev.geometries[ev.geometries.length - 1] as EonetGeometry | undefined;
    if (!geometry) continue;
    const coords = extractCoordinates(geometry);
    if (!coords) continue;

    const date = Date.parse(geometry.date) || Date.now();
    const category = ev.categories?.[0]?.title || 'Natural Event';
    const source = ev.sources?.[0]?.url || 'https://eonet.gsfc.nasa.gov';

    result.push({
      id: ev.id,
      title: ev.title || '',
      category,
      lat: coords.lat,
      lon: coords.lon,
      date,
      source,
    });
  }

  return result.sort((a, b) => b.date - a.date);
}

export default withCors(async (_req: Request) => {
  const events = await withCache<NasaEvent[]>('eonet:events', 3600, async () => {
    const res = await fetch(EONET_URL, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`EONET upstream error: ${res.status}`);
    const raw = await res.json();
    return normalize(raw);
  });

  return new Response(JSON.stringify({ events, count: events.length, timestamp: Date.now() }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
    },
  });
});
