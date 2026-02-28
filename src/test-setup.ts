/**
 * Global test setup — runs before every test file.
 * Provides localStorage mock, window polyfills, and common stubs.
 */

// jsdom provides window / document / localStorage — nothing extra needed here.
// Individual test files vi.mock() their own module dependencies.
