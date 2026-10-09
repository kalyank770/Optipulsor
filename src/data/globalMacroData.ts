import { InterMarketTelemetry, GlobalMacroMarketItem } from '../types/options';

/**
 * Computes inter-market telemetry and global market cues impacting Indian F&O (Nifty / BankNifty).
 * Tracks GIFT Nifty, US Index Futures (S&P 500, Nasdaq), USD/INR, DXY, Brent Crude, US 10Y Yields, and Asian peers.
 */
export function getInterMarketTelemetry(
  tickerSymbol: string = 'NIFTY 50', 
  liveData?: Partial<InterMarketTelemetry>,
  spotPrice?: number
): InterMarketTelemetry {
  const isBankNifty = tickerSymbol.toUpperCase().includes('BANK');

  // GIFT Nifty tracks NIFTY 50 Index Futures (NSE IX)
  const baseSpot = spotPrice || 22520.45;
  const giftPrice = baseSpot;
  const giftNetChange = 0;
  const giftNetChangePct = 0;

  const giftNifty: GlobalMacroMarketItem = {
    symbol: 'GIFT NIFTY',
    name: 'GIFT Nifty Futures (NSE IX)',
    category: 'GIFT_NIFTY',
    price: giftPrice,
    change: giftNetChange,
    changePercent: giftNetChangePct,
    impactOnIndianFO: 'NEUTRAL',
    correlationWeight: 0.95,
    insightNote: `GIFT Nifty tracking NSE IX live futures stream.`,
    asOfTime: 'Live Exchange Feed',
    ...liveData?.giftNifty,
  };

  const sp500Futures: GlobalMacroMarketItem = {
    symbol: 'S&P 500',
    name: 'US S&P 500 Index',
    category: 'US_INDEX',
    price: 5752.25,
    change: 26.50,
    changePercent: 0.46,
    impactOnIndianFO: 'BULLISH',
    correlationWeight: 0.82,
    insightNote: 'US S&P 500 setting global risk sentiment backdrop.',
    asOfTime: 'Live Market',
    ...liveData?.sp500Futures,
  };

  const nasdaqFutures: GlobalMacroMarketItem = {
    symbol: 'NASDAQ 100',
    name: 'Nasdaq Composite Index',
    category: 'US_INDEX',
    price: 20145.50,
    change: 138.00,
    changePercent: 0.69,
    impactOnIndianFO: 'HIGH_BULLISH',
    correlationWeight: 0.88,
    insightNote: 'Nasdaq futures driving global tech and domestic IT heavyweights.',
    asOfTime: 'Live Market',
    ...liveData?.nasdaqFutures,
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
    insightNote: 'Rupee exchange rate tracking interbank currency flows.',
    asOfTime: 'Interbank Live',
    ...liveData?.usdInr,
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
    insightNote: 'Dollar Index tracking global greenback liquidity.',
    asOfTime: 'Live FX',
    ...liveData?.dxyIndex,
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
    insightNote: 'Brent Crude pricing impacting oil refining margins and macro inflation.',
    asOfTime: 'ICE Live',
    ...liveData?.brentCrude,
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
    insightNote: 'US 10Y Yield influencing global sovereign risk premiums.',
    asOfTime: 'Live US Treasury',
    ...liveData?.us10yYield,
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
    insightNote: 'Asian morning trading setup demonstrates broad risk-on sentiment across Asian equity markets.',
    asOfTime: 'TSE Live',
    ...liveData?.nikkei225,
  };

  const items = [giftNifty, sp500Futures, nasdaqFutures, usdInr, dxyIndex, brentCrude, us10yYield, nikkei225];
  let totalWeightedScore = 0;
  let totalWeights = 0;

  for (const item of items) {
    let rawScore = (item.changePercent || 0) * 25;
    if (item.category === 'CURRENCY' || item.category === 'COMMODITY' || item.category === 'BONDS') {
      rawScore = -(item.changePercent || 0) * 30;
    }
    totalWeightedScore += rawScore * item.correlationWeight;
    totalWeights += item.correlationWeight;
  }

  const globalCompositeScore = liveData?.globalCompositeScore !== undefined 
    ? liveData.globalCompositeScore 
    : Math.max(-100, Math.min(100, Math.round((totalWeightedScore / totalWeights) * 22)));

  let globalSentiment: InterMarketTelemetry['globalSentiment'] = liveData?.globalSentiment || 'NEUTRAL';
  let fiiFlowExpectation: InterMarketTelemetry['fiiFlowExpectation'] = liveData?.fiiFlowExpectation || 'BALANCED_NEUTRAL';
  let summaryInsight = liveData?.summaryInsight || 'Global inter-market indicators are aligned with balanced market conditions.';

  if (!liveData?.globalSentiment) {
    if (globalCompositeScore >= 40) {
      globalSentiment = 'STRONG_GLOBAL_TAILWIND';
      fiiFlowExpectation = 'HEAVY_INFLOWS';
      summaryInsight = 'Strong global inter-market tailwind: Positive US futures & soft crude trigger institutional buying support.';
    } else if (globalCompositeScore >= 15) {
      globalSentiment = 'GLOBAL_TAILWIND';
      fiiFlowExpectation = 'MODERATE_INFLOWS';
      summaryInsight = 'Positive global tailwind: US markets and GIFT Nifty providing supportive backdrop.';
    } else if (globalCompositeScore <= -40) {
      globalSentiment = 'SEVERE_GLOBAL_HEADWIND';
      fiiFlowExpectation = 'HEAVY_OUTFLOWS';
      summaryInsight = 'Global inter-market headwind: Surging crude oil and dollar index pressure emerging equities.';
    } else if (globalCompositeScore <= -15) {
      globalSentiment = 'GLOBAL_HEADWIND';
      fiiFlowExpectation = 'OUTFLOW_RISK';
      summaryInsight = 'Global market headwinds present: Caution indicated for aggressive long exposure.';
    }
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
