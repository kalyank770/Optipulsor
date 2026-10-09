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
