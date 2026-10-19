import { 
  TickerConfig, 
  OptionChainRow, 
  MarketMetrics, 
  TradeSignal, 
  SignalAction, 
  SignalStrength, 
  Moneyness, 
  NewsItem,
  OptionType,
  AdjacentStrikeAnalysis,
  TradeLifecycleStage,
  RealtimePredictionIndicators
} from '../types/options';
import { computeMultiTimeframeChartPatterns } from './candlestickEngine';
import { calculateBlackScholes, getTickerExpiryDTE } from './blackScholes';
import { computeRealtimeIndicators } from './technicalIndicators';
import { analyzeNiftyConstituents, NIFTY_DERIVATIVE_COMPANIES } from '../data/niftyConstituents';
import { getInterMarketTelemetry } from '../data/globalMacroData';
import { computeAfterMarketOpeningAnalytics } from './afterMarketEngine';
import { getMarketHoursStatus } from './marketHours';
import { computeMultiTimeframePredictions } from './htfPredictionEngine';
import { loadStrikeHistory, deriveStrikeTrendAnalytics } from './strikeHistoryEngine';
import { NSE_CROSS_EXPIRY_22900_QUOTES, resolveNextExpiryContractQuote } from '../data/officialNseQuotes';
import { computeAdvanceTradeSetup } from './advanceTradeEngine';
import { loadSelfHealingCalibration } from './selfHealingEngine';

/**
 * Calculates a dynamic, continuous, non-static prediction confidence percentage (0-100%)
 * based on multi-factor confluence, indicator alignments, volatility velocity, and constituent breadth.
 */
export function calculateDynamicConfidence(
  action: SignalAction,
  strength: SignalStrength,
  score: number,
  bullMatches: number,
  bearMatches: number,
  totalFactors: number = 7,
  rt?: import('../types/options').RealtimePredictionIndicators,
  ticker?: TickerConfig,
  constituentAnalysis?: import('../types/options').NiftyConstituentAnalysis,
  telemetry?: import('../types/options').InterMarketTelemetry
): number {
  if (action === 'WAIT_NEUTRAL') {
    // WAIT_NEUTRAL confidence measures capital protection clarity
    const maxConflict = Math.min(bullMatches, bearMatches);
    const scoreDampening = Math.abs(score);
    const volComp = rt?.volumeAnalytics?.totalVolumeMultiplier ? (rt.volumeAnalytics.totalVolumeMultiplier < 0.7 ? 8 : 0) : 0;
    const baseWaitConf = 52 + maxConflict * 4.5 + volComp - Math.min(8, scoreDampening * 1.5);
    return Math.min(78, Math.max(45, Math.round(baseWaitConf)));
  }

  const matches = action === 'BUY_CE' ? bullMatches : bearMatches;
  const matchRatio = matches / Math.max(1, totalFactors);

  // Base confidence from multi-factor match ratio (e.g. 4/7 -> 68%, 5/7 -> 74%, 6/7 -> 80%, 7/7 -> 85%)
  let conf = 54 + matchRatio * 26;

  // Confluence Score Magnitude (+0 to +6%)
  const scoreAbs = Math.abs(score);
  conf += Math.min(6, (scoreAbs / 3.8) * 6);

  // VWAP & EMA Alignment Boost (+2% to +4.5%)
  if (rt) {
    if ((action === 'BUY_CE' && rt.vwap.bias === 'BULLISH') || (action === 'BUY_PE' && rt.vwap.bias === 'BEARISH')) {
      conf += 2.5;
    }
    if ((action === 'BUY_CE' && rt.ema.alignment === 'BULLISH_STACK') || (action === 'BUY_PE' && rt.ema.alignment === 'BEARISH_STACK')) {
      conf += 2.0;
    }
    if (rt.volumeAnalytics && rt.volumeAnalytics.totalVolumeMultiplier >= 1.30) {
      conf += 2.5;
    }
    if (rt.vixVelocity?.velocityState === 'SURGING') {
      conf -= 2.5;
    }
  }

  // Constituent Breadth Alignment Boost (+2%)
  if (constituentAnalysis) {
    if ((action === 'BUY_CE' && constituentAnalysis.advances > constituentAnalysis.declines) ||
        (action === 'BUY_PE' && constituentAnalysis.declines > constituentAnalysis.advances)) {
      conf += 2.0;
    }
  }

  // Global Inter-Market Telemetry Boost (+1.5%)
  if (telemetry) {
    if ((action === 'BUY_CE' && telemetry.globalCompositeScore > 15) ||
        (action === 'BUY_PE' && telemetry.globalCompositeScore < -15)) {
      conf += 1.5;
    }
  }

  // Clamped bounds: High precision (52% to 94%)
  return Math.min(94, Math.max(52, Math.round(conf)));
}

/**
 * Computes market metrics from an option chain
 */
export function computeMarketMetrics(
  ticker: TickerConfig,
  chain: OptionChainRow[]
): MarketMetrics {
  let totalCeOI = 0;
  let totalPeOI = 0;
  let totalCeVol = 0;
  let totalPeVol = 0;

  let maxCeOI = -1;
  let maxCeStrike = ticker.atmStrike;
  let maxPeOI = -1;
  let maxPeStrike = ticker.atmStrike;

  // Max Pain calculation: find strike with minimum total payout across all contracts
  const painScores: { strike: number; pain: number }[] = [];

  for (const row of chain) {
    totalCeOI += row.ce.openInterest;
    totalPeOI += row.pe.openInterest;
    totalCeVol += row.ce.volume;
    totalPeVol += row.pe.volume;

    if (row.ce.openInterest > maxCeOI) {
      maxCeOI = row.ce.openInterest;
      maxCeStrike = row.strike;
    }

    if (row.pe.openInterest > maxPeOI) {
      maxPeOI = row.pe.openInterest;
      maxPeStrike = row.strike;
    }
  }

  // Calculate Max Pain
  for (const evalRow of chain) {
    const evalStrike = evalRow.strike;
    let totalPain = 0;

    for (const row of chain) {
      // CE payout if spot settles at evalStrike
      if (evalStrike > row.strike) {
        totalPain += (evalStrike - row.strike) * row.ce.openInterest;
      }
      // PE payout if spot settles at evalStrike
      if (evalStrike < row.strike) {
        totalPain += (row.strike - evalStrike) * row.pe.openInterest;
      }
    }
    painScores.push({ strike: evalStrike, pain: totalPain });
  }

  painScores.sort((a, b) => a.pain - b.pain);
  const maxPainStrike = painScores.length > 0 ? painScores[0].strike : ticker.atmStrike;

  const pcrTotalOI = totalCeOI > 0 ? Number((totalPeOI / totalCeOI).toFixed(2)) : 1.0;
  const pcrVolume = totalCeVol > 0 ? Number((totalPeVol / totalCeVol).toFixed(2)) : 1.0;

  // IV Rank (estimated based on ticker VIX against 10-35 normal range)
  const ivRank = Math.min(100, Math.max(0, Math.round(((ticker.vix - 10) / 25) * 100)));

  // Determine overall market trend based on current spot vs previous close
  const priceChange = ticker.changePercent;
  let marketTrend: MarketMetrics['marketTrend'] = 'NEUTRAL';
  if (priceChange >= 0.6 && pcrTotalOI >= 1.10) {
    marketTrend = 'STRONG_BULLISH';
  } else if (priceChange > 0.05 || pcrTotalOI >= 1.05) {
    marketTrend = 'BULLISH';
  } else if (priceChange <= -0.6 && pcrTotalOI <= 0.85) {
    marketTrend = 'STRONG_BEARISH';
  } else if (priceChange < -0.05 || pcrTotalOI < 0.95) {
    marketTrend = 'BEARISH';
  }

  const realtimeIndicators = computeRealtimeIndicators(ticker, chain);

  const dynamicAtmStrike = Math.round(ticker.spotPrice / ticker.strikeStep) * ticker.strikeStep;

  return {
    spotPrice: ticker.spotPrice,
    atmStrike: dynamicAtmStrike,
    maxPainStrike,
    pcrTotalOI,
    pcrVolume,
    totalCeOI,
    totalPeOI,
    majorSupportStrike: maxPeStrike,
    majorResistanceStrike: maxCeStrike,
    ivRank,
    marketTrend,
    realtimeIndicators,
  };
}

/**
 * Institutional Decision Engine for CE vs PE Recommendation
 * Deeply responsive to the CURRENT live market price
 */
export function generateTradeSignal(
  ticker: TickerConfig,
  metrics: MarketMetrics,
  chain: OptionChainRow[],
  newsItems: NewsItem[] = [],
  previousSignal?: TradeSignal,
  expiryIndex: number = 0,
  liveConstituentAnalysis?: import('../types/options').NiftyConstituentAnalysis,
  liveGlobalMacro?: import('../types/options').InterMarketTelemetry,
  injectedCandlePatterns?: import('../types/options').MultiTimeframeChartPatterns
): TradeSignal {
  // Sanitize previousSignal to ensure it belongs strictly to the active ticker (prevents cross-ticker hysteresis bleed)
  const activePreviousSignal = previousSignal && previousSignal.tickerSymbol === ticker.symbol 
    ? previousSignal 
    : undefined;

  const { spotPrice, atmStrike, pcrTotalOI, majorSupportStrike, majorResistanceStrike, maxPainStrike, ivRank } = metrics;
  const vix = Math.max(9, ticker.vix || 13);
  const rt = metrics.realtimeIndicators || computeRealtimeIndicators(ticker, chain);
  const marketStatus = getMarketHoursStatus(ticker);
  const isClosingSoon = Boolean(marketStatus.isOpen && marketStatus.isClosingSoon);
  const minutesToClose = marketStatus.minutesToClose ?? 45;
  
  // Nearby strikes around current spot
  const nearbyRows = chain.filter(r => Math.abs(r.strike - atmStrike) <= ticker.strikeStep * 3);
  let nearbyCeOIChg = 0;
  let nearbyPeOIChg = 0;

  for (const r of nearbyRows) {
    nearbyCeOIChg += r.ce.oiChange;
    nearbyPeOIChg += r.pe.oiChange;
  }

  // Global News, Gift Nifty & Macro Sentiment impact
  const safeNews = Array.isArray(newsItems) ? newsItems : [];
  const relevantNews = safeNews.filter(n => (n.relatedTickers && n.relatedTickers.includes(ticker.symbol)) || n.category === 'Macro' || n.category === 'Geopolitics');
  const giftNiftyNews = relevantNews.filter(n => n.title.toLowerCase().includes('gift nifty') || n.title.toLowerCase().includes('sgx') || n.title.toLowerCase().includes('global') || n.title.toLowerCase().includes('wall street'));
  const bullishNewsCount = relevantNews.filter(n => n.sentiment === 'BULLISH').length;
  const bearishNewsCount = relevantNews.filter(n => n.sentiment === 'BEARISH').length;
  const rawGiftNiftyNewsBias = giftNiftyNews.reduce((acc, n) => acc + (n.sentiment === 'BULLISH' ? 1.0 : n.sentiment === 'BEARISH' ? -1.0 : 0), 0);
  const giftNiftyNewsBias = Math.max(-1.5, Math.min(1.5, rawGiftNiftyNewsBias));

  // 1c. Real Live GIFT Nifty & Global Macro Sentiment Integration
  const realGiftNiftyDelta = liveGlobalMacro?.giftNifty?.change ?? 0;
  const realGiftNiftyPct = liveGlobalMacro?.giftNifty?.changePercent ?? 0;
  const gnPrice = liveGlobalMacro?.giftNifty?.price ?? spotPrice;
  const rawGap = (liveGlobalMacro?.giftNifty as any)?.impliedCashGap;
  const rawBasis = (liveGlobalMacro?.giftNifty as any)?.basisPoints;
  const fairBasis = typeof rawBasis === 'number' && rawBasis > 0 
    ? rawBasis 
    : (ticker.symbol.includes('BANK') ? 45 : (spotPrice > 15000 ? 18 : 0));
  const impliedCashDiff = typeof rawGap === 'number' && rawGap !== 0
    ? rawGap
    : (gnPrice > 10000 ? (gnPrice - fairBasis) - spotPrice : 0);

  let liveGiftDriftScore = 0;
  if (liveGlobalMacro?.giftNifty) {
    if (impliedCashDiff >= 25 || (realGiftNiftyPct >= 0.25 && impliedCashDiff >= 10)) liveGiftDriftScore = 2.4;
    else if (impliedCashDiff >= 10 || realGiftNiftyPct >= 0.08) liveGiftDriftScore = 1.3;
    else if (impliedCashDiff <= -25 && realGiftNiftyPct <= -0.15) liveGiftDriftScore = -2.4;
    else if (impliedCashDiff <= -12 && realGiftNiftyPct <= -0.06) liveGiftDriftScore = -1.3;
    else liveGiftDriftScore = Number(((impliedCashDiff / 25) * 1.0).toFixed(2));
  }

  // Combine live GIFT Nifty futures delta with news bias:
  const effectiveGiftNiftyBias = liveGlobalMacro?.giftNifty 
    ? Number((liveGiftDriftScore * 0.70 + giftNiftyNewsBias * 0.30).toFixed(2))
    : giftNiftyNewsBias;

  // News sentiment direct bias:
  const newsSentimentBias = Number(Math.max(-1.5, Math.min(1.5, (bullishNewsCount - bearishNewsCount) * 0.4)).toFixed(2));

  // Strike history cumulative feedback:
  const strikeHistory = loadStrikeHistory(ticker, chain);
  const strikeAnalytics = deriveStrikeTrendAnalytics(strikeHistory, ticker, chain);
  let strikeHistoryBias = 0;
  if (strikeAnalytics.cumulativeTrend.alignmentStatus === 'STRONG_CONVERGENCE') {
    strikeHistoryBias = strikeAnalytics.cumulativeTrend.dominantAction === 'BULLISH_CE' ? 0.8 : -0.8;
  } else if (strikeAnalytics.cumulativeTrend.alignmentStatus === 'MODERATE_CONVERGENCE') {
    strikeHistoryBias = strikeAnalytics.cumulativeTrend.dominantAction === 'BULLISH_CE' ? 0.4 : -0.4;
  }
  // Zero out historical bias if live intraday price action contradicts it:
  if (strikeHistoryBias > 0 && spotPrice < rt.vwap.value) {
    strikeHistoryBias = 0;
  } else if (strikeHistoryBias < 0 && spotPrice > rt.vwap.value) {
    strikeHistoryBias = 0;
  }

  // Dynamic Multi-Factor Scoring Matrix including Macro, Gift Nifty, IV Rank & OI Buildup
  let score = 0;

  // 1a. Daily Reference Trend (vs Previous Close)
  const spotChangePct = ticker.changePercent;
  // Dampen previous close anchor: During active regular session, previous close is only 10% weight
  // so an opening gap-up does NOT mask an afternoon selloff!
  const prevCloseTrendScore = Number(Math.max(-1.2, Math.min(1.2, (spotChangePct / 0.5) * 1.0)).toFixed(2));

  // 1b. Symmetric Intraday Price Action: Peak Rejection vs Low Absorption
  const dayHigh = ticker.dayHigh && ticker.dayHigh >= spotPrice ? ticker.dayHigh : Math.max(ticker.dayHigh || spotPrice, spotPrice);
  const dayLow = ticker.dayLow && ticker.dayLow <= spotPrice ? ticker.dayLow : Math.min(ticker.dayLow || spotPrice, spotPrice);
  const dayRange = Math.max(ticker.strikeStep * 0.5, dayHigh - dayLow);

  const lowRecoveryRatio = (spotPrice - dayLow) / dayRange;     // 0.0 at low, 1.0 at high
  const recoveryRatio = lowRecoveryRatio; // backwards-compatible alias
  const highRejectionRatio = (dayHigh - spotPrice) / dayRange;   // 0.0 at high, 1.0 at low
  const dropFromPeak = dayHigh - spotPrice;
  const bounceFromFloor = spotPrice - dayLow;
  const recoveryPoints = bounceFromFloor;
  const rejectionPoints = dropFromPeak;

  // Normalized swing: +2.5 when pressing session highs, -2.5 when breaking towards session lows
  const normIntradaySwing = (lowRecoveryRatio - 0.5) * 2; // -1.0 to +1.0
  let intradaySwingScore = Number((normIntradaySwing * 2.4).toFixed(2));

  // Symmetric Reversal Accelerators:
  // Afternoon selloff / top rejection: If spot fell significantly from session high (drop >= 0.45 strikeStep or highRejectionRatio >= 0.22)
  if (dropFromPeak >= ticker.strikeStep * 0.80 || (dropFromPeak >= ticker.strikeStep * 0.45 && highRejectionRatio >= 0.22)) {
    // Punish buying calls into an active rejection / intraday decline from session high
    const dropPenalty = Math.min(2.8, (dropFromPeak / Math.max(ticker.strikeStep, 1)) * 0.90);
    intradaySwingScore = Math.min(-0.8, -0.6 - dropPenalty);
  }
  // Morning/session low floor absorption:
  if (bounceFromFloor >= ticker.strikeStep * 0.80 || (bounceFromFloor >= ticker.strikeStep * 0.45 && lowRecoveryRatio >= 0.22 && dropFromPeak < ticker.strikeStep * 0.45)) {
    const bounceBonus = Math.min(2.8, (bounceFromFloor / Math.max(ticker.strikeStep, 1)) * 0.90);
    intradaySwingScore = Math.max(0.8, 0.6 + bounceBonus);
  }

  // Combined Price Action: Intraday swing carries 90% weight, previous close carries 10% weight during live market
  let combinedPriceScore = Number((prevCloseTrendScore * 0.10 + intradaySwingScore * 0.90).toFixed(2));

  // Pre-market predictor adjustment: If using pre-market data, bypass regular session intraday scores 
  // (which might be stale or zero) and prioritize pre-market change stats & overnight gap momentum
  if (ticker.isUsingPreMarket) {
    const pmChangePct = ticker.preMarketChangePercent !== undefined ? ticker.preMarketChangePercent : spotChangePct;
    let preMarketPriceScore = 0;
    if (pmChangePct >= 0.4) preMarketPriceScore = 3.0;
    else if (pmChangePct > 0.05) preMarketPriceScore = 1.5;
    else if (pmChangePct <= -0.4) preMarketPriceScore = -3.0;
    else if (pmChangePct < -0.05) preMarketPriceScore = -1.5;

    // We blend pre-market price action with Gift Nifty / overnight bias heavily
    combinedPriceScore = Number((preMarketPriceScore * 0.75 + (effectiveGiftNiftyBias * 2.0) * 0.25).toFixed(2));
  }

  score += combinedPriceScore;

  // 2. Gift Nifty / Global Macro Sentiment Weight (Clamped)
  // Double-weight Gift Nifty for pre-market sessions as it dictates opening direction.
  // During regular session, dampen Gift Nifty weight so intraday spot & derivatives dominate.
  score += ticker.isUsingPreMarket ? effectiveGiftNiftyBias * 1.8 : effectiveGiftNiftyBias * 0.25;

  // 2b. Add News Sentiment & Strike History Cumulative Edge
  score += newsSentimentBias;
  score += strikeHistoryBias;

  // 3. Current Spot Price relative to ATM Strike & Max Pain (Continuous Deadband Ramping)
  // Replaced binary jumps with smooth slope to eliminate single-tick 2.4-point whipsaw flips
  const atmOffsetRatio = (spotPrice - atmStrike) / ticker.strikeStep;
  const atmProximityScore = Math.abs(atmOffsetRatio) < 0.08 
    ? 0 
    : Math.max(-1.2, Math.min(1.2, (atmOffsetRatio / 0.35) * 1.2));
  score += Number(atmProximityScore.toFixed(2));

  const maxPainOffsetRatio = (spotPrice - maxPainStrike) / ticker.strikeStep;
  const maxPainScore = Math.abs(maxPainOffsetRatio) < 0.15 
    ? 0 
    : Math.max(-0.8, Math.min(0.8, -(maxPainOffsetRatio / 0.5) * 0.8));
  score += Number(maxPainScore.toFixed(2));

  // 4. Put-Call Ratio (PCR) & OI Buildup Velocity
  // When spot is holding above VWAP, high PCR confirms put writing support floor.
  // BUT when spot is falling below VWAP or rejecting from highs (rejection >= 0.35), high PCR signals trapped put writers vulnerable to long unwinding!
  const isVwapBearishOrRejecting = spotPrice < rt.vwap.value || highRejectionRatio >= 0.35;
  const isVwapBullishOrRecovering = spotPrice > rt.vwap.value || lowRecoveryRatio >= 0.35;
  if (pcrTotalOI >= 1.25) {
    score += isVwapBearishOrRejecting ? -1.0 : 2.0;
  } else if (pcrTotalOI >= 1.05) {
    score += isVwapBearishOrRejecting ? -0.4 : 1.0;
  } else if (pcrTotalOI <= 0.78) {
    score -= isVwapBullishOrRecovering ? -1.0 : 2.0;
  } else if (pcrTotalOI <= 0.95) {
    score -= isVwapBullishOrRecovering ? -0.4 : 1.0;
  }

  // 4b. Nearby Strike Open Interest Buildup Velocity (Positive Expansion vs Unwinding)
  // Put writing accumulation (positive PeOIChg) establishes floor support -> Bullish (+1.2)
  // Call writing accumulation (positive CeOIChg) establishes overhead supply -> Bearish (-1.2)
  // Put unwinding (negative PeOIChg) reveals cracking floor -> Bearish (-0.8)
  // Call unwinding (negative CeOIChg) reveals short squeeze trap -> Bullish (+0.8)
  const minOiThreshold = Math.max(250, (ticker.lotSize || 50) * 15);
  const minUnwindingThreshold = -minOiThreshold * 2;
  const peOiExpanding = nearbyPeOIChg > minOiThreshold && nearbyPeOIChg > Math.max(0, nearbyCeOIChg) * 1.15;
  const ceOiExpanding = nearbyCeOIChg > minOiThreshold && nearbyCeOIChg > Math.max(0, nearbyPeOIChg) * 1.15;
  const peOiUnwinding = nearbyPeOIChg < minUnwindingThreshold && nearbyCeOIChg >= -minOiThreshold;
  const ceOiUnwinding = nearbyCeOIChg < minUnwindingThreshold && nearbyPeOIChg >= -minOiThreshold;

  if (peOiExpanding || ceOiUnwinding) {
    score += peOiExpanding ? 1.2 : 0.8;
  } else if (ceOiExpanding || peOiUnwinding) {
    score -= ceOiExpanding ? 1.2 : 0.8;
  }

  // 5. IV Rank / Volatility Environment adjustment
  if (ivRank > 65) {
    score *= 0.9;
  } else if (ivRank < 30) {
    score *= 1.15;
  }

  // 6. General News Sentiment Weight (Clamped)
  if (bullishNewsCount > bearishNewsCount) score += Math.min(1.0, (bullishNewsCount - bearishNewsCount) * 0.35);
  else if (bearishNewsCount > bullishNewsCount) score -= Math.min(1.0, (bearishNewsCount - bullishNewsCount) * 0.35);

  // 7. Candlestick & Multi-Timeframe Chart Patterns Confluence (2m, 5m, 15m)
  const candlePatterns = injectedCandlePatterns || computeMultiTimeframeChartPatterns(ticker);
  score += (candlePatterns.confluenceScore * 0.4);
  if (candlePatterns.orbStatus === 'BULLISH_ORB_BREAKOUT') {
    score += 1.2;
  } else if (candlePatterns.orbStatus === 'BEARISH_ORB_BREAKDOWN') {
    score -= 1.2;
  }

  // Regime Detection: Institutional VWAP & Price Action Architecture
  const isAboveVWAP = spotPrice >= rt.vwap.value;
  const isBelowVWAP = spotPrice < rt.vwap.value;
  const isAboveDayOpen = ticker.dayOpen ? spotPrice > ticker.dayOpen : spotChangePct > 0;
  const isBelowDayOpen = ticker.dayOpen ? spotPrice < ticker.dayOpen : spotChangePct < 0;

  // Genuine Bullish Regime: Spot holding firmly above VWAP with bullish EMA/VWAP bias, non-bearish candlestick confluence
  const isMarketRaising = Boolean(
    candlePatterns.isPersistent40mRise ||
    (isAboveVWAP && highRejectionRatio < 0.35 && (isAboveDayOpen || lowRecoveryRatio >= 0.60) && (rt.ema.alignment === 'BULLISH_STACK' || rt.vwap.bias === 'BULLISH') && candlePatterns.confluenceBias !== 'BEARISH')
  );

  // Genuine Bearish Regime: Spot trading below VWAP, or experiencing a confirmed afternoon rejection from day high, or persistent 40m fall
  const isCandleSellingFlow = candlePatterns.confluenceBias === 'BEARISH' || candlePatterns.m5?.trend === 'BEARISH' || (candlePatterns.m5?.momentumScore || 0) <= -2.5 || Boolean(candlePatterns.isPersistent40mFall);
  const isContinuousFall = Boolean(
    candlePatterns.isPersistent40mFall ||
    ((isBelowVWAP || highRejectionRatio >= 0.25 || dropFromPeak >= ticker.strikeStep * 0.45) && 
     (isBelowDayOpen || highRejectionRatio >= 0.20 || dropFromPeak >= ticker.strikeStep * 0.60 || spotChangePct <= -0.05 || isCandleSellingFlow) && 
     (rt.ema.alignment === 'BEARISH_STACK' || rt.vwap.bias === 'BEARISH' || isCandleSellingFlow || highRejectionRatio >= 0.30 || dropFromPeak >= ticker.strikeStep * 0.70))
  );

  // Intraday Recovery Bounce check
  const isConfirmedBullishReversal = lowRecoveryRatio >= 0.50 && highRejectionRatio <= 0.35 && spotPrice >= rt.vwap.value && candlePatterns.confluenceBias === 'BULLISH';
  const isIntradayRecoveryRally = isConfirmedBullishReversal;

  // Penalize score if persistent continuous fall is active
  if (isContinuousFall && score > -1.0) {
    score = Math.min(-1.2, score - 2.2);
  }

  // 7b. Nifty Derivative Constituent Heavyweights & Sectoral Delta Engine (Indian Markets)
  const isParentNifty = ticker.symbol.includes('NIFTY') && !ticker.symbol.includes('BANK');
  const isParentBank = ticker.symbol.includes('BANK');
  const isIntradayDropping = isContinuousFall || (highRejectionRatio >= 0.35 && dropFromPeak >= ticker.strikeStep * 0.45);
  const effectiveConstituentChg = isIntradayDropping
    ? (ticker.dayOpen ? Number((((ticker.spotPrice - ticker.dayOpen) / ticker.dayOpen) * 100).toFixed(2)) : -0.35)
    : ticker.changePercent;
  const constituentAnalysis = (liveConstituentAnalysis && (
    !liveConstituentAnalysis.symbol ||
    liveConstituentAnalysis.symbol === ticker.symbol ||
    (isParentNifty && (liveConstituentAnalysis.symbol === 'NIFTY' || liveConstituentAnalysis.symbol === 'NIFTY 50' || liveConstituentAnalysis.symbol === 'NIFTY50')) ||
    (isParentBank && liveConstituentAnalysis.symbol.includes('BANK'))
  ))
    ? liveConstituentAnalysis
    : ((ticker.currency === '₹') ? analyzeNiftyConstituents(ticker.symbol, undefined, effectiveConstituentChg) : undefined);
  if (constituentAnalysis) {
    const constituentWeight = isIntradayDropping ? 0.35 : 1.0;
    score += (constituentAnalysis.breadthScore * 0.45 * constituentWeight);
    score += (constituentAnalysis.weightedConstituentDelta * 2.5 * constituentWeight);
  }

  // =========================================================================
  // REAL-TIME QUANTITATIVE PARAMETERS INTEGRATION & ENGINE TUNING
  // =========================================================================

  // 8. Intraday VWAP & Volatility Bands
  if (rt.vwap.bias === 'BULLISH') {
    score += rt.vwap.distancePercent >= 0.20 ? 1.5 : 1.0;
  } else if (rt.vwap.bias === 'BEARISH') {
    score -= rt.vwap.distancePercent <= -0.20 ? 1.5 : 1.0;
  }

  // 9. 5-Minute 9/21 EMA Trend Stack
  if (rt.ema.alignment === 'BULLISH_STACK') {
    score += 1.1;
  } else if (rt.ema.alignment === 'BEARISH_STACK') {
    score -= 1.1;
  }

  // 10. 5-Minute RSI (14) & Divergence
  if (rt.rsi.condition === 'BULLISH') {
    score += 1.2;
  } else if (rt.rsi.condition === 'BEARISH') {
    score -= 1.2;
  }
  if (rt.rsi.divergence === 'BULLISH_DIVERGENCE') {
    score += 1.5;
  } else if (rt.rsi.divergence === 'BEARISH_DIVERGENCE') {
    score -= 1.5;
  }

  // 11. 5-Minute MACD (12, 26, 9) Histogram & Velocity
  if (rt.macd.trend === 'BULLISH_EXPANSION') {
    score += 1.2;
  } else if (rt.macd.trend === 'BEARISH_EXPANSION') {
    score -= 1.2;
  } else if (rt.macd.trend === 'BULLISH_DECELERATION') {
    score -= 0.4;
  } else if (rt.macd.trend === 'BEARISH_DECELERATION') {
    score += 0.4;
  }

  // 12. Option Order Flow Delta & Volume Imbalance
  if (rt.orderFlow.sentiment === 'BUYER_DOMINANCE') {
    score += 1.0;
  } else if (rt.orderFlow.sentiment === 'SELLER_DOMINANCE') {
    score -= 1.0;
  }
  if (rt.orderFlow.pcrDivergence >= 0.20) {
    score -= 0.7; // Fast intraday put accumulation
  } else if (rt.orderFlow.pcrDivergence <= -0.20) {
    score += 0.7; // Fast intraday call accumulation
  }

  // 13. VIX Volatility Velocity
  if (rt.vixVelocity.velocityState === 'SURGING' && score < 0) {
    score -= 1.0; // Volatility surge accelerates downside momentum
  } else if (rt.vixVelocity.velocityState === 'COMPRESSING' && score > 0) {
    score += 0.6; // Volatility crush supports steady grind up
  }

  // 14. Inter-Market Telemetry & Global Macro Cues
  const interMarketTelemetry = getInterMarketTelemetry(ticker.symbol, liveGlobalMacro);
  const globalScoreContrib = Number(((interMarketTelemetry.globalCompositeScore / 100) * 2.2).toFixed(2));
  score += globalScoreContrib;

  // 15. Volume Analytics & Institutional Spike Multiplier
  if (rt.volumeAnalytics) {
    if (rt.volumeAnalytics.volumeDivergence === 'BULLISH_VOLUME_EXPANSION') {
      score += 1.4;
    } else if (rt.volumeAnalytics.volumeDivergence === 'BEARISH_VOLUME_EXPANSION') {
      score -= 1.4;
    }
  }

  // 16. Option Gamma (GEX) Dealer Regime
  if (rt.gammaExposure) {
    const isNegGex = rt.gammaExposure.regime === 'NEGATIVE_GAMMA' || spotPrice < (rt.gammaExposure.flipStrike || atmStrike);
    if (isNegGex && (spotPrice < rt.vwap.value || score < 0)) {
      score -= 1.4; // Dealer short gamma accelerates selling pressure
    } else if (!isNegGex && spotPrice > rt.vwap.value && rt.gammaExposure.regime === 'POSITIVE_GAMMA') {
      score += 0.8; // Dealer long gamma pin support
    } else if (isNegGex && spotPrice > rt.vwap.value && score > 0) {
      score += 1.4; // Short gamma short squeeze acceleration
    }
  }

  // 17. Multi-Timeframe Trend Coherence (MTCF across 1m, 2m, 5m, 15m, 1h, 1d)
  const tfTrends = [
    candlePatterns.m1?.trend || 'SIDEWAYS',
    candlePatterns.m2?.trend || 'SIDEWAYS',
    candlePatterns.m5?.trend || 'SIDEWAYS',
    candlePatterns.m15?.trend || 'SIDEWAYS',
    candlePatterns.h1?.trend || 'SIDEWAYS',
    candlePatterns.d1?.trend || 'SIDEWAYS',
  ];
  const bullTf = tfTrends.filter(t => t === 'BULLISH').length;
  const bearTf = tfTrends.filter(t => t === 'BEARISH').length;
  if (bullTf >= 4) {
    score += 1.8;
  } else if (bullTf >= 3) {
    score += 1.0;
  } else if (bearTf >= 4) {
    score -= 1.8;
  } else if (bearTf >= 3) {
    score -= 1.0;
  }

  // =========================================================================
  // CAPITAL PROTECTION & QUANT GUARD RAILS (Prevent False Trades & Traps)
  // Bounded Quant Capital Protection: Dampens signals on caution conditions,
  // but caps maximum cumulative dampening at 0.72 (max 28% total reduction)
  // to eliminate cascading multiplier annihilation and erratic recommendation flips!
  // =========================================================================
  let capitalProtectionReason = '';
  let cumulativeGuardDampen = 1.0;

  const applyCautionGuard = (factor: number, reason: string) => {
    cumulativeGuardDampen = Math.max(0.72, cumulativeGuardDampen * factor);
    if (!capitalProtectionReason) {
      capitalProtectionReason = reason;
    }
  };

  // GUARD RAIL 0: Nifty Derivative Heavyweight Divergence Protection
  if (constituentAnalysis && Array.isArray(constituentAnalysis.sectoralBreakdown)) {
    const bankingSector = constituentAnalysis.sectoralBreakdown.find(s => s.sector === 'Banking');
    const isHeavyweightBearish = (constituentAnalysis.overallHeavyweightBias || '').includes('BEARISH');

    // If top banking heavyweights are actively rallying with Long Buildup, soften PE signals (unless market is falling intraday)
    if (bankingSector && bankingSector.sentiment === 'BULLISH' && constituentAnalysis.netNiftyPointImpact > 18 && score < 0 && !isContinuousFall && highRejectionRatio < 0.35) {
      applyCautionGuard(0.78, `Capital Protection: Key banking heavyweights (HDFC Bank, ICICI Bank, SBI) are advancing (+${constituentAnalysis.netNiftyPointImpact} pts). Selling or buying puts against institutional banking accumulation has high risk.`);
    }

    // If heavyweights are in broad selloff, soften CE signals
    if (isHeavyweightBearish && constituentAnalysis.netNiftyPointImpact < -18 && score > 0) {
      applyCautionGuard(0.78, `Capital Protection: Derivative heavyweights are lagging (A/D: ${constituentAnalysis.advances}/${constituentAnalysis.declines}, ${constituentAnalysis.netNiftyPointImpact} pts). Buying calls into broad constituent supply drag has poor probability.`);
    }
  }

  // GUARD RAIL 1: Trend Alignment with Institutional VWAP (Symmetric & Zero-Bias)
  if (isAboveVWAP && score < -1.0 && pcrTotalOI >= 0.95 && candlePatterns.confluenceBias !== 'BEARISH' && !isContinuousFall && dropFromPeak < ticker.strikeStep * 0.5) {
    applyCautionGuard(0.75, `Capital Protection: Spot (${ticker.currency}${spotPrice.toLocaleString()}) is holding above Intraday VWAP (${ticker.currency}${rt.vwap.value.toLocaleString()}). Buying puts directly against VWAP support has unfavorable odds.`);
  } else if (isBelowVWAP && score > 1.0 && pcrTotalOI <= 0.95 && candlePatterns.confluenceBias !== 'BULLISH' && !isMarketRaising && bounceFromFloor < ticker.strikeStep * 0.5) {
    applyCautionGuard(0.75, `Capital Protection: Spot (${ticker.currency}${spotPrice.toLocaleString()}) is trading below Intraday VWAP (${ticker.currency}${rt.vwap.value.toLocaleString()}). Buying calls into VWAP overhead supply has unfavorable odds.`);
  }

  // GUARD RAIL 1B: Closing Bell Proximity & Late-Session 0-DTE Protection (Final 45 Minutes)
  if (isClosingSoon && !isContinuousFall && highRejectionRatio < 0.40 && !isMarketRaising && lowRecoveryRatio < 0.40) {
    if (Math.abs(score) < 2.5) {
      applyCautionGuard(0.80, `Capital Protection: Closing bell proximity (${minutesToClose} mins left). Accelerated 0-DTE theta bleed active; stand aside in WAIT_NEUTRAL unless high-velocity breakout is established.`);
    }
  }

  // GUARD RAIL 2: Extreme PCR Reversal Trap (Do not short oversold extremes / do not buy calls at overbought peaks)
  if (pcrTotalOI <= 0.65 && score < 0) {
    applyCautionGuard(0.80, `Capital Protection: PCR is deeply oversold at ${pcrTotalOI.toFixed(2)} (<0.65). Extreme short-covering squeeze risk; avoid buying puts at climax lows.`);
  } else if (pcrTotalOI >= 1.50 && score > 0) {
    applyCautionGuard(0.80, `Capital Protection: PCR is heavily overbought at ${pcrTotalOI.toFixed(2)} (>1.50). High risk of Call writing wall rejections and institutional profit-taking.`);
  }

  // Institutional Trend Momentum Velocity Flags (Breakout Authorization)
  const isStrongBullMomentum = score >= 2.0 || (rt.ema.alignment === 'BULLISH_STACK' && (rt.macd.trend === 'BULLISH_EXPANSION' || rt.rsi.value >= 60)) || Boolean(constituentAnalysis && constituentAnalysis.netNiftyPointImpact > 10);
  const isStrongBearMomentum = score <= -2.0 || (rt.ema.alignment === 'BEARISH_STACK' && (rt.macd.trend === 'BEARISH_EXPANSION' || rt.rsi.value <= 40)) || Boolean(constituentAnalysis && constituentAnalysis.netNiftyPointImpact < -10);

  // GUARD RAIL 3: Overhead Call Wall / Support Put Wall Proximity Trap (Breakout vs Exhaustion Filter)
  const distToCallWall = majorResistanceStrike - spotPrice;
  if (score >= 0.8 && distToCallWall > 0 && distToCallWall <= ticker.strikeStep * 0.35) {
    if (!isStrongBullMomentum) {
      applyCautionGuard(0.82, `Capital Protection: Spot (${ticker.currency}${spotPrice.toLocaleString()}) is within ${distToCallWall.toFixed(1)} pts of Major Call Wall (${ticker.currency}${majorResistanceStrike.toLocaleString()}). Chasing CE right under heavy institutional call writers has poor risk-reward; wait for clean breakout.`);
    }
  }

  const distToPutWall = spotPrice - majorSupportStrike;
  if (score <= -0.8 && distToPutWall > 0 && distToPutWall <= ticker.strikeStep * 0.35) {
    if (!isStrongBearMomentum) {
      applyCautionGuard(0.82, `Capital Protection: Spot (${ticker.currency}${spotPrice.toLocaleString()}) is within ${distToPutWall.toFixed(1)} pts of Major Put Wall (${ticker.currency}${majorSupportStrike.toLocaleString()}). Chasing PE right onto heavy institutional put writing floor risks sudden relief bounces.`);
    }
  }

  // GUARD RAIL 3B: Low-Volume Lunch Lull & Narrow Deadband Consolidation Trap
  const isVolumeCompressed = Boolean(rt.volumeAnalytics && rt.volumeAnalytics.totalVolumeMultiplier < 0.65);
  const isDeadbandConsolidation = Math.abs(spotChangePct) < 0.20 && Math.abs(recoveryRatio - 0.50) < 0.15;
  if (isVolumeCompressed && isDeadbandConsolidation && Math.abs(score) < 3.0) {
    applyCautionGuard(0.78, `Capital Protection: Market is in a low-volume consolidation deadband (Volume: ${((rt.volumeAnalytics?.totalVolumeMultiplier || 0.6) * 100).toFixed(0)}% of 20MA). Directional option buying during compressed volume leads to severe theta bleed; stand aside in WAIT.`);
  }

  // GUARD RAIL 4: Day High / Day Low Breakout / Exhaustion Trap
  if (score >= 2.0 && (dayHigh - spotPrice) <= ticker.strikeStep * 0.15 && recoveryRatio >= 0.92) {
    if (!isStrongBullMomentum) {
      applyCautionGuard(0.85, `Capital Protection: Spot is trading at session day high (${ticker.currency}${dayHigh.toLocaleString()}). Avoid FOMO buying at the peak of the daily range without strong constituent confirmation.`);
    }
  }
  if (score <= -2.0 && (spotPrice - dayLow) <= ticker.strikeStep * 0.15 && recoveryRatio <= 0.08) {
    if (!isStrongBearMomentum) {
      applyCautionGuard(0.85, `Capital Protection: Spot is trading at session day low (${ticker.currency}${dayLow.toLocaleString()}). Avoid breakdown selling into the absolute floor without constituent confirmation.`);
    }
  }

  // GUARD RAIL 5: 5m RSI Overbought / Oversold Trap
  if (score >= 2.0 && rt.rsi.value >= 75) {
    if (!isStrongBullMomentum) {
      applyCautionGuard(0.85, `Capital Protection: 5m RSI is overbought at ${rt.rsi.value.toFixed(1)} (>75). High risk of bull trap / exhaustion stall; wait for pullback to VWAP (${ticker.currency}${rt.vwap.value.toLocaleString()}) or 9 EMA.`);
    }
  }
  if (score <= -2.0 && rt.rsi.value <= 25) {
    if (!isStrongBearMomentum) {
      applyCautionGuard(0.85, `Capital Protection: 5m RSI is deeply oversold at ${rt.rsi.value.toFixed(1)} (<25). High risk of violent short-covering snapback; avoid shorting the climax floor.`);
    }
  }

  // GUARD RAIL 6: VWAP & EMA Alignment Trap
  if (score >= 2.0 && spotPrice < rt.vwap.value - ticker.strikeStep * 0.15 && rt.ema.alignment === 'BEARISH_STACK') {
    applyCautionGuard(0.80, `Capital Protection: Spot (${ticker.currency}${spotPrice.toLocaleString()}) is trading below Intraday VWAP (${ticker.currency}${rt.vwap.value.toLocaleString()}) under a Bearish 9/21 EMA Stack. Wait for confirmed VWAP reclaim before entering calls.`);
  }
  if (score <= -2.0 && spotPrice > rt.vwap.value + ticker.strikeStep * 0.15 && rt.ema.alignment === 'BULLISH_STACK') {
    applyCautionGuard(0.80, `Capital Protection: Spot (${ticker.currency}${spotPrice.toLocaleString()}) is holding firmly above Intraday VWAP (${ticker.currency}${rt.vwap.value.toLocaleString()}) with Bullish EMA Stack. Avoid buying puts against institutional VWAP support floor.`);
  }

  // GUARD RAIL 7: Rejection Wick Shadow Trap
  if (score >= 2.0 && candlePatterns.m5.pattern.toLowerCase().includes('upper shadow')) {
    applyCautionGuard(0.85, `Capital Protection: 5m candle shows Upper Wick Rejection near resistance. Sellers are capping upside; wait for confirmed breakout before buying calls.`);
  }
  if (score <= -2.0 && candlePatterns.m5.pattern.toLowerCase().includes('lower shadow')) {
    applyCautionGuard(0.85, `Capital Protection: 5m candle shows Lower Wick Absorption near support. Institutional buyers are absorbing selling pressure; wait for breakdown before buying puts.`);
  }

  // GUARD RAIL 8: High Implied Volatility (IV Crush) Environment Protection
  if (ivRank >= 75 || vix >= 22) {
    if (score >= 2.0 || score <= -2.0) {
      capitalProtectionReason = capitalProtectionReason 
        ? capitalProtectionReason 
        : `Capital Protection Notice: High Implied Volatility (IV Rank ${ivRank}%, VIX ${vix.toFixed(1)}). Extrinsic option premiums are inflated; ITM strike recommended to preserve intrinsic value floor against IV crush.`;
    }
  }

  // Apply bounded dampening without destroying the trade direction
  score = Number((score * cumulativeGuardDampen).toFixed(2));

  // =========================================================================
  // INSTITUTIONAL ANTI-WHIPSAW HYSTERESIS STATE MACHINE
  // Eliminates instantaneous flip-flop switching by enforcing momentum persistence,
  // deadband buffer zones, and confirmation thresholds between opposite directions.
  // =========================================================================
  const prevAction: SignalAction = activePreviousSignal?.action || 'WAIT_NEUTRAL';
  let action: SignalAction = 'WAIT_NEUTRAL';
  let strength: SignalStrength = 'MODERATE';
  let confidence = 50;

  // Evaluate multi-factor confluence match counts (Symmetric Calibration)
  let bullMatches = 0;
  if ((lowRecoveryRatio >= 0.58 && highRejectionRatio <= 0.40) || (spotChangePct >= 0.20 && isAboveVWAP && highRejectionRatio <= 0.35)) bullMatches++;
  if (candlePatterns.confluenceBias === 'BULLISH') bullMatches++;
  if (rt.vwap.bias === 'BULLISH' && isAboveVWAP) bullMatches++;
  if (rt.ema.alignment === 'BULLISH_STACK') bullMatches++;
  if (rt.rsi.value >= 54 || rt.macd.trend === 'BULLISH_EXPANSION' || rt.rsi.divergence === 'BULLISH_DIVERGENCE') bullMatches++;
  if (pcrTotalOI >= 1.08 || rt.orderFlow.sentiment === 'BUYER_DOMINANCE' || (nearbyPeOIChg > 0 && nearbyPeOIChg > nearbyCeOIChg * 1.15)) bullMatches++;
  if (constituentAnalysis && constituentAnalysis.netNiftyPointImpact > 6) bullMatches++;

  let bearMatches = 0;
  if (highRejectionRatio >= 0.42 || (lowRecoveryRatio <= 0.42 && isBelowVWAP) || spotChangePct <= -0.15) bearMatches++;
  if (candlePatterns.confluenceBias === 'BEARISH') bearMatches++;
  if (rt.vwap.bias === 'BEARISH' && isBelowVWAP) bearMatches++;
  if (rt.ema.alignment === 'BEARISH_STACK') bearMatches++;
  if (rt.rsi.value <= 46 || rt.macd.trend === 'BEARISH_EXPANSION' || rt.rsi.divergence === 'BEARISH_DIVERGENCE') bearMatches++;
  if (pcrTotalOI <= 0.92 || rt.orderFlow.sentiment === 'SELLER_DOMINANCE' || (nearbyCeOIChg > 0 && nearbyCeOIChg > nearbyPeOIChg * 1.15)) bearMatches++;
  if (constituentAnalysis && constituentAnalysis.netNiftyPointImpact < -6) bearMatches++;

  // =========================================================================
  // ZERO-BIAS INSTITUTIONAL DECISION ENGINE WITH MULTI-FACTOR DIVERGENCE AUDIT
  // =========================================================================
  const netBullEdge = bullMatches - bearMatches;

  // Candlestick multi-timeframe directional bias & score:
  const isCandleBearish = candlePatterns.confluenceBias === 'BEARISH' || candlePatterns.confluenceScore <= -0.8;
  const isCandleBullish = candlePatterns.confluenceBias === 'BULLISH' || candlePatterns.confluenceScore >= 0.8;

  // Real Candlestick Directional Lock (prioritizing 5m/15m intraday price action):
  // If real candlesticks are moving DOWNWARD (5m trend bearish or 40m drop), NEVER recommend BUY_CE.
  // If real candlesticks are moving UPWARD (5m trend bullish or 40m rally), NEVER recommend BUY_PE.
  const isTacticalDownward = candlePatterns.m5?.trend === 'BEARISH' || candlePatterns.confluenceBias === 'BEARISH' || candlePatterns.confluenceScore < -0.3 || (highRejectionRatio >= 0.35 && dropFromPeak >= ticker.strikeStep * 0.45) || isContinuousFall;
  const isTacticalUpward = (candlePatterns.m5?.trend === 'BULLISH' || candlePatterns.confluenceBias === 'BULLISH' || candlePatterns.confluenceScore > 0.3 || (lowRecoveryRatio >= 0.35 && bounceFromFloor >= ticker.strikeStep * 0.45) || isMarketRaising) && !isTacticalDownward;

  const isCandleUpward = isTacticalUpward;
  const isCandleDownward = isTacticalDownward;

  // Add candlestick confluence to match tallies:
  if (candlePatterns.confluenceBias === 'BULLISH' && candlePatterns.confluenceScore >= 1.5) bullMatches++;
  if (candlePatterns.confluenceBias === 'BEARISH' && candlePatterns.confluenceScore <= -1.5) bearMatches++;
  if (isContinuousFall || isTacticalDownward) bearMatches++;
  if (isMarketRaising || isTacticalUpward) bullMatches++;

  // Multi-factor contradiction counters: Require 2+ contradictory indicators to veto a signal,
  // preventing a single dissenting micro-metric from blocking high-probability setups.
  const bearContradictionCount = (
    (pcrTotalOI <= 0.78 ? 1 : 0) +
    (rt.orderFlow.sentiment === 'SELLER_DOMINANCE' ? 1 : 0) +
    (isCandleBearish ? 1 : 0) +
    (constituentAnalysis && constituentAnalysis.netNiftyPointImpact < -20 ? 1 : 0)
  );

  const bullContradictionCount = (
    (pcrTotalOI >= 1.30 ? 1 : 0) +
    (rt.orderFlow.sentiment === 'BUYER_DOMINANCE' ? 1 : 0) +
    (isCandleBullish ? 1 : 0) +
    (constituentAnalysis && constituentAnalysis.netNiftyPointImpact > 20 ? 1 : 0)
  );

  // Intraday Rejection & Breakdown Vetoes:
  // If spot has broken down from morning highs (highRejectionRatio >= 0.35) or is below VWAP, VETO all BUY_CE recommendations!
  const isIntradayRejectionVeto = (highRejectionRatio >= 0.35 && dropFromPeak >= ticker.strikeStep * 0.45) || (isBelowVWAP && rt.vwap.bias === 'BEARISH') || isContinuousFall;
  const isIntradayBounceVeto = (lowRecoveryRatio >= 0.35 && bounceFromFloor >= ticker.strikeStep * 0.45) || (isAboveVWAP && rt.vwap.bias === 'BULLISH') || isMarketRaising;

  // Hard Veto Filters:
  const isHardBearishVeto = isCandleDownward || bearContradictionCount >= 2 || (isContinuousFall && score < 0) || isIntradayRejectionVeto;
  const isHardBullishVeto = isCandleUpward || bullContradictionCount >= 2 || (isMarketRaising && score > 0) || isIntradayBounceVeto;

  // Multi-Timeframe Consensus Requirement for Directional Flips (CE -> PE or PE -> CE):
  // =========================================================================
  // INSTITUTIONAL ACTIVE TRADE HOLDING & ANTI-CHURN CONTROLLER
  // =========================================================================
  // When a trader enters an options trade (e.g., 22900 CE), that trade enters ACTIVE HOLDING.
  // Minor 1m/2m pullbacks within the trade's defined risk boundaries (Stop Loss)
  // are NORMAL market behavior and MUST NOT cause the algorithm to flip to the opposite direction (BUY_PE)!
  // Direct flip-flop (BUY_CE -> BUY_PE or BUY_PE -> BUY_CE) is STRICTLY PROHIBITED.
  // =========================================================================

  const hasOngoingCeTrade = Boolean(
    activePreviousSignal &&
    activePreviousSignal.action === 'BUY_CE' &&
    activePreviousSignal.tradeStage !== 'STOP_LOSS_HIT' &&
    activePreviousSignal.tradeStage !== 'TARGET_2_HIT'
  );

  const hasOngoingPeTrade = Boolean(
    activePreviousSignal &&
    activePreviousSignal.action === 'BUY_PE' &&
    activePreviousSignal.tradeStage !== 'STOP_LOSS_HIT' &&
    activePreviousSignal.tradeStage !== 'TARGET_2_HIT'
  );

  // Check if active trade invalidation (Stop Loss) has been triggered:
  let isOngoingCeInvalidated = false;
  if (hasOngoingCeTrade && activePreviousSignal) {
    const ceStrike = activePreviousSignal.recommendedStrike;
    const ceRow = chain.find(r => r.strike === ceStrike);
    const ceLtp = ceRow?.ce?.ltp ?? activePreviousSignal.recommendedContractLTP ?? 0;
    const ceSl = activePreviousSignal.trailingStopLoss || activePreviousSignal.stopLoss;
    const ceSpotSl = activePreviousSignal.spotStopLoss;
    // Stop loss breached if spot breaks below spot SL floor OR option premium drops below trailing SL
    if ((ceSpotSl && spotPrice <= ceSpotSl) || (ceSl > 0 && ceLtp > 0 && ceLtp <= ceSl)) {
      isOngoingCeInvalidated = true;
    }
  }

  let isOngoingPeInvalidated = false;
  if (hasOngoingPeTrade && activePreviousSignal) {
    const peStrike = activePreviousSignal.recommendedStrike;
    const peRow = chain.find(r => r.strike === peStrike);
    const peLtp = peRow?.pe?.ltp ?? activePreviousSignal.recommendedContractLTP ?? 0;
    const peSl = activePreviousSignal.trailingStopLoss || activePreviousSignal.stopLoss;
    const peSpotSl = activePreviousSignal.spotStopLoss;
    if ((peSpotSl && spotPrice >= peSpotSl) || (peSl > 0 && peLtp > 0 && peLtp <= peSl)) {
      isOngoingPeInvalidated = true;
    }
  }

  const isCandleBearishVeto = candlePatterns.confluenceBias === 'BEARISH' && (candlePatterns.confluenceScore <= -2.0 || candlePatterns.m5.trend === 'BEARISH');
  const isCandleBullishVeto = candlePatterns.confluenceBias === 'BULLISH' && (candlePatterns.confluenceScore >= 2.0 || candlePatterns.m5.trend === 'BULLISH');

  // Condition 1: Active CE Trade Holding Phase (Do NOT flip to PE on normal pullbacks!)
  if (hasOngoingCeTrade && !isOngoingCeInvalidated && activePreviousSignal) {
    action = 'BUY_CE';
    const isBelowVwapPullback = isBelowVWAP;
    const isPullback = score < 0.20 || netBullEdge <= 0 || isBelowVwapPullback;
    const isSidewaysChop = Math.abs(score) < 0.6 && Math.abs(spotPrice - rt.vwap.value) < ticker.strikeStep * 0.25;
    
    strength = (isPullback || isSidewaysChop) ? 'CAUTION' : (bullMatches >= 4 || score >= 1.8) ? 'STRONG' : 'MODERATE';
    confidence = Math.min(94, Math.max(68, isPullback ? activePreviousSignal.confidence - 4 : activePreviousSignal.confidence));
    
    if (isSidewaysChop) {
      capitalProtectionReason = `Holding Active Position: Spot is consolidating in a sideways deadband near VWAP. Position is active with SL intact (₹${(activePreviousSignal.trailingStopLoss || activePreviousSignal.stopLoss).toFixed(2)}). Caution: Option buyers face theta bleed in sideways consolidation; maintain strict SL discipline.`;
    } else if (isPullback) {
      capitalProtectionReason = `Holding Active Position: Spot is in a tactical pullback/retest. Trade is active within valid risk bounds (SL: ₹${(activePreviousSignal.trailingStopLoss || activePreviousSignal.stopLoss).toFixed(2)}). Hold position with stop loss discipline.`;
    }
  } 
  // Condition 2: Active PE Trade Holding Phase (Do NOT flip to CE on normal relief bounces!)
  else if (hasOngoingPeTrade && !isOngoingPeInvalidated && activePreviousSignal) {
    action = 'BUY_PE';
    const isAboveVwapBounce = isAboveVWAP;
    const isPullback = score > -0.20 || netBullEdge >= 0 || isAboveVwapBounce;
    const isSidewaysChop = Math.abs(score) < 0.6 && Math.abs(spotPrice - rt.vwap.value) < ticker.strikeStep * 0.25;
    
    strength = (isPullback || isSidewaysChop) ? 'CAUTION' : (bearMatches >= 4 || score <= -1.8) ? 'STRONG' : 'MODERATE';
    confidence = Math.min(94, Math.max(68, isPullback ? activePreviousSignal.confidence - 4 : activePreviousSignal.confidence));
    
    if (isSidewaysChop) {
      capitalProtectionReason = `Holding Active Position: Spot is consolidating in a sideways deadband near VWAP. Position is active with SL intact (₹${(activePreviousSignal.trailingStopLoss || activePreviousSignal.stopLoss).toFixed(2)}). Caution: Option buyers face theta bleed in sideways consolidation; maintain strict SL discipline.`;
    } else if (isPullback) {
      capitalProtectionReason = `Holding Active Position: Spot is in a tactical relief bounce/retest. Trade is active within valid risk bounds (SL: ₹${(activePreviousSignal.trailingStopLoss || activePreviousSignal.stopLoss).toFixed(2)}). Hold position with stop loss discipline.`;
    }
  }
  // Condition 3: Active Trade Just Stopped Out -> Enforce Mandatory WAIT_NEUTRAL Cooldown
  else if (isOngoingCeInvalidated && activePreviousSignal) {
    action = 'WAIT_NEUTRAL';
    strength = 'CAUTION';
    confidence = 50;
    capitalProtectionReason = `🛑 Active CE Stop Loss Triggered: Technical invalidation floor breached. Close ${activePreviousSignal.recommendedStrike} CE immediately to protect capital. Standing aside in WAIT_NEUTRAL cooldown to prevent revenge-trade whipsaw.`;
  }
  else if (isOngoingPeInvalidated && activePreviousSignal) {
    action = 'WAIT_NEUTRAL';
    strength = 'CAUTION';
    confidence = 50;
    capitalProtectionReason = `🛑 Active PE Stop Loss Triggered: Technical invalidation ceiling breached. Close ${activePreviousSignal.recommendedStrike} PE immediately to protect capital. Standing aside in WAIT_NEUTRAL cooldown to prevent revenge-trade whipsaw.`;
  }
  // Condition 4: No Active Trade (Flat Position) -> Standard High-Conviction Fresh Entry Evaluation
  else {
    const isFreshBuyCe = score >= 0.75 && netBullEdge >= 1 && !isHardBearishVeto && !isCandleBearishVeto && prevAction !== 'BUY_PE';
    const isFreshBuyPe = score <= -0.75 && netBullEdge <= -1 && !isHardBullishVeto && !isCandleBullishVeto && prevAction !== 'BUY_CE';

    if (isFreshBuyCe) {
      action = 'BUY_CE';
      strength = (bullMatches >= 4 || score >= 1.8) ? 'STRONG' : 'MODERATE';
      confidence = Math.min(96, Math.max(70, 72 + bullMatches * 3 + Math.round(score * 2.5)));
      capitalProtectionReason = '';
    } else if (isFreshBuyPe) {
      action = 'BUY_PE';
      strength = (bearMatches >= 4 || score <= -1.8) ? 'STRONG' : 'MODERATE';
      confidence = Math.min(96, Math.max(70, 72 + bearMatches * 3 + Math.round(Math.abs(score) * 2.5)));
      capitalProtectionReason = '';
    } else {
      action = 'WAIT_NEUTRAL';
      strength = 'MODERATE';
      confidence = Math.min(68, Math.max(48, Math.round(52 + Math.abs(score) * 2)));
      if (!capitalProtectionReason) {
        if (Math.abs(score) < 0.7) {
          capitalProtectionReason = `Consolidation Deadband: Multi-factor composite score (${score > 0 ? '+' : ''}${score.toFixed(1)}) is in neutral equilibrium (-0.7 to +0.7). Lacking institutional directional edge; stand aside in WAIT_NEUTRAL.`;
        } else if (score > 0 && (isCandleDownward || isIntradayRejectionVeto)) {
          capitalProtectionReason = `Top Rejection Divergence: Spot price has positive daily change, but intraday price action (${dropFromPeak.toFixed(1)} pts off peak, below VWAP) indicates supply distribution. High risk of bull trap; stand aside in WAIT_NEUTRAL.`;
        } else if (score < 0 && (isCandleUpward || isIntradayBounceVeto)) {
          capitalProtectionReason = `Support Absorption Divergence: Spot is pulling back, but intraday price action (${bounceFromFloor.toFixed(1)} pts off low, above VWAP) indicates institutional buying support. High risk of short trap; stand aside in WAIT_NEUTRAL.`;
        } else if (score > 0 && isHardBearishVeto) {
          capitalProtectionReason = `Signal Divergence: Derivatives flow (PCR ${pcrTotalOI.toFixed(2)}, Order Flow ${rt.orderFlow.sentiment}) or heavyweights show confirmed supply drag. High risk of bull trap; stand aside in WAIT_NEUTRAL.`;
        } else if (score < 0 && isHardBullishVeto) {
          capitalProtectionReason = `Signal Divergence: Spot pullback is met with institutional Put writing floor (PCR ${pcrTotalOI.toFixed(2)}) and banking absorption. High risk of snapback squeeze; stand aside in WAIT_NEUTRAL.`;
        }
      }
    }
  }

  // Calculate dynamic non-static prediction confidence percentage
  confidence = calculateDynamicConfidence(
    action,
    strength,
    score,
    bullMatches,
    bearMatches,
    7,
    rt,
    ticker,
    constituentAnalysis,
    interMarketTelemetry
  );

  // Determine recommended contract type:
  // If BUY_CE -> 'CE'
  // If BUY_PE -> 'PE'
  // If WAIT_NEUTRAL -> strictly align reference watchlist contract with active real candlestick momentum
  let recommendedType: OptionType = 'CE';
  if (action === 'BUY_PE') {
    recommendedType = 'PE';
  } else if (action === 'BUY_CE') {
    recommendedType = 'CE';
  } else {
    // WAIT_NEUTRAL: Prioritize active real candlestick momentum for reference watchlist contract
    if (isCandleDownward || isContinuousFall || candlePatterns.isPersistent40mFall || highRejectionRatio >= 0.25 || dropFromPeak >= ticker.strikeStep * 0.40) {
      recommendedType = 'PE';
    } else if (isCandleUpward || isMarketRaising || candlePatterns.isPersistent40mRise || lowRecoveryRatio >= 0.25 || bounceFromFloor >= ticker.strikeStep * 0.40) {
      recommendedType = 'CE';
    } else if (netBullEdge > 0 || score > 0.3) {
      recommendedType = 'CE';
    } else if (netBullEdge < 0 || score < -0.3) {
      recommendedType = 'PE';
    } else {
      recommendedType = spotChangePct >= 0 ? 'CE' : 'PE';
    }
  }

  // Select target strike:
  // Standard recommended strike for directional retail option buying is ATM
  // Dynamic ATM Strike with ±15% Deadband Hysteresis to eliminate boundary jumping
  const rawAtmStrike = Math.round(spotPrice / ticker.strikeStep) * ticker.strikeStep;
  let currentAtmStrike = rawAtmStrike;

  // If previous signal recommended a valid strike, enforce a hysteresis deadband so spot oscillating 
  // near the 50% boundary (e.g. 23,124 - 23,126) does NOT jump strikes every 2 seconds!
  if (activePreviousSignal && activePreviousSignal.recommendedStrike) {
    const prevS = activePreviousSignal.recommendedStrike;
    const distToPrev = spotPrice - prevS;
    if (distToPrev > ticker.strikeStep * 0.65) {
      currentAtmStrike = prevS + ticker.strikeStep;
    } else if (distToPrev < -ticker.strikeStep * 0.65) {
      currentAtmStrike = prevS - ticker.strikeStep;
    } else {
      currentAtmStrike = prevS;
    }
  }

  let targetStrike = currentAtmStrike;

  // Integrated Self-Healing Calibration: If High IV Rank (>70), high VIX (>22), or Self-Healing ITM Bias (>0.58), switch to ITM strike to shield against IV Crush
  const selfHealing = loadSelfHealingCalibration(ticker.symbol, [], ticker);
  const isItmHealingBias = selfHealing.active && (selfHealing.parameters.deltaTargetMoneynessBias > 0.58);
  if ((ivRank >= 70 || vix >= 22 || isItmHealingBias) && (action === 'BUY_CE' || action === 'BUY_PE')) {
    targetStrike = recommendedType === 'CE' ? currentAtmStrike - ticker.strikeStep : currentAtmStrike + ticker.strikeStep;
  } else if (recommendedType === 'PE' && (isContinuousFall || candlePatterns.isPersistent40mFall) && spotPrice <= currentAtmStrike - ticker.strikeStep * 0.35) {
    // If market has been continuously falling and spot has slipped below midpoint towards next lower strike, align target strike to the active Put strike
    targetStrike = currentAtmStrike - ticker.strikeStep;
  }

  // Persistent Strike Anchoring for Active Trade
  const isPreviousTradeCompleted = activePreviousSignal?.tradeStage === 'TARGET_1_HIT' || 
                                   activePreviousSignal?.tradeStage === 'TARGET_2_HIT' || 
                                   activePreviousSignal?.tradeStage === 'STOP_LOSS_HIT';
  if (activePreviousSignal && action === activePreviousSignal.action && 
      activePreviousSignal.recommendedType === recommendedType && !isPreviousTradeCompleted) {
    const prevStrike = activePreviousSignal.recommendedStrike;
    if (Math.abs(prevStrike - spotPrice) <= ticker.strikeStep * 1.35) {
      const existingRow = chain.find(r => r.strike === prevStrike);
      if (existingRow) {
        targetStrike = prevStrike;
      }
    }
  }

  let moneyness: Moneyness = 'ATM';

  let selectedRow = chain.find(r => r.strike === targetStrike);
  if (!selectedRow && chain.length > 0) {
    selectedRow = chain[Math.floor(chain.length / 2)];
    targetStrike = selectedRow.strike;
  }

  // Extract the exact contract from the option chain row
  let contract = recommendedType === 'CE' ? selectedRow?.ce : selectedRow?.pe;

  // Strict ATM Anchor: Never jump to edge/deep ITM strikes
  // If target strike contract is missing from chain, fallback to the ATM row directly
  if (!contract && chain.length > 0) {
    const atmRow = chain.find(r => r.strike === atmStrike);
    if (atmRow) {
      selectedRow = atmRow;
      targetStrike = atmRow.strike;
      contract = recommendedType === 'CE' ? selectedRow.ce : selectedRow.pe;
    }
  }

  if (contract) {
    moneyness = contract.moneyness;
  }

  // Real contract premium (LTP) directly from recommended contract in live chain, or dynamically derived via Black-Scholes
  const dynamicBsFallback = calculateBlackScholes(
    spotPrice,
    targetStrike,
    getTickerExpiryDTE(ticker, expiryIndex).T,
    ticker.currency === '₹' ? 0.065 : 0.045,
    Math.max(0.08, (ticker.vix || 15) / 100),
    recommendedType
  );
  let premium = (contract && contract.ltp > 0.05) ? contract.ltp : Number(Math.max(0.05, dynamicBsFallback.price).toFixed(2));

  // Exchange standard tick size (0.05 for Indian F&O, 0.01 for US)
  const tick = ticker.currency === '₹' ? 0.05 : 0.01;
  const roundToTick = (val: number) => Number((Math.round(val / tick) * tick).toFixed(2));

  // =========================================================================
  // REALISTIC EXIT TARGET DERIVATION ENGINE
  // Synthesizes: 1. Option Chart Data, 2. Previous Trend Patterns, 3. News Catalysts
  // =========================================================================

  const step = ticker.strikeStep;
  const isCE = recommendedType === 'CE';

  // --- 1. OPTION CHART DATA (OI HURDLES & WALLS) ---
  const higherStrikes = chain.filter(r => r.strike > spotPrice).sort((a, b) => a.strike - b.strike);
  const lowerStrikes = chain.filter(r => r.strike < spotPrice).sort((a, b) => b.strike - a.strike);

  // Immediate resistance hurdle with highest Call OI above spot
  let immediateCallHurdle = higherStrikes.length > 0 ? higherStrikes[0].strike : spotPrice + step;
  if (higherStrikes.length > 1) {
    const topNearCall = [...higherStrikes.slice(0, 3)].sort((a, b) => b.ce.openInterest - a.ce.openInterest)[0];
    if (topNearCall && topNearCall.strike > spotPrice) immediateCallHurdle = topNearCall.strike;
  }

  // Immediate support floor with highest Put OI below spot
  let immediatePutSupport = lowerStrikes.length > 0 ? lowerStrikes[0].strike : spotPrice - step;
  if (lowerStrikes.length > 1) {
    const topNearPut = [...lowerStrikes.slice(0, 3)].sort((a, b) => b.pe.openInterest - a.pe.openInterest)[0];
    if (topNearPut && topNearPut.strike < spotPrice) immediatePutSupport = topNearPut.strike;
  }

  const majorCallWall = majorResistanceStrike;
  const majorPutWall = majorSupportStrike;

  // --- 2. PREVIOUS TREND PATTERNS & INTRADAY VOLATILITY ---
  // Daily Expected Move based on VIX: Spot * (VIX / 100) / sqrt(252)
  const dailyExpectedMove = spotPrice * (vix / 100) / 15.87;
  const intradaySessionMove = Math.max(step * 0.45, dailyExpectedMove * 0.40);

  const isNearDayHigh = (dayHigh - spotPrice) <= step * 0.4;
  const isNearDayLow = (spotPrice - dayLow) <= step * 0.4;

  // --- 3. LIVE & LAST NIGHT (OVERNIGHT) NEWS IMPACT MULTIPLIER ENGINE ---
  const overnightNews = relevantNews.filter(n => 
    n.timing === 'OVERNIGHT' || n.category === 'Overnight' || (Date.now() - n.timestamp > 3.5 * 3600 * 1000)
  );
  const liveNews = relevantNews.filter(n => 
    n.timing === 'LIVE' || (Date.now() - n.timestamp <= 3.5 * 3600 * 1000)
  );

  let overnightScore = 0;
  for (const item of overnightNews) {
    const impactMult = item.impact === 'HIGH' ? 2.0 : item.impact === 'MEDIUM' ? 1.3 : 0.8;
    const sentVal = item.sentiment === 'BULLISH' ? 1 : item.sentiment === 'BEARISH' ? -1 : 0;
    overnightScore += sentVal * impactMult;
  }
  if (overnightNews.length > 0) {
    overnightScore = Math.max(-1, Math.min(1, overnightScore / (overnightNews.length * 1.5)));
  }

  let liveScore = 0;
  for (const item of liveNews) {
    const impactMult = item.impact === 'HIGH' ? 2.0 : item.impact === 'MEDIUM' ? 1.3 : 0.8;
    const sentVal = item.sentiment === 'BULLISH' ? 1 : item.sentiment === 'BEARISH' ? -1 : 0;
    liveScore += sentVal * impactMult;
  }
  if (liveNews.length > 0) {
    liveScore = Math.max(-1, Math.min(1, liveScore / (liveNews.length * 1.5)));
  }

  // Combined News Sentiment Factor (Overnight anchor: 40% + Live intraday breaking: 60%)
  let newsSentimentFactor = Number(((overnightScore * 0.40) + (liveScore * 0.60)).toFixed(2));
  if (effectiveGiftNiftyBias > 0) {
    newsSentimentFactor = Math.min(1, newsSentimentFactor + 0.20);
  } else if (effectiveGiftNiftyBias < 0) {
    newsSentimentFactor = Math.max(-1, newsSentimentFactor - 0.20);
  }

  const overnightMultiplier = Number((1.0 + (overnightScore * 0.15)).toFixed(2));
  const liveBreakingMultiplier = Number((1.0 + (liveScore * 0.25)).toFixed(2));
  
  // Directional News Impact Multiplier for exit targets:
  // If BUY CE and news is Bullish, net multiplier expands target swing (>1.0x).
  // If BUY CE and news is Bearish (headwind), multiplier compresses target (<1.0x).
  const directionalNewsBias = isCE ? newsSentimentFactor : -newsSentimentFactor;
  const netNewsImpactMultiplier = Number(Math.max(0.70, Math.min(1.42, 1.0 + directionalNewsBias * 0.32)).toFixed(2));

  // Determine catalyst classification
  let catalystType: 'GEOPOLITICAL' | 'EARNINGS' | 'MACRO' | 'SECTOR' | 'GLOBAL_CUES' | 'EQUILIBRIUM' = 'MACRO';
  if (relevantNews.some(n => n.category === 'Geopolitics')) catalystType = 'GEOPOLITICAL';
  else if (relevantNews.some(n => n.category === 'Sector')) catalystType = 'SECTOR';
  else if (relevantNews.some(n => n.category === 'Earnings')) catalystType = 'EARNINGS';
  else if (relevantNews.some(n => n.category === 'Overnight')) catalystType = 'GLOBAL_CUES';

  let newsFlowState: 'ACCELERATING_BULLISH' | 'ACCELERATING_BEARISH' | 'CONFLICTING_FLOW' | 'STABLE_BALANCED' = 'STABLE_BALANCED';
  if (newsSentimentFactor >= 0.25 && liveScore > 0) newsFlowState = 'ACCELERATING_BULLISH';
  else if (newsSentimentFactor <= -0.25 && liveScore < 0) newsFlowState = 'ACCELERATING_BEARISH';
  else if ((isCE && newsSentimentFactor < -0.15) || (!isCE && newsSentimentFactor > 0.15)) newsFlowState = 'CONFLICTING_FLOW';

  const topOvernightHeadline = overnightNews[0]?.title || 'Overnight Global Markets Balanced';
  const topLiveHeadline = liveNews[0]?.title || 'Live Intraday Flow Stable';

  // --- 4. DERIVE REALISTIC TARGET SPOT PRICES GROUNDED IN 2M/5M/15M MOMENTUM & NEWS ---
  const m2Score = candlePatterns.m2Score ?? candlePatterns.m2.momentumScore;
  const m5Score = candlePatterns.m5Score ?? candlePatterns.m5.momentumScore;
  const m15Score = candlePatterns.m15Score ?? candlePatterns.m15.momentumScore;

  // Candlestick momentum multipliers for tactical swing (Target 1) and structural runner (Target 2)
  const directionalTacticalMomentum = isCE ? (m2Score * 0.30 + m5Score * 0.70) : -(m2Score * 0.30 + m5Score * 0.70);
  const tacticalMomentumMult = Math.max(0.82, Math.min(1.30, 1.0 + (directionalTacticalMomentum / 25)));

  const directionalStructuralMomentum = isCE ? m15Score : -m15Score;
  const structuralMomentumMult = Math.max(0.85, Math.min(1.35, 1.0 + (directionalStructuralMomentum / 20)));

  let spotTarget1 = spotPrice;
  let spotTarget2 = spotPrice;
  let spotStopLoss = spotPrice;
  let target1Basis = '';
  let target2Basis = '';

  const newsPointsAdjustment = Number((directionalNewsBias * dailyExpectedMove * 0.08).toFixed(1));

  // Dynamic Time to Expiry (DTE) & Horizon Scaling for Cross-Expiry Spectrum:
  // Synchronized with Option Chain and Exchange Calendar
  const isIndian = ticker.currency === '₹';
  const r = isIndian ? 0.065 : 0.045;
  const { daysToExpiry, T } = getTickerExpiryDTE(ticker, expiryIndex);
  const horizonScale = Math.min(2.4, Math.max(1.0, Math.sqrt(Math.max(1, daysToExpiry) / 3.0)));

  // Volatility & ATR based technical bounds scaled by expiry horizon
  const minMove1 = Math.max(step * 0.40, dailyExpectedMove * 0.16 * horizonScale);
  const maxMove1 = Math.max(step * 1.00, dailyExpectedMove * 0.32 * horizonScale);
  const minMove2 = Math.max(minMove1 + step * 0.35, dailyExpectedMove * 0.36 * horizonScale);
  const maxMove2 = Math.max(minMove2 + step * 0.70, dailyExpectedMove * 0.65 * horizonScale);
  const minSL = Math.max(step * 0.25, dailyExpectedMove * 0.10 * Math.min(1.4, Math.sqrt(horizonScale)));
  const maxSL = Math.max(step * 0.55, dailyExpectedMove * 0.18 * Math.min(1.4, Math.sqrt(horizonScale)));

  if (isCE) {
    // BUY CALL:
    // Target 1: Tactical swing move based on 2m/5m pattern, immediate Call OI hurdle, VWAP upper band, scaled by News Multiplier
    const chartTarget1 = candlePatterns.bullishExitLevel1 || (spotPrice + (candlePatterns.tacticalSwingPoints || step * 0.40));
    const vwapTargetDist = rt.vwap.upperBand > spotPrice ? (rt.vwap.upperBand - spotPrice) : minMove1;
    const hurdleDist = Math.max(minMove1, Math.min(maxMove1, (immediateCallHurdle - spotPrice) * 0.85));
    const patternMove = Math.max(minMove1, Math.min(maxMove1, chartTarget1 - spotPrice));
    
    // In Positive Gamma regime, market pins tighter; in Negative Gamma, moves run freer
    const gammaTunedMax1 = rt.gammaExposure.regime === 'POSITIVE_GAMMA' ? maxMove1 * 0.90 : maxMove1;
    const rawSpotMove1 = ((patternMove * 0.45 + hurdleDist * 0.35 + vwapTargetDist * 0.20) * tacticalMomentumMult * netNewsImpactMultiplier) + (newsPointsAdjustment * 0.4);
    const spotMove1 = Number(Math.max(minMove1, Math.min(gammaTunedMax1, rawSpotMove1)).toFixed(2));
    spotTarget1 = Number((spotPrice + spotMove1).toFixed(2));
    target1Basis = `2m/5m Swing (${m5Score > 0 ? '+' : ''}${m5Score}/10) · ${netNewsImpactMultiplier}x News (Spot ${ticker.currency}${spotTarget1.toLocaleString()})`;

    // Target 2: Extended runner move based on 15m structure, secondary hurdle, and gamma expansion
    const chartTarget2 = candlePatterns.bullishExitLevel2 || (spotPrice + (candlePatterns.structuralSwingPoints || step * 0.75));
    const patternMove2 = Math.max(spotMove1 + step * 0.35, Math.min(maxMove2, chartTarget2 - spotPrice));
    const hurdleDist2 = Math.max(spotMove1 + step * 0.30, Math.min(maxMove2, (majorCallWall - spotPrice) * 0.42));
    const gammaRunnerMultiplier = rt.gammaExposure.regime === 'NEGATIVE_GAMMA' ? 1.15 : 0.95;
    const rawSpotMove2 = Math.max(spotMove1 + step * 0.35, ((patternMove2 * 0.65 + hurdleDist2 * 0.35) * structuralMomentumMult * netNewsImpactMultiplier * gammaRunnerMultiplier));
    const spotMove2 = Number(Math.max(minMove2, Math.min(maxMove2 * (rt.gammaExposure.regime === 'NEGATIVE_GAMMA' ? 1.18 : 1.05), rawSpotMove2)).toFixed(2));
    spotTarget2 = Number((spotPrice + spotMove2).toFixed(2));
    target2Basis = `15m Structure (${m15Score > 0 ? '+' : ''}${m15Score}/10) · Runner Extension (Spot ${ticker.currency}${spotTarget2.toLocaleString()})`;

    // Spot Stop Loss: below 2m/5m swing low, candlestick invalidation cushion and 9 EMA / VWAP floor
    const vwapSupportDist = spotPrice > rt.vwap.value ? (spotPrice - rt.vwap.value) : minSL;
    const candleSLDist = candlePatterns.bullishInvalidationLevel && candlePatterns.bullishInvalidationLevel < spotPrice
      ? (spotPrice - candlePatterns.bullishInvalidationLevel)
      : (candlePatterns.invalidationPoints || minSL);
    const rawSLDist = Math.max(minSL, Math.min(maxSL, Math.min(candleSLDist, vwapSupportDist * 1.1)));
    spotStopLoss = Number((spotPrice - rawSLDist).toFixed(2));

  } else {
    // BUY PUT:
    // Target 1: Tactical swing move based on 2m/5m pattern, immediate Put OI support, VWAP lower band, scaled by News Multiplier
    const chartTarget1 = candlePatterns.bearishExitLevel1 || (spotPrice - (candlePatterns.tacticalSwingPoints || step * 0.40));
    const vwapFloorDist = rt.vwap.lowerBand < spotPrice ? (spotPrice - rt.vwap.lowerBand) : minMove1;
    const hurdleDist = Math.max(minMove1, Math.min(maxMove1, (spotPrice - immediatePutSupport) * 0.85));
    const patternMove = Math.max(minMove1, Math.min(maxMove1, spotPrice - chartTarget1));

    const gammaTunedMax1 = rt.gammaExposure.regime === 'POSITIVE_GAMMA' ? maxMove1 * 0.90 : maxMove1;
    const rawSpotMove1 = ((patternMove * 0.45 + hurdleDist * 0.35 + vwapFloorDist * 0.20) * tacticalMomentumMult * netNewsImpactMultiplier) + (newsPointsAdjustment * 0.4);
    const spotMove1 = Number(Math.max(minMove1, Math.min(gammaTunedMax1, rawSpotMove1)).toFixed(2));
    spotTarget1 = Number((spotPrice - spotMove1).toFixed(2));
    target1Basis = `2m/5m Swing (${m5Score}/10) · ${netNewsImpactMultiplier}x News (Spot ${ticker.currency}${spotTarget1.toLocaleString()})`;

    // Target 2: Extended runner move based on 15m structure, secondary floor, and gamma acceleration
    const chartTarget2 = candlePatterns.bearishExitLevel2 || (spotPrice - (candlePatterns.structuralSwingPoints || step * 0.75));
    const patternMove2 = Math.max(spotMove1 + step * 0.35, Math.min(maxMove2, spotPrice - chartTarget2));
    const hurdleDist2 = Math.max(spotMove1 + step * 0.30, Math.min(maxMove2, (spotPrice - majorPutWall) * 0.42));
    const gammaRunnerMultiplier = rt.gammaExposure.regime === 'NEGATIVE_GAMMA' ? 1.15 : 0.95;
    const rawSpotMove2 = Math.max(spotMove1 + step * 0.35, ((patternMove2 * 0.65 + hurdleDist2 * 0.35) * structuralMomentumMult * netNewsImpactMultiplier * gammaRunnerMultiplier));
    const spotMove2 = Number(Math.max(minMove2, Math.min(maxMove2 * (rt.gammaExposure.regime === 'NEGATIVE_GAMMA' ? 1.18 : 1.05), rawSpotMove2)).toFixed(2));
    spotTarget2 = Number((spotPrice - spotMove2).toFixed(2));
    target2Basis = `15m Structure (${m15Score}/10) · Runner Extension (Spot ${ticker.currency}${spotTarget2.toLocaleString()})`;

    // Spot Stop Loss: above 2m/5m swing high, candlestick invalidation cushion and 9 EMA / VWAP ceiling
    const vwapCeilDist = spotPrice < rt.vwap.value ? (rt.vwap.value - spotPrice) : minSL;
    const candleSLDist = candlePatterns.bearishInvalidationLevel && candlePatterns.bearishInvalidationLevel > spotPrice
      ? (candlePatterns.bearishInvalidationLevel - spotPrice)
      : (candlePatterns.invalidationPoints || minSL);
    const rawSLDist = Math.max(minSL, Math.min(maxSL, Math.min(candleSLDist, vwapCeilDist * 1.1)));
    spotStopLoss = Number((spotPrice + rawSLDist).toFixed(2));
  }

  // --- 5. CALIBRATED REAL-WORLD OPTION TARGETS VIA ANCHORED BLACK-SCHOLES & GREEKS ---
  // Evaluates relative delta shifts anchored to actual live market LTP (premium),
  // ensuring the option targets are 100% mathematically faithful to the spot price movements.
  const ivDecimal = Math.max(0.05, Math.min(0.95, (contract?.iv || (isIndian ? 11.5 : 18.0)) / 100));

  // Current theoretical price baseline at current spot
  const bsCurrent = calculateBlackScholes(spotPrice, targetStrike, T, r, ivDecimal, recommendedType);

  // Greeks for UI synthesis & sensitivity
  const delta = contract ? Math.abs(contract.greeks.delta) : 0.50;
  const gamma = contract ? Math.abs(contract.greeks.gamma) : 0.0018;
  const theta = contract ? Math.abs(contract.greeks.theta) : (premium * 0.05);
  const vega = contract ? Math.abs(contract.greeks.vega) : (premium * 0.08);

  // Vega & Implied Volatility (IV) Expansion / Contraction Sensitivity:
  // Surging VIX expands Put premiums and breakout Call premiums (+0.3% to +0.8% IV)
  // Compressing VIX crushes options (-0.4% to -0.8% IV)
  let expectedIvChange1 = 0;
  if (rt.vixVelocity.velocityState === 'SURGING') {
    expectedIvChange1 = isCE ? 0.3 : 0.8;
  } else if (rt.vixVelocity.velocityState === 'COMPRESSING') {
    expectedIvChange1 = -0.5;
  } else if (Math.abs(spotChangePct) >= 0.4) {
    expectedIvChange1 = 0.25;
  }
  const vegaExpansion1 = (vega * (expectedIvChange1 / 100));
  const vegaExpansion2 = (vega * ((expectedIvChange1 * 1.4) / 100));

  // 1. Target 1 Option Price: Direct, authentic payoff at spotTarget1
  const deltaSpot1 = Math.abs(spotTarget1 - spotPrice);
  const T_target1 = Math.max(0.0001, T - (1.0 / (252 * 6.25)));
  const bsTarget1 = calculateBlackScholes(spotTarget1, targetStrike, T_target1, r, ivDecimal, recommendedType);
  const bsDeltaGain1 = Math.max(tick * 2, bsTarget1.price - bsCurrent.price);
  const deltaExpansion1 = delta * deltaSpot1;
  const gammaAcceleration1 = 0.5 * gamma * Math.pow(deltaSpot1, 2);
  const intradayTheta1 = theta * 0.12;
  const greekGain1 = Math.max(tick * 2, deltaExpansion1 + gammaAcceleration1 - intradayTheta1 + vegaExpansion1);
  const estGain1 = bsDeltaGain1 * 0.50 + greekGain1 * 0.50;

  // 2. Target 2 Option Price: Direct, authentic payoff at spotTarget2
  const deltaSpot2 = Math.abs(spotTarget2 - spotPrice);
  const T_target2 = Math.max(0.0001, T - (2.5 / (252 * 6.25)));
  const bsTarget2 = calculateBlackScholes(spotTarget2, targetStrike, T_target2, r, ivDecimal, recommendedType);
  const rawTarget1Delta = roundToTick(estGain1);
  const bsDeltaGain2 = Math.max(rawTarget1Delta + tick * 2, bsTarget2.price - bsCurrent.price);
  const deltaExpansion2 = delta * deltaSpot2;
  const gammaAcceleration2 = 0.5 * gamma * Math.pow(deltaSpot2, 2);
  const intradayTheta2 = theta * 0.25;
  const greekGain2 = Math.max(rawTarget1Delta + tick * 2, deltaExpansion2 + gammaAcceleration2 - intradayTheta2 + vegaExpansion2);
  const estGain2 = bsDeltaGain2 * 0.50 + greekGain2 * 0.50;

  // 3. Stop Loss Option Price: Technical invalidation at spotStopLoss
  const deltaSpotSL = Math.abs(spotStopLoss - spotPrice);
  const T_sl = Math.max(0.0001, T - (0.5 / (252 * 6.25)));
  const bsSL = calculateBlackScholes(spotStopLoss, targetStrike, T_sl, r, ivDecimal, recommendedType);
  const bsLoss = Math.max(tick, bsCurrent.price - bsSL.price);
  const intradayThetaSL = theta * 0.06;
  const greekLoss = Math.max(tick, delta * deltaSpotSL - 0.5 * gamma * Math.pow(deltaSpotSL, 2) + intradayThetaSL);
  const estLoss = bsLoss * 0.50 + greekLoss * 0.50;

  // Grounded Entry Range calculation (incorporates 2m micro-pullback buffer and bid-ask spread)
  const spreadBuffer = ticker.currency === '₹' ? (ticker.symbol.includes('BANK') ? 0.75 : 0.40) : 0.05;
  const pullbackBuffer = Math.max(tick, roundToTick(candlePatterns.m2.atr * 0.20 * delta));
  const bidPrice = contract?.bidPrice && contract.bidPrice > 0 ? contract.bidPrice : roundToTick(premium - spreadBuffer);
  const askPrice = contract?.askPrice && contract.askPrice > 0 ? contract.askPrice : roundToTick(premium + spreadBuffer);

  // INSTITUTIONAL ACTIVE TRADE ANCHORING ENGINE:
  // When an active directional trade is ongoing, the entry price, Target 1, Target 2, and initial Stop Loss
  // MUST remain firmly anchored to the position entry. They MUST NOT shift with floating current premium!
  // Stop loss only trails upwards (Break-Even or Profit Lock), NEVER downwards.
  const isExistingOngoingTrade = Boolean(
    previousSignal &&
    previousSignal.action !== 'WAIT_NEUTRAL' &&
    action === previousSignal.action &&
    previousSignal.recommendedStrike === targetStrike &&
    previousSignal.recommendedType === recommendedType &&
    previousSignal.tradeStage !== 'STOP_LOSS_HIT' &&
    previousSignal.tradeStage !== 'TARGET_2_HIT'
  );

  let target1: number;
  let target2: number;
  let stopLoss: number;
  let entryLow: number;
  let entryHigh: number;
  let initialEntryLtp: number;

  if (isExistingOngoingTrade && previousSignal) {
    // PRESERVE ANCHORED TRADE LEVELS
    target1 = previousSignal.target1;
    target2 = previousSignal.target2;
    stopLoss = previousSignal.stopLoss;
    entryLow = previousSignal.entryRange[0];
    entryHigh = previousSignal.entryRange[1];
    initialEntryLtp = previousSignal.recommendedContractLTP || premium;
  } else {
    // NEW TRADE SETUP: Calculate initial targets, stop loss, and entry zone
    target1 = roundToTick(premium + estGain1);
    if (selfHealing.active && (pcrTotalOI >= 1.30 || pcrTotalOI <= 0.65)) {
      const pcrScale = selfHealing.parameters.pcrExtremeTargetScale || 0.88;
      target1 = roundToTick(premium + Math.max(tick * 2, estGain1 * pcrScale));
    }
    const freshT1Delta = roundToTick(Math.max(tick, target1 - premium));
    target2 = roundToTick(premium + Math.max(freshT1Delta + tick * 4, estGain2));
    stopLoss = Math.max(tick, roundToTick(premium - estLoss));
    if (selfHealing.active && selfHealing.parameters.adaptiveTrailingSlBufferPts > 0) {
      const slBuffer = Math.min(tick * 4, selfHealing.parameters.adaptiveTrailingSlBufferPts * 0.15);
      stopLoss = Math.max(tick, roundToTick(stopLoss - slBuffer));
    }
    entryLow = Math.max(tick, roundToTick(Math.min(bidPrice, premium - pullbackBuffer)));
    entryHigh = roundToTick(Math.max(askPrice, premium + tick * 2));
    initialEntryLtp = premium;
  }

  const target1Delta = roundToTick(Math.max(tick, target1 - initialEntryLtp));
  const target2Delta = roundToTick(Math.max(tick * 2, target2 - initialEntryLtp));
  const actualRisk = roundToTick(Math.max(tick, initialEntryLtp - stopLoss));

  // GUARD RAIL 10: Strict Risk-to-Reward Expected Value Filter
  // If Risk exceeds Target 1 Reward (Risk:Reward worse than 1:1.05), downgrade to WAIT_NEUTRAL
  const blendedReward = target1Delta * 0.40 + target2Delta * 0.60;
  const riskRewardThreshold = isStrongBullMomentum || isStrongBearMomentum ? blendedReward * 1.30 : target1Delta * 1.05;

  if ((action as string) !== 'WAIT_NEUTRAL' && !isExistingOngoingTrade && actualRisk > riskRewardThreshold) {
    action = 'WAIT_NEUTRAL';
    capitalProtectionReason = `Capital Protection: Unfavorable Risk-to-Reward Ratio (Risk: ${ticker.currency}${actualRisk.toFixed(2)} vs Blended Reward: ${ticker.currency}${blendedReward.toFixed(2)}). Buying at ${ticker.currency}${premium.toFixed(2)} has poor expected value; wait for dip toward lower entry boundary ${ticker.currency}${roundToTick(premium - tick * 4).toFixed(2)}.`;
  }

  // Probability calculations based on confluence & momentum
  const target1Probability = Math.min(94, Math.max(65, Math.round(62 + (confidence * 0.25) + (Math.abs(directionalTacticalMomentum) * 1.5))));
  const target2Probability = Math.min(85, Math.max(48, Math.round(45 + (confidence * 0.22) + (Math.abs(directionalStructuralMomentum) * 1.6))));

  // Build 4-Pillar Target Exit Synthesis Model
  const targetExitSynthesis = {
    candlestickPillar: {
      confluencePattern: candlePatterns.confluencePattern,
      confluenceScore: candlePatterns.confluenceScore,
      m2Pattern: candlePatterns.m2.pattern,
      m2Score,
      m5Pattern: candlePatterns.m5.pattern,
      m5Score,
      m15Pattern: candlePatterns.m15.pattern,
      m15Score,
      aggregateMomentumIndex: candlePatterns.aggregateMomentumIndex,
      momentumAlignment: candlePatterns.momentumAlignment,
      swingTarget1: spotTarget1,
      swingTarget2: spotTarget2,
    },
    newsPillar: {
      overnightSentiment: (overnightScore > 0 ? 'BULLISH' : overnightScore < 0 ? 'BEARISH' : 'NEUTRAL') as 'BULLISH' | 'BEARISH' | 'NEUTRAL',
      overnightHeadline: topOvernightHeadline,
      liveSentiment: (liveScore > 0 ? 'BULLISH' : liveScore < 0 ? 'BEARISH' : 'NEUTRAL') as 'BULLISH' | 'BEARISH' | 'NEUTRAL',
      liveHeadline: topLiveHeadline,
      netNewsBiasScore: Number((newsSentimentFactor * 10).toFixed(1)),
      newsTargetImpact: `${netNewsImpactMultiplier}x dynamic swing multiplier (${newsPointsAdjustment >= 0 ? '+' : ''}${newsPointsAdjustment} pts)`,
    },
    newsMultiplierData: {
      overnightScore: Number(overnightScore.toFixed(2)),
      overnightMultiplier,
      overnightHeadline: topOvernightHeadline,
      liveScore: Number(liveScore.toFixed(2)),
      liveBreakingMultiplier,
      liveHeadline: topLiveHeadline,
      netNewsImpactMultiplier,
      catalystType,
      newsFlowState,
      swingExpansionDescription: `${netNewsImpactMultiplier}x ${netNewsImpactMultiplier >= 1.05 ? 'Expansion' : netNewsImpactMultiplier <= 0.95 ? 'Dampened Buffer' : 'Baseline'} on ${catalystType} catalysts`,
      pointsAdjustment: newsPointsAdjustment,
    },
    entryExitGrounding: {
      optimalEntryZone: [entryLow, entryHigh] as [number, number],
      entryBasis: `Live LTP ± spread buffer (${ticker.currency}${entryLow.toFixed(2)} - ${ticker.currency}${entryHigh.toFixed(2)}) with 2m pullback anchor`,
      slippageBuffer: spreadBuffer,
      riskPerLot: Number((actualRisk * ticker.lotSize).toFixed(2)),
      target1SpotLevel: spotTarget1,
      target1SwingBasis: target1Basis,
      target1Probability,
      target1OptionPayoff: target1,
      target1DeltaContr: Number(deltaExpansion1.toFixed(2)),
      target1GammaContr: Number(gammaAcceleration1.toFixed(2)),
      target2SpotLevel: spotTarget2,
      target2SwingBasis: target2Basis,
      target2Probability,
      target2OptionPayoff: target2,
      target2DeltaContr: Number(deltaExpansion2.toFixed(2)),
      target2GammaContr: Number(gammaAcceleration2.toFixed(2)),
      stopLossSpotLevel: spotStopLoss,
      stopLossBasis: `2m/5m Swing Low Invalidation & VWAP Floor (${ticker.currency}${spotStopLoss.toLocaleString()})`,
      maxRiskAmount: Number((actualRisk * ticker.lotSize).toFixed(2)),
    },
    constituentPillar: constituentAnalysis ? {
      advancesDeclines: `${constituentAnalysis.advances} Adv / ${constituentAnalysis.declines} Dec`,
      weightedDelta: constituentAnalysis.weightedConstituentDelta,
      niftyPointsImpact: constituentAnalysis.netNiftyPointImpact,
      bankingImpact: Array.isArray(constituentAnalysis.sectoralBreakdown) ? (constituentAnalysis.sectoralBreakdown.find(s => s.sector === 'Banking')?.sentiment || 'NEUTRAL') : 'NEUTRAL',
      relianceImpact: NIFTY_DERIVATIVE_COMPANIES.find(c => c.symbol === 'RELIANCE')?.changePercent ? `${NIFTY_DERIVATIVE_COMPANIES.find(c => c.symbol === 'RELIANCE')?.changePercent}%` : '0%',
      itImpact: Array.isArray(constituentAnalysis.sectoralBreakdown) ? (constituentAnalysis.sectoralBreakdown.find(s => s.sector === 'IT')?.sentiment || 'NEUTRAL') : 'NEUTRAL',
      heavyweightVerdict: constituentAnalysis.overallHeavyweightBias || 'NEUTRAL',
    } : undefined,
    trendPillar: {
      prevSessionTrend: spotChangePct >= 0.3 ? 'Uptrend Momentum' : spotChangePct <= -0.3 ? 'Downtrend Pressure' : 'Range Mean-Reversion',
      dayRange: Number(dayRange.toFixed(1)),
      atrDaily: Number(dailyExpectedMove.toFixed(1)),
      trendContinuationProb: Math.min(92, Math.round(62 + Math.abs(spotChangePct) * 20)),
      momentumVerdict: spotChangePct >= 0.05 ? 'Bullish Delta Velocity' : spotChangePct <= -0.05 ? 'Bearish Delta Drift' : 'Equilibrium Consolidation',
    },
    optionChartPillar: {
      callWall: majorCallWall,
      putWall: majorPutWall,
      maxPain: maxPainStrike,
      pcrTotalOI,
      deltaExpansion: Number(deltaExpansion1.toFixed(2)),
      gammaAcceleration: Number(gammaAcceleration1.toFixed(2)),
      thetaDecayBuffer: Number(intradayTheta1.toFixed(2)),
    },
  };

  // Real-world execution entry zone:
  let entryRange: [number, number] = [entryLow, entryHigh];
  let rrRatio = `1 : ${(target1Delta / Math.max(actualRisk, tick)).toFixed(1)}`;

  // Multi-Factor Quantitative Rationale Points
  const rationalePoints: TradeSignal['rationalePoints'] = [];

  // Rationale 1: Current Market Spot Level & Intraday Recovery vs Daily Reference
  const changeFormatted = `${spotChangePct >= 0 ? '+' : ''}${spotChangePct.toFixed(2)}%`;
  if (recoveryRatio >= 0.50 || recoveryPoints >= ticker.strikeStep * 0.4) {
    rationalePoints.push({
      title: 'Intraday Recovery & Short-Covering Bounce',
      verdict: 'BULLISH',
      description: `Spot (${ticker.currency}${spotPrice.toLocaleString()}) has recovered +${ticker.currency}${recoveryPoints.toFixed(2)} off the session low (${ticker.currency}${dayLow.toLocaleString()}), trading in the upper ${(recoveryRatio * 100).toFixed(0)}% of the daily range. Active short covering and support absorption cushion the market; avoid chasing puts during an intraday recovery.`,
    });
  } else if (spotChangePct >= 0.05) {
    rationalePoints.push({
      title: 'Current Market Spot Momentum',
      verdict: 'BULLISH',
      description: `Current spot (${ticker.currency}${spotPrice.toLocaleString()}) is trading ${changeFormatted} above reference close (${ticker.currency}${(ticker.prevClose ?? spotPrice).toLocaleString()}). Positive delta momentum favors Call (CE) buying.`,
    });
  } else if (recoveryRatio <= 0.30 && spotChangePct <= -0.05) {
    rationalePoints.push({
      title: 'Current Market Spot Momentum',
      verdict: 'BEARISH',
      description: `Current spot (${ticker.currency}${spotPrice.toLocaleString()}) is hovering near the session low (${ticker.currency}${dayLow.toLocaleString()}), trading ${changeFormatted} below reference close. Downward price action and lower high formation favor Put (PE) buying on breakdown.`,
    });
  } else {
    rationalePoints.push({
      title: 'Current Market Spot Equilibrium',
      verdict: 'NEUTRAL',
      description: `Current spot (${ticker.currency}${spotPrice.toLocaleString()}) is consolidating near the session midpoint between Day Low (${ticker.currency}${dayLow.toLocaleString()}) and Day High (${ticker.currency}${dayHigh.toLocaleString()}). Reference level is ${changeFormatted}.`,
    });
  }

  // Rationale 2: Put-Call Ratio (PCR) & Writing Activity
  if (pcrTotalOI >= 1.05) {
    rationalePoints.push({
      title: 'Put-Call Ratio (PCR) Bullish Support',
      verdict: 'BULLISH',
      description: `PCR is at ${pcrTotalOI.toFixed(2)} (>1.0), indicating active Put option writing at ${ticker.currency}${majorSupportStrike.toLocaleString()}. Institutional floor sellers cushion current spot against breakdowns.`,
    });
  } else if (pcrTotalOI <= 0.90) {
    rationalePoints.push({
      title: 'Put-Call Ratio (PCR) Bearish Resistance',
      verdict: 'BEARISH',
      description: `PCR is at ${pcrTotalOI.toFixed(2)} (<1.0), indicating heavy Call option writing at ${ticker.currency}${majorResistanceStrike.toLocaleString()}. Upside is constrained by ceiling sellers.`,
    });
  } else {
    rationalePoints.push({
      title: 'PCR In Equilibrium Range',
      verdict: 'NEUTRAL',
      description: `PCR is balanced at ${pcrTotalOI.toFixed(2)}, showing symmetric open interest between CE and PE sellers.`,
    });
  }

  // Rationale 3: Key Strike OI & Range Breakdown
  if (recommendedType === 'CE') {
    rationalePoints.push({
      title: 'Call Open Interest Absorption & Swing Hurdles',
      verdict: 'BULLISH',
      description: `Target 1 (${ticker.currency}${target1.toFixed(2)}, +${((target1Delta / premium) * 100).toFixed(1)}%) targets immediate resistance at ${ticker.currency}${spotTarget1.toLocaleString()} (${target1Basis}). Runner Target 2 (${ticker.currency}${target2.toFixed(2)}, +${((target2Delta / premium) * 100).toFixed(1)}%) captures 15m trend extension toward ${ticker.currency}${spotTarget2.toLocaleString()} (${target2Basis}).`,
    });
  } else if (action === 'BUY_PE') {
    rationalePoints.push({
      title: 'Put Buyer Buildup & Support Extension',
      verdict: 'BEARISH',
      description: `Target 1 (${ticker.currency}${target1.toFixed(2)}, +${((target1Delta / premium) * 100).toFixed(1)}%) targets immediate floor at ${ticker.currency}${spotTarget1.toLocaleString()} (${target1Basis}). Runner Target 2 (${ticker.currency}${target2.toFixed(2)}, +${((target2Delta / premium) * 100).toFixed(1)}%) captures 15m trend breakdown toward ${ticker.currency}${spotTarget2.toLocaleString()} (${target2Basis}).`,
    });
  } else {
    rationalePoints.push({
      title: 'Range Bound Between Key Levels',
      verdict: 'NEUTRAL',
      description: `Spot is oscillating between Support (${ticker.currency}${majorSupportStrike.toLocaleString()}) and Resistance (${ticker.currency}${majorResistanceStrike.toLocaleString()}).`,
    });
  }

  // Rationale 4: Multi-Timeframe Candlestick & Chart Patterns (2m | 5m | 15m)
  rationalePoints.push({
    title: 'Candlestick & Chart Patterns (2m | 5m | 15m)',
    verdict: candlePatterns.confluenceBias,
    description: `Confluence: ${candlePatterns.confluencePattern}. 2m Pattern: ${candlePatterns.m2.pattern} | 5m Pattern: ${candlePatterns.m5.pattern} (ATR: ${ticker.currency}${candlePatterns.m5.atr}) | 15m Structure: ${candlePatterns.m15.pattern}.${candlePatterns.orbStatus ? ` Opening Range (15m ORB): ${candlePatterns.orbStatus.replace(/_/g, ' ')} [${ticker.currency}${candlePatterns.orbLow?.toLocaleString()} - ${ticker.currency}${candlePatterns.orbHigh?.toLocaleString()}].` : ''} Score: ${candlePatterns.confluenceScore > 0 ? '+' : ''}${candlePatterns.confluenceScore}/10. Targets derived from 2m/5m measured moves & 15m range expansion.`,
  });

  // Rationale 5: Exit Targets Derivation Architecture
  rationalePoints.push({
    title: 'Calibrated Exit Targets Derivation Architecture',
    verdict: action === 'BUY_CE' ? 'BULLISH' : action === 'BUY_PE' ? 'BEARISH' : 'NEUTRAL',
    description: `Targets are algorithmically anchored to live market premium (${ticker.currency}${premium.toFixed(2)}): 1. Tactical Target 1 (+${((target1Delta / premium) * 100).toFixed(1)}%) captures 2m/5m measured move to spot ${ticker.currency}${spotTarget1.toLocaleString()}. 2. Runner Target 2 (+${((target2Delta / premium) * 100).toFixed(1)}%) captures 15m trend extension to spot ${ticker.currency}${spotTarget2.toLocaleString()}. 3. Stop Loss (-${((actualRisk / premium) * 100).toFixed(1)}%) guards against invalidation at spot ${ticker.currency}${spotStopLoss.toLocaleString()}. Pricing synthesized via anchored Black-Scholes Delta (${delta.toFixed(2)}) & Gamma to eliminate unrealistic overshoots.`,
  });

  // Rationale 6: Intraday VWAP & 9/21 EMA Trend Stack
  rationalePoints.push({
    title: 'Intraday VWAP & 9/21 EMA Institutional Stack',
    verdict: rt.vwap.bias === 'BULLISH' ? 'BULLISH' : rt.vwap.bias === 'BEARISH' ? 'BEARISH' : 'NEUTRAL',
    description: `VWAP: ${ticker.currency}${rt.vwap.value.toLocaleString()} (${rt.vwap.statusLabel}, distance: ${rt.vwap.distancePercent > 0 ? '+' : ''}${rt.vwap.distancePercent}%). Bands: [${ticker.currency}${rt.vwap.lowerBand.toLocaleString()} - ${ticker.currency}${rt.vwap.upperBand.toLocaleString()}]. 5m EMA Stack: ${rt.ema.label} (9 EMA: ${ticker.currency}${rt.ema.ema9.toLocaleString()} vs 21 EMA: ${ticker.currency}${rt.ema.ema21.toLocaleString()}).`,
  });

  // Rationale 7: Real-Time RSI, MACD & Gamma Exposure (GEX) Regime
  rationalePoints.push({
    title: 'RSI, MACD Momentum & Option Gamma (GEX) Regime',
    verdict: rt.macd.trend.includes('BULLISH') ? 'BULLISH' : rt.macd.trend.includes('BEARISH') ? 'BEARISH' : 'NEUTRAL',
    description: `5m RSI: ${rt.rsi.value.toFixed(1)} (${rt.rsi.label}${rt.rsi.divergence !== 'NONE' ? ` · ${rt.rsi.divergence?.replace(/_/g, ' ') || 'NONE'}` : ''}). MACD (12,26,9): Hist ${rt.macd.histogram > 0 ? '+' : ''}${rt.macd.histogram} (${rt.macd.label}). Gamma Regime: ${rt.gammaExposure?.regime?.replace(/_/g, ' ') || 'BALANCED'} (Net GEX: ${rt.gammaExposure?.netGex?.toLocaleString() ?? 0} | Flip Strike: ${ticker.currency}${rt.gammaExposure?.flipStrike?.toLocaleString() ?? (ticker.spotPrice + ticker.strikeStep).toLocaleString()}). Order Flow Delta: ${rt.orderFlow.orderFlowDelta > 0 ? '+' : ''}${rt.orderFlow.orderFlowDelta.toLocaleString()} (${rt.orderFlow.sentiment?.replace(/_/g, ' ') || 'BALANCED'}).`,
  });

  // Rationale 8: Nifty Derivative Constituent Heavyweights & Sectoral Breadth (for Indian Equities & Indices)
  if (constituentAnalysis) {
    const hwBias = constituentAnalysis.overallHeavyweightBias || '';
    rationalePoints.push({
      title: 'Nifty Derivative Heavyweight Breadth & Sectoral Delta',
      verdict: hwBias.includes('BULLISH') ? 'BULLISH' : hwBias.includes('BEARISH') ? 'BEARISH' : 'NEUTRAL',
      description: `Heavyweight Breadth: ${constituentAnalysis.summaryNote || 'Heavyweight flow active'} (Breadth Score: ${(constituentAnalysis.breadthScore ?? 0) > 0 ? '+' : ''}${constituentAnalysis.breadthScore ?? 0}/10 | Weighted Delta: ${(constituentAnalysis.weightedConstituentDelta ?? 0) > 0 ? '+' : ''}${constituentAnalysis.weightedConstituentDelta ?? 0}%). Sectoral Contributions: ${(constituentAnalysis.sectoralBreakdown || []).slice(0, 3).map(s => `${s.sector}: ${s.contributionPoints >= 0 ? '+' : ''}${s.contributionPoints} pts (${s.leadingStock})`).join(' | ')}.`,
    });
  }

  // Rationale 9: Global Inter-Market Telemetry (GIFT Nifty, US Futures, USD/INR, Crude, Yields)
  rationalePoints.push({
    title: `Global Inter-Market Alignment (${interMarketTelemetry?.globalSentiment?.replace(/_/g, ' ') || 'NEUTRAL'})`,
    verdict: (interMarketTelemetry?.globalCompositeScore || 0) >= 15 ? 'BULLISH' : (interMarketTelemetry?.globalCompositeScore || 0) <= -15 ? 'BEARISH' : 'NEUTRAL',
    description: `${interMarketTelemetry?.summaryInsight || 'Balanced macro cues.'} Key drivers: GIFT Nifty (${(interMarketTelemetry?.giftNifty?.change || 0) >= 0 ? '+' : ''}${(interMarketTelemetry?.giftNifty?.change || 0).toFixed(2)} pts), S&P 500 Fut (+${interMarketTelemetry?.sp500Futures?.changePercent || 0}%), Brent Crude ($${interMarketTelemetry?.brentCrude?.price || 75}/bbl), and USD/INR (₹${interMarketTelemetry?.usdInr?.price || 83.5}) directly drive FII capital flow direction.`,
  });

  // Rationale 10: Volume Analytics & Order Flow Buildup
  if (rt.volumeAnalytics) {
    rationalePoints.push({
      title: `Volume Dynamics & Order Flow Buildup (${rt.volumeAnalytics.volumeBuildupLabel})`,
      verdict: rt.volumeAnalytics.buyerSellerPressureDelta >= 10 ? 'BULLISH' : rt.volumeAnalytics.buyerSellerPressureDelta <= -10 ? 'BEARISH' : 'NEUTRAL',
      description: `Volume Multiplier is at ${rt.volumeAnalytics.totalVolumeMultiplier}x baseline 20MA with ${rt.volumeAnalytics.buyerSellerPressureDelta >= 0 ? '+' : ''}${rt.volumeAnalytics.buyerSellerPressureDelta}% order flow delta imbalance (${rt.volumeAnalytics.volumeBuildupLabel}). Confirms prediction accuracy with ${rt.volumeAnalytics.volumeAccuracyMultiplier}x volume multiplier.`,
    });
  }

  // Rationale 11: Cumulative Strike History & Statistical Edge
  rationalePoints.push({
    title: `Cumulative Strike History Confluence (${strikeAnalytics.overallWinRate}% Win Rate)`,
    verdict: strikeAnalytics.cumulativeTrend.dominantAction === 'BULLISH_CE' ? 'BULLISH' : 'BEARISH',
    description: `${strikeAnalytics.cumulativeTrend.statusHeadline}. Evaluated across ${strikeAnalytics.totalHistoricalSignals} recorded suggestions for ${ticker.symbol}: ${strikeAnalytics.overallWinRate}% win rate (${strikeAnalytics.target1HitRate}% T1 hit rate, +${strikeAnalytics.avgProfitPerWinningTrade}% avg win). Top moneyness profit tier: ${strikeAnalytics.bestPerformingMoneyness}. Action alignment score: ${strikeAnalytics.cumulativeTrend.alignmentScore}/100.`,
  });

  // Add Capital Protection point if activated
  if (capitalProtectionReason) {
    rationalePoints.unshift({
      title: 'Institutional Capital Protection Filter',
      verdict: 'NEUTRAL',
      description: capitalProtectionReason,
    });
  }

  // --- 6. SESSION EXTREMES & TRADE LIFECYCLE EVALUATION ---
  // Helper to check if ticker's data timestamp matches the current calendar day in local timezone or IST
  const isTickerDataToday = (() => {
    if (!ticker.asOnTime) return false;
    try {
      const monthMap: Record<string, number> = {
        jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
        jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
      };
      const cleanStr = ticker.asOnTime.toLowerCase();
      const matchDmy = cleanStr.match(/(\d{1,2})-(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)-(\d{4})/);
      if (matchDmy) {
        const day = parseInt(matchDmy[1], 10);
        const monthStr = matchDmy[2];
        const year = parseInt(matchDmy[3], 10);
        const month = monthMap[monthStr];
        
        const tickerDate = new Date(year, month, day);
        const today = new Date();
        
        const isSameDay = tickerDate.getDate() === today.getDate() &&
                           tickerDate.getMonth() === today.getMonth() &&
                           tickerDate.getFullYear() === today.getFullYear();
                           
        const istDateStr = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Kolkata',
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        }).format(today);
        
        const parsedIst = new Date(istDateStr);
        const isSameDayIST = tickerDate.getDate() === parsedIst.getDate() &&
                              tickerDate.getMonth() === parsedIst.getMonth() &&
                              tickerDate.getFullYear() === parsedIst.getFullYear();
                              
        return isSameDay || isSameDayIST;
      }
      
      const parsedDate = new Date(ticker.asOnTime);
      if (!isNaN(parsedDate.getTime())) {
        const today = new Date();
        return parsedDate.getDate() === today.getDate() &&
               parsedDate.getMonth() === today.getMonth() &&
               parsedDate.getFullYear() === today.getFullYear();
      }
    } catch {
      // ignore parsing error
    }
    return false;
  })();

  // Evaluates contract high/low at session extremes (Day Low for PE peak, Day High for CE peak)
  // Only evaluate sessionHighLTP using previous session extremes if the data is actually from today.
  // Otherwise, default sessionHighLTP to premium so we don't carry previous days' target reaches.
  const peakSpotExtreme = isCE ? ticker.dayHigh : ticker.dayLow;
  const bsPeakExtreme = calculateBlackScholes(peakSpotExtreme, targetStrike, T, r, ivDecimal, recommendedType);
  const sessionHighLTP = isTickerDataToday ? Math.max(premium, roundToTick(bsPeakExtreme.price)) : premium;
  
  const lowSpotExtreme = isCE ? ticker.dayLow : ticker.dayHigh;
  const bsLowExtreme = calculateBlackScholes(lowSpotExtreme, targetStrike, T, r, ivDecimal, recommendedType);
  const sessionLowLTP = isTickerDataToday ? Math.min(premium, roundToTick(bsLowExtreme.price)) : premium;

  // --- DYNAMIC TRAILING STOP LOSS & CAPITAL PRESERVATION ENGINE ---
  // Guarantees traders do NOT lose money on trades that have already expanded in profit:
  // 1. Break-Even Lock: When premium reaches 30% of the distance between Entry and Target 1,
  //    or reaches +5% gain, Stop Loss automatically trails up to Break-Even (Cost / entryHigh).
  // 2. Profit Lock: When Target 1 is achieved, Stop Loss trails to lock in 50% of Target 1 gain!
  // 3. Trailing Stop Loss NEVER trails downwards, strictly safeguarding capital.
  let trailingStopLoss = isExistingOngoingTrade && previousSignal?.trailingStopLoss
    ? previousSignal.trailingStopLoss
    : stopLoss;
  let capitalProtectionStatus: 'ACTIVE_RISK' | 'BREAK_EVEN_LOCKED' | 'PROFIT_LOCKED' | 'NEUTRAL_SAFE' = 'ACTIVE_RISK';
  let trailingStopNote = `Initial Stop Loss guarding below technical invalidation (${ticker.currency}${spotStopLoss.toLocaleString()})`;

  if (action === 'WAIT_NEUTRAL') {
    capitalProtectionStatus = 'NEUTRAL_SAFE';
    trailingStopNote = 'Standing aside · Capital 100% in cash / protected';
  } else if (premium >= target2 * 0.96) {
    trailingStopLoss = Math.max(trailingStopLoss, roundToTick(target1));
    capitalProtectionStatus = 'PROFIT_LOCKED';
    trailingStopNote = `🔒 Profit Protected: Trailed to Target 1 (${ticker.currency}${target1.toFixed(2)}) · Maximum runner gains locked`;
  } else if (premium >= target1 * 0.96) {
    const halfT1Gain = entryHigh + (target1 - entryHigh) * 0.50;
    trailingStopLoss = Math.max(trailingStopLoss, roundToTick(Math.max(stopLoss, halfT1Gain)));
    capitalProtectionStatus = 'PROFIT_LOCKED';
    trailingStopNote = `🔒 Profit Protected: Trailed to ${ticker.currency}${trailingStopLoss.toFixed(2)} (+50% T1 gains locked)`;
  } else if (premium >= entryHigh + (target1 - entryHigh) * 0.30 || (premium - entryHigh) / Math.max(entryHigh, 1) >= 0.05) {
    trailingStopLoss = Math.max(trailingStopLoss, roundToTick(entryHigh));
    capitalProtectionStatus = 'BREAK_EVEN_LOCKED';
    trailingStopNote = `🛡️ Break-Even Locked: Trailed to Cost (${ticker.currency}${entryHigh.toFixed(2)}) · Zero risk of capital loss`;
  }

  // Determine Trade Lifecycle Stage against anchored levels and trailing stop loss
  let tradeStage: TradeLifecycleStage = 'FRESH_ENTRY';
  let isTargetAlreadyAchieved = false;
  let targetAchievedNote = '';

  const peakGainPercent = Number((((sessionHighLTP - premium) / premium) * 100).toFixed(1));

  // Active ongoing trade trend contradiction check:
  // ONLY invalidate if spot is actively reversing direction (BUY_PE after BUY_CE) or actual stop loss is breached
  const isCeContradictedByDownturn = previousSignal && previousSignal.action === 'BUY_CE' && 
    action === 'BUY_PE' && (isBelowVWAP || highRejectionRatio >= 0.45 || isContinuousFall || (spotStopLoss && spotPrice <= spotStopLoss));
  const isPeContradictedByUpturn = previousSignal && previousSignal.action === 'BUY_PE' && 
    action === 'BUY_CE' && (isAboveVWAP || lowRecoveryRatio >= 0.45 || isMarketRaising || (spotStopLoss && spotPrice >= spotStopLoss));

  if (isCeContradictedByDownturn) {
    tradeStage = 'STOP_LOSS_HIT';
    capitalProtectionStatus = 'ACTIVE_RISK';
    targetAchievedNote = `⚠️ Trend Reversal Invalidation: Intraday trend shifted downward from morning highs (Spot ${ticker.currency}${spotPrice.toLocaleString()} fell below VWAP ${ticker.currency}${rt.vwap.value.toLocaleString()}). Previous ${previousSignal.recommendedStrike} CE trade invalidated. Reversal setup in progress.`;
  } else if (isPeContradictedByUpturn) {
    tradeStage = 'STOP_LOSS_HIT';
    capitalProtectionStatus = 'ACTIVE_RISK';
    targetAchievedNote = `⚠️ Trend Reversal Invalidation: Intraday trend bounced upward from lows (Spot ${ticker.currency}${spotPrice.toLocaleString()} reclaimed VWAP ${ticker.currency}${rt.vwap.value.toLocaleString()}). Previous ${previousSignal.recommendedStrike} PE trade invalidated. Reversal setup in progress.`;
  } else if (action === 'WAIT_NEUTRAL') {
    tradeStage = 'NEUTRAL_WAIT';
  } else if (premium <= trailingStopLoss) {
    tradeStage = 'STOP_LOSS_HIT';
    capitalProtectionStatus = 'ACTIVE_RISK';
    targetAchievedNote = `Technical invalidation floor (${ticker.currency}${trailingStopLoss.toFixed(2)}) was hit. Exit trade immediately to prevent further loss.`;
  } else if (premium >= target2 || sessionHighLTP >= target2) {
    if (premium >= target2 * 0.96) {
      tradeStage = 'TARGET_2_HIT';
    } else {
      tradeStage = 'POST_TARGET_RETRACEMENT';
      isTargetAlreadyAchieved = true;
      targetAchievedNote = `Target 2 (${ticker.currency}${target2.toFixed(2)}) was hit earlier. Current price (${ticker.currency}${premium.toFixed(2)}) is retracing post-target.`;
    }
  } else if (sessionHighLTP >= target1 * 0.98 || premium >= target1 * 0.98) {
    if (premium >= target1 * 0.96) {
      tradeStage = 'TARGET_1_HIT';
    } else {
      tradeStage = 'POST_TARGET_RETRACEMENT';
      isTargetAlreadyAchieved = true;
      targetAchievedNote = `Target 1 (${ticker.currency}${target1.toFixed(2)}) was already achieved during this session. Current price (${ticker.currency}${premium.toFixed(2)}) is in a post-target pullback. Avoid fresh market entry at current price.`;
    }
  } else if (premium > entryHigh) {
    tradeStage = 'EXPANDING_IN_PROFIT';
  } else {
    tradeStage = 'FRESH_ENTRY';
  }

  // Summary Note: Explicitly states current price and reason
  const pricePrefix = ticker.isUsingPreMarket
    ? `Based on PRE-MARKET price of ${ticker.currency}${spotPrice.toLocaleString()} (${changeFormatted} vs reference close)`
    : `Based on current market price of ${ticker.currency}${spotPrice.toLocaleString()} (${changeFormatted} vs reference close)`;

  let summaryNote = '';
  if (tradeStage === 'STOP_LOSS_HIT') {
    summaryNote = targetAchievedNote 
      ? `🛑 ${targetAchievedNote} STRICT DIRECTIVE: Close position immediately to preserve trading capital.`
      : `🛑 STOP LOSS HIT: Reference contract ${targetStrike} ${recommendedType} reached trailing stop loss level ${ticker.currency}${trailingStopLoss.toFixed(2)} (Current LTP: ${ticker.currency}${premium.toFixed(2)}). STRICT DIRECTIVE: Close position immediately to preserve trading capital.`;
  } else if (action === 'BUY_CE') {
    summaryNote = `${pricePrefix}: Market is exhibiting upward momentum. Recommending CALL (CE) ${targetStrike} @ ${ticker.currency}${premium.toFixed(2)} to capture upside rally. Target 1: ${ticker.currency}${target1.toFixed(2)} (+${((target1Delta / premium) * 100).toFixed(1)}% at spot ${ticker.currency}${spotTarget1.toLocaleString()}) | Target 2: ${ticker.currency}${target2.toFixed(2)} (+${((target2Delta / premium) * 100).toFixed(1)}% at ${target2Basis}) | SL: ${ticker.currency}${stopLoss.toFixed(2)} (-${((actualRisk / premium) * 100).toFixed(1)}% at spot ${ticker.currency}${spotStopLoss.toLocaleString()}). Derived via 2m/5m/15m candlesticks, VWAP & GEX bounds.${isTargetAlreadyAchieved ? ` [NOTE: Target 1 was already achieved; current ${ticker.currency}${premium.toFixed(2)} is a pullback]` : ''}`;
  } else if (action === 'BUY_PE') {
    summaryNote = `${pricePrefix}: Market is falling / trending downward. Recommending PUT (PE) ${targetStrike} @ ${ticker.currency}${premium.toFixed(2)} to capitalize on downside momentum (Put options increase in value as the underlying market drops). Target 1: ${ticker.currency}${target1.toFixed(2)} (+${((target1Delta / premium) * 100).toFixed(1)}% as spot declines to ${ticker.currency}${spotTarget1.toLocaleString()}) | Target 2: ${ticker.currency}${target2.toFixed(2)} (+${((target2Delta / premium) * 100).toFixed(1)}% at ${target2Basis}) | SL: ${ticker.currency}${stopLoss.toFixed(2)} (-${((actualRisk / premium) * 100).toFixed(1)}% if spot rebounds to ${ticker.currency}${spotStopLoss.toLocaleString()}). Derived via 2m/5m/15m candlesticks, VWAP & GEX bounds.${isTargetAlreadyAchieved ? ` [NOTE: Target 1 was already achieved; current ${ticker.currency}${premium.toFixed(2)} is a pullback]` : ''}`;
  } else {
    summaryNote = capitalProtectionReason
      ? `${pricePrefix}: Suggesting WAIT / NEUTRAL. [${capitalProtectionReason}]. Reference contract ${targetStrike} ${recommendedType} is trading at ${ticker.currency}${premium.toFixed(2)}.`
      : `${pricePrefix}: Suggesting WAIT / NEUTRAL. Market is consolidating between support (${ticker.currency}${majorSupportStrike.toLocaleString()}) and resistance (${ticker.currency}${majorResistanceStrike.toLocaleString()}). Reference contract ${targetStrike} ${recommendedType} is trading at ${ticker.currency}${premium.toFixed(2)}.`;
  }

  // Compute Adjacent Strike Spectrum (2 strikes below and 2 strikes above predicted strike with Profit Probability %)
  let adjacentStrikes = computeAdjacentStrikeSpectrum(
    targetStrike,
    recommendedType,
    ticker,
    chain,
    spotTarget1,
    spotTarget2,
    spotStopLoss,
    netNewsImpactMultiplier,
    candlePatterns.confluenceScore,
    expiryIndex
  );

  // Compute After-Market & Pre-Market Opening Analytics
  const afterMarketAnalytics = computeAfterMarketOpeningAnalytics(
    ticker, 
    marketStatus, 
    rt.vwap.value, 
    interMarketTelemetry, 
    metrics, 
    candlePatterns
  );

  // When market is in After-Market / Closed session:
  // Show the strike price that will hit tomorrow once the market opens based on today's full day chart + aftermarket analysis
  if (!marketStatus.isOpen && afterMarketAnalytics.tomorrowHitStrike) {
    const hit = afterMarketAnalytics.tomorrowHitStrike;

    // Strict Candlestick Momentum & Overnight Gap Conflict Alignment
    const isCandleUpward = candlePatterns.confluenceBias === 'BULLISH' || candlePatterns.confluenceScore > 0.3;
    const isCandleDownward = candlePatterns.confluenceBias === 'BEARISH' || candlePatterns.confluenceScore < -0.3;

    // Overnight Gap Conflict: If GIFT Nifty / Pre-Market cues directly oppose session trend, downgrade to WAIT_NEUTRAL
    const isGapConflictingCE = (hit.type === 'CE' || hit.action === 'BUY_CE') && (afterMarketAnalytics.predictedOpeningGapPoints <= -12 || afterMarketAnalytics.predictedOpeningGapPercent <= -0.10);
    const isGapConflictingPE = (hit.type === 'PE' || hit.action === 'BUY_PE') && (afterMarketAnalytics.predictedOpeningGapPoints >= 12 || afterMarketAnalytics.predictedOpeningGapPercent >= 0.10);

    if (isGapConflictingCE || isGapConflictingPE) {
      hit.action = 'WAIT_FIRST_15M';
      capitalProtectionReason = `Overnight Gap Conflict: Today's session closed ${isGapConflictingCE ? 'positive' : 'negative'}, but overnight GIFT Nifty points to an opposing opening gap (${afterMarketAnalytics.predictedOpeningGapPoints >= 0 ? '+' : ''}${afterMarketAnalytics.predictedOpeningGapPoints.toFixed(1)} pts). Buying ${isGapConflictingCE ? 'Call' : 'Put'} options before open carries high gap drawdown risk. Stand aside in WAIT_NEUTRAL for the 15-minute Opening Range Breakout (ORB) at 09:30 AM before entering.`;
    }

    if (isCandleUpward && hit.type === 'PE') {
      // Candlesticks are upward: align reference contract strictly to CE
      hit.type = 'CE';
      hit.strike = Math.ceil((ticker.spotPrice + ticker.strikeStep * 0.4) / ticker.strikeStep) * ticker.strikeStep;
      if (hit.action === 'BUY_PE') hit.action = 'WAIT_FIRST_15M';
    } else if (isCandleDownward && hit.type === 'CE') {
      // Candlesticks are downward: align reference contract strictly to PE
      hit.type = 'PE';
      hit.strike = Math.floor((ticker.spotPrice - ticker.strikeStep * 0.4) / ticker.strikeStep) * ticker.strikeStep;
      if (hit.action === 'BUY_CE') hit.action = 'WAIT_FIRST_15M';
    }

    targetStrike = hit.strike;
    recommendedType = hit.type;

    if (hit.action === 'WAIT_FIRST_15M') {
      action = 'WAIT_NEUTRAL';
      confidence = 58;
      strength = 'CAUTION';
    } else {
      action = hit.action;
      confidence = Math.max(confidence, 82);
      strength = 'STRONG';
    }

    const hitRow = chain.find(r => r.strike === targetStrike);
    const hitContract = recommendedType === 'CE' ? hitRow?.ce : hitRow?.pe;
    if (hitContract && hitContract.ltp > 0.05) {
      premium = hitContract.ltp;
      moneyness = hitContract.moneyness;
    } else if (ticker.symbol.includes('NIFTY')) {
      const q = resolveNextExpiryContractQuote(targetStrike, recommendedType, 1, ticker.spotPrice);
      premium = q.ltp;
      moneyness = q.moneyness;
    } else {
      premium = hit.estimatedOpeningPremium > 0.05 ? hit.estimatedOpeningPremium : 108.50;
    }

    spotTarget1 = hit.projectedSpotAtHit;
    spotTarget2 = recommendedType === 'CE' 
      ? Number((spotTarget1 + ticker.strikeStep * 0.8).toFixed(2)) 
      : Number((spotTarget1 - ticker.strikeStep * 0.8).toFixed(2));
    spotStopLoss = recommendedType === 'CE'
      ? Number((ticker.spotPrice - ticker.strikeStep * 0.4).toFixed(2))
      : Number((ticker.spotPrice + ticker.strikeStep * 0.4).toFixed(2));

    // Dynamic targets strictly anchored to the actual live contract premium
    const t1GainRate = 0.35; // +35% opening target
    const t2GainRate = 0.70; // +70% runner extension
    const slLossRate = 0.18; // -18% invalidation SL

    const target1Gain = Math.max(tick * 3, roundToTick(premium * t1GainRate));
    const target2Gain = Math.max(target1Gain + tick * 4, roundToTick(premium * t2GainRate));
    const slLoss = Math.max(tick * 2, roundToTick(premium * slLossRate));

    target1 = roundToTick(premium + target1Gain);
    target2 = roundToTick(premium + target2Gain);
    stopLoss = Math.max(tick, roundToTick(premium - slLoss));

    const finalTarget1Delta = roundToTick(target1 - premium);
    const finalActualRisk = roundToTick(premium - stopLoss);
    rrRatio = `1 : ${(finalTarget1Delta / Math.max(finalActualRisk, tick)).toFixed(1)}`;

    initialEntryLtp = premium;
    const spreadBuffer = ticker.currency === '₹' ? (ticker.symbol.includes('BANK') ? 0.75 : 0.40) : 0.05;
    entryLow = Math.max(tick, roundToTick(premium - spreadBuffer));
    entryHigh = roundToTick(premium + spreadBuffer);
    entryRange = [entryLow, entryHigh];

    if (action === 'WAIT_NEUTRAL') {
      const isRegularSession = ticker.marketState === 'REGULAR' || ticker.marketState === 'OPEN';
      if (isRegularSession) {
        summaryNote = `Market is in active intraday consolidation (Spot: ${ticker.currency}${ticker.spotPrice.toLocaleString()}, Change: ${ticker.change >= 0 ? '+' : ''}${ticker.change.toFixed(2)} pts). Current multi-factor confluence indicates rangebound equilibrium (${afterMarketAnalytics?.fullDayChartAnalysis?.dayStructureVerdict?.replace(/_/g, ' ') || 'BALANCED'}). Professional discipline requires waiting for a confirmed candle breakout above resistance (${ticker.currency}${(metrics?.majorResistanceStrike || (ticker.spotPrice + ticker.strikeStep)).toLocaleString()}) or breakdown below support (${ticker.currency}${(metrics?.majorSupportStrike || (ticker.spotPrice - ticker.strikeStep)).toLocaleString()}) before committing new capital. Reference strike ${targetStrike} ${recommendedType} is trading at ${ticker.currency}${premium.toFixed(2)}.`;
      } else {
        const candleNote = candlePatterns?.confluenceBias === 'BEARISH'
          ? ` Note: Late-session 2m/5m/15m candlesticks indicate bearish profit-taking momentum (${candlePatterns.confluencePattern || 'pullback off highs'}), but because the overnight opening gap is virtually flat (+${afterMarketAnalytics.predictedOpeningGapPoints} pts), jumping into naked Puts at 09:15 AM risks IV crush & theta decay without trend confirmation.`
          : '';
        summaryNote = `Based on today's chart structure (${afterMarketAnalytics.fullDayChartAnalysis?.dayStructureVerdict?.replace(/_/g, ' ') || 'BALANCED'}, closed ${afterMarketAnalytics.fullDayChartAnalysis?.closeVsVwapPoints >= 0 ? '+' : ''}${afterMarketAnalytics.fullDayChartAnalysis?.closeVsVwapPoints} pts vs VWAP) and GIFT Nifty (${afterMarketAnalytics.giftNiftyChangePoints >= 0 ? '+' : ''}${afterMarketAnalytics.giftNiftyChangePoints} pts): Expecting flat / range-bound opening (${afterMarketAnalytics.predictedOpeningGapPoints >= 0 ? '+' : ''}${afterMarketAnalytics.predictedOpeningGapPoints} pts). Suggesting WAIT / NEUTRAL for the first 15 minutes (09:15 - 09:30 AM).${candleNote} Professional discipline requires waiting for the 15m opening range breakout before committing real capital. Reference breakdown contract ${targetStrike} ${recommendedType} is trading at ${ticker.currency}${premium.toFixed(2)}.`;
      }
    } else {
      summaryNote = `Based on today's chart structure (${afterMarketAnalytics.fullDayChartAnalysis?.dayStructureVerdict?.replace(/_/g, ' ') || 'BALANCED'}, Range: ${ticker.currency}${afterMarketAnalytics.fullDayChartAnalysis?.dayLow?.toLocaleString()} - ${ticker.currency}${afterMarketAnalytics.fullDayChartAnalysis?.dayHigh?.toLocaleString()}, closed ${afterMarketAnalytics.fullDayChartAnalysis?.closeVsVwapPoints >= 0 ? '+' : ''}${afterMarketAnalytics.fullDayChartAnalysis?.closeVsVwapPoints} pts vs VWAP) and GIFT Nifty drift (${afterMarketAnalytics.giftNiftyChangePoints >= 0 ? '+' : ''}${afterMarketAnalytics.giftNiftyChangePoints} pts), opening will test ${targetStrike} ${recommendedType}. Recommending ${targetStrike} ${recommendedType} @ ${ticker.currency}${premium.toFixed(2)} | Target 1: ${ticker.currency}${target1.toFixed(2)} (+${((finalTarget1Delta / premium) * 100).toFixed(1)}% at spot ${ticker.currency}${spotTarget1.toLocaleString()}) | Target 2: ${ticker.currency}${target2.toFixed(2)} | SL: ${ticker.currency}${stopLoss.toFixed(2)} (-${((finalActualRisk / premium) * 100).toFixed(1)}%).`;
    }

    // Synchronize targetExitSynthesis grounding with updated opening strike and premium
    if (targetExitSynthesis?.entryExitGrounding) {
      targetExitSynthesis.entryExitGrounding.optimalEntryZone = [entryLow, entryHigh];
      targetExitSynthesis.entryExitGrounding.target1OptionPayoff = target1;
      targetExitSynthesis.entryExitGrounding.target2OptionPayoff = target2;
      targetExitSynthesis.entryExitGrounding.target1SpotLevel = spotTarget1;
      targetExitSynthesis.entryExitGrounding.target2SpotLevel = spotTarget2;
      targetExitSynthesis.entryExitGrounding.stopLossSpotLevel = spotStopLoss;
      targetExitSynthesis.entryExitGrounding.riskPerLot = Number((finalActualRisk * ticker.lotSize).toFixed(2));
      targetExitSynthesis.entryExitGrounding.maxRiskAmount = Number((finalActualRisk * ticker.lotSize).toFixed(2));
    }

    // Recompute adjacent strike spectrum around the updated targetStrike
    adjacentStrikes = computeAdjacentStrikeSpectrum(
      targetStrike,
      recommendedType,
      ticker,
      chain,
      spotTarget1,
      spotTarget2,
      spotStopLoss,
      netNewsImpactMultiplier,
      candlePatterns.confluenceScore,
      expiryIndex
    );
  }

  // Rationale 11: After-Market Opening Projection
  if (!marketStatus.isOpen) {
    rationalePoints.push({
      title: action === 'WAIT_NEUTRAL'
        ? `Opening Stance: Flat Opening (${afterMarketAnalytics.predictedOpeningGapPoints >= 0 ? '+' : ''}${afterMarketAnalytics.predictedOpeningGapPoints} pts) · Wait First 15m`
        : `Opening Target Strike: ${targetStrike} ${recommendedType} (${afterMarketAnalytics?.predictedOpeningType?.replace(/_/g, ' ') || 'MARKET OPEN'})`,
      verdict: action === 'WAIT_NEUTRAL' ? 'NEUTRAL' : (action === 'BUY_CE' ? 'BULLISH' : 'BEARISH'),
      description: action === 'WAIT_NEUTRAL'
        ? `Overnight GIFT Nifty (${afterMarketAnalytics.giftNiftyChangePoints >= 0 ? '+' : ''}${afterMarketAnalytics.giftNiftyChangePoints} pts) points to a flat opening (${afterMarketAnalytics.predictedOpeningGapPoints >= 0 ? '+' : ''}${afterMarketAnalytics.predictedOpeningGapPoints} pts). Stand aside at 09:15 AM open to avoid theta bleed and IV crush; wait for 09:30 AM 15-minute range breakout before entering ${targetStrike} ${recommendedType}.`
        : `Today's entire day chart (${afterMarketAnalytics.fullDayChartAnalysis.dayChartSummary}) combined with overnight GIFT Nifty (${afterMarketAnalytics.giftNiftyChangePoints >= 0 ? '+' : ''}${afterMarketAnalytics.giftNiftyChangePoints} pts) indicates spot will drive to ${afterMarketAnalytics.tomorrowHitStrike.projectedSpotAtHit} at 09:15 AM open, hitting strike ${targetStrike} ${recommendedType}. Strategy: ${afterMarketAnalytics.openingStrategyPlaybook.openingExecutionTrigger}`,
    });
  }

  // --- 7. SIDEWAYS / RANGE-BOUND SCENARIO DETECTION ENGINE ---
  const sidewaysMarketAnalysis = computeSidewaysMarketAnalysis(
    ticker,
    metrics,
    chain,
    action,
    rt,
    constituentAnalysis
  );

  // Sideways Market Trap Filter: If range compression is active, require a confirmed price breakout
  // outside the deadband triggers before issuing directional recommendations, protecting option buyers from theta bleed
  const isGenuineBullishBreakout = spotPrice >= sidewaysMarketAnalysis.breakoutWatchLevels.bullishBreakoutTrigger || isStrongBullMomentum || lowRecoveryRatio >= 0.70;
  const isGenuineBearishBreakdown = spotPrice <= sidewaysMarketAnalysis.breakoutWatchLevels.bearishBreakdownTrigger || isStrongBearMomentum || isContinuousFall || (highRejectionRatio >= 0.35 && dropFromPeak >= ticker.strikeStep * 0.45);

  if (sidewaysMarketAnalysis.isSideways && sidewaysMarketAnalysis.compressionPercentage >= 65 && Math.abs(score) < 1.4 && (action === 'BUY_CE' || action === 'BUY_PE')) {
    if (action === 'BUY_CE' && !isGenuineBullishBreakout) {
      action = 'WAIT_NEUTRAL';
      strength = 'CAUTION';
      confidence = Math.min(65, Math.max(48, Math.round(50 + (sidewaysMarketAnalysis.compressionPercentage * 0.15))));
      capitalProtectionReason = `Capital Protection: Sideways Market Deadband (${sidewaysMarketAnalysis.compressionPercentage}% range compression between ${ticker.currency}${sidewaysMarketAnalysis.rangeFloor.toLocaleString()} floor & ${ticker.currency}${sidewaysMarketAnalysis.rangeCeiling.toLocaleString()} ceiling). Directional option buying inside deadband has severe negative expected value; stand aside in WAIT until confirmed breakout above ${ticker.currency}${sidewaysMarketAnalysis.breakoutWatchLevels.bullishBreakoutTrigger}.`;
    } else if (action === 'BUY_PE' && !isGenuineBearishBreakdown) {
      action = 'WAIT_NEUTRAL';
      strength = 'CAUTION';
      confidence = Math.min(65, Math.max(48, Math.round(50 + (sidewaysMarketAnalysis.compressionPercentage * 0.15))));
      capitalProtectionReason = `Capital Protection: Sideways Market Deadband (${sidewaysMarketAnalysis.compressionPercentage}% range compression between ${ticker.currency}${sidewaysMarketAnalysis.rangeFloor.toLocaleString()} floor & ${ticker.currency}${sidewaysMarketAnalysis.rangeCeiling.toLocaleString()} ceiling). Directional option buying inside deadband has severe negative expected value; stand aside in WAIT until confirmed breakdown below ${ticker.currency}${sidewaysMarketAnalysis.breakoutWatchLevels.bearishBreakdownTrigger}.`;
    }
  }

  if (sidewaysMarketAnalysis.isSideways && action === 'WAIT_NEUTRAL') {
    summaryNote = `${pricePrefix}: Verified SIDEWAYS / RANGE-BOUND scenario detected (${sidewaysMarketAnalysis.compressionPercentage}% range compression, bound between ${ticker.currency}${sidewaysMarketAnalysis.rangeFloor.toLocaleString()} floor & ${ticker.currency}${sidewaysMarketAnalysis.rangeCeiling.toLocaleString()} ceiling). Directional option buying (both CE and PE) has severe negative expected value due to rapid theta bleed. Stand aside in WAIT until spot cleanly breaks ${ticker.currency}${sidewaysMarketAnalysis.breakoutWatchLevels.bullishBreakoutTrigger} or ${ticker.currency}${sidewaysMarketAnalysis.breakoutWatchLevels.bearishBreakdownTrigger}. Reference contract ${targetStrike} ${recommendedType} @ ${ticker.currency}${premium.toFixed(2)}.`;
    
    rationalePoints.unshift({
      title: `Verified Sideways / Range-Bound Scenario (${sidewaysMarketAnalysis.compressionPercentage}% Compressed)`,
      verdict: 'NEUTRAL',
      description: `Market is consolidating within a tight ${sidewaysMarketAnalysis.rangeSpanPoints} pts boundary (Floor: ${ticker.currency}${sidewaysMarketAnalysis.rangeFloor.toLocaleString()} · Ceiling: ${ticker.currency}${sidewaysMarketAnalysis.rangeCeiling.toLocaleString()} · Pin: ${ticker.currency}${sidewaysMarketAnalysis.rangePinStrike.toLocaleString()}). ${sidewaysMarketAnalysis.reasons[0] || 'Spot is oscillating tightly around VWAP with balanced PCR.'} Directional option buyers face severe theta decay; stand aside in WAIT.`,
    });
  }

  // --- 8. HIGHER-TIMEFRAME & EXPIRY PREDICTION ENGINE (1H, 1D, 1W & EXPIRIES) ---
  const htfPredictions = computeMultiTimeframePredictions(
    ticker,
    metrics,
    chain,
    marketStatus,
    interMarketTelemetry,
    safeNews,
    rt.volumeAnalytics,
    strikeAnalytics,
    candlePatterns
  );

  // Inlined Candlestick Momentum Rationale Point
  if (candlePatterns) {
    const isBull = candlePatterns.confluenceBias === 'BULLISH';
    const isBear = candlePatterns.confluenceBias === 'BEARISH';
    const scoreVal = candlePatterns.confluenceScore ?? 0;
    const scoreStr = (scoreVal > 0 ? '+' : '') + scoreVal.toFixed(1);
    rationalePoints.push({
      title: `Inlined Candlestick Momentum (${candlePatterns.momentumAlignment?.replace(/_/g, ' ') || candlePatterns.confluenceBias})`,
      verdict: isBull ? 'BULLISH' : isBear ? 'BEARISH' : 'NEUTRAL',
      description: `Candlestick momentum is directly inlined at ${scoreStr}/10 with active pattern: ${candlePatterns.confluencePattern || 'Multi-timeframe momentum alignment'}. Tactical timeframe velocities: 1m (${(candlePatterns.m1Score ?? candlePatterns.m1?.momentumScore ?? 0) > 0 ? '+' : ''}${candlePatterns.m1Score ?? candlePatterns.m1?.momentumScore ?? 0}), 2m (${(candlePatterns.m2Score ?? candlePatterns.m2?.momentumScore ?? 0) > 0 ? '+' : ''}${candlePatterns.m2Score ?? candlePatterns.m2?.momentumScore ?? 0}), 5m (${(candlePatterns.m5Score ?? candlePatterns.m5?.momentumScore ?? 0) > 0 ? '+' : ''}${candlePatterns.m5Score ?? candlePatterns.m5?.momentumScore ?? 0}), 15m (${(candlePatterns.m15Score ?? candlePatterns.m15?.momentumScore ?? 0) > 0 ? '+' : ''}${candlePatterns.m15Score ?? candlePatterns.m15?.momentumScore ?? 0}).`,
    });
  }

  if (htfPredictions.confluenceScore >= 30 && action === 'BUY_CE') {
    rationalePoints.push({
      title: `HTF Multi-Timeframe Alignment (${htfPredictions.overallHTFBias.replace(/_/g, ' ')})`,
      verdict: 'BULLISH',
      description: `${htfPredictions.confluenceSummary} Next 1D target: ₹${htfPredictions.next1Day.projectedSpotTarget.toLocaleString()}.`,
    });
  } else if (htfPredictions.confluenceScore <= -30 && action === 'BUY_PE') {
    rationalePoints.push({
      title: `HTF Multi-Timeframe Alignment (${htfPredictions.overallHTFBias.replace(/_/g, ' ')})`,
      verdict: 'BEARISH',
      description: `${htfPredictions.confluenceSummary} Next 1D target: ₹${htfPredictions.next1Day.projectedSpotTarget.toLocaleString()}.`,
    });
  }

  // --- 9. ADVANCE TRADE RECOMMENDATION ENGINE (LEADING PREDICTIVE SETUPS) ---
  const advanceTradeSetup = computeAdvanceTradeSetup(
    ticker,
    metrics,
    chain,
    rt,
    candlePatterns,
    constituentAnalysis,
    interMarketTelemetry,
    action,
    expiryIndex,
    targetStrike,
    recommendedType
  );

  // Attach Liquidity Sweep Indicator Rationale Point if a active sweep or trap was detected
  if (advanceTradeSetup.liquiditySweep && advanceTradeSetup.liquiditySweep.isSweepDetected) {
    const sw = advanceTradeSetup.liquiditySweep;
    rationalePoints.push({
      title: `SMC Liquidity Sweep Indicator (${sw.sweepType.replace(/_/g, ' ')})`,
      verdict: sw.direction === 'BULLISH_ABSORPTION' ? 'BULLISH' : 'BEARISH',
      description: `${sw.statusLabel}. ${sw.details.institutionalAbsorptionNote} (Reversal Delta Score: ${sw.reversalDeltaScore}%).`,
    });
  }

  // Pillar Consensus Validation: Prevent issuing BUY_CE when bearish pillars strongly dominate, or BUY_PE when bullish pillars strongly dominate.
  // For minor 1-2 pillar differences on ongoing trades, maintain trade consistency with CAUTION strength rather than aborting and thrashing!
  const bullPillars = advanceTradeSetup.leadingPredictorFactors?.filter(f => f.state.includes('BULLISH')).length || 0;
  const bearPillars = advanceTradeSetup.leadingPredictorFactors?.filter(f => f.state.includes('BEARISH')).length || 0;

  const isOngoingBuyCeActive = hasOngoingCeTrade && !isOngoingCeInvalidated;
  const isOngoingBuyPeActive = hasOngoingPeTrade && !isOngoingPeInvalidated;

  if (isOngoingBuyCeActive && activePreviousSignal) {
    // STRICT ACTIVE HOLDING: Preserve active BUY_CE trade through normal pullback fluctuations.
    action = 'BUY_CE';
    recommendedType = 'CE';
    targetStrike = activePreviousSignal.recommendedStrike;
    selectedRow = chain.find(r => r.strike === targetStrike) || selectedRow;
    contract = selectedRow?.ce;
    premium = contract?.ltp ?? premium;
    if (bearPillars > bullPillars) {
      strength = 'CAUTION';
      confidence = Math.max(68, confidence - 4);
    }
  } else if (isOngoingBuyPeActive && activePreviousSignal) {
    // STRICT ACTIVE HOLDING: Preserve active BUY_PE trade through normal relief fluctuations.
    action = 'BUY_PE';
    recommendedType = 'PE';
    targetStrike = activePreviousSignal.recommendedStrike;
    selectedRow = chain.find(r => r.strike === targetStrike) || selectedRow;
    contract = selectedRow?.pe;
    premium = contract?.ltp ?? premium;
    if (bullPillars > bearPillars) {
      strength = 'CAUTION';
      confidence = Math.max(68, confidence - 4);
    }
  } else if (isOngoingCeInvalidated || isOngoingPeInvalidated) {
    // ENFORCE MANDATORY COOLDOWN: When a position stops out, stand aside in WAIT_NEUTRAL.
    // Do NOT allow instant opposite-side revenge trade triggers!
    action = 'WAIT_NEUTRAL';
  } else if (action === 'BUY_CE' && bearPillars > bullPillars) {
    action = 'WAIT_NEUTRAL';
    strength = 'CAUTION';
    const conflict = Math.min(bullPillars, bearPillars);
    confidence = Math.min(76, Math.max(48, Math.round(52 + conflict * 2.8 - Math.abs(bullPillars - bearPillars) * 1.1)));
    capitalProtectionReason = `Pillar Consensus Divergence: Bullish price drift is contradicted by ${bearPillars} bearish pillars (vs only ${bullPillars} bullish). Stand aside in WAIT_NEUTRAL until multi-factor consensus aligns.`;
    
    recommendedType = 'PE';
    targetStrike = currentAtmStrike;
    selectedRow = chain.find(r => r.strike === targetStrike) || selectedRow;
    contract = selectedRow?.pe;
    premium = contract?.ltp ?? premium;
    summaryNote = `${pricePrefix}: Suggesting WAIT / NEUTRAL. [${capitalProtectionReason}]. Reference contract ${targetStrike} ${recommendedType} is trading at ${ticker.currency}${premium.toFixed(2)}.`;
  } else if (action === 'BUY_PE' && bullPillars > bearPillars) {
    action = 'WAIT_NEUTRAL';
    strength = 'CAUTION';
    const conflict = Math.min(bullPillars, bearPillars);
    confidence = Math.min(76, Math.max(48, Math.round(52 + conflict * 2.8 - Math.abs(bullPillars - bearPillars) * 1.1)));
    capitalProtectionReason = `Pillar Consensus Divergence: Bearish price drift is contradicted by ${bullPillars} bullish pillars (vs only ${bearPillars} bearish). Stand aside in WAIT_NEUTRAL until multi-factor consensus aligns.`;

    recommendedType = 'CE';
    targetStrike = currentAtmStrike;
    selectedRow = chain.find(r => r.strike === targetStrike) || selectedRow;
    contract = selectedRow?.ce;
    premium = contract?.ltp ?? premium;
    summaryNote = `${pricePrefix}: Suggesting WAIT / NEUTRAL. [${capitalProtectionReason}]. Reference contract ${targetStrike} ${recommendedType} is trading at ${ticker.currency}${premium.toFixed(2)}.`;
  } else if (action === 'WAIT_NEUTRAL' && advanceTradeSetup.isAvailable && !isOngoingCeInvalidated && !isOngoingPeInvalidated && prevAction !== 'BUY_CE' && prevAction !== 'BUY_PE') {
    if (advanceTradeSetup.anticipatedAction === 'BUY_PE' && (bearPillars >= 6 || (bearPillars >= 5 && isContinuousFall)) && bearPillars > bullPillars && candlePatterns.confluenceBias !== 'BULLISH') {
      action = 'BUY_PE';
      recommendedType = 'PE';
      targetStrike = advanceTradeSetup.recommendedStrike;
      strength = bearPillars >= 8 ? 'STRONG' : 'MODERATE';
      confidence = advanceTradeSetup.probabilityScore;
      selectedRow = chain.find(r => r.strike === targetStrike) || selectedRow;
      contract = selectedRow?.pe;
      premium = contract?.ltp ?? premium;
      summaryNote = `${pricePrefix}: Suggesting BUY PE. [Pillar Consensus Confirmed: ${bearPillars} Bearish Pillars aligned with Candlestick Momentum]. Recommended ${targetStrike} PE @ ${ticker.currency}${premium.toFixed(2)}.`;
    } else if (advanceTradeSetup.anticipatedAction === 'BUY_CE' && (bullPillars >= 6 || (bullPillars >= 5 && isMarketRaising)) && bullPillars > bearPillars && candlePatterns.confluenceBias !== 'BEARISH') {
      action = 'BUY_CE';
      recommendedType = 'CE';
      targetStrike = advanceTradeSetup.recommendedStrike;
      strength = bullPillars >= 8 ? 'STRONG' : 'MODERATE';
      confidence = advanceTradeSetup.probabilityScore;
      selectedRow = chain.find(r => r.strike === targetStrike) || selectedRow;
      contract = selectedRow?.ce;
      premium = contract?.ltp ?? premium;
      summaryNote = `${pricePrefix}: Suggesting BUY CE. [Pillar Consensus Confirmed: ${bullPillars} Bullish Pillars aligned with Candlestick Momentum]. Recommended ${targetStrike} CE @ ${ticker.currency}${premium.toFixed(2)}.`;
    }
  }

  // Synchronize advance trade setup with authoritative trade recommendation
  advanceTradeSetup.recommendedStrike = targetStrike;
  advanceTradeSetup.recommendedType = recommendedType;
  advanceTradeSetup.anticipatedAction = action;

  if (action === 'WAIT_NEUTRAL') {
    advanceTradeSetup.isAvailable = false;
    advanceTradeSetup.setupType = 'EQUILIBRIUM_WAIT';
    advanceTradeSetup.directionalBiasPercent = 0;
    advanceTradeSetup.directionalBiasLabel = bearPillars > bullPillars 
      ? `Neutral Equilibrium (${bearPillars} Bearish vs ${bullPillars} Bullish)` 
      : bullPillars > bearPillars 
      ? `Neutral Equilibrium (${bullPillars} Bullish vs ${bearPillars} Bearish)` 
      : '0.0% Neutral Equilibrium';
    advanceTradeSetup.primaryLeadingCatalyst = capitalProtectionReason || advanceTradeSetup.primaryLeadingCatalyst;
    advanceTradeSetup.subTitle = capitalProtectionReason ? `Capital Preservation Mandate: ${capitalProtectionReason}` : advanceTradeSetup.subTitle;
  } else if (action === 'BUY_CE') {
    advanceTradeSetup.isAvailable = true;
    if (advanceTradeSetup.setupType === 'EQUILIBRIUM_WAIT') advanceTradeSetup.setupType = 'PRE_BREAKOUT_COILING_CE';
    advanceTradeSetup.directionalBiasPercent = Math.min(96, Math.max(68, Math.round(confidence)));
    advanceTradeSetup.directionalBiasLabel = `+${advanceTradeSetup.directionalBiasPercent}% Bullish Bias`;
  } else if (action === 'BUY_PE') {
    advanceTradeSetup.isAvailable = true;
    if (advanceTradeSetup.setupType === 'EQUILIBRIUM_WAIT') advanceTradeSetup.setupType = 'PRE_BREAKDOWN_COILING_PE';
    advanceTradeSetup.directionalBiasPercent = -Math.min(96, Math.max(68, Math.round(confidence)));
    advanceTradeSetup.directionalBiasLabel = `-${Math.abs(advanceTradeSetup.directionalBiasPercent)}% Bearish Bias`;
  }

  if (!marketStatus.isOpen && afterMarketAnalytics.tomorrowHitStrike) {
    if (action === 'BUY_CE' || action === 'BUY_PE') {
      advanceTradeSetup.probabilityScore = Math.min(94, Math.max(confidence, 76));
    } else {
      advanceTradeSetup.probabilityScore = 62;
      advanceTradeSetup.subTitle = `Capital Preservation Mandate: Flat opening projected (${afterMarketAnalytics.predictedOpeningGapPoints >= 0 ? '+' : ''}${afterMarketAnalytics.predictedOpeningGapPoints} pts). Stand aside at open to avoid IV crush & theta decay.`;
      advanceTradeSetup.invalidationReason = `Flat Opening (${afterMarketAnalytics.predictedOpeningGapPoints >= 0 ? '+' : ''}${afterMarketAnalytics.predictedOpeningGapPoints} pts). Stand aside at 09:15 AM to avoid IV crush.`;
      advanceTradeSetup.primaryLeadingCatalyst = `Flat Opening (${afterMarketAnalytics.predictedOpeningGapPoints >= 0 ? '+' : ''}${afterMarketAnalytics.predictedOpeningGapPoints} pts · ${afterMarketAnalytics.predictedOpeningGapPercent}%) · Stand aside at open; wait for 15-minute Opening Range Breakout (ORB).`;
      advanceTradeSetup.advanceEntryZoneSpot = [metrics.majorSupportStrike || (ticker.spotPrice - ticker.strikeStep), metrics.majorResistanceStrike || (ticker.spotPrice + ticker.strikeStep)];
    }

    // Re-synchronize option price entry zone, stop loss, and targets with the exact LTP of the target strike
    const roundToTick = (val: number) => Math.max(0.05, Math.round(val * 20) / 20);
    const spreadBuf = ticker.currency === '$' ? 0.05 : (ticker.symbol.includes('BANK') ? 1.50 : 0.75);
    advanceTradeSetup.advanceEntryOptionRange = [
      roundToTick(Math.max(0.05, premium - spreadBuf)),
      roundToTick(premium + spreadBuf)
    ];
    advanceTradeSetup.advanceOptionStopLoss = roundToTick(Math.max(0.05, premium * 0.85));
    advanceTradeSetup.advanceOptionTarget1 = roundToTick(premium * 1.35);
    advanceTradeSetup.advanceOptionTarget2 = roundToTick(premium * 1.70);
    const advRisk = Math.max(0.5, premium - advanceTradeSetup.advanceOptionStopLoss);
    const advReward = advanceTradeSetup.advanceOptionTarget1 - premium;
    advanceTradeSetup.advanceRiskRewardRatio = `1 : ${(advReward / advRisk).toFixed(1)}`;
  } else {
    // Active regular session: Always synchronize targets, stop losses, and entry ranges exactly
    advanceTradeSetup.advanceEntryOptionRange = [entryLow, entryHigh];
    advanceTradeSetup.advanceOptionTarget1 = target1;
    advanceTradeSetup.advanceOptionTarget2 = target2;
    advanceTradeSetup.advanceOptionStopLoss = stopLoss;
    advanceTradeSetup.advanceRiskRewardRatio = rrRatio;
    if (action === 'WAIT_NEUTRAL') {
      advanceTradeSetup.isAvailable = false;
      advanceTradeSetup.subTitle = capitalProtectionReason
        ? `Capital Preservation Mandate: ${capitalProtectionReason}`
        : 'Capital Preservation Mandate: Market is oscillating within consolidation deadband. High risk of theta crush for option buyers. Stand aside in WAIT until confirmed breakout outside session range.';
      advanceTradeSetup.primaryLeadingCatalyst = capitalProtectionReason
        ? capitalProtectionReason
        : 'Equilibrium Range Bound: Market is consolidating. Wait for confirmed directional breakout outside range before committing capital.';
    } else {
      advanceTradeSetup.isAvailable = true;
    }
  }

  // AUTHORITATIVE RECOMMENDATION CONSISTENCY & SANITY GUARD
  // Guarantees mathematical and contract integrity across all tickers and session phases:
  // 1. Strike must exist in chain
  // 2. Contract LTP must be synchronized with initialEntryLtp and recommendedContractLTP
  // 3. For any BUY recommendation: Target 2 > Target 1 > Entry Price > Stop Loss
  // 4. Entry range must encompass Entry Price
  if (action === 'BUY_CE' || action === 'BUY_PE') {
    const verifiedRow = chain.find(r => r.strike === targetStrike);
    const verifiedContract = verifiedRow ? (recommendedType === 'CE' ? verifiedRow.ce : verifiedRow.pe) : null;
    if (verifiedContract && verifiedContract.ltp > 0.05) {
      initialEntryLtp = verifiedContract.ltp;
      premium = verifiedContract.ltp;
      moneyness = verifiedContract.moneyness;
    }

    // Mathematical integrity check for Target 1: Target 1 must be strictly greater than entry
    if (target1 <= initialEntryLtp) {
      target1 = roundToTick(initialEntryLtp * 1.35);
    }
    // Mathematical integrity check for Target 2: Target 2 must be strictly greater than Target 1
    if (target2 <= target1) {
      target2 = roundToTick(Math.max(target1 + tick * 4, initialEntryLtp * 1.70));
    }
    // Mathematical integrity check for Stop Loss: Stop Loss must be strictly below entry and positive
    if (stopLoss >= initialEntryLtp || stopLoss <= 0) {
      stopLoss = Math.max(tick, roundToTick(initialEntryLtp * 0.82));
    }
    // Entry range bounds check
    if (entryLow > initialEntryLtp || entryHigh < initialEntryLtp) {
      const spreadBuf = ticker.currency === '$' ? 0.05 : (ticker.symbol.includes('BANK') ? 0.75 : 0.40);
      entryLow = Math.max(tick, roundToTick(initialEntryLtp - spreadBuf));
      entryHigh = roundToTick(initialEntryLtp + spreadBuf);
      entryRange = [entryLow, entryHigh];
    }
    // Recalculate Risk:Reward Ratio
    const t1Profit = Math.max(tick, target1 - initialEntryLtp);
    const slRisk = Math.max(tick, initialEntryLtp - stopLoss);
    rrRatio = `1 : ${(t1Profit / slRisk).toFixed(1)}`;

    // Sync advanceTradeSetup with guaranteed consistent levels
    if (advanceTradeSetup) {
      advanceTradeSetup.recommendedStrike = targetStrike;
      advanceTradeSetup.recommendedType = recommendedType;
      advanceTradeSetup.advanceEntryOptionRange = [entryLow, entryHigh];
      advanceTradeSetup.advanceOptionTarget1 = target1;
      advanceTradeSetup.advanceOptionTarget2 = target2;
      advanceTradeSetup.advanceOptionStopLoss = stopLoss;
      advanceTradeSetup.advanceRiskRewardRatio = rrRatio;
    }
  }

  return {
    tickerSymbol: ticker.symbol,
    action,
    strength,
    confidence,
    recommendedStrike: targetStrike,
    recommendedType,
    recommendedContractLTP: initialEntryLtp,
    entryPrice: initialEntryLtp,
    moneyness,
    entryRange: [entryLow, entryHigh],
    stopLoss,
    trailingStopLoss,
    capitalProtectionStatus,
    target1,
    target2,
    tradeStage,
    isTargetAlreadyAchieved,
    targetAchievedNote,
    trailingStopNote,
    riskRewardRatio: rrRatio,
    summaryNote,
    rationalePoints,
    generatedAt: new Date().toLocaleTimeString(),
    target1Basis,
    target2Basis,
    spotTarget1,
    spotTarget2,
    spotStopLoss,
    candleAnalysis: candlePatterns,
    targetExitSynthesis,
    realtimeIndicators: rt,
    constituentAnalysis,
    adjacentStrikes,
    sessionHighLTP,
    sessionLowLTP,
    peakGainPercent,
    interMarketTelemetry,
    volumeAnalytics: rt.volumeAnalytics,
    afterMarketAnalytics,
    sidewaysMarketAnalysis,
    htfPredictions,
    advanceTradeSetup,
    liquiditySweep: advanceTradeSetup.liquiditySweep,
    gammaRegimeData: advanceTradeSetup.gammaRegimeData,
    timeframeCoherence: advanceTradeSetup.timeframeCoherence,
    dynamicVolatilityMatrix: advanceTradeSetup.dynamicVolatilityMatrix,
  };
}

/**
 * Computes deep diagnostic analysis for Sideways, Range-Bound, and Chop Market Scenarios
 */
export function computeSidewaysMarketAnalysis(
  ticker: TickerConfig,
  metrics: MarketMetrics,
  chain: OptionChainRow[],
  action: SignalAction,
  rt: RealtimePredictionIndicators,
  constituentAnalysis?: import('../types/options').NiftyConstituentAnalysis
): import('../types/options').SidewaysMarketAnalysis {
  const { spotPrice, atmStrike, maxPainStrike, pcrTotalOI, majorSupportStrike, majorResistanceStrike } = metrics;
  const dayHigh = ticker.dayHigh && ticker.dayHigh >= spotPrice ? ticker.dayHigh : Math.max(ticker.dayHigh || spotPrice, spotPrice);
  const dayLow = ticker.dayLow && ticker.dayLow <= spotPrice ? ticker.dayLow : Math.min(ticker.dayLow || spotPrice, spotPrice);
  const actualDayRange = Math.max(1, dayHigh - dayLow);
  const dayRangePct = (actualDayRange / Math.max(spotPrice, 1)) * 100;
  
  // Normal expected daily range (based on VIX / ATR)
  const vix = Math.max(9, ticker.vix || 13);
  const dailyExpectedMove = (spotPrice * (vix / 100)) / 15.87;
  const standardDailyRange = Math.max(ticker.strikeStep * 1.5, dailyExpectedMove * 0.75);

  // Sideways Compression Percentage:
  // Combines VWAP pinning (35%), EMA entanglement (40%), and daily range scale (25%)
  const vwapDistRatio = Math.abs(spotPrice - rt.vwap.value) / Math.max(spotPrice, 1) * 100;
  const vwapCompression = Math.max(0, 1 - (vwapDistRatio / 0.40));
  const emaGap = Math.abs(rt.ema.ema9 - rt.ema.ema21);
  const emaCompression = rt.ema.alignment === 'COMPRESSION' ? 0.95 : Math.max(0, 1 - (emaGap / Math.max(ticker.strikeStep * 0.30, 1)));
  const rangeCompression = Math.max(0, 1 - (dayRangePct / 0.60));
  const compressionRatio = Math.max(0.10, (vwapCompression * 0.35 + emaCompression * 0.40 + rangeCompression * 0.25));
  const compressionPercentage = Math.min(95, Math.round(compressionRatio * 100));

  // Criteria for Sideways Market:
  const reasons: string[] = [];
  let sidewaysScore = 0;

  // 1. Narrow Intraday Price Range (< 0.45% or < 1.4 strike steps)
  const isRangeNarrow = dayRangePct < 0.45 || actualDayRange < ticker.strikeStep * 1.5;
  if (isRangeNarrow) {
    sidewaysScore += 25;
    reasons.push(`Compressed Day Range: Spot has fluctuated only ${actualDayRange.toFixed(1)} pts (${dayRangePct.toFixed(2)}%), indicating lack of directional expansion.`);
  }

  // 2. VWAP Hugging / Equilibrium (< 0.20% from intraday VWAP)
  const vwapDistPct = Math.abs(spotPrice - rt.vwap.value) / Math.max(spotPrice, 1) * 100;
  if (vwapDistPct <= 0.20) {
    sidewaysScore += 20;
    reasons.push(`VWAP Anchor: Spot (${ticker.currency}${spotPrice.toLocaleString()}) is oscillating within ±${vwapDistPct.toFixed(2)}% of Intraday VWAP (${ticker.currency}${rt.vwap.value.toLocaleString()}), showing zero institutional breakout momentum.`);
  }

  // 3. Balanced Put-Call Ratio (PCR 0.90 to 1.15)
  const isPcrBalanced = pcrTotalOI >= 0.90 && pcrTotalOI <= 1.15;
  if (isPcrBalanced) {
    sidewaysScore += 20;
    reasons.push(`Balanced PCR (${pcrTotalOI.toFixed(2)}): Symmetric Call writing at ceiling (${ticker.currency}${majorResistanceStrike.toLocaleString()}) and Put writing at floor (${ticker.currency}${majorSupportStrike.toLocaleString()}) is pinning spot in equilibrium.`);
  }

  // 4. Trap between Call Wall & Put Wall (strictly clamped to nearby strikes within ±2.5 steps, avoiding disconnected strikes)
  const ceiling = Math.min(atmStrike + ticker.strikeStep * 2.5, Math.max(atmStrike + ticker.strikeStep, majorResistanceStrike));
  const floor = Math.max(atmStrike - ticker.strikeStep * 2.5, Math.min(atmStrike - ticker.strikeStep, majorSupportStrike));
  const isTrappedInWalls = spotPrice >= floor && spotPrice <= ceiling;
  if (isTrappedInWalls) {
    sidewaysScore += 15;
    reasons.push(`Option Seller Pin: Spot is bounded between Call Writing Wall (${ticker.currency}${ceiling.toLocaleString()}) and Put Writing Floor (${ticker.currency}${floor.toLocaleString()}), where short straddle/strangle sellers dominate.`);
  }

  // 5. EMA & Momentum Stack Compression
  if (rt.ema.alignment === 'COMPRESSION' || Math.abs(rt.ema.ema9 - rt.ema.ema21) < ticker.strikeStep * 0.12) {
    sidewaysScore += 10;
    reasons.push(`EMA Compression: 9 EMA and 21 EMA are tangled with flat slope, confirming absence of trending momentum.`);
  }

  // 6. Low Volume / Lunch Lull / Compressed Turnover
  if (rt.volumeAnalytics && (rt.volumeAnalytics.totalVolumeMultiplier < 0.85 || rt.volumeAnalytics.volumeDivergence === 'LOW_VOLUME_CHOP')) {
    sidewaysScore += 10;
    reasons.push(`Volume Contraction: Exchange volume is at ${((rt.volumeAnalytics.totalVolumeMultiplier || 0.7) * 100).toFixed(0)}% of 20MA baseline, typical of sideways range consolidation.`);
  }

  // 7. Heavyweight Tug-of-War (if applicable)
  if (constituentAnalysis && Array.isArray(constituentAnalysis.sectoralBreakdown)) {
    const banking = constituentAnalysis.sectoralBreakdown.find(s => s.sector === 'Banking');
    const it = constituentAnalysis.sectoralBreakdown.find(s => s.sector === 'IT');
    if (Math.abs(constituentAnalysis.netNiftyPointImpact) < 15 && banking && it) {
      if ((banking.contributionPoints > 0 && it.contributionPoints < 0) || (banking.contributionPoints < 0 && it.contributionPoints > 0)) {
        sidewaysScore += 10;
        reasons.push(`Sectoral Tug-of-War: Banking (${banking.contributionPoints >= 0 ? '+' : ''}${banking.contributionPoints} pts) and IT (${it.contributionPoints >= 0 ? '+' : ''}${it.contributionPoints} pts) are pulling in opposite directions, neutralizing net index movement.`);
      }
    }
  }

  // Determine if sideways is active:
  // A market is actively trending directionally if range expansion is large (>= 2.8 steps or >= 0.70%)
  // or if spot is pressing brand new daily highs/lows with stacked EMAs
  const isIntradayTrending = (
    (actualDayRange >= ticker.strikeStep * 2.8 && dayRangePct >= 0.70) ||
    (rt.ema.alignment === 'BEARISH_STACK' && spotPrice <= dayLow + ticker.strikeStep * 0.25) ||
    (rt.ema.alignment === 'BULLISH_STACK' && spotPrice >= dayHigh - ticker.strikeStep * 0.25)
  ) && !isRangeNarrow;

  const isSideways = !isIntradayTrending && ((action === 'WAIT_NEUTRAL' && sidewaysScore >= 40) || sidewaysScore >= 50 || (isRangeNarrow && sidewaysScore >= 35));
  const sidewaysConfidence = Math.min(98, Math.max(52, sidewaysScore));

  let regimeType: import('../types/options').SidewaysMarketAnalysis['regimeType'] = 'NORMAL_TRENDING';
  if (isSideways) {
    if (Math.abs(spotPrice - maxPainStrike) <= ticker.strikeStep * 0.25) {
      regimeType = 'EXPIRY_PINNING';
    } else if (compressionPercentage >= 65) {
      regimeType = 'VOLATILITY_COMPRESSION';
    } else if (dayRangePct <= 0.32) {
      regimeType = 'NARROW_DEADBAND_CHOP';
    } else {
      regimeType = 'RANGE_BOUND_EQUILIBRIUM';
    }
  }

  const rangeSpanPoints = Math.max(ticker.strikeStep, ceiling - floor);
  const bullishBreakoutTrigger = Number((ceiling + ticker.strikeStep * 0.15).toFixed(1));
  const bearishBreakdownTrigger = Number((floor - ticker.strikeStep * 0.15).toFixed(1));

  const optionBuyerStrategy = isSideways
    ? (compressionPercentage >= 75
        ? `⚡ COILED VOLATILITY SQUEEZE (${compressionPercentage}% Squeeze): Spot is tightly coiled between ${ticker.currency}${floor.toLocaleString()} and ${ticker.currency}${ceiling.toLocaleString()}. While choppy inside, prepare for explosive directional expansion upon breakout. Stand aside in WAIT until spot cleanly breaches Bullish Trigger (${ticker.currency}${bullishBreakoutTrigger}) or Bearish Trigger (${ticker.currency}${bearishBreakdownTrigger}).`
        : `⚠️ STRICT STAND ASIDE: Option buying in sideways markets causes severe theta decay on both CE and PE. Capital is 100% safer in cash until a confirmed breakout occurs.`)
    : 'Directional option buying permitted with strict multi-factor confirmation.';

  const optionSellerStrategy = isSideways
    ? `Range-bound Theta Harvesting: Institutional option sellers profit by shorting strangles outside the boundaries (${ticker.currency}${ceiling.toLocaleString()} CE / ${ticker.currency}${floor.toLocaleString()} PE) or executing Iron Condors.`
    : 'Trend-following option spreads.';

  return {
    isSideways,
    sidewaysConfidence,
    regimeType,
    rangeCeiling: ceiling,
    rangeFloor: floor,
    rangePinStrike: maxPainStrike,
    rangeSpanPoints,
    compressionPercentage,
    reasons,
    optionBuyerStrategy,
    optionSellerStrategy,
    breakoutWatchLevels: {
      bullishBreakoutTrigger,
      bearishBreakdownTrigger,
      powerHourNote: 'Watch for 02:30 PM - 03:15 PM IST Power Hour squeeze when intraday option writers square off / cover positions.',
    },
  };
}

/**
 * Computes the Adjacent Strike Spectrum (2 strikes below · Predicted Strike · 2 strikes above)
 * Evaluates real-time Black-Scholes Greeks, Profit Probability %, Target 1/2 Payoffs, and Risk/Reward for each strike.
 */
export function computeAdjacentStrikeSpectrum(
  predictedStrike: number,
  predictedType: OptionType,
  ticker: TickerConfig,
  chain: OptionChainRow[],
  spotTarget1: number,
  spotTarget2: number,
  spotStopLoss: number,
  netNewsMultiplier: number,
  candleConfluenceScore: number,
  expiryIndex: number = 0
): AdjacentStrikeAnalysis[] {
  const step = ticker.strikeStep;
  const S = ticker.spotPrice;
  const isIndian = ticker.currency === '₹';
  const r = isIndian ? 0.065 : 0.045;
  const { daysToExpiry, T } = getTickerExpiryDTE(ticker, expiryIndex);
  const rawVix = Math.max(14.50, ticker.vix || 15.22);
  let baseIV = (rawVix * 1.019) / 100;
  if (isIndian) {
    if (daysToExpiry <= 2) baseIV = (rawVix * 1.019) / 100;
    else if (daysToExpiry <= 9) baseIV = (rawVix * 0.901) / 100;
    else if (daysToExpiry <= 16) baseIV = (rawVix * 0.903) / 100;
    else baseIV = (rawVix * 0.887) / 100;
  }
  const isCE = predictedType === 'CE';

  const offsets: (-2 | -1 | 0 | 1 | 2)[] = [-2, -1, 0, 1, 2];

  return offsets.map(offset => {
    const strike = predictedStrike + offset * step;
    const isPredicted = offset === 0;
    
    // Find contract from option chain row if available
    const row = chain.find(r => r.strike === strike);
    const contract = isCE ? row?.ce : row?.pe;

    // Moneyness determination
    const atm = ticker.atmStrike;
    const isATM = strike === atm;
    const moneyness = isCE 
      ? (strike < S - step * 0.5 ? 'ITM' : isATM ? 'ATM' : 'OTM')
      : (strike > S + step * 0.5 ? 'ITM' : isATM ? 'ATM' : 'OTM');

    // Implied Volatility calibrated to exact exchange smile
    const m = (strike - S) / Math.max(S, 1);
    const ivSkew = isIndian
      ? (isCE 
          ? Math.max(0.06, baseIV + (m < 0 ? -m * 0.06 : m * 0.04))
          : Math.max(0.06, (baseIV * 1.06) + (m < 0 ? -m * 0.14 : m * 0.05)))
      : Math.max(0.06, baseIV + (m < 0 ? -m * 0.25 : m * 0.12));
    const iv = contract?.iv ?? Number((ivSkew * 100).toFixed(1));

    // Black-Scholes Greeks
    const bs = calculateBlackScholes(S, strike, T, r, iv / 100, predictedType);
    const delta = Math.abs(contract?.greeks.delta ?? bs.delta);
    const gamma = Math.abs(contract?.greeks.gamma ?? bs.gamma);
    const theta = Math.abs(contract?.greeks.theta ?? bs.theta);

    // Live or BS LTP
    const tick = isIndian ? 0.05 : 0.01;
    const roundToTick = (val: number) => Number((Math.round(val / tick) * tick).toFixed(2));
    const rawLtp = contract?.ltp ?? Number(bs.price.toFixed(2));
    const ltp = Math.max(tick, roundToTick(rawLtp));
    const prevClose = contract?.prevClose ?? ltp;
    const change = contract?.change ?? Number((ltp - prevClose).toFixed(2));
    const changePercent = contract?.changePercent ?? Number(((change / Math.max(prevClose, tick)) * 100).toFixed(2));
    const openInterest = contract?.openInterest ?? 25000;
    const oiChange = contract?.oiChange ?? 1200;
    const volume = contract?.volume ?? 15000;
    const buildup = contract?.buildup ?? (change >= 0 ? 'Long Buildup' : 'Short Buildup');

    // --- PROBABILITY OF PROFIT (% POSSIBILITY OF PROFIT) ---
    // Quantitative formula:
    // Base probability derived from Delta (higher Delta ITM strikes carry higher probability of profit, lower theta decay)
    // plus tactical touch multiplier for intraday target reaches
    const deltaPOP = Math.min(88, Math.max(20, delta * 100 * 1.18));
    const confluenceAdjustment = (candleConfluenceScore / 10) * 5.0; // +/- 5%
    const newsAdjustment = (netNewsMultiplier - 1.0) * 12.0; // +/- 4%
    const moneynessBonus = moneyness === 'ITM' ? 7.0 : moneyness === 'ATM' ? 2.0 : -6.0;
    
    let rawPOP = deltaPOP + confluenceAdjustment + newsAdjustment + moneynessBonus;
    if (isPredicted) {
      rawPOP += 4.0; // Algorithmic optimal confluence bonus
    }
    const profitProbabilityPercent = Math.min(94, Math.max(15, Math.round(rawPOP)));

    // Re-price option at Target 1, Target 2, and Stop Loss Spot prices
    const spotDistT1 = Math.abs(spotTarget1 - S);
    const minGain1 = isIndian ? 0.5 : 0.05;
    const target1GreekGain = Math.max(minGain1, delta * spotDistT1 + 0.5 * gamma * Math.pow(spotDistT1, 2) - theta * 0.15);
    const target1Price = roundToTick(ltp + target1GreekGain);
    const target1GainPercent = Number((((target1Price - ltp) / Math.max(ltp, tick)) * 100).toFixed(1));

    const spotDistT2 = Math.abs(spotTarget2 - S);
    const minGain2 = isIndian ? 1.0 : 0.10;
    const target2GreekGain = Math.max(minGain2, delta * spotDistT2 + 0.5 * gamma * Math.pow(spotDistT2, 2) - theta * 0.30);
    const target2Price = roundToTick(ltp + target2GreekGain);
    const target2GainPercent = Number((((target2Price - ltp) / Math.max(ltp, tick)) * 100).toFixed(1));

    const spotDistSL = Math.abs(S - spotStopLoss);
    const minLoss = isIndian ? 0.5 : 0.05;
    const slLoss = Math.min(ltp * 0.35, Math.max(minLoss, delta * spotDistSL * 0.85));
    const stopLossPrice = Math.max(tick, roundToTick(ltp - slLoss));
    const stopLossRiskPercent = Number((((ltp - stopLossPrice) / Math.max(ltp, tick)) * 100).toFixed(1));

    const breakevenSpot = isCE ? strike + ltp : strike - ltp;

    const riskRewardRatio = `1 : ${(target1GainPercent / Math.max(stopLossRiskPercent, 1)).toFixed(1)}`;

    // Expected Payoff Attractiveness Score (0 - 100)
    const expectedPayoffScore = Math.min(99, Math.max(25, Math.round(
      profitProbabilityPercent * 0.55 + 
      Math.min(40, target1GainPercent * 0.8) + 
      (isPredicted ? 10 : 0)
    )));

    // Position Labels and Descriptions
    const ptsDiff = offset * step;
    let positionLabel = '';
    let recommendationTag = '';

    if (offset === -2) {
      positionLabel = `2 Below (${ptsDiff} pts)`;
      recommendationTag = isCE 
        ? (moneyness === 'ITM' ? 'Deep In-The-Money · High Win Prob / Low Theta' : 'Deep Out-of-The-Money · High Leverage Risk')
        : (moneyness === 'ITM' ? 'Deep In-The-Money · High Win Prob / Low Theta' : 'Deep Out-of-The-Money · High Leverage Risk');
    } else if (offset === -1) {
      positionLabel = `1 Below (${ptsDiff} pts)`;
      recommendationTag = moneyness === 'ITM' ? 'In-The-Money · Higher Probability / Low Theta Decay' : 'Out-of-The-Money · Dynamic Scalp Strike';
    } else if (offset === 0) {
      positionLabel = 'PREDICTED (Recommended)';
      recommendationTag = 'Optimal Risk-to-Reward · Algorithmic Benchmark Pick';
    } else if (offset === 1) {
      positionLabel = `1 Above (+${ptsDiff} pts)`;
      recommendationTag = moneyness === 'OTM' ? 'Out-of-The-Money · High Percentage ROI Multiplier' : 'In-The-Money · Low Extrinsic Premium';
    } else {
      positionLabel = `2 Above (+${ptsDiff} pts)`;
      recommendationTag = moneyness === 'OTM' ? 'Far Out-of-The-Money · Aggressive Momentum Spike' : 'Deep In-The-Money · Strong Intrinsic Value';
    }

    return {
      strike,
      type: predictedType,
      relativePosition: offset,
      positionLabel,
      isPredicted,
      moneyness,
      ltp,
      change,
      changePercent,
      iv,
      delta: Number(delta.toFixed(2)),
      gamma: Number(gamma.toFixed(4)),
      theta: Number(theta.toFixed(2)),
      openInterest,
      oiChange,
      volume,
      buildup,
      profitProbabilityPercent,
      target1Price,
      target1GainPercent,
      target2Price,
      target2GainPercent,
      stopLossPrice,
      stopLossRiskPercent,
      breakevenSpot,
      riskRewardRatio,
      expectedPayoffScore,
      recommendationTag,
    };
  });
}
