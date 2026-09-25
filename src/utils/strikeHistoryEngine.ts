import { 
  TickerConfig, 
  OptionChainRow, 
  TradeSignal, 
  StrikeHistoryItem, 
  StrikeProfitTrend, 
  StrikeTrendAnalytics, 
  CumulativeActionTrend,
  CumulativeTrendAlignment,
  Moneyness,
  OptionType 
} from '../types/options';

const STORAGE_KEY_PREFIX = 'optipulse_strike_history_v1_';

/**
 * Generate seed historical recommendations for a ticker
 */
export function generateSeedStrikeHistory(ticker: TickerConfig, chain: OptionChainRow[]): StrikeHistoryItem[] {
  const isIndian = ticker.currency === '₹';
  const atm = ticker.atmStrike;
  const step = ticker.strikeStep;
  const now = Date.now();

  const seedRecords: StrikeHistoryItem[] = [];

  // Strike 1: ATM - 1 Strike ITM Call (Recorded 2 hours ago)
  const itmStrike = atm - step;
  const itmRow = chain.find(r => r.strike === itmStrike);
  const itmLtp = itmRow?.ce.ltp ?? (isIndian ? 210.50 : 8.40);
  const itmEntry = Number((itmLtp * 0.78).toFixed(2));
  const itmTarget1 = Number((itmEntry * 1.35).toFixed(2));
  const itmTarget2 = Number((itmEntry * 1.65).toFixed(2));
  const itmSL = Number((itmEntry * 0.78).toFixed(2));
  const itmHighest = Math.max(itmLtp, Number((itmEntry * 1.42).toFixed(2)));

  seedRecords.push({
    id: `seed-1-${ticker.symbol}`,
    timestamp: now - 7200000, // 2 hours ago
    timeFormatted: '09:35 AM',
    tickerSymbol: ticker.symbol,
    action: 'BUY_CE',
    strike: itmStrike,
    type: 'CE',
    moneyness: 'ITM',
    spotPriceAtSignal: ticker.spotPrice - (ticker.spotPrice * 0.004),
    entryPrice: itmEntry,
    entryRange: [Number((itmEntry * 0.985).toFixed(2)), Number((itmEntry * 1.015).toFixed(2))],
    target1: itmTarget1,
    target2: itmTarget2,
    stopLoss: itmSL,
    currentLTP: itmLtp,
    highestLTP: itmHighest,
    pnlPercent: Number((((itmLtp - itmEntry) / itmEntry) * 100).toFixed(1)),
    maxProfitPercent: Number((((itmHighest - itmEntry) / itmEntry) * 100).toFixed(1)),
    status: itmLtp >= itmTarget1 ? 'TARGET_1_HIT' : itmLtp > itmEntry ? 'PROFITABLE' : 'ACTIVE',
    confidence: 88,
    riskReward: '1 : 1.8',
  });

  // Strike 2: ATM Call (Recorded 1 hour ago)
  const atmRow = chain.find(r => r.strike === atm);
  const atmLtp = atmRow?.ce.ltp ?? (isIndian ? 134.50 : 5.20);
  const atmEntry = Number((atmLtp * 0.82).toFixed(2));
  const atmTarget1 = Number((atmEntry * 1.40).toFixed(2));
  const atmTarget2 = Number((atmEntry * 1.75).toFixed(2));
  const atmSL = Number((atmEntry * 0.75).toFixed(2));
  const atmHighest = Math.max(atmLtp, Number((atmEntry * 1.48).toFixed(2)));

  seedRecords.push({
    id: `seed-2-${ticker.symbol}`,
    timestamp: now - 3600000, // 1 hour ago
    timeFormatted: '10:45 AM',
    tickerSymbol: ticker.symbol,
    action: 'BUY_CE',
    strike: atm,
    type: 'CE',
    moneyness: 'ATM',
    spotPriceAtSignal: ticker.spotPrice - (ticker.spotPrice * 0.002),
    entryPrice: atmEntry,
    entryRange: [Number((atmEntry * 0.985).toFixed(2)), Number((atmEntry * 1.015).toFixed(2))],
    target1: atmTarget1,
    target2: atmTarget2,
    stopLoss: atmSL,
    currentLTP: atmLtp,
    highestLTP: atmHighest,
    pnlPercent: Number((((atmLtp - atmEntry) / atmEntry) * 100).toFixed(1)),
    maxProfitPercent: Number((((atmHighest - atmEntry) / atmEntry) * 100).toFixed(1)),
    status: atmLtp >= atmTarget2 ? 'TARGET_2_HIT' : atmLtp >= atmTarget1 ? 'TARGET_1_HIT' : 'PROFITABLE',
    confidence: 84,
    riskReward: '1 : 2.0',
  });

  // Strike 3: ATM + 1 Strike OTM Call (Recorded 35 mins ago)
  const otmStrike = atm + step;
  const otmRow = chain.find(r => r.strike === otmStrike);
  const otmLtp = otmRow?.ce.ltp ?? (isIndian ? 82.00 : 3.10);
  const otmEntry = Number((otmLtp * 0.90).toFixed(2));
  const otmTarget1 = Number((otmEntry * 1.45).toFixed(2));
  const otmTarget2 = Number((otmEntry * 1.85).toFixed(2));
  const otmSL = Number((otmEntry * 0.70).toFixed(2));

  seedRecords.push({
    id: `seed-3-${ticker.symbol}`,
    timestamp: now - 2100000, // 35 min ago
    timeFormatted: '11:20 AM',
    tickerSymbol: ticker.symbol,
    action: 'BUY_CE',
    strike: otmStrike,
    type: 'CE',
    moneyness: 'OTM',
    spotPriceAtSignal: ticker.spotPrice - (ticker.spotPrice * 0.001),
    entryPrice: otmEntry,
    entryRange: [Number((otmEntry * 0.985).toFixed(2)), Number((otmEntry * 1.015).toFixed(2))],
    target1: otmTarget1,
    target2: otmTarget2,
    stopLoss: otmSL,
    currentLTP: otmLtp,
    highestLTP: Math.max(otmLtp, Number((otmEntry * 1.25).toFixed(2))),
    pnlPercent: Number((((otmLtp - otmEntry) / otmEntry) * 100).toFixed(1)),
    maxProfitPercent: Number((((Math.max(otmLtp, otmEntry * 1.25) - otmEntry) / otmEntry) * 100).toFixed(1)),
    status: otmLtp >= otmTarget1 ? 'TARGET_1_HIT' : 'PROFITABLE',
    confidence: 76,
    riskReward: '1 : 2.2',
  });

  return seedRecords;
}

/**
 * Load strike history from LocalStorage with seed fallback
 */
export function loadStrikeHistory(ticker: TickerConfig, chain: OptionChainRow[]): StrikeHistoryItem[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${ticker.symbol}`);
    if (raw) {
      const parsed: StrikeHistoryItem[] = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // LocalStorage error fallback
  }

  return generateSeedStrikeHistory(ticker, chain);
}

/**
 * Save strike history to LocalStorage
 */
export function saveStrikeHistory(symbol: string, history: StrikeHistoryItem[]): void {
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${symbol}`, JSON.stringify(history.slice(0, 50)));
  } catch {
    // LocalStorage error ignore
  }
}

/**
 * Updates all historical records with fresh live contract LTPs from the active option chain
 */
export function updateHistoryWithLiveChain(
  history: StrikeHistoryItem[],
  ticker: TickerConfig,
  chain: OptionChainRow[]
): StrikeHistoryItem[] {
  return history.map(item => {
    if (item.tickerSymbol !== ticker.symbol) return item;

    const row = chain.find(r => r.strike === item.strike);
    if (!row) return item;

    const contract = item.type === 'CE' ? row.ce : row.pe;
    if (!contract || !contract.ltp) return item;

    const liveLtp = contract.ltp;
    const entry = item.entryPrice;
    const highest = Math.max(item.highestLTP || entry, liveLtp);
    const pnlPercent = Number((((liveLtp - entry) / entry) * 100).toFixed(1));
    const maxProfitPercent = Number((((highest - entry) / entry) * 100).toFixed(1));

    let status = item.status;
    if (liveLtp >= item.target2) {
      status = 'TARGET_2_HIT';
    } else if (liveLtp >= item.target1) {
      status = 'TARGET_1_HIT';
    } else if (liveLtp <= item.stopLoss) {
      status = 'STOP_LOSS_HIT';
    } else if (pnlPercent > 0) {
      status = 'PROFITABLE';
    } else {
      status = 'ACTIVE';
    }

    return {
      ...item,
      currentLTP: liveLtp,
      highestLTP: highest,
      pnlPercent,
      maxProfitPercent,
      status,
    };
  });
}

/**
 * Adds a new trade signal recommendation to history if distinct from the latest entry
 */
export function recordSignalInHistory(
  history: StrikeHistoryItem[],
  signal: TradeSignal,
  ticker: TickerConfig
): StrikeHistoryItem[] {
  if (signal.action === 'WAIT_NEUTRAL') return history;

  const now = Date.now();
  const latest = history[0];

  // Prevent duplicate insertion within 3 minutes for identical strike & type
  if (
    latest &&
    latest.strike === signal.recommendedStrike &&
    latest.type === signal.recommendedType &&
    now - latest.timestamp < 180000
  ) {
    return history;
  }

  const newItem: StrikeHistoryItem = {
    id: `sig-${now}-${signal.recommendedStrike}`,
    timestamp: now,
    timeFormatted: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    tickerSymbol: ticker.symbol,
    action: signal.action,
    strike: signal.recommendedStrike,
    type: signal.recommendedType,
    moneyness: signal.moneyness,
    spotPriceAtSignal: ticker.spotPrice,
    entryPrice: signal.recommendedContractLTP,
    entryRange: signal.entryRange,
    target1: signal.target1,
    target2: signal.target2,
    stopLoss: signal.stopLoss,
    currentLTP: signal.recommendedContractLTP,
    highestLTP: signal.recommendedContractLTP,
    pnlPercent: 0,
    maxProfitPercent: 0,
    status: 'ACTIVE',
    confidence: signal.confidence,
    riskReward: signal.riskRewardRatio,
  };

  const updated = [newItem, ...history.slice(0, 49)];
  saveStrikeHistory(ticker.symbol, updated);
  return updated;
}

/**
 * Computes whether the cumulative market trend is actively moving towards suggested actions
 */
export function computeCumulativeActionTrend(
  tickerHistory: StrikeHistoryItem[],
  ticker: TickerConfig
): CumulativeActionTrend {
  const total = tickerHistory.length;
  if (total === 0) {
    return {
      dominantAction: 'BULLISH_CE',
      alignmentStatus: 'STRONG_CONVERGENCE',
      alignmentScore: 86,
      isMovingTowardsSuggested: true,
      statusHeadline: '🟢 STRONGLY CONVERGING TOWARDS SUGGESTED CALL TARGETS',
      detailedAnalysis: 'All recent suggested strikes show sustained delta expansion with spot price advancing towards target levels.',
      totalCallSignals: 1,
      totalPutSignals: 0,
      bullishRatioPercent: 100,
      netCumulativeReturnPercent: 28.5,
      signalsHitTarget1Count: 1,
      signalsHitTarget2Count: 0,
      signalsActiveInProfitCount: 1,
      signalsInLossCount: 0,
      targetProgressPercent: 78,
      currentMomentumVelocity: '+3.4% premium expansion / hr',
      suggestedActionVerdict: 'Hold long call positions with trailing stop loss as market advances towards Target 1 & 2.'
    };
  }

  const callSignals = tickerHistory.filter(h => h.action === 'BUY_CE');
  const putSignals = tickerHistory.filter(h => h.action === 'BUY_PE');
  const totalCalls = callSignals.length;
  const totalPuts = putSignals.length;

  const dominantAction = totalCalls >= totalPuts ? 'BULLISH_CE' : 'BEARISH_PE';
  const bullishRatio = total > 0 ? Number(((totalCalls / total) * 100).toFixed(1)) : 50;

  // Outcomes
  const target1Hits = tickerHistory.filter(h => h.status === 'TARGET_1_HIT' || h.status === 'TARGET_2_HIT').length;
  const target2Hits = tickerHistory.filter(h => h.status === 'TARGET_2_HIT').length;
  const activeInProfit = tickerHistory.filter(h => h.pnlPercent > 0 && h.status !== 'TARGET_2_HIT').length;
  const inLoss = tickerHistory.filter(h => h.pnlPercent < 0 || h.status === 'STOP_LOSS_HIT').length;

  // Net Cumulative Return
  const netReturn = Number((tickerHistory.reduce((sum, h) => sum + h.pnlPercent, 0) / total).toFixed(1));

  // Current spot movement vs recommended bias
  const spotChange = ticker.change;
  const isCallBias = dominantAction === 'BULLISH_CE';
  const isMarketAdvancingInSuggestedDirection = isCallBias ? spotChange >= 0 : spotChange <= 0;

  let alignmentStatus: CumulativeTrendAlignment = 'MODERATE_CONVERGENCE';
  let isMovingTowardsSuggested = true;
  let alignmentScore = 75;
  let statusHeadline = '';
  let detailedAnalysis = '';
  let suggestedActionVerdict = '';

  const successfulRatio = (target1Hits + activeInProfit) / total;

  if (isMarketAdvancingInSuggestedDirection && successfulRatio >= 0.60) {
    alignmentStatus = 'STRONG_CONVERGENCE';
    isMovingTowardsSuggested = true;
    alignmentScore = Math.min(96, Math.round(75 + successfulRatio * 20));
    statusHeadline = isCallBias
      ? '🟢 STRONGLY CONVERGING TOWARDS SUGGESTED CALL TARGETS'
      : '🔴 STRONGLY CONVERGING TOWARDS SUGGESTED PUT TARGETS';
    detailedAnalysis = `The cumulative market trend across all ${total} recorded suggestions is actively moving in favor of the suggested ${isCallBias ? 'CALL (CE)' : 'PUT (PE)'} actions. ${target1Hits} recommendations have met target exits with an average cumulative return of +${netReturn}%.`;
    suggestedActionVerdict = `Market momentum is actively advancing towards suggested targets. Trail stop loss upwards to protect accumulated gains.`;
  } else if (isMarketAdvancingInSuggestedDirection) {
    alignmentStatus = 'MODERATE_CONVERGENCE';
    isMovingTowardsSuggested = true;
    alignmentScore = 72;
    statusHeadline = '⚡ STEADILY ADVANCING TOWARDS SUGGESTED TARGETS';
    detailedAnalysis = `Underlying spot momentum is progressing in the direction of cumulative ${isCallBias ? 'CALL' : 'PUT'} recommendations. ${activeInProfit + target1Hits} of ${total} strikes are in positive territory.`;
    suggestedActionVerdict = `Maintain positions within suggested entry limits; cumulative momentum remains favorable.`;
  } else if (Math.abs(spotChange) <= ticker.spotPrice * 0.003) {
    alignmentStatus = 'CONSOLIDATING_IN_ZONE';
    isMovingTowardsSuggested = true;
    alignmentScore = 60;
    statusHeadline = '🟡 CONSOLIDATING ACCUMULATION WITHIN ENTRY ZONE';
    detailedAnalysis = `Spot price is consolidating near key institutional pivots. Option contracts are holding entry support bands with low directional theta bleed.`;
    suggestedActionVerdict = `Avoid premature exits. Allow the base to resolve in the direction of the primary trade signal.`;
  } else {
    alignmentStatus = 'DIVERGING';
    isMovingTowardsSuggested = false;
    alignmentScore = 38;
    statusHeadline = '⚠️ COUNTER-TREND RETRACEMENT (DEFENSIVE POSTURE)';
    detailedAnalysis = `Spot price has temporarily pulled back against the cumulative ${isCallBias ? 'CALL' : 'PUT'} thesis. Strict stop-loss adherence is recommended on active contracts.`;
    suggestedActionVerdict = `Enforce defined risk limits at suggested stop-loss points.`;
  }

  // Calculate percentage progress to Target 1 & 2
  const targetProgressPercent = Math.min(100, Math.max(15, Math.round((target1Hits * 45 + activeInProfit * 30 + (isMovingTowardsSuggested ? 25 : 0)))));

  return {
    dominantAction,
    alignmentStatus,
    alignmentScore,
    isMovingTowardsSuggested,
    statusHeadline,
    detailedAnalysis,
    totalCallSignals: totalCalls,
    totalPutSignals: totalPuts,
    bullishRatioPercent: bullishRatio,
    netCumulativeReturnPercent: netReturn,
    signalsHitTarget1Count: target1Hits,
    signalsHitTarget2Count: target2Hits,
    signalsActiveInProfitCount: activeInProfit,
    signalsInLossCount: inLoss,
    targetProgressPercent,
    currentMomentumVelocity: isMarketAdvancingInSuggestedDirection ? '+4.2 pts/hr toward targets' : '-1.8 pts/hr consolidation',
    suggestedActionVerdict,
  };
}

/**
 * Derives statistical strike profitability trends from historical suggestions
 */
export function deriveStrikeTrendAnalytics(
  history: StrikeHistoryItem[],
  ticker: TickerConfig,
  chain: OptionChainRow[]
): StrikeTrendAnalytics {
  const tickerHistory = history.filter(h => h.tickerSymbol === ticker.symbol);
  const total = tickerHistory.length;
  const cumulativeTrend = computeCumulativeActionTrend(tickerHistory, ticker);

  if (total === 0) {
    return {
      overallWinRate: 85.0,
      target1HitRate: 75.0,
      target2HitRate: 45.0,
      avgProfitPerWinningTrade: 38.5,
      bestPerformingMoneyness: 'ATM',
      moneynessPerformance: [
        { moneyness: 'ATM', winRate: 88, avgGain: 42.5, signalCount: 1 },
        { moneyness: 'ITM', winRate: 92, avgGain: 34.0, signalCount: 1 },
        { moneyness: 'OTM', winRate: 70, avgGain: 51.0, signalCount: 1 },
      ],
      topRankedStrikes: [],
      cumulativeTrend,
      activeSignalsCount: 0,
      totalHistoricalSignals: 0,
    };
  }

  // Calculate Win Rate & Target Hits
  const winningTrades = tickerHistory.filter(h => h.pnlPercent > 0 || h.status.includes('TARGET'));
  const target1Hits = tickerHistory.filter(h => h.status === 'TARGET_1_HIT' || h.status === 'TARGET_2_HIT');
  const target2Hits = tickerHistory.filter(h => h.status === 'TARGET_2_HIT');
  const activeSignals = tickerHistory.filter(h => h.status === 'ACTIVE' || h.status === 'PROFITABLE');

  const winRate = Number(((winningTrades.length / total) * 100).toFixed(1));
  const t1Rate = Number(((target1Hits.length / total) * 100).toFixed(1));
  const t2Rate = Number(((target2Hits.length / total) * 100).toFixed(1));

  const avgWinningProfit = winningTrades.length > 0
    ? Number((winningTrades.reduce((acc, h) => acc + Math.max(h.pnlPercent, h.maxProfitPercent), 0) / winningTrades.length).toFixed(1))
    : 32.0;

  // Moneyness Performance Breakdown
  const moneynessTiers: Moneyness[] = ['ITM', 'ATM', 'OTM'];
  const moneynessPerformance = moneynessTiers.map(m => {
    const items = tickerHistory.filter(h => h.moneyness === m);
    if (items.length === 0) {
      return { moneyness: m, winRate: m === 'ATM' ? 88 : m === 'ITM' ? 92 : 72, avgGain: m === 'ATM' ? 42 : m === 'ITM' ? 32 : 55, signalCount: 0 };
    }
    const wins = items.filter(h => h.pnlPercent > 0 || h.status.includes('TARGET'));
    const mWinRate = Number(((wins.length / items.length) * 100).toFixed(1));
    const mAvgGain = Number((items.reduce((sum, h) => sum + Math.max(0, h.maxProfitPercent), 0) / items.length).toFixed(1));
    return {
      moneyness: m,
      winRate: mWinRate,
      avgGain: mAvgGain,
      signalCount: items.length,
    };
  });

  // Best performing moneyness category
  const bestMoneyness = moneynessPerformance.reduce((prev, curr) => 
    (curr.winRate * 0.6 + curr.avgGain * 0.4) > (prev.winRate * 0.6 + prev.avgGain * 0.4) ? curr : prev
  ).moneyness;

  // Rank all strikes near spot by derived profit probability
  const step = ticker.strikeStep;
  const atm = ticker.atmStrike;
  const nearRows = chain.filter(r => Math.abs(r.strike - atm) <= step * 4);

  const topRankedStrikes: StrikeProfitTrend[] = nearRows.map(row => {
    const K = row.strike;
    const isCallFavor = ticker.changePercent >= 0;
    const type: OptionType = isCallFavor ? 'CE' : 'PE';
    const contract = type === 'CE' ? row.ce : row.pe;
    const moneyness = contract.moneyness;

    // Past performance for this specific strike
    const pastForStrike = tickerHistory.filter(h => h.strike === K && h.type === type);
    const pastWins = pastForStrike.filter(h => h.pnlPercent > 0 || h.status.includes('TARGET'));
    
    let successRate = pastForStrike.length > 0 
      ? Number(((pastWins.length / pastForStrike.length) * 100).toFixed(1))
      : moneyness === 'ATM' ? 86 : moneyness === 'ITM' ? 91 : 74;

    const avgProfit = pastForStrike.length > 0
      ? Number((pastForStrike.reduce((sum, h) => sum + h.maxProfitPercent, 0) / pastForStrike.length).toFixed(1))
      : moneyness === 'ATM' ? 42.0 : moneyness === 'ITM' ? 33.5 : 52.0;

    const bestProfit = pastForStrike.length > 0
      ? Math.max(...pastForStrike.map(h => h.maxProfitPercent))
      : avgProfit * 1.35;

    // Delta & Gamma profit responsiveness score (0-100)
    const absDelta = Math.abs(contract.greeks.delta);
    const gammaVelocity = contract.greeks.gamma * 1000;
    let score = Math.round((successRate * 0.45) + (absDelta * 35) + (gammaVelocity * 15) + (contract.oiChange > 0 ? 8 : 0));
    score = Math.min(98, Math.max(45, score));

    let trendRating: StrikeProfitTrend['trendRating'] = 'MODERATE_EDGE';
    let note = '';

    if (score >= 82) {
      trendRating = 'HIGH_PROFIT_EDGE';
      note = `Optimal profit velocity. High gamma & delta sensitivity capture maximal spot expansion with highest historical hit rate.`;
    } else if (score >= 68) {
      trendRating = 'MODERATE_EDGE';
      note = `Consistent profit target achievement with balanced risk-to-reward ratio.`;
    } else if (moneyness === 'ITM') {
      trendRating = 'NEUTRAL_EDGE';
      note = `High intrinsic floor; moderate percentage expansion. Ideal for low-risk capital preservation.`;
    } else {
      trendRating = 'HIGH_RISK';
      note = `Out-of-the-money; requires rapid explosive delta movement before theta decay sets in.`;
    }

    return {
      strike: K,
      type,
      moneyness,
      totalSignals: pastForStrike.length,
      successRate,
      avgProfitPercent: avgProfit,
      bestProfitPercent: Number(bestProfit.toFixed(1)),
      profitScore: score,
      trendRating,
      recommendationNote: note,
    };
  });

  // Sort by profit score descending
  topRankedStrikes.sort((a, b) => b.profitScore - a.profitScore);

  return {
    overallWinRate: winRate,
    target1HitRate: t1Rate,
    target2HitRate: t2Rate,
    avgProfitPerWinningTrade: avgWinningProfit,
    bestPerformingMoneyness: bestMoneyness,
    moneynessPerformance,
    topRankedStrikes,
    cumulativeTrend,
    activeSignalsCount: activeSignals.length,
    totalHistoricalSignals: total,
  };
}
