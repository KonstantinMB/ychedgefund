/**
 * OpenSanctions Statistics Edge Function
 *
 * Fetches sanctions database metadata/statistics from OpenSanctions.
 * No API key required. 24-hour cache.
 */

import { withCors } from '../_cors';
import { withCache } from '../_cache';

export const config = { runtime: 'edge' };

interface OpenSanctionsStats {
  entity_count?: number;
  thing_count?: number;
  country_count?: number;
  updated_at?: string;
  last_export?: string;
  datasets?: string[];
  sources?: Record<string, { title: string; entity_count?: number }>;
}

interface SanctionsSummary {
  totalEntities: number;
  countries: number;
  lastUpdated: string;
  datasets: string[];
  source: 'opensanctions';
}

const STATS_URL = 'https://data.opensanctions.org/datasets/latest/sanctions/statistics.json';

export default withCors(async (_req: Request) => {
  const summary = await withCache<SanctionsSummary>('osint:sanctions:stats', 86400, async () => {
    const res = await fetch(STATS_URL);
    if (!res.ok) throw new Error(`OpenSanctions upstream error: ${res.status}`);

    const data: OpenSanctionsStats = await res.json();

    const datasets = data.sources
      ? Object.values(data.sources)
          .map(s => s.title)
          .filter(Boolean)
      : (data.datasets ?? []);

    return {
      totalEntities: data.entity_count ?? data.thing_count ?? 0,
      countries: data.country_count ?? 0,
      lastUpdated: data.updated_at ?? data.last_export ?? new Date().toISOString(),
      datasets: datasets.slice(0, 50),
      source: 'opensanctions' as const,
    };
  });

  return new Response(JSON.stringify({ ...summary, timestamp: Date.now() }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=172800',
    },
  });
});
