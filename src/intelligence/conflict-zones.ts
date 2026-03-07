/**
 * Conflict Zone Aggregator
 *
 * Aggregates ACLED conflict events into geographic zones using density-based clustering.
 * Generates GeoJSON polygons from point events for globe visualization.
 */

interface AcledEvent {
  id: string;
  date: number;
  type: string;
  country: string;
  lat: number;
  lon: number;
  fatalities: number;
  notes: string;
}

interface ConflictZone {
  type: 'Feature';
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  properties: {
    name: string;
    since: string;
    intensity: 'low' | 'medium' | 'high';
    eventCount: number;
    totalFatalities: number;
    countries: string[];
    recentEvents: number; // events in last 30 days
  };
}

interface ConflictZoneCollection {
  type: 'FeatureCollection';
  features: ConflictZone[];
  lastUpdated: number;
}

/**
 * Calculate distance between two points using Haversine formula (km)
 */
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * DBSCAN-like clustering of events into zones
 */
function clusterEvents(
  events: AcledEvent[],
  maxDistance: number = 150 // km
): AcledEvent[][] {
  const clusters: AcledEvent[][] = [];
  const visited = new Set<string>();

  for (const event of events) {
    if (visited.has(event.id)) continue;

    const cluster: AcledEvent[] = [event];
    visited.add(event.id);

    // Find all nearby events
    for (const other of events) {
      if (visited.has(other.id)) continue;

      const dist = haversineDistance(event.lat, event.lon, other.lat, other.lon);
      if (dist <= maxDistance) {
        cluster.push(other);
        visited.add(other.id);
      }
    }

    // Only create cluster if it has 3+ events (filter noise)
    if (cluster.length >= 3) {
      clusters.push(cluster);
    }
  }

  return clusters;
}

/**
 * Create bounding box polygon from cluster of events
 */
function createBoundingPolygon(cluster: AcledEvent[]): number[][] {
  const lats = cluster.map(e => e.lat);
  const lons = cluster.map(e => e.lon);

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  // Add 0.5° padding
  const padding = 0.5;

  return [
    [minLon - padding, minLat - padding],
    [maxLon + padding, minLat - padding],
    [maxLon + padding, maxLat + padding],
    [minLon - padding, maxLat + padding],
    [minLon - padding, minLat - padding], // close polygon
  ];
}

/**
 * Determine zone intensity based on event density and fatalities
 */
function calculateIntensity(cluster: AcledEvent[]): 'low' | 'medium' | 'high' {
  const totalFatalities = cluster.reduce((sum, e) => sum + e.fatalities, 0);
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const recentEvents = cluster.filter(e => e.date > thirtyDaysAgo).length;

  // High: 20+ fatalities OR 10+ recent events
  if (totalFatalities >= 20 || recentEvents >= 10) return 'high';

  // Medium: 5+ fatalities OR 5+ recent events
  if (totalFatalities >= 5 || recentEvents >= 5) return 'medium';

  return 'low';
}

/**
 * Generate zone name from cluster
 */
function generateZoneName(cluster: AcledEvent[]): string {
  const countries = [...new Set(cluster.map(e => e.country))];

  if (countries.length === 1) {
    return `${countries[0]} Conflict Zone`;
  } else if (countries.length === 2) {
    return `${countries[0]}-${countries[1]} Border Zone`;
  } else {
    return `Multi-Country Conflict Zone (${countries.slice(0, 3).join(', ')})`;
  }
}

/**
 * Find earliest event date in cluster
 */
function findEarliestDate(cluster: AcledEvent[]): string {
  const earliest = Math.min(...cluster.map(e => e.date));
  return new Date(earliest).toISOString().split('T')[0];
}

/**
 * Aggregate ACLED events into conflict zones
 */
export function aggregateConflictZones(
  acledEvents: AcledEvent[]
): ConflictZoneCollection {
  // Filter recent events (last 6 months)
  const sixMonthsAgo = Date.now() - 180 * 24 * 60 * 60 * 1000;
  const recentEvents = acledEvents.filter(e => e.date > sixMonthsAgo);

  // Cluster events by geographic proximity
  const clusters = clusterEvents(recentEvents);

  // Convert clusters to GeoJSON zones
  const features: ConflictZone[] = clusters.map(cluster => {
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    return {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [createBoundingPolygon(cluster)],
      },
      properties: {
        name: generateZoneName(cluster),
        since: findEarliestDate(cluster),
        intensity: calculateIntensity(cluster),
        eventCount: cluster.length,
        totalFatalities: cluster.reduce((sum, e) => sum + e.fatalities, 0),
        countries: [...new Set(cluster.map(e => e.country))],
        recentEvents: cluster.filter(e => e.date > thirtyDaysAgo).length,
      },
    };
  });

  return {
    type: 'FeatureCollection',
    features,
    lastUpdated: Date.now(),
  };
}

/**
 * Merge static zones with live zones (prioritize live data)
 */
export function mergeConflictZones(
  staticZones: ConflictZoneCollection,
  liveZones: ConflictZoneCollection
): ConflictZoneCollection {
  // Use live zones as base, add static zones that don't overlap
  const merged = [...liveZones.features];

  for (const staticZone of staticZones.features) {
    // Check if this static zone overlaps with any live zone
    const overlaps = merged.some(liveZone => {
      const staticCountries = staticZone.properties.countries || [
        staticZone.properties.name.split(' ')[0],
      ];
      const liveCountries = liveZone.properties.countries || [];

      return staticCountries.some(c => liveCountries.includes(c));
    });

    // If no overlap, include the static zone
    if (!overlaps) {
      merged.push(staticZone);
    }
  }

  return {
    type: 'FeatureCollection',
    features: merged,
    lastUpdated: Date.now(),
  };
}
