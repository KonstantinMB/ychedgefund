/**
 * Circuit Breaker State Transition Animations
 *
 * GREEN → YELLOW: Panel borders gold → amber (1s), status text fades
 * YELLOW → RED: Amber → red with screen-edge flash, buttons pulse then disable
 * RED → BLACK: Red → crimson, nav bar red accent, emergency modal
 */

type CircuitBreakerState = 'GREEN' | 'YELLOW' | 'RED' | 'BLACK';

// ── State ─────────────────────────────────────────────────────────────────

let currentState: CircuitBreakerState = 'GREEN';
let initialized = false;

// ── Initialize ────────────────────────────────────────────────────────────

export function initCircuitBreakerTransitions(): void {
  if (initialized) return;

  // Listen for risk status changes
  window.addEventListener('trading:riskStatus', (e) => {
    const { circuitBreakerState } = (e as CustomEvent).detail;
    if (circuitBreakerState && circuitBreakerState !== currentState) {
      transitionTo(circuitBreakerState);
    }
  });

  initialized = true;
  console.log('[CircuitBreakerTransitions] Initialized');
}

// ── Main Transition Logic ─────────────────────────────────────────────────

function transitionTo(newState: CircuitBreakerState): void {
  console.log(`[CircuitBreakerTransitions] ${currentState} → ${newState}`);

  const transition = `${currentState}_TO_${newState}`;

  switch (transition) {
    case 'GREEN_TO_YELLOW':
      transitionGreenToYellow();
      break;
    case 'YELLOW_TO_RED':
      transitionYellowToRed();
      break;
    case 'RED_TO_BLACK':
      transitionRedToBlack();
      break;
    case 'YELLOW_TO_GREEN':
      transitionYellowToGreen();
      break;
    case 'RED_TO_YELLOW':
      transitionRedToYellow();
      break;
    case 'BLACK_TO_RED':
      transitionBlackToRed();
      break;
    default:
      console.warn(`[CircuitBreakerTransitions] Unknown transition: ${transition}`);
  }

  currentState = newState;
}

// ── GREEN → YELLOW ────────────────────────────────────────────────────────

function transitionGreenToYellow(): void {
  const portfolioPanel = document.querySelector('[data-panel-id="portfolio"]') as HTMLElement;
  if (!portfolioPanel) return;

  // Shift panel border from gold to amber over 1s
  portfolioPanel.style.transition = 'border-color 1s ease-out';
  portfolioPanel.style.borderColor = '#FFB300'; // Amber

  // Update status text
  updateStatusText('⚠ CAUTION — Reduced Sizing', 'yellow');

  // Add yellow state class
  document.body.classList.remove('cb-green');
  document.body.classList.add('cb-yellow');

  console.log('[CircuitBreakerTransitions] GREEN → YELLOW: Reduced position sizing active');
}

// ── YELLOW → RED ──────────────────────────────────────────────────────────

function transitionYellowToRed(): void {
  const portfolioPanel = document.querySelector('[data-panel-id="portfolio"]') as HTMLElement;
  if (!portfolioPanel) return;

  // Amber → red transition
  portfolioPanel.style.transition = 'border-color 0.8s ease-out';
  portfolioPanel.style.borderColor = 'var(--signal-negative)';

  // Screen-edge flash
  flashScreenEdge('#FF1744');

  // Update status text
  updateStatusText('🔴 HALTED — Daily Loss Limit Reached', 'red');

  // Pulse all trade buttons red, then disable
  const tradeButtons = document.querySelectorAll(
    '.sig-v2-trade-btn, .port-v2-close-btn, .context-menu-item[data-action*="trade"]'
  );

  tradeButtons.forEach((btn) => {
    (btn as HTMLElement).classList.add('btn-pulse-red');

    setTimeout(() => {
      (btn as HTMLElement).classList.remove('btn-pulse-red');
      (btn as HTMLElement).classList.add('btn-disabled');
      (btn as HTMLButtonElement).disabled = true;
    }, 1500);
  });

  // Update body class
  document.body.classList.remove('cb-yellow');
  document.body.classList.add('cb-red');

  console.log('[CircuitBreakerTransitions] YELLOW → RED: All trading halted');
}

// ── RED → BLACK ───────────────────────────────────────────────────────────

function transitionRedToBlack(): void {
  const portfolioPanel = document.querySelector('[data-panel-id="portfolio"]') as HTMLElement;
  const navBar = document.querySelector('.header-bar') as HTMLElement;

  if (portfolioPanel) {
    // Red → deep crimson
    portfolioPanel.style.transition = 'border-color 1s ease-out, background 1s ease-out';
    portfolioPanel.style.borderColor = '#8B0000'; // Deep crimson
    portfolioPanel.style.background = 'rgba(139, 0, 0, 0.05)';
  }

  if (navBar) {
    // Nav bar gets red accent
    navBar.style.transition = 'border-bottom 1s ease-out';
    navBar.style.borderBottom = '2px solid #8B0000';
  }

  // Screen-edge flash (darker red)
  flashScreenEdge('#8B0000');

  // Update status text
  updateStatusText('⬛ EMERGENCY — Drawdown Limit · Flattening Recommended', 'black');

  // Show emergency modal
  showEmergencyModal();

  // Update body class
  document.body.classList.remove('cb-red');
  document.body.classList.add('cb-black');

  console.log('[CircuitBreakerTransitions] RED → BLACK: Emergency drawdown limit exceeded');
}

// ── Reverse Transitions (Recovery) ───────────────────────────────────────

function transitionYellowToGreen(): void {
  const portfolioPanel = document.querySelector('[data-panel-id="portfolio"]') as HTMLElement;
  if (portfolioPanel) {
    portfolioPanel.style.transition = 'border-color 1s ease-out';
    portfolioPanel.style.borderColor = 'var(--text-accent)';
  }

  updateStatusText('✓ NORMAL', 'green');

  document.body.classList.remove('cb-yellow');
  document.body.classList.add('cb-green');

  console.log('[CircuitBreakerTransitions] YELLOW → GREEN: Normal trading resumed');
}

function transitionRedToYellow(): void {
  const portfolioPanel = document.querySelector('[data-panel-id="portfolio"]') as HTMLElement;
  if (portfolioPanel) {
    portfolioPanel.style.transition = 'border-color 1s ease-out';
    portfolioPanel.style.borderColor = '#FFB300';
  }

  updateStatusText('⚠ CAUTION — Reduced Sizing', 'yellow');

  // Re-enable trade buttons
  const tradeButtons = document.querySelectorAll('.btn-disabled');
  tradeButtons.forEach((btn) => {
    (btn as HTMLElement).classList.remove('btn-disabled');
    (btn as HTMLButtonElement).disabled = false;
  });

  document.body.classList.remove('cb-red');
  document.body.classList.add('cb-yellow');

  console.log('[CircuitBreakerTransitions] RED → YELLOW: Caution mode');
}

function transitionBlackToRed(): void {
  const portfolioPanel = document.querySelector('[data-panel-id="portfolio"]') as HTMLElement;
  const navBar = document.querySelector('.header-bar') as HTMLElement;

  if (portfolioPanel) {
    portfolioPanel.style.borderColor = 'var(--signal-negative)';
    portfolioPanel.style.background = '';
  }

  if (navBar) {
    navBar.style.borderBottom = '';
  }

  updateStatusText('🔴 HALTED — Daily Loss Limit Reached', 'red');

  document.body.classList.remove('cb-black');
  document.body.classList.add('cb-red');

  console.log('[CircuitBreakerTransitions] BLACK → RED: Returned to halted state');
}

// ── Helper Functions ──────────────────────────────────────────────────────

function updateStatusText(text: string, level: 'green' | 'yellow' | 'red' | 'black'): void {
  const statusEl = document.querySelector('.port-v2-risk-status, .cb-status-text') as HTMLElement;
  if (!statusEl) return;

  statusEl.style.transition = 'opacity 0.3s ease-out';
  statusEl.style.opacity = '0';

  setTimeout(() => {
    statusEl.textContent = text;
    statusEl.className = `cb-status-text cb-status-${level}`;
    statusEl.style.opacity = '1';
  }, 300);
}

function flashScreenEdge(color: string): void {
  const flash = document.createElement('div');
  flash.className = 'screen-edge-flash';
  flash.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
    z-index: 9998;
    border: 4px solid ${color};
    opacity: 0;
    animation: screen-flash 0.8s ease-out;
  `;
  document.body.appendChild(flash);

  setTimeout(() => {
    flash.remove();
  }, 800);
}

function showEmergencyModal(): void {
  const modal = document.createElement('div');
  modal.className = 'emergency-modal-backdrop';
  modal.innerHTML = `
    <div class="emergency-modal">
      <div class="emergency-modal-header">
        <span class="emergency-icon">⚠️</span>
        <span class="emergency-title">EMERGENCY RISK LIMIT</span>
      </div>
      <div class="emergency-modal-body">
        <p>Portfolio drawdown exceeded <strong>15%</strong>.</p>
        <p>System recommends flattening <strong>50% of positions</strong> to reduce exposure.</p>
      </div>
      <div class="emergency-modal-actions">
        <button class="emergency-btn emergency-btn-primary" id="emergency-flatten">
          FLATTEN 50%
        </button>
        <button class="emergency-btn emergency-btn-secondary" id="emergency-ack">
          ACKNOWLEDGE & CONTINUE
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Wire up buttons
  document.getElementById('emergency-flatten')?.addEventListener('click', () => {
    console.log('[CircuitBreakerTransitions] Emergency: Flattening 50%');
    // TODO: Trigger actual flatten logic
    modal.remove();
  });

  document.getElementById('emergency-ack')?.addEventListener('click', () => {
    console.log('[CircuitBreakerTransitions] Emergency: User acknowledged');
    modal.remove();
  });
}

// ── CSS Injection ─────────────────────────────────────────────────────────

function injectStyles(): void {
  const styleId = 'circuit-breaker-transition-styles';
  if (document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    /* Body state classes */
    body.cb-yellow {
      --cb-color: #FFB300;
    }

    body.cb-red {
      --cb-color: var(--signal-negative);
    }

    body.cb-black {
      --cb-color: #8B0000;
    }

    /* Button pulse animation */
    .btn-pulse-red {
      animation: btn-pulse-red-anim 1.5s ease-in-out;
    }

    @keyframes btn-pulse-red-anim {
      0%, 100% {
        box-shadow: 0 0 0 0 rgba(255, 23, 68, 0.7);
        border-color: var(--signal-negative);
      }
      50% {
        box-shadow: 0 0 0 8px rgba(255, 23, 68, 0);
        border-color: var(--signal-negative);
      }
    }

    .btn-disabled {
      opacity: 0.5;
      cursor: not-allowed !important;
      pointer-events: none;
    }

    /* Screen flash */
    @keyframes screen-flash {
      0% {
        opacity: 0;
      }
      30% {
        opacity: 1;
      }
      100% {
        opacity: 0;
      }
    }

    /* Emergency modal */
    .emergency-modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(8px);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: modal-fade-in 0.3s ease-out;
    }

    @keyframes modal-fade-in {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    .emergency-modal {
      width: 480px;
      max-width: 90%;
      background: var(--surface-elevated);
      border: 2px solid #8B0000;
      border-radius: 12px;
      box-shadow: 0 0 40px rgba(139, 0, 0, 0.5), var(--shadow-xl);
      animation: modal-scale-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    @keyframes modal-scale-in {
      from {
        transform: scale(0.9);
        opacity: 0;
      }
      to {
        transform: scale(1);
        opacity: 1;
      }
    }

    .emergency-modal-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 20px 24px;
      border-bottom: 1px solid var(--border-medium);
      background: rgba(139, 0, 0, 0.1);
    }

    .emergency-icon {
      font-size: 32px;
      animation: emergency-icon-pulse 1.5s ease-in-out infinite;
    }

    @keyframes emergency-icon-pulse {
      0%, 100% {
        transform: scale(1);
      }
      50% {
        transform: scale(1.1);
      }
    }

    .emergency-title {
      font-family: var(--font-ui);
      font-size: 18px;
      font-weight: var(--font-bold);
      color: #FF1744;
      letter-spacing: 0.05em;
    }

    .emergency-modal-body {
      padding: 24px;
      font-family: var(--font-ui);
      font-size: 14px;
      line-height: 1.6;
      color: var(--text-secondary);
    }

    .emergency-modal-body p {
      margin: 0 0 12px 0;
    }

    .emergency-modal-body strong {
      color: var(--text-primary);
      font-weight: var(--font-semibold);
    }

    .emergency-modal-actions {
      display: flex;
      gap: 12px;
      padding: 20px 24px;
      border-top: 1px solid var(--border-medium);
    }

    .emergency-btn {
      flex: 1;
      padding: 12px 20px;
      font-family: var(--font-mono);
      font-size: 13px;
      font-weight: var(--font-semibold);
      letter-spacing: 0.05em;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s ease;
      border: 1px solid transparent;
    }

    .emergency-btn-primary {
      background: #FF1744;
      color: white;
      border-color: #FF1744;
    }

    .emergency-btn-primary:hover {
      background: #D50032;
      box-shadow: 0 0 16px rgba(255, 23, 68, 0.4);
    }

    .emergency-btn-secondary {
      background: var(--surface-raised);
      color: var(--text-primary);
      border-color: var(--border-medium);
    }

    .emergency-btn-secondary:hover {
      background: var(--surface-elevated);
      border-color: var(--text-accent);
    }

    /* Status text styles */
    .cb-status-text {
      font-family: var(--font-mono);
      font-size: 12px;
      font-weight: var(--font-semibold);
      padding: 6px 12px;
      border-radius: 4px;
      display: inline-block;
    }

    .cb-status-green {
      color: var(--signal-positive);
      background: rgba(74, 222, 128, 0.1);
    }

    .cb-status-yellow {
      color: #FFB300;
      background: rgba(255, 179, 0, 0.1);
    }

    .cb-status-red {
      color: var(--signal-negative);
      background: rgba(255, 23, 68, 0.1);
    }

    .cb-status-black {
      color: #8B0000;
      background: rgba(139, 0, 0, 0.1);
    }
  `;
  document.head.appendChild(style);
}

// Auto-inject styles
injectStyles();
