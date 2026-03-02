/**
 * GET /api/trading/performance
 *
 * Requires auth. Fetches portfolio, computes metrics, caches in
 * performance:{username} with 5-min TTL.
 */

import { withCors } from '../_cors';
import { requireAuth } from '../auth/_middleware';
import { getAuthRedis } from '../auth/_redis';

export const config = { runtime: 'edge' };

const CACHE_TTL = 5 * 60; // 5 min
const STARTING_CAPITAL = 1_000_000;
const RISK_FREE_DAILY = 0.045 / 252;
const TRADING_DAYS_YEAR = 252;

function perfKey(username: string): string {
  return `performance:${username}`;
}

function portfolioKey(username: string): string {
  return `portfolio:${username}`;
}

function jsonResponse(data: object, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

interface EquityPoint {
  timestamp: number;
  totalValue: number;
  cash: number;
  unrealizedPnl?: number;
  realizedPnl?: number;
}

interface ClosedTrade {
  realizedPnl: number;
  realizedPnlPct?: number;
  strategy: string;
}

function toDailyReturns(curve: EquityPoint[]): number[] {
  if (curve.length < 2) return [];
  const returns: number[] = [];
  for (let i = 1; i < curve.length; i++) {
    const prev = curve[i - 1]!.totalValue;
    const curr = curve[i]!.totalValue;
    if (prev > 0) returns.push((curr - prev) / prev);
  }
  return returns;
}

function sharpe(dailyReturns: number[]): number {
  if (dailyReturns.length < 5) return 0;
  const mean = dailyReturns.reduce((s, v) => s + v, 0) / dailyReturns.length;
  const excessMean = mean - RISK_FREE_DAILY;
  const variance = dailyReturns.reduce((s, v) => s + (v - mean) ** 2, 0) / (dailyReturns.length - 1);
  const sd = Math.sqrt(variance);
  if (sd === 0) return 0;
  return (excessMean / sd) * Math.sqrt(TRADING_DAYS_YEAR);
}

function sortino(dailyReturns: number[]): number {
  if (dailyReturns.length < 5) return 0;
  const mean = dailyReturns.reduce((s, v) => s + v, 0) / dailyReturns.length;
  const excessMean = mean - RISK_FREE_DAILY;
  const downside = dailyReturns.filter(r => r < RISK_FREE_DAILY);
  if (downside.length === 0) return 999;
  const variance = downside.reduce((s, v) => s + (v - mean) ** 2, 0) / downside.length;
  const sd = Math.sqrt(variance);
  if (sd === 0) return 0;
  return (excessMean / sd) * Math.sqrt(TRADING_DAYS_YEAR);
}

function computeMetrics(portfolio: Record<string, unknown>): Record<string, unknown> {
  const equityCurve = (portfolio.equityCurve ?? []) as EquityPoint[];
  const closedTrades = (portfolio.closedTrades ?? []) as ClosedTrade[];
  const totalValue = (portfolio.cash as number) ?? STARTING_CAPITAL;
  const maxDrawdown = (portfolio.maxDrawdown as number) ?? 0;
  const highWaterMark = (portfolio.highWaterMark as number) ?? STARTING_CAPITAL;
  const currentDrawdown = highWaterMark > 0 ? (highWaterMark - totalValue) / highWaterMark : 0;

  const dailyReturns = toDailyReturns(equityCurve);
  const returns30d = dailyReturns.slice(-30);
  const returns90d = dailyReturns.slice(-90);

  const totalReturn = (totalValue - STARTING_CAPITAL) / STARTING_CAPITAL;
  const ageYears = Math.max(
    (Date.now() - (equityCurve[0]?.timestamp ?? Date.now())) / (365.25 * 24 * 3600 * 1000),
    1 / TRADING_DAYS_YEAR
  );
  const annualisedReturn = Math.pow(1 + totalReturn, 1 / ageYears) - 1;
  const calmar = maxDrawdown > 0 ? annualisedReturn / maxDrawdown : 0;

  const winners = closedTrades.filter(t => t.realizedPnl > 0);
  const losers = closedTrades.filter(t => t.realizedPnl <= 0);
  const grossProfit = winners.reduce((s, t) => s + t.realizedPnl, 0);
  const grossLoss = Math.abs(losers.reduce((s, t) => s + t.realizedPnl, 0));
  const winRate = closedTrades.length > 0 ? winners.length / closedTrades.length : 0;
  const avgWin = winners.length > 0 ? grossProfit / winners.length : 0;
  const avgLoss = losers.length > 0 ? grossLoss / losers.length : 0;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;

  const byStrategy: Record<string, { strategy: string; trades: number; winRate: number; totalPnl: number }> = {};
  for (const t of closedTrades) {
    const s = t.strategy ?? 'unknown';
    if (!byStrategy[s]) byStrategy[s] = { strategy: s, trades: 0, winRate: 0, totalPnl: 0 };
    byStrategy[s].trades++;
    byStrategy[s].totalPnl += t.realizedPnl;
    if (t.realizedPnl > 0) byStrategy[s].winRate += 1;
  }
  for (const s of Object.values(byStrategy)) {
    s.winRate = s.trades > 0 ? s.winRate / s.trades : 0;
  }

  const monthlyReturns: Record<string, number> = {};
  for (const p of equityCurve) {
    const d = new Date(p.timestamp);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!(key in monthlyReturns)) monthlyReturns[key] = p.totalValue;
    monthlyReturns[key] = p.totalValue;
  }
  const months = Object.keys(monthlyReturns).sort();
  const mr: Record<string, number> = {};
  for (let i = 1; i < months.length; i++) {
    const prev = monthlyReturns[months[i - 1]!];
    const curr = monthlyReturns[months[i]!];
    if (prev && prev > 0) mr[months[i]!] = (curr - prev) / prev;
  }

  return {
    sharpe: sharpe(dailyReturns),
    sharpe30d: sharpe(returns30d),
    sharpe90d: sharpe(returns90d),
    sortino: sortino(dailyReturns),
    maxDD: maxDrawdown,
    winRate,
    profitFactor,
    totalReturn,
    annualisedReturn,
    calmar,
    totalTrades: closedTrades.length,
    avgWin,
    avgLoss,
    equityCurve,
    monthlyReturns: mr,
    byStrategy,
    currentDrawdown,
    timestamp: Date.now(),
  };
}

export default withCors(async (req: Request) => {
  if (req.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const userOrError = await requireAuth(req);
  if (userOrError instanceof Response) return userOrError;
  const user = userOrError;

  const redis = getAuthRedis();
  if (!redis) {
    return jsonResponse({ error: 'Storage unavailable' }, 503);
  }

  const cacheKey = perfKey(user.username);
  const cached = await redis.get<string>(cacheKey);
  if (cached) {
    try {
      const data = typeof cached === 'string' ? JSON.parse(cached) : cached;
      return jsonResponse(data, 200);
    } catch {
      // fall through to recompute
    }
  }

  const portKey = portfolioKey(user.username);
  const portRaw = await redis.get<string>(portKey);
  let portfolio: Record<string, unknown>;
  if (portRaw) {
    try {
      portfolio = typeof portRaw === 'string' ? JSON.parse(portRaw) : (portRaw as Record<string, unknown>);
    } catch {
      portfolio = { cash: STARTING_CAPITAL, positions: [], closedTrades: [], equityCurve: [] };
    }
  } else {
    portfolio = { cash: STARTING_CAPITAL, positions: [], closedTrades: [], equityCurve: [] };
  }

  const metrics = computeMetrics(portfolio);
  await redis.set(cacheKey, metrics, { ex: CACHE_TTL });

  return jsonResponse(metrics, 200);
});
