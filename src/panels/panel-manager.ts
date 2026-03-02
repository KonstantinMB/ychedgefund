/**
 * Panel Manager
 * Core layout manager for the right-side intelligence panel system.
 * Handles collapse/expand, localStorage persistence, and panel registration.
 */

export interface PanelConfig {
  id: string;
  title: string;
  badge?: string;
  badgeClass?: string;
  defaultCollapsed?: boolean;
  /** Optional action button rendered in the panel header (e.g. "+ Trade") */
  headerAction?: { label: string; onClick: () => void };
  init: (container: HTMLElement) => void;
}

const STORAGE_KEY = 'atlas-panel-collapsed';

function loadCollapsedState(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCollapsedState(state: Record<string, boolean>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

const collapsedState: Record<string, boolean> = loadCollapsedState();

/**
 * Expand a panel by ID (updates persisted state and DOM if panel exists).
 */
export function forceExpand(panelId: string): void {
  collapsedState[panelId] = false;
  saveCollapsedState(collapsedState);

  const panel = document.querySelector(`[data-panel-id="${panelId}"]`);
  if (!panel) return;
  const body = panel.querySelector('.panel-body') as HTMLElement | null;
  const collapseBtn = panel.querySelector('.panel-collapse-btn') as HTMLElement | null;
  if (!body || !collapseBtn) return;
  if (!body.classList.contains('collapsed')) return;

  body.classList.remove('collapsed');
  body.style.maxHeight = body.scrollHeight + 'px';
  collapseBtn.textContent = '▲';
  collapseBtn.setAttribute('aria-expanded', 'true');
  collapseBtn.setAttribute('title', 'Collapse');
  body.addEventListener(
    'transitionend',
    () => {
      if (!body.classList.contains('collapsed')) body.style.maxHeight = 'none';
    },
    { once: true }
  );
}

export function createPanel(config: PanelConfig): HTMLElement {
  // If defaultCollapsed is explicitly false, never let stored state keep it collapsed
  const storedValue = collapsedState[config.id];
  const isCollapsed = config.defaultCollapsed === false
    ? false
    : (storedValue ?? config.defaultCollapsed ?? false);

  // Outer panel wrapper
  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.dataset.panelId = config.id;

  // ── Header ──────────────────────────────────────────────────────────────
  const header = document.createElement('div');
  header.className = 'panel-header';

  const titleSpan = document.createElement('span');
  titleSpan.className = 'panel-title';
  titleSpan.textContent = config.title;

  const controls = document.createElement('div');
  controls.className = 'panel-controls';

  if (config.headerAction) {
    const actionBtn = document.createElement('button');
    actionBtn.className = 'panel-header-action';
    actionBtn.textContent = config.headerAction.label;
    actionBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // don't collapse panel on click
      config.headerAction!.onClick();
    });
    controls.appendChild(actionBtn);
  }

  if (config.badge) {
    const badge = document.createElement('span');
    badge.className = `panel-badge ${config.badgeClass ?? ''}`.trim();
    badge.textContent = config.badge;
    controls.appendChild(badge);
  }

  const collapseBtn = document.createElement('button');
  collapseBtn.className = 'panel-collapse-btn';
  collapseBtn.title = isCollapsed ? 'Expand' : 'Collapse';
  collapseBtn.textContent = isCollapsed ? '▼' : '▲';
  collapseBtn.setAttribute('aria-expanded', String(!isCollapsed));
  controls.appendChild(collapseBtn);

  header.appendChild(titleSpan);
  header.appendChild(controls);

  // ── Body ────────────────────────────────────────────────────────────────
  const body = document.createElement('div');
  body.className = 'panel-body';

  if (isCollapsed) {
    body.classList.add('collapsed');
    body.style.maxHeight = '0px';
  } else {
    // Will be set after content is inserted
    body.style.maxHeight = 'none';
  }

  // ── Collapse / Expand Logic ──────────────────────────────────────────────
  const toggleCollapse = (): void => {
    const nowCollapsed = body.classList.contains('collapsed');

    if (nowCollapsed) {
      // Expand: remove collapsed, animate from 0 to scrollHeight
      body.classList.remove('collapsed');
      body.style.maxHeight = body.scrollHeight + 'px';
      collapseBtn.textContent = '▲';
      collapseBtn.title = 'Collapse';
      collapseBtn.setAttribute('aria-expanded', 'true');

      // After transition, allow free growth (content may change)
      body.addEventListener(
        'transitionend',
        () => {
          if (!body.classList.contains('collapsed')) {
            body.style.maxHeight = 'none';
          }
        },
        { once: true }
      );
    } else {
      // Collapse: lock height first so the transition has a from-value
      body.style.maxHeight = body.scrollHeight + 'px';
      // Force reflow
      body.getBoundingClientRect();
      body.classList.add('collapsed');
      body.style.maxHeight = '0px';
      collapseBtn.textContent = '▼';
      collapseBtn.title = 'Expand';
      collapseBtn.setAttribute('aria-expanded', 'false');
    }

    collapsedState[config.id] = !nowCollapsed;
    saveCollapsedState(collapsedState);
  };

  header.addEventListener('click', toggleCollapse);
  collapseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleCollapse();
  });

  // ── Assemble & Populate ─────────────────────────────────────────────────
  panel.appendChild(header);
  panel.appendChild(body);

  // Populate body — catch errors so a failing panel never blocks the rest
  try {
    config.init(body);
  } catch (err) {
    console.error(`[PanelManager] Panel "${config.id}" body init failed:`, err);
    body.innerHTML = `
      <div style="padding:1rem;font-size:0.68rem;color:#ef4444;font-family:monospace;">
        Panel failed to load.<br><small>${err instanceof Error ? err.message : String(err)}</small>
      </div>`;
  }

  return panel;
}

let rightPanelEl: HTMLElement | null = null;
let leftTradingPanelEl: HTMLElement | null = null;

/**
 * Initialize the panel manager. Must be called once before createPanel.
 */
export function initPanelManager(): void {
  rightPanelEl = document.getElementById('right-panel');
  if (!rightPanelEl) {
    console.error('[PanelManager] #right-panel element not found');
  }
  leftTradingPanelEl = document.getElementById('left-trading-panel');
}

/**
 * Register a panel with the manager and append it to #right-panel.
 */
export function registerPanel(config: PanelConfig): void {
  if (!rightPanelEl) {
    console.error('[PanelManager] initPanelManager() must be called first');
    return;
  }
  const panel = createPanel(config);
  rightPanelEl.appendChild(panel);
}

/**
 * Register a panel into the left sidebar trading section (#left-trading-panel).
 * Falls back to #right-panel if the left trading panel is not found.
 */
export function registerLeftPanel(config: PanelConfig): void {
  const target = leftTradingPanelEl ?? rightPanelEl;
  if (!target) {
    console.error('[PanelManager] No panel container found');
    return;
  }
  const panel = createPanel(config);
  target.appendChild(panel);
}
