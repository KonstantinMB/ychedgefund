/**
 * Performance Calculator
 *
 * Computes institutional-grade trading metrics from the portfolio equity curve
 * and closed trades. Recalculates whenever the portfolio snapshot changes.
 *
 * Metrics:
 *   Sharpe ratio     — rolling 30d, 90d, inception (annualised, Rf = 4.5 % p.a.)
 *   Sortino ratio    — downside deviation only
 *   Calmar ratio     — annualised return / max drawdown
 *   Alpha & Beta     — vs SPY (estimated via position betas from universe)
 *   Win rate         — % of closed trades with P&L > 0
 *   Avg win / loss   — mean dollar P&L of winners and losers
 *   Profit factor    — gross profit / gross loss
 *   Monthly returns  — table of YYYY-MM → return %
 *   Daily equity     — full equity curve array (for chart rendering)
 */

import type { ClosedTrade, EquityPoint, PortfolioSnapshot } from './portfolio-manager';
import { PAPER_CONFIG } from '../engine';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PerformanceMetrics {
  timestamp: number;
  totalReturn: number;         // inception return %
  annualisedReturn: number;    // CAGR

  // Sharpe
  sharpe30d: number;
  sharpe90d: number;
  sharpeInception: number;

  // Sortino (downside risk only)
  sortino30d: number;
  sortinoInception: number;

  // Risk-adjusted
  calmar: number;              // annualised return / max drawdown
  maxDrawdown: number;
  currentDrawdown: number;

  // Trade stats
  totalTrades: number;
  winRate: number;             // 0–1
  avgWin: number;              // $ per winner
  avgLoss: number;             // $ per loser (positive number)
  profitFactor: number;        // gross profit / gross loss
  expectancy: number;          // $ expected value per trade

  // Market sensitivity
  beta: number;                // weighted portfolio beta vs SPY
  alpha: number;               // estimated alpha (annualised %)

  // Long / short
  longShortRatio: number;
  netExposurePct: number;
  grossExposurePct: number;

  // Time series (for charts)
  dailyEquityCurve: EquityPoint[];
  monthlyReturns: Record<string, number>; // 'YYYY-MM' → decimal return

  // Strategy breakdown
  byStrategy: Record<string, StrategyStats>;
}

export interface StrategyStats {
  strategy: string;
  trades: number;
  winRate: number;
  totalPnl: number;
  avgPnl: number;
  sharpe: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const RISK_FREE_ANNUAL   = 0.045;                          // 4.5 % p.a.
const RISK_FREE_DAILY    = RISK_FREE_ANNUAL / 252;
const TRADING_DAYS_YEAR  = 252;

// ── Main entry point ──────────────────────────────────────────────────────────

export function calculatePerformance(
  snapshot: PortfolioSnapshot,
  equityCurve: EquityPoint[]
): PerformanceMetrics {
  const dailyReturns = toDailyReturns(equityCurve);
  const now = Date.now();

  // ── Returns ────────────────────────────────────────────────────────────────
  const totalReturn = (snapshot.totalValue - PAPER_CONFIG.startingCapital) / PAPER_CONFIG.startingCapital;
  const ageYears    = Math.max(
    (now - (equityCurve[0]?.timestamp ?? now)) / (365.25 * 24 * 3600 * 1000),
    1 / TRADING_DAYS_YEAR   // minimum 1 day to avoid division by zero
  );
  const annualisedReturn = Math.pow(1 + totalReturn, 1 / ageYears) - 1;

  // ── Sharpe ─────────────────────────────────────────────────────────────────
  const returns30d     = dailyReturns.slice(-30);
  const returns90d     = dailyReturns.slice(-90);

  const sharpe30d      = sharpe(returns30d);
  const sharpe90d      = sharpe(returns90d);
  const sharpeInception = sharpe(dailyReturns);

  // ── Sortino ────────────────────────────────────────────────────────────────
  const sortino30d      = sortino(returns30d);
  const sortinoInception = sortino(dailyReturns);

  // ── Calmar ────────────────────────────────────────────────────────────────
  const calmar = snapshot.maxDrawdown > 0
    ? annualisedReturn / snapshot.maxDrawdown
    : 0;

  // ── Trade stats ────────────────────────────────────────────────────────────
  const trades       = snapshot.closedTrades;
  const winners      = trades.filter(t => t.realizedPnl > 0);
  const losers       = trades.filter(t => t.realizedPnl <= 0);
  const grossProfit  = winners.reduce((s, t) => s + t.realizedPnl, 0);
  const grossLoss    = Math.abs(losers.reduce((s, t) => s + t.realizedPnl, 0));

  const winRate      = trades.length > 0 ? winners.length / trades.length : 0;
  const avgWin       = winners.length > 0 ? grossProfit / winners.length : 0;
  const avgLoss      = losers.length  > 0 ? grossLoss  / losers.length  : 0;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
  const expectancy   = trades.length > 0
    ? (winRate * avgWin) - ((1 - winRate) * avgLoss)
    : 0;

  // ── Beta / Alpha ───────────────────────────────────────────────────────────
  // Use position-weighted beta from the snapshot (open positions only)
  const totalValue = snapshot.totalValue;
  let weightedBeta = 0;

  // Beta proxy from position metadata (set by strategies via signal metadata)
  // For now we compute a rough approximation: long positions add beta, shorts subtract
  for (const pos of snapshot.positions) {
    const weight = pos.marketValue / totalValue;
    // Default equity beta = 1.0; LONG adds, SHORT subtracts
    const positiveBeta = pos.direction === 'LONG' ? 1.0 : -1.0;
    weightedBeta += weight * positiveBeta;
  }

  // Cash is zero-beta
  const cashWeight = snapshot.cash / totalValue;
  const beta = (1 - cashWeight) * weightedBeta;

  // Alpha = actual annualised return − (beta × SPY annualised return)
  // Assume SPY annualised ~ 10 % as baseline
  const spyAnnualisedReturn = 0.10;
  const alpha = annualisedReturn - (beta * spyAnnualisedReturn);

  // ── Monthly returns ────────────────────────────────────────────────────────
  const monthlyReturns = buildMonthlyReturns(equityCurve);

  // ── Strategy breakdown ─────────────────────────────────────────────────────
  const byStrategy = buildStrategyStats(trades);

  // ── Exposure ratios ───────────────────────────────────────────────────────
  const longShortRatio = snapshot.shortExposure > 0
    ? snapshot.longExposure / snapshot.shortExposure
    : Infinity;

  return {
    timestamp: now,
    totalReturn,
    annualisedReturn,
    sharpe30d,
    sharpe90d,
    sharpeInception,
    sortino30d,
    sortinoInception,
    calmar,
    maxDrawdown: snapshot.maxDrawdown,
    currentDrawdown: snapshot.currentDrawdown,
    totalTrades: trades.length,
    winRate,
    avgWin,
    avgLoss,
    profitFactor,
    expectancy,
    beta,
    alpha,
    longShortRatio,
    netExposurePct: snapshot.netExposure / totalValue,
    grossExposurePct: snapshot.grossExposure / totalValue,
    dailyEquityCurve: equityCurve,
    monthlyReturns,
    byStrategy,
  };
}

// ── Statistic helpers ──────────────────────────────────────────────────────────

/** Convert equity curve to daily returns (percentage) */
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

/** Annualised Sharpe ratio (excess return / std dev × √252) */
function sharpe(dailyReturns: number[]): number {
  if (dailyReturns.length < 5) return 0;
  const mean = avg(dailyReturns);
  const excessMean = mean - RISK_FREE_DAILY;
  const sd = stddev(dailyReturns);
  if (sd === 0) return 0;
  return (excessMean / sd) * Math.sqrt(TRADING_DAYS_YEAR);
}

/** Annualised Sortino ratio (downside std dev only) */
function sortino(dailyReturns: number[]): number {
  if (dailyReturns.length < 5) return 0;
  const mean = avg(dailyReturns);
  const excessMean = mean - RISK_FREE_DAILY;
  const downsideReturns = dailyReturns.filter(r => r < RISK_FREE_DAILY);
  if (downsideReturns.length === 0) return Infinity;
  const downsideDev = stddev(downsideReturns);
  if (downsideDev === 0) return 0;
  return (excessMean / downsideDev) * Math.sqrt(TRADING_DAYS_YEAR);
}

function avg(arr: number[]): number {
  return arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
}

function stddev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const mean = avg(arr);
  const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

/** Build monthly returns table from equity curve */
function buildMonthlyReturns(curve: EquityPoint[]): Record<string, number> {
  if (curve.length < 2) return {};

  const byMonth = new Map<string, { first: number; last: number }>();

  for (const point of curve) {
    const d = new Date(point.timestamp);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const existing = byMonth.get(key);
    if (!existing) {
      byMonth.set(key, { first: point.totalValue, last: point.totalValue });
    } else {
      existing.last = point.totalValue;
    }
  }

  const result: Record<string, number> = {};
  for (const [month, { first, last }] of byMonth) {
    result[month] = first > 0 ? (last - first) / first : 0;
  }
  return result;
}

/** Per-strategy P&L breakdown */
function buildStrategyStats(trades: ClosedTrade[]): Record<string, StrategyStats> {
  const groups = new Map<string, ClosedTrade[]>();
  for (const trade of trades) {
    const list = groups.get(trade.strategy) ?? [];
    list.push(trade);
    groups.set(trade.strategy, list);
  }

  const result: Record<string, StrategyStats> = {};
  for (const [strategy, stratTrades] of groups) {
    const winners  = stratTrades.filter(t => t.realizedPnl > 0);
    const totalPnl = stratTrades.reduce((s, t) => s + t.realizedPnl, 0);
    const dailyReturns = stratTrades.map(t => t.realizedPnlPct);

    result[strategy] = {
      strategy,
      trades: stratTrades.length,
      winRate: stratTrades.length > 0 ? winners.length / stratTrades.length : 0,
      totalPnl,
      avgPnl: stratTrades.length > 0 ? totalPnl / stratTrades.length : 0,
      sharpe: sharpe(dailyReturns),
    };
  }
  return result;
}

// ── Formatting helpers ────────────────────────────────────────────────────────

export function formatMetrics(m: PerformanceMetrics): string {
  const pct = (v: number) => `${(v * 100).toFixed(2)}%`;
  const dp2 = (v: number) => v.toFixed(2);
  const dol = (v: number) => `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  return [
    `Total Return : ${pct(m.totalReturn)} | Annualised : ${pct(m.annualisedReturn)}`,
    `Sharpe 30d   : ${dp2(m.sharpe30d)} | 90d : ${dp2(m.sharpe90d)} | Inception : ${dp2(m.sharpeInception)}`,
    `Sortino      : ${dp2(m.sortino30d)} (30d) | ${dp2(m.sortinoInception)} (inception)`,
    `Calmar       : ${dp2(m.calmar)} | Max DD : ${pct(m.maxDrawdown)} | Current DD : ${pct(m.currentDrawdown)}`,
    `Win Rate     : ${pct(m.winRate)} | Trades : ${m.totalTrades}`,
    `Avg Win      : ${dol(m.avgWin)} | Avg Loss : ${dol(m.avgLoss)} | Profit Factor : ${dp2(m.profitFactor)}`,
    `Expectancy   : ${dol(m.expectancy)} per trade`,
    `Beta         : ${dp2(m.beta)} | Alpha : ${pct(m.alpha)} annualised`,
  ].join('\n');
}
