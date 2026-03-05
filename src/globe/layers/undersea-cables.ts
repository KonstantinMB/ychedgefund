/**
 * Undersea Cables Layer
 * Displays submarine internet and communications cables worldwide
 */

import { GeoJsonLayer } from '@deck.gl/layers';
import { registerLayerDef } from '../layer-registry';
import type { LayerMetadata } from '../layer-registry';
import CABLES_DATA from '../../data/undersea-cables.json';

const metadata: LayerMetadata = {
  id: 'undersea-cables',
  name: 'Undersea Cables',
  description: 'Submarine internet and telecommunications cables (critical global infrastructure)',
  category: 'infrastructure',
  color: '#06b6d4',
  defaultActive: true,
  order: 20,
};

function createUnderseaCablesLayer() {
  return new GeoJsonLayer({
    id: 'undersea-cables',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: CABLES_DATA as any,
    pickable: true,
    stroked: true,
    filled: false,
    lineWidthMinPixels: 1,
    lineWidthMaxPixels: 3,
    getLineColor: [6, 182, 212, 180],
    getLineWidth: 1,
  });
}

registerLayerDef(metadata, createUnderseaCablesLayer);

export { createUnderseaCablesLayer };
