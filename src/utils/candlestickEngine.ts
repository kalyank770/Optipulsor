import { TickerConfig, Candle, TimeframeCandleAnalysis, MultiTimeframeChartPatterns } from '../types/options';

/**
 * In-memory cache for real exchange candles
 */
const realCandlesMap = new Map<string, { m2?: Candle[]; m5?: Candle[]; m15?: Candle[]; h1?: Candle[]; d1?: Candle[]; w1?: Candle[] }>();

export function setGlobalRealCandles(
  symbol: string, 
  candles: { m2?: Candle[]; m5?: Candle[]; m15?: Candle[]; h1?: Candle[]; d1?: Candle[]; w1?: Candle[] }
) {
  if (!symbol) return;
  const s = symbol.trim().toUpperCase();
  realCandlesMap.set(symbol, candles);
  realCandlesMap.set(s, candles);
  realCandlesMap.set(s.replace(/\s+/g, ''), candles);
  if (s.includes('NIFTY')) {
    realCandlesMap.set('NIFTY', candles);
    realCandlesMap.set('NIFTY 50', candles);
    realCandlesMap.set('NIFTY50', candles);
  } else if (s.includes('BANK')) {
    realCandlesMap.set('BANKNIFTY', candles);
    realCandlesMap.set('BANK NIFTY', candles);
  }
}

export function getGlobalRealCandles(symbol?: string) {
  if (!symbol) return undefined;
  const s = symbol.trim().toUpperCase();
  return realCandlesMap.get(symbol) || 
         realCandlesMap.get(s) || 
         realCandlesMap.get(s.replace(/\s+/g, '')) ||
         (s.includes('NIFTY') ? (realCandlesMap.get('NIFTY 50') || realCandlesMap.get('NIFTY') || realCandlesMap.get('NIFTY50')) : undefined) ||
         (s.includes('BANK') ? (realCandlesMap.get('BANK NIFTY') || realCandlesMap.get('BANKNIFTY')) : undefined);
}

/**
 * Format timestamp to HH:mm string
 */
function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

/**
 * Generates rolling candlestick series for a given timeframe (in minutes)
 * anchored on live spot price, previous close, day's high/low, and ongoing momentum.
 * PRIORITIZES REAL LIVE EXCHANGE CANDLES when available.
 */
export function generateRollingCandles(
  ticker: TickerConfig,
  timeframeMinutes: number,
  count = 15
): Candle[] {
  const S = ticker.spotPrice;

  // 1. If REAL exchange candles exist for this symbol & timeframe, use them directly!
  const realStore = getGlobalRealCandles(ticker.symbol);
  const tfKey = timeframeMinutes === 2 ? 'm2' : timeframeMinutes === 5 ? 'm5' : timeframeMinutes === 15 ? 'm15' : null;
  if (tfKey && realStore && realStore[tfKey] && realStore[tfKey]!.length > 0) {
    const raw = realStore[tfKey]!.map(c => ({ ...c }));
    if (raw.length > 0) {
      // Fold trailing zero-range closing auction ticks into previous real candle
      if (raw.length >= 2) {
        const last = raw[raw.length - 1];
        if (last.open === last.close && last.high === last.low && (last.volume === 0 || last.volume == null)) {
          const prev = raw[raw.length - 2];
          prev.close = last.close;
          prev.high = Math.max(prev.high, last.close);
          prev.low = Math.min(prev.low, last.close);
          raw.pop();
        }
      }
      // Anchor latest forming candle to live spot price
      raw[raw.length - 1] = {
        ...raw[raw.length - 1],
        close: S,
        high: Math.max(raw[raw.length - 1].high, S),
        low: Math.min(raw[raw.length - 1].low, S),
      };
      return raw.slice(-count);
    }
  }

  const changePct = ticker.changePercent;
  const step = ticker.strikeStep;
  const now = Date.now();
  const tfMs = timeframeMinutes * 60 * 1000;

  // Determine true intraday direction:
  const dayHigh = ticker.dayHigh && ticker.dayHigh > S ? ticker.dayHigh : S + step * 0.7;
  const dayLow = ticker.dayLow && ticker.dayLow < S ? ticker.dayLow : S - step * 0.7;
  const dayRange = Math.max(step * 0.5, dayHigh - dayLow);
  const recoveryRatio = (S - dayLow) / dayRange; // 0 = at low, 1.0 = at high
  const recoveryFromLow = S - dayLow;

  const isIntradayBreakdown = recoveryRatio <= 0.32;
  const isIntradayRecovery = !isIntradayBreakdown && (recoveryRatio >= 0.50 || (recoveryRatio >= 0.38 && recoveryFromLow >= step * 0.75));
  const isUptrend = isIntradayBreakdown ? false : (isIntradayRecovery ? true : changePct >= 0);

  // Typical candle volatility scaled to timeframe
  const tfMult = timeframeMinutes === 2 ? 0.75 : timeframeMinutes === 5 ? 1.0 : 1.45;
  const candleVolatility = Math.max(step * 0.08, (S * (Math.max(10, ticker.vix || 13) / 100) / 15.87) * Math.sqrt(timeframeMinutes / 375) * tfMult);

  const candles: Candle[] = [];
  let currentClose = S;

  for (let i = 0; i < count; i++) {
    const candleTs = now - (i * tfMs);
    const timeStr = formatTime(candleTs);

    if (i === 0) {
      // Current forming candle at live spot
      const openOffset = (isUptrend ? -1 : 1) * candleVolatility * (0.25 + (timeframeMinutes === 2 ? 0.15 : timeframeMinutes === 5 ? 0.10 : 0.05));
      const open = Number((S + openOffset).toFixed(2));
      const high = Number((Math.max(S, open) + candleVolatility * 0.22 + 0.02).toFixed(2));
      const low = Number((Math.min(S, open) - candleVolatility * 0.22 - 0.02).toFixed(2));
      const volume = Math.round(18000 + Math.abs(Math.sin((candleTs / 60000) * 0.7 + timeframeMinutes)) * 24000);

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
      // Realistic trending waves walking backward:
      // In uptrend, previous closes are lower on average with natural 2-bar consolidation waves
      const phaseShift = timeframeMinutes === 2 ? 0.4 : timeframeMinutes === 5 ? 0.9 : 1.5;
      const wave = Math.sin(i * 0.75 + phaseShift);
      const isRetrace = (i % 4 === 2);
      const unit = candleVolatility * 0.42;
      const delta = isRetrace
        ? (isUptrend ? unit * 0.45 : -unit * 0.45)
        : (isUptrend ? -unit * (0.65 + Math.abs(wave) * 0.35) : unit * (0.65 + Math.abs(wave) * 0.35));

      const targetPrice = Math.max(dayLow, Math.min(dayHigh, currentClose + delta));
      const close = Number(targetPrice.toFixed(2));
      const open = Number((close + (isUptrend ? -1 : 1) * candleVolatility * 0.20 + Math.sin(i * 1.8 + phaseShift) * candleVolatility * 0.08).toFixed(2));
      const high = Number((Math.max(open, close) + Math.abs(Math.cos(i + phaseShift)) * candleVolatility * 0.20 + 0.02).toFixed(2));
      const low = Number((Math.min(open, close) - Math.abs(Math.sin(i + phaseShift)) * candleVolatility * 0.20 - 0.02).toFixed(2));
      const volume = Math.round(12000 + Math.abs(Math.sin(i + phaseShift)) * 28000);

      candles.unshift({
        time: timeStr,
        open,
        high,
        low,
        close,
        volume,
        timestamp: candleTs,
      });
      currentClose = close;
    }
  }

  // Ensure latest candle close matches live spot S exactly
  candles[candles.length - 1].close = S;

  return candles;
}

/**
 * Detects candlestick and chart patterns on a series of candles
 */
export function analyzeTimeframeCandles(
  candles: Candle[],
  timeframe: '2m' | '5m' | '15m',
  ticker: TickerConfig
): TimeframeCandleAnalysis {
  // 1. Sanitize candles: fold any trailing zero-range auction ticks
  const cleanCandles = [...candles];
  if (cleanCandles.length >= 2) {
    const last = cleanCandles[cleanCandles.length - 1];
    if (last.open === last.close && last.high === last.low && (last.volume === 0 || last.volume == null)) {
      const prev = cleanCandles[cleanCandles.length - 2];
      prev.close = last.close;
      prev.high = Math.max(prev.high, last.close);
      prev.low = Math.min(prev.low, last.close);
      cleanCandles.pop();
    }
  }

  if (cleanCandles.length < 3) {
    const dummy = cleanCandles[cleanCandles.length - 1] || {
      time: '12:00', open: ticker.spotPrice, high: ticker.spotPrice, low: ticker.spotPrice, close: ticker.spotPrice, volume: 1000, timestamp: Date.now()
    };
    return {
      timeframe,
      candles: cleanCandles,
      latestCandle: dummy,
      trend: 'SIDEWAYS',
      pattern: 'Consolidation',
      patternBias: 'NEUTRAL',
      resistance: ticker.spotPrice + ticker.strikeStep,
      support: ticker.spotPrice - ticker.strikeStep,
      atr: ticker.strikeStep * 0.2,
      momentumScore: 0,
      measuredMoveTarget: ticker.spotPrice,
    };
  }

  // 2. Calculate True Range & ATR
  let trSum = 0;
  for (let i = 1; i < cleanCandles.length; i++) {
    const c = cleanCandles[i];
    const p = cleanCandles[i - 1];
    const tr = Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close));
    trSum += tr;
  }
  const rawAtr = trSum / (cleanCandles.length - 1);
  const atr = Number(Math.max(ticker.strikeStep * 0.08, rawAtr).toFixed(2));

  // 3. Highs and Lows of recent window (last 6-8 candles)
  const windowSize = Math.min(8, cleanCandles.length);
  const recentWindow = cleanCandles.slice(-windowSize);
  const highestRecent = Math.max(...recentWindow.map(c => c.high));
  const lowestRecent = Math.min(...recentWindow.map(c => c.low));
  const resistance = Number(highestRecent.toFixed(2));
  const support = Number(lowestRecent.toFixed(2));
  const swingRange = Number((highestRecent - lowestRecent).toFixed(2));

  // 4. Candle anatomy of latest, prev, prev2, prev3
  const latest = cleanCandles[cleanCandles.length - 1];
  const prev = cleanCandles[cleanCandles.length - 2];
  const prev2 = cleanCandles[cleanCandles.length - 3] || prev;
  const prev3 = cleanCandles[cleanCandles.length - 4] || prev2;

  const body = Math.abs(latest.close - latest.open);
  const range = Math.max(0.01, latest.high - latest.low);
  const isGreen = latest.close >= latest.open;
  const isRed = latest.close < latest.open;
  const upperWick = latest.high - Math.max(latest.open, latest.close);
  const lowerWick = Math.min(latest.open, latest.close) - latest.low;
  const bodyWickRatio = Number((body / Math.max(0.01, upperWick + lowerWick)).toFixed(2));

  const prevBody = Math.abs(prev.close - prev.open);
  const prevIsRed = prev.close < prev.open;
  const prevIsGreen = prev.close >= prev.open;

  // 5. Exponential Moving Average (EMA 9) & SMA 5
  const emaPeriod = Math.min(9, cleanCandles.length);
  const k = 2 / (emaPeriod + 1);
  let ema9 = cleanCandles[0].close;
  for (let i = 1; i < cleanCandles.length; i++) {
    ema9 = cleanCandles[i].close * k + ema9 * (1 - k);
  }
  ema9 = Number(ema9.toFixed(2));

  const smaPeriod = Math.min(5, cleanCandles.length);
  const sma5 = cleanCandles.slice(-smaPeriod).reduce((acc, c) => acc + c.close, 0) / smaPeriod;

  // 6. Displacement & Velocity
  const singleBarVelocity = Number(((latest.close - prev.close) / Math.max(0.1, atr)).toFixed(2));
  const candleVelocity = singleBarVelocity;
  const multiBarDisplacement = latest.close - prev3.close;
  const multiBarVelocity = Number((multiBarDisplacement / (Math.max(0.1, atr) * 1.73)).toFixed(2));
  const vwapProximity = Number(((latest.close - ema9) / ticker.strikeStep).toFixed(2));

  // 6b. Volume factor: Institutional volume backing vs low-volume drift
  const recentVolumes = cleanCandles.map(c => c.volume || 0).filter(v => v > 0);
  const avgVol = recentVolumes.length > 0 ? recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length : 0;
  const latestVol = latest.volume || 0;
  const volMultiplier = (avgVol > 0 && latestVol > 0)
    ? Number(Math.max(0.80, Math.min(1.30, 1.0 + ((latestVol - avgVol) / avgVol) * 0.20)).toFixed(2))
    : 1.0;

  // Recent candle direction counts
  const last4 = cleanCandles.slice(-4);
  const greenCount = last4.filter(c => c.close >= c.open).length;
  const redCount = last4.filter(c => c.close < c.open).length;

  // 7. Trend determination
  let trend: 'BULLISH' | 'BEARISH' | 'SIDEWAYS' = 'SIDEWAYS';
  if (latest.close > ema9 + atr * 0.15 && multiBarDisplacement > -atr * 0.15) {
    trend = 'BULLISH';
  } else if (latest.close < ema9 - atr * 0.15 && multiBarDisplacement < atr * 0.15) {
    trend = 'BEARISH';
  } else if (singleBarVelocity > 0.75 && greenCount >= 3) {
    trend = 'BULLISH';
  } else if (singleBarVelocity < -0.75 && redCount >= 3) {
    trend = 'BEARISH';
  }

  // 8. Breakout status
  let breakoutStatus: TimeframeCandleAnalysis['breakoutStatus'] = 'CONSOLIDATION';
  if (latest.close >= resistance - atr * 0.1 && isGreen) {
    breakoutStatus = 'BULLISH_BREAKOUT';
  } else if (latest.close <= support + atr * 0.1 && isRed) {
    breakoutStatus = 'BEARISH_BREAKOUT';
  } else if (Math.abs(latest.low - ema9) <= atr * 0.3 && trend === 'BULLISH') {
    breakoutStatus = 'PULLBACK_RETEST';
  }

  // 9. Pattern detection logic
  let pattern = 'Consolidation';
  let patternBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  let momentumScore = 0; // -10.0 to +10.0

  const isDoji = (body <= range * 0.18 && range >= atr * 0.35);
  const isCompression = range < Math.max(0.2, atr * 0.22);

  // Pattern A: True Doji / Inside Bar Compression
  if (isDoji) {
    pattern = `${timeframe} Equilibrium Doji (Indecision Star)`;
    patternBias = 'NEUTRAL';
    momentumScore = Number(Math.max(-2.5, Math.min(2.5, candleVelocity * 1.5)).toFixed(1));
  } else if (isCompression) {
    pattern = `${timeframe} Range Compression Box`;
    patternBias = trend === 'BULLISH' ? 'BULLISH' : trend === 'BEARISH' ? 'BEARISH' : 'NEUTRAL';
    momentumScore = trend === 'BULLISH' ? 3.5 : trend === 'BEARISH' ? -3.5 : 0.0;
  }
  // Pattern B: Three White Soldiers (Strong Bullish Continuation)
  else if (latest.close > prev.close && prev.close > prev2.close && isGreen && prevIsGreen && prev2.close >= prev2.open && body >= atr * 0.30) {
    pattern = `${timeframe} Three White Soldiers (Impulse Drive)`;
    patternBias = 'BULLISH';
    momentumScore = 8.8;
  }
  // Pattern C: Three Black Crows (Strong Bearish Continuation)
  else if (latest.close < prev.close && prev.close < prev2.close && isRed && prevIsRed && prev2.close < prev2.open && body >= atr * 0.30) {
    pattern = `${timeframe} Three Black Crows (Supply Avalanche)`;
    patternBias = 'BEARISH';
    momentumScore = -8.8;
  }
  // Pattern D: Bullish Engulfing (Demand Expansion)
  else if (isGreen && (prevIsRed || prevBody < body * 0.6) && latest.close > prev.open && (latest.open <= prev.close + atr * 0.10 || latest.low <= prev.low) && body > Math.max(prevBody * 1.02, atr * 0.35)) {
    pattern = `${timeframe} Bullish Engulfing (Demand Expansion)`;
    patternBias = 'BULLISH';
    momentumScore = 8.5;
  }
  // Pattern E: Bearish Engulfing (Supply Expansion)
  else if (isRed && (prevIsGreen || prevBody < body * 0.6) && latest.close < prev.open && (latest.open >= prev.close - atr * 0.10 || latest.high >= prev.high) && body > Math.max(prevBody * 1.02, atr * 0.35)) {
    pattern = `${timeframe} Bearish Engulfing (Supply Expansion)`;
    patternBias = 'BEARISH';
    momentumScore = -8.5;
  }
  // Pattern F: Bullish Pin Bar / Hammer (Support Rejection)
  else if (lowerWick >= Math.max(0.5, atr * 0.35) && lowerWick >= body * 1.4 && lowerWick >= upperWick * 1.6 && latest.low <= support + atr * 0.40) {
    pattern = `${timeframe} Bullish Pin Bar (Support Rejection)`;
    patternBias = 'BULLISH';
    momentumScore = trend === 'BULLISH' ? 7.8 : 6.0;
  }
  // Pattern G: Bearish Pin Bar / Shooting Star (Resistance Rejection)
  else if (upperWick >= Math.max(0.5, atr * 0.35) && upperWick >= body * 1.4 && upperWick >= lowerWick * 1.6 && latest.high >= resistance - atr * 0.40) {
    pattern = `${timeframe} Bearish Pin Bar (Resistance Rejection)`;
    patternBias = 'BEARISH';
    momentumScore = trend === 'BEARISH' ? -7.8 : -6.0;
  }
  // Pattern H: Morning Star Reversal (3-candle sequence)
  else if (prev2.close < prev2.open && Math.abs(prev.close - prev.open) < atr * 0.40 && isGreen && latest.close > (prev2.open + prev2.close) / 2) {
    pattern = `${timeframe} Morning Star Reversal`;
    patternBias = 'BULLISH';
    momentumScore = 8.2;
  }
  // Pattern I: Evening Star Reversal (3-candle sequence)
  else if (prev2.close > prev2.open && Math.abs(prev.close - prev.open) < atr * 0.40 && isRed && latest.close < (prev2.open + prev2.close) / 2) {
    pattern = `${timeframe} Evening Star Reversal`;
    patternBias = 'BEARISH';
    momentumScore = -8.2;
  }
  // Pattern J: Bullish Marubozu (Conviction Thrust)
  else if (isGreen && body >= range * 0.82 && body >= atr * 0.45) {
    pattern = `${timeframe} Bullish Marubozu (Conviction Thrust)`;
    patternBias = 'BULLISH';
    momentumScore = 8.4;
  }
  // Pattern K: Bearish Marubozu (Heavy Selling Thrust)
  else if (isRed && body >= range * 0.82 && body >= atr * 0.45) {
    pattern = `${timeframe} Bearish Marubozu (Heavy Selling Thrust)`;
    patternBias = 'BEARISH';
    momentumScore = -8.4;
  }
  // Pattern L: Higher Highs & Higher Lows (Ascending Impulse)
  else if (latest.high > prev.high && latest.close > prev.close && latest.low >= prev.low - atr * 0.1) {
    pattern = `${timeframe} Higher Highs & Lows (Ascending Impulse)`;
    patternBias = 'BULLISH';
    momentumScore = 7.2;
  }
  // Pattern M: Lower Highs & Lower Lows (Descending Impulse)
  else if (latest.low < prev.low && latest.close < prev.close && latest.high <= prev.high + atr * 0.1) {
    pattern = `${timeframe} Lower Highs & Lows (Descending Drift)`;
    patternBias = 'BEARISH';
    momentumScore = -7.2;
  }
  // Pattern N: Bull Flag Breakout (Momentum Continuation)
  else if (trend === 'BULLISH' && isGreen && body > atr * 0.35 && latest.close > prev.high) {
    pattern = `${timeframe} Bull Flag Breakout (Momentum Continuation)`;
    patternBias = 'BULLISH';
    momentumScore = 7.5;
  }
  // Pattern O: Bear Flag Breakdown (Downward Continuation)
  else if (trend === 'BEARISH' && isRed && body > atr * 0.35 && latest.close < prev.low) {
    pattern = `${timeframe} Bear Flag Breakdown (Downward Continuation)`;
    patternBias = 'BEARISH';
    momentumScore = -7.5;
  }
  // Pattern P: Counter-Trend Pullback / Healthy Retracement
  else if (trend === 'BULLISH' && isRed) {
    pattern = `${timeframe} Healthy Pullback to Support / EMA`;
    patternBias = 'BULLISH';
    momentumScore = Number(Math.max(1.2, Math.min(4.2, 3.2 + candleVelocity * 0.8)).toFixed(1));
  } else if (trend === 'BEARISH' && isGreen) {
    pattern = `${timeframe} Bear Relief Bounce to EMA`;
    patternBias = 'BEARISH';
    momentumScore = Number(Math.min(-1.2, Math.max(-4.2, -3.2 + candleVelocity * 0.8)).toFixed(1));
  }
  // Pattern Q: Default Trend Alignment with Velocity Scaling
  else if (trend === 'BULLISH') {
    pattern = `${timeframe} Ascending Channel Continuation`;
    patternBias = 'BULLISH';
    momentumScore = Number(Math.min(8.8, Math.max(2.2, 5.0 + candleVelocity * 1.2 + multiBarVelocity * 0.6)).toFixed(1));
  } else if (trend === 'BEARISH') {
    pattern = `${timeframe} Descending Channel Continuation`;
    patternBias = 'BEARISH';
    momentumScore = Number(Math.max(-8.8, Math.min(-2.2, -5.0 + candleVelocity * 1.2 + multiBarVelocity * 0.6)).toFixed(1));
  } else {
    pattern = `${timeframe} Range Bound Oscillation`;
    patternBias = 'NEUTRAL';
    momentumScore = Number(Math.max(-3.0, Math.min(3.0, candleVelocity * 1.4)).toFixed(1));
  }

  // Calculate Measured Move Target based on pattern and timeframe swing
  const swingHeight = Math.max(atr * 1.2, resistance - support);
  let measuredMoveTarget = latest.close;

  if (patternBias === 'BULLISH') {
    measuredMoveTarget = Number((latest.close + (timeframe === '15m' ? swingHeight * 1.618 : swingHeight * 1.0)).toFixed(2));
  } else if (patternBias === 'BEARISH') {
    measuredMoveTarget = Number((latest.close - (timeframe === '15m' ? swingHeight * 1.618 : swingHeight * 1.0)).toFixed(2));
  } else {
    measuredMoveTarget = trend === 'BULLISH' 
      ? Number((resistance + atr * 0.5).toFixed(2)) 
      : Number((support - atr * 0.5).toFixed(2));
  }

  return {
    timeframe,
    candles: cleanCandles,
    latestCandle: latest,
    trend,
    pattern,
    patternBias,
    resistance,
    support,
    atr,
    momentumScore: Number(Math.max(-10, Math.min(10, momentumScore * volMultiplier)).toFixed(1)),
    candleVelocity,
    bodyWickRatio,
    swingRange,
    vwapProximity,
    breakoutStatus,
    measuredMoveTarget,
  };
}

/**
 * Combines 2m, 5m, and 15m candlesticks into a cohesive multi-timeframe pattern engine
 */
export function computeMultiTimeframeChartPatterns(
  ticker: TickerConfig
): MultiTimeframeChartPatterns {
  // Generate rolling candles for 2m, 5m, and 15m with rich session depth
  const c2m = generateRollingCandles(ticker, 2, 30);
  const c5m = generateRollingCandles(ticker, 5, 45);
  const c15m = generateRollingCandles(ticker, 15, 24);

  const m2 = analyzeTimeframeCandles(c2m, '2m', ticker);
  const m5 = analyzeTimeframeCandles(c5m, '5m', ticker);
  const m15 = analyzeTimeframeCandles(c15m, '15m', ticker);

  const m2Score = m2.momentumScore;
  const m5Score = m5.momentumScore;
  const m15Score = m15.momentumScore;

  // Real 15m Opening Range (ORB): first 3 candles of the 5m session
  let orbHigh: number | undefined;
  let orbLow: number | undefined;
  let orbStatus: MultiTimeframeChartPatterns['orbStatus'] = 'FORMING';
  if (c5m.length >= 3) {
    const orbBars = c5m.slice(0, 3);
    orbHigh = Number(Math.max(...orbBars.map(c => c.high)).toFixed(2));
    orbLow = Number(Math.min(...orbBars.map(c => c.low)).toFixed(2));
    if (ticker.spotPrice > orbHigh + ticker.strikeStep * 0.05) {
      orbStatus = 'BULLISH_ORB_BREAKOUT';
    } else if (ticker.spotPrice < orbLow - ticker.strikeStep * 0.05) {
      orbStatus = 'BEARISH_ORB_BREAKDOWN';
    } else {
      orbStatus = 'INSIDE_ORB_RANGE';
    }
  }

  // Aggregate volume confirmation multiplier across 5m session
  const recentVols = c5m.map(c => c.volume || 0).filter(v => v > 0);
  const avgVol = recentVols.length > 0 ? recentVols.reduce((a, b) => a + b, 0) / recentVols.length : 0;
  const latestVol = c5m[c5m.length - 1]?.volume || 0;
  const volumeConfirmationMultiplier = avgVol > 0 && latestVol > 0
    ? Number(Math.max(0.75, Math.min(1.40, 1.0 + ((latestVol - avgVol) / avgVol) * 0.25)).toFixed(2))
    : 1.0;

  // Compute aggregate momentum index: weighted combination (15m: 40%, 5m: 35%, 2m: 25%)
  const aggregateMomentumIndex = Number((
    m15Score * 0.40 +
    m5Score * 0.35 +
    m2Score * 0.25
  ).toFixed(1));

  let orbAdjustment = 0;
  if (orbStatus === 'BULLISH_ORB_BREAKOUT') orbAdjustment = 1.2;
  else if (orbStatus === 'BEARISH_ORB_BREAKDOWN') orbAdjustment = -1.2;

  const confluenceScore = Number(Math.max(-10, Math.min(10, aggregateMomentumIndex + orbAdjustment)).toFixed(1));

  let confluenceBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  let momentumAlignment: MultiTimeframeChartPatterns['momentumAlignment'] = 'NEUTRAL_MIXED';

  if (confluenceScore >= 5.0 && m2Score > 0 && m5Score > 0 && m15Score > 0) {
    confluenceBias = 'BULLISH';
    momentumAlignment = 'FULL_BULLISH_CONFLUENCE';
  } else if (confluenceScore >= 2.0) {
    confluenceBias = 'BULLISH';
    momentumAlignment = 'MODERATE_BULLISH';
  } else if (confluenceScore <= -5.0 && m2Score < 0 && m5Score < 0 && m15Score < 0) {
    confluenceBias = 'BEARISH';
    momentumAlignment = 'FULL_BEARISH_CONFLUENCE';
  } else if (confluenceScore <= -2.0) {
    confluenceBias = 'BEARISH';
    momentumAlignment = 'MODERATE_BEARISH';
  } else {
    confluenceBias = 'NEUTRAL';
    momentumAlignment = 'NEUTRAL_MIXED';
  }

  // Build descriptive confluence pattern headline
  let confluencePattern = '';
  if (confluenceBias === 'BULLISH') {
    confluencePattern = `15m ${m15.trend} Structure (${m15Score > 0 ? '+' : ''}${m15Score}) + 5m ${m5?.pattern?.replace(/5m\s*/, '') || ''} (${m5Score > 0 ? '+' : ''}${m5Score}) + 2m Trigger (${m2Score > 0 ? '+' : ''}${m2Score})`;
  } else if (confluenceBias === 'BEARISH') {
    confluencePattern = `15m ${m15.trend} Pressure (${m15Score}) + 5m ${m5?.pattern?.replace(/5m\s*/, '') || ''} (${m5Score}) + 2m Breakdown (${m2Score})`;
  } else {
    confluencePattern = `Multi-Timeframe Equilibrium (2m: ${m2Score > 0 ? '+' : ''}${m2Score} | 5m: ${m5Score > 0 ? '+' : ''}${m5Score} | 15m: ${m15Score > 0 ? '+' : ''}${m15Score})`;
  }

  const S = ticker.spotPrice;
  const step = ticker.strikeStep;
  const vix = Math.max(9, ticker.vix || 13);
  const dailyExpectedMove = S * (vix / 100) / 15.87;

  // Tactical Swing Points (2m + 5m measured move)
  const tacticalSwingPoints = Number(Math.max(step * 0.40, Math.min(dailyExpectedMove * 0.32, Math.max(m5.atr * 1.35, m2.atr * 2.1))).toFixed(2));
  
  // Structural Runner Points (15m measured move + Fibonacci extension)
  const structuralSwingPoints = Number(Math.max(tacticalSwingPoints + step * 0.35, Math.min(dailyExpectedMove * 0.60, Math.max(m15.atr * 2.4, dailyExpectedMove * 0.44))).toFixed(2));

  // Invalidation SL Points (2m/5m swing low/high cushion)
  const invalidationPoints = Number(Math.max(step * 0.25, Math.min(dailyExpectedMove * 0.18, Math.max(m5.atr * 0.75, dailyExpectedMove * 0.12))).toFixed(2));

  // Directional targets and invalidation levels
  const bullishExitLevel1 = Number((S + tacticalSwingPoints).toFixed(2));
  const bearishExitLevel1 = Number((S - tacticalSwingPoints).toFixed(2));
  const bullishExitLevel2 = Number((S + structuralSwingPoints).toFixed(2));
  const bearishExitLevel2 = Number((S - structuralSwingPoints).toFixed(2));
  const bullishInvalidationLevel = Number((S - invalidationPoints).toFixed(2));
  const bearishInvalidationLevel = Number((S + invalidationPoints).toFixed(2));

  // Derived Exit Levels for UI presentation
  let derivedExitLevel1 = S;
  let derivedExitLevel2 = S;
  let invalidationLevel = S;

  if (confluenceBias === 'BULLISH') {
    derivedExitLevel1 = bullishExitLevel1;
    derivedExitLevel2 = bullishExitLevel2;
    invalidationLevel = bullishInvalidationLevel;
  } else if (confluenceBias === 'BEARISH') {
    derivedExitLevel1 = bearishExitLevel1;
    derivedExitLevel2 = bearishExitLevel2;
    invalidationLevel = bearishInvalidationLevel;
  } else {
    derivedExitLevel1 = ticker.changePercent >= 0 ? bullishExitLevel1 : bearishExitLevel1;
    derivedExitLevel2 = ticker.changePercent >= 0 ? bullishExitLevel2 : bearishExitLevel2;
    invalidationLevel = ticker.changePercent >= 0 ? bullishInvalidationLevel : bearishInvalidationLevel;
  }

  return {
    m2,
    m5,
    m15,
    m2Score,
    m5Score,
    m15Score,
    aggregateMomentumIndex,
    momentumAlignment,
    tacticalSwingPoints,
    structuralSwingPoints,
    invalidationPoints,
    confluencePattern,
    confluenceBias,
    confluenceScore,
    derivedExitLevel1,
    derivedExitLevel2,
    invalidationLevel,
    bullishExitLevel1,
    bearishExitLevel1,
    bullishExitLevel2,
    bearishExitLevel2,
    bullishInvalidationLevel,
    bearishInvalidationLevel,
    orbHigh,
    orbLow,
    orbStatus,
    volumeConfirmationMultiplier,
  };
}
