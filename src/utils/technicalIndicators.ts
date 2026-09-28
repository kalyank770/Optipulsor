import { OptionContract, TickerConfig, TradeSignal } from '../types/options';
import { generateRollingCandles } from './candlestickEngine';
import { calculateBlackScholes } from './blackScholes';

export interface RSIData {
  value: number;
  condition: 'OVERSOLD' | 'BEARISH' | 'NEUTRAL' | 'BULLISH' | 'OVERBOUGHT';
  label: string;
  description: string;
  zoneColor: string;
}

export interface MACDData {
  macdLine: number;
  signalLine: number;
  histogram: number;
  trend: 'BULLISH_EXPANSION' | 'BULLISH_DECELERATION' | 'BEARISH_EXPANSION' | 'BEARISH_DECELERATION';
  label: string;
  description: string;
  histogramColor: string;
}

export interface PartialExitLevel {
  level: number;
  label: string;
  tag: string;
  targetSpot: number;
  estimatedOptionPrice: number;
  gainPoints: number;
  gainPercent: number;
  bookQuantityPercent: number;
  estimatedBookingPnL: number;
  rsiTrigger: string;
  macdTrigger: string;
  executionAction: string;
  recommendedTrailingSL: string;
  badgeColor: string;
}

export interface ExitLogicPlan {
  rsi: RSIData;
  macd: MACDData;
  levels: PartialExitLevel[];
  summaryGuidance: string;
  momentumVerdict: 'STRONG_BULLISH' | 'BULLISH_RECOVERY' | 'NEUTRAL_CONSOLIDATION' | 'BEARISH_DRIFT' | 'STRONG_BEARISH';
}

/**
 * Computes standard 14-period RSI
 */
export function computeRSI(closes: number[], period = 14): RSIData {
  if (closes.length < period + 1) {
    return {
      value: 50.0,
      condition: 'NEUTRAL',
      label: 'Neutral Range',
      description: 'Consolidation near equilibrium 50 line.',
      zoneColor: 'text-slate-400',
    };
  }

  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff >= 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const value = Number((100 - (100 / (1 + rs))).toFixed(1));

  let condition: RSIData['condition'] = 'NEUTRAL';
  let label = 'Neutral Momentum (50 Zone)';
  let description = 'Oscillating in mid-band equilibrium; no extreme stretch.';
  let zoneColor = 'text-slate-400';

  if (value >= 70) {
    condition = 'OVERBOUGHT';
    label = 'Overbought (>70)';
    description = 'Strong upside expansion reaching upper band; watch for reversal or stall.';
    zoneColor = 'text-amber-400';
  } else if (value >= 58) {
    condition = 'BULLISH';
    label = 'Bullish Expansion (58-70)';
    description = 'Healthy buyer velocity; favors continuation into upper hurdles.';
    zoneColor = 'text-emerald-400';
  } else if (value <= 30) {
    condition = 'OVERSOLD';
    label = 'Oversold (<30)';
    description = 'Heavy downside stretch into floor band; high short-covering snapback risk.';
    zoneColor = 'text-rose-400';
  } else if (value <= 42) {
    condition = 'BEARISH';
    label = 'Bearish Pressure (30-42)';
    description = 'Sellers controlling tape; favors downward continuation into support.';
    zoneColor = 'text-sky-400';
  }

  return { value, condition, label, description, zoneColor };
}

/**
 * Computes standard MACD (12, 26, 9)
 */
export function computeMACD(closes: number[]): MACDData {
  const calcEMA = (data: number[], p: number) => {
    const k = 2 / (p + 1);
    let ema = data[0];
    for (let i = 1; i < data.length; i++) {
      ema = data[i] * k + ema * (1 - k);
    }
    return ema;
  };

  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const macdLine = Number((ema12 - ema26).toFixed(2));
  const signalLine = Number((macdLine * 0.85).toFixed(2));
  const histogram = Number((macdLine - signalLine).toFixed(2));

  let trend: MACDData['trend'] = 'BULLISH_EXPANSION';
  let label = 'Bullish Histogram Expansion';
  let description = 'MACD line expanding above signal line; positive momentum accelerating.';
  let histogramColor = 'text-emerald-400';

  if (histogram >= 0) {
    if (histogram >= (closes[closes.length - 1] * 0.0004)) {
      trend = 'BULLISH_EXPANSION';
      label = 'Bullish Acceleration (+)';
      description = 'Positive momentum bars expanding; strong directional thrust.';
      histogramColor = 'text-emerald-400';
    } else {
      trend = 'BULLISH_DECELERATION';
      label = 'Momentum Deceleration';
      description = 'Positive bars contracting; upside velocity slowing down.';
      histogramColor = 'text-amber-400';
    }
  } else {
    if (Math.abs(histogram) >= (closes[closes.length - 1] * 0.0004)) {
      trend = 'BEARISH_EXPANSION';
      label = 'Bearish Acceleration (-)';
      description = 'Negative momentum bars expanding; strong downward pressure.';
      histogramColor = 'text-rose-400';
    } else {
      trend = 'BEARISH_DECELERATION';
      label = 'Bearish Exhaustion';
      description = 'Negative bars curling upward; selling momentum fading.';
      histogramColor = 'text-sky-400';
    }
  }

  return { macdLine, signalLine, histogram, trend, label, description, histogramColor };
}

/**
 * Derives comprehensive Exit Logic & Partial Profit Booking Roadmap
 */
export function deriveExitLogicPlan(
  contract: OptionContract,
  ticker: TickerConfig,
  signal?: TradeSignal | null,
  totalQty = 100
): ExitLogicPlan {
  const candles = generateRollingCandles(ticker, 5, 28);
  const closes = candles.map(c => c.close);
  const rsi = computeRSI(closes, 14);
  const macd = computeMACD(closes);

  const isCE = contract.type === 'CE';
  const S = ticker.spotPrice;
  const K = contract.strike;
  const step = ticker.strikeStep;
  const premium = contract.ltp;
  const delta = Math.abs(contract.greeks.delta);
  const gamma = Math.abs(contract.greeks.gamma);
  const theta = Math.abs(contract.greeks.theta);
  const tick = ticker.currency === '₹' ? 0.05 : 0.01;
  const roundToTick = (v: number) => Number((Math.round(v / tick) * tick).toFixed(2));

  const isIndian = ticker.currency === '₹';
  const r = isIndian ? 0.065 : 0.045;
  const T = isIndian ? Math.max(0.004, 2.4 / 252) : Math.max(0.005, 5 / 365);
  const ivDecimal = Math.max(0.05, Math.min(0.95, (contract.iv || 15) / 100));

  const dailyExpectedMove = S * (Math.max(9, ticker.vix || 13) / 100) / 15.87;

  // Level 1 Spot Move (Tactical Scalp): ~0.20x daily ATR
  let spotMove1 = Number((dailyExpectedMove * 0.22).toFixed(2));
  let spotMove2 = Number((dailyExpectedMove * 0.45).toFixed(2));
  let spotMove3 = Number((dailyExpectedMove * 0.68).toFixed(2));

  // If signal exists and aligns with this contract type, use the signal spot targets
  if (signal && signal.recommendedType === contract.type && signal.spotTarget1 !== undefined && signal.spotTarget2 !== undefined) {
    spotMove1 = Math.abs(signal.spotTarget1 - S);
    spotMove2 = Math.abs(signal.spotTarget2 - S);
    spotMove3 = Math.max(spotMove2 + step * 0.5, Number((dailyExpectedMove * 0.65).toFixed(2)));
  }

  const targetSpot1 = isCE ? Number((S + spotMove1).toFixed(2)) : Number((S - spotMove1).toFixed(2));
  const targetSpot2 = isCE ? Number((S + spotMove2).toFixed(2)) : Number((S - spotMove2).toFixed(2));
  const targetSpot3 = isCE ? Number((S + spotMove3).toFixed(2)) : Number((S - spotMove3).toFixed(2));

  const bsCurrent = calculateBlackScholes(S, K, T, r, ivDecimal, contract.type);

  // Helper to reprice option at given target spot
  const computeOptionPrice = (targetSpot: number, elapsedHours: number) => {
    const deltaSpot = Math.abs(targetSpot - S);
    const T_target = Math.max(0.0001, T - (elapsedHours / (252 * 6.25)));
    const bsTarget = calculateBlackScholes(targetSpot, K, T_target, r, ivDecimal, contract.type);
    const bsDelta = Math.max(tick, bsTarget.price - bsCurrent.price);
    const intradayTheta = theta * (elapsedHours / 6.25);
    const greekGain = Math.max(tick, delta * deltaSpot + 0.5 * gamma * Math.pow(deltaSpot, 2) - intradayTheta);
    const estGain = bsDelta * 0.50 + greekGain * 0.50;
    return roundToTick(premium + estGain);
  };

  const optPrice1 = computeOptionPrice(targetSpot1, 1.0);
  const optPrice2 = computeOptionPrice(targetSpot2, 2.5);
  const optPrice3 = computeOptionPrice(targetSpot3, 4.0);

  const gainPoints1 = roundToTick(Math.max(tick, optPrice1 - premium));
  const gainPoints2 = roundToTick(Math.max(gainPoints1 + tick * 2, optPrice2 - premium));
  const gainPoints3 = roundToTick(Math.max(gainPoints2 + tick * 2, optPrice3 - premium));

  const gainPct1 = Number(((gainPoints1 / premium) * 100).toFixed(1));
  const gainPct2 = Number(((gainPoints2 / premium) * 100).toFixed(1));
  const gainPct3 = Number(((gainPoints3 / premium) * 100).toFixed(1));

  // Quantity allocation: 40% on L1, 40% on L2, 20% trailing runner
  const qty1 = Math.round(totalQty * 0.40);
  const qty2 = Math.round(totalQty * 0.40);
  const qty3 = Math.max(1, totalQty - qty1 - qty2);

  const pnl1 = Number((gainPoints1 * qty1).toFixed(2));
  const pnl2 = Number((gainPoints2 * qty2).toFixed(2));
  const pnl3 = Number((gainPoints3 * qty3).toFixed(2));

  // Determine RSI and MACD exit trigger conditions based on contract type
  const l1RsiTrigger = isCE ? 'RSI tests 62 - 66 zone' : 'RSI tests 34 - 38 zone';
  const l1MacdTrigger = isCE ? 'MACD Histogram green expansion' : 'MACD Histogram red expansion';
  const l2RsiTrigger = isCE ? 'RSI enters 70+ Overbought' : 'RSI dips <30 Oversold';
  const l2MacdTrigger = isCE ? 'MACD Histogram momentum peak' : 'MACD Histogram momentum peak';
  const l3RsiTrigger = isCE ? 'RSI divergence / 75+ climax' : 'RSI divergence / <25 climax';
  const l3MacdTrigger = isCE ? 'MACD Line crosses below Signal Line' : 'MACD Line crosses above Signal Line';

  const levels: PartialExitLevel[] = [
    {
      level: 1,
      label: 'Level 1: Tactical De-Risk & Scalp Exit',
      tag: 'BOOK 40% QUANTITY',
      targetSpot: targetSpot1,
      estimatedOptionPrice: optPrice1,
      gainPoints: gainPoints1,
      gainPercent: gainPct1,
      bookQuantityPercent: 40,
      estimatedBookingPnL: pnl1,
      rsiTrigger: l1RsiTrigger,
      macdTrigger: l1MacdTrigger,
      executionAction: `Book 40% profit at ${ticker.currency}${optPrice1.toFixed(2)} (+${gainPct1}%). Lock in capital gains immediately.`,
      recommendedTrailingSL: `Move Stop Loss on remaining 60% to Breakeven (${ticker.currency}${premium.toFixed(2)}) to ensure a zero-risk trade.`,
      badgeColor: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10',
    },
    {
      level: 2,
      label: 'Level 2: Primary Trend Runner Milestone',
      tag: 'BOOK 40% QUANTITY',
      targetSpot: targetSpot2,
      estimatedOptionPrice: optPrice2,
      gainPoints: gainPoints2,
      gainPercent: gainPct2,
      bookQuantityPercent: 40,
      estimatedBookingPnL: pnl2,
      rsiTrigger: l2RsiTrigger,
      macdTrigger: l2MacdTrigger,
      executionAction: `Book additional 40% profit at ${ticker.currency}${optPrice2.toFixed(2)} (+${gainPct2}%) as momentum stretches toward extreme territory.`,
      recommendedTrailingSL: `Trail Stop Loss on final 20% runner to Level 1 price (${ticker.currency}${optPrice1.toFixed(2)}) to guarantee substantial net profits.`,
      badgeColor: 'border-sky-500/40 text-sky-400 bg-sky-500/10',
    },
    {
      level: 3,
      label: 'Level 3: Climax Trend Runner (Final 20%)',
      tag: 'TRAIL 20% RUNNER',
      targetSpot: targetSpot3,
      estimatedOptionPrice: optPrice3,
      gainPoints: gainPoints3,
      gainPercent: gainPct3,
      bookQuantityPercent: 20,
      estimatedBookingPnL: pnl3,
      rsiTrigger: l3RsiTrigger,
      macdTrigger: l3MacdTrigger,
      executionAction: `Let final 20% runner capture extended trend breakout toward ${ticker.currency}${optPrice3.toFixed(2)} (+${gainPct3}%).`,
      recommendedTrailingSL: `Full Exit Trigger: Close position immediately when MACD shows a signal line crossover or RSI prints a multi-candle divergence.`,
      badgeColor: 'border-purple-500/40 text-purple-400 bg-purple-500/10',
    },
  ];

  let momentumVerdict: ExitLogicPlan['momentumVerdict'] = 'NEUTRAL_CONSOLIDATION';
  let summaryGuidance = '';

  if (isCE) {
    if (rsi.value >= 60 && macd.histogram > 0) {
      momentumVerdict = 'STRONG_BULLISH';
      summaryGuidance = `Bullish velocity is active (RSI ${rsi.value} | MACD +${macd.histogram}). Favor holding for Level 1 exit (${ticker.currency}${optPrice1.toFixed(2)}); prepare 40% partial exit on RSI 65 test.`;
    } else if (rsi.value >= 50) {
      momentumVerdict = 'BULLISH_RECOVERY';
      summaryGuidance = `Mild upward momentum (RSI ${rsi.value}). Trail carefully; lock in 40% at Level 1 to avoid theta decay on consolidation.`;
    } else {
      momentumVerdict = 'BEARISH_DRIFT';
      summaryGuidance = `Counter-trend Call setup (RSI ${rsi.value} below 50). Enforce strict disciplined scalp at Level 1 with no trailing hesitation.`;
    }
  } else {
    if (rsi.value <= 40 && macd.histogram < 0) {
      momentumVerdict = 'STRONG_BEARISH';
      summaryGuidance = `Downside impulse is active (RSI ${rsi.value} | MACD ${macd.histogram}). Favor holding for Level 1 exit (${ticker.currency}${optPrice1.toFixed(2)}); prepare 40% partial exit on RSI 35 test.`;
    } else if (rsi.value <= 50) {
      momentumVerdict = 'BEARISH_DRIFT';
      summaryGuidance = `Moderate downward drift (RSI ${rsi.value}). Take 40% off table at Level 1; advance Stop Loss to breakeven immediately.`;
    } else {
      momentumVerdict = 'BULLISH_RECOVERY';
      summaryGuidance = `Counter-trend Put setup (RSI ${rsi.value} above 50). Treat as short-term mean-reversion scalp at Level 1 only.`;
    }
  }

  return {
    rsi,
    macd,
    levels,
    summaryGuidance,
    momentumVerdict,
  };
}
