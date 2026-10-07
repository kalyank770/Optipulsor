import React, { useState, useMemo, useEffect } from 'react';
import { useLiveOptionChain } from './hooks/useLiveOptionChain';
import { Header } from './components/Header';
import { SignalCard } from './components/SignalCard';
import { FilterBar } from './components/FilterBar';
import { OptionChainTable } from './components/OptionChainTable';
import { StrikeHistoryTrends } from './components/StrikeHistoryTrends';
import { OiDistributionChart } from './components/OiDistributionChart';
import { NewsWidget } from './components/NewsWidget';
import { OptionPayoffModal } from './components/OptionPayoffModal';
import { RealtimeQuantSection } from './components/RealtimeQuantSection';
import { GroundedPayoffSection } from './components/GroundedPayoffSection';
import { HTFPredictionsWorkstation } from './components/HTFPredictionsWorkstation';
import { DaysReportTab } from './components/DaysReportTab';
import { PaperTradingTab } from './components/PaperTradingTab';
import { usePaperTrading } from './hooks/usePaperTrading';
import { computeMultiTimeframePredictions } from './utils/htfPredictionEngine';
import { OptionContract, OptionType } from './types/options';
import { POPULAR_TICKERS } from './data/marketTickers';
import { 
  Download, 
  Table2,
  Zap,
  History,
  BarChart3,
  SlidersHorizontal,
  Newspaper,
  Home,
  Radio,
  Sliders,
  TrendingUp,
  TrendingDown,
  Clock,
  Power,
  X,
  Calendar,
  RefreshCw,
  Compass,
  FileCheck2,
  Wallet
} from 'lucide-react';

export type WorkspaceTab = 'chain' | 'htf' | 'quant' | 'performance' | 'news' | 'report' | 'paper';

export default function App() {
  const {
    selectedTicker,
    expiryIndex,
    chain,
    metrics,
    signal,
    strikeHistory,
    strikeAnalytics,
    filters,
    setFilters,
    newsFeed,
    isNewsLoading,
    refreshNews,
    isLiveActive,
    setIsLiveActive,
    updateIntervalMs,
    setUpdateIntervalMs,
    lastUpdated,
    isSyncing,
    usePreMarket,
    toggleUsePreMarket,
    dataSourceNote,
    marketStatus,
    syncLiveExchange,
    isGiftNiftySyncing,
    giftNiftyLastSynced,
    refreshGiftNifty,
    logCurrentSignalToHistory,
    refreshStrikeHistory,
    resetStrikeHistory,
    handleSelectTicker,
    handleSelectExpiry,
    handleForceRefresh,
  } = useLiveOptionChain();

  // Paper Trading Hook
  const paperTrading = usePaperTrading(selectedTicker, chain);

  // Force dark theme
  useEffect(() => {
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');
    document.documentElement.style.colorScheme = 'dark';
    try {
      localStorage.removeItem('optipulse-theme');
    } catch (e) {}
  }, []);

  // Primary Workstation Tab State
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('chain');

  // Payoff Modal State
  const [modalContract, setModalContract] = useState<OptionContract | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Filter option chain rows based on active filter controls
  const filteredRows = useMemo(() => {
    return chain.filter(row => {
      if (filters.searchQuery) {
        const q = filters.searchQuery.trim().toLowerCase();
        const strikeMatch = row.strike.toString().includes(q);
        if (!strikeMatch) return false;
      }

      if (filters.strikeRange && filters.strikeRange.startsWith('ATM_')) {
        const count = parseInt(filters.strikeRange.replace('ATM_', ''), 10);
        const step = selectedTicker.strikeStep;
        const diff = Math.abs(row.strike - selectedTicker.spotPrice);
        if (diff > step * count) return false;
      } else if (filters.strikeRange === 'CUSTOM') {
        if (filters.customMinStrike && row.strike < filters.customMinStrike) return false;
        if (filters.customMaxStrike && row.strike > filters.customMaxStrike) return false;
      }

      if (filters.moneynessFilter === 'ITM') {
        if (row.ce.moneyness !== 'ITM' && row.pe.moneyness !== 'ITM') return false;
      } else if (filters.moneynessFilter === 'ATM') {
        if (!row.isATM) return false;
      } else if (filters.moneynessFilter === 'OTM') {
        if (row.ce.moneyness !== 'OTM' && row.pe.moneyness !== 'OTM') return false;
      }

      const avgIV = (row.ce.iv + row.pe.iv) / 2;
      if (avgIV < filters.minIV || avgIV > filters.maxIV) return false;

      const absCeDelta = Math.abs(row.ce.greeks.delta);
      const absPeDelta = Math.abs(row.pe.greeks.delta);
      const satisfiesDelta = 
        (absCeDelta >= filters.minDelta && absCeDelta <= filters.maxDelta) ||
        (absPeDelta >= filters.minDelta && absPeDelta <= filters.maxDelta);
      if (!satisfiesDelta) return false;

      if (filters.minOpenInterest > 0) {
        if (row.ce.openInterest < filters.minOpenInterest && row.pe.openInterest < filters.minOpenInterest) {
          return false;
        }
      }

      return true;
    });
  }, [chain, filters, selectedTicker]);

  const handleSelectContract = (strike: number, type: OptionType) => {
    const row = chain.find(r => r.strike === strike);
    if (!row) return;
    const contract = type === 'CE' ? row.ce : row.pe;
    setModalContract(contract);
    setIsModalOpen(true);
  };

  const handleSelectStrike = (strike: number) => {
    handleSelectContract(strike, 'CE');
  };

  const handleSelectTickerBySymbol = (symbol: string) => {
    const found = POPULAR_TICKERS.find(t => t.symbol === symbol);
    if (found) {
      handleSelectTicker(found);
    }
  };

  const handleExportCSV = () => {
    const headers = [
      'Call_OI', 'Call_ChgOI', 'Call_Vol', 'Call_IV', 'Call_Delta', 'Call_Theta', 'Call_LTP',
      'Strike',
      'Put_LTP', 'Put_Theta', 'Put_Delta', 'Put_IV', 'Put_Vol', 'Put_ChgOI', 'Put_OI'
    ];
    const rows = filteredRows.map(r => [
      r.ce.openInterest, r.ce.oiChange, r.ce.volume, r.ce.iv, r.ce.greeks.delta, r.ce.greeks.theta, r.ce.ltp,
      r.strike,
      r.pe.ltp, r.pe.greeks.theta, r.pe.greeks.delta, r.pe.iv, r.pe.volume, r.pe.oiChange, r.pe.openInterest
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${selectedTicker.symbol}_OptionChain_${filters.expiryDate.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const newsBullCount = useMemo(() => newsFeed.filter(n => n.sentiment === 'BULLISH').length, [newsFeed]);
  const newsBearCount = useMemo(() => newsFeed.filter(n => n.sentiment === 'BEARISH').length, [newsFeed]);
  const overallNewsSentiment = useMemo(() => {
    return newsBullCount > newsBearCount ? 'BULLISH' : newsBearCount > newsBullCount ? 'BEARISH' : 'NEUTRAL';
  }, [newsBullCount, newsBearCount]);

  // Higher-Timeframe Multi-Horizon & Expiry Predictions (1H, 1D, 1W & Expiries)
  const htfPredictions = useMemo(() => {
    return signal.htfPredictions || computeMultiTimeframePredictions(
      selectedTicker, 
      metrics, 
      chain, 
      marketStatus,
      signal.interMarketTelemetry,
      newsFeed,
      signal.volumeAnalytics,
      strikeAnalytics
    );
  }, [signal.htfPredictions, selectedTicker, metrics, chain, marketStatus, signal.interMarketTelemetry, newsFeed, signal.volumeAnalytics, strikeAnalytics]);

  // Trade Dynamics Tab Status Indicator Dot (based on predicted trade signal)
  const tradeSentimentDot = useMemo(() => {
    const action = signal?.action;
    const isSideways = Boolean(signal?.sidewaysMarketAnalysis?.isSideways);

    if (action === 'BUY_CE') {
      return {
        color: 'bg-emerald-400 shadow-xs shadow-emerald-400/60',
        title: 'Predicted Trade: Bullish (BUY CE)',
      };
    }
    if (action === 'BUY_PE') {
      return {
        color: 'bg-rose-500 shadow-xs shadow-rose-500/60',
        title: 'Predicted Trade: Bearish (BUY PE)',
      };
    }
    if (isSideways) {
      return {
        color: 'bg-amber-400 shadow-xs shadow-amber-400/60',
        title: 'Predicted Trade: Sideways / Compression Range',
      };
    }
    return {
      color: 'bg-slate-400',
      title: 'Predicted Trade: Neutral / Wait',
    };
  }, [signal?.action, signal?.sidewaysMarketAnalysis?.isSideways]);

  // Candlestick Momentum Tab Status Indicator Dot
  const candlestickSentimentDot = useMemo(() => {
    const bias = htfPredictions?.overallHTFBias || '';
    if (bias.includes('BULLISH') || signal.action === 'BUY_CE') {
      return {
        color: 'bg-emerald-400 shadow-xs shadow-emerald-400/60',
        title: 'Bullish Momentum',
      };
    }
    if (bias.includes('BEARISH') || signal.action === 'BUY_PE') {
      return {
        color: 'bg-rose-500 shadow-xs shadow-rose-500/60',
        title: 'Bearish Momentum',
      };
    }
    if (bias.includes('SIDEWAYS') || bias.includes('RANGE') || signal.sidewaysMarketAnalysis?.isSideways) {
      return {
        color: 'bg-amber-400 shadow-xs shadow-amber-400/60',
        title: 'Sideways / Range',
      };
    }
    return {
      color: 'bg-slate-400',
      title: 'Neutral / Equilibrium',
    };
  }, [htfPredictions?.overallHTFBias, signal.action, signal.sidewaysMarketAnalysis?.isSideways]);

  // News & Catalysts Tab Status Indicator Dot (matches Overall label in News & Catalysts)
  const newsSentimentDot = useMemo(() => {
    if (overallNewsSentiment === 'BULLISH') {
      return {
        color: 'bg-emerald-400 shadow-xs shadow-emerald-400/60',
        title: `Overall: BULLISH (${newsBullCount} positive vs ${newsBearCount} negative)`,
      };
    }
    if (overallNewsSentiment === 'BEARISH') {
      return {
        color: 'bg-rose-500 shadow-xs shadow-rose-500/60',
        title: `Overall: BEARISH (${newsBearCount} negative vs ${newsBullCount} positive)`,
      };
    }
    return {
      color: 'bg-slate-400',
      title: 'Overall: NEUTRAL',
    };
  }, [overallNewsSentiment, newsBullCount, newsBearCount]);

  // Order Flow & Quant Tab Status Indicator Dot (Summarizes Order Flow, PCR, Volume Imbalance & Gamma)
  const quantSentimentDot = useMemo(() => {
    const rt = signal?.realtimeIndicators;
    const orderFlowSentiment = rt?.orderFlow?.sentiment || 'BALANCED_FLOW';
    const volumeDivergence = rt?.volumeAnalytics?.volumeDivergence || 'LOW_VOLUME_CHOP';
    const flowDelta = rt?.orderFlow?.volumeImbalancePercent || 0;
    const pcr = metrics?.pcrTotalOI || 1.0;
    const isSideways = Boolean(signal?.sidewaysMarketAnalysis?.isSideways);

    // 1. Bullish Order Flow & Quant (Green)
    if (
      orderFlowSentiment === 'BUYER_DOMINANCE' || 
      volumeDivergence === 'BULLISH_VOLUME_EXPANSION' || 
      flowDelta >= 10 || 
      (pcr >= 1.10 && flowDelta > 0)
    ) {
      return {
        color: 'bg-emerald-400 shadow-xs shadow-emerald-400/60',
        title: `Bullish Order Flow & Quant (${flowDelta >= 0 ? '+' : ''}${flowDelta}% Delta Imbalance, PCR ${pcr.toFixed(2)})`,
      };
    }

    // 2. Bearish Order Flow & Quant (Red)
    if (
      orderFlowSentiment === 'SELLER_DOMINANCE' || 
      volumeDivergence === 'BEARISH_VOLUME_EXPANSION' || 
      flowDelta <= -10 || 
      (pcr <= 0.88 && flowDelta < 0)
    ) {
      return {
        color: 'bg-rose-500 shadow-xs shadow-rose-500/60',
        title: `Bearish Order Flow & Quant (${flowDelta}% Delta Imbalance, PCR ${pcr.toFixed(2)})`,
      };
    }

    // 3. Sideways Range / Compression Flow (Yellow)
    if (
      isSideways || 
      volumeDivergence === 'LOW_VOLUME_CHOP' || 
      (Math.abs(flowDelta) < 5 && (pcr >= 0.95 && pcr <= 1.05))
    ) {
      return {
        color: 'bg-amber-400 shadow-xs shadow-amber-400/60',
        title: `Sideways / Range Chop Quant Flow (${flowDelta >= 0 ? '+' : ''}${flowDelta}% Delta, PCR ${pcr.toFixed(2)})`,
      };
    }

    // 4. Neutral Equilibrium Flow (Grey)
    return {
      color: 'bg-slate-400',
      title: `Neutral Quant Flow (PCR ${pcr.toFixed(2)})`,
    };
  }, [signal?.realtimeIndicators, metrics?.pcrTotalOI, signal?.sidewaysMarketAnalysis?.isSideways]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header & Ticker Bar */}
      <Header
        selectedTicker={selectedTicker}
        onSelectTicker={handleSelectTicker}
        onGoHome={scrollToTop}
        isLiveActive={isLiveActive}
        onToggleLive={() => setIsLiveActive(!isLiveActive)}
        updateIntervalMs={updateIntervalMs}
        onChangeInterval={setUpdateIntervalMs}
        onForceRefresh={handleForceRefresh}
        lastUpdated={lastUpdated}
        unreadNewsCount={newsFeed.length}
        isSyncing={isSyncing}
        onSyncLiveExchange={syncLiveExchange}
        syncStatusMsg={dataSourceNote}
        marketStatus={marketStatus}
        usePreMarket={usePreMarket}
        onTogglePreMarket={toggleUsePreMarket}
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab as WorkspaceTab)}
      />

      {/* Main Workspace Area */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-2.5 sm:px-6 py-3 sm:py-5 space-y-4 sm:space-y-6 pb-12 sm:pb-16">
        {/* Official Exchange Trading Holiday Notice Banner */}
        {marketStatus?.isHoliday && (
          <div className="bg-gradient-to-r from-amber-950/60 via-slate-900 to-amber-950/40 border border-amber-500/40 rounded-xl p-3 sm:p-4 text-xs shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0 mt-0.5">
                <Calendar className="w-5 h-5 text-amber-400" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-sm sm:text-base text-amber-200">
                    Official Exchange Trading Holiday: {marketStatus.holidayName}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10.5px] font-mono font-bold bg-amber-500/25 text-amber-300 border border-amber-500/50 uppercase">
                    {marketStatus.marketName} CLOSED
                  </span>
                </div>
                <p className="text-slate-300 text-xs sm:text-[13px] leading-relaxed max-w-3xl">
                  {marketStatus.holidayDescription || `National Stock Exchange of India (NSE) is CLOSED today for ${marketStatus.holidayName}. Regular trading is halted across all Cash, Futures & Options (F&O) derivatives segments.`}
                </p>
                <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] font-mono text-slate-400">
                  <span className="text-amber-300 font-semibold">
                    Next Active Session: {marketStatus.nextOpenMsg || 'Monday at 09:15 AM IST'}
                  </span>
                  <span className="text-slate-600">·</span>
                  <span>Data Status: <strong className="text-slate-200">Official Settled Closing Quotes from Last Active Session</strong></span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
              <button
                onClick={syncLiveExchange}
                disabled={isSyncing}
                title="Verify real market activeness with official exchange endpoint"
                className="px-3 py-2 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700 hover:border-slate-600 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-sm disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>Verify Exchange Activeness</span>
              </button>
            </div>
          </div>
        )}



        {/* Workstation Tab Navigation Bar */}
        <div className="bg-slate-900/95 border border-slate-800/90 rounded-xl p-1 sm:p-1.5 shadow-sm sticky top-[72px] sm:top-[126px] z-30 backdrop-blur-md">
          <div className="flex items-center justify-between gap-1 overflow-x-auto no-scrollbar text-xs font-medium">
            {/* Tab 1: Option Chain / Trade Dynamics */}
            <button
              onClick={() => setActiveTab('chain')}
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 rounded-lg transition-all cursor-pointer shrink-0 min-h-[38px] ${
                activeTab === 'chain'
                  ? 'bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
              title={`Trade Dynamics: ${tradeSentimentDot.title}`}
            >
              <Table2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Trade<span className="hidden xs:inline"> Dynamics</span></span>
              <span className={`w-2 h-2 rounded-full ${tradeSentimentDot.color} animate-pulse shrink-0`} />
            </button>

            {/* Tab 2: 1H · 1D · 1W & Expiry Predictions */}
            <button
              onClick={() => setActiveTab('htf')}
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 rounded-lg transition-all cursor-pointer shrink-0 min-h-[38px] ${
                activeTab === 'htf'
                  ? 'bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
              title={`Candlestick Momentum: ${candlestickSentimentDot.title}`}
            >
              <Compass className="w-4 h-4 text-emerald-400 shrink-0" />
              <span><span className="hidden sm:inline">Candlestick </span>Momentum</span>
              <span className={`w-2 h-2 rounded-full ${candlestickSentimentDot.color} animate-pulse shrink-0`} />
            </button>

            {/* Tab 3: Quant & Order Flow */}
            <button
              onClick={() => setActiveTab('quant')}
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 rounded-lg transition-all cursor-pointer shrink-0 min-h-[38px] ${
                activeTab === 'quant'
                  ? 'bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
              title={`Order Flow & Quant: ${quantSentimentDot.title}`}
            >
              <Zap className="w-4 h-4 text-emerald-400 shrink-0" />
              <span><span className="hidden sm:inline">Order Flow &amp; </span>Quant</span>
              <span className={`w-2 h-2 rounded-full ${quantSentimentDot.color} animate-pulse shrink-0`} />
            </button>

            {/* Tab 4: News & Catalysts */}
            <button
              onClick={() => setActiveTab('news')}
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 rounded-lg transition-all cursor-pointer shrink-0 min-h-[38px] relative ${
                activeTab === 'news'
                  ? 'bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
              title={`News & Catalysts: ${newsSentimentDot.title}`}
            >
              <Radio className="w-4 h-4 text-amber-400 shrink-0" />
              <span>News<span className="hidden sm:inline"> &amp; Catalysts</span></span>
              <span className={`w-2 h-2 rounded-full ${newsSentimentDot.color} animate-pulse shrink-0`} />
            </button>

            {/* Tab 5: Audit Report */}
            <button
              onClick={() => setActiveTab('report')}
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 rounded-lg transition-all cursor-pointer shrink-0 min-h-[38px] ${
                activeTab === 'report'
                  ? 'bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <FileCheck2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Audit<span className="hidden sm:inline"> Report</span></span>
            </button>

            {/* Tab 6: Paper Trading Desk */}
            <button
              onClick={() => setActiveTab('paper')}
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 rounded-lg transition-all cursor-pointer shrink-0 min-h-[38px] ${
                activeTab === 'paper'
                  ? 'bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
              title="Paper Trading Simulator: Trade real market data with virtual dummy money"
            >
              <Wallet className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Paper<span className="hidden sm:inline"> Trading</span></span>
              {paperTrading.portfolio.openPositions.length > 0 && (
                <span className="px-1.5 py-0.2 text-[10px] font-mono font-bold rounded-full bg-emerald-500 text-slate-950 shrink-0">
                  {paperTrading.portfolio.openPositions.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* WORKSPACE VIEW 1: OPTION CHAIN & MARKET DEPTH (INCLUDES PRIMARY LIVE SIGNAL CARD) */}
        {activeTab === 'chain' && (
          <section id="section-chain" className="space-y-4 sm:space-y-6 animate-fade-in">
            {/* Primary Trade Recommendation Signal Card */}
            <div aria-label="Trade Signal" id="section-signal">
              <SignalCard
                signal={signal}
                ticker={selectedTicker}
                metrics={metrics}
                chain={chain}
                onSelectContractForSimulation={handleSelectContract}
                isSyncing={isSyncing}
                theme="dark"
                currentExpiryIndex={expiryIndex}
                onSelectExpiry={handleSelectExpiry}
                usePreMarket={usePreMarket}
                onTogglePreMarket={toggleUsePreMarket}
                marketStatus={marketStatus}
                onSelectTab={(tab) => setActiveTab(tab as WorkspaceTab)}
                giftNiftyLastSynced={giftNiftyLastSynced}
                isGiftNiftySyncing={isGiftNiftySyncing}
                onRefreshGiftNifty={refreshGiftNifty}
              />
            </div>

            <div className="bg-slate-900/90 border border-slate-800/90 rounded-xl p-3 sm:p-4 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shrink-0">
                    <Table2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                      <span>Trade Dynamics Ladder Matrix</span>
                      <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
                        {filteredRows.length} Strikes
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">
                      Live Greeks, Volume/OI, ITM highlights & instant simulation triggers
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    onClick={handleExportCSV}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-mono transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-400" />
                    <span>Export CSV</span>
                  </button>
                </div>
              </div>

              {/* Filter Controls */}
              <FilterBar
                filters={filters}
                setFilters={setFilters}
                ticker={selectedTicker}
                expiryIndex={expiryIndex}
                onSelectExpiry={handleSelectExpiry}
                filteredCount={filteredRows.length}
                totalCount={chain.length}
              />

              {/* Option Chain Table */}
              <OptionChainTable
                rows={filteredRows}
                ticker={selectedTicker}
                recommendedStrike={signal.recommendedStrike}
                recommendedType={signal.recommendedType}
                maxPainStrike={metrics.maxPainStrike}
                onSelectContract={handleSelectContract}
                theme="dark"
              />
            </div>

            {/* OI Distribution & Institutional Walls */}
            <div className="bg-slate-900/90 border border-slate-800/90 rounded-xl p-3 sm:p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shrink-0">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                      <span>Open Interest (OI) & Max Pain Distribution</span>
                      <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
                        Max Pain: {metrics.maxPainStrike}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">
                      Visual comparison of Call vs Put open interest hurdles and support/resistance walls
                    </p>
                  </div>
                </div>
              </div>

              <OiDistributionChart
                rows={filteredRows}
                ticker={selectedTicker}
                metrics={metrics}
                onSelectStrike={handleSelectStrike}
                theme="dark"
              />
            </div>
          </section>
        )}

        {/* WORKSPACE VIEW 2: DEDICATED CANDLESTICK MOMENTUM (2M, 5M, 15M, 1H, 1D, 1W) & EXPIRIES PAGE */}
        {activeTab === 'htf' && (
          <section id="section-htf" className="space-y-4 animate-fade-in">
            <HTFPredictionsWorkstation
              predictions={htfPredictions}
              ticker={selectedTicker}
              signal={signal}
              candleAnalysis={signal.candleAnalysis}
              onSelectContractForSimulation={handleSelectContract}
            />
          </section>
        )}

        {/* WORKSPACE VIEW 2: ORDER FLOW & QUANT TELEMETRY */}
        {activeTab === 'quant' && (
          <section id="section-quant" className="space-y-4 animate-fade-in">
            {/* Real-Time Quantitative Indicators & Inter-Market Telemetry */}
            <RealtimeQuantSection 
              indicators={signal.realtimeIndicators} 
              interMarketTelemetry={signal.interMarketTelemetry}
              currency={selectedTicker.currency} 
              tickerSymbol={selectedTicker.symbol}
              chain={chain}
              spotPrice={selectedTicker.spotPrice}
            />

            {/* Grounded Target Exit & Multi-Pillar Model */}
            <GroundedPayoffSection 
              synthesis={signal.targetExitSynthesis}
              signal={signal}
              currency={selectedTicker.currency}
            />

            {/* Algorithmic Signal Summary */}
            <div className="bg-slate-900/90 border border-slate-800/90 rounded-xl p-4 sm:p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2.5 pb-2 border-b border-slate-800">
                <Zap className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm sm:text-base font-bold text-white">Algorithmic Order Flow & Quant Telemetry</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs">
                <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800/90">
                  <div className="text-slate-400 font-semibold mb-1 uppercase tracking-wider text-[11px]">1. Put-Call Ratio (PCR)</div>
                  <div className="text-2xl font-bold font-mono text-emerald-400">{metrics.pcrTotalOI.toFixed(2)}</div>
                  <p className="text-slate-400 mt-1.5 text-xs">
                    {metrics.pcrTotalOI >= 1.15
                      ? 'Put writing creates durable support below spot.'
                      : metrics.pcrTotalOI <= 0.85
                      ? 'Call writing caps upside potential.'
                      : 'PCR balanced; awaiting directional catalyst.'}
                  </p>
                </div>

                <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800/90">
                  <div className="text-slate-400 font-semibold mb-1 uppercase tracking-wider text-[11px]">2. Institutional Walls</div>
                  <div className="font-mono space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Put Wall (Support):</span>
                      <span className="text-emerald-400 font-bold">{selectedTicker.currency}{metrics.majorSupportStrike.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Call Wall (Resistance):</span>
                      <span className="text-rose-400 font-bold">{selectedTicker.currency}{metrics.majorResistanceStrike.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Max Pain Strike:</span>
                      <span className="text-sky-400 font-bold">{selectedTicker.currency}{metrics.maxPainStrike.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800/90">
                  <div className="text-slate-400 font-semibold mb-1 uppercase tracking-wider text-[11px]">3. Implied Volatility Context</div>
                  <div className="text-2xl font-bold font-mono text-amber-400">IV Rank {metrics.ivRank}%</div>
                  <p className="text-slate-400 mt-1.5 text-xs">
                    VIX is at {selectedTicker.vix.toFixed(2)}. {metrics.ivRank < 40 ? 'Fair extrinsic pricing for directional option buyers.' : 'Elevated IV; disciplined stop loss is mandatory.'}
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* WORKSPACE VIEW 3: STRIKE HISTORY & PERFORMANCE */}
        {activeTab === 'performance' && (
          <section id="section-trends" className="space-y-4 animate-fade-in">
            <StrikeHistoryTrends
              ticker={selectedTicker}
              chain={chain}
              history={strikeHistory}
              analytics={strikeAnalytics}
              onSelectContract={handleSelectContract}
              onLogCurrentSignal={logCurrentSignalToHistory}
              onRefreshHistory={refreshStrikeHistory}
              onResetHistory={resetStrikeHistory}
              theme="dark"
            />
          </section>
        )}

        {/* WORKSPACE VIEW 4: LIVE NEWS & CATALYSTS */}
        {activeTab === 'news' && (
          <section id="section-news" className="space-y-4 animate-fade-in">
            <NewsWidget
              news={newsFeed}
              selectedTicker={selectedTicker}
              onSelectTickerBySymbol={handleSelectTickerBySymbol}
              onRefreshNews={refreshNews}
              isNewsLoading={isNewsLoading}
              theme="dark"
            />
          </section>
        )}

        {/* WORKSPACE VIEW 5: DAY'S REPORT & PREDICTION AUDIT */}
        {activeTab === 'report' && (
          <section id="section-report" className="space-y-4 animate-fade-in">
            <DaysReportTab
              ticker={selectedTicker}
              chain={chain}
              signal={signal}
              onSelectContract={handleSelectContract}
              onSyncLiveExchange={syncLiveExchange}
              isSyncing={isSyncing}
            />
          </section>
        )}

        {/* WORKSPACE VIEW 6: PAPER TRADING SIMULATOR DESK */}
        {activeTab === 'paper' && (
          <section id="section-paper" className="space-y-4 animate-fade-in">
            <PaperTradingTab
              portfolio={paperTrading.portfolio}
              summaryMetrics={paperTrading.summaryMetrics}
              currentTicker={selectedTicker}
              chain={chain}
              signal={signal}
              htfPredictions={htfPredictions}
              onExecuteOrder={paperTrading.executeOrder}
              onSquareOffPosition={paperTrading.squareOffPosition}
              onPartialSquareOff={paperTrading.partialSquareOff}
              onUpdatePositionSlTp={paperTrading.updatePositionSlTp}
              onResetPortfolio={paperTrading.resetPortfolio}
              autoExecuteStopLoss={paperTrading.autoExecuteStopLoss}
              onToggleAutoStopLoss={paperTrading.setAutoExecuteStopLoss}
              lastNotification={paperTrading.lastNotification}
              onDismissNotification={() => paperTrading.setLastNotification(null)}
            />
          </section>
        )}
      </main>

      {/* Interactive Payoff Simulation Modal */}
      <OptionPayoffModal
        contract={modalContract}
        ticker={selectedTicker}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        signal={signal}
      />
    </div>
  );
}
