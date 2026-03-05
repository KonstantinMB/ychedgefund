/**
 * Layer Registry
 * Central registry for all globe layers
 * Each layer can be toggled on/off independently
 *
 * WorldMonitor-inspired: explicit layer ordering, progressive disclosure (minZoom),
 * and category-based grouping for optimal map rendering.
 */

import type { Layer } from '@deck.gl/core';

/**
 * Layer metadata
 */
export interface LayerMetadata {
  id: string;
  name: string;
  description: string;
  category: 'military' | 'infrastructure' | 'economic' | 'intelligence' | 'environmental';
  icon?: string;
  color: string;
  defaultActive: boolean;
  /** Render order (lower = drawn first, behind higher-order layers). Default: 100. */
  order?: number;
  /** Progressive disclosure: only show when zoom >= minZoom. Omit = visible at all zooms. */
  minZoom?: number;
}

/**
 * Explicit layer order for consistent stacking (WorldMonitor-style).
 * Lower index = drawn first (background). Higher index = drawn last (foreground).
 */
export const LAYER_ORDER: string[] = [
  'risk-heatmap',      // portfolio exposure (base layer)
  'conflict-zones',     // polygons
  'undersea-cables',    // lines
  'pipelines',          // lines
  'chokepoints',        // points
  'military-bases',     // points (detail)
  'nuclear-facilities', // points (detail)
  'financial-centers',  // points
  'earthquakes',        // live points
  'fires',              // live points
  'aircraft',           // live points
  'test-markers',      // dev/debug
];

/**
 * Category display order for the layer panel
 */
export const CATEGORY_ORDER: LayerMetadata['category'][] = [
  'intelligence',
  'military',
  'infrastructure',
  'economic',
  'environmental',
];

/**
 * Layer factory function
 * Returns a deck.gl Layer instance
 */
export type LayerFactory = () => Layer;

/**
 * Registered layer definition
 */
interface RegisteredLayer {
  metadata: LayerMetadata;
  factory: LayerFactory;
}

/**
 * Layer registry
 */
class LayerRegistry {
  private layers: Map<string, RegisteredLayer> = new Map();

  /**
   * Register a layer
   */
  register(metadata: LayerMetadata, factory: LayerFactory): void {
    if (this.layers.has(metadata.id)) {
      console.warn(`[LayerRegistry] Layer '${metadata.id}' already registered, overwriting`);
    }

    this.layers.set(metadata.id, { metadata, factory });
    console.log(`[LayerRegistry] Registered layer: ${metadata.name} (${metadata.id})`);
  }

  /**
   * Unregister a layer
   */
  unregister(id: string): void {
    const removed = this.layers.delete(id);
    if (removed) {
      console.log(`[LayerRegistry] Unregistered layer: ${id}`);
    }
  }

  /**
   * Get layer metadata
   */
  getMetadata(id: string): LayerMetadata | null {
    const layer = this.layers.get(id);
    return layer ? layer.metadata : null;
  }

  /**
   * Get all layer metadata, sorted by category order then layer order
   */
  getAllMetadata(): LayerMetadata[] {
    const meta = Array.from(this.layers.values()).map(l => l.metadata);
    return this.sortMetadata(meta);
  }

  /**
   * Get layer metadata by category
   */
  getByCategory(category: LayerMetadata['category']): LayerMetadata[] {
    return Array.from(this.layers.values())
      .filter(l => l.metadata.category === category)
      .map(l => l.metadata);
  }

  /**
   * Sort metadata by category order, then LAYER_ORDER, then order field
   */
  private sortMetadata(meta: LayerMetadata[]): LayerMetadata[] {
    const orderIdx = (id: string) => {
      const i = LAYER_ORDER.indexOf(id);
      return i >= 0 ? i : LAYER_ORDER.length + (meta.find(m => m.id === id)?.order ?? 100);
    };
    const catIdx = (c: LayerMetadata['category']) => CATEGORY_ORDER.indexOf(c);
    return [...meta].sort((a, b) => {
      const ca = catIdx(a.category);
      const cb = catIdx(b.category);
      if (ca !== cb) return ca - cb;
      const oa = orderIdx(a.id);
      const ob = orderIdx(b.id);
      if (oa !== ob) return oa - ob;
      return (a.order ?? 100) - (b.order ?? 100);
    });
  }

  /**
   * Get ordered, zoom-filtered layer IDs for rendering.
   * Respects minZoom (progressive disclosure) and LAYER_ORDER.
   */
  getOrderedIdsForView(activeIds: Set<string>, zoom: number): string[] {
    const ordered: string[] = [];
    for (const id of LAYER_ORDER) {
      if (!activeIds.has(id)) continue;
      const meta = this.getMetadata(id);
      if (!meta) continue;
      if (meta.minZoom != null && zoom < meta.minZoom) continue;
      ordered.push(id);
    }
    // Include any active IDs not in LAYER_ORDER (e.g. sub-layers like risk-heatmap-base)
    for (const id of activeIds) {
      if (ordered.includes(id)) continue;
      const meta = this.getMetadata(id);
      if (meta && (meta.minZoom == null || zoom >= meta.minZoom)) {
        ordered.push(id);
      }
    }
    return ordered;
  }

  /**
   * Create layer instance from factory
   */
  createLayer(id: string): Layer | null {
    const registered = this.layers.get(id);
    if (!registered) {
      console.error(`[LayerRegistry] Layer '${id}' not found`);
      return null;
    }

    try {
      return registered.factory();
    } catch (error) {
      console.error(`[LayerRegistry] Error creating layer '${id}':`, error);
      return null;
    }
  }

  /**
   * Create multiple layer instances
   */
  createLayers(ids: string[]): Layer[] {
    const layers: Layer[] = [];
    for (const id of ids) {
      const layer = this.createLayer(id);
      if (layer) {
        layers.push(layer);
      }
    }
    return layers;
  }

  /**
   * Get all layer IDs
   */
  getAllIds(): string[] {
    return Array.from(this.layers.keys());
  }

  /**
   * Get default active layer IDs
   */
  getDefaultActiveIds(): string[] {
    return Array.from(this.layers.values())
      .filter(l => l.metadata.defaultActive)
      .map(l => l.metadata.id);
  }

  /**
   * Check if layer exists
   */
  has(id: string): boolean {
    return this.layers.has(id);
  }

  /**
   * Clear all layers
   */
  clear(): void {
    this.layers.clear();
    console.log('[LayerRegistry] Cleared all layers');
  }
}

// Singleton instance
const registry = new LayerRegistry();

/**
 * Get the layer registry instance
 */
export function getLayerRegistry(): LayerRegistry {
  return registry;
}

/**
 * Register a layer (convenience function)
 */
export function registerLayerDef(metadata: LayerMetadata, factory: LayerFactory): void {
  registry.register(metadata, factory);
}

// Export the registry instance as default
export default registry;
