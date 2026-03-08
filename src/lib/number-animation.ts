/**
 * Universal Number Animation Utility
 *
 * Animates any number change with:
 * - Smooth easing from old → new value over 400ms
 * - Color flash: green for increase, red for decrease
 * - Works on any element
 */

// ── Animation State ───────────────────────────────────────────────────────

interface AnimationState {
  startTime: number;
  startValue: number;
  endValue: number;
  duration: number;
  onUpdate: (current: number) => void;
  onComplete?: () => void;
  rafId: number;
}

const activeAnimations = new Map<HTMLElement, AnimationState>();

// ── Easing Functions ──────────────────────────────────────────────────────

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

// ── Core Animation Function ───────────────────────────────────────────────

export function animateNumber(
  element: HTMLElement,
  newValue: number,
  options: {
    formatter?: (value: number) => string;
    duration?: number;
    colorFlash?: boolean;
    flashColors?: { increase: string; decrease: string };
    easing?: 'cubic' | 'quart' | 'linear';
    onComplete?: () => void;
  } = {}
): void {
  // Cancel existing animation on this element
  const existing = activeAnimations.get(element);
  if (existing) {
    cancelAnimationFrame(existing.rafId);
    activeAnimations.delete(element);
  }

  // Extract current value from element
  const currentText = element.textContent || '0';
  const currentValue = parseFloat(currentText.replace(/[^0-9.-]/g, '')) || 0;

  // Skip if value hasn't changed
  if (Math.abs(newValue - currentValue) < 0.01) {
    if (options.onComplete) options.onComplete();
    return;
  }

  const duration = options.duration ?? 400;
  const formatter = options.formatter ?? ((v: number) => v.toFixed(0));
  const easingFn = options.easing === 'quart' ? easeOutQuart : options.easing === 'linear' ? (t: number) => t : easeOutCubic;
  const colorFlash = options.colorFlash ?? true;
  const flashColors = options.flashColors ?? {
    increase: 'var(--signal-positive)',
    decrease: 'var(--signal-negative)',
  };

  // Color flash
  if (colorFlash) {
    const flashColor = newValue > currentValue ? flashColors.increase : flashColors.decrease;
    const originalColor = element.style.color || '';

    element.style.transition = 'color 0.15s ease-out';
    element.style.color = flashColor;

    setTimeout(() => {
      element.style.color = originalColor;
      setTimeout(() => {
        element.style.transition = '';
      }, 150);
    }, 150);
  }

  // Animation state
  const state: AnimationState = {
    startTime: Date.now(),
    startValue: currentValue,
    endValue: newValue,
    duration,
    onUpdate: (current: number) => {
      element.textContent = formatter(current);
    },
    onComplete: options.onComplete,
    rafId: 0,
  };

  // Animation loop
  const animate = () => {
    const elapsed = Date.now() - state.startTime;
    const progress = Math.min(elapsed / state.duration, 1);
    const eased = easingFn(progress);
    const current = state.startValue + (state.endValue - state.startValue) * eased;

    state.onUpdate(current);

    if (progress < 1) {
      state.rafId = requestAnimationFrame(animate);
    } else {
      activeAnimations.delete(element);
      if (state.onComplete) state.onComplete();
    }
  };

  state.rafId = requestAnimationFrame(animate);
  activeAnimations.set(element, state);
}

// ── Preset Formatters ─────────────────────────────────────────────────────

export const formatters = {
  currency: (value: number) => {
    const fmt = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    });
    return fmt.format(value);
  },

  currencyCompact: (value: number) => {
    const abs = Math.abs(value);
    if (abs >= 1_000_000) {
      return `$${(value / 1_000_000).toFixed(1)}M`;
    } else if (abs >= 1_000) {
      return `$${(value / 1_000).toFixed(1)}K`;
    }
    return `$${Math.round(value)}`;
  },

  percentage: (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  },

  integer: (value: number) => {
    return Math.round(value).toLocaleString('en-US');
  },

  decimal: (decimals: number) => (value: number) => {
    return value.toFixed(decimals);
  },

  compact: (value: number) => {
    const abs = Math.abs(value);
    if (abs >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(1)}M`;
    } else if (abs >= 1_000) {
      return `${(value / 1_000).toFixed(1)}K`;
    }
    return Math.round(value).toString();
  },
};

// ── Batch Animation (for multiple elements) ──────────────────────────────

export function animateMultiple(
  updates: Array<{
    element: HTMLElement;
    newValue: number;
    formatter?: (value: number) => string;
  }>,
  options: {
    duration?: number;
    colorFlash?: boolean;
    stagger?: number; // delay between each animation start (ms)
  } = {}
): void {
  const stagger = options.stagger ?? 0;

  updates.forEach((update, index) => {
    setTimeout(() => {
      animateNumber(update.element, update.newValue, {
        formatter: update.formatter,
        duration: options.duration,
        colorFlash: options.colorFlash,
      });
    }, index * stagger);
  });
}

// ── Cleanup ───────────────────────────────────────────────────────────────

export function cancelAllAnimations(): void {
  for (const [element, state] of activeAnimations) {
    cancelAnimationFrame(state.rafId);
  }
  activeAnimations.clear();
}
