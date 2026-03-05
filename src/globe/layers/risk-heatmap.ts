/**
 * Portfolio Risk Heatmap Layer
 *
 * Overlays geopolitical portfolio exposure on the globe as glowing country discs.
 *
 * Data flow:
 *   'trading:portfolio' → PortfolioSnapshot
 *     → exposure per country (via geo-asset-mapping.json)
 *       → ScatterplotLayer (base fill) + ScatterplotLayer (animated pulse ring)
 *
 * Exposure formula per country:
 *   exposure = Σ |position_marketValue / totalNav| × confidenceBase
 *   for every position whose symbol appears in the country's long[] or short[]
 *
 * Colour scale:
 *   > 6%   NAV exposure → RED    (critical)
 *   3-6%                → ORANGE (high)
 *   1-3%                → YELLOW (moderate)
 *   0.2-1%              → TEAL   (low)
 *
 * Click → EntityInfo popup listing positions + CII + suggested hedges
 * Pulse rings animate on countries with exposure > 1% (setInterval, 80 ms tick)
 */

import { ScatterplotLayer } from '@deck.gl/layers';
import { registerLayerDef } from '../layer-registry';
import type { LayerMetadata } from '../layer-registry';
import GEO_ASSET_MAP from '../../data/geo-asset-mapping.json';
import type { PortfolioSnapshot, ManagedPosition } from '../../trading/engine/portfolio-manager';
import { showEntityPopup } from '../entity-popup';
import type { PickingInfo } from '@deck.gl/core';

// ── Country centroids (ISO-A2 → lat/lon/name) ─────────────────────────────────
// Covers every country key in geo-asset-mapping.json plus major unlisted ones.

const COUNTRY_CENTROIDS: Record<string, { lat: number; lon: number; name: string }> = {
  AF: { lat: 33.9,  lon: 67.7,   name: 'Afghanistan' },
  AE: { lat: 23.4,  lon: 53.8,   name: 'United Arab Emirates' },
  AM: { lat: 40.1,  lon: 45.0,   name: 'Armenia' },
  AR: { lat: -34.6, lon: -58.4,  name: 'Argentina' },
  AU: { lat: -25.3, lon: 133.8,  name: 'Australia' },
  AZ: { lat: 40.1,  lon: 47.6,   name: 'Azerbaijan' },
  BD: { lat: 23.7,  lon: 90.4,   name: 'Bangladesh' },
  BF: { lat: 12.4,  lon: -1.6,   name: 'Burkina Faso' },
  BH: { lat: 26.0,  lon: 50.6,   name: 'Bahrain' },
  BO: { lat: -16.5, lon: -68.1,  name: 'Bolivia' },
  BR: { lat: -14.2, lon: -51.9,  name: 'Brazil' },
  BT: { lat: 27.5,  lon: 90.4,   name: 'Bhutan' },
  BY: { lat: 53.7,  lon: 27.9,   name: 'Belarus' },
  BZ: { lat: 17.2,  lon: -88.5,  name: 'Belize' },
  CD: { lat: -4.0,  lon: 21.8,   name: 'DR Congo' },
  CF: { lat: 6.6,   lon: 20.9,   name: 'CAR' },
  CL: { lat: -35.7, lon: -71.5,  name: 'Chile' },
  CM: { lat: 7.4,   lon: 12.4,   name: 'Cameroon' },
  CN: { lat: 35.9,  lon: 104.2,  name: 'China' },
  CO: { lat: 4.6,   lon: -74.1,  name: 'Colombia' },
  CR: { lat: 9.7,   lon: -83.8,  name: 'Costa Rica' },
  CU: { lat: 21.5,  lon: -77.8,  name: 'Cuba' },
  CY: { lat: 35.1,  lon: 33.4,   name: 'Cyprus' },
  DZ: { lat: 28.0,  lon: 1.7,    name: 'Algeria' },
  EC: { lat: -1.8,  lon: -78.2,  name: 'Ecuador' },
  EG: { lat: 26.8,  lon: 30.8,   name: 'Egypt' },
  ET: { lat: 9.1,   lon: 40.5,   name: 'Ethiopia' },
  FJ: { lat: -17.7, lon: 178.1,  name: 'Fiji' },
  GE: { lat: 42.3,  lon: 43.4,   name: 'Georgia' },
  GF: { lat: 3.9,   lon: -53.1,  name: 'French Guiana' },
  GR: { lat: 39.1,  lon: 21.8,   name: 'Greece' },
  GT: { lat: 15.8,  lon: -90.2,  name: 'Guatemala' },
  GY: { lat: 4.9,   lon: -58.9,  name: 'Guyana' },
  HN: { lat: 15.2,  lon: -86.2,  name: 'Honduras' },
  HT: { lat: 18.9,  lon: -72.3,  name: 'Haiti' },
  ID: { lat: -0.8,  lon: 113.9,  name: 'Indonesia' },
  IL: { lat: 31.0,  lon: 34.9,   name: 'Israel' },
  IN: { lat: 20.6,  lon: 78.9,   name: 'India' },
  IND: { lat: -1.0, lon: 104.5,  name: 'Malacca Strait' },
  IQ: { lat: 33.2,  lon: 43.7,   name: 'Iraq' },
  IR: { lat: 32.4,  lon: 53.7,   name: 'Iran' },
  JM: { lat: 18.1,  lon: -77.3,  name: 'Jamaica' },
  JO: { lat: 30.6,  lon: 36.2,   name: 'Jordan' },
  JP: { lat: 36.2,  lon: 138.3,  name: 'Japan' },
  KG: { lat: 41.2,  lon: 74.8,   name: 'Kyrgyzstan' },
  KH: { lat: 12.6,  lon: 104.9,  name: 'Cambodia' },
  KP: { lat: 40.3,  lon: 127.5,  name: 'North Korea' },
  KR: { lat: 35.9,  lon: 127.8,  name: 'South Korea' },
  KW: { lat: 29.3,  lon: 47.5,   name: 'Kuwait' },
  KZ: { lat: 48.0,  lon: 66.9,   name: 'Kazakhstan' },
  LA: { lat: 19.9,  lon: 102.5,  name: 'Laos' },
  LB: { lat: 33.9,  lon: 35.5,   name: 'Lebanon' },
  LK: { lat: 7.9,   lon: 80.8,   name: 'Sri Lanka' },
  LY: { lat: 26.3,  lon: 17.2,   name: 'Libya' },
  MA: { lat: 31.8,  lon: -7.1,   name: 'Morocco' },
  MD: { lat: 47.4,  lon: 28.4,   name: 'Moldova' },
  ML: { lat: 17.6,  lon: -4.0,   name: 'Mali' },
  MM: { lat: 21.9,  lon: 95.9,   name: 'Myanmar' },
  MN: { lat: 46.9,  lon: 103.8,  name: 'Mongolia' },
  MX: { lat: 23.6,  lon: -102.6, name: 'Mexico' },
  MY: { lat: 4.2,   lon: 108.0,  name: 'Malaysia' },
  MZ: { lat: -18.7, lon: 35.5,   name: 'Mozambique' },
  NE: { lat: 17.6,  lon: 8.1,    name: 'Niger' },
  NG: { lat: 9.1,   lon: 8.7,    name: 'Nigeria' },
  NI: { lat: 12.9,  lon: -85.2,  name: 'Nicaragua' },
  NP: { lat: 28.4,  lon: 84.1,   name: 'Nepal' },
  NZ: { lat: -40.9, lon: 174.9,  name: 'New Zealand' },
  OM: { lat: 21.5,  lon: 55.9,   name: 'Oman' },
  PA: { lat: 8.5,   lon: -80.8,  name: 'Panama' },
  PE: { lat: -9.2,  lon: -75.0,  name: 'Peru' },
  PG: { lat: -6.3,  lon: 143.9,  name: 'Papua New Guinea' },
  PH: { lat: 12.9,  lon: 121.8,  name: 'Philippines' },
  PK: { lat: 30.4,  lon: 69.3,   name: 'Pakistan' },
  PS: { lat: 31.9,  lon: 35.2,   name: 'Palestine' },
  PY: { lat: -23.4, lon: -58.4,  name: 'Paraguay' },
  QA: { lat: 25.4,  lon: 51.2,   name: 'Qatar' },
  RU: { lat: 61.5,  lon: 105.3,  name: 'Russia' },
  SA: { lat: 23.9,  lon: 45.1,   name: 'Saudi Arabia' },
  SB: { lat: -9.6,  lon: 160.2,  name: 'Solomon Islands' },
  SD: { lat: 12.9,  lon: 30.2,   name: 'Sudan' },
  SG: { lat: 1.3,   lon: 103.8,  name: 'Singapore' },
  SO: { lat: 5.2,   lon: 46.2,   name: 'Somalia' },
  SR: { lat: 3.9,   lon: -56.0,  name: 'Suriname' },
  SV: { lat: 13.8,  lon: -88.9,  name: 'El Salvador' },
  SY: { lat: 34.8,  lon: 38.9,   name: 'Syria' },
  TD: { lat: 15.5,  lon: 18.7,   name: 'Chad' },
  TH: { lat: 15.9,  lon: 100.9,  name: 'Thailand' },
  TJ: { lat: 38.9,  lon: 71.3,   name: 'Tajikistan' },
  TM: { lat: 38.1,  lon: 57.3,   name: 'Turkmenistan' },
  TN: { lat: 33.9,  lon: 9.5,    name: 'Tunisia' },
  TR: { lat: 38.9,  lon: 35.2,   name: 'Turkey' },
  TT: { lat: 10.7,  lon: -61.5,  name: 'Trinidad & Tobago' },
  TW: { lat: 23.7,  lon: 121.0,  name: 'Taiwan' },
  UA: { lat: 48.4,  lon: 31.2,   name: 'Ukraine' },
  UY: { lat: -32.5, lon: -55.8,  name: 'Uruguay' },
  UZ: { lat: 41.4,  lon: 64.6,   name: 'Uzbekistan' },
  VE: { lat: 6.4,   lon: -66.6,  name: 'Venezuela' },
  VN: { lat: 14.1,  lon: 108.3,  name: 'Vietnam' },
  YE: { lat: 15.6,  lon: 48.5,   name: 'Yemen' },
  ZA: { lat: -30.6, lon: 22.9,   name: 'South Africa' },
  ZW: { lat: -19.0, lon: 29.2,   name: 'Zimbabwe' },
  BF2: { lat: 12.4, lon: -1.6,   name: 'Burkina Faso' }, // alias
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface GeoAssetEntry {
  long: string[];
  short: string[];
  confidence_base: number;
  rationale: string;
}

const GEO_MAP = GEO_ASSET_MAP as Record<string, GeoAssetEntry>;

interface CountryExposure {
  iso2: string;
  name: string;
  lat: number;
  lon: number;
  exposurePct: number;           // 0-1 fraction of NAV
  longExposure: number;          // fraction of NAV via long positions
  shortExposure: number;         // fraction of NAV via short positions
  affectedPositions: Array<{
    symbol: string;
    side: 'LONG' | 'SHORT';
    marketValue: number;
    pct: number;
  }>;
  confidenceBase: number;
  rationale: string;
  ciiScore?: number;             // injected from CII engine if available
}

// ── Module-level state ────────────────────────────────────────────────────────

let currentExposures: CountryExposure[] = [];
let pulsePhase  = 0;             // 0–1, oscillates over time
let lastSnapshot: PortfolioSnapshot | null = null;

/** flash iso2 → timestamp when flash expires */
const flashCountries = new Map<string, number>();

/** Flash a country disc on the globe for `duration` ms */
export function flashCountry(iso2: string, duration = 3000): void {
  flashCountries.set(iso2.toUpperCase(), Date.now() + duration);
}

// Listen for external flash requests (from signal/trade events in main.ts)
window.addEventListener('globe:signal-flash', (e: Event) => {
  const { iso2, duration } = (e as CustomEvent<{ iso2: string; duration?: number }>).detail;
  if (iso2) flashCountry(iso2, duration ?? 4000);
});

// ── Exposure computation ──────────────────────────────────────────────────────

function computeExposures(snapshot: PortfolioSnapshot): CountryExposure[] {
  const nav      = snapshot.totalValue;
  if (nav <= 0) return [];

  const positions = snapshot.positions;
  const result    = new Map<string, CountryExposure>();

  for (const [iso2, entry] of Object.entries(GEO_MAP)) {
    const centroid = COUNTRY_CENTROIDS[iso2];
    if (!centroid) continue;

    let longExp  = 0;
    let shortExp = 0;

    const affected: CountryExposure['affectedPositions'] = [];

    for (const pos of positions) {
      const sym  = pos.symbol;
      const pct  = Math.abs(pos.marketValue) / nav;
      const isLong = pos.direction === 'LONG';

      if (isLong && entry.long.includes(sym)) {
        longExp += pct;
        affected.push({ symbol: sym, side: 'LONG', marketValue: pos.marketValue, pct });
      } else if (!isLong && entry.short.includes(sym)) {
        // SHORT position in a symbol the country SHORTS → risk of reversal
        shortExp += pct;
        affected.push({ symbol: sym, side: 'SHORT', marketValue: pos.marketValue, pct });
      } else if (isLong && entry.short.includes(sym)) {
        // Counter-directional: LONG a symbol that geopolitical risk would SHORT
        longExp += pct * 0.5;
        affected.push({ symbol: sym, side: 'LONG', marketValue: pos.marketValue, pct: pct * 0.5 });
      } else if (!isLong && entry.long.includes(sym)) {
        shortExp += pct * 0.5;
        affected.push({ symbol: sym, side: 'SHORT', marketValue: pos.marketValue, pct: pct * 0.5 });
      }
    }

    const totalExp = (longExp + shortExp) * entry.confidence_base;
    if (totalExp < 0.001) continue;                // below threshold — skip

    result.set(iso2, {
      iso2,
      name: centroid.name,
      lat: centroid.lat,
      lon: centroid.lon,
      exposurePct: totalExp,
      longExposure: longExp,
      shortExposure: shortExp,
      affectedPositions: affected.sort((a, b) => b.pct - a.pct),
      confidenceBase: entry.confidence_base,
      rationale: entry.rationale,
    });
  }

  return [...result.values()].sort((a, b) => b.exposurePct - a.exposurePct);
}

// ── Colour mapping ────────────────────────────────────────────────────────────

function exposureColor(exp: number, alpha = 200): [number, number, number, number] {
  if (exp > 0.06) return [239, 68,  68,  alpha];    // RED  — critical
  if (exp > 0.03) return [249, 115, 22,  alpha];    // ORANGE — high
  if (exp > 0.01) return [250, 204, 21,  alpha];    // YELLOW — moderate
  return [20,  184, 166, Math.round(alpha * 0.65)]; // TEAL — low
}

function exposureRadius(exp: number): number {
  // Radius in metres — visible on the globe at zoom 2-3
  if (exp > 0.06) return 650_000;
  if (exp > 0.03) return 500_000;
  if (exp > 0.01) return 380_000;
  return 260_000;
}

// ── Layer factories ───────────────────────────────────────────────────────────

function createBaseLayer(): ScatterplotLayer<CountryExposure> {
  return new ScatterplotLayer<CountryExposure>({
    id: 'risk-heatmap-base',
    data: currentExposures,
    pickable: true,
    stroked: true,
    filled: true,
    opacity: 0.9,
    radiusUnits: 'meters',
    radiusMinPixels: 6,
    radiusMaxPixels: 80,
    getPosition: d => [d.lon, d.lat, 0],
    getRadius: d => exposureRadius(d.exposurePct),
    getFillColor: d => {
      const expiry = flashCountries.get(d.iso2);
      if (expiry && expiry > Date.now()) return [255, 240, 50, 230]; // bright yellow flash
      return exposureColor(d.exposurePct, 160);
    },
    getLineColor: d => {
      const expiry = flashCountries.get(d.iso2);
      if (expiry && expiry > Date.now()) return [255, 255, 100, 255];
      return exposureColor(d.exposurePct, 220);
    },
    lineWidthMinPixels: 1.5,
    updateTriggers: {
      getFillColor: [currentExposures.length, flashCountries.size],
      getRadius: [currentExposures.length],
    },
  });
}

function createPulseLayer(): ScatterplotLayer<CountryExposure> {
  // Only pulse countries above 1% exposure
  const pulseData = currentExposures.filter(e => e.exposurePct > 0.01);
  const pulseFactor = 0.5 + 0.5 * Math.sin(pulsePhase * Math.PI * 2);
  const pulseAlpha  = Math.round(30 + 60 * pulseFactor);
  const pulseScale  = 1.35 + 0.30 * pulseFactor;

  return new ScatterplotLayer<CountryExposure>({
    id: 'risk-heatmap-pulse',
    data: pulseData,
    pickable: false,
    stroked: true,
    filled: false,
    opacity: 1,
    radiusUnits: 'meters',
    radiusMinPixels: 8,
    radiusMaxPixels: 110,
    getPosition: d => [d.lon, d.lat, 0],
    getRadius: d => exposureRadius(d.exposurePct) * pulseScale,
    getLineColor: d => exposureColor(d.exposurePct, pulseAlpha),
    lineWidthMinPixels: 2,
    updateTriggers: {
      getRadius:    [pulsePhase],
      getLineColor: [pulsePhase],
    },
  });
}

// ── Composite layer = base + pulse, registered under a single ID ──────────────

function createRiskHeatmapLayer(): ScatterplotLayer<CountryExposure> {
  // The registry only supports one layer per ID; we register the base layer
  // and push the pulse layer separately via registerLayer in the update loop.
  return createBaseLayer();
}

// ── Globe update helper ───────────────────────────────────────────────────────

async function pushToGlobe(): Promise<void> {
  try {
    const { getGlobe } = await import('../globe');
    const globe = getGlobe();
    globe.registerLayer('risk-heatmap-base',  createBaseLayer());
    globe.registerLayer('risk-heatmap-pulse', createPulseLayer());
  } catch {
    // Globe not yet initialized — no-op
  }
}

// ── Pulse animation (80 ms tick) ──────────────────────────────────────────────

setInterval(() => {
  if (currentExposures.length === 0) return;
  pulsePhase = (pulsePhase + 0.04) % 1;
  void pushToGlobe();
}, 80);

// ── Portfolio event subscription ──────────────────────────────────────────────

window.addEventListener('trading:portfolio', (e: Event) => {
  const snap = (e as CustomEvent<PortfolioSnapshot>).detail;
  if (!snap) return;
  lastSnapshot = snap;
  currentExposures = computeExposures(snap);
  void pushToGlobe();
});

// ── CII injection (optional) ──────────────────────────────────────────────────
// If the CII engine publishes country instability scores, overlay them

window.addEventListener('cii-updated', (e: Event) => {
  const detail = (e as CustomEvent<Record<string, number>>).detail;
  if (!detail) return;
  for (const exp of currentExposures) {
    const score = detail[exp.iso2] ?? detail[exp.name];
    if (score != null) exp.ciiScore = score;
  }
});

// ── Click handler: build EntityInfo popup ────────────────────────────────────

export function handleRiskHeatmapClick(info: PickingInfo): boolean {
  if (!info.object) return false;
  const d = info.object as CountryExposure;
  if (!d.iso2) return false;

  const snap  = lastSnapshot;
  const nav   = snap?.totalValue ?? 1_000_000;

  // Build fields
  const fields: Array<{ label: string; value: string }> = [
    { label: 'EXPOSURE',   value: `${(d.exposurePct * 100).toFixed(1)}% of NAV` },
    { label: 'CONFIDENCE', value: `${(d.confidenceBase * 100).toFixed(0)}%` },
  ];

  if (d.ciiScore != null) {
    fields.push({ label: 'CII SCORE', value: `${d.ciiScore.toFixed(2)}σ` });
  }

  fields.push(
    { label: 'LONG EXP',  value: `${(d.longExposure  * 100).toFixed(1)}%` },
    { label: 'SHORT EXP', value: `${(d.shortExposure * 100).toFixed(1)}%` },
  );

  for (const p of d.affectedPositions.slice(0, 4)) {
    const pnl = snap?.positions.find(pos => pos.symbol === p.symbol)?.unrealizedPnl ?? 0;
    const pnlStr = pnl >= 0 ? `+$${Math.round(pnl).toLocaleString()}` : `-$${Math.round(Math.abs(pnl)).toLocaleString()}`;
    fields.push({
      label: `${p.side} ${p.symbol}`,
      value: `${(p.pct * 100).toFixed(1)}% NAV  ${pnlStr}`,
    });
  }

  // Suggest hedges — inverse of what we hold
  const heldSymbols = new Set(d.affectedPositions.map(p => p.symbol));
  const entry = GEO_MAP[d.iso2];
  if (entry) {
    const hedges = [
      ...entry.long.filter(s => !heldSymbols.has(s)).slice(0, 2),
      ...entry.short.filter(s => !heldSymbols.has(s)).slice(0, 2),
    ].join(', ');
    if (hedges) fields.push({ label: 'HEDGES', value: hedges });
  }

  fields.push({ label: 'RATIONALE', value: d.rationale.slice(0, 80) + (d.rationale.length > 80 ? '…' : '') });

  const severity = d.exposurePct > 0.06 ? 'critical'
    : d.exposurePct > 0.03 ? 'high'
    : d.exposurePct > 0.01 ? 'medium' : 'low';

  showEntityPopup(
    {
      id:         d.iso2,
      name:       d.name,
      type:       'risk-exposure',
      subtitle:   `Portfolio Exposure · ${(d.exposurePct * 100).toFixed(1)}% NAV`,
      fields,
      coordinates: [d.lon, d.lat],
      severity,
      color:      severity === 'critical' ? '#ef4444' : severity === 'high' ? '#f97316' : '#facc15',
    },
    info.x ?? 0,
    info.y ?? 0,
  );

  return true;
}

// ── Layer registration ────────────────────────────────────────────────────────

const metadata: LayerMetadata = {
  id:           'risk-heatmap',
  name:         'Portfolio Risk Heatmap',
  description:  'Geopolitical portfolio exposure overlay — shows which countries affect your positions',
  category:     'economic',
  icon:         '🔴',
  color:        '#ef4444',
  defaultActive: true,
  order:        0, // Base layer — drawn first (behind others)
};

// Register in the controls panel (factory creates base layer for initial render)
registerLayerDef(metadata, createRiskHeatmapLayer);

// Export for globe.ts to invoke on click (wired in main.ts after init)
export { createRiskHeatmapLayer, computeExposures };
