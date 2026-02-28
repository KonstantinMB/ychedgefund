/**
 * Aircraft Layer
 * Live aircraft positions from OpenSky Network
 */

import { ScatterplotLayer } from '@deck.gl/layers';
import { registerLayerDef } from '../layer-registry';
import type { LayerMetadata } from '../layer-registry';

const metadata: LayerMetadata = {
  id: 'aircraft',
  name: 'Aircraft',
  description: 'Live aircraft positions from OpenSky Network',
  category: 'intelligence',
  color: '#93c5fd',
  defaultActive: false,
};

interface AircraftPoint {
  icao24: string;
  callsign: string;
  country: string;
  lat: number;
  lon: number;
  altitude: number;
  velocity: number;
  heading: number;
}

const MAX_AIRCRAFT = 500;

let aircraftData: AircraftPoint[] = [];

function createAircraftLayer() {
  return new ScatterplotLayer({
    id: 'aircraft',
    data: aircraftData,
    pickable: true,
    opacity: 0.8,
    stroked: false,
    filled: true,
    radiusMinPixels: 2,
    radiusMaxPixels: 5,
    radiusScale: 1000,
    getPosition: (d: AircraftPoint) => [d.lon, d.lat, d.altitude],
    getRadius: () => 1,
    getFillColor: [147, 197, 253, 180],
  });
}

async function fetchAndUpdate(): Promise<void> {
  try {
    const res = await fetch('/api/osint/opensky');
    if (!res.ok) return;
    const json = await res.json();
    const aircraft = json.aircraft ?? [];
    // Limit to first 500 for performance
    aircraftData = aircraft
      .slice(0, MAX_AIRCRAFT)
      .filter((a: any) => a.lat != null && a.lon != null)
      .map((a: any) => ({
        icao24: a.icao24 ?? '',
        callsign: (a.callsign ?? '').trim(),
        country: a.country ?? '',
        lat: a.lat,
        lon: a.lon,
        altitude: a.altitude ?? 0,
        velocity: a.velocity ?? 0,
        heading: a.heading ?? 0,
      }));

    const { getGlobe } = await import('../globe');
    const globe = getGlobe();
    globe.registerLayer('aircraft', createAircraftLayer());
  } catch {
    // Keep existing data on error
  }
}

registerLayerDef(metadata, createAircraftLayer);

// Deferred initial fetch (REST polling fallback)
setTimeout(() => { void fetchAndUpdate(); }, 7_000);
setInterval(() => { void fetchAndUpdate(); }, 60 * 1_000);

// Real-time updates from Railway WebSocket relay (preferred path)
window.addEventListener('aircraft-update', (e: Event) => {
  const aircraft = (e as CustomEvent<any[]>).detail;
  if (!Array.isArray(aircraft)) return;

  aircraftData = aircraft
    .slice(0, MAX_AIRCRAFT)
    .filter((a) => a.lat != null && a.lon != null)
    .map((a) => ({
      icao24: String(a.icao24 ?? ''),
      callsign: String(a.callsign ?? '').trim(),
      country: String(a.country ?? ''),
      lat: a.lat as number,
      lon: a.lon as number,
      altitude: (a.altitude ?? 0) as number,
      velocity: (a.velocity ?? 0) as number,
      heading: (a.heading ?? 0) as number,
    }));

  import('../globe').then(({ getGlobe }) => {
    try {
      getGlobe().registerLayer('aircraft', createAircraftLayer());
    } catch { /* globe not ready yet */ }
  });
});

export { createAircraftLayer };
