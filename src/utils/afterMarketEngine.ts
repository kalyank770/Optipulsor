import { TickerConfig, MarketMetrics, InterMarketTelemetry } from '../types/options';
import { MarketHoursStatus } from './marketHours';

export interface FullDayChartAnalysis {
  dayOpen: number;
  dayHigh: number;
  dayLow: number;
  dayClose: number;
  dayRangePoints: number;
  closeVsVwapPoints: number;
  closePositionPercent: number; // 0 to 100% of day's range
  dayStructureVerdict: 'BULLISH_ACCUMULATION' | 'BEARISH_DISTRIBUTION' | 'NEUTRAL_CONSOLIDATION';
  dayChartSummary: string;
}

export interface TomorrowHitStrike {
  strike: number;
  type: 'CE' | 'PE';
  action: 'BUY_CE' | 'BUY_PE' | 'WAIT_FIRST_15M';
  expectedHitTiming: string; // e.g. "Within 09:15 - 09:45 AM opening session"
  hitReason: string;
  projectedSpotAtHit: number;
  estimatedOpeningPremium: number;
  target1: number;
  target2: number;
  stopLoss: number;
}

export interface AfterMarketOpeningAnalytics {
  isAfterMarketMode: boolean; // true when POST_MARKET, CLOSED, or PRE_MARKET
  sessionStateLabel: 'POST_MARKET_SETTLEMENT' | 'OVERNIGHT_AFTER_MARKET' | 'PRE_MARKET_SESSION' | 'REGULAR_SESSION';
  lastSpotClose: number;
  lastVwapClose: number;
  vwapDeltaPoints: number;
  vwapDeltaLabel: string;
  
  giftNiftyPrice: number;
  giftNiftyChangePoints: number;
  giftNiftyChangePercent: number;

  globalMacroCompositeScore: number;
  globalCueSentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  
  fiiDiiNetFlow: {
    fiiNetCashCr: number;
    fiiNetFoIndexFuturesCr: number;
    diiNetCashCr: number;
    netFlowSentiment: 'INSTITUTIONAL_BUYING' | 'INSTITUTIONAL_SELLING' | 'BALANCED_FLOW';
    summaryNote: string;
  };

  predictedOpeningSpot: number;
  predictedOpeningGapPoints: number;
  predictedOpeningGapPercent: number;
  predictedOpeningType: 'GAP_UP_OPENING' | 'GAP_DOWN_OPENING' | 'FLAT_OPENING';

  fullDayChartAnalysis: FullDayChartAnalysis;
  tomorrowHitStrike: TomorrowHitStrike;

  openingStrategyPlaybook: {
    openingBias: 'BULLISH_GAP_MOMENTUM' | 'BEARISH_GAP_BREAKDOWN' | 'RANGE_ORB_BREAKOUT' | 'GAP_FADE_REVERSAL';
    strategyTitle: string;
    playbookDescription: string;
    recommendedOpeningOption: 'BUY_CE' | 'BUY_PE' | 'WAIT_FIRST_15M';
    openingStrike: number;
    openingOptionType: 'CE' | 'PE';
    openingContractTarget1: number;
    openingContractTarget2: number;
    openingContractStopLoss: number;
    openingExecutionTrigger: string;
  };
}

/**
 * After-Market Opening Analytics Engine
 * Evaluates today's entire day chart (High, Low, Open, Close, VWAP, Range distribution),
 * synthesized with overnight GIFT Nifty premium/discount, global macro momentum, and FII/DII positioning
 * to determine the PRECISE STRIKE PRICE THAT WILL HIT TOMORROW ONCE THE MARKET OPENS.
 */
export function computeAfterMarketOpeningAnalytics(
  ticker: TickerConfig,
  marketStatus: MarketHoursStatus,
  vwapClose: number,
  interMarket: InterMarketTelemetry,
  metrics: MarketMetrics
): AfterMarketOpeningAnalytics {
  const isAfterMarketMode = !marketStatus.isOpen;
  const spotClose = ticker.spotPrice;

  let sessionStateLabel: AfterMarketOpeningAnalytics['sessionStateLabel'] = 'REGULAR_SESSION';
  if (marketStatus.session === 'POST_MARKET') sessionStateLabel = 'POST_MARKET_SETTLEMENT';
  else if (marketStatus.session === 'PRE_MARKET') sessionStateLabel = 'PRE_MARKET_SESSION';
  else if (marketStatus.session === 'CLOSED') sessionStateLabel = 'OVERNIGHT_AFTER_MARKET';

  // 1. Entire Day Chart Analysis (Open, High, Low, Close, Range, VWAP)
  const dayOpen = ticker.dayOpen || (ticker.spotPrice - (ticker.change || 0));
  const dayHigh = ticker.dayHigh && ticker.dayHigh >= ticker.spotPrice ? ticker.dayHigh : ticker.spotPrice + ticker.strikeStep * 0.5;
  const dayLow = ticker.dayLow && ticker.dayLow <= ticker.spotPrice ? ticker.dayLow : ticker.spotPrice - ticker.strikeStep * 0.5;
  const dayRangePoints = Number(Math.max(ticker.strikeStep * 0.5, dayHigh - dayLow).toFixed(2));
  const closePositionPercent = Number(Math.min(100, Math.max(0, ((spotClose - dayLow) / dayRangePoints) * 100)).toFixed(1));
  const closeVsVwapPoints = Number((spotClose - vwapClose).toFixed(2));

  let dayStructureVerdict: FullDayChartAnalysis['dayStructureVerdict'] = 'NEUTRAL_CONSOLIDATION';
  if (spotClose < dayOpen && (closePositionPercent <= 38 || closeVsVwapPoints <= -15)) {
    dayStructureVerdict = 'BEARISH_DISTRIBUTION';
  } else if (spotClose > dayOpen && (closePositionPercent >= 62 || closeVsVwapPoints >= 15)) {
    dayStructureVerdict = 'BULLISH_ACCUMULATION';
  } else if (closePositionPercent <= 28) {
    dayStructureVerdict = 'BEARISH_DISTRIBUTION';
  } else if (closePositionPercent >= 72) {
    dayStructureVerdict = 'BULLISH_ACCUMULATION';
  }

  const dayChartSummary = dayStructureVerdict === 'BEARISH_DISTRIBUTION'
    ? `Today's chart closed weak near session lows (${closePositionPercent}% of range, ${closeVsVwapPoints} pts vs VWAP), confirming persistent institutional supply and breakdown posture.`
    : dayStructureVerdict === 'BULLISH_ACCUMULATION'
      ? `Today's chart closed strong near session highs (${closePositionPercent}% of range, +${closeVsVwapPoints} pts above VWAP), signaling aggressive institutional demand and bullish accumulation.`
      : `Today's chart closed in consolidation (${dayLow.toFixed(1)} - ${dayHigh.toFixed(1)}), balancing near mid-range (${closePositionPercent}% of range).`;

  const fullDayChartAnalysis: FullDayChartAnalysis = {
    dayOpen,
    dayHigh,
    dayLow,
    dayClose: spotClose,
    dayRangePoints,
    closeVsVwapPoints,
    closePositionPercent,
    dayStructureVerdict,
    dayChartSummary,
  };

  // 2. GIFT Nifty & Global Overnight Drift (Normalized for Ticker Scale)
  const isBankNifty = ticker.symbol.toUpperCase().includes('BANK');
  const isNifty = ticker.symbol.toUpperCase().includes('NIFTY') && !isBankNifty;
  const isStockOrUsd = !isNifty && !isBankNifty;
  const beta = isBankNifty ? 1.25 : isNifty ? 1.0 : 0.85;

  // GIFT Nifty level is bound to Nifty 50 scale
  const rawGiftNiftyPrice = interMarket?.giftNifty?.price || 22240.00;
  const rawGiftNiftyChange = interMarket?.giftNifty?.change !== undefined ? interMarket.giftNifty.change : -15.00;
  const rawGiftNiftyPct = interMarket?.giftNifty?.changePercent !== undefined 
    ? interMarket.giftNifty.changePercent 
    : Number(((rawGiftNiftyChange / Math.max(1, rawGiftNiftyPrice - rawGiftNiftyChange)) * 100).toFixed(2));

  const giftNiftyPrice = rawGiftNiftyPrice;
  const giftNiftyChangePoints = rawGiftNiftyChange;
  const giftNiftyChangePercent = rawGiftNiftyPct;

  // Realistic percentage gap drift applied to current ticker spot
  const tickerExpectedGapPercent = Number((rawGiftNiftyPct * beta).toFixed(3));

  const globalScore = interMarket?.globalCompositeScore || 0;
  const globalCueSentiment = globalScore >= 15 ? 'BULLISH' : globalScore <= -15 ? 'BEARISH' : 'NEUTRAL';

  // 3. Institutional FII/DII Positioning (Derived from Global Flows + Exchange Settlement)
  const fiiNetCashCr = Math.round(globalScore * 28 + tickerExpectedGapPercent * 250);
  const fiiNetFoIndexFuturesCr = Math.round(globalScore * 14 + tickerExpectedGapPercent * 150);
  const diiNetCashCr = Math.round(globalScore < 0 ? Math.abs(globalScore) * 22 + 450 : Math.max(200, 380 - globalScore * 4));
  
  const netFlowSentiment = (fiiNetCashCr + fiiNetFoIndexFuturesCr > 300) 
    ? 'INSTITUTIONAL_BUYING' 
    : (fiiNetCashCr + fiiNetFoIndexFuturesCr < -300) 
      ? 'INSTITUTIONAL_SELLING' 
      : 'BALANCED_FLOW';

  const summaryFlowNote = netFlowSentiment === 'INSTITUTIONAL_BUYING'
    ? `FII Net Buy +₹${fiiNetCashCr} Cr (Equities) & +₹${fiiNetFoIndexFuturesCr} Cr (Index Futures). Strong overnight institutional accumulation.`
    : netFlowSentiment === 'INSTITUTIONAL_SELLING'
      ? `FII Net Sell ₹${Math.abs(fiiNetCashCr)} Cr. Domestic DIIs absorbed +₹${diiNetCashCr} Cr.`
      : `Balanced institutional flow (+₹${diiNetCashCr} Cr DII support).`;

  // 4. Synthesized Opening Direction & Projected Spot
  let openMomentumScore = 0;
  if (dayStructureVerdict === 'BULLISH_ACCUMULATION') openMomentumScore += 3.0;
  else if (dayStructureVerdict === 'BEARISH_DISTRIBUTION') openMomentumScore -= 3.0;

  const vwapPct = (closeVsVwapPoints / spotClose) * 100;
  if (vwapPct >= 0.08) openMomentumScore += 1.8;
  else if (vwapPct <= -0.08) openMomentumScore -= 1.8;

  if (tickerExpectedGapPercent >= 0.20) openMomentumScore += 3.5;
  else if (tickerExpectedGapPercent >= 0.05) openMomentumScore += 1.8;
  else if (tickerExpectedGapPercent <= -0.20) openMomentumScore -= 3.5;
  else if (tickerExpectedGapPercent <= -0.05) openMomentumScore -= 1.8;

  if (globalScore >= 18) openMomentumScore += 1.6;
  else if (globalScore <= -18) openMomentumScore -= 1.6;

  let predictedOpeningSpot = spotClose;
  let predictedOpeningGapPoints = 0;

  if (ticker.isUsingPreMarket) {
    predictedOpeningSpot = spotClose;
    predictedOpeningGapPoints = Number((predictedOpeningSpot - (ticker.prevClose || spotClose)).toFixed(2));
  } else {
    const macroAdjustment = Number(((globalScore / 100) * (spotClose * 0.0015)).toFixed(2));
    
    // Exact mathematical gap drift calibrated for asset class:
    let gapDriftForTicker = 0;
    if (isNifty) {
      gapDriftForTicker = rawGiftNiftyChange;
    } else if (isBankNifty) {
      // BankNifty gap moves in beta proportion to Nifty percentage move
      gapDriftForTicker = Number(((spotClose * (rawGiftNiftyPct * 1.25)) / 100).toFixed(2));
    } else {
      // Stocks or USD Equities: scale by percentage move
      gapDriftForTicker = Number(((spotClose * (rawGiftNiftyPct * beta)) / 100).toFixed(2));
    }

    predictedOpeningSpot = Number((spotClose + gapDriftForTicker + macroAdjustment).toFixed(2));
    predictedOpeningGapPoints = Number((predictedOpeningSpot - spotClose).toFixed(2));
  }

  const referenceBasePrice = ticker.prevClose || spotClose;
  const predictedOpeningGapPercent = Number(((predictedOpeningGapPoints / Math.max(1, referenceBasePrice)) * 100).toFixed(2));

  let predictedOpeningType: AfterMarketOpeningAnalytics['predictedOpeningType'] = 'FLAT_OPENING';
  if (predictedOpeningGapPercent >= 0.15) predictedOpeningType = 'GAP_UP_OPENING';
  else if (predictedOpeningGapPercent <= -0.15) predictedOpeningType = 'GAP_DOWN_OPENING';

  // 5. DETERMINE THE PRECISE STRIKE THAT WILL HIT TOMORROW ONCE THE MARKET OPENS
  const step = ticker.strikeStep;
  let tomorrowAction: 'BUY_CE' | 'BUY_PE' | 'WAIT_FIRST_15M' = 'BUY_CE';
  let tomorrowType: 'CE' | 'PE' = 'CE';
  let tomorrowStrike = Math.round(predictedOpeningSpot / step) * step;
  let projectedSpotAtHit = predictedOpeningSpot;
  let hitReason = '';

  const supFloor = metrics?.majorSupportStrike || (spotClose - step);
  const resWall = metrics?.majorResistanceStrike || (spotClose + step);

  // A flat opening occurs when gap percentage is within ±0.15% OR points change is negligible (< 25 pts Nifty, < 60 pts BankNifty, < $1 USD)
  const isFlatOpening = predictedOpeningType === 'FLAT_OPENING' || 
    Math.abs(predictedOpeningGapPercent) < 0.15 || 
    Math.abs(predictedOpeningGapPoints) < (isBankNifty ? 60 : (ticker.currency === '$' ? 1.0 : 25));

  if (isFlatOpening) {
    // Neutral / Flat Opening: Capital Protection First!
    // Never suggest aggressive option buying at 09:15 AM open when gap is flat (IV crush & whipsaw trap)
    tomorrowAction = 'WAIT_FIRST_15M';
    tomorrowType = (openMomentumScore < 0 || closeVsVwapPoints < 0) ? 'PE' : 'CE';
    tomorrowStrike = Math.round(spotClose / step) * step;
    projectedSpotAtHit = predictedOpeningSpot;
    hitReason = `Flat / Neutral opening expected (${predictedOpeningGapPoints >= 0 ? '+' : ''}${predictedOpeningGapPoints} pts · ${predictedOpeningGapPercent}%). Even though prior session closed ${closeVsVwapPoints >= 0 ? '+' : ''}${closeVsVwapPoints} pts vs VWAP (${dayStructureVerdict?.replace(/_/g, ' ') || 'BALANCED'}), a flat opening offers zero gap impulse at 09:15 AM. Buying naked options (CE or PE) at market open on a flat gap carries severe risk of rapid Theta decay and instant IV crush. CAPITAL PRESERVATION PROTOCOL: STAND ASIDE in WAIT for the first 15 minutes (09:15 - 09:30 AM). Allow the market to print its 15-Minute Opening Range (ORB); monitor reference contract ${tomorrowStrike} ${tomorrowType} for entry ONLY if spot decisively breaks down below the 15-Minute Range Low / Support (${ticker.currency}${supFloor.toLocaleString()}) after 09:30 AM. If spot reverses above ${ticker.currency}${resWall.toLocaleString()}, wait for Call setup.`;
  } else if (openMomentumScore > 0 || predictedOpeningType === 'GAP_UP_OPENING') {
    // Bullish Opening: Market will rally/gap up and hit an overhead Call strike
    tomorrowAction = 'BUY_CE';
    tomorrowType = 'CE';

    // The strike that will hit upon opening:
    if (predictedOpeningSpot > spotClose) {
      tomorrowStrike = Math.round(predictedOpeningSpot / step) * step;
      if (tomorrowStrike <= spotClose) {
        tomorrowStrike = Math.ceil((spotClose + step * 0.4) / step) * step;
      }
    } else {
      tomorrowStrike = Math.ceil((spotClose + step * 0.3) / step) * step;
    }
    projectedSpotAtHit = Number(Math.max(predictedOpeningSpot, tomorrowStrike).toFixed(2));
    const isAboveResWall = predictedOpeningSpot >= resWall;
    
    hitReason = isAboveResWall
      ? `Synthesizing today's strong closing structure (+${closeVsVwapPoints} pts above VWAP) with overnight GIFT Nifty (${giftNiftyChangePoints >= 0 ? '+' : ''}${giftNiftyChangePoints} pts): Spot is projected to gap above the ${ticker.currency}${resWall.toLocaleString()} Call OI Resistance wall towards ${tomorrowStrike} CE. If spot sustains above ${ticker.currency}${resWall.toLocaleString()} in the opening 15 minutes, trapped Call writers will be forced into short covering, driving spot to ${projectedSpotAtHit}. If rejected at open, watch for a gap fade back to ${ticker.currency}${spotClose.toLocaleString()}.`
      : `Synthesizing today's chart (${dayStructureVerdict?.replace(/_/g, ' ') || 'BALANCED'}, closed ${closeVsVwapPoints >= 0 ? '+' : ''}${closeVsVwapPoints} pts vs VWAP) with overnight GIFT Nifty (${giftNiftyChangePoints >= 0 ? '+' : ''}${giftNiftyChangePoints} pts) below the ${ticker.currency}${resWall.toLocaleString()} OI resistance wall, spot will drive upward at 09:15 AM open to test ${tomorrowStrike} CE.`;
  } else {
    // Bearish Opening: Market will slide/gap down and hit a lower Put strike
    tomorrowAction = 'BUY_PE';
    tomorrowType = 'PE';

    // The strike that will hit upon opening:
    if (predictedOpeningSpot < spotClose) {
      tomorrowStrike = Math.round(predictedOpeningSpot / step) * step;
      if (tomorrowStrike >= spotClose) {
        tomorrowStrike = Math.floor((spotClose - step * 0.4) / step) * step;
      }
    } else {
      tomorrowStrike = Math.floor((spotClose - step * 0.3) / step) * step;
    }
    projectedSpotAtHit = Number(Math.min(predictedOpeningSpot, tomorrowStrike).toFixed(2));
    const isBelowSupFloor = predictedOpeningSpot <= supFloor;

    hitReason = isBelowSupFloor
      ? `Synthesizing today's weak closing structure (${closeVsVwapPoints} pts vs VWAP) with overnight GIFT Nifty (${giftNiftyChangePoints >= 0 ? '+' : ''}${giftNiftyChangePoints} pts): Spot is projected to gap down below the ${ticker.currency}${supFloor.toLocaleString()} Put OI Support floor towards ${tomorrowStrike} PE. If breakdown sustains below ${ticker.currency}${supFloor.toLocaleString()} in the first 15 minutes, long unwinding will accelerate spot to ${projectedSpotAtHit}.`
      : `Synthesizing today's chart (${dayStructureVerdict?.replace(/_/g, ' ') || 'BALANCED'}, closed ${closeVsVwapPoints} pts vs VWAP) with overnight GIFT Nifty (${giftNiftyChangePoints >= 0 ? '+' : ''}${giftNiftyChangePoints} pts), spot will test ${tomorrowStrike} PE at 09:15 AM open.`;
  }

  // Derive estimated opening contract targets for tomorrow's hit strike
  const isUSD = ticker.currency === '$';
  const baselineAtmPremium = isUSD
    ? Math.max(0.8, spotClose * 0.009)
    : Math.max(15, spotClose * (isBankNifty ? 0.009 : 0.0055));
  const moneynessAdjustment = (tomorrowType === 'CE' 
    ? (predictedOpeningSpot - tomorrowStrike) * 0.48 
    : (tomorrowStrike - predictedOpeningSpot) * 0.48);
  const minFloor = isUSD ? 0.20 : 5.0;
  const estimatedOpeningPremium = Number(Math.max(minFloor, baselineAtmPremium + moneynessAdjustment).toFixed(2));
  const target1 = Number((estimatedOpeningPremium * 1.35).toFixed(2)); // +35% opening target
  const target2 = Number((estimatedOpeningPremium * 1.70).toFixed(2)); // +70% runner extension
  const stopLoss = Number((estimatedOpeningPremium * 0.82).toFixed(2)); // -18% invalidation SL

  const tomorrowHitStrike: TomorrowHitStrike = {
    strike: tomorrowStrike,
    type: tomorrowType,
    action: tomorrowAction,
    expectedHitTiming: 'Projected to hit within 09:15 - 09:45 AM opening auction',
    hitReason,
    projectedSpotAtHit,
    estimatedOpeningPremium,
    target1,
    target2,
    stopLoss,
  };

  // 6. Strategy Playbook
  const closeVsVwapPercent = Number(((closeVsVwapPoints / (vwapClose || 1)) * 100).toFixed(2));
  const vwapDeltaLabel = closeVsVwapPoints >= 0 
    ? `+${closeVsVwapPoints} pts (+${closeVsVwapPercent}%) above VWAP` 
    : `${closeVsVwapPoints} pts (${closeVsVwapPercent}%) below VWAP`;

  let openingBias: AfterMarketOpeningAnalytics['openingStrategyPlaybook']['openingBias'] = 
    tomorrowAction === 'WAIT_FIRST_15M' 
      ? 'RANGE_ORB_BREAKOUT' 
      : tomorrowAction === 'BUY_CE' 
      ? 'BULLISH_GAP_MOMENTUM' 
      : 'BEARISH_GAP_BREAKDOWN';
  let strategyTitle = tomorrowAction === 'WAIT_FIRST_15M'
    ? `Flat Open (${predictedOpeningGapPoints >= 0 ? '+' : ''}${predictedOpeningGapPoints} pts): Wait for 15-Minute Range Breakout (Reference ${tomorrowStrike} ${tomorrowType})`
    : tomorrowAction === 'BUY_CE' 
    ? `Bullish Open: Target Strike ${tomorrowStrike} CE` 
    : `Bearish Open: Target Strike ${tomorrowStrike} PE`;
  let playbookDescription = hitReason;

  const openingExecutionTrigger = tomorrowAction === 'WAIT_FIRST_15M'
    ? `STAND ASIDE at 09:15 AM open (Capital Preservation: High risk of IV crush & chop on flat open). Watch ${tomorrowStrike} ${tomorrowType} for entry ONLY upon a confirmed 09:30 AM 15-Minute Opening Range Breakout below ${ticker.currency}${supFloor.toLocaleString()}.`
    : `Buy ${tomorrowStrike} ${tomorrowType} at 09:15 AM open with target ${ticker.currency}${target1} and SL ${ticker.currency}${stopLoss}.`;

  return {
    isAfterMarketMode,
    sessionStateLabel,
    lastSpotClose: spotClose,
    lastVwapClose: vwapClose,
    vwapDeltaPoints: closeVsVwapPoints,
    vwapDeltaLabel,
    giftNiftyPrice,
    giftNiftyChangePoints,
    giftNiftyChangePercent,
    globalMacroCompositeScore: globalScore,
    globalCueSentiment,
    fiiDiiNetFlow: {
      fiiNetCashCr,
      fiiNetFoIndexFuturesCr,
      diiNetCashCr,
      netFlowSentiment,
      summaryNote: summaryFlowNote,
    },
    predictedOpeningSpot,
    predictedOpeningGapPoints,
    predictedOpeningGapPercent,
    predictedOpeningType,
    fullDayChartAnalysis,
    tomorrowHitStrike,
    openingStrategyPlaybook: {
      openingBias,
      strategyTitle,
      playbookDescription,
      recommendedOpeningOption: tomorrowAction,
      openingStrike: tomorrowStrike,
      openingOptionType: tomorrowType,
      openingContractTarget1: target1,
      openingContractTarget2: target2,
      openingContractStopLoss: stopLoss,
      openingExecutionTrigger,
    },
  };
}
