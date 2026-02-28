/**
 * Theme type definitions
 */

export type Theme = 'dark' | 'light';

/**
 * Set the current theme
 */
export function setTheme(theme: Theme): void;

/**
 * Get the current theme
 */
export function getTheme(): Theme;

/**
 * Toggle between dark and light theme
 */
export function toggleTheme(): void;

/**
 * Initialize theme system
 * Call this on app startup
 */
export function initTheme(): void;
