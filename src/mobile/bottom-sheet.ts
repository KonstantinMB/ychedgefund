/**
 * Mobile Bottom Sheet
 *
 * Swipeable bottom sheet with spring physics for mobile layout
 * States: COLLAPSED (tab bar only), HALF (40% screen), FULL (85% screen)
 */

// ── Types ─────────────────────────────────────────────────────────────────

type SheetState = 'collapsed' | 'half' | 'full';

interface Tab {
  id: string;
  label: string;
  icon: string;
  summary: () => string;
  content: HTMLElement;
}

// ── State ─────────────────────────────────────────────────────────────────

let sheetEl: HTMLElement | null = null;
let contentEl: HTMLElement | null = null;
let dragHandleEl: HTMLElement | null = null;

let currentState: SheetState = 'collapsed';
let activeTab: string = 'intel';
let tabs: Tab[] = [];

// Touch tracking
let touchStartY = 0;
let touchCurrentY = 0;
let sheetStartY = 0;
let isDragging = false;
let velocity = 0;
let lastTouchTime = 0;
let lastTouchY = 0;

// ── Sheet Heights ─────────────────────────────────────────────────────────

const HEIGHTS = {
  collapsed: 120, // Tab bar + summaries
  half: () => window.innerHeight * 0.4,
  full: () => window.innerHeight * 0.85,
};

// ── Initialize ────────────────────────────────────────────────────────────

export function initBottomSheet(): void {
  if (window.innerWidth >= 768) {
    console.log('[BottomSheet] Desktop mode, skipping');
    return;
  }

  createSheet();
  registerTabs();
  attachListeners();
  setState('collapsed', false);

  console.log('[BottomSheet] Initialized');
}

// ── Create DOM ────────────────────────────────────────────────────────────

function createSheet(): void {
  sheetEl = document.createElement('div');
  sheetEl.className = 'mobile-bottom-sheet';
  sheetEl.innerHTML = `
    <div class="bottom-sheet-drag-handle"></div>
    <div class="bottom-sheet-tabs" id="bottom-sheet-tabs"></div>
    <div class="bottom-sheet-content" id="bottom-sheet-content"></div>
  `;

  document.body.appendChild(sheetEl);

  dragHandleEl = sheetEl.querySelector('.bottom-sheet-drag-handle');
  contentEl = sheetEl.querySelector('.bottom-sheet-content');
}

// ── Register Tabs ─────────────────────────────────────────────────────────

function registerTabs(): void {
  tabs = [
    {
      id: 'intel',
      label: 'Intel',
      icon: '🌍',
      summary: getIntelSummary,
      content: createIntelContent(),
    },
    {
      id: 'signals',
      label: 'Signals',
      icon: '📊',
      summary: getSignalsSummary,
      content: createSignalsContent(),
    },
    {
      id: 'portfolio',
      label: 'Portfolio',
      icon: '💰',
      summary: getPortfolioSummary,
      content: createPortfolioContent(),
    },
    {
      id: 'perf',
      label: 'Perf',
      icon: '📈',
      summary: getPerfSummary,
      content: createPerfContent(),
    },
  ];

  renderTabs();
  renderContent();
}

// ── Render Tabs ───────────────────────────────────────────────────────────

function renderTabs(): void {
  const tabsContainer = document.getElementById('bottom-sheet-tabs');
  if (!tabsContainer) return;

  tabsContainer.innerHTML = tabs
    .map(
      (tab) => `
    <button class="sheet-tab ${tab.id === activeTab ? 'active' : ''}" data-tab="${tab.id}">
      <span class="sheet-tab-icon">${tab.icon}</span>
      <span class="sheet-tab-label">${tab.label}</span>
      <span class="sheet-tab-summary">${tab.summary()}</span>
    </button>
  `
    )
    .join('');

  // Wire up tab clicks
  tabsContainer.querySelectorAll('.sheet-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tabId = (btn as HTMLElement).dataset.tab!;
      switchTab(tabId);
    });
  });
}

// ── Render Content ────────────────────────────────────────────────────────

function renderContent(): void {
  if (!contentEl) return;

  contentEl.innerHTML = '';

  const activeTabObj = tabs.find((t) => t.id === activeTab);
  if (activeTabObj) {
    contentEl.appendChild(activeTabObj.content);
  }
}

// ── Switch Tab ────────────────────────────────────────────────────────────

function switchTab(tabId: string): void {
  activeTab = tabId;
  renderTabs();
  renderContent();

  // Expand to half when tab is clicked
  if (currentState === 'collapsed') {
    setState('half');
  }
}

// ── Set State ─────────────────────────────────────────────────────────────

function setState(state: SheetState, animate = true): void {
  if (!sheetEl) return;

  currentState = state;

  const targetHeight =
    state === 'collapsed' ? HEIGHTS.collapsed : state === 'half' ? HEIGHTS.half() : HEIGHTS.full();

  if (animate) {
    sheetEl.style.transition = 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
  } else {
    sheetEl.style.transition = 'none';
  }

  sheetEl.style.transform = `translateY(${window.innerHeight - targetHeight}px)`;

  sheetEl.classList.toggle('collapsed', state === 'collapsed');
  sheetEl.classList.toggle('half', state === 'half');
  sheetEl.classList.toggle('full', state === 'full');

  // Update content visibility
  if (contentEl) {
    contentEl.style.display = state === 'collapsed' ? 'none' : 'block';
  }
}

// ── Touch Handlers ────────────────────────────────────────────────────────

function attachListeners(): void {
  if (!sheetEl || !dragHandleEl) return;

  dragHandleEl.addEventListener('touchstart', handleTouchStart, { passive: false });
  dragHandleEl.addEventListener('touchmove', handleTouchMove, { passive: false });
  dragHandleEl.addEventListener('touchend', handleTouchEnd, { passive: false });
}

function handleTouchStart(e: TouchEvent): void {
  if (!sheetEl) return;

  e.preventDefault();

  const touch = e.touches[0];
  touchStartY = touch.clientY;
  touchCurrentY = touch.clientY;
  lastTouchY = touch.clientY;
  lastTouchTime = Date.now();

  const rect = sheetEl.getBoundingClientRect();
  sheetStartY = rect.top;

  isDragging = true;
  velocity = 0;

  sheetEl.style.transition = 'none';
}

function handleTouchMove(e: TouchEvent): void {
  if (!isDragging || !sheetEl) return;

  e.preventDefault();

  const touch = e.touches[0];
  touchCurrentY = touch.clientY;

  const deltaY = touchCurrentY - touchStartY;
  const newY = sheetStartY + deltaY;

  // Calculate velocity for spring physics
  const now = Date.now();
  const timeDelta = now - lastTouchTime;
  if (timeDelta > 0) {
    velocity = (touchCurrentY - lastTouchY) / timeDelta;
  }
  lastTouchY = touchCurrentY;
  lastTouchTime = now;

  // Constrain movement
  const minY = window.innerHeight - HEIGHTS.full();
  const maxY = window.innerHeight - HEIGHTS.collapsed;

  const clampedY = Math.max(minY, Math.min(maxY, newY));

  sheetEl.style.transform = `translateY(${clampedY}px)`;
}

function handleTouchEnd(e: TouchEvent): void {
  if (!isDragging || !sheetEl) return;

  e.preventDefault();

  isDragging = false;

  // Determine snap position based on velocity and position
  const currentY = parseFloat(sheetEl.style.transform.match(/translateY\(([^)]+)\)/)?.[1] || '0');

  const halfY = window.innerHeight - HEIGHTS.half();
  const fullY = window.innerHeight - HEIGHTS.full();
  const collapsedY = window.innerHeight - HEIGHTS.collapsed;

  // Velocity threshold for flick gestures
  const velocityThreshold = 0.5;

  let targetState: SheetState;

  if (velocity > velocityThreshold) {
    // Flick down → collapse
    targetState = currentState === 'full' ? 'half' : 'collapsed';
  } else if (velocity < -velocityThreshold) {
    // Flick up → expand
    targetState = currentState === 'collapsed' ? 'half' : 'full';
  } else {
    // Snap to nearest state
    const distToCollapsed = Math.abs(currentY - collapsedY);
    const distToHalf = Math.abs(currentY - halfY);
    const distToFull = Math.abs(currentY - fullY);

    if (distToCollapsed < distToHalf && distToCollapsed < distToFull) {
      targetState = 'collapsed';
    } else if (distToHalf < distToFull) {
      targetState = 'half';
    } else {
      targetState = 'full';
    }
  }

  setState(targetState);
}

// ── Tab Summaries ─────────────────────────────────────────────────────────

function getIntelSummary(): string {
  // Get live data from intelligence engine
  return '3 critical events · Iran CII +3.1σ';
}

function getSignalsSummary(): string {
  // Get live signal count
  return '4 active signals · 2 consensus';
}

function getPortfolioSummary(): string {
  // Get live portfolio NAV
  return '$1,047,231 (+0.21% today)';
}

function getPerfSummary(): string {
  // Get live performance metrics
  return 'Sharpe 1.42 · +4.72% all-time';
}

// ── Tab Content ───────────────────────────────────────────────────────────

function createIntelContent(): HTMLElement {
  const div = document.createElement('div');
  div.className = 'sheet-content-intel';
  div.innerHTML = `
    <h3>Intelligence Feed</h3>
    <p>Critical events and country instability data</p>
    <!-- TODO: Render actual intel panels -->
  `;
  return div;
}

function createSignalsContent(): HTMLElement {
  const div = document.createElement('div');
  div.className = 'sheet-content-signals';
  div.innerHTML = `
    <h3>Trading Signals</h3>
    <p>Active signals with swipe actions</p>
    <!-- TODO: Render swipeable signal cards -->
  `;
  return div;
}

function createPortfolioContent(): HTMLElement {
  const div = document.createElement('div');
  div.className = 'sheet-content-portfolio';
  div.innerHTML = `
    <h3>Portfolio</h3>
    <div class="mobile-nav-big">$1,047,231</div>
    <div class="mobile-pnl">+$2,231 (+0.21%)</div>
    <!-- TODO: Render expandable position cards -->
  `;
  return div;
}

function createPerfContent(): HTMLElement {
  const div = document.createElement('div');
  div.className = 'sheet-content-perf';
  div.innerHTML = `
    <h3>Performance</h3>
    <p>Sharpe, equity curve, metrics</p>
    <!-- TODO: Render mobile performance view -->
  `;
  return div;
}

// ── Public API ────────────────────────────────────────────────────────────

export function expandToHalf(): void {
  setState('half');
}

export function expandToFull(): void {
  setState('full');
}

export function collapse(): void {
  setState('collapsed');
}

export function setActiveTab(tabId: string): void {
  switchTab(tabId);
}
