/**
 * Globe Layer Presets
 *
 * Pre-configured layer combinations for different analytical modes:
 * - TACTICAL: Military + conflict + infrastructure threats
 * - FINANCIAL: Markets + trade routes + risk weather
 * - GEOPOLITICAL: Conflict + sanctions + chokepoints
 * - ENVIRONMENTAL: Earthquakes + fires + disasters
 * - INTELLIGENCE: All OSINT layers (aircraft + vessels + events)
 * - MINIMAL: Clean view with just financial centers
 */

export interface LayerPreset {
  id: string;
  name: string;
  description: string;
  layers: string[]; // Layer IDs to enable
  exclusive?: boolean; // If true, disable all other layers first
}

export const LAYER_PRESETS: LayerPreset[] = [
  {
    id: 'tactical',
    name: 'Tactical',
    description: 'Military infrastructure & conflict zones',
    layers: [
      'military-bases',
      'nuclear-facilities',
      'conflict-zones',
      'chokepoints',
      'pipelines',
    ],
    exclusive: true,
  },
  {
    id: 'financial',
    name: 'Financial',
    description: 'Markets, trade routes & risk',
    layers: [
      'financial-centers',
      'financial-beacons',
      'trade-routes',
      'risk-weather',
    ],
    exclusive: true,
  },
  {
    id: 'geopolitical',
    name: 'Geopolitical',
    description: 'Conflicts, sanctions & strategic assets',
    layers: [
      'conflict-zones',
      'chokepoints',
      'pipelines',
      'undersea-cables',
      'nuclear-facilities',
      'risk-weather',
    ],
    exclusive: true,
  },
  {
    id: 'environmental',
    name: 'Environmental',
    description: 'Natural disasters & hazards',
    layers: [
      'earthquakes',
      'fires',
      'heat-pulses',
    ],
    exclusive: true,
  },
  {
    id: 'intelligence',
    name: 'Intelligence',
    description: 'All OSINT layers',
    layers: [
      'aircraft',
      'earthquakes',
      'fires',
      'conflict-zones',
      'heat-pulses',
      'connection-arcs',
    ],
    exclusive: true,
  },
  {
    id: 'cinematic',
    name: 'Cinematic',
    description: 'Maximum visual impact',
    layers: [
      'atmosphere',
      'day-night',
      'financial-beacons',
      'trade-routes',
      'heat-pulses',
      'connection-arcs',
      'risk-weather',
    ],
    exclusive: true,
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Clean view',
    layers: [
      'financial-centers',
    ],
    exclusive: true,
  },
  {
    id: 'all',
    name: 'All Layers',
    description: 'Enable everything',
    layers: [
      'atmosphere',
      'day-night',
      'military-bases',
      'nuclear-facilities',
      'undersea-cables',
      'pipelines',
      'chokepoints',
      'financial-centers',
      'conflict-zones',
      'earthquakes',
      'fires',
      'aircraft',
      'financial-beacons',
      'trade-routes',
      'heat-pulses',
      'connection-arcs',
      'risk-weather',
    ],
    exclusive: true,
  },
];

/**
 * Get preset by ID
 */
export function getPresetById(id: string): LayerPreset | undefined {
  return LAYER_PRESETS.find((p) => p.id === id);
}

/**
 * Apply layer preset to current active layers
 */
export function applyLayerPreset(
  preset: LayerPreset,
  currentActiveLayers: Set<string>
): Set<string> {
  if (preset.exclusive) {
    // Replace all layers with preset layers
    return new Set(preset.layers);
  } else {
    // Add preset layers to current
    const next = new Set(currentActiveLayers);
    preset.layers.forEach((id) => next.add(id));
    return next;
  }
}
