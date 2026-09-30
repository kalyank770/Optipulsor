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
  const step = ticker.strikeStep;
  const now = Date.now();
  const tfMs = timeframeMinutes * 60 * 1000;

  // Determine true intraday direction:
  // If price has recovered substantially from the session dayLow, it is an intraday recovery (Uptrend)
  // regardless of whether the net change vs yesterday's close is still red
  const dayHigh = ticker.dayHigh && ticker.dayHigh > S ? ticker.dayHigh : S + step * 0.7;
  const dayLow = ticker.dayLow && ticker.dayLow < S ? ticker.dayLow : S - step * 0.7;
  const dayRange = Math.max(step * 0.5, dayHigh - dayLow);
  const recoveryRatio = (S - dayLow) / dayRange; // 0 = at low, 1.0 = at high
  const recoveryFromLow = S - dayLow;

  const isIntradayBreakdown = recoveryRatio <= 0.32;
  const isIntradayRecovery = !isIntradayBreakdown && (recoveryRatio >= 0.50 || (recoveryRatio >= 0.38 && recoveryFromLow >= step * 0.75));
  const isUptrend = isIntradayBreakdown ? false : (isIntradayRecovery ? true : changePct >= 0);

  // Typical candle volatility scaled to timeframe
  const candleVolatility = Math.max(step * 0.08, (S * (Math.max(10, ticker.vix || 13) / 100) / 15.87) * Math.sqrt(timeframeMinutes / 375));

  const candles: Candle[] = [];
  let currentClose = S;

  for (let i = 0; i < count; i++) {
    const candleTs = now - (i * tfMs);
    const timeStr = formatTime(candleTs);

    if (i === 0) {
      // Current forming candle at live spot
      const openOffset = (isUptrend ? -1 : 1) * candleVolatility * 0.25;
      const open = Number((S + openOffset).toFixed(2));
      const high = Number((Math.max(S, open) + candleVolatility * 0.20 + 0.02).toFixed(2));
      const low = Number((Math.min(S, open) - candleVolatility * 0.20 - 0.02).toFixed(2));
      const volume = Math.round(18000 + Math.abs(Math.sin((candleTs / 60000) * 0.7)) * 24000);

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
      // Realistic balanced multi-wave price action: 2-step forward, 1-step back
      const isOdd = (i % 2 === 1);
      const unit = candleVolatility * 0.45;
      const delta = isOdd
        ? (isUptrend ? -unit * (0.65 + Math.abs(Math.sin(i * 1.3)) * 0.4) : unit * (0.65 + Math.abs(Math.sin(i * 1.3)) * 0.4))
        : (isUptrend ? unit * (0.40 + Math.abs(Math.cos(i * 1.7)) * 0.3) : -unit * (0.40 + Math.abs(Math.cos(i * 1.7)) * 0.3));

      const targetPrice = Math.max(dayLow, Math.min(dayHigh, currentClose + delta));
      const close = Number(targetPrice.toFixed(2));
      const open = Number((close + (isUptrend ? -1 : 1) * candleVolatility * 0.20 + Math.sin(i * 2.1) * candleVolatility * 0.10).toFixed(2));
      const high = Number((Math.max(open, close) + Math.abs(Math.cos(i)) * candleVolatility * 0.20 + 0.02).toFixed(2));
      const low = Number((Math.min(open, close) - Math.abs(Math.sin(i)) * candleVolatility * 0.20 - 0.02).toFixed(2));
      const volume = Math.round(10000 + Math.abs(Math.sin(i)) * 30000);

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
  const bodyWickRatio = Number((body / Math.max(0.01, upperWick + lowerWick)).toFixed(2));
  const swingRange = Number((highestRecent - lowestRecent).toFixed(2));

  const prevBody = Math.abs(prev.close - prev.open);
  const prevIsRed = prev.close < prev.open;
  const prevIsGreen = prev.close >= prev.open;

  // Determine trend by comparing latest close with 5-period VWAP/SMA and EMA9
  const smaPeriod = Math.min(5, candles.length);
  const sma = candles.slice(-smaPeriod).reduce((acc, c) => acc + c.close, 0) / smaPeriod;
  
  // Rate of displacement (points per candle / ATR)
  const candleVelocity = Number(((latest.close - prev.close) / Math.max(0.1, atr)).toFixed(2));
  const vwapProximity = Number(((latest.close - sma) / ticker.strikeStep).toFixed(2));

  let trend: 'BULLISH' | 'BEARISH' | 'SIDEWAYS' = 'SIDEWAYS';
  if (latest.close > sma + atr * 0.15) {
    trend = 'BULLISH';
  } else if (latest.close < sma - atr * 0.15) {
    trend = 'BEARISH';
  }

  // Breakout detection
  let breakoutStatus: TimeframeCandleAnalysis['breakoutStatus'] = 'CONSOLIDATION';
  if (latest.close >= resistance - atr * 0.1 && isGreen) {
    breakoutStatus = 'BULLISH_BREAKOUT';
  } else if (latest.close <= support + atr * 0.1 && isRed) {
    breakoutStatus = 'BEARISH_BREAKOUT';
  } else if (Math.abs(latest.low - sma) <= atr * 0.25 && trend === 'BULLISH') {
    breakoutStatus = 'PULLBACK_RETEST';
  }

  // Pattern detection logic
  let pattern = 'Consolidation';
  let patternBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  let momentumScore = 0; // -10.0 to +10.0

  // 1. Hammer / Pin Bar Rejection at Support
  if (lowerWick >= body * 1.8 && upperWick <= body * 0.6 && latest.low <= support + atr * 0.35) {
    pattern = `${timeframe} Bullish Pin Bar (Support Rejection)`;
    patternBias = 'BULLISH';
    momentumScore = 7.5;
  }
  // 2. Shooting Star / Rejection at Resistance
  else if (upperWick >= body * 1.8 && lowerWick <= body * 0.6 && latest.high >= resistance - atr * 0.35) {
    pattern = `${timeframe} Bearish Pin Bar (Resistance Rejection)`;
    patternBias = 'BEARISH';
    momentumScore = -7.5;
  }
  // 3. Bullish Engulfing / High Momentum Thrust
  else if (isGreen && prevIsRed && latest.close > prev.open && latest.open < prev.close && body > prevBody * 1.1) {
    pattern = `${timeframe} Bullish Engulfing (Demand Expansion)`;
    patternBias = 'BULLISH';
    momentumScore = 8.5;
  }
  // 4. Bearish Engulfing / Heavy Supply Thrust
  else if (isRed && prevIsGreen && latest.close < prev.open && latest.open > prev.close && body > prevBody * 1.1) {
    pattern = `${timeframe} Bearish Engulfing (Supply Expansion)`;
    patternBias = 'BEARISH';
    momentumScore = -8.5;
  }
  // 5. Higher Highs & Higher Lows (HH-HL Structure)
  else if (latest.high > prev.high && latest.low > prev.low && prev.high > prev2.high) {
    pattern = `${timeframe} Higher Highs & Lows (Ascending Impulse)`;
    patternBias = 'BULLISH';
    momentumScore = 6.8;
  }
  // 6. Lower Highs & Lower Lows (LH-LL Structure)
  else if (latest.high < prev.high && latest.low < prev.low && prev.low < prev2.low) {
    pattern = `${timeframe} Lower Highs & Lows (Descending Drift)`;
    patternBias = 'BEARISH';
    momentumScore = -6.8;
  }
  // 7. Bull Flag or Micro Pullback Continuation
  else if (trend === 'BULLISH' && isGreen && body > atr * 0.5) {
    pattern = `${timeframe} Bull Flag Breakout (Momentum Continuation)`;
    patternBias = 'BULLISH';
    momentumScore = 7.2;
  }
  // 8. Bear Flag or Micro Pullback Continuation
  else if (trend === 'BEARISH' && isRed && body > atr * 0.5) {
    pattern = `${timeframe} Bear Flag Breakdown (Downward Continuation)`;
    patternBias = 'BEARISH';
    momentumScore = -7.2;
  }
  // 9. Morning Star Reversal
  else if (prev2.close < prev2.open && Math.abs(prev.close - prev.open) < atr * 0.35 && isGreen && latest.close > (prev2.open + prev2.close) / 2) {
    pattern = `${timeframe} Morning Star Reversal`;
    patternBias = 'BULLISH';
    momentumScore = 8.0;
  }
  // 10. Default Trend Alignment with Velocity Scaling
  else if (trend === 'BULLISH') {
    pattern = `${timeframe} Ascending Channel Continuation`;
    patternBias = 'BULLISH';
    momentumScore = Math.min(6.0, Math.max(2.5, 3.5 + candleVelocity * 1.5));
  } else if (trend === 'BEARISH') {
    pattern = `${timeframe} Descending Channel Continuation`;
    patternBias = 'BEARISH';
    momentumScore = Math.max(-6.0, Math.min(-2.5, -3.5 + candleVelocity * 1.5));
  } else {
    pattern = `${timeframe} Range Bound Oscillation`;
    patternBias = 'NEUTRAL';
    momentumScore = Number((candleVelocity * 1.2).toFixed(1));
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
    momentumScore: Number(momentumScore.toFixed(1)),
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
  // Generate rolling candles for 2m, 5m, and 15m
  const c2m = generateRollingCandles(ticker, 2, 16);
  const c5m = generateRollingCandles(ticker, 5, 14);
  const c15m = generateRollingCandles(ticker, 15, 12);

  const m2 = analyzeTimeframeCandles(c2m, '2m', ticker);
  const m5 = analyzeTimeframeCandles(c5m, '5m', ticker);
  const m15 = analyzeTimeframeCandles(c15m, '15m', ticker);

  const m2Score = m2.momentumScore;
  const m5Score = m5.momentumScore;
  const m15Score = m15.momentumScore;

  // Compute aggregate momentum index: weighted combination (15m: 40%, 5m: 40%, 2m: 20%)
  const aggregateMomentumIndex = Number((
    m15Score * 0.40 +
    m5Score * 0.40 +
    m2Score * 0.20
  ).toFixed(1));

  const confluenceScore = aggregateMomentumIndex;

  let confluenceBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  let momentumAlignment: MultiTimeframeChartPatterns['momentumAlignment'] = 'NEUTRAL_MIXED';

  if (confluenceScore >= 5.0 && m2Score > 0 && m5Score > 0 && m15Score > 0) {
    confluenceBias = 'BULLISH';
    momentumAlignment = 'FULL_BULLISH_CONFLUENCE';
  } else if (confluenceScore >= 2.2) {
    confluenceBias = 'BULLISH';
    momentumAlignment = 'MODERATE_BULLISH';
  } else if (confluenceScore <= -5.0 && m2Score < 0 && m5Score < 0 && m15Score < 0) {
    confluenceBias = 'BEARISH';
    momentumAlignment = 'FULL_BEARISH_CONFLUENCE';
  } else if (confluenceScore <= -2.2) {
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

  // Derived Exit Level 1 (Tactical Target based on 2m & 5m measured swing move)
  let derivedExitLevel1 = S;
  if (confluenceBias === 'BULLISH') {
    derivedExitLevel1 = Number((S + tacticalSwingPoints).toFixed(2));
  } else if (confluenceBias === 'BEARISH') {
    derivedExitLevel1 = Number((S - tacticalSwingPoints).toFixed(2));
  } else {
    derivedExitLevel1 = ticker.changePercent >= 0 
      ? Number((S + tacticalSwingPoints).toFixed(2)) 
      : Number((S - tacticalSwingPoints).toFixed(2));
  }

  // Derived Exit Level 2 (Extended Runner Target based on 15m range expansion)
  let derivedExitLevel2 = S;
  if (confluenceBias === 'BULLISH') {
    derivedExitLevel2 = Number((S + structuralSwingPoints).toFixed(2));
  } else if (confluenceBias === 'BEARISH') {
    derivedExitLevel2 = Number((S - structuralSwingPoints).toFixed(2));
  } else {
    derivedExitLevel2 = ticker.changePercent >= 0 
      ? Number((S + structuralSwingPoints).toFixed(2)) 
      : Number((S - structuralSwingPoints).toFixed(2));
  }

  // Invalidation Level (Technical Stop Loss level)
  let invalidationLevel = S;
  if (confluenceBias === 'BULLISH') {
    invalidationLevel = Number((S - invalidationPoints).toFixed(2));
  } else if (confluenceBias === 'BEARISH') {
    invalidationLevel = Number((S + invalidationPoints).toFixed(2));
  } else {
    invalidationLevel = ticker.changePercent >= 0 
      ? Number((S - invalidationPoints).toFixed(2)) 
      : Number((S + invalidationPoints).toFixed(2));
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
  };
}
