/**
 * Conflict Zones Layer
 * Displays active and recent conflict zones as geographic polygons
 */

import { GeoJsonLayer } from '@deck.gl/layers';
import { registerLayerDef } from '../layer-registry';
import type { LayerMetadata } from '../layer-registry';
import CONFLICT_DATA from '../../data/conflict-zones.json';

const metadata: LayerMetadata = {
  id: 'conflict-zones',
  name: 'Conflict Zones',
  description: 'Active and recent armed conflict zones with intensity indicators',
  category: 'intelligence',
  color: '#ef4444',
  defaultActive: true,
  order: 1,
};

function createConflictZonesLayer() {
  return new GeoJsonLayer({
    id: 'conflict-zones',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: CONFLICT_DATA as any,
    pickable: true,
    stroked: true,
    filled: true,
    lineWidthMinPixels: 1,
    getFillColor: [239, 68, 68, 120],
    getLineColor: [239, 68, 68, 255],
    getLineWidth: 1,
  });
}

registerLayerDef(metadata, createConflictZonesLayer);

export { createConflictZonesLayer };
