/**
 * Globe Camera Presets
 *
 * Pre-defined viewpoints with smooth fly-to animations:
 * - GLOBAL: Full Earth view
 * - AMERICAS: Western hemisphere
 * - EMEA: Europe, Middle East, Africa
 * - APAC: Asia-Pacific
 * - MENA: Middle East focus
 * - INDO-PACIFIC: Strategic corridor
 * - ARCTIC: Northern routes
 * - STRAITS: Key chokepoints
 */

export interface CameraPreset {
  id: string;
  name: string;
  description: string;
  longitude: number;
  latitude: number;
  zoom: number;
  pitch?: number; // Default 0 (top-down)
  bearing?: number; // Default 0 (north up)
  transitionDuration?: number; // ms, default 2000
}

export const CAMERA_PRESETS: CameraPreset[] = [
  {
    id: 'global',
    name: 'Global',
    description: 'Full Earth view',
    longitude: 0,
    latitude: 20,
    zoom: 1.5,
    pitch: 0,
    bearing: 0,
  },
  {
    id: 'americas',
    name: 'Americas',
    description: 'North & South America',
    longitude: -95,
    latitude: 20,
    zoom: 2.5,
    pitch: 0,
    bearing: 0,
  },
  {
    id: 'emea',
    name: 'EMEA',
    description: 'Europe, Middle East, Africa',
    longitude: 20,
    latitude: 30,
    zoom: 2.8,
    pitch: 0,
    bearing: 0,
  },
  {
    id: 'apac',
    name: 'Asia-Pacific',
    description: 'Asia & Oceania',
    longitude: 110,
    latitude: 15,
    zoom: 2.6,
    pitch: 0,
    bearing: 0,
  },
  {
    id: 'mena',
    name: 'Middle East',
    description: 'MENA region focus',
    longitude: 45,
    latitude: 25,
    zoom: 4,
    pitch: 30,
    bearing: 0,
  },
  {
    id: 'indo-pacific',
    name: 'Indo-Pacific',
    description: 'Strategic corridor',
    longitude: 95,
    latitude: 5,
    zoom: 3.5,
    pitch: 20,
    bearing: -20,
  },
  {
    id: 'straits',
    name: 'Straits',
    description: 'Global chokepoints',
    longitude: 50,
    latitude: 15,
    zoom: 3.8,
    pitch: 25,
    bearing: 0,
  },
  {
    id: 'arctic',
    name: 'Arctic',
    description: 'Northern routes',
    longitude: 0,
    latitude: 75,
    zoom: 3,
    pitch: 40,
    bearing: 0,
  },
  {
    id: 'ukraine',
    name: 'Ukraine',
    description: 'Eastern Europe conflict',
    longitude: 31,
    latitude: 49,
    zoom: 6,
    pitch: 40,
    bearing: 0,
  },
  {
    id: 'taiwan',
    name: 'Taiwan Strait',
    description: 'Taiwan Strait tension',
    longitude: 120,
    latitude: 24,
    zoom: 7,
    pitch: 35,
    bearing: 0,
  },
];

/**
 * Get preset by ID
 */
export function getPresetById(id: string): CameraPreset | undefined {
  return CAMERA_PRESETS.find((p) => p.id === id);
}

/**
 * Apply camera preset to deck.gl view state
 */
export function applyCameraPreset(
  preset: CameraPreset,
  currentViewState: any
): any {
  return {
    ...currentViewState,
    longitude: preset.longitude,
    latitude: preset.latitude,
    zoom: preset.zoom,
    pitch: preset.pitch ?? 0,
    bearing: preset.bearing ?? 0,
    transitionDuration: preset.transitionDuration ?? 2000,
    transitionInterpolator: 'FlyToInterpolator',
  };
}
