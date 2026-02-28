/**
 * Layer Registry
 * Central registry for all globe layers
 * Each layer can be toggled on/off independently
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
}

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
   * Get all layer metadata
   */
  getAllMetadata(): LayerMetadata[] {
    return Array.from(this.layers.values()).map(l => l.metadata);
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
