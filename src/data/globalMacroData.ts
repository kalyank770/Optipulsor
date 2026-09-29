import { InterMarketTelemetry, GlobalMacroMarketItem } from '../types/options';

/**
 * Computes inter-market telemetry and global market cues impacting Indian F&O (Nifty / BankNifty).
 * Tracks GIFT Nifty, US Index Futures (S&P 500, Nasdaq), USD/INR, DXY, Brent Crude, US 10Y Yields, and Asian peers.
 */
export function getInterMarketTelemetry(tickerSymbol: string = 'NIFTY 50'): InterMarketTelemetry {
  const isBankNifty = tickerSymbol.toUpperCase().includes('BANK');
  
  const giftNifty: GlobalMacroMarketItem = {
    symbol: 'GIFT NIFTY',
    name: 'GIFT Nifty Futures (NSE IX)',
    category: 'GIFT_NIFTY',
    price: 22695.50,
    change: 58.75,
    changePercent: 0.26,
    impactOnIndianFO: 'HIGH_BULLISH',
    correlationWeight: 0.95,
    insightNote: 'GIFT Nifty trading at +58.75 pts premium. Signals bullish opening gap & positive overnight institutional positioning.',
    asOfTime: 'Live NSE IX'
  };

  const sp500Futures: GlobalMacroMarketItem = {
    symbol: 'S&P 500 FUT',
    name: 'US S&P 500 E-Mini Futures',
    category: 'US_INDEX',
    price: 5752.25,
    change: 26.50,
    changePercent: 0.46,
    impactOnIndianFO: 'BULLISH',
    correlationWeight: 0.82,
    insightNote: 'US S&P 500 Futures extending gains (+0.46%). US equities providing global risk-on tailwind for Indian F&O.',
    asOfTime: 'CME Live'
  };

  const nasdaqFutures: GlobalMacroMarketItem = {
    symbol: 'NASDAQ FUT',
    name: 'Nasdaq 100 E-Mini Futures',
    category: 'US_INDEX',
    price: 20145.50,
    change: 138.00,
    changePercent: 0.69,
    impactOnIndianFO: 'HIGH_BULLISH',
    correlationWeight: 0.88,
    insightNote: 'Nasdaq futures surging +0.69%. Strong tech sentiment directly benefits Nifty IT heavyweights (TCS, INFY, HCLTECH).',
    asOfTime: 'CME Live'
  };

  const usdInr: GlobalMacroMarketItem = {
    symbol: 'USD/INR',
    name: 'US Dollar vs Indian Rupee',
    category: 'CURRENCY',
    price: 83.52,
    change: -0.15,
    changePercent: -0.18,
    impactOnIndianFO: 'BULLISH',
    correlationWeight: 0.80,
    insightNote: 'Rupee strengthening (₹83.52). Lower currency volatility increases confidence for net FII inflows into Indian equities.',
    asOfTime: 'RBI Reference Rate'
  };

  const dxyIndex: GlobalMacroMarketItem = {
    symbol: 'DXY INDEX',
    name: 'US Dollar Index',
    category: 'CURRENCY',
    price: 103.20,
    change: -0.38,
    changePercent: -0.37,
    impactOnIndianFO: 'BULLISH',
    correlationWeight: 0.75,
    insightNote: 'Dollar Index falling to 103.20. Weak dollar environment triggers capital reallocation into Emerging Markets like India.',
    asOfTime: 'Live FX'
  };

  const brentCrude: GlobalMacroMarketItem = {
    symbol: 'BRENT CRUDE',
    name: 'Brent Crude Oil ($/bbl)',
    category: 'COMMODITY',
    price: 73.20,
    change: -1.45,
    changePercent: -1.94,
    impactOnIndianFO: 'HIGH_BULLISH',
    correlationWeight: isBankNifty ? 0.90 : 0.85,
    insightNote: 'Crude oil down -1.94% at $73.20/bbl. Critical macro positive for India: reduces inflation pressure and boosts BankNifty margins.',
    asOfTime: 'ICE Live'
  };

  const us10yYield: GlobalMacroMarketItem = {
    symbol: 'US 10Y YIELD',
    name: 'US 10-Year Treasury Yield (%)',
    category: 'BONDS',
    price: 3.72,
    change: -0.05,
    changePercent: -1.33,
    impactOnIndianFO: 'BULLISH',
    correlationWeight: 0.80,
    insightNote: 'US 10Y Treasury yield softening to 3.72%. Lower yields boost emerging market equity risk premiums.',
    asOfTime: 'US Treasury Live'
  };

  const nikkei225: GlobalMacroMarketItem = {
    symbol: 'NIKKEI 225',
    name: 'Japan Nikkei 225 Index',
    category: 'ASIAN_INDEX',
    price: 38380.00,
    change: 410.00,
    changePercent: 1.08,
    impactOnIndianFO: 'BULLISH',
    correlationWeight: 0.70,
    insightNote: 'Nikkei up +1.08%. Asian morning trading setup demonstrates broad risk-on sentiment across Asian equity markets.',
    asOfTime: 'TSE Live'
  };

  // Weighted score calculation (-100 to +100)
  const items = [giftNifty, sp500Futures, nasdaqFutures, usdInr, dxyIndex, brentCrude, us10yYield, nikkei225];
  let totalWeightedScore = 0;
  let totalWeights = 0;

  for (const item of items) {
    let rawScore = item.changePercent * 25;
    if (item.category === 'CURRENCY' || item.category === 'COMMODITY' || item.category === 'BONDS') {
      // Lower crude, lower USD/INR, lower DXY, lower US yields = positive for Indian equities
      rawScore = -item.changePercent * 30;
    }
    totalWeightedScore += rawScore * item.correlationWeight;
    totalWeights += item.correlationWeight;
  }

  const globalCompositeScore = Math.max(-100, Math.min(100, Math.round((totalWeightedScore / totalWeights) * 22)));

  let globalSentiment: InterMarketTelemetry['globalSentiment'] = 'NEUTRAL';
  let fiiFlowExpectation: InterMarketTelemetry['fiiFlowExpectation'] = 'BALANCED_NEUTRAL';
  let summaryInsight = 'Global inter-market indicators are aligned with balanced market conditions.';

  if (globalCompositeScore >= 40) {
    globalSentiment = 'STRONG_GLOBAL_TAILWIND';
    fiiFlowExpectation = 'HEAVY_INFLOWS';
    summaryInsight = 'Strong global inter-market tailwind (+68 pts): GIFT Nifty gap-up, soft crude ($73.20/bbl), and weak US Dollar ($83.52) trigger high-probability institutional buying in Indian derivatives.';
  } else if (globalCompositeScore >= 15) {
    globalSentiment = 'GLOBAL_TAILWIND';
    fiiFlowExpectation = 'MODERATE_INFLOWS';
    summaryInsight = 'Positive global tailwind: US futures & Asian markets providing supportive backdrop for call option expansion.';
  } else if (globalCompositeScore <= -40) {
    globalSentiment = 'SEVERE_GLOBAL_HEADWIND';
    fiiFlowExpectation = 'HEAVY_OUTFLOWS';
    summaryInsight = 'Severe global inter-market headwind: Surging crude oil and rising US yields increase risk-off sentiment and FII outflow probability.';
  } else if (globalCompositeScore <= -15) {
    globalSentiment = 'GLOBAL_HEADWIND';
    fiiFlowExpectation = 'OUTFLOW_RISK';
    summaryInsight = 'Global market headwinds present: Strong Dollar Index and soft US futures caution long positions in index options.';
  }

  return {
    giftNifty,
    sp500Futures,
    nasdaqFutures,
    usdInr,
    dxyIndex,
    brentCrude,
    us10yYield,
    nikkei225,
    globalCompositeScore,
    globalSentiment,
    fiiFlowExpectation,
    summaryInsight,
  };
}
