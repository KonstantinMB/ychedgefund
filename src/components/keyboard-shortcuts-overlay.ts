/**
 * Keyboard Shortcuts Overlay
 * Press "?" to show beautiful shortcut reference
 */

// ── State ─────────────────────────────────────────────────────────────────

let overlayEl: HTMLElement | null = null;
let isOpen = false;

// ── Initialize ────────────────────────────────────────────────────────────

export function initKeyboardShortcutsOverlay(): void {
  createOverlay();

  // Listen for "?" key
  document.addEventListener('keydown', (e) => {
    // Ignore if user is typing
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    // Ignore if modifiers pressed
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    if (e.key === '?' || (e.shiftKey && e.key === '/')) {
      e.preventDefault();
      toggle();
    }

    // Escape to close
    if (e.key === 'Escape' && isOpen) {
      e.preventDefault();
      close();
    }
  });

  console.log('[KeyboardShortcuts] Press "?" to view shortcuts');
}

// ── Create Overlay ────────────────────────────────────────────────────────

function createOverlay(): void {
  overlayEl = document.createElement('div');
  overlayEl.className = 'keyboard-shortcuts-overlay';
  overlayEl.style.display = 'none';

  overlayEl.innerHTML = `
    <div class="shortcuts-backdrop"></div>
    <div class="shortcuts-panel">
      <div class="shortcuts-header">
        <span class="shortcuts-title">ATLAS KEYBOARD SHORTCUTS</span>
        <button class="shortcuts-close" aria-label="Close">✕</button>
      </div>

      <div class="shortcuts-body">
        <div class="shortcuts-section">
          <div class="shortcuts-section-title">NAVIGATION</div>
          <div class="shortcuts-list">
            <div class="shortcut-item">
              <kbd class="shortcut-key">G</kbd>
              <span class="shortcut-desc">Globe view</span>
            </div>
            <div class="shortcut-item">
              <kbd class="shortcut-key">T</kbd>
              <span class="shortcut-desc">Trading view</span>
            </div>
            <div class="shortcut-item">
              <kbd class="shortcut-key">P</kbd>
              <span class="shortcut-desc">Performance view</span>
            </div>
            <div class="shortcut-item">
              <kbd class="shortcut-key">D</kbd>
              <span class="shortcut-desc">Data health view</span>
            </div>
          </div>
        </div>

        <div class="shortcuts-section">
          <div class="shortcuts-section-title">TRADING</div>
          <div class="shortcuts-list">
            <div class="shortcut-item">
              <kbd class="shortcut-key">Space</kbd>
              <span class="shortcut-desc">Toggle auto-trade</span>
            </div>
            <div class="shortcut-item">
              <kbd class="shortcut-key">Esc</kbd>
              <span class="shortcut-desc">Kill switch (halt all trading)</span>
            </div>
            <div class="shortcut-item">
              <kbd class="shortcut-key">F</kbd>
              <span class="shortcut-desc">Flatten all positions</span>
            </div>
          </div>
        </div>

        <div class="shortcuts-section">
          <div class="shortcuts-section-title">GLOBE</div>
          <div class="shortcuts-list">
            <div class="shortcut-item">
              <kbd class="shortcut-key">1</kbd>
              <span class="shortcut-desc">Zoom: Global view</span>
            </div>
            <div class="shortcut-item">
              <kbd class="shortcut-key">2</kbd>
              <span class="shortcut-desc">Zoom: Continental</span>
            </div>
            <div class="shortcut-item">
              <kbd class="shortcut-key">3</kbd>
              <span class="shortcut-desc">Zoom: Regional</span>
            </div>
            <div class="shortcut-item">
              <kbd class="shortcut-key">L</kbd>
              <span class="shortcut-desc">Toggle layer panel</span>
            </div>
            <div class="shortcut-item">
              <kbd class="shortcut-key">R</kbd>
              <span class="shortcut-desc">Reset camera</span>
            </div>
          </div>
        </div>

        <div class="shortcuts-section">
          <div class="shortcuts-section-title">GENERAL</div>
          <div class="shortcuts-list">
            <div class="shortcut-item">
              <kbd class="shortcut-key">⌘K</kbd>
              <span class="shortcut-desc">Command palette</span>
            </div>
            <div class="shortcut-item">
              <kbd class="shortcut-key">S</kbd>
              <span class="shortcut-desc">Toggle signals panel</span>
            </div>
            <div class="shortcut-item">
              <kbd class="shortcut-key">?</kbd>
              <span class="shortcut-desc">This help</span>
            </div>
          </div>
        </div>
      </div>

      <div class="shortcuts-footer">
        <span class="shortcuts-hint">Press <kbd>Esc</kbd> to close</span>
      </div>
    </div>
  `;

  document.body.appendChild(overlayEl);

  // Wire up close button
  const closeBtn = overlayEl.querySelector('.shortcuts-close');
  closeBtn?.addEventListener('click', close);

  // Click backdrop to close
  const backdrop = overlayEl.querySelector('.shortcuts-backdrop');
  backdrop?.addEventListener('click', close);
}

// ── Toggle/Open/Close ─────────────────────────────────────────────────────

export function toggle(): void {
  if (isOpen) {
    close();
  } else {
    open();
  }
}

export function open(): void {
  if (!overlayEl || isOpen) return;

  overlayEl.style.display = 'flex';

  requestAnimationFrame(() => {
    overlayEl!.classList.add('shortcuts-open');
  });

  isOpen = true;
}

export function close(): void {
  if (!overlayEl || !isOpen) return;

  overlayEl.classList.remove('shortcuts-open');

  setTimeout(() => {
    overlayEl!.style.display = 'none';
  }, 200);

  isOpen = false;
}

// ── CSS Injection ─────────────────────────────────────────────────────────

function injectStyles(): void {
  const styleId = 'keyboard-shortcuts-overlay-styles';
  if (document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    /* Overlay backdrop */
    .keyboard-shortcuts-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 10000;
      display: none;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.2s ease-out;
    }

    .keyboard-shortcuts-overlay.shortcuts-open {
      opacity: 1;
    }

    .shortcuts-backdrop {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(8px);
    }

    /* Main panel */
    .shortcuts-panel {
      position: relative;
      width: 700px;
      max-width: 90%;
      max-height: 80vh;
      background: var(--surface-elevated);
      border: 1px solid var(--border-medium);
      border-radius: 12px;
      box-shadow: var(--shadow-xl);
      transform: scale(0.95);
      transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
      display: flex;
      flex-direction: column;
    }

    .keyboard-shortcuts-overlay.shortcuts-open .shortcuts-panel {
      transform: scale(1);
    }

    /* Header */
    .shortcuts-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px 24px;
      border-bottom: 1px solid var(--border-medium);
    }

    .shortcuts-title {
      font-family: var(--font-ui);
      font-size: 16px;
      font-weight: var(--font-bold);
      letter-spacing: 0.08em;
      color: var(--text-primary);
    }

    .shortcuts-close {
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: none;
      color: var(--text-tertiary);
      font-size: 20px;
      cursor: pointer;
      border-radius: 4px;
      transition: all 0.2s ease;
    }

    .shortcuts-close:hover {
      background: var(--surface-raised);
      color: var(--text-primary);
    }

    /* Body */
    .shortcuts-body {
      flex: 1;
      padding: 24px;
      overflow-y: auto;
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 24px;
    }

    .shortcuts-section {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .shortcuts-section-title {
      font-family: var(--font-ui);
      font-size: 11px;
      font-weight: var(--font-semibold);
      letter-spacing: 0.1em;
      color: var(--text-accent);
      margin-bottom: 4px;
    }

    .shortcuts-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .shortcut-item {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .shortcut-key {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 50px;
      padding: 4px 10px;
      font-family: var(--font-mono);
      font-size: 13px;
      font-weight: var(--font-semibold);
      color: var(--text-primary);
      background: var(--surface-raised);
      border: 1px solid var(--border-medium);
      border-radius: 4px;
      box-shadow: 0 2px 0 var(--border-subtle);
    }

    .shortcut-desc {
      font-family: var(--font-ui);
      font-size: 13px;
      color: var(--text-secondary);
    }

    /* Footer */
    .shortcuts-footer {
      padding: 16px 24px;
      border-top: 1px solid var(--border-medium);
      text-align: center;
    }

    .shortcuts-hint {
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--text-tertiary);
    }

    .shortcuts-hint kbd {
      display: inline-flex;
      padding: 2px 6px;
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--text-accent);
      background: var(--surface-raised);
      border: 1px solid var(--border-subtle);
      border-radius: 3px;
      margin: 0 4px;
    }

    /* Mobile responsive */
    @media (max-width: 768px) {
      .shortcuts-panel {
        width: 95%;
        max-height: 90vh;
      }

      .shortcuts-body {
        grid-template-columns: 1fr;
        gap: 20px;
        padding: 20px;
      }

      .shortcuts-header {
        padding: 16px 20px;
      }

      .shortcuts-title {
        font-size: 14px;
      }
    }
  `;
  document.head.appendChild(style);
}

// Auto-inject styles
injectStyles();
