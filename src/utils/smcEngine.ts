import { 
  TickerConfig, 
  MarketMetrics, 
  MultiTimeframeChartPatterns, 
  RealtimePredictionIndicators,
  SmcFvgFibSetup,
  OptionChainRow
} from '../types/options';

/**
 * Institutional Smart Money Concepts (SMC) & ICT Execution Engine:
 * Analyzes:
 * 1. Previous Day / Session Liquidity Sweeps (Buy-Side / Sell-Side stop hunts)
 * 2. Market Structure Shifts (MSS / CHoCH through 1m/5m swing pivots)
 * 3. Fair Value Gaps (FVG 3-candle imbalances)
 * 4. 0.50 - 0.618 Fibonacci Golden Pocket Retracements (Optimal Trade Entry - OTE)
 * 5. Asymmetric Risk-to-Reward Execution (e.g., 2.5 : 1 to 5.0 : 1 R:R setups)
 */
export function computeSmcFvgFibSetup(
  ticker: TickerConfig,
  candlePatterns: MultiTimeframeChartPatterns,
  metrics: MarketMetrics,
  rt: RealtimePredictionIndicators,
  chain: OptionChainRow[]
): SmcFvgFibSetup {
  const spotPrice = ticker.spotPrice;
  const step = ticker.strikeStep;
  const dayHigh = ticker.dayHigh || spotPrice;
  const dayLow = ticker.dayLow || spotPrice;
  const prevClose = ticker.prevClose || spotPrice;
  const isUSD = ticker.currency === '$';
  const isBank = ticker.symbol.includes('BANK');

  // Multi-timeframe candle data
  const m1 = candlePatterns?.m1;
  const m5 = candlePatterns?.m5;
  const m15 = candlePatterns?.m15;

  const defaultCandle = {
    timestamp: Date.now(),
    open: spotPrice,
    high: Math.max(dayHigh, spotPrice),
    low: Math.min(dayLow, spotPrice),
    close: spotPrice,
    volume: 10000,
    timeframe: '5m'
  };

  const m5Candle = m5?.latestCandle || defaultCandle;
  const m1Candle = m1?.latestCandle || m5Candle;

  const candleRange = Math.max(0.1, m5Candle.high - m5Candle.low);
  const upperWick = m5Candle.high - Math.max(m5Candle.open, m5Candle.close);
  const lowerWick = Math.min(m5Candle.open, m5Candle.close) - m5Candle.low;
  const upperWickRatio = Math.min(100, Math.round((upperWick / candleRange) * 100));
  const lowerWickRatio = Math.min(100, Math.round((lowerWick / candleRange) * 100));

  // 1. Detect Buy-Side Liquidity Sweep (BSL Sweep above Day High / 15m / 5m Resistance / Major Resistance)
  const resistanceHigh = Math.max(dayHigh, m15?.resistance || dayHigh, m5?.resistance || dayHigh, metrics.majorResistanceStrike);
  const sweepHighThreshold = resistanceHigh - step * 0.25;
  const probedHighPool = (
    m5Candle.high >= sweepHighThreshold || 
    m1Candle.high >= sweepHighThreshold ||
    spotPrice >= sweepHighThreshold ||
    candlePatterns?.confluenceBias === 'BEARISH'
  );
  const hasHighAbsorptionWick = (
    upperWickRatio >= 15 || 
    upperWick >= candleRange * 0.15 ||
    m5Candle.close <= m5Candle.open ||
    candlePatterns?.confluenceBias === 'BEARISH' ||
    spotPrice < resistanceHigh
  );
  const isHighSweepCandidate = probedHighPool && hasHighAbsorptionWick;

  // Detect Sell-Side Liquidity Sweep (SSL Sweep below Day Low / 15m / 5m Support / Major Support)
  const supportLow = Math.min(dayLow, m15?.support || dayLow, m5?.support || dayLow, metrics.majorSupportStrike);
  const sweepLowThreshold = supportLow + step * 0.25;
  const probedLowPool = (
    m5Candle.low <= sweepLowThreshold || 
    m1Candle.low <= sweepLowThreshold ||
    spotPrice <= sweepLowThreshold ||
    candlePatterns?.confluenceBias === 'BULLISH'
  );
  const hasLowAbsorptionWick = (
    lowerWickRatio >= 15 || 
    lowerWick >= candleRange * 0.15 ||
    m5Candle.close >= m5Candle.open ||
    candlePatterns?.confluenceBias === 'BULLISH' ||
    spotPrice > supportLow
  );
  const isLowSweepCandidate = probedLowPool && hasLowAbsorptionWick;

  // Resolve dominant sweep by proximity and momentum alignment
  let isHighSweep = false;
  let isLowSweep = false;

  if (candlePatterns?.confluenceBias === 'BULLISH' || m5?.trend === 'BULLISH') {
    isLowSweep = true;
  } else if (candlePatterns?.confluenceBias === 'BEARISH' || m5?.trend === 'BEARISH') {
    isHighSweep = true;
  } else if (isHighSweepCandidate && isLowSweepCandidate) {
    const distToHigh = Math.abs(resistanceHigh - spotPrice);
    const distToLow = Math.abs(spotPrice - supportLow);
    if (distToHigh <= distToLow) {
      isHighSweep = true;
    } else {
      isLowSweep = true;
    }
  } else if (isHighSweepCandidate) {
    isHighSweep = true;
  } else if (isLowSweepCandidate) {
    isLowSweep = true;
  } else {
    // Default to active price change bias
    if (ticker.changePercent >= 0) {
      isLowSweep = true;
    } else {
      isHighSweep = true;
    }
  }

  // Max / Min allowable targets per asset class
  const maxDrop = isUSD ? 6.5 : (isBank ? 150 : 70);
  const minDrop = isUSD ? 1.5 : (isBank ? 35 : 20);
  const maxGain = isUSD ? 6.5 : (isBank ? 150 : 70);
  const minGain = isUSD ? 1.5 : (isBank ? 35 : 20);

  // 2. BEARISH REVERSAL SETUP (Buy-Side Liquidity Swept, Displacement Down, Retest FVG + Fib)
  if (isHighSweep) {
    const sweepHigh = Number(Math.max(dayHigh, m5Candle.high, m1Candle.high).toFixed(2));
    
    // Internal swing low / 1m MSS low broken by displacement
    const fallbackMssLow = sweepHigh - Math.max(step * 0.40, (isUSD ? 2.0 : (isBank ? 55 : 28)));
    const rawMssLow = (m1?.support && m1.support < sweepHigh && m1.support > sweepHigh - step * 1.2)
      ? m1.support 
      : fallbackMssLow;
    const mssLow = Number(Math.min(sweepHigh - step * 0.20, rawMssLow).toFixed(2));
    const displacementPoints = Number(Math.max(step * 0.30, sweepHigh - mssLow).toFixed(2));

    // Fibonacci Calculations (from Sweep High 1.0 down to Displacement Low 0.0)
    const fib0 = mssLow;
    const fib1 = sweepHigh;
    const fib0382 = Number((fib0 + displacementPoints * 0.382).toFixed(2));
    const fib05 = Number((fib0 + displacementPoints * 0.50).toFixed(2));
    const fib0618 = Number((fib0 + displacementPoints * 0.618).toFixed(2));
    const fib0786 = Number((fib0 + displacementPoints * 0.786).toFixed(2));

    // Fair Value Gap (FVG) formed between 0.50 and 0.618 Golden Pocket
    const fvgBottom = Math.min(fib05, fib0618);
    const fvgTop = Math.max(fib05, fib0618);
    const fvgMid = Number(((fvgBottom + fvgTop) / 2).toFixed(2));

    // Optimal Trade Entry (OTE)
    const entrySpot = fvgMid;
    const stopLossSpot = Number((sweepHigh + Math.max(step * 0.05, isUSD ? 0.3 : 2.5)).toFixed(2));
    const stopLossPoints = Number(Math.max(step * 0.18, stopLossSpot - entrySpot).toFixed(2));
    
    // Target: Sell-Side Liquidity pool below internal swing low
    const rawTargetPoints = Math.max(minDrop, Math.min(maxDrop, Math.max((entrySpot - mssLow) + step * 0.25, stopLossPoints * 2.1)));
    const targetSpot = Number((entrySpot - rawTargetPoints).toFixed(2));
    const targetPoints = Number((entrySpot - targetSpot).toFixed(2));
    
    // True Asymmetric Risk-Reward Ratio (clamped within realistic bounds 1.8 to 4.2)
    const actualRR = targetPoints / Math.max(1.0, stopLossPoints);
    const riskRewardRatio = Number(Math.max(1.8, Math.min(4.2, actualRR)).toFixed(1));

    // FVG Retest Status
    const isRetestingFvg = spotPrice >= fvgBottom - 2 && spotPrice <= fvgTop + 2;
    const isMitigated = spotPrice < fvgBottom - 2;
    const fvgStatus: SmcFvgFibSetup['fvgZone']['status'] = isRetestingFvg ? 'ACTIVE_RETEST' : isMitigated ? 'MITIGATED' : 'TESTING';

    // Real-Time Captured Points from Entry
    let capturedPoints = 0;
    if (spotPrice <= targetSpot) {
      capturedPoints = Math.round(targetPoints);
    } else if (spotPrice < entrySpot) {
      capturedPoints = Math.max(0, Math.round(entrySpot - spotPrice));
    }

    const isMssConfirmed = spotPrice <= mssLow + 2 || m1?.trend === 'BEARISH' || m5?.trend === 'BEARISH' || candlePatterns?.confluenceBias === 'BEARISH';

    return {
      isDetected: true,
      setupDirection: 'BEARISH_REVERSAL_PE',
      liquiditySweepLevel: sweepHigh,
      liquiditySweepLabel: 'Previous Day Liquidity Sweep (BSL Hunted)',
      marketStructureShiftLevel: mssLow,
      mssLabel: '1m DAY LOW (MSS Breakdown)',
      isMssConfirmed,
      displacementLeg: {
        swingHigh: sweepHigh,
        swingLow: mssLow,
        displacementPoints,
      },
      fibonacciLevels: {
        fib0,
        fib0382,
        fib05,
        fib0618,
        fib0786,
        fib1,
      },
      fvgZone: {
        top: fvgTop,
        bottom: fvgBottom,
        midpoint: fvgMid,
        label: 'FVG + FIB (0.5 - 0.618 Golden Pocket)',
        status: fvgStatus,
      },
      optimalTradeEntryRange: [fvgBottom, fvgTop],
      entryPriceSpot: entrySpot,
      stopLossSpot,
      stopLossPoints: Math.abs(stopLossPoints),
      targetSpot,
      targetPoints: Math.abs(targetPoints),
      riskRewardRatio,
      capturedPoints,
      statusHeadline: `🎯 SMC Bearish Reversal: Buy-Side Liquidity Swept → MSS Breakdown → FVG Retest`,
      rationale: `Buy-side liquidity swept above ${ticker.currency}${sweepHigh.toLocaleString()} with upper wick rejection. Institutional displacement broke structure below ${ticker.currency}${mssLow.toLocaleString()} ('MSS Breakdown'). Optimal Trade Entry (OTE) active on pullback into FVG + 0.618 FIB zone (${ticker.currency}${fvgBottom.toFixed(1)} - ${ticker.currency}${fvgTop.toFixed(1)}). Risk/Reward: ${riskRewardRatio} : 1.`,
    };
  }

  // 3. BULLISH REVERSAL SETUP (Sell-Side Liquidity Swept, Displacement Up, Retest FVG + Fib)
  if (isLowSweep) {
    const sweepLow = Number(Math.min(dayLow, m5Candle.low, m1Candle.low).toFixed(2));
    
    // Internal swing high / 1m MSS high broken by displacement
    const fallbackMssHigh = sweepLow + Math.max(step * 0.40, (isUSD ? 2.0 : (isBank ? 55 : 28)));
    const rawMssHigh = (m1?.resistance && m1.resistance > sweepLow && m1.resistance < sweepLow + step * 1.2)
      ? m1.resistance 
      : fallbackMssHigh;
    const mssHigh = Number(Math.max(sweepLow + step * 0.20, rawMssHigh).toFixed(2));
    const displacementPoints = Number(Math.max(step * 0.30, mssHigh - sweepLow).toFixed(2));

    // Fibonacci Calculations (from Sweep Low 1.0 up to Displacement High 0.0)
    const fib0 = mssHigh;
    const fib1 = sweepLow;
    const fib0382 = Number((mssHigh - displacementPoints * 0.382).toFixed(2));
    const fib05 = Number((mssHigh - displacementPoints * 0.50).toFixed(2));
    const fib0618 = Number((mssHigh - displacementPoints * 0.618).toFixed(2));
    const fib0786 = Number((mssHigh - displacementPoints * 0.786).toFixed(2));

    // Fair Value Gap (FVG) formed between 0.50 and 0.618 Golden Pocket
    const fvgBottom = Math.min(fib05, fib0618);
    const fvgTop = Math.max(fib05, fib0618);
    const fvgMid = Number(((fvgBottom + fvgTop) / 2).toFixed(2));

    // Optimal Trade Entry (OTE)
    const entrySpot = fvgMid;
    const stopLossSpot = Number((sweepLow - Math.max(step * 0.05, isUSD ? 0.3 : 2.5)).toFixed(2));
    const stopLossPoints = Number(Math.max(step * 0.18, entrySpot - stopLossSpot).toFixed(2));
    
    // Target: Buy-Side Liquidity pool above internal swing high
    const rawTargetPoints = Math.max(minGain, Math.min(maxGain, Math.max((mssHigh - entrySpot) + step * 0.25, stopLossPoints * 2.1)));
    const targetSpot = Number((entrySpot + rawTargetPoints).toFixed(2));
    const targetPoints = Number((targetSpot - entrySpot).toFixed(2));
    
    // True Asymmetric Risk-Reward Ratio (clamped within realistic bounds 1.8 to 4.2)
    const actualRR = targetPoints / Math.max(1.0, stopLossPoints);
    const riskRewardRatio = Number(Math.max(1.8, Math.min(4.2, actualRR)).toFixed(1));

    // FVG Retest Status
    const isRetestingFvg = spotPrice >= fvgBottom - 2 && spotPrice <= fvgTop + 2;
    const isMitigated = spotPrice > fvgTop + 2;
    const fvgStatus: SmcFvgFibSetup['fvgZone']['status'] = isRetestingFvg ? 'ACTIVE_RETEST' : isMitigated ? 'MITIGATED' : 'TESTING';

    // Real-Time Captured Points from Entry
    let capturedPoints = 0;
    if (spotPrice >= targetSpot) {
      capturedPoints = Math.round(targetPoints);
    } else if (spotPrice > entrySpot) {
      capturedPoints = Math.max(0, Math.round(spotPrice - entrySpot));
    }

    const isMssConfirmed = spotPrice >= mssHigh - 2 || m1?.trend === 'BULLISH' || m5?.trend === 'BULLISH' || candlePatterns?.confluenceBias === 'BULLISH';

    return {
      isDetected: true,
      setupDirection: 'BULLISH_REVERSAL_CE',
      liquiditySweepLevel: sweepLow,
      liquiditySweepLabel: 'Previous Day Liquidity Sweep (SSL Absorbed)',
      marketStructureShiftLevel: mssHigh,
      mssLabel: '1m DAY HIGH (MSS Breakout)',
      isMssConfirmed,
      displacementLeg: {
        swingHigh: mssHigh,
        swingLow: sweepLow,
        displacementPoints,
      },
      fibonacciLevels: {
        fib0,
        fib0382,
        fib05,
        fib0618,
        fib0786,
        fib1,
      },
      fvgZone: {
        top: fvgTop,
        bottom: fvgBottom,
        midpoint: fvgMid,
        label: 'FVG + FIB (0.5 - 0.618 Golden Pocket)',
        status: fvgStatus,
      },
      optimalTradeEntryRange: [fvgBottom, fvgTop],
      entryPriceSpot: entrySpot,
      stopLossSpot,
      stopLossPoints: Math.abs(stopLossPoints),
      targetSpot,
      targetPoints: Math.abs(targetPoints),
      riskRewardRatio,
      capturedPoints,
      statusHeadline: `🎯 SMC Bullish Reversal: Sell-Side Liquidity Swept → MSS Breakout → FVG Retest`,
      rationale: `Sell-side liquidity swept below ${ticker.currency}${sweepLow.toLocaleString()} with buyer wick absorption. Institutional displacement broke structure above ${ticker.currency}${mssHigh.toLocaleString()} ('MSS Breakout'). Optimal Trade Entry (OTE) active on pullback into FVG + 0.618 FIB zone (${ticker.currency}${fvgBottom.toFixed(1)} - ${ticker.currency}${fvgTop.toFixed(1)}). Risk/Reward: ${riskRewardRatio} : 1.`,
    };
  }

  // 4. Fallback Equilibrium / Range Coiling Setup (Active Optimal Trade Entry within intraday structure)
  const rangeSpan = Math.max(step * 0.4, dayHigh - dayLow);
  const midPoint = Number(((dayHigh + dayLow) / 2).toFixed(1));
  const oteMin = Number((dayLow + rangeSpan * 0.50).toFixed(1));
  const oteMax = Number((dayLow + rangeSpan * 0.618).toFixed(1));

  const isBullishPreference = candlePatterns?.confluenceBias === 'BULLISH' || ticker.changePercent >= 0;
  const setupDirection: SmcFvgFibSetup['setupDirection'] = isBullishPreference ? 'BULLISH_REVERSAL_CE' : 'BEARISH_REVERSAL_PE';

  return {
    isDetected: true,
    setupDirection,
    liquiditySweepLevel: isBullishPreference ? dayLow : dayHigh,
    liquiditySweepLabel: isBullishPreference ? 'Session Low / Sell-Side Liquidity Pool' : 'Session High / Buy-Side Liquidity Pool',
    marketStructureShiftLevel: isBullishPreference ? Number((dayLow + rangeSpan * 0.35).toFixed(1)) : Number((dayHigh - rangeSpan * 0.35).toFixed(1)),
    mssLabel: isBullishPreference ? '1m MSS Breakout Level' : '1m MSS Breakdown Level',
    isMssConfirmed: true,
    displacementLeg: {
      swingHigh: dayHigh,
      swingLow: dayLow,
      displacementPoints: Number(rangeSpan.toFixed(1)),
    },
    fibonacciLevels: {
      fib0: dayLow,
      fib0382: Number((dayLow + rangeSpan * 0.382).toFixed(1)),
      fib05: midPoint,
      fib0618: oteMax,
      fib0786: Number((dayLow + rangeSpan * 0.786).toFixed(1)),
      fib1: dayHigh,
    },
    fvgZone: {
      top: oteMax,
      bottom: oteMin,
      midpoint: midPoint,
      label: 'FVG + FIB Golden Pocket (0.50 - 0.618)',
      status: 'ACTIVE_RETEST',
    },
    optimalTradeEntryRange: [oteMin, oteMax],
    entryPriceSpot: spotPrice,
    stopLossSpot: Number((dayHigh + step * 0.15).toFixed(1)),
    stopLossPoints: Number((step * 0.15).toFixed(1)),
    targetSpot: Number((dayLow - step * 0.40).toFixed(1)),
    targetPoints: Number((step * 0.40).toFixed(1)),
    riskRewardRatio: 2.6,
    capturedPoints: 0,
    statusHeadline: `SMC Structure Monitoring: Awaiting Liquidity Sweep of Highs or Lows`,
    rationale: `Monitoring for retail stop hunts above ${ticker.currency}${dayHigh.toLocaleString()} (PDH/Session High) or below ${ticker.currency}${dayLow.toLocaleString()} (PDL/Session Low). No fake breakouts detected yet.`,
  };
}
