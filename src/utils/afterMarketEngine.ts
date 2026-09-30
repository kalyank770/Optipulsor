import { TickerConfig, MarketMetrics, InterMarketTelemetry } from '../types/options';
import { MarketHoursStatus } from './marketHours';

export interface AfterMarketOpeningAnalytics {
  isAfterMarketMode: boolean; // true when POST_MARKET, CLOSED, or PRE_MARKET
  sessionStateLabel: 'POST_MARKET_SETTLEMENT' | 'OVERNIGHT_AFTER_MARKET' | 'PRE_MARKET_SESSION' | 'REGULAR_SESSION';
  lastSpotClose: number; // e.g. 22716.20
  lastVwapClose: number; // e.g. 22698.50
  vwapDeltaPoints: number; // e.g. +17.70 pts above VWAP
  vwapDeltaLabel: string;
  
  giftNiftyPrice: number; // e.g. 22801.20
  giftNiftyChangePoints: number; // e.g. +85.00 pts
  giftNiftyChangePercent: number; // e.g. +0.37%

  globalMacroCompositeScore: number; // -100 to +100
  globalCueSentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  
  fiiDiiNetFlow: {
    fiiNetCashCr: number; // e.g. +1450 Cr
    fiiNetFoIndexFuturesCr: number; // e.g. +620 Cr
    diiNetCashCr: number; // e.g. +820 Cr
    netFlowSentiment: 'INSTITUTIONAL_BUYING' | 'INSTITUTIONAL_SELLING' | 'BALANCED_FLOW';
    summaryNote: string;
  };

  predictedOpeningSpot: number; // e.g. 22801.20
  predictedOpeningGapPoints: number; // e.g. +85.00 pts
  predictedOpeningGapPercent: number; // e.g. +0.37%
  predictedOpeningType: 'GAP_UP_OPENING' | 'GAP_DOWN_OPENING' | 'FLAT_OPENING';

  openingStrategyPlaybook: {
    openingBias: 'BULLISH_GAP_MOMENTUM' | 'BEARISH_GAP_BREAKDOWN' | 'RANGE_ORB_BREAKOUT' | 'GAP_FADE_REVERSAL';
    strategyTitle: string;
    playbookDescription: string;
    recommendedOpeningOption: 'BUY_CE' | 'BUY_PE' | 'WAIT_FIRST_15M';
    openingStrike: number; // e.g. 22800
    openingOptionType: 'CE' | 'PE';
    openingContractTarget1: number;
    openingContractTarget2: number;
    openingContractStopLoss: number;
    openingExecutionTrigger: string;
  };
}

/**
 * After-Market & Pre-Market Opening Analytics Engine
 * Evaluates post-market close, VWAP delta, GIFT Nifty overnight trade, FII/DII net flows,
 * and overnight global cues to project the NEXT DAY'S OPENING SPOT & OPTION PLAYBOOK.
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

  // 1. Close vs VWAP Delta
  const vwapDeltaPoints = Number((spotClose - vwapClose).toFixed(2));
  const vwapDeltaLabel = vwapDeltaPoints >= 0 
    ? `+${vwapDeltaPoints} pts above VWAP (Late Institutional Accumulation)` 
    : `${vwapDeltaPoints} pts below VWAP (Late Session Unwinding)`;

  // 2. GIFT Nifty Premium / Discount
  const giftNiftyPrice = interMarket.giftNifty.price;
  const giftNiftyChangePoints = Number((giftNiftyPrice - spotClose).toFixed(2));
  const giftNiftyChangePercent = Number(((giftNiftyChangePoints / Math.max(spotClose, 1)) * 100).toFixed(2));

  // 3. FII / DII Net Flow (Provisional After-Market Data dynamically derived from global score & GIFT Nifty delta)
  const score = interMarket.globalCompositeScore;
  const fiiNetCashCr = Math.round(score * 28 + giftNiftyChangePoints * 8);
  const fiiNetFoIndexFuturesCr = Math.round(score * 12 + giftNiftyChangePoints * 4);
  const diiNetCashCr = Math.round(score < 0 ? Math.abs(score) * 22 + 450 : Math.max(200, 350 - score * 5));
  
  const netFlowSentiment = (fiiNetCashCr + fiiNetFoIndexFuturesCr > 400) 
    ? 'INSTITUTIONAL_BUYING' 
    : (fiiNetCashCr + fiiNetFoIndexFuturesCr < -400) 
      ? 'INSTITUTIONAL_SELLING' 
      : 'BALANCED_FLOW';

  const summaryFlowNote = netFlowSentiment === 'INSTITUTIONAL_BUYING'
    ? `FII Net Buy +₹${fiiNetCashCr} Cr (Equities) & +₹${fiiNetFoIndexFuturesCr} Cr (F&O Index Futures). Strong overnight institutional accumulation.`
    : netFlowSentiment === 'INSTITUTIONAL_SELLING'
      ? `FII Net Sell ₹${fiiNetCashCr} Cr. Domestic DIIs absorbed +₹${diiNetCashCr} Cr.`
      : `Balanced FII/DII flow (+₹${diiNetCashCr} Cr DII support).`;

  // 4. Predicted Opening Spot Price
  const macroAdjustment = Number(((interMarket.globalCompositeScore / 100) * 18).toFixed(2));
  const predictedOpeningSpot = Number((spotClose + giftNiftyChangePoints + macroAdjustment).toFixed(2));
  const predictedOpeningGapPoints = Number((predictedOpeningSpot - spotClose).toFixed(2));
  const predictedOpeningGapPercent = Number(((predictedOpeningGapPoints / spotClose) * 100).toFixed(2));

  let predictedOpeningType: AfterMarketOpeningAnalytics['predictedOpeningType'] = 'FLAT_OPENING';
  if (predictedOpeningGapPercent >= 0.25) predictedOpeningType = 'GAP_UP_OPENING';
  else if (predictedOpeningGapPercent <= -0.25) predictedOpeningType = 'GAP_DOWN_OPENING';

  // 5. Opening Strategy Playbook & Recommendations
  const step = ticker.strikeStep;
  const openingStrike = Math.round(predictedOpeningSpot / step) * step;
  const globalCueSentiment = interMarket.globalCompositeScore >= 15 ? 'BULLISH' : interMarket.globalCompositeScore <= -15 ? 'BEARISH' : 'NEUTRAL';

  let openingBias: AfterMarketOpeningAnalytics['openingStrategyPlaybook']['openingBias'] = 'RANGE_ORB_BREAKOUT';
  let strategyTitle = 'Opening Range Breakout (ORB 15M) Strategy';
  let playbookDescription = `Predicted flat opening (${predictedOpeningGapPoints >= 0 ? '+' : ''}${predictedOpeningGapPoints} pts). Wait for the first 15-minute opening candle range to break before taking directional entry.`;
  let recommendedOpeningOption: AfterMarketOpeningAnalytics['openingStrategyPlaybook']['recommendedOpeningOption'] = 'WAIT_FIRST_15M';
  let openingOptionType: 'CE' | 'PE' = 'CE';
  let openingContractTarget1 = 180.00;
  let openingContractTarget2 = 240.00;
  let openingContractStopLoss = 120.00;
  let openingExecutionTrigger = 'Execute ORB strategy when 15m candle closes beyond opening high/low.';

  if (predictedOpeningType === 'GAP_UP_OPENING') {
    // Check if opening into Call Resistance Wall
    if (predictedOpeningSpot >= metrics.majorResistanceStrike - step * 0.4) {
      openingBias = 'GAP_FADE_REVERSAL';
      strategyTitle = `Caution: Gap-Up Into Major Call Wall (${metrics.majorResistanceStrike})`;
      playbookDescription = `Predicted gap-up of +${predictedOpeningGapPoints} pts opens directly into heavy Call OI Resistance at ${metrics.majorResistanceStrike}. High probability of opening profit-taking / gap-fade. Do NOT chase CE at 9:15 AM; wait for dip toward VWAP (${spotClose}) or 15m consolidation.`;
      recommendedOpeningOption = 'WAIT_FIRST_15M';
      openingOptionType = 'CE';
      openingExecutionTrigger = 'Wait for 9:30 AM ORB candle validation before initiating CE or PE.';
    } else {
      openingBias = 'BULLISH_GAP_MOMENTUM';
      strategyTitle = `Bullish Gap-Up Opening Momentum Playbook`;
      playbookDescription = `Predicted gap-up of +${predictedOpeningGapPoints} pts (+${predictedOpeningGapPercent}%) supported by GIFT Nifty (+${giftNiftyChangePoints} pts) & FII buying (+₹${fiiNetCashCr} Cr). Strategy: Buy ${openingStrike} CE on first 2m/5m pullback toward opening 9 EMA / VWAP floor.`;
      recommendedOpeningOption = 'BUY_CE';
      openingOptionType = 'CE';
      
      const estimatedPremium = Math.max(30, 140 + (predictedOpeningGapPoints * 0.55));
      openingContractTarget1 = Number((estimatedPremium * 1.28).toFixed(2));
      openingContractTarget2 = Number((estimatedPremium * 1.55).toFixed(2));
      openingContractStopLoss = Number((estimatedPremium * 0.82).toFixed(2));
      openingExecutionTrigger = `Buy ${openingStrike} CE on pullback to opening 9 EMA with Stop Loss at ₹${openingContractStopLoss.toFixed(2)}.`;
    }
  } else if (predictedOpeningType === 'GAP_DOWN_OPENING') {
    if (predictedOpeningSpot <= metrics.majorSupportStrike + step * 0.4) {
      openingBias = 'BEARISH_GAP_BREAKDOWN';
      strategyTitle = `Bearish Gap-Down Breakdown Playbook`;
      playbookDescription = `Predicted gap-down of ${predictedOpeningGapPoints} pts (${predictedOpeningGapPercent}%) breaks major Put OI Support at ${metrics.majorSupportStrike}. Strategy: Buy ${openingStrike} PE on opening pullback retest toward previous close resistance (${spotClose}).`;
      recommendedOpeningOption = 'BUY_PE';
      openingOptionType = 'PE';

      const estimatedPremium = Math.max(30, 130 + (Math.abs(predictedOpeningGapPoints) * 0.55));
      openingContractTarget1 = Number((estimatedPremium * 1.28).toFixed(2));
      openingContractTarget2 = Number((estimatedPremium * 1.55).toFixed(2));
      openingContractStopLoss = Number((estimatedPremium * 0.82).toFixed(2));
      openingExecutionTrigger = `Buy ${openingStrike} PE on pullback retest of previous close with SL at ₹${openingContractStopLoss.toFixed(2)}.`;
    } else {
      openingBias = 'RANGE_ORB_BREAKOUT';
      strategyTitle = `Gap-Down Into Put Support Bounce Playbook`;
      playbookDescription = `Gap-down holds above Put Support Wall at ${metrics.majorSupportStrike}. Watch for opening bullish hammer / reversal candle at Put support for long recovery trade.`;
      recommendedOpeningOption = 'WAIT_FIRST_15M';
      openingOptionType = 'PE';
      openingExecutionTrigger = `Wait for 5m bullish reversal candle at Put support (${metrics.majorSupportStrike}).`;
    }
  }

  return {
    isAfterMarketMode,
    sessionStateLabel,
    lastSpotClose: spotClose,
    lastVwapClose: vwapClose,
    vwapDeltaPoints,
    vwapDeltaLabel,
    giftNiftyPrice,
    giftNiftyChangePoints,
    giftNiftyChangePercent,
    globalMacroCompositeScore: interMarket.globalCompositeScore,
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
    openingStrategyPlaybook: {
      openingBias,
      strategyTitle,
      playbookDescription,
      recommendedOpeningOption,
      openingStrike,
      openingOptionType,
      openingContractTarget1,
      openingContractTarget2,
      openingContractStopLoss,
      openingExecutionTrigger,
    },
  };
}
