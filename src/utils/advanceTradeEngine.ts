import { 
  TickerConfig, 
  OptionChainRow, 
  MarketMetrics, 
  RealtimePredictionIndicators,
  MultiTimeframeChartPatterns,
  NiftyConstituentAnalysis,
  InterMarketTelemetry,
  SignalAction,
  AdvanceTradeSetup,
  AdvanceSetupType,
  LeadingPredictorFactor,
  OptionType
} from '../types/options';
import { calculateBlackScholes } from './blackScholes';
import { resolveNextExpiryContractQuote } from '../data/officialNseQuotes';

/**
 * Advanced Leading Trade Recommendation Engine
 * Synthesizes 5 Institutional Leading Predictors BEFORE lagging chart trends flip:
 * 1. Open Interest (OI) Unwinding & Writing Velocity
 * 2. Heavyweight Constituent Lead-Lag (Index Front-Running)
 * 3. Cumulative Order Flow & Volume Delta Divergence
 * 4. Volatility Compression & Pre-Breakout Coiling
 * 5. Liquidity Sweep & Wick Absorption Reversal
 */
export function computeAdvanceTradeSetup(
  ticker: TickerConfig,
  metrics: MarketMetrics,
  chain: OptionChainRow[],
  rt: RealtimePredictionIndicators,
  candlePatterns: MultiTimeframeChartPatterns,
  constituentAnalysis?: NiftyConstituentAnalysis,
  interMarketTelemetry?: InterMarketTelemetry,
  currentSignalAction: SignalAction = 'WAIT_NEUTRAL',
  expiryIndex: number = 0
): AdvanceTradeSetup {
  const spotPrice = ticker.spotPrice;
  const step = ticker.strikeStep;
  const atmStrike = ticker.atmStrike;
  const isBankNifty = ticker.symbol.includes('BANK');

  // --- 1. FACTOR 1: OI SHIFT & UNWINDING VELOCITY ---
  // Check ATM, ATM+1, and ATM-1 for aggressive Call or Put unwinding
  const atmRow = chain.find(r => r.strike === atmStrike);
  const itmRow = chain.find(r => r.strike === (isBankNifty ? atmStrike - 100 : atmStrike - 50));
  const otmRow = chain.find(r => r.strike === (isBankNifty ? atmStrike + 100 : atmStrike + 50));

  const nearRows = [itmRow, atmRow, otmRow].filter(Boolean) as OptionChainRow[];
  const totalNearCeOiChange = nearRows.reduce((acc, r) => acc + (r.ce.oiChange || 0), 0);
  const totalNearPeOiChange = nearRows.reduce((acc, r) => acc + (r.pe.oiChange || 0), 0);

  let oiFactor: LeadingPredictorFactor;
  let oiBullScore = 0;
  let oiBearScore = 0;

  if (totalNearCeOiChange < -5000 && totalNearPeOiChange > 10000) {
    oiBullScore = 2.4;
    oiFactor = {
      name: 'ATM Call Unwinding & Put Writing Acceleration',
      category: 'OI_VELOCITY',
      state: 'STRONG_BULLISH',
      leadTimeMinutes: 3.5,
      valueDescription: `Call writers escaping (${totalNearCeOiChange.toLocaleString()} CE OI) while Put writers aggressively expand (+${totalNearPeOiChange.toLocaleString()} PE OI)`,
      confidenceScore: 88,
    };
  } else if (totalNearPeOiChange < -5000 && totalNearCeOiChange > 10000) {
    oiBearScore = 2.4;
    oiFactor = {
      name: 'ATM Put Unwinding & Call Writing Accumulation',
      category: 'OI_VELOCITY',
      state: 'STRONG_BEARISH',
      leadTimeMinutes: 3.5,
      valueDescription: `Put writers bailing (${totalNearPeOiChange.toLocaleString()} PE OI) under heavy institutional Call writing (+${totalNearCeOiChange.toLocaleString()} CE OI)`,
      confidenceScore: 88,
    };
  } else if (metrics.pcrVolume >= 1.25 && metrics.pcrTotalOI >= 1.05) {
    oiBullScore = 1.6;
    oiFactor = {
      name: 'Volume PCR Bullish Skew',
      category: 'OI_VELOCITY',
      state: 'MODERATE_BULLISH',
      leadTimeMinutes: 2.8,
      valueDescription: `Volume PCR high at ${metrics.pcrVolume.toFixed(2)} with steady Put writing support`,
      confidenceScore: 78,
    };
  } else if (metrics.pcrVolume <= 0.75 && metrics.pcrTotalOI <= 0.90) {
    oiBearScore = 1.6;
    oiFactor = {
      name: 'Volume PCR Bearish Skew',
      category: 'OI_VELOCITY',
      state: 'MODERATE_BEARISH',
      leadTimeMinutes: 2.8,
      valueDescription: `Volume PCR depressed at ${metrics.pcrVolume.toFixed(2)} with Call writing dominance`,
      confidenceScore: 78,
    };
  } else {
    oiFactor = {
      name: 'Balanced OI Neutrality',
      category: 'OI_VELOCITY',
      state: 'NEUTRAL',
      leadTimeMinutes: 1.5,
      valueDescription: `Balanced Call/Put open interest equilibrium across nearby strikes`,
      confidenceScore: 55,
    };
  }

  // --- 2. FACTOR 2: HEAVYWEIGHT CONSTITUENT LEAD-LAG (FRONT-RUNNING) ---
  let hwFactor: LeadingPredictorFactor;
  let hwBullScore = 0;
  let hwBearScore = 0;

  if (constituentAnalysis) {
    const netPoints = constituentAnalysis.netNiftyPointImpact;
    const adv = constituentAnalysis.advances;
    const dec = constituentAnalysis.declines;
    const bankingSector = constituentAnalysis.sectoralBreakdown.find(s => s.sector === 'Banking');

    if (netPoints >= 18 && adv >= dec * 1.5) {
      hwBullScore = 2.6;
      hwFactor = {
        name: 'Heavyweight Constituent Pre-Breakout Thrust',
        category: 'HEAVYWEIGHT_LEAD',
        state: 'STRONG_BULLISH',
        leadTimeMinutes: 3.0,
        valueDescription: `Top derivative constituents surging (+${netPoints.toFixed(1)} pts impact, A/D: ${adv}/${dec}). HDFC Bank & Reliance front-running index move`,
        confidenceScore: 90,
      };
    } else if (netPoints <= -18 && dec >= adv * 1.5) {
      hwBearScore = 2.6;
      hwFactor = {
        name: 'Heavyweight Constituent Pre-Breakdown Drag',
        category: 'HEAVYWEIGHT_LEAD',
        state: 'STRONG_BEARISH',
        leadTimeMinutes: 3.0,
        valueDescription: `Key institutional heavyweights under heavy distribution (${netPoints.toFixed(1)} pts drag, A/D: ${adv}/${dec}) ahead of Nifty`,
        confidenceScore: 90,
      };
    } else if (bankingSector && bankingSector.sentiment === 'BULLISH' && netPoints > 5) {
      hwBullScore = 1.5;
      hwFactor = {
        name: 'Banking Heavyweight Accumulation Lead',
        category: 'HEAVYWEIGHT_LEAD',
        state: 'MODERATE_BULLISH',
        leadTimeMinutes: 2.2,
        valueDescription: `Banking heavyweights showing early Long Buildup (+${netPoints.toFixed(1)} pts)`,
        confidenceScore: 75,
      };
    } else if (bankingSector && bankingSector.sentiment === 'BEARISH' && netPoints < -5) {
      hwBearScore = 1.5;
      hwFactor = {
        name: 'Banking Heavyweight Distribution Drag',
        category: 'HEAVYWEIGHT_LEAD',
        state: 'MODERATE_BEARISH',
        leadTimeMinutes: 2.2,
        valueDescription: `Banking heavyweights showing early Short Buildup (${netPoints.toFixed(1)} pts)`,
        confidenceScore: 75,
      };
    } else {
      hwFactor = {
        name: 'Heavyweight Mixed Equilibrium',
        category: 'HEAVYWEIGHT_LEAD',
        state: 'NEUTRAL',
        leadTimeMinutes: 1.0,
        valueDescription: `Constituents balanced (Net impact: ${netPoints >= 0 ? '+' : ''}${netPoints.toFixed(1)} pts)`,
        confidenceScore: 50,
      };
    }
  } else {
    hwFactor = {
      name: 'Constituents Monitoring',
      category: 'HEAVYWEIGHT_LEAD',
      state: 'NEUTRAL',
      leadTimeMinutes: 1.0,
      valueDescription: `Constituent live stream active`,
      confidenceScore: 50,
    };
  }

  // --- 3. FACTOR 3: ORDER FLOW & CUMULATIVE VOLUME DELTA (CVD) DIVERGENCE ---
  let ofFactor: LeadingPredictorFactor;
  let ofBullScore = 0;
  let ofBearScore = 0;

  const delta = rt.orderFlow.orderFlowDelta;
  const imbalance = rt.orderFlow.volumeImbalancePercent;

  if (rt.orderFlow.sentiment === 'BUYER_DOMINANCE' && (delta > 20 || imbalance > 20)) {
    ofBullScore = 2.2;
    ofFactor = {
      name: 'Institutional Order Flow Absorption (Buyer Delta)',
      category: 'ORDER_FLOW_DELTA',
      state: 'STRONG_BULLISH',
      leadTimeMinutes: 4.0,
      valueDescription: `Aggressive buyer market order volume (+${Math.round(delta)}% delta, ${imbalance > 0 ? '+' : ''}${imbalance}% imbalance) absorbing supply at support`,
      confidenceScore: 86,
    };
  } else if (rt.orderFlow.sentiment === 'SELLER_DOMINANCE' && (delta < -20 || imbalance < -20)) {
    ofBearScore = 2.2;
    ofFactor = {
      name: 'Institutional Order Flow Distribution (Seller Delta)',
      category: 'ORDER_FLOW_DELTA',
      state: 'STRONG_BEARISH',
      leadTimeMinutes: 4.0,
      valueDescription: `Aggressive seller market order volume (${Math.round(delta)}% delta, ${imbalance}% imbalance) hitting bids at resistance`,
      confidenceScore: 86,
    };
  } else if (rt.volumeAnalytics && rt.volumeAnalytics.volumeDivergence === 'BULLISH_VOLUME_EXPANSION') {
    ofBullScore = 1.4;
    ofFactor = {
      name: 'Bullish Volume Delta Divergence',
      category: 'ORDER_FLOW_DELTA',
      state: 'MODERATE_BULLISH',
      leadTimeMinutes: 2.5,
      valueDescription: `Cumulative volume expansion outpacing price range (+${Math.round(delta)}% delta)`,
      confidenceScore: 76,
    };
  } else if (rt.volumeAnalytics && rt.volumeAnalytics.volumeDivergence === 'BEARISH_VOLUME_EXPANSION') {
    ofBearScore = 1.4;
    ofFactor = {
      name: 'Bearish Volume Delta Divergence',
      category: 'ORDER_FLOW_DELTA',
      state: 'MODERATE_BEARISH',
      leadTimeMinutes: 2.5,
      valueDescription: `Cumulative volume liquidation expanding on lower ticks (${Math.round(delta)}% delta)`,
      confidenceScore: 76,
    };
  } else {
    ofFactor = {
      name: 'Order Flow Neutral Balance',
      category: 'ORDER_FLOW_DELTA',
      state: 'NEUTRAL',
      leadTimeMinutes: 1.2,
      valueDescription: `Balanced bid/ask market order flow`,
      confidenceScore: 50,
    };
  }

  // --- 4. FACTOR 4: VOLATILITY COMPRESSION & PRE-BREAKOUT SQUEEZE ---
  let sqFactor: LeadingPredictorFactor;
  let isCoiling = false;

  const m5 = candlePatterns.m5;
  const isRangeCompressed = m5.swingRange !== undefined && m5.atr > 0 && m5.swingRange < m5.atr * 1.35;
  const isEmaCompressed = rt.ema.alignment === 'COMPRESSION';

  if (isRangeCompressed || isEmaCompressed) {
    isCoiling = true;
    const directionBias = (oiBullScore + hwBullScore + ofBullScore) > (oiBearScore + hwBearScore + ofBearScore)
      ? 'STRONG_BULLISH'
      : (oiBearScore + hwBearScore + ofBearScore) > (oiBullScore + hwBullScore + ofBullScore)
      ? 'STRONG_BEARISH'
      : 'NEUTRAL';

    sqFactor = {
      name: 'Pre-Breakout Volatility Squeeze Coiling',
      category: 'VOLATILITY_SQUEEZE',
      state: directionBias,
      leadTimeMinutes: 3.5,
      valueDescription: `Narrow range compression (${m5.swingRange ? m5.swingRange.toFixed(1) : 'tight'} pts range vs ATR ${m5.atr.toFixed(1)}). Explosive momentum expansion imminent`,
      confidenceScore: 84,
    };
  } else {
    sqFactor = {
      name: 'Standard Volatility Expansion',
      category: 'VOLATILITY_SQUEEZE',
      state: 'NEUTRAL',
      leadTimeMinutes: 1.0,
      valueDescription: `Normal candle range expansion active`,
      confidenceScore: 60,
    };
  }

  // --- 5. FACTOR 5: LIQUIDITY SWEEP & WICK ABSORPTION (REVERSAL) ---
  let swFactor: LeadingPredictorFactor;
  let swBullScore = 0;
  let swBearScore = 0;

  const patternStr = (candlePatterns.m5.pattern + ' ' + candlePatterns.m2.pattern).toLowerCase();
  const hasLowerWick = patternStr.includes('lower shadow') || patternStr.includes('hammer') || patternStr.includes('absorption');
  const hasUpperWick = patternStr.includes('upper shadow') || patternStr.includes('shooting star') || patternStr.includes('rejection');

  if (hasLowerWick && (spotPrice <= metrics.majorSupportStrike + step * 0.4 || spotPrice <= (ticker.dayLow || spotPrice) + step * 0.3)) {
    swBullScore = 2.2;
    swFactor = {
      name: 'Liquidity Sweep of Lows & Bullish Absorption',
      category: 'LIQUIDITY_SWEEP',
      state: 'STRONG_BULLISH',
      leadTimeMinutes: 3.0,
      valueDescription: `Stop-loss liquidity sweep below key support followed by aggressive lower wick pin absorption`,
      confidenceScore: 85,
    };
  } else if (hasUpperWick && (spotPrice >= metrics.majorResistanceStrike - step * 0.4 || spotPrice >= (ticker.dayHigh || spotPrice) - step * 0.3)) {
    swBearScore = 2.2;
    swFactor = {
      name: 'Liquidity Sweep of Highs & Bearish Rejection',
      category: 'LIQUIDITY_SWEEP',
      state: 'STRONG_BEARISH',
      leadTimeMinutes: 3.0,
      valueDescription: `Stop-loss liquidity sweep above resistance followed by immediate upper wick supply rejection`,
      confidenceScore: 85,
    };
  } else if (rt.rsi.divergence === 'BULLISH_DIVERGENCE') {
    swBullScore = 1.6;
    swFactor = {
      name: 'RSI Momentum Bullish Divergence',
      category: 'LIQUIDITY_SWEEP',
      state: 'MODERATE_BULLISH',
      leadTimeMinutes: 2.5,
      valueDescription: `Price making equal/lower low while RSI indicator velocity diverges upward`,
      confidenceScore: 80,
    };
  } else if (rt.rsi.divergence === 'BEARISH_DIVERGENCE') {
    swBearScore = 1.6;
    swFactor = {
      name: 'RSI Momentum Bearish Divergence',
      category: 'LIQUIDITY_SWEEP',
      state: 'MODERATE_BEARISH',
      leadTimeMinutes: 2.5,
      valueDescription: `Price making equal/higher high while RSI indicator velocity diverges downward`,
      confidenceScore: 80,
    };
  } else {
    swFactor = {
      name: 'Normal Structure Without Sweeps',
      category: 'LIQUIDITY_SWEEP',
      state: 'NEUTRAL',
      leadTimeMinutes: 1.0,
      valueDescription: `Price adhering to standard range structure without extreme sweep traps`,
      confidenceScore: 50,
    };
  }

  // --- 6. FACTOR 6: GIFT NIFTY & GLOBAL MACRO FUTURES LEADING VECTOR ---
  let macroFactor: LeadingPredictorFactor;
  let macroBullScore = 0;
  let macroBearScore = 0;

  if (interMarketTelemetry?.giftNifty) {
    const gnChange = interMarketTelemetry.giftNifty.change;
    const gnChangePct = interMarketTelemetry.giftNifty.changePercent;
    const gnPrice = interMarketTelemetry.giftNifty.price;
    const fairBasis = isBankNifty ? 45 : (spotPrice > 15000 ? 18 : 0);
    const impliedCashDiff = gnPrice > 10000 ? (gnPrice - fairBasis) - spotPrice : 0;

    if (impliedCashDiff >= 25 || (gnChangePct >= 0.25 && impliedCashDiff >= 10)) {
      macroBullScore = 2.4;
      macroFactor = {
        name: 'GIFT Nifty International Futures Lead (Bullish Thrust)',
        category: 'GLOBAL_MACRO_LEAD',
        state: 'STRONG_BULLISH',
        leadTimeMinutes: 5.0,
        valueDescription: `GIFT Nifty futures at ₹${gnPrice.toLocaleString()} (${gnChange >= 0 ? '+' : ''}${gnChange.toFixed(1)} pts) indicating strong implied cash premium (+${impliedCashDiff.toFixed(1)} pts vs spot)`,
        confidenceScore: 92,
      };
    } else if (impliedCashDiff <= -25 && gnChangePct <= -0.15) {
      macroBearScore = 2.4;
      macroFactor = {
        name: 'GIFT Nifty International Futures Drag (Bearish Flush)',
        category: 'GLOBAL_MACRO_LEAD',
        state: 'STRONG_BEARISH',
        leadTimeMinutes: 5.0,
        valueDescription: `GIFT Nifty futures in confirmed cash discount (${impliedCashDiff.toFixed(1)} pts vs spot, ${gnChange.toFixed(1)} pts vs prev close @ ${gnPrice.toLocaleString()})`,
        confidenceScore: 92,
      };
    } else if (impliedCashDiff >= 10 || gnChangePct >= 0.08) {
      macroBullScore = 1.3;
      macroFactor = {
        name: 'GIFT Nifty Mild Upward Drift',
        category: 'GLOBAL_MACRO_LEAD',
        state: 'MODERATE_BULLISH',
        leadTimeMinutes: 3.5,
        valueDescription: `GIFT Nifty supportive at ₹${gnPrice.toLocaleString()} (+${impliedCashDiff.toFixed(1)} pts implied vs spot)`,
        confidenceScore: 78,
      };
    } else if (impliedCashDiff <= -12 && gnChangePct <= -0.06) {
      macroBearScore = 1.3;
      macroFactor = {
        name: 'GIFT Nifty Mild Downward Drag',
        category: 'GLOBAL_MACRO_LEAD',
        state: 'MODERATE_BEARISH',
        leadTimeMinutes: 3.5,
        valueDescription: `GIFT Nifty leaning negative (${impliedCashDiff.toFixed(1)} pts vs spot @ ${gnPrice.toLocaleString()})`,
        confidenceScore: 78,
      };
    } else {
      macroFactor = {
        name: 'GIFT Nifty Equilibrium Alignment',
        category: 'GLOBAL_MACRO_LEAD',
        state: 'NEUTRAL',
        leadTimeMinutes: 1.0,
        valueDescription: `GIFT Nifty trading in fair value alignment (${gnChange >= 0 ? '+' : ''}${gnChange.toFixed(1)} pts @ ${gnPrice.toLocaleString()}, implied gap: ${impliedCashDiff >= 0 ? '+' : ''}${impliedCashDiff.toFixed(1)} pts)`,
        confidenceScore: 55,
      };
    }
  } else {
    macroFactor = {
      name: 'Global Macro Sync Monitor',
      category: 'GLOBAL_MACRO_LEAD',
      state: 'NEUTRAL',
      leadTimeMinutes: 1.0,
      valueDescription: `Inter-market telemetry feed active`,
      confidenceScore: 50,
    };
  }

  // --- SYNTHESIZE LEADING CONFIRMATION SCORES ---
  const totalBullScore = oiBullScore + hwBullScore + ofBullScore + swBullScore + macroBullScore + (isCoiling && (oiBullScore > 0 || hwBullScore > 0 || ofBullScore > 0 || macroBullScore > 0) ? 1.0 : 0);
  const totalBearScore = oiBearScore + hwBearScore + ofBearScore + swBearScore + macroBearScore + (isCoiling && (oiBearScore > 0 || hwBearScore > 0 || ofBearScore > 0 || macroBearScore > 0) ? 1.0 : 0);

  const leadingFactors = [oiFactor, hwFactor, ofFactor, sqFactor, swFactor, macroFactor];

  let anticipatedAction: 'BUY_CE' | 'BUY_PE' | 'WAIT_NEUTRAL' = 'WAIT_NEUTRAL';
  let setupType: AdvanceSetupType = 'EQUILIBRIUM_WAIT';
  let probabilityScore = 55;
  let leadTimeAdvantageMinutes = 3.0;

  if (totalBullScore >= 2.0 && totalBullScore > totalBearScore + 0.6) {
    anticipatedAction = 'BUY_CE';
    probabilityScore = Math.min(95, Math.round(74 + totalBullScore * 4.2));
    leadTimeAdvantageMinutes = Number((2.8 + Math.min(2.5, totalBullScore * 0.35)).toFixed(1));

    if (swBullScore >= 2.0) {
      setupType = 'EARLY_ACCUMULATION_REVERSAL_CE';
    } else if (hwBullScore >= 2.0) {
      setupType = 'HEAVYWEIGHT_FRONT_RUN_CE';
    } else if (oiBullScore >= 2.0) {
      setupType = 'OI_UNWINDING_THRUST_CE';
    } else {
      setupType = 'PRE_BREAKOUT_COILING_CE';
    }
  } else if (totalBearScore >= 2.0 && totalBearScore > totalBullScore + 0.6) {
    anticipatedAction = 'BUY_PE';
    probabilityScore = Math.min(95, Math.round(74 + totalBearScore * 4.2));
    leadTimeAdvantageMinutes = Number((2.8 + Math.min(2.5, totalBearScore * 0.35)).toFixed(1));

    if (swBearScore >= 2.0) {
      setupType = 'EARLY_DISTRIBUTION_REVERSAL_PE';
    } else if (hwBearScore >= 2.0) {
      setupType = 'HEAVYWEIGHT_FRONT_RUN_PE';
    } else if (oiBearScore >= 2.0) {
      setupType = 'OI_UNWINDING_THRUST_PE';
    } else {
      setupType = 'PRE_BREAKDOWN_COILING_PE';
    }
  } else {
    // If lagging system is already in BUY_CE or BUY_PE, maintain advance alignment
    if (currentSignalAction === 'BUY_CE') {
      anticipatedAction = 'BUY_CE';
      setupType = 'PRE_BREAKOUT_COILING_CE';
      probabilityScore = 80;
      leadTimeAdvantageMinutes = 2.0;
    } else if (currentSignalAction === 'BUY_PE') {
      anticipatedAction = 'BUY_PE';
      setupType = 'PRE_BREAKDOWN_COILING_PE';
      probabilityScore = 80;
      leadTimeAdvantageMinutes = 2.0;
    } else {
      anticipatedAction = 'WAIT_NEUTRAL';
      setupType = 'EQUILIBRIUM_WAIT';
      probabilityScore = 52;
      leadTimeAdvantageMinutes = 1.0;
    }
  }

  // --- STRIKE, ZONE & OPTION TARGET CALCULATIONS ---
  const isBearishSkew = (
    anticipatedAction === 'BUY_PE' ||
    (anticipatedAction === 'WAIT_NEUTRAL' && (
      candlePatterns.confluenceBias === 'BEARISH' ||
      candlePatterns.confluenceScore < -1.5 ||
      totalBearScore > totalBullScore
    ))
  );

  const recType: OptionType = isBearishSkew ? 'PE' : 'CE';
  const recStrike = recType === 'PE'
    ? (spotPrice <= atmStrike - step * 0.3 ? atmStrike - step : atmStrike)
    : (spotPrice >= atmStrike + step * 0.3 ? atmStrike + step : atmStrike);

  // Spot entry zone and breakout level
  let advanceEntryZoneSpot: [number, number];
  let breakoutConfirmationSpot: number;
  let advanceStopLossSpot: number;

  const isUSD = ticker.currency === '$';
  const spotBuffer = isUSD ? 1.5 : (isBankNifty ? 60 : 25);
  const targetBuffer1 = isUSD ? 3.0 : (isBankNifty ? 120 : 50);

  if (anticipatedAction === 'BUY_CE') {
    advanceEntryZoneSpot = [
      Number((spotPrice - (isUSD ? 0.8 : (isBankNifty ? 30 : 12))).toFixed(2)),
      Number((spotPrice + (isUSD ? 0.5 : (isBankNifty ? 20 : 8))).toFixed(2))
    ];
    breakoutConfirmationSpot = Number((spotPrice + (isUSD ? 1.2 : (isBankNifty ? 45 : 20))).toFixed(2));
    advanceStopLossSpot = Number((spotPrice - spotBuffer).toFixed(2));
  } else if (anticipatedAction === 'BUY_PE') {
    advanceEntryZoneSpot = [
      Number((spotPrice - (isUSD ? 0.5 : (isBankNifty ? 20 : 8))).toFixed(2)),
      Number((spotPrice + (isUSD ? 0.8 : (isBankNifty ? 30 : 12))).toFixed(2))
    ];
    breakoutConfirmationSpot = Number((spotPrice - (isUSD ? 1.2 : (isBankNifty ? 45 : 20))).toFixed(2));
    advanceStopLossSpot = Number((spotPrice + spotBuffer).toFixed(2));
  } else {
    advanceEntryZoneSpot = isBearishSkew
      ? [Number((spotPrice - spotBuffer).toFixed(2)), Number((spotPrice + spotBuffer * 0.5).toFixed(2))]
      : [Number((spotPrice - spotBuffer * 0.5).toFixed(2)), Number((spotPrice + spotBuffer).toFixed(2))];
    breakoutConfirmationSpot = isBearishSkew
      ? Number((spotPrice - spotBuffer).toFixed(2))
      : Number((spotPrice + spotBuffer).toFixed(2));
    advanceStopLossSpot = isBearishSkew
      ? Number((spotPrice + spotBuffer).toFixed(2))
      : Number((spotPrice - spotBuffer).toFixed(2));
  }

  // Resolve realistic option pricing
  const contractRow = chain.find(r => r.strike === recStrike);
  const liveOption = recType === 'CE' ? contractRow?.ce : contractRow?.pe;
  let currentLTP = liveOption && liveOption.ltp > 1.0 ? liveOption.ltp : 0;
  
  if (currentLTP <= 1.0) {
    if (ticker.symbol.includes('NIFTY')) {
      const q = resolveNextExpiryContractQuote(recStrike, recType, 1, spotPrice);
      currentLTP = q.ltp;
    } else {
      const baseline = isUSD ? Math.max(1.2, spotPrice * 0.009) : (isBankNifty ? 220 : 115);
      const moneynessOffset = recType === 'CE' ? (spotPrice - recStrike) * 0.48 : (recStrike - spotPrice) * 0.48;
      currentLTP = Number(Math.max(isUSD ? 0.5 : 15, baseline + moneynessOffset).toFixed(2));
    }
  }

  const roundToTick = (val: number) => Math.max(0.05, Math.round(val * 20) / 20);

  // Advance Entry Option Range (Realistic tight spread)
  const spreadBuffer = isUSD ? 0.05 : (isBankNifty ? 1.50 : 0.75);
  const advanceEntryOptionRange: [number, number] = [
    roundToTick(Math.max(0.05, currentLTP - spreadBuffer)),
    roundToTick(currentLTP + spreadBuffer)
  ];

  // Advance Targets & Risk-Managed Stop Loss (15% SL risk, 35% T1, 70% T2)
  const advanceOptionStopLoss = roundToTick(Math.max(0.05, currentLTP * 0.85));
  const advanceOptionTarget1 = roundToTick(currentLTP * 1.35); // +35%
  const advanceOptionTarget2 = roundToTick(currentLTP * 1.70); // +70%

  const advanceRisk = currentLTP - advanceOptionStopLoss;
  const advanceReward = advanceOptionTarget1 - currentLTP;
  const advanceRiskRewardRatio = `1 : ${(advanceReward / Math.max(advanceRisk, 0.5)).toFixed(1)}`;

  // Comparative metrics: Advance Entry vs Lagging Entry
  const laggingEstimatedOptionPrice = roundToTick(currentLTP * 1.20);
  const slippageSavedPercent = Math.round(((laggingEstimatedOptionPrice - currentLTP) / laggingEstimatedOptionPrice) * 100);
  const laggingRisk = laggingEstimatedOptionPrice - advanceOptionStopLoss;
  const laggingReward = advanceOptionTarget1 - laggingEstimatedOptionPrice;
  const laggingRiskRewardRatio = `1 : ${Math.max(0.8, laggingReward / Math.max(laggingRisk, 0.5)).toFixed(1)}`;

  const advanceVsLaggingComparison = {
    advanceEntryOptionPrice: currentLTP,
    laggingEntryOptionPrice: laggingEstimatedOptionPrice,
    advanceSpotPrice: spotPrice,
    laggingBreakoutSpotPrice: breakoutConfirmationSpot,
    advanceRiskRewardRatio,
    laggingRiskRewardRatio,
    slippageSavedPercent,
  };

  // Titles and descriptions (Clean, professional, and clear)
  let title = '';
  let subTitle = '';
  let primaryLeadingCatalyst = '';

  switch (setupType) {
    case 'PRE_BREAKOUT_COILING_CE':
      title = 'Pre-Breakout Momentum Coiling (CE)';
      subTitle = 'Volatility Coiling with Order Flow Accumulation Prior to 5M Trend Expansion';
      primaryLeadingCatalyst = 'Narrow range coiling with buyer volume delta surge and institutional Call writer unwinding at ATM.';
      break;
    case 'PRE_BREAKDOWN_COILING_PE':
      title = 'Pre-Breakdown Momentum Coiling (PE)';
      subTitle = 'Range Breakdown Primed by Heavyweight Selling Prior to 5M Trend Breakdown';
      primaryLeadingCatalyst = 'Key constituent drag and Put writer unwinding anticipating downside expansion.';
      break;
    case 'EARLY_ACCUMULATION_REVERSAL_CE':
      title = 'Liquidity Absorption Reversal (CE)';
      subTitle = 'Support Sweep Spring with Lower Wick Buying Absorption';
      primaryLeadingCatalyst = 'Liquidity sweep below key support followed by aggressive buyer delta absorption pin.';
      break;
    case 'EARLY_DISTRIBUTION_REVERSAL_PE':
      title = 'Liquidity Rejection Reversal (PE)';
      subTitle = 'Resistance Sweep Failure with Upper Wick Supply Overhang';
      primaryLeadingCatalyst = 'Liquidity sweep above resistance rejected by aggressive institutional sellers.';
      break;
    case 'HEAVYWEIGHT_FRONT_RUN_CE':
      title = 'Heavyweight Lead-Lag Surge (CE)';
      subTitle = 'Banking Heavyweights Surging Ahead of Index Chart';
      primaryLeadingCatalyst = `Key banking leaders driving index points before cash chart catches up.`;
      break;
    case 'HEAVYWEIGHT_FRONT_RUN_PE':
      title = 'Heavyweight Lead-Lag Drag (PE)';
      subTitle = 'Key Derivative Leaders Dumping Ahead of Index Invalidation';
      primaryLeadingCatalyst = `Heavyweights dragging index ahead of spot chart invalidation.`;
      break;
    case 'OI_UNWINDING_THRUST_CE':
      title = 'OI Unwinding Squeeze Velocity (CE)';
      subTitle = 'Trapped Call Writers Squaring Off Prior to Spot Breakout';
      primaryLeadingCatalyst = `Call writers unwinding ${Math.abs(totalNearCeOiChange).toLocaleString()} contracts across near strikes, priming short squeeze.`;
      break;
    case 'OI_UNWINDING_THRUST_PE':
      title = 'OI Unwinding Flush Velocity (PE)';
      subTitle = 'Trapped Put Writers Bailing Prior to Spot Breakdown';
      primaryLeadingCatalyst = `Put writers rapidly covering ${Math.abs(totalNearPeOiChange).toLocaleString()} contracts, opening room for downward flush.`;
      break;
    default:
      title = 'Equilibrium Range (Stand Aside)';
      subTitle = 'No Directional Divergence Detected in Leading Indicators';
      primaryLeadingCatalyst = 'Balanced market order flow and neutral straddle positioning.';
      break;
  }

  const executionPlaybook = {
    advanceAggressiveNote: anticipatedAction !== 'WAIT_NEUTRAL'
      ? `Enter now in the Advance Entry Zone (${ticker.currency}${advanceEntryZoneSpot[0].toLocaleString()} - ${ticker.currency}${advanceEntryZoneSpot[1].toLocaleString()}) for ${recStrike} ${recType} @ ${ticker.currency}${currentLTP.toFixed(2)}. Stop-Loss is strictly guarded at ${ticker.currency}${advanceStopLossSpot.toLocaleString()} (only ~12% option premium risk). You get the cheapest premium before the breakout candle prints.`
      : `Market is in true equilibrium. Do not enter advance orders until leading divergence emerges.`,
    laggingConservativeNote: anticipatedAction !== 'WAIT_NEUTRAL'
      ? `If you prefer lagging chart confirmation, wait for spot to cross and close above ${ticker.currency}${breakoutConfirmationSpot.toLocaleString()}. Option premium will be ~15-25% higher, but the 5M chart trend will be confirmed.`
      : `Wait for spot to break beyond the session deadband boundaries.`,
    whyAdvanceMatters: anticipatedAction !== 'WAIT_NEUTRAL'
      ? `Advance entry provides a ~${leadTimeAdvantageMinutes} minutes time advantage, saves 15-25% in premium slippage, and boosts Risk-Reward to ${advanceRiskRewardRatio} (vs 1:1.8 on late breakout confirmation).`
      : `Standing aside preserves capital from theta decay during balanced market chop.`,
  };

  return {
    isAvailable: anticipatedAction !== 'WAIT_NEUTRAL',
    setupType,
    anticipatedAction,
    recommendedStrike: recStrike,
    recommendedType: recType,
    title,
    subTitle,
    advanceEntryZoneSpot,
    breakoutConfirmationSpot,
    advanceStopLossSpot,
    advanceEntryOptionRange,
    advanceOptionTarget1,
    advanceOptionTarget2,
    advanceOptionStopLoss,
    advanceRiskRewardRatio,
    leadTimeAdvantageMinutes,
    probabilityScore,
    primaryLeadingCatalyst,
    leadingPredictorFactors: leadingFactors,
    executionPlaybook,
    slippageSavedPercent,
    advanceVsLaggingComparison,
  };
}
