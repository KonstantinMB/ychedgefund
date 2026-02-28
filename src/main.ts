/**
 * Atlas - Global Intelligence Platform
 * Entry point for the application
 */

import { initState } from './lib/state';
import { WebSocketManager } from './lib/websocket';

// Initialize application state
const state = initState();

// WebSocket manager for real-time data streams
let wsManager: WebSocketManager | null = null;

/**
 * Initialize the globe and map layers
 */
function initGlobe(): void {
  const container = document.getElementById('globe-container');
  if (!container) {
    console.error('Globe container not found');
    return;
  }

  console.log('[Atlas] Globe initialization placeholder - deck.gl setup will go here');
  // TODO: Initialize deck.gl + MapLibre GL JS
  // TODO: Load static layers from /src/data/
}

/**
 * Initialize panels on the right sidebar
 */
function initPanels(): void {
  const rightPanel = document.getElementById('right-panel');
  if (!rightPanel) {
    console.error('Right panel container not found');
    return;
  }

  console.log('[Atlas] Panel initialization placeholder');
  // TODO: Initialize collapsible panels
  // TODO: Load real-time data feeds
}

/**
 * Initialize WebSocket connections for real-time data
 */
function initWebSockets(): void {
  // Railway relay WebSocket will be initialized here
  console.log('[Atlas] WebSocket initialization placeholder');
  // TODO: Connect to Railway relay for AIS + OpenSky streams
}

/**
 * Main application initialization
 */
function init(): void {
  console.log('[Atlas] Initializing Global Intelligence Platform...');
  console.log('[Atlas] Environment:', import.meta.env.MODE);

  // Initialize core components
  initGlobe();
  initPanels();

  // WebSocket connections (deferred to avoid blocking)
  setTimeout(initWebSockets, 1000);

  console.log('[Atlas] Initialization complete');
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Export for debugging in console
if (import.meta.env.DEV) {
  (window as any).atlas = {
    state,
    wsManager,
  };
}
