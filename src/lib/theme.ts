/**
 * Theme Manager
 * Handles dark/light theme switching with localStorage persistence
 */

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'atlas-theme';
const DEFAULT_THEME: Theme = 'dark';

/**
 * Get the current theme from localStorage or system preference
 */
function getInitialTheme(): Theme {
  // Check localStorage first
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'dark' || stored === 'light') {
    return stored;
  }

  // Fall back to system preference
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
    return 'light';
  }

  return DEFAULT_THEME;
}

/**
 * Apply theme to the document
 */
function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;

  // Update meta theme-color for mobile browsers
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', theme === 'dark' ? '#0a0f0a' : '#f8f9fa');
  }
}

/**
 * Set the current theme
 */
export function setTheme(theme: Theme): void {
  localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);

  // Dispatch event for components that need to react to theme changes
  window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
}

/**
 * Get the current theme
 */
export function getTheme(): Theme {
  return (document.documentElement.dataset.theme as Theme) || DEFAULT_THEME;
}

/**
 * Toggle between dark and light theme
 */
export function toggleTheme(): void {
  const current = getTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  setTheme(next);
}

/**
 * Initialize theme system
 * Call this on app startup
 */
export function initTheme(): void {
  const theme = getInitialTheme();
  applyTheme(theme);

  // Listen for system theme changes
  if (window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', (e) => {
      // Only auto-switch if user hasn't set a preference
      if (!localStorage.getItem(STORAGE_KEY)) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    });
  }

  console.log(`[Theme] Initialized with ${theme} theme`);
}
