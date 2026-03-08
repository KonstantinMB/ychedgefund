/**
 * Signal → Trade → Portfolio Flow Animation
 *
 * When a signal auto-executes:
 * 1. Signal card glows brighter for 1s
 * 2. Particle animates from signal card to portfolio panel
 * 3. Portfolio NAV/P&L update with flash
 * 4. If geopolitical: globe highlights event location
 * 5. Toast notification
 *
 * Total duration: ~2 seconds
 */

// ── Types ─────────────────────────────────────────────────────────────────

interface TradeExecution {
  signalId: string;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  quantity: number;
  price: number;
  strategy: string;
  location?: [number, number]; // For geopolitical signals
}

// ── State ─────────────────────────────────────────────────────────────────

let initialized = false;

// ── Initialize ────────────────────────────────────────────────────────────

export function initTradeFlowAnimation(): void {
  if (initialized) return;

  // Listen for trade execution events
  window.addEventListener('trading:executed', (e) => {
    const trade = (e as CustomEvent<TradeExecution>).detail;
    playTradeFlowAnimation(trade);
  });

  initialized = true;
  console.log('[TradeFlowAnimation] Initialized');
}

// ── Main Flow ─────────────────────────────────────────────────────────────

async function playTradeFlowAnimation(trade: TradeExecution): Promise<void> {
  // Step 1: Signal card glow (0ms)
  glowSignalCard(trade.signalId);

  // Step 2: Particle animation (200ms delay)
  setTimeout(() => {
    animateParticle(trade);
  }, 200);

  // Step 3: Portfolio flash (1200ms delay, when particle arrives)
  setTimeout(() => {
    flashPortfolio();
  }, 1200);

  // Step 4: Globe highlight (if geopolitical, 400ms delay)
  if (trade.location && trade.strategy.includes('geopolitical')) {
    setTimeout(() => {
      flashGlobeLocation(trade.location!);
    }, 400);
  }

  // Step 5: Toast notification (800ms delay)
  setTimeout(() => {
    showTradeToast(trade);
  }, 800);
}

// ── Step 1: Signal Card Glow ──────────────────────────────────────────────

function glowSignalCard(signalId: string): void {
  const signalCard = document.querySelector(`[data-signal-id="${signalId}"]`) as HTMLElement;
  if (!signalCard) return;

  signalCard.classList.add('signal-executing');

  setTimeout(() => {
    signalCard.classList.remove('signal-executing');
  }, 1000);
}

// ── Step 2: Particle Animation ────────────────────────────────────────────

function animateParticle(trade: TradeExecution): void {
  const signalCard = document.querySelector(`[data-signal-id="${trade.signalId}"]`) as HTMLElement;
  const portfolioPanel = document.querySelector('[data-panel-id="portfolio"]') as HTMLElement;

  if (!signalCard || !portfolioPanel) {
    console.warn('[TradeFlowAnimation] Cannot find signal card or portfolio panel');
    return;
  }

  // Create particle element
  const particle = document.createElement('div');
  particle.className = 'trade-flow-particle';
  particle.innerHTML = `
    <div class="particle-inner">
      <span class="particle-icon">${trade.direction === 'LONG' ? '📈' : '📉'}</span>
      <span class="particle-symbol">${trade.symbol}</span>
    </div>
  `;
  document.body.appendChild(particle);

  // Get start and end positions
  const startRect = signalCard.getBoundingClientRect();
  const endRect = portfolioPanel.getBoundingClientRect();

  const startX = startRect.right;
  const startY = startRect.top + startRect.height / 2;
  const endX = endRect.left;
  const endY = endRect.top + endRect.height / 2;

  // Set initial position
  particle.style.left = `${startX}px`;
  particle.style.top = `${startY}px`;

  // Trigger animation
  requestAnimationFrame(() => {
    particle.classList.add('animating');
    particle.style.left = `${endX}px`;
    particle.style.top = `${endY}px`;
  });

  // Remove particle after animation
  setTimeout(() => {
    particle.classList.add('arriving');
    setTimeout(() => {
      particle.remove();
    }, 300);
  }, 1000);
}

// ── Step 3: Portfolio Flash ───────────────────────────────────────────────

function flashPortfolio(): void {
  const portfolioPanel = document.querySelector('[data-panel-id="portfolio"]') as HTMLElement;
  if (!portfolioPanel) return;

  portfolioPanel.classList.add('portfolio-flash');

  setTimeout(() => {
    portfolioPanel.classList.remove('portfolio-flash');
  }, 600);

  // Flash NAV and P&L values (they'll use number animation automatically)
  const navEl = portfolioPanel.querySelector('.port-v2-nav-value') as HTMLElement;
  const pnlEl = portfolioPanel.querySelector('.port-v2-pnl-value') as HTMLElement;

  if (navEl) {
    navEl.classList.add('value-flash');
    setTimeout(() => navEl.classList.remove('value-flash'), 400);
  }

  if (pnlEl) {
    pnlEl.classList.add('value-flash');
    setTimeout(() => pnlEl.classList.remove('value-flash'), 400);
  }
}

// ── Step 4: Globe Location Flash ──────────────────────────────────────────

function flashGlobeLocation(location: [number, number]): void {
  window.dispatchEvent(
    new CustomEvent('globe:signal-flash', {
      detail: {
        longitude: location[0],
        latitude: location[1],
        duration: 3000,
      },
    })
  );
}

// ── Step 5: Toast Notification ────────────────────────────────────────────

function showTradeToast(trade: TradeExecution): void {
  const direction = trade.direction === 'LONG' ? 'LONG' : 'SHORT';
  const dirIcon = trade.direction === 'LONG' ? '📈' : '📉';
  const message = `${dirIcon} Paper trade executed: ${direction} ${trade.symbol} · ${trade.quantity.toLocaleString()} shares`;

  // Use existing toast system
  const toastFn = (window as any).showToast;
  if (typeof toastFn === 'function') {
    toastFn(message, 3000);
  } else {
    console.log('[TradeFlowAnimation]', message);
  }
}

// ── CSS Injection ─────────────────────────────────────────────────────────

function injectStyles(): void {
  const styleId = 'trade-flow-animation-styles';
  if (document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    /* Signal card glow */
    .signal-executing {
      box-shadow: 0 0 20px var(--text-accent), var(--shadow-lg) !important;
      animation: signal-glow-pulse 1s ease-out;
    }

    @keyframes signal-glow-pulse {
      0%, 100% { box-shadow: 0 0 20px var(--text-accent); }
      50% { box-shadow: 0 0 40px var(--text-accent); }
    }

    /* Particle */
    .trade-flow-particle {
      position: fixed;
      z-index: 9999;
      pointer-events: none;
      transition: all 1s cubic-bezier(0.25, 0.46, 0.45, 0.94);
      transform: translate(-50%, -50%);
    }

    .particle-inner {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      background: var(--surface-elevated);
      border: 1px solid var(--text-accent);
      border-radius: 20px;
      box-shadow: 0 0 20px var(--text-accent), var(--shadow-xl);
      animation: particle-pulse 0.5s ease-in-out infinite alternate;
    }

    @keyframes particle-pulse {
      from { transform: scale(1); }
      to { transform: scale(1.1); }
    }

    .particle-icon {
      font-size: 16px;
    }

    .particle-symbol {
      font-family: var(--font-mono);
      font-size: 12px;
      font-weight: var(--font-semibold);
      color: var(--text-accent);
    }

    .trade-flow-particle.arriving {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.5);
      transition: all 0.3s ease-out;
    }

    /* Portfolio flash */
    .portfolio-flash {
      animation: portfolio-flash-anim 0.6s ease-out;
    }

    @keyframes portfolio-flash-anim {
      0%, 100% {
        box-shadow: var(--shadow-md);
      }
      50% {
        box-shadow: 0 0 30px var(--signal-positive), var(--shadow-xl);
      }
    }

    .value-flash {
      animation: value-flash-anim 0.4s ease-out;
    }

    @keyframes value-flash-anim {
      0%, 100% {
        transform: scale(1);
      }
      50% {
        transform: scale(1.05);
      }
    }
  `;
  document.head.appendChild(style);
}

// Auto-inject styles on module load
injectStyles();
