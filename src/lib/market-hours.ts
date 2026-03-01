/**
 * Market Hours — US equities vs crypto
 *
 * US stocks/ETFs: NYSE/NASDAQ 9:30 AM–4:00 PM ET, Mon–Fri
 * Crypto: 24/7 (no market-hours restriction)
 */

/** Check if symbol is crypto (Yahoo format: *-USD) */
export function isCrypto(symbol: string): boolean {
  return symbol.includes('-USD') || symbol.endsWith('-USD');
}

/** Get current time in Eastern (America/New_York) */
function getEasternTime(): { day: number; hour: number; minute: number } {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
    weekday: 'short',
  });
  const parts = dtf.formatToParts(new Date());
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0', 10);
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0', 10);
  const wd = parts.find(p => p.type === 'weekday')?.value ?? 'Sun';
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { day: dayMap[wd] ?? 0, hour, minute };
}

/** True if US equity markets (NYSE/NASDAQ) are open right now */
export function isUsMarketOpen(): boolean {
  const { day, hour, minute } = getEasternTime();

  // Weekend
  if (day === 0 || day === 6) return false;

  const mins = hour * 60 + minute;
  const open = 9 * 60 + 30;   // 9:30 AM ET
  const close = 16 * 60;     // 4:00 PM ET

  return mins >= open && mins < close;
}

/** Human-readable status for UI */
export function getMarketStatus(symbol: string): { open: boolean; message: string } {
  if (isCrypto(symbol)) {
    return { open: true, message: '24/7' };
  }
  if (isUsMarketOpen()) {
    return { open: true, message: 'Market open' };
  }
  return { open: false, message: 'Out of market — NYSE closed. Can\'t trade until 9:30 AM ET.' };
}
