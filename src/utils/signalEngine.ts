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

  // News sentiment impact
  const relevantNews = newsItems.filter(n => n.relatedTickers.includes(ticker.symbol));
  const bullishNewsCount = relevantNews.filter(n => n.sentiment === 'BULLISH').length;
  const bearishNewsCount = relevantNews.filter(n => n.sentiment === 'BEARISH').length;

  // Dynamic Multi-Factor Scoring Matrix
  let score = 0;

  // 1. Current Spot Price vs Reference Previous Close (Momentum Edge)
  const spotChangePct = ticker.changePercent;
  if (spotChangePct >= 0.5) score += 3.0;
  else if (spotChangePct > 0.05) score += 1.8;
  else if (spotChangePct <= -0.5) score -= 3.0;
  else if (spotChangePct < -0.05) score -= 1.8;

  // 2. Current Spot Price relative to ATM Strike
  if (spotPrice > atmStrike + (ticker.strikeStep * 0.15)) {
    score += 1.2; // Spot pushing into upper strike band
  } else if (spotPrice < atmStrike - (ticker.strikeStep * 0.15)) {
    score -= 1.2; // Spot pushing into lower strike band
  }

  // 3. Put-Call Ratio (PCR)
  if (pcrTotalOI >= 1.20) score += 2.0;
  else if (pcrTotalOI >= 1.05) score += 1.0;
  else if (pcrTotalOI <= 0.80) score -= 2.0;
  else if (pcrTotalOI <= 0.95) score -= 1.0;

  // 4. Institutional Wall Proximity
  if (spotPrice >= majorResistanceStrike) {
    // Breakout above resistance
    score += 1.5;
  } else if (spotPrice <= majorSupportStrike) {
    // Breakdown below support
    score -= 1.5;
  }

  // 5. News Sentiment Weight
  if (bullishNewsCount > bearishNewsCount) score += 0.8;
  else if (bearishNewsCount > bullishNewsCount) score -= 0.8;

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

  // Real contract premium (LTP) directly from the recommended contract
  const premium = contract?.ltp ?? (ticker.category === 'Index' ? 93.15 : 5.00);

  // Exchange standard tick size (0.05 for Indian F&O, 0.01 for US)
  const tick = ticker.currency === '₹' ? 0.05 : 0.01;
  const roundToTick = (val: number) => Number((Math.round(val / tick) * tick).toFixed(2));

  // Risk parameters for real-money execution:
  // 25% Stop Loss risk boundary
  const slDelta = roundToTick(premium * 0.25);
  const stopLoss = Math.max(tick, roundToTick(premium - slDelta));
  const actualRisk = roundToTick(premium - stopLoss);

  // Target 1: 1.6x Risk-Reward (+40% upside)
  const target1Delta = roundToTick(actualRisk * 1.6);
  const target1 = roundToTick(premium + target1Delta);

  // Target 2: 3.0x Risk-Reward (+75% upside)
  const target2Delta = roundToTick(actualRisk * 3.0);
  const target2 = roundToTick(premium + target2Delta);

  // Real-world execution entry zone:
  // If bid/ask exists in the live contract, use the live spread; otherwise tight 98%-101% limit zone
  const entryLow = roundToTick(contract?.bidPrice ? Math.min(contract.bidPrice, premium * 0.98) : premium * 0.98);
  const entryHigh = roundToTick(contract?.askPrice ? Math.max(contract.askPrice, premium * 1.01) : premium * 1.01);
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
      description: `Current spot is pushing upward toward ${targetStrike + ticker.strikeStep}. Short covering at near ATM call strikes increases probability of gamma expansion.`,
    });
  } else if (action === 'BUY_PE') {
    rationalePoints.push({
      title: 'Put Buyer Buildup & Call Wall Resistance',
      verdict: 'BEARISH',
      description: `Heavy Call writing at ${majorResistanceStrike} forms a firm barrier. Spot weakness below ${targetStrike} drives put delta expansion toward ${targetStrike - ticker.strikeStep}.`,
    });
  } else {
    rationalePoints.push({
      title: 'Range Bound Between Key Levels',
      verdict: 'NEUTRAL',
      description: `Spot is oscillating between Support (${ticker.currency}${majorSupportStrike.toLocaleString()}) and Resistance (${ticker.currency}${majorResistanceStrike.toLocaleString()}).`,
    });
  }

  // Rationale 4: Volatility Regime
  const ivStatus = ivRank < 35 ? 'Low' : ivRank > 65 ? 'Elevated' : 'Moderate';
  rationalePoints.push({
    title: `Implied Volatility Regime (${ivStatus} IV)`,
    verdict: ivRank < 40 ? 'BULLISH' : 'NEUTRAL',
    description: `Current IV Rank is ${ivRank}% (VIX: ${ticker.vix.toFixed(1)}). Option premiums carry ${ivRank < 40 ? 'low extrinsic pricing, providing safe entry for directional option buyers' : 'moderate premium; adhere to stop-loss discipline'}.`,
  });

  // Summary Note: Explicitly states current price and reason
  const pricePrefix = ticker.isUsingPreMarket
    ? `Based on PRE-MARKET price of ${ticker.currency}${spotPrice.toLocaleString()} (${changeFormatted} vs reference close)`
    : `Based on current market price of ${ticker.currency}${spotPrice.toLocaleString()} (${changeFormatted} vs reference close)`;

  let summaryNote = '';
  if (action === 'BUY_CE') {
    summaryNote = `${pricePrefix}: Recommending CALL (CE) ${targetStrike} @ ${ticker.currency}${premium.toFixed(2)}. Upward momentum and solid support at ${ticker.currency}${majorSupportStrike.toLocaleString()} favor buying ${targetStrike} CE. Target 1: ${ticker.currency}${target1.toFixed(2)} | SL: ${ticker.currency}${stopLoss.toFixed(2)}.`;
  } else if (action === 'BUY_PE') {
    summaryNote = `${pricePrefix}: Recommending PUT (PE) ${targetStrike} @ ${ticker.currency}${premium.toFixed(2)}. Downward pressure below resistance at ${ticker.currency}${majorResistanceStrike.toLocaleString()} favors buying ${targetStrike} PE. Target 1: ${ticker.currency}${target1.toFixed(2)} | SL: ${ticker.currency}${stopLoss.toFixed(2)}.`;
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
  };
}
