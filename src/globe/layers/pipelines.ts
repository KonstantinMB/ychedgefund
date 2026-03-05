/**
 * Pipelines Layer
 * Displays major oil and gas pipelines worldwide
 */

import { GeoJsonLayer } from '@deck.gl/layers';
import { registerLayerDef } from '../layer-registry';
import type { LayerMetadata } from '../layer-registry';
import PIPELINES_DATA from '../../data/pipelines.json';

const metadata: LayerMetadata = {
  id: 'pipelines',
  name: 'Pipelines',
  description: 'Major oil and gas pipeline networks (critical energy infrastructure)',
  category: 'infrastructure',
  color: '#f97316',
  defaultActive: false,
  order: 21,
};

function createPipelinesLayer() {
  return new GeoJsonLayer({
    id: 'pipelines',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: PIPELINES_DATA as any,
    pickable: true,
    stroked: true,
    filled: false,
    lineWidthMinPixels: 1,
    lineWidthMaxPixels: 2,
    getLineColor: [249, 115, 22, 180],
    getLineWidth: 1,
  });
}

registerLayerDef(metadata, createPipelinesLayer);

export { createPipelinesLayer };
