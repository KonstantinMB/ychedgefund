/**
 * Entity popup panel — shows next to the clicked globe marker.
 * Positioned at the click screen coordinates with smart edge-flip so it
 * never overflows the viewport.
 */

export interface EntityInfo {
  id: string;
  name: string;
  type: string;
  subtitle?: string;
  fields: Array<{ label: string; value: string }>;
  coordinates?: [number, number];
  severity?: 'low' | 'medium' | 'high' | 'critical';
  color?: string;
}

let popupEl: HTMLElement | null = null;

/**
 * Create DOM and append to body — call once at startup
 */
export function initEntityPopup(): void {
  if (document.getElementById('entity-popup')) return;

  const el = document.createElement('div');
  el.id = 'entity-popup';
  el.className = 'entity-popup';

  el.innerHTML = `
    <div class="entity-popup-header">
      <div class="entity-popup-type-badge" id="ep-type"></div>
      <button class="entity-popup-close" id="ep-close" aria-label="Close">✕</button>
    </div>
    <div class="entity-popup-name" id="ep-name"></div>
    <div class="entity-popup-subtitle" id="ep-subtitle"></div>
    <div class="entity-popup-fields" id="ep-fields"></div>
    <div class="entity-popup-coords" id="ep-coords"></div>
  `;

  document.body.appendChild(el);
  popupEl = el;

  document.getElementById('ep-close')?.addEventListener('click', hideEntityPopup);
}

const POPUP_WIDTH  = 280;
const POPUP_OFFSET = 14; // px gap from the dot

/**
 * Show the popup next to the clicked dot.
 * @param info    Entity data to display
 * @param screenX Click X in viewport pixels (from deck.gl PickingInfo.x)
 * @param screenY Click Y in viewport pixels (from deck.gl PickingInfo.y)
 */
export function showEntityPopup(info: EntityInfo, screenX?: number, screenY?: number): void {
  if (!popupEl) initEntityPopup();
  const el = popupEl!;

  // Type badge
  const badge = el.querySelector<HTMLElement>('#ep-type')!;
  badge.textContent = formatType(info.type);
  badge.style.borderColor = info.color ?? '';
  badge.style.color = info.color ?? '';

  // Name
  el.querySelector<HTMLElement>('#ep-name')!.textContent = info.name;

  // Subtitle
  const subtitleEl = el.querySelector<HTMLElement>('#ep-subtitle')!;
  subtitleEl.textContent = info.subtitle ?? '';
  subtitleEl.style.display = info.subtitle ? '' : 'none';

  // Fields
  const fieldsEl = el.querySelector<HTMLElement>('#ep-fields')!;
  fieldsEl.innerHTML = '';
  info.fields.forEach(f => {
    const fieldDiv = document.createElement('div');
    fieldDiv.className = 'entity-popup-field';
    fieldDiv.innerHTML = `
      <span class="entity-field-label">${escapeHtml(f.label)}</span>
      <span class="entity-field-value">${escapeHtml(f.value)}</span>
    `;
    fieldsEl.appendChild(fieldDiv);
  });
  fieldsEl.style.display = info.fields.length ? '' : 'none';

  // Coordinates
  const coordsEl = el.querySelector<HTMLElement>('#ep-coords')!;
  if (info.coordinates) {
    const [lon, lat] = info.coordinates;
    const latStr = `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}`;
    const lonStr = `${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`;
    coordsEl.textContent = `${latStr}, ${lonStr}`;
    coordsEl.style.display = '';
  } else {
    coordsEl.style.display = 'none';
  }

  // Severity accent on left border
  if (info.severity) {
    const severityColors: Record<string, string> = {
      critical: '#ef4444',
      high:     '#f97316',
      medium:   '#eab308',
      low:      '#22c55e',
    };
    el.style.borderLeftColor = severityColors[info.severity] ?? '';
    el.style.borderLeftWidth = '3px';
  } else if (info.color) {
    el.style.borderLeftColor = info.color;
    el.style.borderLeftWidth = '3px';
  } else {
    el.style.borderLeftColor = '';
    el.style.borderLeftWidth = '';
  }

  // ── Position near the clicked dot ────────────────────────────────────────
  if (screenX !== undefined && screenY !== undefined) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Measure actual rendered height (or estimate before first render)
    const popupH = el.offsetHeight || 220;

    // Horizontal: prefer right of dot; flip left if it would overflow
    const fitsRight = screenX + POPUP_OFFSET + POPUP_WIDTH <= vw - 8;
    const left = fitsRight
      ? screenX + POPUP_OFFSET
      : screenX - POPUP_OFFSET - POPUP_WIDTH;

    // Vertical: centre on the dot; clamp to viewport
    let top = screenY - popupH / 2;
    top = Math.max(8, Math.min(top, vh - popupH - 8));

    el.style.left   = `${left}px`;
    el.style.top    = `${top}px`;
    el.style.right  = '';
    el.style.transform = '';
  }

  el.classList.add('visible');
}

/**
 * Hide the popup
 */
export function hideEntityPopup(): void {
  popupEl?.classList.remove('visible');
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatType(type: string): string {
  return type.replace(/-/g, ' ').toUpperCase();
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
