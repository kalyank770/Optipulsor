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
  category: 'Macro' | 'Earnings' | 'Policy' | 'Sector' | 'Geopolitics';
  link?: string;
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
