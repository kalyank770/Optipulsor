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
    spotPrice: 710.90,
    change: 6.00,
    changePercent: 0.85,
    dayHigh: 716.50,
    dayLow: 705.10,
    prevClose: 704.90,
    buildup: 'Long Buildup',
    pcr: 1.13,
    volume: 12463013,
    deliveryPercent: 62.5,
    niftyContributionPoints: 2.2,
  },
  {
    symbol: 'RELIANCE',
    name: 'Reliance Industries Ltd',
    sector: 'Energy',
    niftyWeight: 9.4,
    spotPrice: 1160.00,
    change: 1.10,
    changePercent: 0.09,
    dayHigh: 1166.80,
    dayLow: 1152.20,
    prevClose: 1158.90,
    buildup: 'Long Buildup',
    pcr: 0.98,
    volume: 8306654,
    deliveryPercent: 46.2,
    niftyContributionPoints: 0.2,
  },
  {
    symbol: 'ICICIBANK',
    name: 'ICICI Bank Ltd',
    sector: 'Banking',
    niftyWeight: 7.9,
    bankNiftyWeight: 23.4,
    spotPrice: 1355.20,
    change: 15.20,
    changePercent: 1.13,
    dayHigh: 1355.40,
    dayLow: 1329.40,
    prevClose: 1340.00,
    buildup: 'Long Buildup',
    pcr: 0.96,
    volume: 3511885,
    deliveryPercent: 50.4,
    niftyContributionPoints: 2.0,
  },
  {
    symbol: 'INFY',
    name: 'Infosys Ltd',
    sector: 'IT',
    niftyWeight: 5.8,
    spotPrice: 1052.00,
    change: 32.00,
    changePercent: 3.14,
    dayHigh: 1058.90,
    dayLow: 1027.00,
    prevClose: 1020.00,
    buildup: 'Long Buildup',
    pcr: 1.09,
    volume: 16499872,
    deliveryPercent: 44.1,
    niftyContributionPoints: 4.1,
  },
  {
    symbol: 'TCS',
    name: 'Tata Consultancy Services',
    sector: 'IT',
    niftyWeight: 3.9,
    spotPrice: 2247.40,
    change: 122.40,
    changePercent: 5.76,
    dayHigh: 2262.00,
    dayLow: 2155.00,
    prevClose: 2125.00,
    buildup: 'Long Buildup',
    pcr: 0.96,
    volume: 8637699,
    deliveryPercent: 50.2,
    niftyContributionPoints: 5.1,
  },
  {
    symbol: 'BHARTIARTL',
    name: 'Bharti Airtel Ltd',
    sector: 'Telecom',
    niftyWeight: 4.3,
    spotPrice: 1786.20,
    change: 7.50,
    changePercent: 0.42,
    dayHigh: 1793.40,
    dayLow: 1756.20,
    prevClose: 1778.70,
    buildup: 'Long Buildup',
    pcr: 1.15,
    volume: 4135003,
    deliveryPercent: 52.6,
    niftyContributionPoints: 0.4,
  },
  {
    symbol: 'LT',
    name: 'Larsen & Toubro Ltd',
    sector: 'Infra',
    niftyWeight: 4.1,
    spotPrice: 3639.90,
    change: 12.40,
    changePercent: 0.34,
    dayHigh: 3657.00,
    dayLow: 3592.90,
    prevClose: 3627.50,
    buildup: 'Long Buildup',
    pcr: 1.14,
    volume: 1363202,
    deliveryPercent: 50.7,
    niftyContributionPoints: 0.3,
  },
  {
    symbol: 'SBIN',
    name: 'State Bank of India',
    sector: 'Banking',
    niftyWeight: 3.2,
    bankNiftyWeight: 10.5,
    spotPrice: 946.80,
    change: 5.80,
    changePercent: 0.62,
    dayHigh: 949.40,
    dayLow: 938.60,
    prevClose: 941.00,
    buildup: 'Long Buildup',
    pcr: 0.96,
    volume: 4985159,
    deliveryPercent: 50.4,
    niftyContributionPoints: 0.5,
  },
  {
    symbol: 'AXISBANK',
    name: 'Axis Bank Ltd',
    sector: 'Banking',
    niftyWeight: 3.1,
    bankNiftyWeight: 11.2,
    spotPrice: 1263.20,
    change: 10.20,
    changePercent: 0.81,
    dayHigh: 1263.50,
    dayLow: 1242.20,
    prevClose: 1253.00,
    buildup: 'Long Buildup',
    pcr: 1.08,
    volume: 4069957,
    deliveryPercent: 66.5,
    niftyContributionPoints: 0.6,
  },
  {
    symbol: 'KOTAKBANK',
    name: 'Kotak Mahindra Bank',
    sector: 'Banking',
    niftyWeight: 2.8,
    bankNiftyWeight: 9.8,
    spotPrice: 438.95,
    change: -4.45,
    changePercent: -1.00,
    dayHigh: 443.35,
    dayLow: 437.60,
    prevClose: 443.40,
    buildup: 'Short Buildup',
    pcr: 0.57,
    volume: 15622037,
    deliveryPercent: 62.7,
    niftyContributionPoints: -0.6,
  },
  {
    symbol: 'ITC',
    name: 'ITC Ltd',
    sector: 'FMCG',
    niftyWeight: 3.8,
    spotPrice: 259.40,
    change: 1.50,
    changePercent: 0.58,
    dayHigh: 260.75,
    dayLow: 257.20,
    prevClose: 257.90,
    buildup: 'Long Buildup',
    pcr: 1.15,
    volume: 9957405,
    deliveryPercent: 52.4,
    niftyContributionPoints: 0.5,
  },
  {
    symbol: 'TATAMOTORS',
    name: 'Tata Motors Ltd',
    sector: 'Auto',
    niftyWeight: 2.2,
    spotPrice: 1500.00,
    change: 0.00,
    changePercent: 0.00,
    dayHigh: 1500.00,
    dayLow: 1500.00,
    prevClose: 1500.00,
    buildup: 'Long Buildup',
    pcr: 0.55,
    volume: 5000000,
    deliveryPercent: 53.7,
    niftyContributionPoints: 0.0,
  },
  {
    symbol: 'BAJFINANCE',
    name: 'Bajaj Finance Ltd',
    sector: 'Financials',
    niftyWeight: 2.0,
    spotPrice: 978.20,
    change: 20.95,
    changePercent: 2.19,
    dayHigh: 979.45,
    dayLow: 946.10,
    prevClose: 957.25,
    buildup: 'Long Buildup',
    pcr: 0.96,
    volume: 5085400,
    deliveryPercent: 50.3,
    niftyContributionPoints: 1.0,
  },
  {
    symbol: 'MARUTI',
    name: 'Maruti Suzuki India',
    sector: 'Auto',
    niftyWeight: 1.6,
    spotPrice: 11214.00,
    change: -101.00,
    changePercent: -0.89,
    dayHigh: 11349.00,
    dayLow: 11125.00,
    prevClose: 11315.00,
    buildup: 'Short Buildup',
    pcr: 0.55,
    volume: 583701,
    deliveryPercent: 56.0,
    niftyContributionPoints: -0.3,
  },
  {
    symbol: 'SUNPHARMA',
    name: 'Sun Pharmaceutical Industries',
    sector: 'Pharma',
    niftyWeight: 1.6,
    spotPrice: 1761.50,
    change: 1.50,
    changePercent: 0.09,
    dayHigh: 1769.90,
    dayLow: 1750.60,
    prevClose: 1760.00,
    buildup: 'Long Buildup',
    pcr: 1.13,
    volume: 665967,
    deliveryPercent: 47.9,
    niftyContributionPoints: 0.0,
  },
];

/**
 * Computes deep constituent breadth, weighted delta contribution, and sectoral alignment
 */
export function analyzeNiftyConstituents(
  symbol: string,
  constituents: NiftyConstituent[] = NIFTY_DERIVATIVE_COMPANIES,
  parentChangePercent?: number
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

  // If using the fallback static array, shift movements so they reflect the live index change;
  // If real live exchange constituent quotes are provided, preserve authentic live changes without alteration (deltaShift = 0)
  const isFallbackData = constituents === NIFTY_DERIVATIVE_COMPANIES;
  const deltaShift = (isFallbackData && typeof parentChangePercent === 'number') 
    ? Number((parentChangePercent).toFixed(2)) 
    : 0;

  for (const c of constituents) {
    const weight = isBankNifty ? (c.bankNiftyWeight || 0) : c.niftyWeight;
    if (isBankNifty && (!c.bankNiftyWeight || c.bankNiftyWeight === 0)) {
      continue; // only banking stocks for BankNifty
    }

    const effectiveChangePercent = Number((c.changePercent + deltaShift).toFixed(2));
    const pointMultiplier = isBankNifty ? 5.43 : 2.269;
    const effectivePoints = Number(((effectiveChangePercent * weight * pointMultiplier) / 10).toFixed(1));

    if (effectiveChangePercent > 0.05) {
      advances++;
      gainersList.push({ symbol: c.symbol, changePercent: effectiveChangePercent, points: effectivePoints });
    } else if (effectiveChangePercent < -0.05) {
      declines++;
      draggersList.push({ symbol: c.symbol, changePercent: effectiveChangePercent, points: effectivePoints });
    } else {
      unchanged++;
    }

    const stockDelta = (weight / 100) * effectiveChangePercent;
    totalWeightedDelta += stockDelta;
    netPointsImpact += effectivePoints;

    if (!sectorMap[c.sector]) {
      sectorMap[c.sector] = { weight: 0, points: 0, deltaSum: 0, count: 0, leadingStock: c.symbol, maxChange: effectiveChangePercent };
    }
    sectorMap[c.sector].weight += weight;
    sectorMap[c.sector].points += effectivePoints;
    sectorMap[c.sector].deltaSum += effectiveChangePercent;
    sectorMap[c.sector].count += 1;
    if (effectiveChangePercent > sectorMap[c.sector].maxChange) {
      sectorMap[c.sector].maxChange = effectiveChangePercent;
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
    constituents,
  };
}
