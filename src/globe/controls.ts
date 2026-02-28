/**
 * Globe Layer Controls
 * UI for toggling layers on/off in the left panel
 */

import { getStore } from '../lib/state';
import { getLayerRegistry } from './layer-registry';
import { getGlobe } from './globe';

/**
 * Render layer controls in the left panel
 */
export function renderLayerControls(container: HTMLElement): void {
  const store = getStore();
  const registry = getLayerRegistry();

  // Clear existing content
  container.innerHTML = '';

  // Create header
  const header = document.createElement('div');
  header.style.padding = 'var(--spacing-md)';
  header.style.borderBottom = '1px solid var(--border-secondary)';
  header.innerHTML = `
    <h3 style="margin: 0; font-size: 14px; font-weight: 600; color: var(--text-primary);">
      LAYERS
    </h3>
  `;
  container.appendChild(header);

  // Create layer list
  const layerList = document.createElement('div');
  layerList.style.padding = 'var(--spacing-sm)';
  layerList.id = 'layer-list';

  // Get all layers grouped by category
  const allMetadata = registry.getAllMetadata();
  const categories = new Map<string, typeof allMetadata>();

  allMetadata.forEach(meta => {
    if (!categories.has(meta.category)) {
      categories.set(meta.category, []);
    }
    categories.get(meta.category)!.push(meta);
  });

  // Get current active layers
  const activeLayers = store.get('globe').activeLayers;

  // Render by category
  categories.forEach((layers, category) => {
    // Category header
    const categoryHeader = document.createElement('div');
    categoryHeader.style.cssText = `
      padding: var(--spacing-sm) 0;
      font-size: 11px;
      font-weight: 600;
      color: var(--text-tertiary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    `;
    categoryHeader.textContent = category;
    layerList.appendChild(categoryHeader);

    // Layer toggles
    layers.forEach(meta => {
      const layerToggle = createLayerToggle(meta.id, meta.name, meta.color, activeLayers.has(meta.id));
      layerList.appendChild(layerToggle);
    });
  });

  container.appendChild(layerList);

  // Subscribe to layer changes and re-render
  store.subscribe('globe', (globeState) => {
    const layerElements = layerList.querySelectorAll('[data-layer-id]');
    layerElements.forEach((el) => {
      const layerId = el.getAttribute('data-layer-id');
      if (layerId) {
        const checkbox = el.querySelector('input[type="checkbox"]') as HTMLInputElement;
        if (checkbox) {
          checkbox.checked = globeState.activeLayers.has(layerId);
        }
      }
    });
  });
}

/**
 * Create a layer toggle element
 */
function createLayerToggle(id: string, name: string, color: string, isActive: boolean): HTMLElement {
  const toggle = document.createElement('label');
  toggle.setAttribute('data-layer-id', id);
  toggle.style.cssText = `
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm);
    margin: var(--spacing-xs) 0;
    cursor: pointer;
    border-radius: var(--radius-sm);
    transition: background var(--transition-fast);
  `;
  toggle.onmouseenter = () => {
    toggle.style.background = 'var(--bg-button)';
  };
  toggle.onmouseleave = () => {
    toggle.style.background = 'transparent';
  };

  // Checkbox
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = isActive;
  checkbox.style.cssText = `
    width: 16px;
    height: 16px;
    cursor: pointer;
    accent-color: var(--text-accent);
  `;
  checkbox.onchange = () => {
    const store = getStore();
    const globe = getGlobe();
    const registry = getLayerRegistry();

    // Toggle layer in state
    store.update('globe', (current) => {
      const newActiveLayers = new Set(current.activeLayers);
      if (newActiveLayers.has(id)) {
        newActiveLayers.delete(id);
      } else {
        newActiveLayers.add(id);
      }
      return {
        ...current,
        activeLayers: newActiveLayers,
      };
    });

    // Update globe layers
    const layer = registry.createLayer(id);
    if (layer) {
      if (checkbox.checked) {
        globe.registerLayer(id, layer);
      } else {
        globe.unregisterLayer(id);
      }
    }
  };

  // Color indicator
  const colorDot = document.createElement('span');
  colorDot.style.cssText = `
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: ${color};
    box-shadow: 0 0 4px ${color};
  `;

  // Label
  const label = document.createElement('span');
  label.style.cssText = `
    flex: 1;
    font-size: 13px;
    color: var(--text-primary);
    user-select: none;
  `;
  label.textContent = name;

  toggle.appendChild(checkbox);
  toggle.appendChild(colorDot);
  toggle.appendChild(label);

  return toggle;
}

/**
 * Initialize layer controls
 */
export function initLayerControls(): void {
  const leftPanel = document.getElementById('left-panel');
  if (!leftPanel) {
    console.error('[Controls] Left panel not found');
    return;
  }

  renderLayerControls(leftPanel);
  console.log('[Controls] Layer controls initialized');
}
