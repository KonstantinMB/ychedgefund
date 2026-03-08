/**
 * Navigation Stats Enhancement
 *
 * Adds live platform stats to the navigation bar:
 * - Globe tab: source count + event rate
 * - Trading tab: active signals + position count
 * - ATLAS logo (◈) with pulse animation synchronized with data ticker
 */

import { portfolioManager } from '../trading/engine/portfolio-manager';
import { signalBus } from '../trading/signals/signal-bus';

// ── State ─────────────────────────────────────────────────────────────────

let initialized = false;
let updateInterval: NodeJS.Timeout | null = null;

// Nav elements
let globeTab: HTMLElement | null = null;
let tradingTab: HTMLElement | null = null;
let headerLogo: HTMLElement | null = null;

// Stats
let sourceCount = 32;
let eventRate = 0;
let activeSignals = 0;
let positionCount = 0;

// ── Initialize ────────────────────────────────────────────────────────────

export function initNavStats(): void {
  if (initialized) return;

  // Get nav tab elements
  globeTab = document.querySelector('.header-nav-tab[data-nav="globe"]');
  tradingTab = document.querySelector('.header-nav-tab[data-nav="trading"]');
  headerLogo = document.querySelector('.header-logo');

  if (!globeTab || !tradingTab || !headerLogo) {
    console.warn('[NavStats] Could not find nav elements');
    return;
  }

  // Replace logo with ATLAS symbol
  enhanceLogo();

  // Subscribe to events
  subscribeToEvents();

  // Initial render
  updateNavStats();

  // Update every 3 seconds
  updateInterval = setInterval(updateNavStats, 3000);

  initialized = true;
  console.log('[NavStats] Initialized with live stats');
}

// ── Enhance Logo with ATLAS Symbol ───────────────────────────────────────

function enhanceLogo(): void {
  if (!headerLogo) return;

  // Replace with ATLAS logo (preserve img for logo.svg)
  headerLogo.innerHTML = `
    <div class="atlas-logo">
      <img src="/logo.svg" alt="ATLAS" class="atlas-logo-img" width="32" height="32" />
    </div>
  `;

  // Listen for data ticker health changes (apply pulse to logo container)
  const logoContainer = headerLogo.querySelector('.atlas-logo') as HTMLElement;
  if (logoContainer) {
    window.addEventListener('data:health-change', (e) => {
      const { healthy } = (e as CustomEvent).detail;
      if (healthy) {
        logoContainer.classList.add('pulse-healthy');
        logoContainer.classList.remove('pulse-warning');
      } else {
        logoContainer.classList.remove('pulse-healthy');
        logoContainer.classList.add('pulse-warning');
      }
    });
    logoContainer.classList.add('pulse-healthy');
  }
}

// ── Subscribe to Events ───────────────────────────────────────────────────

function subscribeToEvents(): void {
  // Listen for event rate updates from event stream panel
  window.addEventListener('event-stream:rate-update', (e) => {
    const { rate } = (e as CustomEvent).detail;
    eventRate = rate;
    updateNavStats();
  });

  // Listen for portfolio updates
  window.addEventListener('portfolio:update', () => {
    const snapshot = portfolioManager.getSnapshot();
    positionCount = snapshot.positions.length;
    updateNavStats();
  });

  // Listen for signal updates
  window.addEventListener('signals:update', () => {
    const signals = signalBus.getRecent(200).filter((s) => s.expiresAt > Date.now());
    activeSignals = signals.length;
    updateNavStats();
  });
}

// ── Update Nav Stats ──────────────────────────────────────────────────────

function updateNavStats(): void {
  updateGlobeTab();
  updateTradingTab();
}

function updateGlobeTab(): void {
  if (!globeTab) return;

  // Globe tab shows: "Globe • 32 sources • 4.2K/hr"
  const rateFormatted = eventRate >= 1000 ? `${(eventRate / 1000).toFixed(1)}K` : eventRate.toString();

  const statsHtml = `
    <span class="nav-tab-label">Globe</span>
    <span class="nav-tab-stats">
      <span class="nav-stat-dot">●</span>
      <span class="nav-stat-value">${sourceCount} sources</span>
      <span class="nav-stat-sep">•</span>
      <span class="nav-stat-value">${rateFormatted}/hr</span>
    </span>
  `;

  globeTab.innerHTML = statsHtml;
}

function updateTradingTab(): void {
  if (!tradingTab) return;

  // Get current portfolio snapshot
  const snapshot = portfolioManager.getSnapshot();
  positionCount = snapshot.positions.length;

  // Get active signals (non-expired)
  const signals = signalBus.getRecent(200).filter((s) => s.expiresAt > Date.now());
  activeSignals = signals.length;

  // Trading tab shows: "Trading • 3 signals • 2 pos"
  const statsHtml = `
    <span class="nav-tab-label">Trading</span>
    <span class="nav-tab-stats">
      <span class="nav-stat-dot">●</span>
      <span class="nav-stat-value">${activeSignals} signal${activeSignals !== 1 ? 's' : ''}</span>
      <span class="nav-stat-sep">•</span>
      <span class="nav-stat-value">${positionCount} pos</span>
    </span>
  `;

  tradingTab.innerHTML = statsHtml;
}

// ── Public API ────────────────────────────────────────────────────────────

export function updateEventRate(rate: number): void {
  eventRate = rate;
  updateGlobeTab();
}

export function updateSourceCount(count: number): void {
  sourceCount = count;
  updateGlobeTab();
}

export function cleanupNavStats(): void {
  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
  }

  initialized = false;
}
