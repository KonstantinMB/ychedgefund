/**
 * FRED Economic Indicators Edge Function
 *
 * Fetches key macro indicators from Federal Reserve Economic Data.
 * Requires free FRED API key. 6-hour cache.
 */

import { withCors } from '../_cors';
import { withCache } from '../_cache';

export const config = { runtime: 'edge' };

interface FredObservation {
  date: string;
  value: string;
}

interface FredApiResponse {
  observations: FredObservation[];
}

interface FredIndicator {
  id: string;
  name: string;
  value: number;
  date: string;
  unit: string;
}

const SERIES: Array<{ id: string; name: string; unit: string }> = [
  { id: 'T10Y2Y', name: '10Y-2Y Yield Spread', unit: 'percent' },
  { id: 'UNRATE', name: 'Unemployment Rate', unit: 'percent' },
  { id: 'CPIAUCSL', name: 'CPI (Urban Consumers)', unit: 'index' },
  { id: 'FEDFUNDS', name: 'Federal Funds Rate', unit: 'percent' },
  { id: 'DTWEXBGS', name: 'US Dollar Index (Broad)', unit: 'index' },
];

const PLACEHOLDER_VALUES: Record<string, number> = {
  T10Y2Y: 0.0,
  UNRATE: 4.1,
  CPIAUCSL: 314.0,
  FEDFUNDS: 5.33,
  DTWEXBGS: 120.0,
};

async function fetchSeries(id: string, apiKey: string): Promise<FredObservation | null> {
  const url =
    `https://api.stlouisfed.org/fred/series/observations` +
    `?series_id=${id}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=1`;

  const res = await fetch(url);
  if (!res.ok) return null;

  const data: FredApiResponse = await res.json();
  const obs = data.observations?.[0];
  if (!obs || obs.value === '.') return null;
  return obs;
}

export default withCors(async (_req: Request) => {
  const apiKey = process.env.FRED_API_KEY;

  if (!apiKey) {
    const today = new Date().toISOString().split('T')[0] ?? '';
    const indicators: FredIndicator[] = SERIES.map(s => ({
      id: s.id,
      name: s.name,
      value: PLACEHOLDER_VALUES[s.id] ?? 0,
      date: today,
      unit: s.unit,
    }));

    return new Response(
      JSON.stringify({
        indicators,
        source: 'fred',
        error: 'API key not configured',
        timestamp: Date.now(),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const indicators = await withCache<FredIndicator[]>('market:fred:indicators', 21600, async () => {
    const results = await Promise.allSettled(
      SERIES.map(s => fetchSeries(s.id, apiKey))
    );

    const fallbackDate = new Date().toISOString().split('T')[0] ?? '';
    return SERIES.map((s, i) => {
      const result = results[i];
      const obs =
        result !== undefined && result.status === 'fulfilled' ? result.value : null;
      return {
        id: s.id,
        name: s.name,
        value: obs ? parseFloat(obs.value) : (PLACEHOLDER_VALUES[s.id] ?? 0),
        date: obs?.date ?? fallbackDate,
        unit: s.unit,
      };
    });
  });

  return new Response(
    JSON.stringify({ indicators, source: 'fred', timestamp: Date.now() }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=43200',
      },
    }
  );
});
