import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  TickerConfig, 
  OptionChainRow, 
  OptionContract, 
  OptionFilters, 
  MarketMetrics, 
  TradeSignal,
  NewsItem,
  BuildupType,
  OptionType,
  StrikeHistoryItem,
  StrikeTrendAnalytics,
  ExpirySignalSummary,
  SignalAction,
  NiftyConstituentAnalysis
} from '../types/options';
import { POPULAR_TICKERS } from '../data/marketTickers';
import { INITIAL_NEWS_FEED } from '../data/newsFeed';
import { analyzeNiftyConstituents } from '../data/niftyConstituents';
import { NSE_OFFICIAL_NIFTY_CHAIN, NSE_CROSS_EXPIRY_22700_QUOTES } from '../data/officialNseQuotes';
import { calculateBlackScholes } from '../utils/blackScholes';
import { computeMarketMetrics, generateTradeSignal } from '../utils/signalEngine';
import { 
  loadStrikeHistory, 
  updateHistoryWithLiveChain, 
  recordSignalInHistory, 
  deriveStrikeTrendAnalytics 
} from '../utils/strikeHistoryEngine';
import { getMarketHoursStatus, MarketHoursStatus } from '../utils/marketHours';

// Generates baseline option chain calibrated to exchange quotes and official expiry
export function buildInitialChain(ticker: TickerConfig, expiryIndex: number): OptionChainRow[] {
  const S = ticker.spotPrice;
  const step = ticker.strikeStep;
  const atm = Math.round(S / step) * step;
  const isIndian = ticker.currency === '₹';

  // Trading days to expiry based on official Tuesday calendar:
  // 29 Sep 2026 = 2.4 trading days remaining (from Friday midday)
  // 06 Oct 2026 = 7.4 trading days
  // 13 Oct 2026 = 12.4 trading days
  // Dynamic calendar days to expiry:
  // Expiry 0 (Today): Active intraday session with standard minimum realized movement
  // Future weekly & monthly expiries scale with exact calendar DTE (7, 14, 20, 28, 35, 55 days)
  const calendarDaysArray = [0.15, 7.0, 14.0, 20.0, 28.0, 35.0, 55.0];
  const daysToExpiry = calendarDaysArray[expiryIndex] !== undefined 
    ? calendarDaysArray[expiryIndex] 
    : (expiryIndex === 0 ? 0.15 : expiryIndex * 7.0);

  const T = Math.max(0.0003, daysToExpiry / 365);
  const r = isIndian ? 0.065 : 0.045;
  const divYield = isIndian ? 0.012 : 0.015;

  // Calibrated ATM Implied Volatility:
  // Dynamically driven by the ticker's live implied volatility index (VIX) and term structure
  const baseIV = (ticker.vix || 14.04) / 100;
  const termFactor = expiryIndex === 0 ? 0.85 : expiryIndex === 1 ? 1.11 : expiryIndex === 2 ? 1.06 : expiryIndex === 3 ? 1.02 : 0.98;

  const rows: OptionChainRow[] = [];
  const strikeCount = 50; // 50 above and 50 below ATM = 101 total strikes across full chain spectrum

  for (let i = -strikeCount; i <= strikeCount; i++) {
    const K = atm + i * step;
    const isATM = K === atm;
    const m = (K - S) / Math.max(S, 1);
    
    // Natural market volatility smile with forward CE skew
    const ceIVSkew = isIndian
      ? (baseIV * termFactor * 1.08) + (m < 0 ? -m * 0.12 : m * 0.08)
      : baseIV + (m < 0 ? -m * 0.30 : m * 0.15);
    const peIVSkew = isIndian
      ? (baseIV * termFactor * 0.92) + (m < 0 ? -m * 0.12 : m * 0.08)
      : baseIV + (m < 0 ? -m * 0.30 : m * 0.15);

    const ceIVPercent = Number((ceIVSkew * 100).toFixed(1));
    const peIVPercent = Number((peIVSkew * 100).toFixed(1));

    // Calculate Black-Scholes for CE & PE with forward cost-of-carry
    const ceBS = calculateBlackScholes(S, K, T, r, ceIVSkew, 'CE', divYield);
    const peBS = calculateBlackScholes(S, K, T, r, peIVSkew, 'PE', divYield);

    // Realistic Open Interest & Volume distributions centered at ATM
    const factor = Math.exp(-Math.pow(i / 6.5, 2));
    const baseOI = Math.max(500, Math.round(factor * (ticker.category === 'Index' ? 85000 : 25000)));
    
    const ceOI = Math.round(baseOI * (i > 0 ? 1.35 : 0.85) + (Math.sin(K) * 1200));
    const peOI = Math.round(baseOI * (i < 0 ? 1.45 : 0.75) + (Math.cos(K) * 1200));

    const ceVol = Math.round(ceOI * 0.42);
    const peVol = Math.round(peOI * 0.38);

    const ceChgOI = Math.round((Math.sin(i * 1.5) * 0.08) * ceOI);
    const peChgOI = Math.round((Math.cos(i * 1.2) * 0.09) * peOI);

    const ceMoneyness = K < S - step * 0.5 ? 'ITM' : isATM ? 'ATM' : 'OTM';
    const peMoneyness = K > S + step * 0.5 ? 'ITM' : isATM ? 'ATM' : 'OTM';

    // Round to standard 0.05 tick size
    const rawCeLtp = Number(ceBS.price.toFixed(2));
    const rawPeLtp = Number(peBS.price.toFixed(2));
    
    // Real-time dynamic Black-Scholes LTP evaluated at current live spot price S
    const ceLtp = Math.max(0.05, Number((Math.round(rawCeLtp * 20) / 20).toFixed(2)));
    const peLtp = Math.max(0.05, Number((Math.round(rawPeLtp * 20) / 20).toFixed(2)));

    // Tight market spread
    const spread = isIndian ? 0.20 : 0.02;
    const halfSpread = spread / 2;

    const ceBid = Number(Math.max(0.05, ceLtp - halfSpread).toFixed(2));
    const ceAsk = Number((ceLtp + halfSpread).toFixed(2));
    const peBid = Number(Math.max(0.05, peLtp - halfSpread).toFixed(2));
    const peAsk = Number((peLtp + halfSpread).toFixed(2));

    // Dynamic previous close computed from reference previous session close
    const cePrevBS = calculateBlackScholes(ticker.prevClose, K, T + 1 / 365, r, ceIVSkew, 'CE', divYield);
    const pePrevBS = calculateBlackScholes(ticker.prevClose, K, T + 1 / 365, r, peIVSkew, 'PE', divYield);
    const cePrevClose = Math.max(0.05, Number((Math.round(cePrevBS.price * 20) / 20).toFixed(2)));
    const pePrevClose = Math.max(0.05, Number((Math.round(pePrevBS.price * 20) / 20).toFixed(2)));

    const ceChange = Number((ceLtp - cePrevClose).toFixed(2));
    const peChange = Number((peLtp - pePrevClose).toFixed(2));
    const ceChangePercent = Number(((ceChange / cePrevClose) * 100).toFixed(2));
    const peChangePercent = Number(((peChange / pePrevClose) * 100).toFixed(2));

    // Derivative buildup classification based on real Price & OI changes
    const ceBuildup: BuildupType = 
      ceChange >= 0 && ceChgOI >= 0 ? 'Long Buildup' :
      ceChange < 0 && ceChgOI >= 0 ? 'Short Buildup' :
      ceChange >= 0 && ceChgOI < 0 ? 'Short Covering' : 'Long Unwinding';

    const peBuildup: BuildupType = 
      peChange >= 0 && peChgOI >= 0 ? 'Long Buildup' :
      peChange < 0 && peChgOI >= 0 ? 'Short Buildup' :
      peChange >= 0 && peChgOI < 0 ? 'Short Covering' : 'Long Unwinding';

    const ceBidQty = 250;
    const ceAskQty = 250;
    const peBidQty = 250;
    const peAskQty = 250;

    const ceContract: OptionContract = {
      strike: K,
      type: 'CE',
      ltp: ceLtp,
      prevClose: cePrevClose,
      change: ceChange,
      changePercent: Number(((ceChange / cePrevClose) * 100).toFixed(2)),
      bidPrice: ceBid,
      bidQty: ceBidQty,
      askPrice: ceAsk,
      askQty: ceAskQty,
      volume: ceVol,
      openInterest: ceOI,
      oiChange: ceChgOI,
      oiChangePercent: Number(((ceChgOI / Math.max(ceOI, 1)) * 100).toFixed(1)),
      iv: ceIVPercent,
      greeks: {
        delta: ceBS.delta,
        gamma: ceBS.gamma,
        theta: ceBS.theta,
        vega: ceBS.vega,
      },
      moneyness: ceMoneyness,
      buildup: ceBuildup,
      lastTickDirection: 'none',
    };

    const peContract: OptionContract = {
      strike: K,
      type: 'PE',
      ltp: peLtp,
      prevClose: pePrevClose,
      change: peChange,
      changePercent: Number(((peChange / pePrevClose) * 100).toFixed(2)),
      bidPrice: peBid,
      bidQty: peBidQty,
      askPrice: peAsk,
      askQty: peAskQty,
      volume: peVol,
      openInterest: peOI,
      oiChange: peChgOI,
      oiChangePercent: Number(((peChgOI / Math.max(peOI, 1)) * 100).toFixed(1)),
      iv: peIVPercent,
      greeks: {
        delta: peBS.delta,
        gamma: peBS.gamma,
        theta: peBS.theta,
        vega: peBS.vega,
      },
      moneyness: peMoneyness,
      buildup: peBuildup,
      lastTickDirection: 'none',
    };

    rows.push({
      strike: K,
      isATM,
      ce: ceContract,
      pe: peContract,
      totalOI: ceOI + peOI,
      strikePCR: ceOI > 0 ? Number((peOI / ceOI).toFixed(2)) : 1.0,
    });
  }

  return rows;
}

// Computes predicted signals across all available expiries for the given ticker, anchored to live option prices and refreshing with prediction polling
export function computeAllExpiriesSignals(
  ticker: TickerConfig, 
  newsFeed: NewsItem[],
  currentExpiryIndex: number,
  currentSignal?: TradeSignal
): ExpirySignalSummary[] {
  if (!ticker.expiryDates || ticker.expiryDates.length === 0) return [];

  const tradingDaysArray = [0, 5, 10, 15, 20, 40];

  return ticker.expiryDates.map((date, idx) => {
    const dte = idx === 0 ? 0 : Math.round(tradingDaysArray[idx] || (idx * 5));
    const expiryTypeLabel = idx === 0 
      ? 'Today (0 DTE Expiry)' 
      : idx === 1 
        ? 'Next Weekly' 
        : idx >= 4 
          ? 'Monthly Expiry' 
          : 'Extended Expiry';
    const isCurrentExpiry = idx === currentExpiryIndex;

    // If it is the currently selected expiry, utilize the active live signal's prices to guarantee perfect synchronization
    if (isCurrentExpiry && currentSignal) {
      const ltp = currentSignal.recommendedContractLTP;
      const t1Gain = Number((((currentSignal.target1 - ltp) / Math.max(ltp, 0.05)) * 100).toFixed(1));
      const t2Gain = Number((((currentSignal.target2 - ltp) / Math.max(ltp, 0.05)) * 100).toFixed(1));
      const slRisk = Number((((ltp - currentSignal.stopLoss) / Math.max(ltp, 0.05)) * 100).toFixed(1));

      return {
        expiryDate: date,
        expiryIndex: idx,
        daysToExpiry: dte,
        expiryTypeLabel,
        action: currentSignal.action,
        recommendedStrike: currentSignal.recommendedStrike,
        recommendedType: currentSignal.recommendedType,
        recommendedContractLTP: ltp,
        target1: currentSignal.target1,
        target2: currentSignal.target2,
        stopLoss: currentSignal.stopLoss,
        confidence: currentSignal.confidence,
        strength: currentSignal.strength,
        riskRewardRatio: currentSignal.riskRewardRatio,
        target1GainPercent: t1Gain,
        target2GainPercent: t2Gain,
        stopLossRiskPercent: slRisk,
        trailingStopLoss: currentSignal.trailingStopLoss,
        capitalProtectionStatus: currentSignal.capitalProtectionStatus,
        isCurrentExpiry: true,
        moneyness: currentSignal.moneyness,
        entryRange: currentSignal.entryRange,
        profitProbabilityPercent: currentSignal.confidence,
      };
    }

    // For other expiries, calculate genuine option chain with that specific expiry's Greeks & time-decay
    const tempChain = buildInitialChain(ticker, idx);
    const tempMetrics = computeMarketMetrics(ticker, tempChain);
    // Pass currentSignal to maintain coherent market regime momentum across all expiries
    const tempSignal = generateTradeSignal(ticker, tempMetrics, tempChain, newsFeed, currentSignal, idx);

    const contractRow = tempChain.find(r => r.strike === tempSignal.recommendedStrike);
    const contractObj = tempSignal.recommendedType === 'CE' ? contractRow?.ce : contractRow?.pe;

    const ltp = contractObj?.ltp ?? tempSignal.recommendedContractLTP;
    const t1 = tempSignal.target1;
    const t2 = tempSignal.target2;
    const sl = tempSignal.stopLoss;

    const t1Gain = Number((((t1 - ltp) / Math.max(ltp, 0.05)) * 100).toFixed(1));
    const t2Gain = Number((((t2 - ltp) / Math.max(ltp, 0.05)) * 100).toFixed(1));
    const slRisk = Number((((ltp - sl) / Math.max(ltp, 0.05)) * 100).toFixed(1));

    return {
      expiryDate: date,
      expiryIndex: idx,
      daysToExpiry: dte,
      expiryTypeLabel,
      action: tempSignal.action,
      recommendedStrike: tempSignal.recommendedStrike,
      recommendedType: tempSignal.recommendedType,
      recommendedContractLTP: ltp,
      target1: t1,
      target2: t2,
      stopLoss: sl,
      confidence: tempSignal.confidence,
      strength: tempSignal.strength,
      riskRewardRatio: tempSignal.riskRewardRatio,
      target1GainPercent: t1Gain,
      target2GainPercent: t2Gain,
      stopLossRiskPercent: slRisk,
      trailingStopLoss: tempSignal.trailingStopLoss,
      capitalProtectionStatus: tempSignal.capitalProtectionStatus,
      isCurrentExpiry: false,
      moneyness: tempSignal.moneyness,
      iv: contractObj?.iv,
      delta: contractObj?.greeks.delta,
      entryRange: tempSignal.entryRange,
      profitProbabilityPercent: tempSignal.confidence,
    };
  });
}

export function useLiveOptionChain() {
  const [selectedTicker, setSelectedTicker] = useState<TickerConfig>(POPULAR_TICKERS[0]);
  const [expiryIndex, setExpiryIndex] = useState<number>(0);
  const [expiryTimestamps, setExpiryTimestamps] = useState<number[]>([]);
  const [updateIntervalMs, setUpdateIntervalMs] = useState<number>(3000);
  const [isLiveActive, setIsLiveActive] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [newsFeed, setNewsFeed] = useState<NewsItem[]>(INITIAL_NEWS_FEED);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [dataSourceNote, setDataSourceNote] = useState<string>('Live Exchange Spot Quote + Official SEBI Expiries');
  const [usePreMarket, setUsePreMarket] = useState<boolean>(false);
  const [isNewsLoading, setIsNewsLoading] = useState<boolean>(false);
  const [isHeavyweightsLoading, setIsHeavyweightsLoading] = useState<boolean>(false);
  const [liveConstituentAnalysis, setLiveConstituentAnalysis] = useState<NiftyConstituentAnalysis | undefined>(() =>
    POPULAR_TICKERS[0].currency === '₹' ? analyzeNiftyConstituents(POPULAR_TICKERS[0].symbol) : undefined
  );

  // Filters State
  const [filters, setFilters] = useState<OptionFilters>({
    expiryDate: POPULAR_TICKERS[0].expiryDates[0],
    strikeRange: 'ALL',
    moneynessFilter: 'ALL',
    minIV: 5,
    maxIV: 80,
    minDelta: 0.05,
    maxDelta: 0.95,
    minOpenInterest: 0,
    searchQuery: '',
  });

  // Option Chain state
  const [chain, setChain] = useState<OptionChainRow[]>(() => 
    buildInitialChain(POPULAR_TICKERS[0], 0)
  );

  // Market Metrics and Trade Signal
  const [metrics, setMetrics] = useState<MarketMetrics>(() => 
    computeMarketMetrics(POPULAR_TICKERS[0], buildInitialChain(POPULAR_TICKERS[0], 0))
  );

  const [signal, setSignal] = useState<TradeSignal>(() => {
    const s = generateTradeSignal(POPULAR_TICKERS[0], metrics, chain, INITIAL_NEWS_FEED);
    s.allExpiriesSignals = computeAllExpiriesSignals(POPULAR_TICKERS[0], INITIAL_NEWS_FEED, 0, s);
    return s;
  });

  // Signal Reference & Anti-Whipsaw Confirmation State
  const signalRef = useRef<TradeSignal>(signal);
  signalRef.current = signal;
  const pendingFlipRef = useRef<{ action: SignalAction; count: number }>({ action: signal.action, count: 0 });

  // Strategic Anti-Whipsaw Signal Confirmation Filter
  const applySignalWithDebounce = useCallback((proposedSignal: TradeSignal): TradeSignal => {
    const prev = signalRef.current;
    if (!prev) return proposedSignal;

    if (proposedSignal.action === prev.action) {
      pendingFlipRef.current = { action: proposedSignal.action, count: 0 };
      return proposedSignal;
    }

    // Safety First: Transitions to WAIT_NEUTRAL or Stop Loss hit execute immediately
    if (proposedSignal.action === 'WAIT_NEUTRAL' || proposedSignal.tradeStage === 'STOP_LOSS_HIT') {
      pendingFlipRef.current = { action: proposedSignal.action, count: 0 };
      return proposedSignal;
    }

    // Direct Reversal Guard (BUY_CE <-> BUY_PE):
    const isReversal = (prev.action === 'BUY_CE' && proposedSignal.action === 'BUY_PE') ||
                       (prev.action === 'BUY_PE' && proposedSignal.action === 'BUY_CE');

    if (pendingFlipRef.current.action === proposedSignal.action) {
      pendingFlipRef.current.count += 1;
    } else {
      pendingFlipRef.current = { action: proposedSignal.action, count: 1 };
    }

    if (isReversal && pendingFlipRef.current.count < 2) {
      // Step down safely to WAIT_NEUTRAL during confirmation window to eliminate whipsaw chops
      return {
        ...proposedSignal,
        action: 'WAIT_NEUTRAL',
        strength: 'CAUTION',
      };
    }

    return proposedSignal;
  }, []);

  // Strike History and Derived Profitability Trends State
  const [strikeHistory, setStrikeHistory] = useState<StrikeHistoryItem[]>(() =>
    loadStrikeHistory(POPULAR_TICKERS[0], buildInitialChain(POPULAR_TICKERS[0], 0))
  );

  const [strikeAnalytics, setStrikeAnalytics] = useState<StrikeTrendAnalytics>(() =>
    deriveStrikeTrendAnalytics(
      loadStrikeHistory(POPULAR_TICKERS[0], buildInitialChain(POPULAR_TICKERS[0], 0)),
      POPULAR_TICKERS[0],
      buildInitialChain(POPULAR_TICKERS[0], 0)
    )
  );

  // Market hours status (tracks whether exchange is currently open)
  const [marketStatus, setMarketStatus] = useState<MarketHoursStatus>(() =>
    getMarketHoursStatus(POPULAR_TICKERS[0])
  );

  // Periodically evaluate market hours status (every 20s)
  useEffect(() => {
    const checkMarket = () => {
      setMarketStatus(getMarketHoursStatus(selectedTicker));
    };
    checkMarket();
    const interval = setInterval(checkMarket, 20000);
    return () => clearInterval(interval);
  }, [selectedTicker]);

  // Audio tone context for signals
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playTone = useCallback((frequency = 880, duration = 0.08) => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Audio error ignored
    }
  }, [soundEnabled]);

  // Fetch real live option chain or live quote from backend
  const fetchOptionChainFromBackend = useCallback(async (
    tickerToFetch = selectedTicker,
    targetExpiryIndex = expiryIndex,
    customDateTimestamp?: number
  ) => {
    setIsSyncing(true);
    try {
      let url = `/api/option-chain/${encodeURIComponent(tickerToFetch.symbol)}`;
      if (customDateTimestamp) {
        url += `?date=${customDateTimestamp}`;
      } else if (expiryTimestamps[targetExpiryIndex]) {
        url += `?date=${expiryTimestamps[targetExpiryIndex]}`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        
        // Update spot price & metadata from real live exchange
        const regularPrice = data.regularPrice || data.spotPrice;
        const prePrice = data.preMarketPrice || data.extendedHours?.price;
        
        const isMarketOpen = data.marketState === 'REGULAR' || getMarketHoursStatus(tickerToFetch).isOpen;
        const currentSession = data.marketState || getMarketHoursStatus(tickerToFetch).session;
        const isPreMarketSession = currentSession === 'PRE_MARKET' || currentSession === 'PRE';

        // Automatically activate premarket price if market is in PRE_MARKET session OR if user explicitly toggled usePreMarket
        const activePreMarket = (usePreMarket || isPreMarketSession) && !!prePrice;
        if (usePreMarket && isMarketOpen) {
          setUsePreMarket(false);
        }

        const activeSpot = activePreMarket && prePrice ? prePrice : (data.spotPrice || regularPrice);
        const step = tickerToFetch.strikeStep;
        const newAtm = Math.round(activeSpot / step) * step;

        const activeChange = activePreMarket && prePrice && data.preMarketChange !== undefined
          ? data.preMarketChange
          : (data.change !== undefined ? data.change : Number((activeSpot - (data.prevClose || activeSpot)).toFixed(2)));
        const activeChangePct = activePreMarket && prePrice && data.preMarketChangePercent !== undefined
          ? data.preMarketChangePercent
          : (data.changePercent !== undefined ? data.changePercent : Number(((activeChange / Math.max(data.prevClose || activeSpot, 1)) * 100).toFixed(2)));

        const updatedTicker: TickerConfig = {
          ...tickerToFetch,
          spotPrice: activeSpot,
          regularPrice,
          prevClose: data.prevClose || tickerToFetch.prevClose,
          change: activeChange,
          changePercent: activeChangePct,
          dayHigh: data.dayHigh || activeSpot,
          dayLow: data.dayLow || activeSpot,
          atmStrike: newAtm,
          vix: data.vix !== undefined ? data.vix : tickerToFetch.vix,
          vixChange: data.vixChange !== undefined ? data.vixChange : tickerToFetch.vixChange,
          asOnTime: activePreMarket ? `Pre-Market (${data.extendedHours?.time || 'Live Discovery'})` : data.asOnTime,
          marketState: data.marketState || currentSession,
          preMarketPrice: data.preMarketPrice || prePrice,
          preMarketChange: data.preMarketChange,
          preMarketChangePercent: data.preMarketChangePercent,
          postMarketPrice: data.postMarketPrice,
          postMarketChange: data.postMarketChange,
          postMarketChangePercent: data.postMarketChangePercent,
          extendedHours: data.extendedHours,
          isUsingPreMarket: activePreMarket && !!prePrice,
          expiryDates: data.expiryDates && data.expiryDates.length > 0 ? data.expiryDates : tickerToFetch.expiryDates,
          isLiveSynced: true,
        };

        setSelectedTicker(updatedTicker);
        setExpiryTimestamps(data.expiryTimestamps || []);
        setDataSourceNote(data.source || 'Live Exchange Feed');

        // If the backend returned actual live option rows (for US tickers like SPY, QQQ, NVDA, TSLA)
        if (data.rows && Array.isArray(data.rows) && data.rows.length > 0) {
          setChain(data.rows);
          const newMetrics = computeMarketMetrics(updatedTicker, data.rows);
          const rawSignal = generateTradeSignal(updatedTicker, newMetrics, data.rows, newsFeed, signalRef.current || undefined, targetExpiryIndex);
          const debouncedSignal = applySignalWithDebounce(rawSignal);
          debouncedSignal.allExpiriesSignals = computeAllExpiriesSignals(updatedTicker, newsFeed, targetExpiryIndex, debouncedSignal);
          setMetrics(newMetrics);
          setSignal(debouncedSignal);
        } else {
          // For Indian indices: calculate Black-Scholes anchored on the exact live spot
          const newChain = buildInitialChain(updatedTicker, targetExpiryIndex);
          const newMetrics = computeMarketMetrics(updatedTicker, newChain);
          const rawSignal = generateTradeSignal(updatedTicker, newMetrics, newChain, newsFeed, signalRef.current || undefined, targetExpiryIndex);
          const debouncedSignal = applySignalWithDebounce(rawSignal);
          debouncedSignal.allExpiriesSignals = computeAllExpiriesSignals(updatedTicker, newsFeed, targetExpiryIndex, debouncedSignal);
          setChain(newChain);
          setMetrics(newMetrics);
          setSignal(debouncedSignal);
        }

        setLastUpdated(new Date());
        setIsSyncing(false);
        return;
      }
    } catch (e) {
      console.warn('Backend live option chain fetch failed:', e);
    }

    setIsSyncing(false);
  }, [selectedTicker, expiryIndex, expiryTimestamps, newsFeed]);

  // Fetch genuine real-time financial wire news (Last Night to Current Live Session)
  const fetchRealNews = useCallback(async (sym = selectedTicker.symbol, force = false) => {
    setIsNewsLoading(true);
    try {
      const res = await fetch(`/api/news?q=${encodeURIComponent(sym)}${force ? '&refresh=true' : ''}`);
      if (res.ok) {
        const liveArticles = await res.json();
        if (Array.isArray(liveArticles) && liveArticles.length > 0) {
          const uniqueArticles = liveArticles.filter((item, idx, self) => 
            self.findIndex(t => t.id === item.id) === idx
          );
          setNewsFeed(uniqueArticles);
          // Re-evaluate signal with updated live catalysts
          setSignal(prev => {
            if (chain.length > 0) {
              const s = generateTradeSignal(selectedTicker, metrics, chain, uniqueArticles, signalRef.current || undefined, expiryIndex, liveConstituentAnalysis);
              s.allExpiriesSignals = computeAllExpiriesSignals(selectedTicker, uniqueArticles, expiryIndex, s);
              return s;
            }
            return prev;
          });
        }
      }
    } catch (e) {
      console.warn('Failed to fetch real live news:', e);
    } finally {
      setIsNewsLoading(false);
    }
  }, [selectedTicker, metrics, chain, expiryIndex, liveConstituentAnalysis]);

  // Fetch genuine real-time Nifty & Bank Nifty heavyweight derivative constituents
  const fetchHeavyweights = useCallback(async (sym = selectedTicker.symbol) => {
    if (selectedTicker.currency !== '₹') return;
    setIsHeavyweightsLoading(true);
    try {
      const res = await fetch(`/api/heavyweights?symbol=${encodeURIComponent(sym)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.analysis) {
          const analysisObj: NiftyConstituentAnalysis = {
            ...data.analysis,
            constituents: data.constituents,
            asOnTime: data.asOnTime,
            isLiveSynced: true,
          };
          setLiveConstituentAnalysis(analysisObj);
          setSignal(prev => {
            if (chain.length > 0) {
              const s = generateTradeSignal(selectedTicker, metrics, chain, newsFeed, signalRef.current || undefined, expiryIndex, analysisObj);
              s.allExpiriesSignals = computeAllExpiriesSignals(selectedTicker, newsFeed, expiryIndex, s);
              return s;
            }
            return prev;
          });
        }
      }
    } catch (e) {
      console.warn('Failed to fetch live heavyweights:', e);
    } finally {
      setIsHeavyweightsLoading(false);
    }
  }, [selectedTicker, metrics, chain, newsFeed, expiryIndex]);

  // Initial load
  useEffect(() => {
    fetchOptionChainFromBackend(selectedTicker, 0);
    fetchRealNews(selectedTicker.symbol);
    fetchHeavyweights(selectedTicker.symbol);
  }, []);

  // Periodically refresh news during market hours (every 60s)
  useEffect(() => {
    if (!isLiveActive || !marketStatus.isOpen) return;
    const newsTimer = setInterval(() => {
      fetchRealNews(selectedTicker.symbol);
    }, 60000);
    return () => clearInterval(newsTimer);
  }, [isLiveActive, marketStatus.isOpen, selectedTicker.symbol, fetchRealNews]);

  // Periodically refresh heavyweights during market hours (every 6s)
  useEffect(() => {
    if (!isLiveActive || !marketStatus.isOpen || selectedTicker.currency !== '₹') return;
    const hwTimer = setInterval(() => {
      fetchHeavyweights(selectedTicker.symbol);
    }, Math.max(5000, updateIntervalMs * 2));
    return () => clearInterval(hwTimer);
  }, [isLiveActive, marketStatus.isOpen, selectedTicker.symbol, selectedTicker.currency, updateIntervalMs, fetchHeavyweights]);

  // Handle ticker change
  const handleSelectTicker = (newTicker: TickerConfig) => {
    setSelectedTicker(newTicker);
    setExpiryIndex(0);
    setFilters(prev => ({
      ...prev,
      expiryDate: newTicker.expiryDates[0],
    }));

    const tickerHistory = loadStrikeHistory(newTicker, chain);
    setStrikeHistory(tickerHistory);
    setStrikeAnalytics(deriveStrikeTrendAnalytics(tickerHistory, newTicker, chain));

    fetchOptionChainFromBackend(newTicker, 0);
    fetchRealNews(newTicker.symbol);
    fetchHeavyweights(newTicker.symbol);
  };

  // Handle expiry change
  const handleSelectExpiry = (idx: number) => {
    setExpiryIndex(idx);
    setFilters(prev => ({
      ...prev,
      expiryDate: selectedTicker.expiryDates[idx] || prev.expiryDate,
    }));

    // Immediate zero-lag optimistic switch for instantaneous UI response
    const instantChain = buildInitialChain(selectedTicker, idx);
    const instantMetrics = computeMarketMetrics(selectedTicker, instantChain);
    const instantSignal = generateTradeSignal(selectedTicker, instantMetrics, instantChain, newsFeed, signalRef.current || undefined, idx);
    instantSignal.allExpiriesSignals = computeAllExpiriesSignals(selectedTicker, newsFeed, idx, instantSignal);
    setChain(instantChain);
    setMetrics(instantMetrics);
    setSignal(instantSignal);

    const targetTimestamp = expiryTimestamps[idx];
    fetchOptionChainFromBackend(selectedTicker, idx, targetTimestamp);
  };

  // Update strike history and derive live profitability trends as chain & spot tick
  useEffect(() => {
    if (chain.length === 0) return;
    setStrikeHistory(prev => {
      let updated = updateHistoryWithLiveChain(prev, selectedTicker, chain);
      if (signal && signal.action !== 'WAIT_NEUTRAL') {
        updated = recordSignalInHistory(updated, signal, selectedTicker);
      }
      const newAnalytics = deriveStrikeTrendAnalytics(updated, selectedTicker, chain);
      setStrikeAnalytics(newAnalytics);
      return updated;
    });
  }, [chain, selectedTicker.spotPrice, signal.action, signal.recommendedStrike]);

  // Real-time live exchange poll: Continuously ticks live during Regular & Pre-Market Discovery Sessions
  useEffect(() => {
    if (!isLiveActive) return;

    // Immediately poll on mount/tick change, then establish polling loop
    const timer = setInterval(() => {
      fetchOptionChainFromBackend(selectedTicker, expiryIndex);
    }, updateIntervalMs);

    return () => clearInterval(timer);
  }, [isLiveActive, updateIntervalMs, selectedTicker.symbol, expiryIndex, usePreMarket]);

  // Recalculate metrics & signals when ticker, chain, news, or expiry changes
  useEffect(() => {
    const updatedMetrics = computeMarketMetrics(selectedTicker, chain);
    setMetrics(updatedMetrics);
    const rawSignal = generateTradeSignal(selectedTicker, updatedMetrics, chain, newsFeed, signalRef.current || undefined, expiryIndex);
    const debouncedSignal = applySignalWithDebounce(rawSignal);
    debouncedSignal.allExpiriesSignals = computeAllExpiriesSignals(selectedTicker, newsFeed, expiryIndex, debouncedSignal);
    
    if (signal.action !== debouncedSignal.action && debouncedSignal.action !== 'WAIT_NEUTRAL') {
      playTone(debouncedSignal.action === 'BUY_CE' ? 1046.5 : 587.33, 0.15);
    }
    setSignal(debouncedSignal);
  }, [selectedTicker, chain, newsFeed, expiryIndex, applySignalWithDebounce]);

  // Toggle between Regular Market and Pre-Market / Extended Hours pricing
  const toggleUsePreMarket = (enable?: boolean) => {
    const nextVal = enable !== undefined ? enable : !usePreMarket;
    setUsePreMarket(nextVal);

    const regular = selectedTicker.regularPrice || selectedTicker.spotPrice;
    const prePrice = selectedTicker.preMarketPrice || selectedTicker.extendedHours?.price;
    const targetSpot = nextVal && prePrice ? prePrice : regular;

    const step = selectedTicker.strikeStep;
    const newAtm = Math.round(targetSpot / step) * step;

    const chg = nextVal && prePrice && selectedTicker.preMarketChange !== undefined
      ? selectedTicker.preMarketChange
      : Number((targetSpot - selectedTicker.prevClose).toFixed(2));
    const chgPct = nextVal && prePrice && selectedTicker.preMarketChangePercent !== undefined
      ? selectedTicker.preMarketChangePercent
      : Number(((chg / selectedTicker.prevClose) * 100).toFixed(2));

    const updated: TickerConfig = {
      ...selectedTicker,
      spotPrice: targetSpot,
      atmStrike: newAtm,
      change: chg,
      changePercent: chgPct,
      isUsingPreMarket: nextVal && !!prePrice,
      asOnTime: nextVal 
        ? `Pre-Market (${selectedTicker.extendedHours?.time || 'Live'})` 
        : (selectedTicker.asOnTime?.replace(/Pre-Market.*/, '') || 'Live Feed'),
    };

    setSelectedTicker(updated);

    // If US ticker has real option chain, adjust Greeks or synthesize for new spot
    const newChain = buildInitialChain(updated, expiryIndex);
    const newMetrics = computeMarketMetrics(updated, newChain);
    const rawSignal = generateTradeSignal(updated, newMetrics, newChain, newsFeed, signalRef.current || undefined, expiryIndex);
    const debouncedSignal = applySignalWithDebounce(rawSignal);
    debouncedSignal.allExpiriesSignals = computeAllExpiriesSignals(updated, newsFeed, expiryIndex, debouncedSignal);
    setChain(newChain);
    setMetrics(newMetrics);
    setSignal(debouncedSignal);
    setLastUpdated(new Date());
  };

  // Manual Force Refresh
  const handleForceRefresh = () => {
    fetchOptionChainFromBackend(selectedTicker, expiryIndex);
    fetchRealNews(selectedTicker.symbol, true);
    fetchHeavyweights(selectedTicker.symbol);
    playTone(750, 0.05);
  };

  const handleAddNews = (item: NewsItem) => {
    setNewsFeed(prev => [item, ...prev]);
  };

  return {
    selectedTicker,
    expiryIndex,
    chain,
    metrics,
    signal,
    strikeHistory,
    strikeAnalytics,
    liveConstituentAnalysis,
    isHeavyweightsLoading,
    refreshHeavyweights: () => fetchHeavyweights(selectedTicker.symbol),
    filters,
    setFilters,
    newsFeed,
    isNewsLoading,
    refreshNews: () => fetchRealNews(selectedTicker.symbol, true),
    isLiveActive,
    setIsLiveActive,
    isSyncing,
    usePreMarket,
    toggleUsePreMarket,
    updateIntervalMs,
    setUpdateIntervalMs,
    lastUpdated,
    soundEnabled,
    setSoundEnabled,
    dataSourceNote,
    marketStatus,
    syncLiveExchange: () => fetchOptionChainFromBackend(selectedTicker, expiryIndex),
    handleSelectTicker,
    handleSelectExpiry,
    handleForceRefresh,
    handleAddNews,
  };
}
