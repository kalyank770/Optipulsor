import { Candle, OptionType, TickerConfig } from './options';

export type HTFTimeframe = '1h' | '1d' | '1w';
export type ForecastHorizon = 'next_1h' | 'next_1d' | 'next_1w';

export interface HTFCandlePatternResult {
  timeframe: HTFTimeframe;
  timeframeLabel: string;
  candles: Candle[];
  latestCandle: Candle;
  trend: 'STRONG_BULLISH' | 'BULLISH' | 'SIDEWAYS' | 'BEARISH' | 'STRONG_BEARISH';
  primaryPattern: string;
  patternType: 'REVERSAL' | 'CONTINUATION' | 'CONSOLIDATION';
  patternBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  patternConfidence: number; // 0 - 100%
  patternDescription: string;
  
  // Technical Support & Resistance Levels
  resistanceLevel: number;
  supportLevel: number;
  pivotPoint: number;
  atr: number;
  
  // Moving Averages & Technical Metrics
  ema20: number;
  sma50: number;
  sma200?: number;
  rsi: number;
  momentumScore: number; // -10.0 to +10.0
  breakoutSignal: 'BULLISH_BREAKOUT' | 'BEARISH_BREAKDOWN' | 'TESTING_RESISTANCE' | 'TESTING_SUPPORT' | 'IN_RANGE';
}

export interface HorizonPrediction {
  horizon: ForecastHorizon;
  horizonLabel: string; // 'Next 1 Hour' | 'Next 1 Day' | 'Next 1 Week'
  timeframeReference: HTFTimeframe;
  predictedBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidenceScore: number; // e.g. 78%
  
  // Spot Price Forecast
  currentSpot: number;
  projectedSpotTarget: number;
  projectedRangeLow: number;
  projectedRangeHigh: number;
  expectedMovePoints: number;
  expectedMovePercent: number;
  
  // F&O Trade Recommendation for this Horizon
  recommendedStrike: number;
  recommendedType: OptionType;
  recommendedContractLTP: number;
  target1LTP: number;
  target2LTP: number;
  stopLossLTP: number;
  riskRewardRatio: string;
  winProbabilityPct: number;
  
  // Analytical Insights
  keyCatalyst: string;
  invalidationLevel: number;
  executionAdvice: string;
}

export interface ExpiryForecast {
  expiryType: 'NEXT_1_WEEK' | 'NEXT_2_WEEK';
  expiryIndex: number;
  expiryDateStr: string;
  daysToExpiry: number;
  
  // Trend & Pattern Synthesis
  trendDirection: 'BULLISH_EXPANSION' | 'BEARISH_BREAKDOWN' | 'RANGE_PINNING' | 'VOLATILITY_SQUEEZE';
  trendDirectionLabel: string;
  candleSynthesisRationale: string;
  supportFloor: number;
  resistanceCeiling: number;
  breakoutTriggerLevel: number;
  
  // Settlement Projection
  projectedSettlementSpot: number;
  expectedSettlementRange: [number, number];
  maxPainStrike: number;
  expectedPCR: number;
  
  // Strike Recommendation
  recommendedStrike: number;
  recommendedType: OptionType;
  entryZone: [number, number];
  contractLTP: number;
  target1: number;
  target2: number;
  stopLoss: number;
  riskReward: string;
  winProbability: number;
  projectedROI: number; // e.g. 35%
  
  // Greeks & Decay Profile
  delta: number;
  thetaPerDay: number;
  gammaRisk: 'LOW' | 'MODERATE' | 'HIGH';
  strategyName: string; // e.g. "Bull Call Spread" / "Directional Long Call" / "Iron Condor"
  strategyDescription: string;
  hedgingNote: string;
  capitalProtectionRules: string[];
}

export interface MultiTimeframePredictionSuite {
  ticker: TickerConfig;
  generatedAt: string;
  overallHTFBias: 'STRONG_BULLISH' | 'BULLISH' | 'NEUTRAL_CONSOLIDATION' | 'BEARISH' | 'STRONG_BEARISH';
  confluenceScore: number; // -100 to +100
  confluenceSummary: string;
  
  // Timeframe pattern analyses
  h1Pattern: HTFCandlePatternResult;
  d1Pattern: HTFCandlePatternResult;
  w1Pattern: HTFCandlePatternResult;
  
  // Horizon predictions
  next1Hour: HorizonPrediction;
  next1Day: HorizonPrediction;
  next1Week: HorizonPrediction;
  
  // Expiry predictions
  week1Expiry: ExpiryForecast;
  week2Expiry: ExpiryForecast;
}
