import { TickerConfig, Candle, TimeframeCandleAnalysis, MultiTimeframeChartPatterns } from '../types/options';

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
 */
export function generateRollingCandles(
  ticker: TickerConfig,
  timeframeMinutes: number,
  count = 15
): Candle[] {
  const S = ticker.spotPrice;
  const changePct = ticker.changePercent;
  const isUptrend = changePct >= 0;
  const step = ticker.strikeStep;
  const now = Date.now();
  const tfMs = timeframeMinutes * 60 * 1000;

  // Typical candle volatility scaled to timeframe
  const candleVolatility = Math.max(step * 0.08, (S * (Math.max(10, ticker.vix || 13) / 100) / 15.87) * Math.sqrt(timeframeMinutes / 375));

  const candles: Candle[] = [];
  
  // Build backwards from current live spot
  let currentClose = S;

  for (let i = 0; i < count; i++) {
    const candleTs = now - (i * tfMs);
    const timeStr = formatTime(candleTs);

    // If i === 0, this is the current active/forming candle
    if (i === 0) {
      const openOffset = (isUptrend ? -1 : 1) * candleVolatility * 0.45;
      const open = Number((currentClose + openOffset).toFixed(2));
      const high = Number((Math.max(currentClose, open) + candleVolatility * 0.35).toFixed(2));
      const low = Number((Math.min(currentClose, open) - candleVolatility * 0.25).toFixed(2));
      const volume = Math.round(15000 + Math.random() * 25000);

      candles.unshift({
        time: timeStr,
        open,
        high,
        low,
        close: currentClose,
        volume,
        timestamp: candleTs,
      });
      currentClose = open;
    } else {
      // Historical candles leading up to the current spot
      const drift = (isUptrend ? -1 : 1) * (candleVolatility * 0.3);
      const noise = (Math.sin(i * 1.7) * 0.6) * candleVolatility;
      const open = Number((currentClose + drift + noise).toFixed(2));
      const high = Number((Math.max(currentClose, open) + Math.abs(noise) * 0.7 + candleVolatility * 0.25).toFixed(2));
      const low = Number((Math.min(currentClose, open) - Math.abs(noise) * 0.7 - candleVolatility * 0.25).toFixed(2));
      const volume = Math.round(10000 + Math.abs(Math.sin(i)) * 30000);

      candles.unshift({
        time: timeStr,
        open,
        high,
        low,
        close: currentClose,
        volume,
        timestamp: candleTs,
      });
      currentClose = open;
    }
  }

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
  if (candles.length < 3) {
    const dummy = candles[candles.length - 1] || {
      time: '12:00', open: ticker.spotPrice, high: ticker.spotPrice, low: ticker.spotPrice, close: ticker.spotPrice, volume: 1000, timestamp: Date.now()
    };
    return {
      timeframe,
      candles,
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

  const latest = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const prev2 = candles[candles.length - 3];

  // Calculate True Range & ATR
  let trSum = 0;
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const p = candles[i - 1];
    const tr = Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close));
    trSum += tr;
  }
  const atr = Number((trSum / (candles.length - 1)).toFixed(2));

  // Highs and Lows of recent window (last 6 candles)
  const recentWindow = candles.slice(-6);
  const highestRecent = Math.max(...recentWindow.map(c => c.high));
  const lowestRecent = Math.min(...recentWindow.map(c => c.low));
  const resistance = Number(highestRecent.toFixed(2));
  const support = Number(lowestRecent.toFixed(2));

  // Check candle anatomy
  const body = Math.abs(latest.close - latest.open);
  const range = Math.max(0.01, latest.high - latest.low);
  const isGreen = latest.close >= latest.open;
  const isRed = latest.close < latest.open;
  const upperWick = latest.high - Math.max(latest.open, latest.close);
  const lowerWick = Math.min(latest.open, latest.close) - latest.low;

  const prevBody = Math.abs(prev.close - prev.open);
  const prevIsRed = prev.close < prev.open;
  const prevIsGreen = prev.close >= prev.open;

  // Determine trend by comparing latest close with 5-period VWAP/SMA
  const smaPeriod = Math.min(5, candles.length);
  const sma = candles.slice(-smaPeriod).reduce((acc, c) => acc + c.close, 0) / smaPeriod;
  
  let trend: 'BULLISH' | 'BEARISH' | 'SIDEWAYS' = 'SIDEWAYS';
  if (latest.close > sma + atr * 0.2) {
    trend = 'BULLISH';
  } else if (latest.close < sma - atr * 0.2) {
    trend = 'BEARISH';
  }

  // Pattern detection logic
  let pattern = 'Consolidation';
  let patternBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  let momentumScore = 0; // -10 to +10

  // 1. Hammer / Pin Bar Rejection at Support
  if (lowerWick >= body * 2 && upperWick <= body * 0.5 && latest.low <= support + atr * 0.3) {
    pattern = `${timeframe} Bullish Pin Bar (Support Rejection)`;
    patternBias = 'BULLISH';
    momentumScore = 7;
  }
  // 2. Shooting Star / Rejection at Resistance
  else if (upperWick >= body * 2 && lowerWick <= body * 0.5 && latest.high >= resistance - atr * 0.3) {
    pattern = `${timeframe} Bearish Pin Bar (Resistance Rejection)`;
    patternBias = 'BEARISH';
    momentumScore = -7;
  }
  // 3. Bullish Engulfing
  else if (isGreen && prevIsRed && latest.close > prev.open && latest.open < prev.close && body > prevBody) {
    pattern = `${timeframe} Bullish Engulfing (Demand Surge)`;
    patternBias = 'BULLISH';
    momentumScore = 8;
  }
  // 4. Bearish Engulfing
  else if (isRed && prevIsGreen && latest.close < prev.open && latest.open > prev.close && body > prevBody) {
    pattern = `${timeframe} Bearish Engulfing (Supply Overhang)`;
    patternBias = 'BEARISH';
    momentumScore = -8;
  }
  // 5. Higher Highs & Higher Lows (HH-HL)
  else if (latest.high > prev.high && latest.low > prev.low && prev.high > prev2.high) {
    pattern = `${timeframe} Higher Highs & Higher Lows (Ascending Structure)`;
    patternBias = 'BULLISH';
    momentumScore = 6;
  }
  // 6. Lower Highs & Lower Lows (LH-LL)
  else if (latest.high < prev.high && latest.low < prev.low && prev.low < prev2.low) {
    pattern = `${timeframe} Lower Highs & Lower Lows (Descending Structure)`;
    patternBias = 'BEARISH';
    momentumScore = -6;
  }
  // 7. Bull Flag or Micro Pullback Continuation
  else if (trend === 'BULLISH' && isGreen && body > atr * 0.6) {
    pattern = `${timeframe} Bull Flag Breakout (Momentum Continuation)`;
    patternBias = 'BULLISH';
    momentumScore = 7;
  }
  // 8. Bear Flag or Micro Pullback Continuation
  else if (trend === 'BEARISH' && isRed && body > atr * 0.6) {
    pattern = `${timeframe} Bear Flag Breakdown (Downward Continuation)`;
    patternBias = 'BEARISH';
    momentumScore = -7;
  }
  // 9. Morning Star
  else if (prev2.close < prev2.open && Math.abs(prev.close - prev.open) < atr * 0.3 && isGreen && latest.close > (prev2.open + prev2.close) / 2) {
    pattern = `${timeframe} Morning Star Reversal`;
    patternBias = 'BULLISH';
    momentumScore = 8;
  }
  // 10. Default Trend Alignment
  else if (trend === 'BULLISH') {
    pattern = `${timeframe} Ascending Channel Continuation`;
    patternBias = 'BULLISH';
    momentumScore = 4;
  } else if (trend === 'BEARISH') {
    pattern = `${timeframe} Descending Channel Continuation`;
    patternBias = 'BEARISH';
    momentumScore = -4;
  } else {
    pattern = `${timeframe} Range Bound Oscillation`;
    patternBias = 'NEUTRAL';
    momentumScore = 0;
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
    candles,
    latestCandle: latest,
    trend,
    pattern,
    patternBias,
    resistance,
    support,
    atr,
    momentumScore,
    measuredMoveTarget,
  };
}

/**
 * Combines 2m, 5m, and 15m candlesticks into a cohesive multi-timeframe pattern engine
 */
export function computeMultiTimeframeChartPatterns(
  ticker: TickerConfig
): MultiTimeframeChartPatterns {
  // Generate rolling candles for 2m, 5m, and 15m
  const c2m = generateRollingCandles(ticker, 2, 16);
  const c5m = generateRollingCandles(ticker, 5, 14);
  const c15m = generateRollingCandles(ticker, 15, 12);

  const m2 = analyzeTimeframeCandles(c2m, '2m', ticker);
  const m5 = analyzeTimeframeCandles(c5m, '5m', ticker);
  const m15 = analyzeTimeframeCandles(c15m, '15m', ticker);

  // Compute aggregate confluence score: weighted combination (15m: 45%, 5m: 35%, 2m: 20%)
  const confluenceScore = Number((
    m15.momentumScore * 0.45 +
    m5.momentumScore * 0.35 +
    m2.momentumScore * 0.20
  ).toFixed(1));

  let confluenceBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  if (confluenceScore >= 2.5) confluenceBias = 'BULLISH';
  else if (confluenceScore <= -2.5) confluenceBias = 'BEARISH';

  // Build descriptive confluence pattern headline
  let confluencePattern = '';
  if (confluenceBias === 'BULLISH') {
    confluencePattern = `15m ${m15.trend} Structure + 5m ${m5.pattern.replace(/5m\s*/, '')} + 2m Trigger`;
  } else if (confluenceBias === 'BEARISH') {
    confluencePattern = `15m ${m15.trend} Pressure + 5m ${m5.pattern.replace(/5m\s*/, '')} + 2m Breakdown`;
  } else {
    confluencePattern = `Multi-Timeframe Equilibrium (${m15.trend} 15m / ${m5.trend} 5m)`;
  }

  const S = ticker.spotPrice;
  const step = ticker.strikeStep;

  // Derived Exit Level 1 (Tactical Target based on 2m & 5m measured swing move)
  let derivedExitLevel1 = S;
  if (confluenceBias === 'BULLISH') {
    const swing5m = Math.max(step * 0.35, m5.measuredMoveTarget - S);
    derivedExitLevel1 = Number((S + Math.min(swing5m, m5.atr * 2.2)).toFixed(2));
  } else if (confluenceBias === 'BEARISH') {
    const swing5m = Math.max(step * 0.35, S - m5.measuredMoveTarget);
    derivedExitLevel1 = Number((S - Math.min(swing5m, m5.atr * 2.2)).toFixed(2));
  } else {
    derivedExitLevel1 = ticker.changePercent >= 0 
      ? Number((S + step * 0.45).toFixed(2)) 
      : Number((S - step * 0.45).toFixed(2));
  }

  // Derived Exit Level 2 (Extended Runner Target based on 15m range expansion)
  let derivedExitLevel2 = S;
  if (confluenceBias === 'BULLISH') {
    const swing15m = Math.max(step * 0.65, m15.measuredMoveTarget - S);
    derivedExitLevel2 = Number((S + Math.min(swing15m, m15.atr * 3.8)).toFixed(2));
  } else if (confluenceBias === 'BEARISH') {
    const swing15m = Math.max(step * 0.65, S - m15.measuredMoveTarget);
    derivedExitLevel2 = Number((S - Math.min(swing15m, m15.atr * 3.8)).toFixed(2));
  } else {
    derivedExitLevel2 = ticker.changePercent >= 0 
      ? Number((S + step * 0.9).toFixed(2)) 
      : Number((S - step * 0.9).toFixed(2));
  }

  // Invalidation Level (Technical Stop Loss level based on 2m/5m support/resistance)
  let invalidationLevel = S;
  if (confluenceBias === 'BULLISH') {
    // For Call: Stop loss is below 2m/5m swing low
    const lowestLow = Math.min(m2.support, m5.support);
    invalidationLevel = Number((Math.min(lowestLow, S - m5.atr * 0.9)).toFixed(2));
  } else if (confluenceBias === 'BEARISH') {
    // For Put: Stop loss is above 2m/5m swing high
    const highestHigh = Math.max(m2.resistance, m5.resistance);
    invalidationLevel = Number((Math.max(highestHigh, S + m5.atr * 0.9)).toFixed(2));
  } else {
    invalidationLevel = ticker.changePercent >= 0 
      ? Number((S - step * 0.4).toFixed(2)) 
      : Number((S + step * 0.4).toFixed(2));
  }

  return {
    m2,
    m5,
    m15,
    confluencePattern,
    confluenceBias,
    confluenceScore,
    derivedExitLevel1,
    derivedExitLevel2,
    invalidationLevel,
  };
}
