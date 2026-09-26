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
  const giftNiftyBias = giftNiftyNews.reduce((acc, n) => acc + (n.sentiment === 'BULLISH' ? 1.5 : n.sentiment === 'BEARISH' ? -1.5 : 0), 0);

  // Dynamic Multi-Factor Scoring Matrix including Macro, Gift Nifty, IV Rank & OI Buildup
  let score = 0;

  // 1. Current Spot Price vs Reference Previous Close (Momentum Edge)
  const spotChangePct = ticker.changePercent;
  if (spotChangePct >= 0.5) score += 2.5;
  else if (spotChangePct > 0.05) score += 1.5;
  else if (spotChangePct <= -0.5) score -= 2.5;
  else if (spotChangePct < -0.05) score -= 1.5;

  // 2. Gift Nifty / Global Macro Sentiment Weight
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

  // 6. General News Sentiment Weight
  if (bullishNewsCount > bearishNewsCount) score += 1.0;
  else if (bearishNewsCount > bullishNewsCount) score -= 1.0;

  // 7. Candlestick & Multi-Timeframe Chart Patterns Confluence (2m, 5m, 15m)
  const candlePatterns = computeMultiTimeframeChartPatterns(ticker);
  score += (candlePatterns.confluenceScore * 0.4);

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
  // If WAIT_NEUTRAL -> align with prevailing market trend (spotChangePct < 0 ? 'PE' : 'CE')
  const recommendedType: OptionType = action === 'BUY_PE' 
    ? 'PE' 
    : action === 'BUY_CE' 
      ? 'CE' 
      : (spotChangePct < 0 ? 'PE' : 'CE');

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

  const dayHigh = ticker.dayHigh && ticker.dayHigh > spotPrice ? ticker.dayHigh : spotPrice + step * 0.7;
  const dayLow = ticker.dayLow && ticker.dayLow < spotPrice ? ticker.dayLow : spotPrice - step * 0.7;
  const dayRange = Math.max(step, dayHigh - dayLow);
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
  let target1Basis = '';
  let target2Basis = '';

  const newsTargetAdjustment = isCE
    ? (newsSentimentFactor > 0 ? (newsSentimentFactor * step * 0.25) : -(Math.abs(newsSentimentFactor) * step * 0.15))
    : (newsSentimentFactor < 0 ? (Math.abs(newsSentimentFactor) * step * 0.25) : -(newsSentimentFactor * step * 0.15));

  if (isCE) {
    // BUY CALL:
    // Target 1: Blend 2m/5m pattern measured move with Call OI hurdle and News Momentum
    const chartTarget1 = candlePatterns.derivedExitLevel1;
    const hurdleDist = Math.max(step * 0.35, (immediateCallHurdle - spotPrice) * 0.85);
    const patternMove = Math.max(chartTarget1 - spotPrice, step * 0.35);
    const combinedMove = Math.min((patternMove * 0.55 + hurdleDist * 0.45) + newsTargetAdjustment, intradaySessionMove * 0.88);
    spotTarget1 = Number((spotPrice + Math.max(step * 0.35, combinedMove)).toFixed(2));
    target1Basis = `2m/5m ${candlePatterns.m5.pattern.replace(/5m\s*/, '')} + News (Spot ${ticker.currency}${spotTarget1.toLocaleString()})`;

    // Target 2: Blend 15m range expansion measured move with Major Call Wall
    const chartTarget2 = candlePatterns.derivedExitLevel2;
    const runnerCandidate = Math.max(spotTarget1 + step * 0.5, (chartTarget2 * 0.55 + majorCallWall * 0.45));
    const maxCeiling = spotPrice + dailyExpectedMove * 0.85;
    spotTarget2 = Number(Math.min(runnerCandidate, maxCeiling).toFixed(2));
    target2Basis = `15m ${candlePatterns.m15.pattern.replace(/15m\s*/, '')} & Call Wall @ ${ticker.currency}${majorCallWall.toLocaleString()}`;

  } else {
    // BUY PUT:
    // Target 1: Blend 2m/5m pattern measured move with Put OI support and News Momentum
    const chartTarget1 = candlePatterns.derivedExitLevel1;
    const hurdleDist = Math.max(step * 0.35, (spotPrice - immediatePutSupport) * 0.85);
    const patternMove = Math.max(spotPrice - chartTarget1, step * 0.35);
    const combinedMove = Math.min((patternMove * 0.55 + hurdleDist * 0.45) + newsTargetAdjustment, intradaySessionMove * 0.88);
    spotTarget1 = Number((spotPrice - Math.max(step * 0.35, combinedMove)).toFixed(2));
    target1Basis = `2m/5m ${candlePatterns.m5.pattern.replace(/5m\s*/, '')} + News (Spot ${ticker.currency}${spotTarget1.toLocaleString()})`;

    // Target 2: Blend 15m range expansion measured move with Major Put Wall
    const chartTarget2 = candlePatterns.derivedExitLevel2;
    const runnerCandidate = Math.min(spotTarget1 - step * 0.5, (chartTarget2 * 0.55 + majorPutWall * 0.45));
    const minFloor = spotPrice - dailyExpectedMove * 0.85;
    spotTarget2 = Number(Math.max(runnerCandidate, minFloor).toFixed(2));
    target2Basis = `15m ${candlePatterns.m15.pattern.replace(/15m\s*/, '')} & Put Wall @ ${ticker.currency}${majorPutWall.toLocaleString()}`;
  }

  // --- 5. DERIVE REALISTIC OPTION PREMIUMS VIA BLACK-SCHOLES GREEKS ---
  const delta = contract ? Math.abs(contract.greeks.delta) : 0.50;
  const gamma = contract ? Math.abs(contract.greeks.gamma) : 0.0018;
  const theta = contract ? Math.abs(contract.greeks.theta) : (premium * 0.06);

  const deltaSpot1 = Math.abs(spotTarget1 - spotPrice);
  const deltaSpot2 = Math.abs(spotTarget2 - spotPrice);

  // Greek Taylor expansion with typical 2hr / 4hr holding theta erosion
  const intradayTheta1 = theta * (2 / 6.25);
  const intradayTheta2 = theta * (4 / 6.25);

  const deltaExpansion1 = delta * deltaSpot1;
  const gammaAcceleration1 = 0.5 * gamma * Math.pow(deltaSpot1, 2);
  const rawDeltaP1 = deltaExpansion1 + gammaAcceleration1 - intradayTheta1;
  const rawDeltaP2 = (delta * deltaSpot2) + (0.5 * gamma * Math.pow(deltaSpot2, 2)) - intradayTheta2;

  // Realistic bounds calibrated to professional intraday options trading:
  // Target 1: +18% to +30% gain on entry premium (safe tactical exit)
  const minT1Gain = premium * 0.18;
  const maxT1Gain = premium * 0.30;
  const target1Delta = roundToTick(Math.max(minT1Gain, Math.min(maxT1Gain, rawDeltaP1)));
  const target1 = roundToTick(premium + target1Delta);

  // Target 2: +35% to +55% gain on entry premium (extended runner target)
  const minT2Gain = Math.max(target1Delta * 1.35, premium * 0.35);
  const maxT2Gain = premium * 0.55;
  const target2Delta = roundToTick(Math.max(minT2Gain, Math.min(maxT2Gain, rawDeltaP2)));
  const target2 = roundToTick(premium + target2Delta);

  // Stop Loss: derived from 2m/5m candlestick pattern invalidation level
  const candleInvalidationMove = isCE
    ? Math.max(step * 0.25, spotPrice - candlePatterns.invalidationLevel)
    : Math.max(step * 0.25, candlePatterns.invalidationLevel - spotPrice);
  const invalidationSpotMove = Math.min(step * 0.45, candleInvalidationMove);
  const rawSlDelta = delta * invalidationSpotMove;
  
  // Prudent risk limit: 14% to 18% risk on premium
  const minSlRisk = premium * 0.14;
  const maxSlRisk = premium * 0.18;
  const slDelta = roundToTick(Math.max(minSlRisk, Math.min(maxSlRisk, rawSlDelta)));
  const stopLoss = Math.max(tick, roundToTick(premium - slDelta));
  const actualRisk = roundToTick(premium - stopLoss);

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

  // Rationale 1: Current Market Spot Level & Direction
  const changeFormatted = `${spotChangePct >= 0 ? '+' : ''}${spotChangePct.toFixed(2)}%`;
  if (spotChangePct >= 0.05) {
    rationalePoints.push({
      title: 'Current Market Spot Momentum',
      verdict: 'BULLISH',
      description: `Current spot (${ticker.currency}${spotPrice.toLocaleString()}) is trading ${changeFormatted} above reference close (${ticker.currency}${ticker.prevClose.toLocaleString()}). Positive delta momentum favors Call (CE) buying.`,
    });
  } else if (spotChangePct <= -0.05) {
    rationalePoints.push({
      title: 'Current Market Spot Momentum',
      verdict: 'BEARISH',
      description: `Current spot (${ticker.currency}${spotPrice.toLocaleString()}) is trading ${changeFormatted} below reference close (${ticker.currency}${ticker.prevClose.toLocaleString()}). Downward price action and lower high formation favor Put (PE) buying.`,
    });
  } else {
    rationalePoints.push({
      title: 'Current Market Spot Equilibrium',
      verdict: 'NEUTRAL',
      description: `Current spot (${ticker.currency}${spotPrice.toLocaleString()}) is flat around reference level (${changeFormatted}). Spot is consolidating near ATM strike ${targetStrike}.`,
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
      title: 'Call Open Interest Absorption',
      verdict: 'BULLISH',
      description: `Target 1 (${ticker.currency}${target1.toFixed(2)}) is derived from spot push toward ${ticker.currency}${spotTarget1.toLocaleString()} (${target1Basis}). Runner Target 2 (${ticker.currency}${target2.toFixed(2)}) targets Call Wall @ ${ticker.currency}${majorCallWall.toLocaleString()}.`,
    });
  } else if (action === 'BUY_PE') {
    rationalePoints.push({
      title: 'Put Buyer Buildup & Call Wall Resistance',
      verdict: 'BEARISH',
      description: `Target 1 (${ticker.currency}${target1.toFixed(2)}) is derived from spot descent toward ${ticker.currency}${spotTarget1.toLocaleString()} (${target1Basis}). Runner Target 2 (${ticker.currency}${target2.toFixed(2)}) targets Put Wall @ ${ticker.currency}${majorPutWall.toLocaleString()}.`,
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
    title: 'Exit Targets Derivation Architecture',
    verdict: action === 'BUY_CE' ? 'BULLISH' : action === 'BUY_PE' ? 'BEARISH' : 'NEUTRAL',
    description: `Targets are algorithmically computed using: 1. Option Chart OI Walls (T1 Spot: ${ticker.currency}${spotTarget1.toLocaleString()} | T2 Spot: ${ticker.currency}${spotTarget2.toLocaleString()}), 2. Multi-Timeframe Candlestick Patterns (2m & 5m measured move + 15m range extension), and 3. Macro/News Sentiment (${newsSentimentFactor >= 0 ? '+' : ''}${(newsSentimentFactor * 100).toFixed(0)}% bias). Option exits translated via Delta (${delta.toFixed(2)}) and Gamma.`,
  });

  // Summary Note: Explicitly states current price and reason
  const pricePrefix = ticker.isUsingPreMarket
    ? `Based on PRE-MARKET price of ${ticker.currency}${spotPrice.toLocaleString()} (${changeFormatted} vs reference close)`
    : `Based on current market price of ${ticker.currency}${spotPrice.toLocaleString()} (${changeFormatted} vs reference close)`;

  let summaryNote = '';
  if (action === 'BUY_CE') {
    summaryNote = `${pricePrefix}: Recommending CALL (CE) ${targetStrike} @ ${ticker.currency}${premium.toFixed(2)}. Target 1: ${ticker.currency}${target1.toFixed(2)} (+${((target1Delta / premium) * 100).toFixed(1)}% at spot ${ticker.currency}${spotTarget1.toLocaleString()}) | Target 2: ${ticker.currency}${target2.toFixed(2)} (+${((target2Delta / premium) * 100).toFixed(1)}% at ${target2Basis}) | SL: ${ticker.currency}${stopLoss.toFixed(2)} (-${((slDelta / premium) * 100).toFixed(1)}%). Derived via 2m/5m/15m candlestick patterns & OI hurdles.`;
  } else if (action === 'BUY_PE') {
    summaryNote = `${pricePrefix}: Recommending PUT (PE) ${targetStrike} @ ${ticker.currency}${premium.toFixed(2)}. Target 1: ${ticker.currency}${target1.toFixed(2)} (+${((target1Delta / premium) * 100).toFixed(1)}% at spot ${ticker.currency}${spotTarget1.toLocaleString()}) | Target 2: ${ticker.currency}${target2.toFixed(2)} (+${((target2Delta / premium) * 100).toFixed(1)}% at ${target2Basis}) | SL: ${ticker.currency}${stopLoss.toFixed(2)} (-${((slDelta / premium) * 100).toFixed(1)}%). Derived via 2m/5m/15m candlestick patterns & OI hurdles.`;
  } else {
    summaryNote = `${pricePrefix}: Suggesting WAIT / NEUTRAL. Market is consolidating between support (${ticker.currency}${majorSupportStrike.toLocaleString()}) and resistance (${ticker.currency}${majorResistanceStrike.toLocaleString()}). Reference contract ${targetStrike} ${recommendedType} is trading at ${ticker.currency}${premium.toFixed(2)}.`;
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
    candleAnalysis: candlePatterns,
    targetExitSynthesis,
  };
}
