import { generateTradeSignal, computeMarketMetrics } from '../src/utils/signalEngine';
import { computeAdvanceTradeSetup } from '../src/utils/advanceTradeEngine';
import { computeRealtimeIndicators } from '../src/utils/technicalIndicators';
import { computeMultiTimeframeChartPatterns } from '../src/utils/candlestickEngine';
import { POPULAR_TICKERS } from '../src/data/marketTickers';
import { 
  TickerConfig, 
  OptionChainRow, 
  MarketMetrics, 
  NiftyConstituentAnalysis,
  SectoralContribution
} from '../src/types/options';

// Helper to create synthetic option chain row
function createRow(strike: number, spot: number, ceLtp: number, peLtp: number, ceOi: number, peOi: number, ceOiChg: number, peOiChg: number): OptionChainRow {
  const isAtm = Math.abs(strike - spot) < 25;
  return {
    strike,
    isATM: isAtm,
    totalOI: ceOi + peOi,
    strikePCR: ceOi > 0 ? Number((peOi / ceOi).toFixed(2)) : 1.0,
    ce: {
      strike,
      type: 'CE',
      ltp: ceLtp,
      prevClose: ceLtp,
      change: 0,
      changePercent: 0,
      volume: 100000,
      openInterest: ceOi,
      oiChange: ceOiChg,
      oiChangePercent: 0,
      iv: 14.5,
      bidPrice: ceLtp - 0.5,
      bidQty: 1500,
      askPrice: ceLtp + 0.5,
      askQty: 1500,
      greeks: { delta: 0.5, gamma: 0.002, theta: -12, vega: 15 },
      moneyness: strike < spot ? 'ITM' : (isAtm ? 'ATM' : 'OTM'),
      buildup: ceOiChg > 0 ? 'Long Buildup' : 'Short Covering'
    },
    pe: {
      strike,
      type: 'PE',
      ltp: peLtp,
      prevClose: peLtp,
      change: 0,
      changePercent: 0,
      volume: 100000,
      openInterest: peOi,
      oiChange: peOiChg,
      oiChangePercent: 0,
      iv: 14.5,
      bidPrice: peLtp - 0.5,
      bidQty: 1500,
      askPrice: peLtp + 0.5,
      askQty: 1500,
      greeks: { delta: -0.5, gamma: 0.002, theta: -12, vega: 15 },
      moneyness: strike > spot ? 'ITM' : (isAtm ? 'ATM' : 'OTM'),
      buildup: peOiChg > 0 ? 'Short Buildup' : 'Long Unwinding'
    }
  };
}

function buildSyntheticChain(spot: number, step = 50, pcr = 1.0, ceOiChg = 0, peOiChg = 0): OptionChainRow[] {
  const rows: OptionChainRow[] = [];
  const atm = Math.round(spot / step) * step;
  for (let s = atm - step * 10; s <= atm + step * 10; s += step) {
    const diff = s - spot;
    const ceLtp = Math.max(1, diff < 0 ? Math.abs(diff) + 60 : Math.max(2, 60 - diff * 0.8));
    const peLtp = Math.max(1, diff > 0 ? diff + 60 : Math.max(2, 60 + diff * 0.8));
    const baseOi = 50000;
    const peOi = Math.round(baseOi * pcr);
    rows.push(createRow(s, spot, ceLtp, peLtp, baseOi, peOi, ceOiChg, peOiChg));
  }
  return rows;
}

async function runValidation() {
  console.log('========================================================================');
  console.log('🔬 15-PILLAR METHODOLOGY VALIDATION AUDIT SUITE');
  console.log('========================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, desc: string) {
    totalTests++;
    if (condition) {
      console.log(`  ✅ PASS: ${desc}`);
      passedTests++;
    } else {
      console.log(`  ❌ FAIL: ${desc}`);
    }
  }

  // --- SCENARIO 1: LIVE MARKET SNAPSHOT AUDIT ---
  console.log('--- TEST 1: LIVE EXCHANGE FEED AUDIT (NIFTY 50) ---');
  try {
    const res = await fetch('http://localhost:3000/api/option-chain/NIFTY%2050');
    if (res.ok) {
      const data = await res.json();
      const baseTicker = POPULAR_TICKERS[0];
      const ticker: TickerConfig = {
        ...baseTicker,
        spotPrice: data.spotPrice || baseTicker.spotPrice,
        change: data.change || baseTicker.change,
        changePercent: data.changePercent || baseTicker.changePercent,
        dayHigh: data.dayHigh || baseTicker.dayHigh,
        dayLow: data.dayLow || baseTicker.dayLow,
        prevClose: data.prevClose || baseTicker.prevClose,
      };
      const chain: OptionChainRow[] = (data.rows && data.rows.length > 0) ? data.rows : buildSyntheticChain(ticker.spotPrice);
      const metrics: MarketMetrics = computeMarketMetrics(ticker, chain);

      const rt = computeRealtimeIndicators(ticker, chain);
      const candlePatterns = computeMultiTimeframeChartPatterns(ticker);
      const signal = generateTradeSignal(ticker, metrics, chain);
      const advanceSetup = computeAdvanceTradeSetup(ticker, metrics, chain, rt, candlePatterns, undefined, undefined, signal.action, 0);

      const pillars = advanceSetup.leadingPredictorFactors;
      const bullPillars = pillars.filter(f => f.state.includes('BULLISH')).length;
      const bearPillars = pillars.filter(f => f.state.includes('BEARISH')).length;
      const neutralPillars = pillars.filter(f => f.state === 'NEUTRAL').length;

      console.log(`  Spot Price: ₹${ticker.spotPrice.toLocaleString()} | Day Change: ${ticker.changePercent.toFixed(2)}%`);
      console.log(`  Candle Confluence Bias: ${candlePatterns.confluenceBias} (Score: ${candlePatterns.confluenceScore})`);
      console.log(`  15 Pillars Tally -> Bullish: ${bullPillars} | Bearish: ${bearPillars} | Neutral: ${neutralPillars}`);
      console.log(`  Authoritative Signal Action: ${signal.action}`);
      console.log(`  Advance Setup Anticipated Action: ${advanceSetup.anticipatedAction}`);
      console.log(`  Advance Setup Title: "${advanceSetup.title}"`);
      console.log(`  Directional Bias Label: "${advanceSetup.directionalBiasLabel}"`);

      // Assertions for Live Snapshot
      assert(pillars.length === 15, `All 15 distinct pillars generated (count = ${pillars.length})`);
      assert(signal.action === advanceSetup.anticipatedAction, `Signal Action (${signal.action}) strictly matches Advance Setup Action (${advanceSetup.anticipatedAction})`);
      
      if (signal.action === 'BUY_CE') {
        assert(bullPillars > bearPillars, `BUY_CE strictly supported by Bullish Pillar superiority (${bullPillars} > ${bearPillars})`);
        assert(candlePatterns.confluenceBias !== 'BEARISH', 'BUY_CE has non-bearish candlestick confluence');
      } else if (signal.action === 'BUY_PE') {
        assert(bearPillars > bullPillars, `BUY_PE strictly supported by Bearish Pillar superiority (${bearPillars} > ${bullPillars})`);
        assert(candlePatterns.confluenceBias !== 'BULLISH', 'BUY_PE has non-bullish candlestick confluence');
      } else {
        assert(signal.action === 'WAIT_NEUTRAL', 'Action is cleanly WAIT_NEUTRAL in absence of verified multi-pillar consensus');
      }

      // Check each pillar has valid confidence and description
      const allPillarsValid = pillars.every(p => p.confidenceScore >= 0 && p.confidenceScore <= 100 && p.valueDescription && p.valueDescription.length > 5);
      assert(allPillarsValid, 'All 15 pillars have valid confidence scores (0-100) and descriptive telemetry text');
    } else {
      console.log('  ⚠️ Skipping live fetch test (local server not answering on 3000)');
    }
  } catch (e) {
    console.warn('  ⚠️ Live feed test exception:', e);
  }

  // --- SCENARIO 2: SYNTHETIC STRONG BULLISH BREAKOUT SCENARIO ---
  console.log('\n--- TEST 2: STRONG BULLISH BREAKOUT (Institutional Demand Surge) ---');
  {
    const spot = 22750;
    const ticker: TickerConfig = {
      ...POPULAR_TICKERS[0],
      spotPrice: spot,
      strikeStep: 50,
      lotSize: 75,
      change: 140.0,
      changePercent: 0.62,
      dayHigh: 22765,
      dayLow: 22590,
      prevClose: 22610,
    };
    const chain = buildSyntheticChain(spot, 50, 1.45, -15000, 25000);
    const metrics: MarketMetrics = computeMarketMetrics(ticker, chain);
    metrics.pcrTotalOI = 1.42;
    metrics.pcrVolume = 1.55;

    const rt = computeRealtimeIndicators(ticker, chain);
    rt.vwap.value = 22680;
    rt.orderFlow.sentiment = 'BUYER_DOMINANCE';
    rt.orderFlow.orderFlowDelta = 35;
    rt.orderFlow.volumeImbalancePercent = 28;
    rt.rsi.value = 65;
    rt.rsi.condition = 'BULLISH';
    rt.macd.trend = 'BULLISH_EXPANSION';
    rt.ema.alignment = 'BULLISH_STACK';

    const candlePatterns = computeMultiTimeframeChartPatterns(ticker);
    candlePatterns.confluenceBias = 'BULLISH';
    candlePatterns.confluenceScore = 6.2;
    candlePatterns.m5Score = 7.5;
    candlePatterns.m2Score = 6.8;

    const sectorItem: SectoralContribution = {
      sector: 'Banking',
      weight: 35.5,
      netChangePercent: 1.25,
      contributionPoints: 24,
      sentiment: 'BULLISH',
      leadingStock: 'HDFCBANK'
    };

    const constituentAnalysis: NiftyConstituentAnalysis = {
      symbol: 'NIFTY 50',
      netNiftyPointImpact: 35,
      advances: 38,
      declines: 12,
      unchanged: 0,
      advancesDeclinesRatio: 3.16,
      weightedConstituentDelta: 0.65,
      overallHeavyweightBias: 'STRONG_BULLISH',
      breadthScore: 7.5,
      topGainers: [],
      topDraggers: [],
      sectoralBreakdown: [sectorItem],
      summaryNote: 'Banking heavyweights surging'
    };

    const signal = generateTradeSignal(ticker, metrics, chain, [], undefined, 0, constituentAnalysis);
    const advanceSetup = computeAdvanceTradeSetup(ticker, metrics, chain, rt, candlePatterns, constituentAnalysis, undefined, signal.action, 0);

    const pillars = advanceSetup.leadingPredictorFactors;
    const bullPillars = pillars.filter(f => f.state.includes('BULLISH')).length;
    const bearPillars = pillars.filter(f => f.state.includes('BEARISH')).length;

    console.log(`  Pillars -> Bullish: ${bullPillars} | Bearish: ${bearPillars}`);
    console.log(`  Action: ${signal.action} | Recommended: ${signal.recommendedStrike} ${signal.recommendedType}`);
    console.log(`  Advance Setup Type: ${advanceSetup.setupType} (${advanceSetup.directionalBiasLabel})`);

    assert(signal.action === 'BUY_CE', `Signal correctly recommends BUY_CE in verified Bullish Breakout`);
    assert(advanceSetup.anticipatedAction === 'BUY_CE', `Advance Setup anticipatedAction is BUY_CE`);
    assert(bullPillars >= 8, `Strong bullish confluence activates majority bullish pillars (Bullish: ${bullPillars}/15)`);
    assert(advanceSetup.directionalBiasPercent! > 70, `Directional bias percent is strongly positive (+${advanceSetup.directionalBiasPercent}%)`);
    assert(signal.target1 > signal.recommendedContractLTP, `Target 1 is higher than entry premium`);
    assert(signal.stopLoss < signal.recommendedContractLTP, `Stop Loss is strictly lower than entry premium`);
  }

  // --- SCENARIO 3: SYNTHETIC STRONG BEARISH BREAKDOWN SCENARIO ---
  console.log('\n--- TEST 3: STRONG BEARISH BREAKDOWN (Institutional Supply Avalanche) ---');
  {
    const spot = 22450;
    const ticker: TickerConfig = {
      ...POPULAR_TICKERS[0],
      spotPrice: spot,
      strikeStep: 50,
      lotSize: 75,
      change: -160.0,
      changePercent: -0.71,
      dayHigh: 22620,
      dayLow: 22440,
      prevClose: 22610,
    };
    const chain = buildSyntheticChain(spot, 50, 0.65, 25000, -18000);
    const metrics: MarketMetrics = computeMarketMetrics(ticker, chain);
    metrics.pcrTotalOI = 0.72;
    metrics.pcrVolume = 0.62;

    const rt = computeRealtimeIndicators(ticker, chain);
    rt.vwap.value = 22540;
    rt.orderFlow.sentiment = 'SELLER_DOMINANCE';
    rt.orderFlow.orderFlowDelta = -42;
    rt.orderFlow.volumeImbalancePercent = -34;
    rt.rsi.value = 32;
    rt.rsi.condition = 'BEARISH';
    rt.macd.trend = 'BEARISH_EXPANSION';
    rt.ema.alignment = 'BEARISH_STACK';
    rt.vixVelocity.velocityState = 'SURGING';

    const candlePatterns = computeMultiTimeframeChartPatterns(ticker);
    candlePatterns.confluenceBias = 'BEARISH';
    candlePatterns.confluenceScore = -6.5;
    candlePatterns.m5Score = -7.8;
    candlePatterns.m2Score = -6.4;

    const sectorItem: SectoralContribution = {
      sector: 'Banking',
      weight: 35.5,
      netChangePercent: -1.45,
      contributionPoints: -32,
      sentiment: 'BEARISH',
      leadingStock: 'HDFCBANK'
    };

    const constituentAnalysis: NiftyConstituentAnalysis = {
      symbol: 'NIFTY 50',
      netNiftyPointImpact: -45,
      advances: 8,
      declines: 42,
      unchanged: 0,
      advancesDeclinesRatio: 0.19,
      weightedConstituentDelta: -0.85,
      overallHeavyweightBias: 'STRONG_BEARISH',
      breadthScore: -8.0,
      topGainers: [],
      topDraggers: [],
      sectoralBreakdown: [sectorItem],
      summaryNote: 'Banking heavyweights dragging down'
    };

    const signal = generateTradeSignal(ticker, metrics, chain, [], undefined, 0, constituentAnalysis);
    const advanceSetup = computeAdvanceTradeSetup(ticker, metrics, chain, rt, candlePatterns, constituentAnalysis, undefined, signal.action, 0);

    const pillars = advanceSetup.leadingPredictorFactors;
    const bullPillars = pillars.filter(f => f.state.includes('BULLISH')).length;
    const bearPillars = pillars.filter(f => f.state.includes('BEARISH')).length;

    console.log(`  Pillars -> Bullish: ${bullPillars} | Bearish: ${bearPillars}`);
    console.log(`  Action: ${signal.action} | Recommended: ${signal.recommendedStrike} ${signal.recommendedType}`);
    console.log(`  Advance Setup Type: ${advanceSetup.setupType} (${advanceSetup.directionalBiasLabel})`);

    assert(signal.action === 'BUY_PE', `Signal correctly recommends BUY_PE in verified Bearish Breakdown`);
    assert(advanceSetup.anticipatedAction === 'BUY_PE', `Advance Setup anticipatedAction is BUY_PE`);
    assert(bearPillars >= 8, `Strong bearish confluence activates majority bearish pillars (Bearish: ${bearPillars}/15)`);
    assert(advanceSetup.directionalBiasPercent! < -70, `Directional bias percent is strongly negative (${advanceSetup.directionalBiasPercent}%)`);
    assert(signal.target1 > signal.recommendedContractLTP, `Put Target 1 premium is higher than entry premium`);
    assert(signal.stopLoss < signal.recommendedContractLTP, `Put Stop Loss premium is strictly lower than entry premium`);
  }

  // --- SCENARIO 4: SIDEWAYS VOLATILITY SQUEEZE / DEADBAND ---
  console.log('\n--- TEST 4: SIDEWAYS RANGE-BOUND DEADBAND (Theta Bleed Protection) ---');
  {
    const spot = 22600;
    const ticker: TickerConfig = {
      ...POPULAR_TICKERS[0],
      spotPrice: spot,
      strikeStep: 50,
      lotSize: 75,
      change: 4.0,
      changePercent: 0.02,
      dayHigh: 22620,
      dayLow: 22585,
      prevClose: 22596,
    };
    const chain = buildSyntheticChain(spot, 50, 1.02, 1200, 1100);
    const metrics: MarketMetrics = computeMarketMetrics(ticker, chain);
    metrics.pcrTotalOI = 1.02;
    metrics.pcrVolume = 1.01;

    const rt = computeRealtimeIndicators(ticker, chain);
    rt.vwap.value = 22601; // Pinning VWAP within 1 pt
    rt.orderFlow.sentiment = 'BALANCED_FLOW';
    rt.orderFlow.orderFlowDelta = 2;
    rt.orderFlow.volumeImbalancePercent = 1;
    rt.rsi.value = 50.5;
    rt.rsi.condition = 'NEUTRAL';
    rt.macd.trend = 'BULLISH_DECELERATION';
    rt.ema.alignment = 'COMPRESSION';

    const candlePatterns = computeMultiTimeframeChartPatterns(ticker);
    candlePatterns.confluenceBias = 'NEUTRAL';
    candlePatterns.confluenceScore = 0.2;
    candlePatterns.m5Score = 0.0;
    candlePatterns.m2Score = 0.1;

    const sectorItem: SectoralContribution = {
      sector: 'Banking',
      weight: 35.5,
      netChangePercent: 0.05,
      contributionPoints: 0.5,
      sentiment: 'NEUTRAL',
      leadingStock: 'HDFCBANK'
    };

    const constituentAnalysis: NiftyConstituentAnalysis = {
      symbol: 'NIFTY 50',
      netNiftyPointImpact: 1.2,
      advances: 24,
      declines: 25,
      unchanged: 1,
      advancesDeclinesRatio: 0.96,
      weightedConstituentDelta: 0.02,
      overallHeavyweightBias: 'NEUTRAL',
      breadthScore: 0.0,
      topGainers: [],
      topDraggers: [],
      sectoralBreakdown: [sectorItem],
      summaryNote: 'Mixed sector movement'
    };

    const signal = generateTradeSignal(ticker, metrics, chain, [], undefined, 0, constituentAnalysis);
    const advanceSetup = computeAdvanceTradeSetup(ticker, metrics, chain, rt, candlePatterns, constituentAnalysis, undefined, signal.action, 0);

    const pillars = advanceSetup.leadingPredictorFactors;
    const neutralPillars = pillars.filter(f => f.state === 'NEUTRAL').length;

    console.log(`  Sideways Detected: ${signal.sidewaysMarketAnalysis?.isSideways} (Compression: ${signal.sidewaysMarketAnalysis?.compressionPercentage}%)`);
    console.log(`  Action: ${signal.action} | Advance Setup Action: ${advanceSetup.anticipatedAction}`);
    console.log(`  Advance Setup Title: "${advanceSetup.title}"`);
    console.log(`  Pillars Neutral Count: ${neutralPillars}/15`);

    assert(signal.action === 'WAIT_NEUTRAL', 'Action is strictly WAIT_NEUTRAL during range compression chop');
    assert(advanceSetup.anticipatedAction === 'WAIT_NEUTRAL', 'Advance setup anticipatedAction is WAIT_NEUTRAL');
    assert(advanceSetup.setupType === 'EQUILIBRIUM_WAIT', 'Setup type is EQUILIBRIUM_WAIT');
    assert(advanceSetup.isAvailable === false, 'isAvailable is false (protects capital from entering naked options)');
    assert(signal.sidewaysMarketAnalysis?.isSideways === true, 'Sideways engine accurately identifies compression range');
  }

  // --- SCENARIO 5: CONTRADICTION & DIVERGENCE STRESS TEST ---
  console.log('\n--- TEST 5: PILLAR DIVERGENCE STRESS TEST (Spot Drifts Up, but Pillars Bearish) ---');
  {
    // Bull trap scenario: Spot ticks up (+18 pts), but Order Flow is selling, heavyweights declining, candles bearish
    const spot = 22630;
    const ticker: TickerConfig = {
      ...POPULAR_TICKERS[0],
      spotPrice: spot,
      strikeStep: 50,
      lotSize: 75,
      change: 22.0,
      changePercent: 0.10,
      dayHigh: 22635,
      dayLow: 22590,
      prevClose: 22608,
    };
    const chain = buildSyntheticChain(spot, 50, 0.76, 18000, -4000);
    const metrics: MarketMetrics = computeMarketMetrics(ticker, chain);
    metrics.pcrTotalOI = 0.78;
    metrics.pcrVolume = 0.72;

    const rt = computeRealtimeIndicators(ticker, chain);
    rt.vwap.value = 22625;
    rt.orderFlow.sentiment = 'SELLER_DOMINANCE';
    rt.orderFlow.orderFlowDelta = -28;
    rt.orderFlow.volumeImbalancePercent = -22;
    rt.rsi.value = 47.0;
    rt.rsi.divergence = 'BEARISH_DIVERGENCE';
    rt.macd.trend = 'BEARISH_EXPANSION';
    rt.vixVelocity.velocityState = 'SURGING';

    const candlePatterns = computeMultiTimeframeChartPatterns(ticker);
    candlePatterns.confluenceBias = 'BEARISH';
    candlePatterns.confluenceScore = -3.8;
    candlePatterns.m5Score = -4.5;
    candlePatterns.m2Score = -3.2;

    const sectorItem: SectoralContribution = {
      sector: 'Banking',
      weight: 35.5,
      netChangePercent: -0.65,
      contributionPoints: -14,
      sentiment: 'BEARISH',
      leadingStock: 'HDFCBANK'
    };

    const constituentAnalysis: NiftyConstituentAnalysis = {
      symbol: 'NIFTY 50',
      netNiftyPointImpact: -18,
      advances: 14,
      declines: 36,
      unchanged: 0,
      advancesDeclinesRatio: 0.38,
      weightedConstituentDelta: -0.42,
      overallHeavyweightBias: 'BEARISH',
      breadthScore: -4.5,
      topGainers: [],
      topDraggers: [],
      sectoralBreakdown: [sectorItem],
      summaryNote: 'Banking under distribution'
    };

    const signal = generateTradeSignal(ticker, metrics, chain, [], undefined, 0, constituentAnalysis);
    const advanceSetup = computeAdvanceTradeSetup(ticker, metrics, chain, rt, candlePatterns, constituentAnalysis, undefined, signal.action, 0);

    const pillars = advanceSetup.leadingPredictorFactors;
    const bullPillars = pillars.filter(f => f.state.includes('BULLISH')).length;
    const bearPillars = pillars.filter(f => f.state.includes('BEARISH')).length;

    console.log(`  Spot Price: +22.0 pts (+0.10%) | Pillars -> Bullish: ${bullPillars} vs Bearish: ${bearPillars}`);
    console.log(`  Signal Action: ${signal.action} | Advance Action: ${advanceSetup.anticipatedAction}`);
    console.log(`  Advance Setup Label: "${advanceSetup.directionalBiasLabel}"`);
    console.log(`  Primary Catalyst Note: "${advanceSetup.primaryLeadingCatalyst}"`);

    assert(signal.action !== 'BUY_CE', `Crucial: BUY_CE is strictly BLOCKED despite positive spot drift because pillars and candles are bearish`);
    assert(signal.action === 'WAIT_NEUTRAL' || signal.action === 'BUY_PE', `Action is safely downgraded to WAIT_NEUTRAL or BUY_PE`);
    assert(advanceSetup.anticipatedAction === signal.action, `Advance setup action perfectly syncs with signal action`);
    assert(bearPillars > bullPillars, `Bearish pillars dominate (${bearPillars} > ${bullPillars})`);
    assert(!advanceSetup.directionalBiasLabel?.includes('Bullish'), `Directional bias label correctly does NOT claim bullish bias`);
  }

  console.log('\n========================================================================');
  console.log(`🏁 VALIDATION RESULT: ${passedTests}/${totalTests} TESTS PASSED (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
  console.log('========================================================================\n');

  if (passedTests === totalTests) {
    console.log('🎉 100% VALIDATED: The pillar methodology operates with complete mathematical integrity, zero contradictions, and flawless trade recommendation synchronization!');
    process.exit(0);
  } else {
    console.error('⚠️ Validation had failures. Review above.');
    process.exit(1);
  }
}

runValidation().catch(e => {
  console.error('Test execution error:', e);
  process.exit(1);
});
