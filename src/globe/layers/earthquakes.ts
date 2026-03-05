/**
 * Earthquakes Layer
 * Live USGS earthquake events (M4.5+) on the globe
 */

import { ScatterplotLayer } from '@deck.gl/layers';
import { registerLayerDef } from '../layer-registry';
import type { LayerMetadata } from '../layer-registry';

const metadata: LayerMetadata = {
  id: 'earthquakes',
  name: 'Earthquakes',
  description: 'Live USGS earthquake events (M4.5+)',
  category: 'environmental',
  color: '#f97316',
  defaultActive: true,
  order: 40,
};

interface EarthquakePoint {
  lat: number;
  lon: number;
  magnitude: number;
  place: string;
  depth: number;
  time: number;
}

let earthquakeData: EarthquakePoint[] = [];

function getEarthquakeColor(magnitude: number): [number, number, number, number] {
  if (magnitude >= 7) return [239, 68, 68, 220];
  if (magnitude >= 6) return [249, 115, 22, 200];
  if (magnitude >= 5) return [250, 204, 21, 180];
  return [156, 163, 175, 150];
}

function createEarthquakesLayer() {
  return new ScatterplotLayer({
    id: 'earthquakes',
    data: earthquakeData,
    pickable: true,
    opacity: 0.8,
    stroked: true,
    filled: true,
    radiusScale: 10000,
    radiusMinPixels: 3,
    radiusMaxPixels: 30,
    getPosition: (d: EarthquakePoint) => [d.lon, d.lat, 0],
    getRadius: (d: EarthquakePoint) => Math.pow(2, d.magnitude),
    getFillColor: (d: EarthquakePoint) => getEarthquakeColor(d.magnitude),
    getLineColor: [255, 255, 255, 100],
    lineWidthMinPixels: 1,
  });
}

async function fetchAndUpdate(): Promise<void> {
  try {
    const res = await fetch('/api/data/usgs');
    if (!res.ok) return;
    const json = await res.json();
    const events = json.earthquakes ?? json.events ?? [];
    earthquakeData = events.map((e: any) => ({
      lat: e.lat,
      lon: e.lon,
      magnitude: e.magnitude,
      place: e.place ?? '',
      depth: e.depth ?? 0,
      time: e.time ?? Date.now(),
    }));

    const { getGlobe } = await import('../globe');
    const globe = getGlobe();
    globe.registerLayer('earthquakes', createEarthquakesLayer());
  } catch {
    // Keep existing data on error
  }
}

registerLayerDef(metadata, createEarthquakesLayer);

// Deferred initial fetch to avoid blocking app init
setTimeout(() => { void fetchAndUpdate(); }, 3_000);
setInterval(() => { void fetchAndUpdate(); }, 5 * 60 * 1_000);

export { createEarthquakesLayer };
