import { 
  TickerConfig, 
  OptionChainRow, 
  MarketMetrics, 
  TradeSignal, 
  SignalAction, 
  SignalStrength, 
  Moneyness, 
  NewsItem,
  OptionType 
} from '../types/options';
import { computeMultiTimeframeChartPatterns } from './candlestickEngine';
import { calculateBlackScholes } from './blackScholes';

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

  return {
    spotPrice: ticker.spotPrice,
    atmStrike: ticker.atmStrike,
    maxPainStrike,
    pcrTotalOI,
    pcrVolume,
    totalCeOI,
    totalPeOI,
    majorSupportStrike: maxPeStrike,
    majorResistanceStrike: maxCeStrike,
    ivRank,
    marketTrend,
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
  newsItems: NewsItem[]
): TradeSignal {
  const { spotPrice, atmStrike, pcrTotalOI, majorSupportStrike, majorResistanceStrike, maxPainStrike, ivRank } = metrics;
  
  // Nearby strikes around current spot
  const nearbyRows = chain.filter(r => Math.abs(r.strike - atmStrike) <= ticker.strikeStep * 3);
  let nearbyCeOIChg = 0;
  let nearbyPeOIChg = 0;

  for (const r of nearbyRows) {
    nearbyCeOIChg += r.ce.oiChange;
    nearbyPeOIChg += r.pe.oiChange;
  }

  // Global News, Gift Nifty & Macro Sentiment impact
  const relevantNews = newsItems.filter(n => n.relatedTickers.includes(ticker.symbol) || n.category === 'Macro' || n.category === 'Geopolitics');
  const giftNiftyNews = relevantNews.filter(n => n.title.toLowerCase().includes('gift nifty') || n.title.toLowerCase().includes('sgx') || n.title.toLowerCase().includes('global') || n.title.toLowerCase().includes('wall street'));
  const bullishNewsCount = relevantNews.filter(n => n.sentiment === 'BULLISH').length;
  const bearishNewsCount = relevantNews.filter(n => n.sentiment === 'BEARISH').length;
  const rawGiftNiftyBias = giftNiftyNews.reduce((acc, n) => acc + (n.sentiment === 'BULLISH' ? 1.0 : n.sentiment === 'BEARISH' ? -1.0 : 0), 0);
  const giftNiftyBias = Math.max(-1.5, Math.min(1.5, rawGiftNiftyBias));

  // Dynamic Multi-Factor Scoring Matrix including Macro, Gift Nifty, IV Rank & OI Buildup
  let score = 0;

  // 1a. Daily Reference Trend (vs Previous Close)
  const spotChangePct = ticker.changePercent;
  let prevCloseTrendScore = 0;
  if (spotChangePct >= 0.5) prevCloseTrendScore = 1.5;
  else if (spotChangePct > 0.05) prevCloseTrendScore = 0.8;
  else if (spotChangePct <= -0.5) prevCloseTrendScore = -1.5;
  else if (spotChangePct < -0.05) prevCloseTrendScore = -0.8;

  // 1b. Intraday Price Action: Recovery from Day Low vs Breakdown from Day High
  const dayHigh = ticker.dayHigh && ticker.dayHigh > spotPrice ? ticker.dayHigh : spotPrice + ticker.strikeStep * 0.7;
  const dayLow = ticker.dayLow && ticker.dayLow < spotPrice ? ticker.dayLow : spotPrice - ticker.strikeStep * 0.7;
  const dayRange = Math.max(ticker.strikeStep * 0.5, dayHigh - dayLow);
  const recoveryRatio = (spotPrice - dayLow) / dayRange; // 0 = at low, 1.0 = at high
  const recoveryPoints = Math.max(0, spotPrice - dayLow);

  let intradayRecoveryScore = 0;
  if (recoveryRatio >= 0.65 || recoveryPoints >= ticker.strikeStep * 0.75) {
    // Strong intraday recovery: buyers / short coverers lifting index off lows
    intradayRecoveryScore = 2.5;
  } else if (recoveryRatio >= 0.50 || recoveryPoints >= ticker.strikeStep * 0.4) {
    // Moderate recovery: trading above day midpoint
    intradayRecoveryScore = 1.2;
  } else if (recoveryRatio <= 0.20) {
    // Sticking to day low / breakdown
    intradayRecoveryScore = -2.2;
  } else if (recoveryRatio <= 0.35) {
    intradayRecoveryScore = -1.0;
  }

  // Combined Price Action: Intraday recovery carries 65% weight, Daily previous close reference carries 35% weight
  const combinedPriceScore = Number((prevCloseTrendScore * 0.35 + intradayRecoveryScore * 0.65).toFixed(2));
  score += combinedPriceScore;

  // 2. Gift Nifty / Global Macro Sentiment Weight (Clamped)
  score += giftNiftyBias;

  // 3. Current Spot Price relative to ATM Strike & Max Pain
  if (spotPrice > atmStrike + (ticker.strikeStep * 0.15)) {
    score += 1.2;
  } else if (spotPrice < atmStrike - (ticker.strikeStep * 0.15)) {
    score -= 1.2;
  }

  if (spotPrice < maxPainStrike - (ticker.strikeStep * 0.5)) {
    score += 0.8;
  } else if (spotPrice > maxPainStrike + (ticker.strikeStep * 0.5)) {
    score -= 0.8;
  }

  // 4. Put-Call Ratio (PCR) & OI Buildup Velocity
  if (pcrTotalOI >= 1.25) score += 2.0;
  else if (pcrTotalOI >= 1.05) score += 1.0;
  else if (pcrTotalOI <= 0.78) score -= 2.0;
  else if (pcrTotalOI <= 0.95) score -= 1.0;

  if (nearbyPeOIChg > nearbyCeOIChg * 1.2) score += 1.2;
  else if (nearbyCeOIChg > nearbyPeOIChg * 1.2) score -= 1.2;

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
  const candlePatterns = computeMultiTimeframeChartPatterns(ticker);
  score += (candlePatterns.confluenceScore * 0.4);

  // =========================================================================
  // CAPITAL PROTECTION & QUANT GUARD RAILS (Prevent False Trades & Traps)
  // =========================================================================
  let capitalProtectionReason = '';

  // GUARD RAIL 1: Intraday Recovery Protection (Do not buy PE into an active bounce off day low)
  if ((recoveryRatio >= 0.50 || recoveryPoints >= ticker.strikeStep * 0.4) && score < 0) {
    if (candlePatterns.confluenceBias === 'BULLISH' && candlePatterns.confluenceScore >= 2.5) {
      score = Math.max(score, 2.2); // Trigger BUY_CE for short-covering continuation
    } else {
      score = Math.max(score, -1.0); // Suppress BUY_PE; shift to WAIT_NEUTRAL
      capitalProtectionReason = `Capital Protection: Market is in an active intraday recovery (+${ticker.currency}${recoveryPoints.toFixed(1)} off day low). Chasing puts into a short-covering bounce is high risk; wait for resistance test.`;
    }
  }

  // GUARD RAIL 2: Extreme PCR Reversal Trap (Do not short oversold extremes / do not buy calls at overbought peaks)
  if (pcrTotalOI <= 0.65 && score < 0) {
    score = Math.max(score, -1.0); // Invalidate BUY_PE
    capitalProtectionReason = `Capital Protection: PCR is deeply oversold at ${pcrTotalOI.toFixed(2)} (<0.65). Extreme short-covering squeeze risk; avoid buying puts at climax lows.`;
  } else if (pcrTotalOI >= 1.50 && score > 0) {
    score = Math.min(score, 1.0); // Invalidate BUY_CE
    capitalProtectionReason = `Capital Protection: PCR is heavily overbought at ${pcrTotalOI.toFixed(2)} (>1.50). High risk of Call writing wall rejections and institutional profit-taking.`;
  }

  // GUARD RAIL 3: Overhead Call Wall / Support Put Wall Proximity Trap
  const distToCallWall = majorResistanceStrike - spotPrice;
  if (score >= 2.0 && distToCallWall > 0 && distToCallWall <= ticker.strikeStep * 0.30) {
    score = 1.0; // Downgrade to WAIT_NEUTRAL
    capitalProtectionReason = `Capital Protection: Spot (${ticker.currency}${spotPrice.toLocaleString()}) is within ${distToCallWall.toFixed(1)} pts of Major Call Wall (${ticker.currency}${majorResistanceStrike.toLocaleString()}). Chasing CE right under heavy institutional call writers has poor risk-reward; wait for breakout.`;
  }

  const distToPutWall = spotPrice - majorSupportStrike;
  if (score <= -2.0 && distToPutWall > 0 && distToPutWall <= ticker.strikeStep * 0.30) {
    score = -1.0; // Downgrade to WAIT_NEUTRAL
    capitalProtectionReason = `Capital Protection: Spot (${ticker.currency}${spotPrice.toLocaleString()}) is within ${distToPutWall.toFixed(1)} pts of Major Put Wall (${ticker.currency}${majorSupportStrike.toLocaleString()}). Chasing PE right onto heavy institutional put writing floor risks sudden relief bounces.`;
  }

  // GUARD RAIL 4: Day High / Day Low Exhaustion Trap
  if (score >= 2.0 && (dayHigh - spotPrice) <= ticker.strikeStep * 0.15 && recoveryRatio >= 0.92) {
    score = 1.0; // Downgrade to WAIT_NEUTRAL
    capitalProtectionReason = `Capital Protection: Spot is trading at session day high (${ticker.currency}${dayHigh.toLocaleString()}). Avoid FOMO buying at the peak of the daily range.`;
  }
  if (score <= -2.0 && (spotPrice - dayLow) <= ticker.strikeStep * 0.15 && recoveryRatio <= 0.08) {
    score = -1.0; // Downgrade to WAIT_NEUTRAL
    capitalProtectionReason = `Capital Protection: Spot is trading at session day low (${ticker.currency}${dayLow.toLocaleString()}). Avoid breakdown selling into the absolute floor.`;
  }

  // Action Decision
  let action: SignalAction = 'WAIT_NEUTRAL';
  let strength: SignalStrength = 'MODERATE';
  let confidence = 50;

  if (score >= 2.0) {
    action = 'BUY_CE';
    confidence = Math.min(94, Math.round(62 + Math.abs(score) * 4));
    strength = score >= 4.0 ? 'STRONG' : 'MODERATE';
  } else if (score <= -2.0) {
    action = 'BUY_PE';
    confidence = Math.min(94, Math.round(62 + Math.abs(score) * 4));
    strength = Math.abs(score) >= 4.0 ? 'STRONG' : 'MODERATE';
  } else {
    action = 'WAIT_NEUTRAL';
    confidence = 52;
    strength = 'CAUTION';
  }

  // Determine recommended contract type:
  // If BUY_CE -> 'CE'
  // If BUY_PE -> 'PE'
  // If WAIT_NEUTRAL -> align with prevailing intraday recovery direction
  const recommendedType: OptionType = action === 'BUY_PE' 
    ? 'PE' 
    : action === 'BUY_CE' 
      ? 'CE' 
      : (recoveryRatio >= 0.50 ? 'CE' : (spotChangePct < 0 ? 'PE' : 'CE'));

  // Select target strike:
  // Standard recommended strike for directional retail option buying is ATM
  let targetStrike = atmStrike;
  let moneyness: Moneyness = 'ATM';

  let selectedRow = chain.find(r => r.strike === targetStrike);
  if (!selectedRow && chain.length > 0) {
    selectedRow = chain[Math.floor(chain.length / 2)];
    targetStrike = selectedRow.strike;
  }

  // Extract the exact contract from the option chain row
  const contract = recommendedType === 'CE' ? selectedRow?.ce : selectedRow?.pe;
  if (contract) {
    moneyness = contract.moneyness;
  }

  // Real contract premium (LTP) directly from the recommended contract in the live chain
  const premium = contract?.ltp ?? 50.00;

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
  const vix = Math.max(9, ticker.vix || 13);
  // Daily Expected Move based on VIX: Spot * (VIX / 100) / sqrt(252)
  const dailyExpectedMove = spotPrice * (vix / 100) / 15.87;
  const intradaySessionMove = Math.max(step * 0.45, dailyExpectedMove * 0.40);

  const isNearDayHigh = (dayHigh - spotPrice) <= step * 0.4;
  const isNearDayLow = (spotPrice - dayLow) <= step * 0.4;

  // --- 3. LIVE & LAST NIGHT (OVERNIGHT) NEWS SYNTHESIS ---
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
  if (giftNiftyBias > 0) {
    newsSentimentFactor = Math.min(1, newsSentimentFactor + 0.20);
  } else if (giftNiftyBias < 0) {
    newsSentimentFactor = Math.max(-1, newsSentimentFactor - 0.20);
  }

  const topOvernightHeadline = overnightNews[0]?.title || 'Overnight Global Markets Balanced';
  const topLiveHeadline = liveNews[0]?.title || 'Live Intraday Flow Stable';

  // --- 4. DERIVE REALISTIC TARGET SPOT PRICES ---
  // Synthesizes 4 Quantitative Pillars:
  // 1. Multi-Timeframe Candlestick (2m, 5m, 15m)
  // 2. Live & Overnight News Momentum
  // 3. Previous Multi-Session Trend & Day Range
  // 4. Option Chart OI Walls & Max Pain
  let spotTarget1 = spotPrice;
  let spotTarget2 = spotPrice;
  let spotStopLoss = spotPrice;
  let target1Basis = '';
  let target2Basis = '';

  const newsTargetAdjustment = isCE
    ? (newsSentimentFactor > 0 ? (newsSentimentFactor * dailyExpectedMove * 0.05) : -(Math.abs(newsSentimentFactor) * dailyExpectedMove * 0.03))
    : (newsSentimentFactor < 0 ? (Math.abs(newsSentimentFactor) * dailyExpectedMove * 0.05) : -(newsSentimentFactor * dailyExpectedMove * 0.03));

  // Volatility & ATR based technical bounds
  const minMove1 = Math.max(step * 0.40, dailyExpectedMove * 0.16);
  const maxMove1 = Math.max(step * 1.00, dailyExpectedMove * 0.30);
  const minMove2 = Math.max(minMove1 + step * 0.35, dailyExpectedMove * 0.36);
  const maxMove2 = Math.max(minMove2 + step * 0.70, dailyExpectedMove * 0.60);
  const minSL = Math.max(step * 0.25, dailyExpectedMove * 0.10);
  const maxSL = Math.max(step * 0.55, dailyExpectedMove * 0.18);

  if (isCE) {
    // BUY CALL:
    // Target 1: Tactical swing move based on 2m/5m pattern and immediate Call OI hurdle
    const chartTarget1 = candlePatterns.derivedExitLevel1;
    const hurdleDist = Math.max(minMove1, Math.min(maxMove1, (immediateCallHurdle - spotPrice) * 0.85));
    const patternMove = Math.max(minMove1, Math.min(maxMove1, chartTarget1 - spotPrice));
    const rawSpotMove1 = (patternMove * 0.55 + hurdleDist * 0.45) + newsTargetAdjustment;
    const spotMove1 = Number(Math.max(minMove1, Math.min(maxMove1, rawSpotMove1)).toFixed(2));
    spotTarget1 = Number((spotPrice + spotMove1).toFixed(2));
    target1Basis = `2m/5m ${candlePatterns.m5.pattern.replace(/5m\s*/, '')} Hurdle (Spot ${ticker.currency}${spotTarget1.toLocaleString()})`;

    // Target 2: Extended runner move based on 15m structure and secondary hurdle
    const chartTarget2 = candlePatterns.derivedExitLevel2;
    const patternMove2 = Math.max(spotMove1 + step * 0.35, Math.min(maxMove2, chartTarget2 - spotPrice));
    const hurdleDist2 = Math.max(spotMove1 + step * 0.30, Math.min(maxMove2, (majorCallWall - spotPrice) * 0.40));
    const rawSpotMove2 = Math.max(spotMove1 + step * 0.35, (patternMove2 * 0.65 + hurdleDist2 * 0.35));
    const spotMove2 = Number(Math.max(minMove2, Math.min(maxMove2, rawSpotMove2)).toFixed(2));
    spotTarget2 = Number((spotPrice + spotMove2).toFixed(2));
    target2Basis = `15m ${candlePatterns.m15.pattern.replace(/15m\s*/, '')} Extension (Spot ${ticker.currency}${spotTarget2.toLocaleString()})`;

    // Spot Stop Loss: below 2m/5m swing low
    const rawSLDist = Math.max(minSL, Math.min(maxSL, spotPrice - candlePatterns.invalidationLevel));
    spotStopLoss = Number((spotPrice - rawSLDist).toFixed(2));

  } else {
    // BUY PUT:
    // Target 1: Tactical swing move based on 2m/5m pattern and immediate Put OI support
    const chartTarget1 = candlePatterns.derivedExitLevel1;
    const hurdleDist = Math.max(minMove1, Math.min(maxMove1, (spotPrice - immediatePutSupport) * 0.85));
    const patternMove = Math.max(minMove1, Math.min(maxMove1, spotPrice - chartTarget1));
    const rawSpotMove1 = (patternMove * 0.55 + hurdleDist * 0.45) + newsTargetAdjustment;
    const spotMove1 = Number(Math.max(minMove1, Math.min(maxMove1, rawSpotMove1)).toFixed(2));
    spotTarget1 = Number((spotPrice - spotMove1).toFixed(2));
    target1Basis = `2m/5m ${candlePatterns.m5.pattern.replace(/5m\s*/, '')} Support (Spot ${ticker.currency}${spotTarget1.toLocaleString()})`;

    // Target 2: Extended runner move based on 15m structure and secondary floor
    const chartTarget2 = candlePatterns.derivedExitLevel2;
    const patternMove2 = Math.max(spotMove1 + step * 0.35, Math.min(maxMove2, spotPrice - chartTarget2));
    const hurdleDist2 = Math.max(spotMove1 + step * 0.30, Math.min(maxMove2, (spotPrice - majorPutWall) * 0.40));
    const rawSpotMove2 = Math.max(spotMove1 + step * 0.35, (patternMove2 * 0.65 + hurdleDist2 * 0.35));
    const spotMove2 = Number(Math.max(minMove2, Math.min(maxMove2, rawSpotMove2)).toFixed(2));
    spotTarget2 = Number((spotPrice - spotMove2).toFixed(2));
    target2Basis = `15m ${candlePatterns.m15.pattern.replace(/15m\s*/, '')} Extension (Spot ${ticker.currency}${spotTarget2.toLocaleString()})`;

    // Spot Stop Loss: above 2m/5m swing high
    const rawSLDist = Math.max(minSL, Math.min(maxSL, candlePatterns.invalidationLevel - spotPrice));
    spotStopLoss = Number((spotPrice + rawSLDist).toFixed(2));
  }

  // --- 5. CALIBRATED REAL-WORLD OPTION TARGETS VIA ANCHORED BLACK-SCHOLES & GREEKS ---
  // Evaluates relative delta shifts anchored to actual live market LTP (premium),
  // ensuring the option targets are 100% mathematically faithful to the spot price movements.
  const isIndian = ticker.currency === '₹';
  const r = isIndian ? 0.065 : 0.045;
  const T = isIndian ? Math.max(0.004, 2.4 / 252) : Math.max(0.005, 5 / 365);
  const ivDecimal = Math.max(0.05, Math.min(0.95, (contract?.iv || (isIndian ? 11.5 : 18.0)) / 100));

  // Current theoretical price baseline at current spot
  const bsCurrent = calculateBlackScholes(spotPrice, targetStrike, T, r, ivDecimal, recommendedType);

  // Greeks for UI synthesis & sensitivity
  const delta = contract ? Math.abs(contract.greeks.delta) : 0.50;
  const gamma = contract ? Math.abs(contract.greeks.gamma) : 0.0018;
  const theta = contract ? Math.abs(contract.greeks.theta) : (premium * 0.05);

  // 1. Target 1 Option Price: Direct, authentic payoff at spotTarget1
  const deltaSpot1 = Math.abs(spotTarget1 - spotPrice);
  const T_target1 = Math.max(0.0001, T - (1.0 / (252 * 6.25)));
  const bsTarget1 = calculateBlackScholes(spotTarget1, targetStrike, T_target1, r, ivDecimal, recommendedType);
  const bsDeltaGain1 = Math.max(tick * 2, bsTarget1.price - bsCurrent.price);
  const deltaExpansion1 = delta * deltaSpot1;
  const gammaAcceleration1 = 0.5 * gamma * Math.pow(deltaSpot1, 2);
  const intradayTheta1 = theta * 0.12;
  const greekGain1 = Math.max(tick * 2, deltaExpansion1 + gammaAcceleration1 - intradayTheta1);
  const estGain1 = bsDeltaGain1 * 0.50 + greekGain1 * 0.50;
  const target1 = roundToTick(premium + estGain1);
  const target1Delta = roundToTick(Math.max(tick, target1 - premium));

  // 2. Target 2 Option Price: Direct, authentic payoff at spotTarget2
  const deltaSpot2 = Math.abs(spotTarget2 - spotPrice);
  const T_target2 = Math.max(0.0001, T - (2.5 / (252 * 6.25)));
  const bsTarget2 = calculateBlackScholes(spotTarget2, targetStrike, T_target2, r, ivDecimal, recommendedType);
  const bsDeltaGain2 = Math.max(target1Delta + tick * 2, bsTarget2.price - bsCurrent.price);
  const intradayTheta2 = theta * 0.25;
  const greekGain2 = Math.max(target1Delta + tick * 2, delta * deltaSpot2 + 0.5 * gamma * Math.pow(deltaSpot2, 2) - intradayTheta2);
  const estGain2 = bsDeltaGain2 * 0.50 + greekGain2 * 0.50;
  const target2 = roundToTick(premium + Math.max(target1Delta + tick * 4, estGain2));
  const target2Delta = roundToTick(Math.max(tick * 2, target2 - premium));

  // 3. Stop Loss Option Price: Technical invalidation at spotStopLoss
  const deltaSpotSL = Math.abs(spotStopLoss - spotPrice);
  const T_sl = Math.max(0.0001, T - (0.5 / (252 * 6.25)));
  const bsSL = calculateBlackScholes(spotStopLoss, targetStrike, T_sl, r, ivDecimal, recommendedType);
  const bsLoss = Math.max(tick, bsCurrent.price - bsSL.price);
  const intradayThetaSL = theta * 0.06;
  const greekLoss = Math.max(tick, delta * deltaSpotSL - 0.5 * gamma * Math.pow(deltaSpotSL, 2) + intradayThetaSL);
  const estLoss = bsLoss * 0.50 + greekLoss * 0.50;
  const stopLoss = Math.max(tick, roundToTick(premium - estLoss));
  const actualRisk = roundToTick(Math.max(tick, premium - stopLoss));


  // Build 4-Pillar Target Exit Synthesis Model
  const targetExitSynthesis = {
    candlestickPillar: {
      confluencePattern: candlePatterns.confluencePattern,
      confluenceScore: candlePatterns.confluenceScore,
      m2Pattern: candlePatterns.m2.pattern,
      m5Pattern: candlePatterns.m5.pattern,
      m15Pattern: candlePatterns.m15.pattern,
      swingTarget1: candlePatterns.derivedExitLevel1,
      swingTarget2: candlePatterns.derivedExitLevel2,
    },
    newsPillar: {
      overnightSentiment: (overnightScore > 0 ? 'BULLISH' : overnightScore < 0 ? 'BEARISH' : 'NEUTRAL') as 'BULLISH' | 'BEARISH' | 'NEUTRAL',
      overnightHeadline: topOvernightHeadline,
      liveSentiment: (liveScore > 0 ? 'BULLISH' : liveScore < 0 ? 'BEARISH' : 'NEUTRAL') as 'BULLISH' | 'BEARISH' | 'NEUTRAL',
      liveHeadline: topLiveHeadline,
      netNewsBiasScore: Number((newsSentimentFactor * 10).toFixed(1)),
      newsTargetImpact: `${newsTargetAdjustment >= 0 ? '+' : ''}${newsTargetAdjustment.toFixed(1)} pts spot momentum adjustment`,
    },
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
  const halfSpread = ticker.currency === '₹' ? (ticker.symbol.includes('BANK') ? 0.75 : 0.40) : 0.05;
  const entryLow = Math.max(tick, roundToTick(Math.min(premium - halfSpread, premium * 0.985)));
  const entryHigh = roundToTick(Math.max(premium + halfSpread, premium * 1.015));
  const rrRatio = `1 : ${(target1Delta / Math.max(actualRisk, tick)).toFixed(1)}`;

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
      description: `Current spot (${ticker.currency}${spotPrice.toLocaleString()}) is trading ${changeFormatted} above reference close (${ticker.currency}${ticker.prevClose.toLocaleString()}). Positive delta momentum favors Call (CE) buying.`,
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
    description: `Confluence: ${candlePatterns.confluencePattern}. 2m Pattern: ${candlePatterns.m2.pattern} | 5m Pattern: ${candlePatterns.m5.pattern} (ATR: ${ticker.currency}${candlePatterns.m5.atr}) | 15m Structure: ${candlePatterns.m15.pattern}. Score: ${candlePatterns.confluenceScore > 0 ? '+' : ''}${candlePatterns.confluenceScore}/10. Targets derived from 2m/5m measured moves & 15m range expansion.`,
  });

  // Rationale 5: Exit Targets Derivation Architecture
  rationalePoints.push({
    title: 'Calibrated Exit Targets Derivation Architecture',
    verdict: action === 'BUY_CE' ? 'BULLISH' : action === 'BUY_PE' ? 'BEARISH' : 'NEUTRAL',
    description: `Targets are algorithmically anchored to live market premium (${ticker.currency}${premium.toFixed(2)}): 1. Tactical Target 1 (+${((target1Delta / premium) * 100).toFixed(1)}%) captures 2m/5m measured move to spot ${ticker.currency}${spotTarget1.toLocaleString()}. 2. Runner Target 2 (+${((target2Delta / premium) * 100).toFixed(1)}%) captures 15m trend extension to spot ${ticker.currency}${spotTarget2.toLocaleString()}. 3. Stop Loss (-${((actualRisk / premium) * 100).toFixed(1)}%) guards against invalidation at spot ${ticker.currency}${spotStopLoss.toLocaleString()}. Pricing synthesized via anchored Black-Scholes Delta (${delta.toFixed(2)}) & Gamma to eliminate unrealistic overshoots.`,
  });

  // Add Capital Protection point if activated
  if (capitalProtectionReason) {
    rationalePoints.unshift({
      title: 'Institutional Capital Protection Filter',
      verdict: 'NEUTRAL',
      description: capitalProtectionReason,
    });
  }

  // Summary Note: Explicitly states current price and reason
  const pricePrefix = ticker.isUsingPreMarket
    ? `Based on PRE-MARKET price of ${ticker.currency}${spotPrice.toLocaleString()} (${changeFormatted} vs reference close)`
    : `Based on current market price of ${ticker.currency}${spotPrice.toLocaleString()} (${changeFormatted} vs reference close)`;

  let summaryNote = '';
  if (action === 'BUY_CE') {
    summaryNote = `${pricePrefix}: Recommending CALL (CE) ${targetStrike} @ ${ticker.currency}${premium.toFixed(2)}. Target 1: ${ticker.currency}${target1.toFixed(2)} (+${((target1Delta / premium) * 100).toFixed(1)}% at spot ${ticker.currency}${spotTarget1.toLocaleString()}) | Target 2: ${ticker.currency}${target2.toFixed(2)} (+${((target2Delta / premium) * 100).toFixed(1)}% at ${target2Basis}) | SL: ${ticker.currency}${stopLoss.toFixed(2)} (-${((actualRisk / premium) * 100).toFixed(1)}% at spot ${ticker.currency}${spotStopLoss.toLocaleString()}). Derived via 2m/5m/15m candlestick patterns & OI hurdles.`;
  } else if (action === 'BUY_PE') {
    summaryNote = `${pricePrefix}: Recommending PUT (PE) ${targetStrike} @ ${ticker.currency}${premium.toFixed(2)}. Target 1: ${ticker.currency}${target1.toFixed(2)} (+${((target1Delta / premium) * 100).toFixed(1)}% at spot ${ticker.currency}${spotTarget1.toLocaleString()}) | Target 2: ${ticker.currency}${target2.toFixed(2)} (+${((target2Delta / premium) * 100).toFixed(1)}% at ${target2Basis}) | SL: ${ticker.currency}${stopLoss.toFixed(2)} (-${((actualRisk / premium) * 100).toFixed(1)}% at spot ${ticker.currency}${spotStopLoss.toLocaleString()}). Derived via 2m/5m/15m candlestick patterns & OI hurdles.`;
  } else {
    summaryNote = capitalProtectionReason
      ? `${pricePrefix}: Suggesting WAIT / NEUTRAL. [${capitalProtectionReason}]. Reference contract ${targetStrike} ${recommendedType} is trading at ${ticker.currency}${premium.toFixed(2)}.`
      : `${pricePrefix}: Suggesting WAIT / NEUTRAL. Market is consolidating between support (${ticker.currency}${majorSupportStrike.toLocaleString()}) and resistance (${ticker.currency}${majorResistanceStrike.toLocaleString()}). Reference contract ${targetStrike} ${recommendedType} is trading at ${ticker.currency}${premium.toFixed(2)}.`;
  }

  return {
    action,
    strength,
    confidence,
    recommendedStrike: targetStrike,
    recommendedType,
    recommendedContractLTP: premium,
    moneyness,
    entryRange: [entryLow, entryHigh],
    stopLoss,
    target1,
    target2,
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
  };
}
