/**
 * Fire Detection Layer
 * NASA FIRMS satellite fire detection (MODIS/VIIRS)
 */

import { ScatterplotLayer } from '@deck.gl/layers';
import { registerLayerDef } from '../layer-registry';
import type { LayerMetadata } from '../layer-registry';

const metadata: LayerMetadata = {
  id: 'fires',
  name: 'Fire Detection',
  description: 'NASA FIRMS satellite fire detection (MODIS/VIIRS)',
  category: 'environmental',
  color: '#ef4444',
  defaultActive: false,
  order: 41,
};

interface FirePoint {
  lat: number;
  lon: number;
  brightness: number;
  confidence: number;
  frp: number;
  date: string;
}

let fireData: FirePoint[] = [];

function getFireColor(frp: number): [number, number, number, number] {
  if (frp >= 1000) return [239, 68, 68, 240];   // extreme
  if (frp >= 500) return [249, 115, 22, 220];    // intense
  if (frp >= 100) return [250, 204, 21, 200];    // moderate
  return [251, 146, 60, 180];                     // low intensity
}

function createFiresLayer() {
  return new ScatterplotLayer({
    id: 'fires',
    data: fireData,
    pickable: true,
    opacity: 0.9,
    stroked: false,
    filled: true,
    radiusScale: 5000,
    radiusMinPixels: 2,
    radiusMaxPixels: 15,
    getPosition: (d: FirePoint) => [d.lon, d.lat, 0],
    getRadius: (d: FirePoint) => Math.max(1, Math.log10(d.frp + 1) * 2),
    getFillColor: (d: FirePoint) => getFireColor(d.frp),
  });
}

async function fetchAndUpdate(): Promise<void> {
  try {
    const res = await fetch('/api/data/firms');
    if (!res.ok) return;
    const json = await res.json();
    const fires = json.fires ?? [];
    // Client-side filter: only show confidence >= 70
    fireData = fires
      .filter((f: any) => (f.confidence ?? 100) >= 70)
      .map((f: any) => ({
        lat: f.lat,
        lon: f.lon,
        brightness: f.brightness ?? 0,
        confidence: f.confidence ?? 100,
        frp: f.frp ?? 0,
        date: f.date ?? '',
      }));

    const { getGlobe } = await import('../globe');
    const globe = getGlobe();
    globe.registerLayer('fires', createFiresLayer());
  } catch {
    // Keep existing data on error
  }
}

registerLayerDef(metadata, createFiresLayer);

// Deferred initial fetch
setTimeout(() => { void fetchAndUpdate(); }, 5_000);
setInterval(() => { void fetchAndUpdate(); }, 10 * 60 * 1_000);

export { createFiresLayer };
