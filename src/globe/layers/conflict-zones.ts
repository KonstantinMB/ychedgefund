/**
 * Conflict Zones Layer
 * Displays active and recent armed conflict zones as geographic polygons
 * Uses live ACLED data aggregated hourly + static fallback zones
 */

import { GeoJsonLayer } from '@deck.gl/layers';
import { registerLayerDef } from '../layer-registry';
import type { LayerMetadata } from '../layer-registry';
import STATIC_CONFLICT_DATA from '../../data/conflict-zones.json';
import { dataService } from '../../lib/data-service';
import type { ConflictZonesDetail } from '../../lib/data-service';

const metadata: LayerMetadata = {
  id: 'conflict-zones',
  name: 'Conflict Zones',
  description: 'Active and recent armed conflict zones with intensity indicators (updated hourly)',
  category: 'intelligence',
  color: '#ef4444',
  defaultActive: true,
  order: 1,
};

// Current data (starts with static, updates with live)
let currentData: ConflictZonesDetail = STATIC_CONFLICT_DATA as ConflictZonesDetail;

// Subscribe to live conflict zone updates
dataService.addEventListener('conflict-zones', (async (event: Event) => {
  const customEvent = event as CustomEvent<ConflictZonesDetail>;
  currentData = customEvent.detail;

  // Re-register layer with updated data
  try {
    const { getGlobe } = await import('../globe');
    const globe = getGlobe();
    globe.registerLayer('conflict-zones', createConflictZonesLayer());
  } catch {
    // Globe may not be initialized yet - that's ok
  }
}) as EventListener);

function createConflictZonesLayer() {
  return new GeoJsonLayer({
    id: 'conflict-zones',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: currentData as any,
    pickable: true,
    stroked: true,
    filled: true,
    lineWidthMinPixels: 1,
    // Color intensity based on zone intensity
    getFillColor: (d: any) => {
      const intensity = d.properties?.intensity || 'medium';
      if (intensity === 'high') return [239, 68, 68, 140]; // Bright red, more opaque
      if (intensity === 'medium') return [239, 68, 68, 100]; // Medium red
      return [239, 68, 68, 60]; // Low intensity, more transparent
    },
    getLineColor: (d: any) => {
      const intensity = d.properties?.intensity || 'medium';
      if (intensity === 'high') return [239, 68, 68, 255];
      if (intensity === 'medium') return [239, 68, 68, 200];
      return [239, 68, 68, 150];
    },
    getLineWidth: 1,
    updateTriggers: {
      getFillColor: currentData.lastUpdated,
      getLineColor: currentData.lastUpdated,
    },
  });
}

registerLayerDef(metadata, createConflictZonesLayer);

export { createConflictZonesLayer };
