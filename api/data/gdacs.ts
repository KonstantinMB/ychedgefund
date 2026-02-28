/**
 * GDACS Disaster Alerts Edge Function
 *
 * Fetches active disaster alerts from the GDACS RSS feed. No API key required.
 * Manual XML parsing (no DOM parser in Edge runtime). 30-minute cache.
 */

import { withCors } from '../_cors';
import { withCache } from '../_cache';

export const config = { runtime: 'edge' };

interface DisasterAlert {
  id: string;
  title: string;
  type: string;
  severity: 'green' | 'orange' | 'red';
  lat: number;
  lon: number;
  date: number;
  url: string;
}

const GDACS_URL = 'https://www.gdacs.org/xml/rss.xml';

function extractTagValue(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = xml.match(re);
  const raw = m?.[1] ?? '';
  return raw.trim().replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
}

function extractAttrValue(xml: string, tag: string, attr: string): string {
  const re = new RegExp(`<${tag}[^>]+${attr}="([^"]*)"`, 'i');
  const m = xml.match(re);
  return m?.[1] ?? '';
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

function parseSeverity(xml: string): 'green' | 'orange' | 'red' {
  const alertLevel = extractTagValue(xml, 'gdacs:alertlevel').toLowerCase();
  if (alertLevel === 'red') return 'red';
  if (alertLevel === 'orange') return 'orange';
  return 'green';
}

function parseEventType(xml: string, title: string): string {
  const eventType = extractTagValue(xml, 'gdacs:eventtype').toLowerCase();
  if (eventType) return eventType;

  const lower = title.toLowerCase();
  if (lower.includes('earthquake')) return 'earthquake';
  if (lower.includes('flood')) return 'flood';
  if (lower.includes('cyclone') || lower.includes('hurricane') || lower.includes('typhoon'))
    return 'cyclone';
  if (lower.includes('volcano')) return 'volcano';
  if (lower.includes('drought')) return 'drought';
  if (lower.includes('fire')) return 'wildfire';
  return 'disaster';
}

function parseItems(xml: string): DisasterAlert[] {
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  const alerts: DisasterAlert[] = [];
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1] ?? '';

    const title = extractTagValue(item, 'title');
    const link = extractTagValue(item, 'link');
    const pubDateStr = extractTagValue(item, 'pubDate');

    // Try georss:point first, then geo:lat/lon
    const geoPoint = extractTagValue(item, 'georss:point');
    let lat = 0;
    let lon = 0;

    if (geoPoint) {
      const parts = geoPoint.split(' ');
      lat = parseFloat(parts[0] ?? '0') || 0;
      lon = parseFloat(parts[1] ?? '0') || 0;
    } else {
      const latStr = extractTagValue(item, 'geo:lat') || extractAttrValue(item, 'gdacs:bbox', 'lat');
      const lonStr = extractTagValue(item, 'geo:long') || extractAttrValue(item, 'gdacs:bbox', 'lon');
      lat = parseFloat(latStr) || 0;
      lon = parseFloat(lonStr) || 0;
    }

    const date = pubDateStr ? Date.parse(pubDateStr) : Date.now();

    alerts.push({
      id: simpleHash(link || title),
      title,
      type: parseEventType(item, title),
      severity: parseSeverity(item),
      lat,
      lon,
      date: isNaN(date) ? Date.now() : date,
      url: link,
    });
  }

  return alerts;
}

export default withCors(async (_req: Request) => {
  const alerts = await withCache<DisasterAlert[]>('gdacs:alerts', 1800, async () => {
    const res = await fetch(GDACS_URL, {
      headers: { Accept: 'application/xml, text/xml, */*' },
    });
    if (!res.ok) throw new Error(`GDACS upstream error: ${res.status}`);
    const xml = await res.text();
    return parseItems(xml);
  });

  return new Response(JSON.stringify({ alerts, count: alerts.length, timestamp: Date.now() }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600',
    },
  });
});
