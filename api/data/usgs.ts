/**
 * USGS Earthquake Events Edge Function
 *
 * Fetches M4.5+ earthquakes from the past 24 hours plus any significant
 * earthquakes from the past hour. No API key required. 5-minute cache.
 */

import { withCors } from '../_cors';
import { withCache } from '../_cache';

export const config = { runtime: 'edge' };

interface GeoJsonFeature {
  id: string;
  properties: {
    mag: number;
    place: string;
    time: number;
    tsunami: number;
    sig: number;
  };
  geometry: {
    coordinates: [number, number, number]; // [lon, lat, depth]
  };
}

interface GeoJsonFeed {
  features: GeoJsonFeature[];
}

interface EarthquakeEvent {
  id: string;
  magnitude: number;
  place: string;
  time: number;
  lon: number;
  lat: number;
  depth: number;
  tsunami: boolean;
  significance: number;
}

const SIGNIFICANT_URL =
  'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_hour.geojson';
const M45_DAY_URL =
  'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson';

function normalizeFeature(f: GeoJsonFeature): EarthquakeEvent {
  const [lon, lat, depth] = f.geometry.coordinates;
  return {
    id: f.id,
    magnitude: f.properties.mag ?? 0,
    place: f.properties.place ?? '',
    time: f.properties.time ?? Date.now(),
    lon,
    lat,
    depth: depth ?? 0,
    tsunami: f.properties.tsunami === 1,
    significance: f.properties.sig ?? 0,
  };
}

function mergeUnique(a: EarthquakeEvent[], b: EarthquakeEvent[]): EarthquakeEvent[] {
  const seen = new Set<string>();
  const result: EarthquakeEvent[] = [];
  for (const ev of [...a, ...b]) {
    if (!seen.has(ev.id)) {
      seen.add(ev.id);
      result.push(ev);
    }
  }
  return result.sort((x, y) => y.time - x.time);
}

export default withCors(async (_req: Request) => {
  const events = await withCache<EarthquakeEvent[]>('usgs:earthquakes', 300, async () => {
    const [sigRes, m45Res] = await Promise.all([fetch(SIGNIFICANT_URL), fetch(M45_DAY_URL)]);

    const sigFeed: GeoJsonFeed = sigRes.ok ? await sigRes.json() : { features: [] };
    const m45Feed: GeoJsonFeed = m45Res.ok ? await m45Res.json() : { features: [] };

    const sigEvents = (sigFeed.features || []).map(normalizeFeature);
    const m45Events = (m45Feed.features || []).map(normalizeFeature);

    return mergeUnique(sigEvents, m45Events);
  });

  return new Response(JSON.stringify({ events, count: events.length, timestamp: Date.now() }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
});
