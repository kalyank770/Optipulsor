export type OptionType = 'CE' | 'PE';

export type Moneyness = 'ITM' | 'ATM' | 'OTM';

export type BuildupType = 
  | 'Long Buildup'     // Price Up, OI Up (Bullish)
  | 'Short Covering'   // Price Up, OI Down (Bullish cover)
  | 'Short Buildup'    // Price Down, OI Up (Bearish)
  | 'Long Unwinding';  // Price Down, OI Down (Bearish exit)

export interface OptionGreeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
}

export interface OptionContract {
  strike: number;
  type: OptionType;
  ltp: number;
  prevClose: number;
  change: number;
  changePercent: number;
  bidPrice: number;
  bidQty: number;
  askPrice: number;
  askQty: number;
  volume: number;
  openInterest: number;
  oiChange: number;
  oiChangePercent: number;
  iv: number; // Implied Volatility %
  greeks: OptionGreeks;
  moneyness: Moneyness;
  buildup: BuildupType;
  lastTickDirection?: 'up' | 'down' | 'none';
}

export interface OptionChainRow {
  strike: number;
  isATM: boolean;
  ce: OptionContract;
  pe: OptionContract;
  totalOI: number;
  strikePCR: number;
}

export interface ExtendedHoursData {
  session: 'PRE' | 'POST' | 'REGULAR' | 'CLOSED';
  price: number;
  change: number;
  changePercent: number;
  time?: string;
  source?: string;
}

export interface TickerConfig {
  symbol: string;
  name: string;
  category: 'Index' | 'Equity';
  currency: string;
  lotSize: number;
  strikeStep: number;
  spotPrice: number;
  regularPrice?: number;
  dayOpen: number;
  dayHigh: number;
  dayLow: number;
  prevClose: number;
  change: number;
  changePercent: number;
  atmStrike: number;
  vix: number;
  vixChange: number;
  expiryDates: string[];
  asOnTime?: string;
  isLiveSynced?: boolean;
  marketState?: string;
  preMarketPrice?: number;
  preMarketChange?: number;
  preMarketChangePercent?: number;
  postMarketPrice?: number;
  postMarketChange?: number;
  postMarketChangePercent?: number;
  extendedHours?: ExtendedHoursData;
  isUsingPreMarket?: boolean;
}

export interface MarketMetrics {
  spotPrice: number;
  atmStrike: number;
  maxPainStrike: number;
  pcrTotalOI: number;
  pcrVolume: number;
  totalCeOI: number;
  totalPeOI: number;
  majorSupportStrike: number; // Highest PE OI
  majorResistanceStrike: number; // Highest CE OI
  ivRank: number; // 0 - 100%
  marketTrend: 'STRONG_BULLISH' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'STRONG_BEARISH';
}

export type SignalAction = 'BUY_CE' | 'BUY_PE' | 'WAIT_NEUTRAL';
export type SignalStrength = 'STRONG' | 'MODERATE' | 'CAUTION';

export interface RationalePoint {
  title: string;
  verdict: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  description: string;
}

export interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
}

export interface TimeframeCandleAnalysis {
  timeframe: '2m' | '5m' | '15m';
  candles: Candle[];
  latestCandle: Candle;
  trend: 'BULLISH' | 'BEARISH' | 'SIDEWAYS';
  pattern: string;
  patternBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  resistance: number;
  support: number;
  atr: number;
  momentumScore: number; // -10 to +10
  measuredMoveTarget: number;
}

export interface MultiTimeframeChartPatterns {
  m2: TimeframeCandleAnalysis;
  m5: TimeframeCandleAnalysis;
  m15: TimeframeCandleAnalysis;
  confluencePattern: string;
  confluenceBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confluenceScore: number;
  derivedExitLevel1: number;
  derivedExitLevel2: number;
  invalidationLevel: number;
}

export interface TargetExitSynthesis {
  candlestickPillar: {
    confluencePattern: string;
    confluenceScore: number;
    m2Pattern: string;
    m5Pattern: string;
    m15Pattern: string;
    swingTarget1: number;
    swingTarget2: number;
  };
  newsPillar: {
    overnightSentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    overnightHeadline: string;
    liveSentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    liveHeadline: string;
    netNewsBiasScore: number;
    newsTargetImpact: string;
  };
  trendPillar: {
    prevSessionTrend: string;
    dayRange: number;
    atrDaily: number;
    trendContinuationProb: number;
    momentumVerdict: string;
  };
  optionChartPillar: {
    callWall: number;
    putWall: number;
    maxPain: number;
    pcrTotalOI: number;
    deltaExpansion: number;
    gammaAcceleration: number;
    thetaDecayBuffer: number;
  };
}

export interface TradeSignal {
  action: SignalAction;
  strength: SignalStrength;
  confidence: number; // 0 - 100%
  recommendedStrike: number;
  recommendedType: OptionType;
  recommendedContractLTP: number;
  moneyness: Moneyness;
  entryRange: [number, number];
  stopLoss: number;
  target1: number;
  target2: number;
  riskRewardRatio: string;
  summaryNote: string;
  rationalePoints: RationalePoint[];
  generatedAt: string;
  target1Basis?: string;
  target2Basis?: string;
  spotTarget1?: number;
  spotTarget2?: number;
  candleAnalysis?: MultiTimeframeChartPatterns;
  targetExitSynthesis?: TargetExitSynthesis;
}

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  timeAgo: string;
  timestamp: number;
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  relatedTickers: string[];
  optionTakeaway: string;
  summary: string;
  category: 'Macro' | 'Earnings' | 'Policy' | 'Sector' | 'Geopolitics' | 'Overnight';
  timing?: 'LIVE' | 'OVERNIGHT';
  link?: string;
}

export type StrikeOutcomeStatus = 'ACTIVE' | 'TARGET_1_HIT' | 'TARGET_2_HIT' | 'STOP_LOSS_HIT' | 'PROFITABLE' | 'IN_LOSS';

export interface StrikeHistoryItem {
  id: string;
  timestamp: number;
  timeFormatted: string;
  tickerSymbol: string;
  action: SignalAction;
  strike: number;
  type: OptionType;
  moneyness: Moneyness;
  spotPriceAtSignal: number;
  entryPrice: number;
  entryRange: [number, number];
  target1: number;
  target2: number;
  stopLoss: number;
  currentLTP: number;
  highestLTP: number;
  pnlPercent: number;
  maxProfitPercent: number;
  status: StrikeOutcomeStatus;
  confidence: number;
  riskReward: string;
}

export interface StrikeProfitTrend {
  strike: number;
  type: OptionType;
  moneyness: Moneyness;
  totalSignals: number;
  successRate: number;
  avgProfitPercent: number;
  bestProfitPercent: number;
  profitScore: number;
  trendRating: 'HIGH_PROFIT_EDGE' | 'MODERATE_EDGE' | 'NEUTRAL_EDGE' | 'HIGH_RISK';
  recommendationNote: string;
}

export type CumulativeTrendAlignment = 
  | 'STRONG_CONVERGENCE'
  | 'MODERATE_CONVERGENCE'
  | 'CONSOLIDATING_IN_ZONE'
  | 'DIVERGING';

export interface CumulativeActionTrend {
  dominantAction: 'BULLISH_CE' | 'BEARISH_PE' | 'NEUTRAL';
  alignmentStatus: CumulativeTrendAlignment;
  alignmentScore: number; // 0 to 100
  isMovingTowardsSuggested: boolean;
  statusHeadline: string;
  detailedAnalysis: string;
  totalCallSignals: number;
  totalPutSignals: number;
  bullishRatioPercent: number;
  netCumulativeReturnPercent: number;
  signalsHitTarget1Count: number;
  signalsHitTarget2Count: number;
  signalsActiveInProfitCount: number;
  signalsInLossCount: number;
  targetProgressPercent: number;
  currentMomentumVelocity: string;
  suggestedActionVerdict: string;
}

export interface StrikeTrendAnalytics {
  overallWinRate: number;
  target1HitRate: number;
  target2HitRate: number;
  avgProfitPerWinningTrade: number;
  bestPerformingMoneyness: Moneyness;
  moneynessPerformance: {
    moneyness: Moneyness;
    winRate: number;
    avgGain: number;
    signalCount: number;
  }[];
  topRankedStrikes: StrikeProfitTrend[];
  cumulativeTrend: CumulativeActionTrend;
  activeSignalsCount: number;
  totalHistoricalSignals: number;
}

export interface OptionFilters {
  expiryDate: string;
  strikeRange: 'ATM_5' | 'ATM_10' | 'ATM_15' | 'ALL' | 'CUSTOM';
  customMinStrike?: number;
  customMaxStrike?: number;
  moneynessFilter: 'ALL' | 'ITM' | 'ATM' | 'OTM';
  minIV: number;
  maxIV: number;
  minDelta: number;
  maxDelta: number;
  minOpenInterest: number;
  searchQuery: string;
}
