/**
 * Globe Country Interactions
 *
 * Hover → tooltip with country name, CII, events, portfolio exposure
 * Click → fly-to + show country detail panel
 * Right-click → context menu with actions
 */

import type { Deck } from '@deck.gl/core';

// ── State ─────────────────────────────────────────────────────────────────

let tooltipEl: HTMLElement | null = null;
let contextMenuEl: HTMLElement | null = null;
let hoveredCountry: string | null = null;

// Country data cache
const countryData = new Map<
  string,
  {
    name: string;
    cii: number;
    activeEvents: number;
    portfolioExposure: number; // percentage
  }
>();

// ── Initialize ────────────────────────────────────────────────────────────

export function initCountryInteractions(globe: Deck): void {
  createTooltip();
  createContextMenu();

  // Wire up deck.gl hover events
  globe.setProps({
    onHover: (info: any) => {
      if (info.layer?.id?.includes('risk-heatmap')) {
        handleCountryHover(info);
      } else {
        hideTooltip();
      }
    },
    onClick: (info: any) => {
      if (info.layer?.id?.includes('risk-heatmap')) {
        handleCountryClick(info);
      }
    },
  });

  // Right-click context menu
  const container = globe.getCanvas()?.parentElement;
  if (container) {
    container.addEventListener('contextmenu', (e: MouseEvent) => {
      if (hoveredCountry) {
        e.preventDefault();
        showContextMenu(e.clientX, e.clientY, hoveredCountry);
      }
    });
  }

  console.log('[CountryInteractions] Initialized');
}

// ── Tooltip ───────────────────────────────────────────────────────────────

function createTooltip(): void {
  tooltipEl = document.createElement('div');
  tooltipEl.className = 'globe-country-tooltip';
  tooltipEl.style.cssText = `
    position: fixed;
    pointer-events: none;
    z-index: 999;
    opacity: 0;
    transition: opacity 0.15s ease-out;
  `;
  document.body.appendChild(tooltipEl);
}

function handleCountryHover(info: any): void {
  if (!info.object || !tooltipEl) {
    hideTooltip();
    return;
  }

  const iso2 = info.object.iso2 || info.object.country;
  if (!iso2) {
    hideTooltip();
    return;
  }

  hoveredCountry = iso2;

  // Get country data (from intelligence engine + portfolio)
  const data = getCountryData(iso2);

  // Position tooltip near cursor
  const x = info.x ?? 0;
  const y = info.y ?? 0;

  tooltipEl.innerHTML = `
    <div class="country-tooltip-header">${data.name}</div>
    <div class="country-tooltip-row">
      <span class="tooltip-label">CII Score:</span>
      <span class="tooltip-value">${data.cii}</span>
    </div>
    <div class="country-tooltip-row">
      <span class="tooltip-label">Active Events:</span>
      <span class="tooltip-value">${data.activeEvents}</span>
    </div>
    <div class="country-tooltip-row">
      <span class="tooltip-label">Portfolio Exposure:</span>
      <span class="tooltip-value ${data.portfolioExposure > 0 ? 'exposure-active' : ''}">${data.portfolioExposure.toFixed(1)}%</span>
    </div>
  `;

  tooltipEl.style.left = `${x + 15}px`;
  tooltipEl.style.top = `${y + 15}px`;
  tooltipEl.style.opacity = '1';
}

function hideTooltip(): void {
  if (tooltipEl) {
    tooltipEl.style.opacity = '0';
  }
  hoveredCountry = null;
}

// ── Click Handler ─────────────────────────────────────────────────────────

function handleCountryClick(info: any): void {
  const iso2 = info.object?.iso2 || info.object?.country;
  if (!iso2) return;

  const data = getCountryData(iso2);

  console.log('[CountryInteractions] Country clicked:', data.name);

  // Fly to country
  const coords = info.object.coordinates || info.coordinate;
  if (coords) {
    window.dispatchEvent(
      new CustomEvent('globe:fly-to', {
        detail: {
          longitude: coords[0],
          latitude: coords[1],
          zoom: 4,
          duration: 1500,
        },
      })
    );
  }

  // TODO: Open country detail panel
  // For now, just log
  console.log(`[CountryInteractions] Opening detail panel for ${data.name}:`, {
    cii: data.cii,
    events: data.activeEvents,
    exposure: data.portfolioExposure,
  });
}

// ── Context Menu ──────────────────────────────────────────────────────────

function createContextMenu(): void {
  contextMenuEl = document.createElement('div');
  contextMenuEl.className = 'globe-context-menu';
  contextMenuEl.style.cssText = `
    position: fixed;
    z-index: 1000;
    display: none;
  `;
  document.body.appendChild(contextMenuEl);

  // Close on click outside
  document.addEventListener('click', () => {
    if (contextMenuEl) {
      contextMenuEl.style.display = 'none';
    }
  });
}

function showContextMenu(x: number, y: number, iso2: string): void {
  if (!contextMenuEl) return;

  const data = getCountryData(iso2);

  contextMenuEl.innerHTML = `
    <div class="context-menu-header">${data.name}</div>
    <button class="context-menu-item" data-action="signals">
      <span class="context-menu-icon">📊</span>
      View signals for ${data.name}
    </button>
    <button class="context-menu-item" data-action="positions">
      <span class="context-menu-icon">📈</span>
      View positions exposed to ${data.name}
    </button>
    <button class="context-menu-item" data-action="events">
      <span class="context-menu-icon">🌍</span>
      View recent events in ${data.name}
    </button>
    <div class="context-menu-divider"></div>
    <button class="context-menu-item" data-action="detail">
      <span class="context-menu-icon">ℹ️</span>
      View country detail
    </button>
  `;

  // Position near cursor
  contextMenuEl.style.left = `${x}px`;
  contextMenuEl.style.top = `${y}px`;
  contextMenuEl.style.display = 'block';

  // Wire up actions
  contextMenuEl.querySelectorAll('.context-menu-item').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = (btn as HTMLElement).dataset.action;
      handleContextAction(action!, iso2, data.name);
      contextMenuEl!.style.display = 'none';
    });
  });
}

function handleContextAction(action: string, iso2: string, countryName: string): void {
  console.log(`[CountryInteractions] Context action: ${action} for ${countryName}`);

  switch (action) {
    case 'signals':
      // TODO: Open signals panel filtered to this country
      window.dispatchEvent(
        new CustomEvent('panel:open', {
          detail: { panelId: 'signals', filter: { country: iso2 } },
        })
      );
      break;

    case 'positions':
      // TODO: Open portfolio panel filtered to this country's exposed positions
      window.dispatchEvent(
        new CustomEvent('panel:open', {
          detail: { panelId: 'portfolio', filter: { country: iso2 } },
        })
      );
      break;

    case 'events':
      // TODO: Open event stream panel filtered to this country
      window.dispatchEvent(
        new CustomEvent('panel:open', {
          detail: { panelId: 'event-stream', filter: { country: iso2 } },
        })
      );
      break;

    case 'detail':
      // TODO: Open country detail view
      console.log(`[CountryInteractions] Opening country detail for ${countryName}`);
      break;
  }
}

// ── Data Helpers ──────────────────────────────────────────────────────────

function getCountryData(iso2: string): {
  name: string;
  cii: number;
  activeEvents: number;
  portfolioExposure: number;
} {
  // Check cache first
  if (countryData.has(iso2)) {
    return countryData.get(iso2)!;
  }

  // Fetch from intelligence engine + portfolio manager
  const name = getCountryName(iso2);
  const cii = getCountryCII(iso2);
  const activeEvents = getCountryEvents(iso2);
  const portfolioExposure = getPortfolioExposure(iso2);

  const data = { name, cii, activeEvents, portfolioExposure };
  countryData.set(iso2, data);

  return data;
}

function getCountryName(iso2: string): string {
  // Simple mapping for common countries
  const names: Record<string, string> = {
    US: 'United States',
    CN: 'China',
    RU: 'Russia',
    IR: 'Iran',
    IQ: 'Iraq',
    SA: 'Saudi Arabia',
    AE: 'UAE',
    IL: 'Israel',
    UA: 'Ukraine',
    KP: 'North Korea',
    // Add more as needed
  };

  return names[iso2] || iso2;
}

function getCountryCII(iso2: string): number {
  // Try to get from intelligence engine
  try {
    const ciiEngine = (window as any).intelligenceEngine?.cii;
    if (ciiEngine) {
      const score = ciiEngine.getScore?.(iso2);
      if (typeof score === 'number') return Math.round(score);
    }
  } catch (err) {
    // Ignore
  }

  // Default mock values
  const mockScores: Record<string, number> = {
    IR: 78,
    IQ: 45,
    UA: 62,
    RU: 34,
    CN: 28,
    US: 12,
  };

  return mockScores[iso2] ?? Math.floor(Math.random() * 40);
}

function getCountryEvents(iso2: string): number {
  // Count events from event stream panel related to this country
  // For now, return mock data
  return Math.floor(Math.random() * 10);
}

function getPortfolioExposure(iso2: string): number {
  // Calculate portfolio exposure to this country
  // For now, return mock data
  const exposures: Record<string, number> = {
    IR: 8.5,
    IQ: 3.2,
    SA: 12.1,
    US: 45.0,
  };

  return exposures[iso2] ?? 0;
}

// ── Cleanup ───────────────────────────────────────────────────────────────

export function cleanupCountryInteractions(): void {
  if (tooltipEl) {
    tooltipEl.remove();
    tooltipEl = null;
  }

  if (contextMenuEl) {
    contextMenuEl.remove();
    contextMenuEl = null;
  }

  countryData.clear();
}
