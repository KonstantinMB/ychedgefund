# Theme System Migration Guide

This guide helps you update existing components to support the new dark/light theme system.

## Quick Checklist

- [ ] Replace all hardcoded colors with CSS variables
- [ ] Add transition properties for smooth theme switching
- [ ] Test component in both dark and light themes
- [ ] Verify contrast ratios for accessibility
- [ ] Update any JavaScript that directly manipulates colors

---

## Common Migration Patterns

### 1. Background Colors

#### Before (Hardcoded)
```css
.my-panel {
  background-color: #0a0f0a;
}
```

#### After (Theme-Aware)
```css
.my-panel {
  background-color: var(--bg-panel);
  transition: background-color var(--transition-base);
}
```

---

### 2. Text Colors

#### Before
```css
.title {
  color: #e8f0e8;
}

.subtitle {
  color: #a0b0a0;
}

.link {
  color: #4ade80;
}
```

#### After
```css
.title {
  color: var(--text-primary);
  transition: color var(--transition-base);
}

.subtitle {
  color: var(--text-secondary);
  transition: color var(--transition-base);
}

.link {
  color: var(--text-accent);
  transition: color var(--transition-fast);
}

.link:hover {
  color: var(--text-accent);
  opacity: 0.8;
}
```

---

### 3. Borders

#### Before
```css
.card {
  border: 1px solid rgba(74, 222, 128, 0.2);
}
```

#### After
```css
.card {
  border: 1px solid var(--border-primary);
  transition: border-color var(--transition-base);
}

.card:hover {
  border-color: var(--border-hover);
}
```

---

### 4. Shadows

#### Before
```css
.modal {
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
}
```

#### After
```css
.modal {
  box-shadow: var(--shadow-lg);
  transition: box-shadow var(--transition-base);
}
```

---

### 5. Status/Severity Indicators

#### Before
```css
.alert-critical {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.2);
  border: 1px solid #ef4444;
}
```

#### After
```css
.alert-critical {
  color: var(--status-critical);
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid var(--status-critical);
  transition: all var(--transition-fast);
}
```

Note: Status colors are consistent across themes, but background opacity is adjusted.

---

## TypeScript/JavaScript Updates

### 1. Dynamic Color Assignment

#### Before
```typescript
const marker = document.createElement('div');
marker.style.backgroundColor = '#4ade80';
marker.style.color = '#e8f0e8';
```

#### After
```typescript
const marker = document.createElement('div');
// Use CSS classes instead of inline styles
marker.className = 'marker';

// Or use CSS variables in inline styles
marker.style.backgroundColor = 'var(--text-accent)';
marker.style.color = 'var(--text-primary)';
```

---

### 2. Conditional Styling Based on Theme

#### Before
```typescript
const isDark = true; // Hardcoded
const color = isDark ? '#4ade80' : '#2563eb';
```

#### After
```typescript
import { getTheme } from './lib/theme';

const theme = getTheme();
const color = theme === 'dark' ? '#4ade80' : '#2563eb';

// Or better: use CSS variables and let CSS handle it
const marker = document.createElement('div');
marker.style.color = 'var(--text-accent)'; // Automatically correct for theme
```

---

### 3. Listening for Theme Changes

#### New Pattern
```typescript
window.addEventListener('themechange', (e) => {
  const theme = e.detail.theme;

  // Update component-specific logic
  if (theme === 'dark') {
    // Dark theme specific behavior
    updateMapBasemap('dark-matter');
  } else {
    // Light theme specific behavior
    updateMapBasemap('positron');
  }
});
```

---

## Component-Specific Migrations

### deck.gl Layers

#### Before
```typescript
new ScatterplotLayer({
  id: 'points',
  data: points,
  getFillColor: [74, 222, 128], // Hardcoded green
});
```

#### After
```typescript
import { getTheme } from './lib/theme';

function createScatterplotLayer(data) {
  const theme = getTheme();
  const fillColor = theme === 'dark'
    ? [74, 222, 128]   // Green for dark
    : [37, 99, 235];   // Blue for light

  return new ScatterplotLayer({
    id: 'points',
    data,
    getFillColor: fillColor,
  });
}

// Update on theme change
window.addEventListener('themechange', (e) => {
  const newLayer = createScatterplotLayer(data);
  globe.updateLayer('points', newLayer);
});
```

---

### MapLibre Basemap

#### Before
```typescript
const map = new maplibregl.Map({
  container: 'map',
  style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
});
```

#### After
```typescript
import { getTheme } from './lib/theme';

function getBasemapStyle(theme) {
  return theme === 'dark'
    ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
    : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
}

const theme = getTheme();
const map = new maplibregl.Map({
  container: 'map',
  style: getBasemapStyle(theme),
});

// Update on theme change
window.addEventListener('themechange', (e) => {
  map.setStyle(getBasemapStyle(e.detail.theme));
});
```

---

### Chart/Visualization Libraries

#### Example: Custom SVG Chart

##### Before
```typescript
const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
line.setAttribute('stroke', '#4ade80');
line.setAttribute('stroke-width', '2');
svg.appendChild(line);
```

##### After
```typescript
const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');

// Use CSS variables in SVG
line.setAttribute('stroke', 'var(--text-accent)');
line.setAttribute('stroke-width', '2');
svg.appendChild(line);

// Or use getComputedStyle for actual color value
const accentColor = getComputedStyle(document.documentElement)
  .getPropertyValue('--text-accent')
  .trim();
line.setAttribute('stroke', accentColor);
```

---

## Testing Your Migration

### Visual Testing Checklist

1. **Toggle Theme**: Click theme button or press `Cmd+Shift+T`
2. **Check Transitions**: Colors should transition smoothly (~200ms)
3. **Verify Contrast**: Text should be readable in both themes
4. **Test Hover States**: Buttons/links should have visible hover effects
5. **Check Borders**: Borders should be visible but not harsh

### Automated Testing

```typescript
// Test that theme variables are applied
function testThemeVariables() {
  const root = document.documentElement;
  const bgPrimary = getComputedStyle(root).getPropertyValue('--bg-primary');

  console.assert(bgPrimary, 'Theme variable --bg-primary should be defined');
}

// Test theme switching
function testThemeSwitch() {
  import { getTheme, setTheme } from './lib/theme';

  setTheme('dark');
  console.assert(getTheme() === 'dark', 'Theme should be dark');

  setTheme('light');
  console.assert(getTheme() === 'light', 'Theme should be light');
}
```

---

## Common Pitfalls

### ❌ Pitfall 1: Forgetting Transitions
```css
/* Without transition - jarring theme switch */
.panel {
  background: var(--bg-panel);
}
```

```css
/* With transition - smooth theme switch */
.panel {
  background: var(--bg-panel);
  transition: background var(--transition-base);
}
```

---

### ❌ Pitfall 2: Inline Styles Override CSS Variables
```typescript
// BAD: Inline style prevents theme switching
element.style.color = '#4ade80';
```

```typescript
// GOOD: Use CSS class
element.className = 'text-accent';

// OR: Use CSS variable in inline style
element.style.color = 'var(--text-accent)';
```

---

### ❌ Pitfall 3: Hardcoded Colors in JavaScript
```typescript
// BAD: Hardcoded color
chart.setColor('#4ade80');
```

```typescript
// GOOD: Read from CSS variable
const color = getComputedStyle(document.documentElement)
  .getPropertyValue('--text-accent')
  .trim();
chart.setColor(color);

// Update on theme change
window.addEventListener('themechange', () => {
  const newColor = getComputedStyle(document.documentElement)
    .getPropertyValue('--text-accent')
    .trim();
  chart.setColor(newColor);
});
```

---

### ❌ Pitfall 4: Not Testing Both Themes
Always test your component in both themes:

```bash
# Open demo page
npm run dev
# Navigate to theme-demo.html
# Toggle theme and verify component appearance
```

---

## Variable Reference Quick Guide

| Use Case | Variable | Example |
|----------|----------|---------|
| Main background | `--bg-primary` | Page background |
| Panel background | `--bg-panel` | Sidebar, modal |
| Input background | `--bg-input` | Text fields |
| Button background | `--bg-button` | Primary button |
| Main text | `--text-primary` | Headings, body text |
| Secondary text | `--text-secondary` | Subtitles, labels |
| Links/accents | `--text-accent` | Links, highlights |
| Main borders | `--border-primary` | Panel borders |
| Subtle borders | `--border-secondary` | Dividers |
| Critical alerts | `--status-critical` | Error messages |
| High priority | `--status-high` | Warnings |
| Medium priority | `--status-medium` | Caution |
| Low priority | `--status-low` | Success messages |
| Information | `--status-info` | Info messages |
| Positive data | `--sentiment-positive` | Up trends |
| Negative data | `--sentiment-negative` | Down trends |
| Neutral data | `--sentiment-neutral` | Flat trends |

---

## Need Help?

### Documentation
- [Theme System Docs](/docs/THEME-SYSTEM.md)
- [Color Reference](/docs/THEME-COLOR-REFERENCE.md)
- [Implementation Summary](/docs/THEME-IMPLEMENTATION-SUMMARY.md)

### Demo
- View: `http://localhost:5173/src/theme-demo.html`
- Source: `/src/theme-demo.html`

### Code References
- Theme Manager: `/src/lib/theme.ts`
- CSS Variables: `/src/styles/base.css`
- Integration: `/src/main.ts`

---

## Migration Priority

### High Priority (Immediate)
- [ ] Panel components (left/right sidebars)
- [ ] Text elements (headings, body text)
- [ ] Buttons and interactive elements
- [ ] Status badges and alerts

### Medium Priority (Soon)
- [ ] Charts and visualizations
- [ ] Map/globe layers
- [ ] Form inputs
- [ ] Modal dialogs

### Low Priority (When Time Permits)
- [ ] Tooltips
- [ ] Loading states
- [ ] Animations
- [ ] Edge cases

---

**Remember**: The theme system is designed to be progressively enhanced. Components will work without theme support, but won't adapt to theme changes. Migrate incrementally!
