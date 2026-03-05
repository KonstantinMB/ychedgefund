/**
 * Nuclear Facilities Layer
 * Displays nuclear power plants, research reactors, and weapons sites globally
 */

import { ScatterplotLayer } from '@deck.gl/layers';
import { registerLayerDef } from '../layer-registry';
import type { LayerMetadata } from '../layer-registry';
import NUCLEAR_DATA from '../../data/nuclear-facilities.json';

interface NuclearFacility {
  id: string;
  name: string;
  country: string;
  lat: number;
  lon: number;
  type: string;
  status: string;
}

const FACILITIES = NUCLEAR_DATA as NuclearFacility[];

const metadata: LayerMetadata = {
  id: 'nuclear-facilities',
  name: 'Nuclear Facilities',
  description: 'Nuclear power plants, research reactors, and related facilities worldwide',
  category: 'military',
  color: '#fbbf24',
  defaultActive: false,
  order: 11,
  minZoom: 4, // Progressive disclosure: detail layer
};

function createNuclearFacilitiesLayer() {
  return new ScatterplotLayer<NuclearFacility>({
    id: 'nuclear-facilities',
    data: FACILITIES,
    pickable: true,
    opacity: 0.95,
    stroked: true,
    filled: true,
    radiusScale: 1,
    radiusMinPixels: 5,
    radiusMaxPixels: 15,
    lineWidthMinPixels: 2,
    getPosition: (d) => [d.lon, d.lat, 0],
    getRadius: 5,
    getFillColor: [251, 191, 36, 220],
    getLineColor: [239, 68, 68, 255],
  });
}

registerLayerDef(metadata, createNuclearFacilitiesLayer);

export { createNuclearFacilitiesLayer };
