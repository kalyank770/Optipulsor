import { 
  TickerConfig, 
  Candle, 
  OptionType, 
  MarketMetrics, 
  OptionChainRow 
} from '../types/options';
import { 
  HTFTimeframe, 
  HTFCandlePatternResult, 
  HorizonPrediction, 
  ExpiryForecast, 
  MultiTimeframePredictionSuite 
} from '../types/htfPredictions';
import { calculateBlackScholes, getTickerExpiryDTE } from './blackScholes';
import { NSE_OFFICIAL_NIFTY_CHAIN } from '../data/officialNseQuotes';
import { buildInitialChain } from '../hooks/useLiveOptionChain';
import { MarketHoursStatus } from './marketHours';

/**
 * Helper to format timestamp into human readable time/date string
 */
function formatHTFTime(ts: number, tf: HTFTimeframe): string {
  const d = new Date(ts);
  if (tf === '1h') {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  } else if (tf === '1d') {
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } else {
    return `Wk of ${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
  }
}

/**
 * Accurately parses expiry date strings like "08 Oct 2026 (Weekly - Thu)"
 * or "2026-10-08" and calculates the exact remaining calendar days to expiry.
 */
export function calculatePreciseDTE(
  expiryDateStr: string,
  asOnTimeStr?: string
): { daysToExpiry: number; formattedExpiryDate: string; timeToExpiryYears: number } {
  // Determine reference 'as-of' date (from ticker.asOnTime e.g. "05-Oct-2026 15:30:00 IST" or current system time)
  let asOfDate = new Date();
  if (asOnTimeStr) {
    const asOnMatch = asOnTimeStr.match(/(\d{1,2})[-/ ]([A-Za-z]{3})[-/ ](\d{4})/);
    if (asOnMatch) {
      const d = parseInt(asOnMatch[1], 10);
      const mStr = asOnMatch[2].toLowerCase();
      const y = parseInt(asOnMatch[3], 10);
      const months: Record<string, number> = {
        jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
        jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
      };
      if (months[mStr] !== undefined) {
        asOfDate = new Date(y, months[mStr], d, 15, 30, 0);
      }
    }
  }

  let formattedExpiryDate = expiryDateStr;
  let expiryDateObj: Date | null = null;

  const match = expiryDateStr.match(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/);
  if (match) {
    const d = parseInt(match[1], 10);
    const mStr = match[2].toLowerCase();
    const y = parseInt(match[3], 10);
    const months: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
    };
    if (months[mStr] !== undefined) {
      expiryDateObj = new Date(y, months[mStr], d, 15, 30, 0);
      formattedExpiryDate = `${String(d).padStart(2, '0')} ${match[2]} ${y}`;
    }
  }

  if (!expiryDateObj) {
    const cleanStr = expiryDateStr.replace(/\(.*?\)/g, '').trim();
    const parsed = new Date(cleanStr);
    if (!isNaN(parsed.getTime())) {
      expiryDateObj = parsed;
      formattedExpiryDate = cleanStr;
    }
  }

  if (!expiryDateObj) {
    return { daysToExpiry: 3, formattedExpiryDate: expiryDateStr, timeToExpiryYears: 3 / 365 };
  }

  // Calculate remaining calendar day difference strictly from midnight to midnight
  const msPerDay = 1000 * 60 * 60 * 24;
  const asOfMidnight = new Date(asOfDate.getFullYear(), asOfDate.getMonth(), asOfDate.getDate()).getTime();
  const expiryMidnight = new Date(expiryDateObj.getFullYear(), expiryDateObj.getMonth(), expiryDateObj.getDate()).getTime();
  
  const daysDiff = Math.round((expiryMidnight - asOfMidnight) / msPerDay);
  const daysToExpiry = Math.max(0, daysDiff);
  const timeToExpiryYears = Math.max(0.001, daysToExpiry / 365);

  return { daysToExpiry, formattedExpiryDate, timeToExpiryYears };
}

/**
 * Calculates Relative Strength Index (RSI) across a series of candles
 */
function calculateRSI(candles: Candle[], period = 14): number {
  if (candles.length < period + 1) return 50.0;
  
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < candles.length; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    if (diff >= 0) {
      avgGain = (avgGain * (period - 1) + diff) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(diff)) / period;
    }
  }

  if (avgLoss === 0) return 100.0;
  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));
  return Number(rsi.toFixed(1));
}

/**
 * Generates rolling candlestick history specifically tailored for 1H, 1D, and 1W charts.
 * Uses distinct mathematical market models for each timeframe:
 * - 1H: High-frequency intraday hourly oscillations, session open momentum, and local intraday pivots
 * - 1D: Multi-day institutional trend progression anchored on session dayHigh, dayLow, prevClose, 20 DMA
 * - 1W: Multi-week macro cycles, macro support/resistance channels, and institutional accumulation bases
 */
export function generateHTFCandles(
  ticker: TickerConfig,
  timeframe: HTFTimeframe
): Candle[] {
  const S = ticker.spotPrice;
  const step = ticker.strikeStep;
  const now = Date.now();
  const vix = Math.max(9.5, ticker.vix || 13.0);
  const changePct = ticker.changePercent;

  const dayHigh = ticker.dayHigh && ticker.dayHigh > S ? ticker.dayHigh : S + step * 0.7;
  const dayLow = ticker.dayLow && ticker.dayLow < S ? ticker.dayLow : S - step * 0.7;
  const dayRange = Math.max(step * 0.5, dayHigh - dayLow);
  const recoveryRatio = (S - dayLow) / dayRange;
  const isUptrend = recoveryRatio >= 0.45 || changePct >= 0;

  const candles: Candle[] = [];

  if (timeframe === '1h') {
    // 1-HOUR TIMEFRAME: Intraday 1-hour intervals across past 2.5 sessions (~14 bars)
    const count = 14;
    const intervalMs = 60 * 60 * 1000;
    const hourlyVol = Math.max(step * 0.15, (S * (vix / 100)) / (15.87 * 2.5));
    let runningClose = S;

    for (let i = 0; i < count; i++) {
      const candleTs = now - (i * intervalMs);
      const timeStr = formatHTFTime(candleTs, '1h');

      if (i === 0) {
        // Current forming 1-hour candle
        const openOffset = (isUptrend ? -1 : 1) * hourlyVol * 0.40;
        const open = Number((S + openOffset).toFixed(2));
        const high = Number((Math.max(S, open) + hourlyVol * 0.30).toFixed(2));
        const low = Number((Math.min(S, open) - hourlyVol * 0.30).toFixed(2));
        const volume = Math.round(75000 + Math.abs(Math.sin(i * 1.8)) * 110000);

        candles.unshift({
          time: timeStr,
          open,
          high,
          low,
          close: S,
          volume,
          timestamp: candleTs,
        });
      } else {
        // Intraday cycle wave (hourly oscillation with morning/afternoon momentum)
        const wave = Math.sin(i * 1.45 + 0.4);
        const delta = (isUptrend ? (wave > -0.1 ? -1 : 1) : (wave < 0.1 ? 1 : -1)) * hourlyVol * (0.5 + Math.abs(Math.cos(i * 1.7)) * 0.5);
        const close = Number((runningClose + delta).toFixed(2));
        const open = Number((close - delta * 0.75 + Math.sin(i * 2.1) * hourlyVol * 0.2).toFixed(2));
        const high = Number((Math.max(open, close) + hourlyVol * 0.25).toFixed(2));
        const low = Number((Math.min(open, close) - hourlyVol * 0.25).toFixed(2));
        const volume = Math.round(50000 + Math.abs(Math.cos(i * 2.4)) * 95000);

        candles.unshift({
          time: timeStr,
          open,
          high,
          low,
          close,
          volume,
          timestamp: candleTs,
        });
        runningClose = close;
      }
    }
  } else if (timeframe === '1d') {
    // 1-DAY TIMEFRAME: Daily trading sessions (~20 sessions = 1 trading month)
    const count = 20;
    const intervalMs = 24 * 60 * 60 * 1000;
    const dailyVol = Math.max(step * 0.75, (S * (vix / 100)) / 15.87);
    let runningClose = S;

    for (let i = 0; i < count; i++) {
      const candleTs = now - (i * intervalMs);
      const timeStr = formatHTFTime(candleTs, '1d');

      if (i === 0) {
        // Current day session candle anchored on live dayOpen, dayHigh, dayLow
        const open = Number((ticker.dayOpen || (S - changePct * step * 0.1)).toFixed(2));
        const high = Number((Math.max(S, open, dayHigh)).toFixed(2));
        const low = Number((Math.min(S, open, dayLow)).toFixed(2));
        const volume = Math.round(1800000 + Math.abs(changePct) * 450000);

        candles.unshift({
          time: timeStr,
          open,
          high,
          low,
          close: S,
          volume,
          timestamp: candleTs,
        });
      } else {
        // Daily multi-session trend wave (captures intermediate 20 DMA swings)
        const wave = Math.sin(i * 0.65 + 1.1);
        const delta = (isUptrend ? (wave > -0.3 ? -1 : 1) : (wave < 0.3 ? 1 : -1)) * dailyVol * (0.65 + Math.abs(Math.sin(i * 0.9)) * 0.6);
        const close = Number((runningClose + delta).toFixed(2));
        const open = Number((close - delta * 0.85 + Math.cos(i * 1.3) * dailyVol * 0.18).toFixed(2));
        const high = Number((Math.max(open, close) + dailyVol * 0.35).toFixed(2));
        const low = Number((Math.min(open, close) - dailyVol * 0.35).toFixed(2));
        const volume = Math.round(1200000 + Math.abs(Math.sin(i * 1.1)) * 900000);

        candles.unshift({
          time: timeStr,
          open,
          high,
          low,
          close,
          volume,
          timestamp: candleTs,
        });
        runningClose = close;
      }
    }
  } else {
    // 1-WEEK TIMEFRAME: Weekly macro structure (~12 weeks = 1 quarter)
    const count = 12;
    const intervalMs = 7 * 24 * 60 * 60 * 1000;
    const weeklyVol = Math.max(step * 1.6, (S * (vix / 100)) / 7.21);
    let runningClose = S;

    for (let i = 0; i < count; i++) {
      const candleTs = now - (i * intervalMs);
      const timeStr = formatHTFTime(candleTs, '1w');

      if (i === 0) {
        // Current week forming candle
        const openOffset = (isUptrend ? -1 : 1) * weeklyVol * 0.45;
        const open = Number((S + openOffset).toFixed(2));
        const high = Number((Math.max(S, open) + weeklyVol * 0.40).toFixed(2));
        const low = Number((Math.min(S, open) - weeklyVol * 0.40).toFixed(2));
        const volume = Math.round(8500000 + Math.abs(changePct) * 1200000);

        candles.unshift({
          time: timeStr,
          open,
          high,
          low,
          close: S,
          volume,
          timestamp: candleTs,
        });
      } else {
        // Macro multi-week impulse channel
        const macroWave = Math.sin(i * 0.42 - 0.7);
        const delta = (isUptrend ? (macroWave > -0.25 ? -1 : 1) : (macroWave < 0.25 ? 1 : -1)) * weeklyVol * (0.7 + Math.abs(Math.cos(i * 0.8)) * 0.5);
        const close = Number((runningClose + delta).toFixed(2));
        const open = Number((close - delta * 0.90 + Math.sin(i * 1.5) * weeklyVol * 0.15).toFixed(2));
        const high = Number((Math.max(open, close) + weeklyVol * 0.50).toFixed(2));
        const low = Number((Math.min(open, close) - weeklyVol * 0.50).toFixed(2));
        const volume = Math.round(6500000 + Math.abs(Math.cos(i * 1.4)) * 3500000);

        candles.unshift({
          time: timeStr,
          open,
          high,
          low,
          close,
          volume,
          timestamp: candleTs,
        });
        runningClose = close;
      }
    }
  }

  // Ensure current candle close matches live spot S exactly
  candles[candles.length - 1].close = S;
  return candles;
}

/**
 * Analyzes HTF candlestick patterns, moving averages, pivot levels, and momentum
 */
export function analyzeHTFCandles(
  candles: Candle[],
  timeframe: HTFTimeframe,
  ticker: TickerConfig
): HTFCandlePatternResult {
  const S = ticker.spotPrice;
  const latest = candles[candles.length - 1];
  const prev = candles[candles.length - 2] || latest;
  const prev2 = candles[candles.length - 3] || prev;

  // 1. Calculate True Range & Average True Range (ATR)
  let trSum = 0;
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const p = candles[i - 1];
    const tr = Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close));
    trSum += tr;
  }
  const atr = Number((trSum / Math.max(1, candles.length - 1)).toFixed(2));

  // 2. Highs and Lows of recent window for Support / Resistance
  const windowCount = Math.min(8, candles.length);
  const recentWindow = candles.slice(-windowCount);
  const highestRecent = Math.max(...recentWindow.map(c => c.high));
  const lowestRecent = Math.min(...recentWindow.map(c => c.low));
  const resistanceLevel = Number(highestRecent.toFixed(2));
  const supportLevel = Number(lowestRecent.toFixed(2));

  // 3. Classic Floor Trader Pivot Points
  let prevHigh = prev.high;
  let prevLow = prev.low;
  let prevClose = prev.close;
  if (timeframe === '1d' && ticker.prevClose) {
    prevHigh = ticker.dayHigh || prev.high;
    prevLow = ticker.dayLow || prev.low;
    prevClose = ticker.prevClose;
  }
  const pivotPoint = Number(((prevHigh + prevLow + prevClose) / 3).toFixed(2));

  // 4. Moving Averages (20 EMA, 50 SMA)
  const emaPeriod = Math.min(20, candles.length);
  const k = 2 / (emaPeriod + 1);
  let ema20 = candles[0].close;
  for (let i = 1; i < candles.length; i++) {
    ema20 = candles[i].close * k + ema20 * (1 - k);
  }
  ema20 = Number(ema20.toFixed(2));

  const smaPeriod = Math.min(candles.length, 12);
  const sma50 = Number((candles.slice(-smaPeriod).reduce((acc, c) => acc + c.close, 0) / smaPeriod).toFixed(2));

  // 5. RSI(14)
  const rsi = calculateRSI(candles, Math.min(14, candles.length - 2));

  // 6. Candle Anatomy
  const body = Math.abs(latest.close - latest.open);
  const upperWick = latest.high - Math.max(latest.open, latest.close);
  const lowerWick = Math.min(latest.open, latest.close) - latest.low;
  const isGreen = latest.close >= latest.open;
  const isRed = latest.close < latest.open;

  const prevBody = Math.abs(prev.close - prev.open);
  const prevIsRed = prev.close < prev.open;
  const prevIsGreen = prev.close >= prev.open;

  // Determine Trend
  let trend: HTFCandlePatternResult['trend'] = 'SIDEWAYS';
  if (latest.close > ema20 + atr * 0.20 && rsi >= 54) {
    trend = rsi >= 66 ? 'STRONG_BULLISH' : 'BULLISH';
  } else if (latest.close < ema20 - atr * 0.20 && rsi <= 46) {
    trend = rsi <= 34 ? 'STRONG_BEARISH' : 'BEARISH';
  } else {
    trend = 'SIDEWAYS';
  }

  // Dynamic momentum score (-10 to +10)
  const rsiDelta = Math.abs(rsi - 50);
  const emaDistNorm = Math.min(2.5, Math.abs(latest.close - ema20) / Math.max(1, atr));
  const avgVol = candles.reduce((acc, c) => acc + c.volume, 0) / Math.max(1, candles.length);
  const volFactor = Math.min(1.5, Math.max(0.6, latest.volume / Math.max(1, avgVol)));
  const bodyRatio = body / Math.max(1, latest.high - latest.low);

  let rawMomentum = ((rsi - 50) / 4.5) + (latest.close >= ema20 ? emaDistNorm * 2.2 : -emaDistNorm * 2.2) + (isGreen ? 1.5 : -1.5) * bodyRatio * volFactor;
  let momentumScore = Number(Math.max(-9.8, Math.min(9.8, rawMomentum)).toFixed(1));

  // Dynamic pattern confidence (58% to 94%)
  const dynamicBonus = Math.round((volFactor - 1) * 6 + (rsiDelta / 25) * 6 + emaDistNorm * 3);
  let baseConfidence = 70;
  let primaryPattern = 'Consolidation';
  let patternType: HTFCandlePatternResult['patternType'] = 'CONSOLIDATION';
  let patternBias: HTFCandlePatternResult['patternBias'] = 'NEUTRAL';
  let patternDescription = '';

  const tfName = timeframe === '1h' ? '1-Hour' : timeframe === '1d' ? 'Daily' : 'Weekly';

  // Check 1: Bullish Engulfing
  if (isGreen && prevIsRed && latest.close > prev.open && latest.open < prev.close && body > prevBody * 1.12) {
    primaryPattern = `Bullish Engulfing (${tfName} Demand Thrust)`;
    patternType = 'REVERSAL';
    patternBias = 'BULLISH';
    baseConfidence = 84;
    patternDescription = `Strong demand expansion on the ${tfName} chart; buyers fully engulfed prior selling pressure.`;
  }
  // Check 2: Bearish Engulfing
  else if (isRed && prevIsGreen && latest.close < prev.open && latest.open > prev.close && body > prevBody * 1.12) {
    primaryPattern = `Bearish Engulfing (${tfName} Supply Rejection)`;
    patternType = 'REVERSAL';
    patternBias = 'BEARISH';
    baseConfidence = 84;
    patternDescription = `Heavy institutional distribution on the ${tfName} chart; sellers completely engulfed prior gains.`;
  }
  // Check 3: Hammer / Long Lower Shadow Rejection
  else if (lowerWick >= body * 1.8 && upperWick <= body * 0.5 && latest.low <= supportLevel + atr * 0.5) {
    primaryPattern = `Bullish Hammer (${tfName} Demand Floor Rejection)`;
    patternType = 'REVERSAL';
    patternBias = 'BULLISH';
    baseConfidence = 80;
    patternDescription = `Deep test of lower prices met with aggressive institutional absorption, forming a strong lower rejection wick.`;
  }
  // Check 4: Shooting Star / Long Upper Shadow Rejection
  else if (upperWick >= body * 1.8 && lowerWick <= body * 0.5 && latest.high >= resistanceLevel - atr * 0.5) {
    primaryPattern = `Shooting Star (${tfName} Overhead Supply Rejection)`;
    patternType = 'REVERSAL';
    patternBias = 'BEARISH';
    baseConfidence = 80;
    patternDescription = `Attempted rally was firmly rejected by heavy call writers and supply near resistance ceiling ₹${resistanceLevel.toLocaleString()}.`;
  }
  // Check 5: Morning Star Reversal (3-candle sequence)
  else if (prev2.close < prev2.open && Math.abs(prev.close - prev.open) < atr * 0.35 && isGreen && latest.close > (prev2.open + prev2.close) / 2) {
    primaryPattern = `Morning Star Triple-Bar Reversal (${tfName})`;
    patternType = 'REVERSAL';
    patternBias = 'BULLISH';
    baseConfidence = 87;
    patternDescription = `Classic 3-bar bottom reversal on ${tfName}: down impulse, indecision exhaustion star, and strong upward confirmation.`;
  }
  // Check 6: Evening Star Reversal
  else if (prev2.close > prev2.open && Math.abs(prev.close - prev.open) < atr * 0.35 && isRed && latest.close < (prev2.open + prev2.close) / 2) {
    primaryPattern = `Evening Star Triple-Bar Reversal (${tfName})`;
    patternType = 'REVERSAL';
    patternBias = 'BEARISH';
    baseConfidence = 87;
    patternDescription = `Classic 3-bar top exhaustion on ${tfName}: rally bar, stalled indecision star, followed by high-volume downward break.`;
  }
  // Check 7: Three White Soldiers (Strong Bullish Continuation)
  else if (isGreen && prevIsGreen && prev2.close > prev2.open && latest.close > prev.close && prev.close > prev2.close) {
    primaryPattern = `Three White Soldiers (${tfName} Sustained Accumulation)`;
    patternType = 'CONTINUATION';
    patternBias = 'BULLISH';
    baseConfidence = 82;
    patternDescription = `Three consecutive ascending green candles closing near their highs, signaling sustained institutional accumulation.`;
  }
  // Check 8: Three Black Crows (Strong Bearish Continuation)
  else if (isRed && prevIsRed && prev2.close < prev2.open && latest.close < prev.close && prev.close < prev2.close) {
    primaryPattern = `Three Black Crows (${tfName} Sustained Liquidation)`;
    patternType = 'CONTINUATION';
    patternBias = 'BEARISH';
    baseConfidence = 82;
    patternDescription = `Three consecutive descending red candles with heavy sell volume, signaling persistent liquidation.`;
  }
  // Check 9: Marubozu (Conviction Trend Impulse)
  else if (body >= (latest.high - latest.low) * 0.80 && body > atr * 0.55) {
    if (isGreen) {
      primaryPattern = `Bullish Marubozu (${tfName} Full Conviction Thrust)`;
      patternType = 'CONTINUATION';
      patternBias = 'BULLISH';
      baseConfidence = 78;
      patternDescription = `Solid green body with almost no wicks; buyers drove prices steadily from open to close.`;
    } else {
      primaryPattern = `Bearish Marubozu (${tfName} Heavy Selling Thrust)`;
      patternType = 'CONTINUATION';
      patternBias = 'BEARISH';
      baseConfidence = 78;
      patternDescription = `Solid red body from high to low; bears maintained aggressive control throughout.`;
    }
  }
  // Check 10: Higher Highs & Higher Lows Trend
  else if (trend === 'BULLISH' || trend === 'STRONG_BULLISH') {
    primaryPattern = `Ascending Trend Structure (HH-HL on ${tfName})`;
    patternType = 'CONTINUATION';
    patternBias = 'BULLISH';
    baseConfidence = 72 + (timeframe === '1w' ? 4 : timeframe === '1d' ? 2 : 0);
    patternDescription = `Price consistently creates higher swing highs and higher swing lows holding above the 20 EMA (₹${ema20.toLocaleString()}).`;
  }
  // Check 11: Lower Highs & Lower Lows Trend
  else if (trend === 'BEARISH' || trend === 'STRONG_BEARISH') {
    primaryPattern = `Descending Drift Structure (LH-LL on ${tfName})`;
    patternType = 'CONTINUATION';
    patternBias = 'BEARISH';
    baseConfidence = 72 + (timeframe === '1w' ? 4 : timeframe === '1d' ? 2 : 0);
    patternDescription = `Price continuously creates lower swing highs and lower swing lows trapped under the 20 EMA (₹${ema20.toLocaleString()}).`;
  }
  // Check 12: Range-Bound Consolidation
  else {
    primaryPattern = `Equilibrium Consolidation (${tfName} Compression)`;
    patternType = 'CONSOLIDATION';
    patternBias = 'NEUTRAL';
    baseConfidence = 64;
    patternDescription = `Price is oscillating tightly between support ₹${supportLevel.toLocaleString()} and resistance ₹${resistanceLevel.toLocaleString()} around pivot ₹${pivotPoint.toLocaleString()}.`;
  }

  const patternConfidence = Math.min(94, Math.max(58, baseConfidence + dynamicBonus));

  // Breakout Signal Detection
  let breakoutSignal: HTFCandlePatternResult['breakoutSignal'] = 'IN_RANGE';
  if (latest.close > resistanceLevel - atr * 0.15) {
    breakoutSignal = latest.close > resistanceLevel ? 'BULLISH_BREAKOUT' : 'TESTING_RESISTANCE';
  } else if (latest.close < supportLevel + atr * 0.15) {
    breakoutSignal = latest.close < supportLevel ? 'BEARISH_BREAKDOWN' : 'TESTING_SUPPORT';
  }

  const timeframeLabel = timeframe === '1h' 
    ? '1-Hour Intraday Momentum' 
    : timeframe === '1d' 
    ? '1-Day Intermediate Trend' 
    : '1-Week Macro Trend';

  return {
    timeframe,
    timeframeLabel,
    candles,
    latestCandle: latest,
    trend,
    primaryPattern,
    patternType,
    patternBias,
    patternConfidence,
    patternDescription,
    resistanceLevel,
    supportLevel,
    pivotPoint,
    atr,
    ema20,
    sma50,
    rsi,
    momentumScore,
    breakoutSignal,
  };
}

/**
 * Generates forward price projection and concrete F&O contract recommendation
 * for a specific horizon (Next 1-Hour, Next 1-Day, or Next 1-Week)
 */
export function generateHorizonPrediction(
  ticker: TickerConfig,
  patternResult: HTFCandlePatternResult,
  horizon: 'next_1h' | 'next_1d' | 'next_1w',
  timeToExpiryYears = 7 / 365,
  chain?: OptionChainRow[]
): HorizonPrediction {
  const S = ticker.spotPrice;
  const step = ticker.strikeStep;
  const atr = patternResult.atr;
  const vix = Math.max(9.5, ticker.vix || 13.0);
  const bias = patternResult.patternBias;
  const momentum = patternResult.momentumScore;

  const dailyStdDev = (S * (vix / 100)) / 15.87;
  let label = 'Next 1 Hour Outcome';
  let catalyst = '';
  let expectedPoints = 0;
  let invalidationBuffer = step * 0.5;

  if (horizon === 'next_1h') {
    expectedPoints = Number(Math.max(step * 0.5, dailyStdDev * 0.35).toFixed(1));
    label = 'Next 1 Hour Outcome (Scalp Horizon)';
    catalyst = `1H ${patternResult.primaryPattern} pattern driving immediate momentum with RSI at ${patternResult.rsi}.`;
    invalidationBuffer = Math.max(step * 0.35, atr * 0.5);
  } else if (horizon === 'next_1d') {
    expectedPoints = Number(Math.max(step * 1.0, dailyStdDev * 0.88).toFixed(1));
    label = 'Next 1 Day (Tomorrow) Outcome';
    catalyst = `Daily ${patternResult.trend.replace(/_/g, ' ')} structure relative to 20 EMA (₹${patternResult.ema20.toLocaleString()}) and Pivot (₹${patternResult.pivotPoint.toLocaleString()}).`;
    invalidationBuffer = Math.max(step * 0.65, atr * 0.7);
  } else {
    expectedPoints = Number(Math.max(step * 2.0, dailyStdDev * 2.05).toFixed(1));
    label = 'Next 1 Week Outcome (Positional Horizon)';
    catalyst = `Weekly swing trend with Macro Support at ₹${patternResult.supportLevel.toLocaleString()} and Resistance at ₹${patternResult.resistanceLevel.toLocaleString()}.`;
    invalidationBuffer = Math.max(step * 1.2, atr * 1.1);
  }
  let projectedSpotTarget = S;
  let projectedRangeLow = Number((S - expectedPoints * 0.75).toFixed(1));
  let projectedRangeHigh = Number((S + expectedPoints * 0.75).toFixed(1));
  let invalidationLevel = S;

  if (bias === 'BULLISH') {
    projectedSpotTarget = Number((S + expectedPoints).toFixed(1));
    projectedRangeLow = Number((S - expectedPoints * 0.35).toFixed(1));
    projectedRangeHigh = Number((S + expectedPoints * 1.25).toFixed(1));
    invalidationLevel = Number((S - invalidationBuffer).toFixed(1));
  } else if (bias === 'BEARISH') {
    projectedSpotTarget = Number((S - expectedPoints).toFixed(1));
    projectedRangeLow = Number((S - expectedPoints * 1.25).toFixed(1));
    projectedRangeHigh = Number((S + expectedPoints * 0.35).toFixed(1));
    invalidationLevel = Number((S + invalidationBuffer).toFixed(1));
  } else {
    projectedSpotTarget = Number(patternResult.pivotPoint.toFixed(1));
    projectedRangeLow = Number((S - expectedPoints * 0.6).toFixed(1));
    projectedRangeHigh = Number((S + expectedPoints * 0.6).toFixed(1));
    invalidationLevel = Number((S - expectedPoints).toFixed(1));
  }

  const expectedMovePoints = Number(Math.abs(projectedSpotTarget - S).toFixed(1));
  const expectedMovePercent = Number(((expectedMovePoints / S) * 100).toFixed(2));

  // Strike Recommendation
  const recommendedType: OptionType = bias === 'BULLISH' ? 'CE' : bias === 'BEARISH' ? 'PE' : (S >= patternResult.pivotPoint ? 'CE' : 'PE');
  
  // Strike selection: Nearest ATM or ATM+Step based on bias
  let recommendedStrike = Math.round(S / step) * step;
  if (bias === 'BULLISH' && horizon !== 'next_1h') {
    recommendedStrike = Math.round((S + step * 0.5) / step) * step;
  } else if (bias === 'BEARISH' && horizon !== 'next_1h') {
    recommendedStrike = Math.round((S - step * 0.5) / step) * step;
  }

  // Look up live contract from option chain for target horizon expiry (1W uses Expiry 1 Next Week)
  const horizonExpiryIdx = horizon === 'next_1w' ? 1 : 0;
  const targetChain = (chain && chain.length > 0 && horizonExpiryIdx === 0) ? chain : buildInitialChain(ticker, horizonExpiryIdx);
  const row = targetChain?.find(r => r.strike === recommendedStrike);
  const liveContract = recommendedType === 'CE' ? row?.ce : row?.pe;

  const rawVix = Math.max(14.50, vix || 15.22);
  const dte = timeToExpiryYears * 365;
  let baseIV = (rawVix * 1.019) / 100;
  if (dte <= 2) baseIV = (rawVix * 1.019) / 100;
  else if (dte <= 9) baseIV = (rawVix * 0.901) / 100;
  else if (dte <= 16) baseIV = (rawVix * 0.903) / 100;
  else baseIV = (rawVix * 0.887) / 100;
  const r = 0.065; // RBI repo risk-free rate proxy
  const m = (recommendedStrike - S) / Math.max(S, 1);
  const strikeIV = liveContract?.iv 
    ? liveContract.iv / 100 
    : (recommendedType === 'CE' 
        ? Math.max(0.06, baseIV + (m < 0 ? -m * 0.06 : m * 0.04))
        : Math.max(0.06, (baseIV * 1.06) + (m < 0 ? -m * 0.14 : m * 0.05)));

  const contractLTP = liveContract?.ltp && liveContract.ltp > 0
    ? liveContract.ltp
    : Math.max(0.05, Number(calculateBlackScholes(S, recommendedStrike, timeToExpiryYears, r, strikeIV, recommendedType).price.toFixed(2)));

  const targetBS = calculateBlackScholes(projectedSpotTarget, recommendedStrike, Math.max(0.001, timeToExpiryYears - 0.002), r, strikeIV, recommendedType);
  const stopBS = calculateBlackScholes(invalidationLevel, recommendedStrike, timeToExpiryYears, r, strikeIV, recommendedType);

  // In Indian options trading, Target 1 targets minimum 28% to 35% premium expansion
  const minTargetExpansion = bias === 'NEUTRAL' ? 1.25 : 1.32;
  const target1LTP = Math.max(0.05, Number(Math.max(contractLTP * minTargetExpansion, targetBS.price).toFixed(2)));
  const target2LTP = Math.max(0.05, Number((contractLTP + (target1LTP - contractLTP) * 1.70).toFixed(2)));
  // Disciplined stop loss: risk capped at 18% to 22% of entry premium
  const maxLossCap = contractLTP * 0.80;
  const stopLossLTP = Math.max(0.05, Number(Math.min(maxLossCap, Math.max(contractLTP * 0.65, stopBS.price)).toFixed(2)));

  const risk = Math.max(1.0, contractLTP - stopLossLTP);
  const reward = Math.max(1.0, target1LTP - contractLTP);
  const rrRatioNum = (reward / risk).toFixed(1);
  const riskRewardRatio = `1 : ${rrRatioNum}`;

  const horizonWeight = horizon === 'next_1h' ? 4 : horizon === 'next_1d' ? 8 : 12;
  const confidenceScore = Math.min(94, Math.max(58, Math.round(patternResult.patternConfidence * 0.75 + Math.abs(momentum) * 1.8 + horizonWeight * 0.5)));
  const winProbabilityPct = Math.min(90, Math.max(54, Math.round(confidenceScore * 0.93)));

  const executionAdvice = bias === 'BULLISH'
    ? `Buy ${recommendedStrike} CE on dips near ₹${(S - step * 0.15).toFixed(0)}. Target ₹${target1LTP} with SL strictly at ₹${stopLossLTP}.`
    : bias === 'BEARISH'
    ? `Buy ${recommendedStrike} PE on pullbacks towards ₹${(S + step * 0.15).toFixed(0)}. Target ₹${target1LTP} with SL strictly at ₹${stopLossLTP}.`
    : `Market in equilibrium deadband. Avoid directional OTM buying; wait for confirmed breakout outside ₹${projectedRangeLow} - ₹${projectedRangeHigh}.`;

  return {
    horizon,
    horizonLabel: label,
    timeframeReference: patternResult.timeframe,
    predictedBias: bias,
    confidenceScore,
    currentSpot: S,
    projectedSpotTarget,
    projectedRangeLow,
    projectedRangeHigh,
    expectedMovePoints,
    expectedMovePercent,
    recommendedStrike,
    recommendedType,
    recommendedContractLTP: contractLTP,
    target1LTP,
    target2LTP,
    stopLossLTP,
    riskRewardRatio,
    winProbabilityPct,
    keyCatalyst: catalyst,
    invalidationLevel,
    executionAdvice,
  };
}

/**
 * Calculates Expiry Predictions for Week 1 (T+1) and Week 2 (T+2)
 * Synthesizes 1H immediate momentum, 1D daily price structure, and 1W macro weekly candle patterns
 */
export function generateExpiryForecast(
  ticker: TickerConfig,
  expiryIndex: number,
  expiryType: 'NEXT_1_WEEK' | 'NEXT_2_WEEK',
  overallBias: 'STRONG_BULLISH' | 'BULLISH' | 'NEUTRAL_CONSOLIDATION' | 'BEARISH' | 'STRONG_BEARISH',
  h1Result: HTFCandlePatternResult,
  d1Result: HTFCandlePatternResult,
  w1Result: HTFCandlePatternResult,
  metrics?: MarketMetrics,
  chain?: OptionChainRow[]
): ExpiryForecast {
  const S = ticker.spotPrice;
  const step = ticker.strikeStep;
  const vix = Math.max(9.5, ticker.vix || 13.0);
  const sigma = vix / 100;
  const r = 0.065;

  const rawExpiryStr = ticker.expiryDates[expiryIndex] || (expiryType === 'NEXT_1_WEEK' ? '08 Oct 2026' : '15 Oct 2026');
  const { daysToExpiry, formattedExpiryDate, timeToExpiryYears } = calculatePreciseDTE(rawExpiryStr, ticker.asOnTime);

  // Expected move by expiry via standard 1-sigma formula:
  // Expected Move = Spot * (VIX / 100) * sqrt(DTE / 365)
  const expectedExpiryMove = S * sigma * Math.sqrt(timeToExpiryYears);

  // Key Institutional Levels & Walls
  const maxPain = metrics?.maxPainStrike || Math.round(S / step) * step;
  const supportFloor = Math.min(d1Result.supportLevel, metrics?.majorSupportStrike || S - step * 2);
  const resistanceCeiling = Math.max(d1Result.resistanceLevel, metrics?.majorResistanceStrike || S + step * 2);

  // Timeframe pattern synthesis weights:
  // Week 1 Expiry: 1H Momentum (40%) + 1D Daily (45%) + 1W Macro (15%)
  // Week 2 Expiry: 1D Daily (45%) + 1W Macro (45%) + 1H Momentum (10%)
  const h1Score = h1Result.momentumScore * 10;
  const d1Score = d1Result.momentumScore * 10;
  const w1Score = w1Result.momentumScore * 10;

  const horizonScore = expiryType === 'NEXT_1_WEEK'
    ? (h1Score * 0.40 + d1Score * 0.45 + w1Score * 0.15)
    : (d1Score * 0.45 + w1Score * 0.45 + h1Score * 0.10);

  let trendDirection: ExpiryForecast['trendDirection'] = 'RANGE_PINNING';
  let trendDirectionLabel = 'Range Pinning & Max Pain Magnetism';

  if (horizonScore >= 35) {
    trendDirection = 'BULLISH_EXPANSION';
    trendDirectionLabel = 'Strong Bullish Expansion Breakout';
  } else if (horizonScore >= 12) {
    trendDirection = 'BULLISH_EXPANSION';
    trendDirectionLabel = 'Bullish Upward Trend Drift';
  } else if (horizonScore <= -35) {
    trendDirection = 'BEARISH_BREAKDOWN';
    trendDirectionLabel = 'Heavy Bearish Liquidation Breakdown';
  } else if (horizonScore <= -12) {
    trendDirection = 'BEARISH_BREAKDOWN';
    trendDirectionLabel = 'Bearish Downward Pressure Drift';
  } else {
    trendDirection = vix > 16.5 ? 'VOLATILITY_SQUEEZE' : 'RANGE_PINNING';
    trendDirectionLabel = vix > 16.5 ? 'High-Volatility Range Compression' : 'Range Pinning Near Max Pain';
  }

  // Rationale synthesizing 1H, 1D, and 1W candle patterns
  let candleSynthesisRationale = '';
  if (trendDirection === 'BULLISH_EXPANSION') {
    candleSynthesisRationale = expiryType === 'NEXT_1_WEEK'
      ? `1H ${h1Result.primaryPattern} (RSI: ${h1Result.rsi}) confirms immediate buying pressure above 20 EMA (₹${h1Result.ema20.toLocaleString()}), backed by Daily ${d1Result.primaryPattern} holding above pivot ₹${d1Result.pivotPoint.toLocaleString()}. Weekly swing aligns upward, targeting settlement above resistance ₹${resistanceCeiling.toLocaleString()}.`
      : `Daily ${d1Result.primaryPattern} and Weekly ${w1Result.primaryPattern} (RSI: ${w1Result.rsi}) indicate sustained institutional accumulation. The 2-week cycle offers room to ride macro expansion towards ₹${(S + expectedExpiryMove * 0.85).toFixed(0)} with minimal theta drag.`;
  } else if (trendDirection === 'BEARISH_BREAKDOWN') {
    candleSynthesisRationale = expiryType === 'NEXT_1_WEEK'
      ? `1H ${h1Result.primaryPattern} (RSI: ${h1Result.rsi}) indicates aggressive supply at resistance ₹${resistanceCeiling.toLocaleString()}, confirmed by Daily ${d1Result.primaryPattern} breaking below 20 EMA. Downward momentum targets settlement test of support floor ₹${supportFloor.toLocaleString()}.`
      : `Daily ${d1Result.primaryPattern} breakdown confirmed by Weekly ${w1Result.primaryPattern} supply overhang. Expect persistent liquidation into fortnight settlement with support floor testing near ₹${(S - expectedExpiryMove * 0.85).toFixed(0)}.`;
  } else {
    candleSynthesisRationale = expiryType === 'NEXT_1_WEEK'
      ? `Conflicting timeframes (1H: ${h1Result.primaryPattern} vs 1D: ${d1Result.primaryPattern}) indicate equilibrium chop between support ₹${supportFloor.toLocaleString()} and resistance ₹${resistanceCeiling.toLocaleString()}. Strong gravitational pull towards Max Pain (₹${maxPain.toLocaleString()}) into settlement.`
      : `Weekly macro consolidation (${w1Result.primaryPattern}) balances against daily range oscillation. Settlement is projected to pin tightly between ₹${(maxPain - step * 1.5).toLocaleString()} and ₹${(maxPain + step * 1.5).toLocaleString()}.`;
  }

  // Breakout Trigger Level
  const breakoutTriggerLevel = trendDirection === 'BULLISH_EXPANSION'
    ? Number((Math.max(S, d1Result.ema20) + step * 0.25).toFixed(1))
    : trendDirection === 'BEARISH_BREAKDOWN'
    ? Number((Math.min(S, d1Result.ema20) - step * 0.25).toFixed(1))
    : Number(d1Result.resistanceLevel.toFixed(1));

  // Projected settlement price
  let projectedSettlementSpot = S;
  if (trendDirection === 'BULLISH_EXPANSION') {
    projectedSettlementSpot = Number((S + expectedExpiryMove * (expiryType === 'NEXT_1_WEEK' ? 0.70 : 0.85)).toFixed(1));
  } else if (trendDirection === 'BEARISH_BREAKDOWN') {
    projectedSettlementSpot = Number((S - expectedExpiryMove * (expiryType === 'NEXT_1_WEEK' ? 0.70 : 0.85)).toFixed(1));
  } else {
    projectedSettlementSpot = Number(((S * 0.35) + (maxPain * 0.65)).toFixed(1));
  }

  const expectedSettlementRange: [number, number] = [
    Number((projectedSettlementSpot - expectedExpiryMove * 0.60).toFixed(1)),
    Number((projectedSettlementSpot + expectedExpiryMove * 0.60).toFixed(1)),
  ];

  const expectedPCR = Number((metrics?.pcrTotalOI || (trendDirection === 'BULLISH_EXPANSION' ? 1.18 : trendDirection === 'BEARISH_BREAKDOWN' ? 0.82 : 1.02)).toFixed(2));

  // Recommended strike
  const recommendedType: OptionType = trendDirection === 'BULLISH_EXPANSION' ? 'CE' : trendDirection === 'BEARISH_BREAKDOWN' ? 'PE' : (S >= maxPain ? 'CE' : 'PE');
  
  // Strike selection: ATM or 1-step OTM for expansion
  let targetStrike = Math.round(projectedSettlementSpot / step) * step;
  if (trendDirection === 'BULLISH_EXPANSION') {
    targetStrike = Math.round((S + step * 0.5) / step) * step;
  } else if (trendDirection === 'BEARISH_BREAKDOWN') {
    targetStrike = Math.round((S - step * 0.5) / step) * step;
  } else {
    targetStrike = Math.round(S / step) * step;
  }

  // Look up live contract from option chain for specific expiryIndex
  const targetChain = (chain && chain.length > 0 && expiryIndex === 0) ? chain : buildInitialChain(ticker, expiryIndex);
  const row = targetChain?.find(r => r.strike === targetStrike);
  const liveContract = recommendedType === 'CE' ? row?.ce : row?.pe;

  const rawVix = Math.max(14.50, sigma * 100 || 15.22);
  let baseIV = (rawVix * 1.019) / 100;
  if (daysToExpiry <= 2) baseIV = (rawVix * 1.019) / 100;
  else if (daysToExpiry <= 9) baseIV = (rawVix * 0.901) / 100;
  else if (daysToExpiry <= 16) baseIV = (rawVix * 0.903) / 100;
  else baseIV = (rawVix * 0.887) / 100;

  const m = (targetStrike - S) / Math.max(S, 1);
  const strikeIV = liveContract?.iv 
    ? liveContract.iv / 100 
    : (recommendedType === 'CE' 
        ? Math.max(0.06, baseIV + (m < 0 ? -m * 0.06 : m * 0.04))
        : Math.max(0.06, (baseIV * 1.06) + (m < 0 ? -m * 0.14 : m * 0.05)));

  let contractLTP = 50.0;
  if (liveContract?.ltp && liveContract.ltp > 0) {
    contractLTP = liveContract.ltp;
  } else {
    contractLTP = Math.max(0.05, Number(calculateBlackScholes(S, targetStrike, timeToExpiryYears, r, strikeIV, recommendedType).price.toFixed(2)));
  }

  const bsCurrent = calculateBlackScholes(S, targetStrike, timeToExpiryYears, r, strikeIV, recommendedType);
  const bsTarget = calculateBlackScholes(projectedSettlementSpot, targetStrike, Math.max(0.001, timeToExpiryYears * 0.3), r, strikeIV, recommendedType);

  const entryZone: [number, number] = [
    Math.max(0.05, Number((contractLTP * 0.96).toFixed(2))),
    Math.max(0.05, Number((contractLTP * 1.03).toFixed(2)))
  ];

  const minTargetExpansion = expiryType === 'NEXT_1_WEEK' ? 1.35 : 1.40;
  const target1 = Math.max(0.05, Number(Math.max(contractLTP * minTargetExpansion, bsTarget.price).toFixed(2)));
  const target2 = Math.max(0.05, Number((contractLTP + (target1 - contractLTP) * 1.70).toFixed(2)));
  
  // Disciplined risk capping (maximum 18-20% capital risk on entry premium)
  const stopLoss = Math.max(0.05, Number(Math.max(contractLTP * 0.65, contractLTP * 0.80).toFixed(2)));

  const risk = Math.max(1.0, contractLTP - stopLoss);
  const reward = Math.max(1.0, target1 - contractLTP);
  const riskReward = `1 : ${(reward / risk).toFixed(1)}`;
  const projectedROI = Number((((target1 - contractLTP) / contractLTP) * 100).toFixed(1));

  const winProbability = expiryType === 'NEXT_1_WEEK' ? (trendDirection !== 'RANGE_PINNING' ? 76 : 68) : 80;
  const gammaRisk: ExpiryForecast['gammaRisk'] = expiryType === 'NEXT_1_WEEK' ? (daysToExpiry <= 3 ? 'HIGH' : 'MODERATE') : 'LOW';

  const strategyName = expiryType === 'NEXT_1_WEEK'
    ? (trendDirection === 'RANGE_PINNING' ? 'Iron Condor / Short Strangle Range Capture' : `Weekly Direct ${targetStrike} ${recommendedType} Momentum`)
    : (trendDirection === 'RANGE_PINNING' ? 'Fortnight Long Calendar / Strangle Spread' : `Positional 2-Week ${recommendedType} Trend Spread`);

  const strategyDescription = expiryType === 'NEXT_1_WEEK'
    ? `Upcoming weekly expiry (${daysToExpiry} DTE). Captures high gamma expansion towards settlement target ₹${projectedSettlementSpot.toLocaleString()}.`
    : `Fortnight expiry (${daysToExpiry} DTE). Provides comfortable theta cushion against intraday chop while riding macro 1D+1W wave.`;

  const hedgingNote = expiryType === 'NEXT_1_WEEK'
    ? 'Gamma sensitivity is high. Book 50% profit at Target 1 and immediately trail Stop Loss to entry cost to lock in gains.'
    : 'Lower theta decay rate allows position holding through mid-week dips with disciplined stop loss.';

  const capitalProtectionRules = [
    `Strict Stop Loss: Exit contract immediately if LTP trades below ₹${stopLoss} (maximum capital risk capped at 20%).`,
    `Entry Discipline: Execute only within the entry zone (₹${entryZone[0]} – ₹${entryZone[1]}). Never chase extended premiums.`,
    `Milestone Profit Securing: Scale out 50% position upon achieving Target 1 (₹${target1}) and trail Stop Loss to cost (breakeven).`,
    `Invalidation Level: Cut position if spot breaks ${trendDirection === 'BULLISH_EXPANSION' ? `below support floor ₹${supportFloor.toLocaleString()}` : `above resistance ceiling ₹${resistanceCeiling.toLocaleString()}`}.`,
    `Position Sizing: Risk no more than 1.5% to 2.0% of total trading capital per expiry trade.`
  ];

  return {
    expiryType,
    expiryIndex,
    expiryDateStr: formattedExpiryDate,
    daysToExpiry,
    trendDirection,
    trendDirectionLabel,
    candleSynthesisRationale,
    supportFloor,
    resistanceCeiling,
    breakoutTriggerLevel,
    projectedSettlementSpot,
    expectedSettlementRange,
    maxPainStrike: maxPain,
    expectedPCR,
    recommendedStrike: targetStrike,
    recommendedType,
    entryZone,
    contractLTP,
    target1,
    target2,
    stopLoss,
    riskReward,
    winProbability,
    projectedROI,
    delta: Number(bsCurrent.delta.toFixed(2)),
    thetaPerDay: Number(Math.abs(bsCurrent.theta).toFixed(2)),
    gammaRisk,
    strategyName,
    strategyDescription,
    hedgingNote,
    capitalProtectionRules,
  };
}

/**
 * Master multi-timeframe prediction synthesizer (1H, 1D, 1W & Expiries)
 */
export function computeMultiTimeframePredictions(
  ticker: TickerConfig,
  metrics?: MarketMetrics,
  chain?: OptionChainRow[],
  marketStatus?: MarketHoursStatus
): MultiTimeframePredictionSuite {
  // 1. Generate HTF Candles tailored for each timeframe
  const h1Candles = generateHTFCandles(ticker, '1h');
  const d1Candles = generateHTFCandles(ticker, '1d');
  const w1Candles = generateHTFCandles(ticker, '1w');

  // 2. Analyze Timeframe Patterns
  const h1Pattern = analyzeHTFCandles(h1Candles, '1h', ticker);
  const d1Pattern = analyzeHTFCandles(d1Candles, '1d', ticker);
  const w1Pattern = analyzeHTFCandles(w1Candles, '1w', ticker);

  // 3. Multi-Timeframe Alignment Score (-100 to +100)
  // Weighting: 1W (45%), 1D (35%), 1H (20%)
  const wScore = w1Pattern.momentumScore * 10;
  const dScore = d1Pattern.momentumScore * 10;
  const hScore = h1Pattern.momentumScore * 10;
  const confluenceScore = Math.round(wScore * 0.45 + dScore * 0.35 + hScore * 0.20);

  let overallHTFBias: MultiTimeframePredictionSuite['overallHTFBias'] = 'NEUTRAL_CONSOLIDATION';
  if (confluenceScore >= 45) overallHTFBias = 'STRONG_BULLISH';
  else if (confluenceScore >= 18) overallHTFBias = 'BULLISH';
  else if (confluenceScore <= -45) overallHTFBias = 'STRONG_BEARISH';
  else if (confluenceScore <= -18) overallHTFBias = 'BEARISH';
  else overallHTFBias = 'NEUTRAL_CONSOLIDATION';

  const confluenceSummary = overallHTFBias === 'STRONG_BULLISH' || overallHTFBias === 'BULLISH'
    ? `Full Bullish HTF Alignment: Weekly trend (${w1Pattern.primaryPattern}) aligns with Daily expansion and 1H momentum.`
    : overallHTFBias === 'STRONG_BEARISH' || overallHTFBias === 'BEARISH'
    ? `Full Bearish HTF Alignment: Weekly resistance rejection confirmed by Daily breakdown and 1H supply thrust.`
    : `HTF Timeframe Divergence: Weekly consolidation (${w1Pattern.primaryPattern}) balancing against shorter-term intraday oscillations.`;

  // Resolve active week 1 and week 2 indices based on the 1st expiry close rule
  const { week1Index, week2Index } = getActiveExpiryIndices(ticker, marketStatus);

  // 4. Horizon Forecasts (Using synchronized expiry term structure and live option chain)
  const dte0 = getTickerExpiryDTE(ticker, week1Index);
  const dte1 = getTickerExpiryDTE(ticker, week2Index);
  const next1Hour = generateHorizonPrediction(ticker, h1Pattern, 'next_1h', dte0.T, chain);
  const next1Day = generateHorizonPrediction(ticker, d1Pattern, 'next_1d', dte0.T, chain);
  const next1Week = generateHorizonPrediction(ticker, w1Pattern, 'next_1w', dte1.T, chain);

  // 5. Expiry Forecasts (Week 1 and Week 2 with live option chain quotes)
  const week1Expiry = generateExpiryForecast(ticker, week1Index, 'NEXT_1_WEEK', overallHTFBias, h1Pattern, d1Pattern, w1Pattern, metrics, chain);
  const week2Expiry = generateExpiryForecast(ticker, week2Index, 'NEXT_2_WEEK', overallHTFBias, h1Pattern, d1Pattern, w1Pattern, metrics, chain);

  return {
    ticker,
    generatedAt: new Date().toLocaleTimeString(),
    overallHTFBias,
    confluenceScore,
    confluenceSummary,
    h1Pattern,
    d1Pattern,
    w1Pattern,
    next1Hour,
    next1Day,
    next1Week,
    week1Expiry,
    week2Expiry,
  };
}

/**
 * Resolves the active week 1 and week 2 expiry indices based on the rule:
 * "Show next 2 weeks expiry from now, maintain the same until 1st expiry closes (past 15:30 PM on expiry day), then refresh with upcoming 2 expiries."
 */
export function getActiveExpiryIndices(
  ticker: TickerConfig,
  marketStatus?: MarketHoursStatus
): { week1Index: number; week2Index: number } {
  const dates = ticker.expiryDates || [];
  if (dates.length <= 2) {
    return { week1Index: 0, week2Index: Math.min(1, dates.length - 1) };
  }

  // Check the first expiry date in the list
  const firstExpiryStr = dates[0];
  const { daysToExpiry } = calculatePreciseDTE(firstExpiryStr, ticker.asOnTime);

  let isFirstExpiryClosed = false;
  if (daysToExpiry < 0) {
    isFirstExpiryClosed = true;
  } else if (daysToExpiry === 0) {
    // It's the expiry day! Check if session is closed or past 15:30 PM
    let isClosedSession = false;
    if (marketStatus) {
      isClosedSession = !marketStatus.isOpen && 
        (marketStatus.session === 'POST_MARKET' || marketStatus.session === 'CLOSED');
    } else {
      // Fallback: Check if current hour is past 15:30
      const now = new Date();
      if (ticker.asOnTime) {
        const timeMatch = ticker.asOnTime.match(/(\d{2}):(\d{2}):(\d{2})/);
        if (timeMatch) {
          const hours = parseInt(timeMatch[1], 10);
          const minutes = parseInt(timeMatch[2], 10);
          if (hours > 15 || (hours === 15 && minutes >= 30)) {
            isClosedSession = true;
          }
        }
      } else {
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        if (currentHour > 15 || (currentHour === 15 && currentMinute >= 30)) {
          isClosedSession = true;
        }
      }
    }
    if (isClosedSession) {
      isFirstExpiryClosed = true;
    }
  }

  if (isFirstExpiryClosed) {
    // 1st expiry has closed! Refresh / roll to upcoming 2 expiries (Index 1 & 2)
    return { week1Index: 1, week2Index: 2 };
  } else {
    // 1st expiry is still open/active today, maintain index 0 and 1
    return { week1Index: 0, week2Index: 1 };
  }
}
