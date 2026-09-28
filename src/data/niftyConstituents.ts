import { NiftyConstituent, NiftyConstituentAnalysis, SectoralContribution } from '../types/options';

/**
 * Top Nifty 50 and Bank Nifty Derivative Constituent Heavyweight Companies
 * These top stocks account for ~65% of the Nifty 50 Index and ~90% of Bank Nifty.
 */
export const NIFTY_DERIVATIVE_COMPANIES: NiftyConstituent[] = [
  {
    symbol: 'HDFCBANK',
    name: 'HDFC Bank Ltd',
    sector: 'Banking',
    niftyWeight: 11.6,
    bankNiftyWeight: 28.2,
    spotPrice: 1632.50,
    change: -35.30,
    changePercent: -2.12,
    dayHigh: 1668.00,
    dayLow: 1628.00,
    prevClose: 1667.80,
    buildup: 'Short Buildup',
    pcr: 0.72,
    volume: 18500000,
    deliveryPercent: 68.4,
    niftyContributionPoints: -61.4,
  },
  {
    symbol: 'RELIANCE',
    name: 'Reliance Industries Ltd',
    sector: 'Energy',
    niftyWeight: 9.4,
    spotPrice: 2909.20,
    change: -57.80,
    changePercent: -1.95,
    dayHigh: 2965.00,
    dayLow: 2902.00,
    prevClose: 2967.00,
    buildup: 'Short Buildup',
    pcr: 0.68,
    volume: 8900000,
    deliveryPercent: 58.1,
    niftyContributionPoints: -45.8,
  },
  {
    symbol: 'ICICIBANK',
    name: 'ICICI Bank Ltd',
    sector: 'Banking',
    niftyWeight: 7.9,
    bankNiftyWeight: 23.4,
    spotPrice: 1208.50,
    change: -23.90,
    changePercent: -1.94,
    dayHigh: 1234.00,
    dayLow: 1205.00,
    prevClose: 1232.40,
    buildup: 'Short Buildup',
    pcr: 0.74,
    volume: 14200000,
    deliveryPercent: 64.0,
    niftyContributionPoints: -38.3,
  },
  {
    symbol: 'INFY',
    name: 'Infosys Ltd',
    sector: 'IT',
    niftyWeight: 5.8,
    spotPrice: 1872.00,
    change: -28.50,
    changePercent: -1.50,
    dayHigh: 1902.00,
    dayLow: 1868.00,
    prevClose: 1900.50,
    buildup: 'Long Unwinding',
    pcr: 0.81,
    volume: 6400000,
    deliveryPercent: 56.2,
    niftyContributionPoints: -21.8,
  },
  {
    symbol: 'TCS',
    name: 'Tata Consultancy Services',
    sector: 'IT',
    niftyWeight: 3.9,
    spotPrice: 4210.00,
    change: -51.50,
    changePercent: -1.21,
    dayHigh: 4265.00,
    dayLow: 4200.00,
    prevClose: 4261.50,
    buildup: 'Long Unwinding',
    pcr: 0.85,
    volume: 2400000,
    deliveryPercent: 62.5,
    niftyContributionPoints: -11.8,
  },
  {
    symbol: 'BHARTIARTL',
    name: 'Bharti Airtel Ltd',
    sector: 'Telecom',
    niftyWeight: 4.3,
    spotPrice: 1678.00,
    change: -14.40,
    changePercent: -0.85,
    dayHigh: 1695.00,
    dayLow: 1672.00,
    prevClose: 1692.40,
    buildup: 'Long Unwinding',
    pcr: 0.94,
    volume: 5200000,
    deliveryPercent: 60.0,
    niftyContributionPoints: -9.1,
  },
  {
    symbol: 'LT',
    name: 'Larsen & Toubro Ltd',
    sector: 'Infra',
    niftyWeight: 4.1,
    spotPrice: 3572.00,
    change: -83.00,
    changePercent: -2.27,
    dayHigh: 3660.00,
    dayLow: 3565.00,
    prevClose: 3655.00,
    buildup: 'Short Buildup',
    pcr: 0.71,
    volume: 2300000,
    deliveryPercent: 54.3,
    niftyContributionPoints: -23.2,
  },
  {
    symbol: 'SBIN',
    name: 'State Bank of India',
    sector: 'Banking',
    niftyWeight: 2.9,
    bankNiftyWeight: 11.2,
    spotPrice: 786.50,
    change: -16.40,
    changePercent: -2.04,
    dayHigh: 804.00,
    dayLow: 782.00,
    prevClose: 802.90,
    buildup: 'Short Buildup',
    pcr: 0.70,
    volume: 19800000,
    deliveryPercent: 59.8,
    niftyContributionPoints: -14.8,
  },
  {
    symbol: 'AXISBANK',
    name: 'Axis Bank Ltd',
    sector: 'Banking',
    niftyWeight: 3.2,
    bankNiftyWeight: 11.4,
    spotPrice: 1189.00,
    change: -24.30,
    changePercent: -2.00,
    dayHigh: 1215.00,
    dayLow: 1185.00,
    prevClose: 1213.30,
    buildup: 'Short Buildup',
    pcr: 0.73,
    volume: 7800000,
    deliveryPercent: 58.0,
    niftyContributionPoints: -16.0,
  },
  {
    symbol: 'KOTAKBANK',
    name: 'Kotak Mahindra Bank',
    sector: 'Banking',
    niftyWeight: 2.7,
    bankNiftyWeight: 10.2,
    spotPrice: 1802.00,
    change: -34.50,
    changePercent: -1.88,
    dayHigh: 1838.00,
    dayLow: 1798.00,
    prevClose: 1836.50,
    buildup: 'Short Buildup',
    pcr: 0.76,
    volume: 4100000,
    deliveryPercent: 55.4,
    niftyContributionPoints: -12.7,
  },
  {
    symbol: 'TATAMOTORS',
    name: 'Tata Motors Ltd',
    sector: 'Auto',
    niftyWeight: 2.1,
    spotPrice: 952.00,
    change: -20.30,
    changePercent: -2.09,
    dayHigh: 974.00,
    dayLow: 948.00,
    prevClose: 972.30,
    buildup: 'Short Buildup',
    pcr: 0.75,
    volume: 11500000,
    deliveryPercent: 51.6,
    niftyContributionPoints: -11.0,
  },
  {
    symbol: 'BAJFINANCE',
    name: 'Bajaj Finance Ltd',
    sector: 'Financials',
    niftyWeight: 1.9,
    spotPrice: 7060.00,
    change: -135.00,
    changePercent: -1.88,
    dayHigh: 7200.00,
    dayLow: 7040.00,
    prevClose: 7195.00,
    buildup: 'Short Buildup',
    pcr: 0.78,
    volume: 1500000,
    deliveryPercent: 53.7,
    niftyContributionPoints: -9.0,
  },
  {
    symbol: 'MARUTI',
    name: 'Maruti Suzuki India',
    sector: 'Auto',
    niftyWeight: 1.8,
    spotPrice: 12560.00,
    change: -180.00,
    changePercent: -1.41,
    dayHigh: 12750.00,
    dayLow: 12520.00,
    prevClose: 12740.00,
    buildup: 'Long Unwinding',
    pcr: 0.82,
    volume: 520000,
    deliveryPercent: 55.2,
    niftyContributionPoints: -6.4,
  },
  {
    symbol: 'ITC',
    name: 'ITC Ltd',
    sector: 'FMCG',
    niftyWeight: 3.8,
    spotPrice: 501.20,
    change: -1.30,
    changePercent: -0.26,
    dayHigh: 505.00,
    dayLow: 499.50,
    prevClose: 502.50,
    buildup: 'Long Unwinding',
    pcr: 0.98,
    volume: 9800000,
    deliveryPercent: 65.2,
    niftyContributionPoints: -2.5,
  },
  {
    symbol: 'SUNPHARMA',
    name: 'Sun Pharmaceutical Industries',
    sector: 'Pharma',
    niftyWeight: 1.6,
    spotPrice: 1908.00,
    change: +8.00,
    changePercent: +0.42,
    dayHigh: 1920.00,
    dayLow: 1895.00,
    prevClose: 1900.00,
    buildup: 'Short Covering',
    pcr: 1.08,
    volume: 2100000,
    deliveryPercent: 58.4,
    niftyContributionPoints: +1.7,
  }
];

/**
 * Computes deep constituent breadth, weighted delta contribution, and sectoral alignment
 */
export function analyzeNiftyConstituents(
  symbol: string,
  constituents: NiftyConstituent[] = NIFTY_DERIVATIVE_COMPANIES
): NiftyConstituentAnalysis {
  let advances = 0;
  let declines = 0;
  let unchanged = 0;
  let totalWeightedDelta = 0;
  let netPointsImpact = 0;

  const gainersList: { symbol: string; changePercent: number; points: number }[] = [];
  const draggersList: { symbol: string; changePercent: number; points: number }[] = [];

  // Sectoral aggregator
  const sectorMap: Record<string, { weight: number; points: number; deltaSum: number; count: number; leadingStock: string; maxChange: number }> = {};

  const isBankNifty = symbol.includes('BANK');

  for (const c of constituents) {
    const weight = isBankNifty ? (c.bankNiftyWeight || 0) : c.niftyWeight;
    if (isBankNifty && (!c.bankNiftyWeight || c.bankNiftyWeight === 0)) {
      continue; // only banking stocks for BankNifty
    }

    if (c.changePercent > 0.05) {
      advances++;
      gainersList.push({ symbol: c.symbol, changePercent: c.changePercent, points: c.niftyContributionPoints });
    } else if (c.changePercent < -0.05) {
      declines++;
      draggersList.push({ symbol: c.symbol, changePercent: c.changePercent, points: c.niftyContributionPoints });
    } else {
      unchanged++;
    }

    const stockDelta = (weight / 100) * c.changePercent;
    totalWeightedDelta += stockDelta;
    netPointsImpact += c.niftyContributionPoints;

    if (!sectorMap[c.sector]) {
      sectorMap[c.sector] = { weight: 0, points: 0, deltaSum: 0, count: 0, leadingStock: c.symbol, maxChange: c.changePercent };
    }
    sectorMap[c.sector].weight += weight;
    sectorMap[c.sector].points += c.niftyContributionPoints;
    sectorMap[c.sector].deltaSum += c.changePercent;
    sectorMap[c.sector].count += 1;
    if (c.changePercent > sectorMap[c.sector].maxChange) {
      sectorMap[c.sector].maxChange = c.changePercent;
      sectorMap[c.sector].leadingStock = c.symbol;
    }
  }

  gainersList.sort((a, b) => b.points - a.points);
  draggersList.sort((a, b) => a.points - b.points);

  const totalEvaluated = advances + declines + unchanged;
  const advancesDeclinesRatio = declines > 0 ? Number((advances / declines).toFixed(2)) : advances;

  // Breadth score from -10 to +10
  const breadthScore = Number((
    ((advances - declines) / Math.max(1, totalEvaluated)) * 6.0 +
    (totalWeightedDelta * 5.0)
  ).toFixed(1));

  let overallHeavyweightBias: NiftyConstituentAnalysis['overallHeavyweightBias'] = 'NEUTRAL';
  if (breadthScore >= 4.0 && totalWeightedDelta >= 0.25) overallHeavyweightBias = 'STRONG_BULLISH';
  else if (breadthScore >= 1.5 || totalWeightedDelta > 0.05) overallHeavyweightBias = 'BULLISH';
  else if (breadthScore <= -4.0 && totalWeightedDelta <= -0.25) overallHeavyweightBias = 'STRONG_BEARISH';
  else if (breadthScore <= -1.5 || totalWeightedDelta < -0.05) overallHeavyweightBias = 'BEARISH';

  // Build Sectoral Breakdown list
  const sectoralBreakdown: SectoralContribution[] = Object.entries(sectorMap).map(([sector, data]) => {
    const avgChange = data.count > 0 ? Number((data.deltaSum / data.count).toFixed(2)) : 0;
    const sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = avgChange >= 0.20 ? 'BULLISH' : avgChange <= -0.20 ? 'BEARISH' : 'NEUTRAL';
    return {
      sector,
      weight: Number(data.weight.toFixed(1)),
      netChangePercent: avgChange,
      contributionPoints: Number(data.points.toFixed(1)),
      sentiment,
      leadingStock: data.leadingStock,
    };
  }).sort((a, b) => b.weight - a.weight);

  const topGainerStr = gainersList.slice(0, 2).map(g => `${g.symbol} (+${g.changePercent}%)`).join(', ');
  const topDraggerStr = draggersList.slice(0, 2).map(d => `${d.symbol} (${d.changePercent}%)`).join(', ');

  const summaryNote = `${advances} of ${totalEvaluated} heavyweights advancing (A/D: ${advancesDeclinesRatio}). Net constituent impact: ${netPointsImpact >= 0 ? '+' : ''}${netPointsImpact.toFixed(1)} Nifty pts. Leaders: ${topGainerStr || 'None'}. Laggards: ${topDraggerStr || 'None'}.`;

  return {
    advances,
    declines,
    unchanged,
    advancesDeclinesRatio,
    weightedConstituentDelta: Number(totalWeightedDelta.toFixed(2)),
    netNiftyPointImpact: Number(netPointsImpact.toFixed(1)),
    overallHeavyweightBias,
    breadthScore,
    topGainers: gainersList.slice(0, 4),
    topDraggers: draggersList.slice(0, 4),
    sectoralBreakdown,
    summaryNote,
  };
}
