/**
 * NASA FIRMS Fire Detection Edge Function
 *
 * Fetches active fire detections from NASA FIRMS MODIS Near Real-Time data.
 * Requires free NASA FIRMS API key. 10-minute cache.
 * Parses CSV response manually (no npm modules in edge runtime).
 */

import { withCors } from '../_cors';
import { withCache } from '../_cache';

export const config = { runtime: 'edge' };

interface FireDetection {
  lat: number;
  lon: number;
  brightness: number;
  confidence: number;
  frp: number;
  date: string;
  daynight: 'D' | 'N';
}

function parseCsv(csv: string): FireDetection[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];

  // Header: latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,confidence,version,bright_t31,frp,daynight
  const header = (lines[0] as string).split(',').map(h => h.trim());
  const idxLat = header.indexOf('latitude');
  const idxLon = header.indexOf('longitude');
  const idxBrightness = header.indexOf('brightness');
  const idxConfidence = header.indexOf('confidence');
  const idxFrp = header.indexOf('frp');
  const idxDate = header.indexOf('acq_date');
  const idxDaynight = header.indexOf('daynight');

  const results: FireDetection[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = (lines[i] as string).split(',');
    if (cols.length < header.length) continue;

    const confidence = parseInt((cols[idxConfidence] ?? '').trim() || '0', 10);
    if (confidence < 50) continue;

    const lat = parseFloat((cols[idxLat] ?? '').trim() || '0');
    const lon = parseFloat((cols[idxLon] ?? '').trim() || '0');
    if (isNaN(lat) || isNaN(lon)) continue;

    const dn = (cols[idxDaynight] ?? '').trim();

    results.push({
      lat,
      lon,
      brightness: parseFloat((cols[idxBrightness] ?? '').trim() || '0'),
      confidence,
      frp: parseFloat((cols[idxFrp] ?? '').trim() || '0'),
      date: (cols[idxDate] ?? '').trim(),
      daynight: dn === 'N' ? 'N' : 'D',
    });
  }

  return results;
}

export default withCors(async (_req: Request) => {
  const apiKey = process.env.NASA_FIRMS_KEY;

  if (!apiKey) {
    return new Response(
      JSON.stringify({
        fires: [],
        count: 0,
        source: 'firms',
        error: 'API key not configured',
        timestamp: Date.now(),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const fires = await withCache<FireDetection[]>('firms:fires:world', 600, async () => {
    const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${apiKey}/MODIS_NRT/world/1`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`NASA FIRMS upstream error: ${res.status}`);

    const csv = await res.text();
    return parseCsv(csv);
  });

  return new Response(
    JSON.stringify({ fires, count: fires.length, source: 'firms', timestamp: Date.now() }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200',
      },
    }
  );
});
