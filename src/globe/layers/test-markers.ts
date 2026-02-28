/**
 * Test Markers Layer
 * Simple ScatterplotLayer for testing globe initialization
 * Shows key cities around the world
 */

import { ScatterplotLayer } from '@deck.gl/layers';
import { registerLayerDef } from '../layer-registry';
import type { LayerMetadata } from '../layer-registry';

/**
 * Test marker data - major cities
 */
const TEST_MARKERS = [
  { name: 'New York', lon: -74.006, lat: 40.7128, size: 100 },
  { name: 'London', lon: -0.1276, lat: 51.5074, size: 100 },
  { name: 'Tokyo', lon: 139.6917, lat: 35.6762, size: 100 },
  { name: 'Dubai', lon: 55.2708, lat: 25.2048, size: 100 },
  { name: 'Singapore', lon: 103.8198, lat: 1.3521, size: 100 },
  { name: 'Moscow', lon: 37.6173, lat: 55.7558, size: 100 },
  { name: 'Beijing', lon: 116.4074, lat: 39.9042, size: 100 },
  { name: 'Sydney', lon: 151.2093, lat: -33.8688, size: 100 },
  { name: 'São Paulo', lon: -46.6333, lat: -23.5505, size: 100 },
  { name: 'Mumbai', lon: 72.8777, lat: 19.076, size: 100 },
];

/**
 * Layer metadata
 */
const metadata: LayerMetadata = {
  id: 'test-markers',
  name: 'Test Markers',
  description: 'Test markers for globe initialization',
  category: 'intelligence',
  color: '#4ade80',
  defaultActive: true,
};

/**
 * Create test markers layer
 */
function createTestMarkersLayer() {
  return new ScatterplotLayer({
    id: 'test-markers',
    data: TEST_MARKERS,
    pickable: true,
    opacity: 0.8,
    stroked: true,
    filled: true,
    radiusScale: 1000,
    radiusMinPixels: 4,
    radiusMaxPixels: 20,
    lineWidthMinPixels: 1,
    getPosition: (d: any) => [d.lon, d.lat, 0],
    getRadius: (d: any) => d.size,
    getFillColor: [74, 222, 128, 200], // Green glow
    getLineColor: [74, 222, 128, 255],
    updateTriggers: {
      getPosition: TEST_MARKERS,
    },
  });
}

// Register the layer
registerLayerDef(metadata, createTestMarkersLayer);

// Export for direct use
export { createTestMarkersLayer, TEST_MARKERS };
