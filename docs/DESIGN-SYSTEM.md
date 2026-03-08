# Atlas Design System

**Aesthetic**: "Tactical Luxury"

The lovechild of Bloomberg Terminal, NORAD missile command, and Arrival (the film). Every pixel reinforces: **"This costs $50,000/year but runs for free."**

---

## Philosophy

### Dark, but with Warmth
- Deep forest-black (#0a0f0a), NOT cold gray
- Warm off-white text (#e8e4dd), NEVER pure white
- Gold accent (#D4A843) = "classified", "valuable", "intelligence grade"

### Military Intelligence, Not Startup
- Typography that says "war room" not "landing page"
- Subtle CRT scanlines and film grain
- Glass panels with tactical glow
- Purposeful motion, not decoration

---

## Files

```
src/styles/
├── design-tokens.css       # Variables: colors, spacing, typography
├── base-design.css         # Global: body, scrollbar, selection, effects
├── components-design.css   # Reusables: panels, badges, signals, buttons
└── animations-design.css   # Motion: pulses, flashes, transitions
```

**Test Page**: `design-test.html` (open in browser to see all components)

---

## Color System

### Surfaces (Layered Depth)
```css
--surface-base: #0a0f0a;           /* The void */
--surface-raised: #0d120d;         /* Panels */
--surface-overlay: #111811;        /* Modals */
--surface-elevated: #151d15;       /* Hover */
--surface-glass: rgba(10, 15, 10, 0.85); /* Glass + blur */
```

### Text (Warm, Never Pure White)
```css
--text-primary: #e8e4dd;           /* Warm off-white */
--text-secondary: #8a9a7c;         /* Muted sage green */
--text-tertiary: #4a5a3c;          /* Very muted */
--text-accent: #D4A843;            /* Gold */
```

### Signals (State Indicators)
```css
--signal-positive: #00E676;        /* Green = bullish, profit, live */
--signal-negative: #FF3D3D;        /* Red = bearish, loss, alert */
--signal-warning: #FFB300;         /* Amber = caution, stale */
--signal-critical: #FF1744;        /* Emergency */
```

### Strategies (Each has unique color)
```css
--strategy-momentum: #B388FF;      /* Purple */
--strategy-sentiment: #4FC3F7;     /* Cyan */
--strategy-geopolitical: #FF8A65;  /* Coral */
--strategy-macro: #00E676;         /* Green */
--strategy-crossasset: #FFD54F;    /* Amber */
--strategy-predictionmarkets: #06b6d4; /* Cyan */
```

### Borders (Subtle Gold Structure)
```css
--border-subtle: rgba(212, 168, 67, 0.08);   /* Barely visible */
--border-default: rgba(212, 168, 67, 0.15);  /* Standard */
--border-emphasis: rgba(212, 168, 67, 0.3);  /* Active */
--border-glow: 0 0 15px rgba(212, 168, 67, 0.1); /* Ambient glow */
```

---

## Typography

### Three-Tier System

**1. Playfair Display** (Display — Hero Numbers)
```css
--font-display: 'Playfair Display', 'Georgia', serif;
```
- Use for: NAV, big metrics, editorial luxury touch
- Sizes: `--text-2xl` (32px), `--text-3xl` (48px)
- Weight: Bold (700)

**2. Instrument Sans** (UI — Labels, Navigation)
```css
--font-sans: 'Instrument Sans', 'DM Sans', system-ui;
```
- Use for: Panel headers, buttons, body text
- Sizes: `--text-sm` to `--text-lg`
- Weights: Normal (400), Medium (500), Semibold (600)

**3. DM Mono** (Monospace — Data, Code)
```css
--font-mono: 'DM Mono', 'Fira Code', monospace;
```
- Use for: Prices, symbols, P&L, timestamps
- Sizes: `--text-xs` to `--text-base`
- Weights: Normal (400), Medium (500)

### Loading Fonts
Add to `index.html` `<head>`:
```html
<link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Instrument+Sans:wght@400;500;600;700&family=Playfair+Display:wght@400;700&display=swap" rel="stylesheet">
```

---

## Components

### Panels (Glass with Gold Borders)
```html
<div class="panel">
  <div class="panel-header">
    <div class="panel-title">Intelligence Brief</div>
    <div class="panel-subtitle">Last updated: 2min ago</div>
  </div>
  <p>Content here...</p>
</div>
```

**Variants**:
- `.panel-accent-green` - Green left border (positive)
- `.panel-accent-red` - Red left border (alerts)

**Features**:
- Glassmorphism with `backdrop-filter: blur(12px)`
- Subtle gold border glow on hover
- Inner shadow for depth

---

### Badges (Strategy/Status Indicators)
```html
<span class="badge badge-momentum">MOMENTUM</span>
<span class="badge badge-live">LIVE</span>
```

**Strategy variants**:
- `.badge-momentum` - Purple
- `.badge-sentiment` - Cyan
- `.badge-geopolitical` - Coral
- `.badge-macro` - Green
- `.badge-crossasset` - Amber
- `.badge-predictionmarkets` - Cyan

**Status variants**:
- `.badge-live` - Pulsing green
- `.badge-stale` - Amber
- `.badge-critical` - Blinking red

---

### Metrics (Hero Numbers)
```html
<div class="metric">
  <div class="metric-value positive">+$43,291</div>
  <div class="metric-label">Daily P&L</div>
  <div class="metric-change up">+3.6%</div>
</div>
```

**Features**:
- `metric-value` uses Playfair Display (editorial luxury)
- `.positive` / `.negative` classes for color
- `.up` / `.down` for change direction (auto-adds ▲/▼)

---

### Signal Cards (Trading Signals)
```html
<div class="signal-card momentum">
  <div class="signal-header">
    <span class="signal-symbol">SPY</span>
    <span class="signal-direction long">LONG</span>
  </div>
  <div class="signal-confidence">
    <div class="signal-confidence-bar">
      <div class="signal-confidence-fill" style="width: 87%;"></div>
    </div>
    <span class="signal-confidence-value">87%</span>
  </div>
  <div class="signal-reasoning">
    Technical breakout above 200-day MA...
  </div>
</div>
```

**Features**:
- Glowing left border colored by strategy
- Confidence bar with gradient fill
- Hover: translates right + glow

---

### Buttons (Tactical CTAs)
```html
<button class="button button-primary">Execute Trade</button>
<button class="button button-danger">Flatten All</button>
<button class="button button-success">Confirm</button>
<button class="button button-ghost">Cancel</button>
```

**States**:
- Default: Transparent with colored border
- Hover: Fills with color, text inverts
- Disabled: Opacity 0.4, no pointer events

---

### Data Tables (Tactical Tables)
```html
<table class="data-table">
  <thead>
    <tr>
      <th>Symbol</th>
      <th>P&L</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>SPY</strong></td>
      <td style="color: var(--signal-positive);">+$350</td>
    </tr>
  </tbody>
</table>
```

**Features**:
- Monospace font
- Gold header underline
- Alternating row backgrounds
- Hover: Subtle gold tint

---

### Gauges (Circular Progress)
```html
<div class="gauge">
  <svg viewBox="0 0 120 120">
    <circle class="gauge-track" cx="60" cy="60" r="52" />
    <circle class="gauge-fill positive" cx="60" cy="60" r="52"
      stroke-dasharray="327" stroke-dashoffset="98"
      transform="rotate(-90 60 60)" />
  </svg>
  <div class="gauge-value">70%</div>
</div>
```

**Features**:
- SVG-based circular progress
- `.positive` / `.negative` color variants
- Animated transitions

---

### Status Dots (Live/Stale/Critical)
```html
<div class="status-dot live"></div>
<div class="status-dot stale"></div>
<div class="status-dot critical"></div>
```

**Animations**:
- `.live` - Pulsing green glow
- `.critical` - Blinking red

---

## Animations

### Core Animations
```css
pulse-live          /* Pulsing scale 1 → 1.2 → 1 */
glow-pulse          /* Box-shadow intensity */
flash-green         /* Brief green tint (trade executed) */
flash-red           /* Brief red tint (alert) */
slide-in-right      /* Panel entering from right */
slide-up            /* Modal/tooltip from bottom */
number-tick-up      /* Counter animation (positive) */
number-tick-down    /* Counter animation (negative) */
scan-line           /* Horizontal sweep (CRT effect) */
radar-sweep         /* Rotating line (360deg, 4s) */
stream-in           /* New items slide from top */
shimmer             /* Loading skeleton */
```

### Utility Classes
```html
<div class="animate-fade-in">...</div>
<div class="animate-slide-up">...</div>
<div class="animate-flash-green">...</div>
<div class="animate-number-tick-up">...</div>
```

### Accessibility
All animations respect `prefers-reduced-motion`:
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Cinematic Effects

### Noise Texture (Film Grain)
```css
body::before {
  background-image: var(--noise);
  opacity: 0.03;
  mix-blend-mode: overlay;
}
```

### Scanlines (CRT Monitor)
```css
body::after {
  background-image: var(--scanline);
  animation: subtle-flicker 3s ease-in-out infinite;
}
```

### Vignette (Edge Darkening)
```css
#root::before {
  background-image: var(--vignette);
}
```

### Scan Line Sweep
```html
<div class="scan-line"></div>
```
Horizontal line sweeps down page every 8 seconds (optional).

---

## Custom Scrollbar

**WebKit browsers**:
- Width: 8px
- Thumb: Gold with opacity 0.2 → 0.6 on hover
- Track: Transparent

**Firefox**:
- Thin scrollbar with gold accent

---

## Usage Guidelines

### DO:
✅ Use gold accent sparingly for emphasis
✅ Apply glass panels for overlays
✅ Use Playfair for hero numbers only
✅ Animate state changes (flash-green on profit)
✅ Respect monospace for data values
✅ Layer surfaces (base → raised → elevated)

### DON'T:
❌ Use pure white text
❌ Use cold grays (always warm tones)
❌ Overuse animations (motion is purposeful)
❌ Mix fonts (stick to 3-tier system)
❌ Use generic blue (reserved for specific use)
❌ Skip the vignette/noise effects

---

## Testing

**Open in browser**: `design-test.html`

**Verify checklist**:
- [ ] Noise texture visible (subtle film grain)
- [ ] Scanlines present (faint horizontal lines)
- [ ] Vignette darkens edges
- [ ] Gold accent glows on hover
- [ ] Pulsing live indicators animate
- [ ] Glass panels blur background
- [ ] Monospace data aligns properly
- [ ] All animations respect reduced-motion

---

## Integration

### Add to `index.html`:
```html
<head>
  <!-- Google Fonts -->
  <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Instrument+Sans:wght@400;500;600;700&family=Playfair+Display:wght@400;700&display=swap" rel="stylesheet">

  <!-- Atlas Design System -->
  <link rel="stylesheet" href="src/styles/design-tokens.css">
  <link rel="stylesheet" href="src/styles/base-design.css">
  <link rel="stylesheet" href="src/styles/components-design.css">
  <link rel="stylesheet" href="src/styles/animations-design.css">
</head>
<body>
  <div id="app">
    <!-- Your app here -->
  </div>

  <!-- Optional: Scan line effect -->
  <div class="scan-line"></div>
</body>
```

---

## The Feeling

When complete, the app should feel like:
- You're sitting in a $2B hedge fund's war room
- Every piece of data is classified intelligence
- The interface costs $50,000/year (but runs for free)
- Bloomberg Terminal meets sci-fi tactical command
- Warm, not cold — forest-black, not steel-gray
- Purposeful, not decorative

**"Tactical Luxury"** — military intelligence with editorial polish.
