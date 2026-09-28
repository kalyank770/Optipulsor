import React, { useState, useMemo } from 'react';
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
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  Compass,
  Activity,
  Gauge,
  Radio,
  TrendingUp,
  TrendingDown,
  Clock
} from 'lucide-react';

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
    soundEnabled,
    setSoundEnabled,
    isSyncing,
    usePreMarket,
    toggleUsePreMarket,
    dataSourceNote,
    marketStatus,
    syncLiveExchange,
    handleSelectTicker,
    handleSelectExpiry,
    handleForceRefresh,
  } = useLiveOptionChain();

  // Active view navigation & section expansion state
  type SectionKey = 'chain' | 'signals' | 'quant' | 'grounded_payoff' | 'trends' | 'oi_map' | 'strategy' | 'news';

  const [activeView, setActiveView] = useState<SectionKey | 'home'>('home');
  const [activeNavSection, setActiveNavSection] = useState<SectionKey | 'home'>('home');

  // Collapsible section state: All sections collapsed by default when Home is selected on reload
  const [expandedSections, setExpandedSections] = useState<Record<SectionKey, boolean>>({
    chain: false,
    signals: false,
    quant: false,
    grounded_payoff: false,
    trends: false,
    oi_map: false,
    strategy: false,
    news: false,
  });

  // Toggle individual section expansion
  const toggleSection = (key: SectionKey) => {
    setExpandedSections(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Expand All / Collapse All handlers
  const handleExpandAll = () => {
    setExpandedSections({
      chain: true,
      signals: true,
      quant: true,
      grounded_payoff: true,
      trends: true,
      oi_map: true,
      strategy: true,
      news: true,
    });
  };

  const handleCollapseAll = () => {
    setExpandedSections({
      chain: false,
      signals: false,
      quant: false,
      grounded_payoff: false,
      trends: false,
      oi_map: false,
      strategy: false,
      news: false,
    });
    setActiveNavSection('home');
  };

  const isAllExpanded = Object.values(expandedSections).every(Boolean);

  // Smooth scroll navigation to specific section
  const handleNavigateSection = (view: SectionKey | 'home') => {
    setActiveNavSection(view);

    if (view === 'home') {
      handleCollapseAll();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Expand clicked section and collapse all other sections
    setExpandedSections({
      chain: view === 'chain',
      signals: view === 'signals',
      quant: view === 'quant',
      grounded_payoff: view === 'grounded_payoff',
      trends: view === 'trends',
      oi_map: view === 'oi_map',
      strategy: view === 'strategy',
      news: view === 'news',
    });

    setActiveView(view);

    setTimeout(() => {
      const element = document.getElementById(`section-${view}`) || (view === 'signals' ? document.getElementById('section-signal') : null);
      if (element) {
        const headerOffset = 85;
        const elementPosition = element.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

        window.scrollTo({
          top: Math.max(0, offsetPosition),
          behavior: 'smooth'
        });
      }
    }, 40);
  };

  // Simulation modal state
  const [modalContract, setModalContract] = useState<OptionContract | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Filter chain rows based on active filters
  const filteredRows = useMemo(() => {
    return chain.filter(row => {
      // 1. Search Query
      if (filters.searchQuery.trim()) {
        const q = filters.searchQuery.trim();
        if (!row.strike.toString().includes(q)) return false;
      }

      // 2. Strike Range Filter
      const step = selectedTicker.strikeStep;
      const atmDist = Math.abs(row.strike - selectedTicker.atmStrike) / step;
      if (filters.strikeRange === 'ATM_5' && atmDist > 5) return false;
      if (filters.strikeRange === 'ATM_10' && atmDist > 10) return false;
      if (filters.strikeRange === 'ATM_15' && atmDist > 15) return false;

      // 3. Moneyness Filter (if user wants to view only ITM, ATM, or OTM)
      if (filters.moneynessFilter === 'ITM') {
        if (row.ce.moneyness !== 'ITM' && row.pe.moneyness !== 'ITM') return false;
      } else if (filters.moneynessFilter === 'ATM') {
        if (!row.isATM) return false;
      } else if (filters.moneynessFilter === 'OTM') {
        if (row.ce.moneyness !== 'OTM' && row.pe.moneyness !== 'OTM') return false;
      }

      // 4. Volatility (IV) metrics filter
      const avgIV = (row.ce.iv + row.pe.iv) / 2;
      if (avgIV < filters.minIV || avgIV > filters.maxIV) return false;

      // 5. Delta threshold filter
      const absCeDelta = Math.abs(row.ce.greeks.delta);
      const absPeDelta = Math.abs(row.pe.greeks.delta);
      const satisfiesDelta = 
        (absCeDelta >= filters.minDelta && absCeDelta <= filters.maxDelta) ||
        (absPeDelta >= filters.minDelta && absPeDelta <= filters.maxDelta);
      if (!satisfiesDelta) return false;

      // 6. Liquidity (Min Open Interest)
      if (filters.minOpenInterest > 0) {
        if (row.ce.openInterest < filters.minOpenInterest && row.pe.openInterest < filters.minOpenInterest) {
          return false;
        }
      }

      return true;
    });
  }, [chain, filters, selectedTicker]);

  // Handle contract selection for payoff simulation modal
  const handleSelectContract = (strike: number, type: OptionType) => {
    const row = chain.find(r => r.strike === strike);
    if (!row) return;
    const contract = type === 'CE' ? row.ce : row.pe;
    setModalContract(contract);
    setIsModalOpen(true);
  };

  // Select strike from chart
  const handleSelectStrike = (strike: number) => {
    handleSelectContract(strike, 'CE');
  };

  // Select ticker by symbol name (e.g. from news click)
  const handleSelectTickerBySymbol = (symbol: string) => {
    const found = POPULAR_TICKERS.find(t => t.symbol === symbol);
    if (found) {
      handleSelectTicker(found);
    }
  };

  // Export option chain to CSV
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

  // Compute overall news sentiment
  const newsBullCount = useMemo(() => newsFeed.filter(n => n.sentiment === 'BULLISH').length, [newsFeed]);
  const newsBearCount = useMemo(() => newsFeed.filter(n => n.sentiment === 'BEARISH').length, [newsFeed]);
  const overallNewsSentiment = useMemo(() => {
    return newsBullCount > newsBearCount ? 'BULLISH' : newsBearCount > newsBullCount ? 'BEARISH' : 'NEUTRAL';
  }, [newsBullCount, newsBearCount]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Bar Contract Navigation & Live Spot Quote Strip */}
      <Header
        selectedTicker={selectedTicker}
        onSelectTicker={handleSelectTicker}
        onGoHome={() => handleNavigateSection('home')}
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
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-2.5 sm:px-6 py-3 sm:py-6 space-y-6 sm:space-y-8 pb-28 sm:pb-24">
        {/* CE vs PE Recommendation Signal Card (Always prominent) */}
        <section aria-label="Trade Signal" id="section-signal">
          <SignalCard
            signal={signal}
            ticker={selectedTicker}
            metrics={metrics}
            chain={chain}
            onSelectContractForSimulation={handleSelectContract}
            isSyncing={isSyncing}
          />
        </section>

        {/* Global Dashboard Section Control Bar: Expand All / Collapse All */}
        <div className="flex items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 rounded-lg p-2.5 px-3.5 sm:px-4 text-xs font-mono shadow-sm">
          <div className="flex items-center gap-2 text-slate-400 truncate">
            <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-slate-300 font-semibold truncate">Dashboard Sections:</span>
            <span className="text-slate-400 hidden sm:inline truncate">
              ({Object.values(expandedSections).filter(Boolean).length} of {Object.keys(expandedSections).length} expanded)
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isAllExpanded ? (
              <button
                onClick={handleCollapseAll}
                className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold transition-colors cursor-pointer text-xs min-h-[30px]"
                title="Collapse all sections"
              >
                <Minimize2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Collapse All</span>
              </button>
            ) : (
              <button
                onClick={handleExpandAll}
                className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-bold transition-colors cursor-pointer text-xs min-h-[30px]"
                title="Expand all sections"
              >
                <Maximize2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Expand All</span>
              </button>
            )}
          </div>
        </div>

        {/* Section 1: Option Chain Matrix View */}
        <section id="section-chain" className="space-y-3 pt-2">
          {/* Section Accordion Header */}
          <div 
            onClick={() => toggleSection('chain')}
            className={`bg-slate-900/90 hover:bg-slate-900 border rounded-lg p-3 sm:p-4 flex items-center justify-between gap-3 cursor-pointer transition-colors shadow-sm select-none ${
              expandedSections.chain ? 'border-emerald-500/50 ring-1 ring-emerald-500/30' : 'border-slate-800'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shrink-0">
                <Table2 className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <span>Option Chain Split Matrix</span>
                  <span className="text-[11px] font-mono text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
                    {filteredRows.length} Strikes
                  </span>
                </h3>
                <p className="text-xs text-slate-400 font-mono hidden sm:block mt-0.5">
                  Live NSE option ladder with ITM highlights, Black-Scholes Greeks, and Volume/OI bars
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button className="p-1 text-slate-400 hover:text-white" title={expandedSections.chain ? "Collapse section" : "Expand section"}>
                {expandedSections.chain ? <ChevronUp className="w-5 h-5 text-emerald-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
              </button>
            </div>
          </div>

          {/* Section Body */}
          {expandedSections.chain && (
            <div className="space-y-4 pt-1">
              <FilterBar
                filters={filters}
                setFilters={setFilters}
                ticker={selectedTicker}
                expiryIndex={expiryIndex}
                onSelectExpiry={handleSelectExpiry}
                filteredCount={filteredRows.length}
                totalCount={chain.length}
              />

              <div className="flex items-center justify-between text-xs text-slate-400">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-mono text-emerald-400 font-semibold">{dataSourceNote}</span>
                  <span className="text-slate-600">·</span>
                  <span className="text-slate-300 font-mono">{selectedTicker.asOnTime || 'Live Exchange Feed'}</span>
                  <span className="text-slate-600">·</span>
                  <span className="text-amber-400">Yellow = ITM</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportCSV}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export CSV</span>
                  </button>
                </div>
              </div>

              <OptionChainTable
                rows={filteredRows}
                ticker={selectedTicker}
                recommendedStrike={signal.recommendedStrike}
                recommendedType={signal.recommendedType}
                maxPainStrike={metrics.maxPainStrike}
                onSelectContract={handleSelectContract}
              />
            </div>
          )}
        </section>

        {/* Section 2: Dedicated CE/PE Signal Engine Analysis */}
        <section id="section-signals" className="space-y-3 pt-2">
          {/* Section Accordion Header */}
          <div 
            onClick={() => toggleSection('signals')}
            className={`bg-slate-900/90 hover:bg-slate-900 border rounded-lg p-3 sm:p-4 flex items-center justify-between gap-3 cursor-pointer transition-colors shadow-sm select-none ${
              expandedSections.signals ? 'border-emerald-500/50 ring-1 ring-emerald-500/30' : 'border-slate-800'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shrink-0">
                <Zap className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <span>Algorithmic Signal Telemetry & Order Flow</span>
                  <span className="text-[11px] font-mono text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
                    PCR: {metrics.pcrTotalOI.toFixed(2)}
                  </span>
                </h3>
                <p className="text-xs text-slate-400 font-mono hidden sm:block mt-0.5">
                  PCR buildup, Max Pain gravitation, institutional walls & volatility context
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button className="p-1 text-slate-400 hover:text-white" title={expandedSections.signals ? "Collapse section" : "Expand section"}>
                {expandedSections.signals ? <ChevronUp className="w-5 h-5 text-emerald-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
              </button>
            </div>
          </div>

          {/* Section Body */}
          {expandedSections.signals && (
            <div className="space-y-6 pt-1">
              <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-5">
                <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-emerald-400" />
                  <span>Algorithmic Signal Matrix & Institutional Order Flow</span>
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed max-w-4xl mb-4">
                  OptiPulse pairs real-time option chain dynamics with spot price action to evaluate whether long call (CE) or long put (PE) offers asymmetric edge. The model continuously tracks Put-Call Ratio (PCR), Open Interest (OI) buildup, Max Pain gravitation, and implied volatility crush risks.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                    <div className="text-xs font-semibold text-slate-300 uppercase mb-2">1. Volume & OI Ratio (PCR)</div>
                    <div className="text-2xl font-bold font-mono text-emerald-400">{metrics.pcrTotalOI.toFixed(2)}</div>
                    <p className="text-xs text-slate-400 mt-2">
                      {metrics.pcrTotalOI >= 1.15
                        ? 'Heavy Put writing creates a durable support floor below spot. Bullish bias.'
                        : metrics.pcrTotalOI <= 0.85
                        ? 'Heavy Call writing caps upside potential. Bearish bias.'
                        : 'PCR is balanced. Market is awaiting directional catalyst.'}
                    </p>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                    <div className="text-xs font-semibold text-slate-300 uppercase mb-2">2. Institutional Walls</div>
                    <div className="text-xs font-mono space-y-1">
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

                  <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                    <div className="text-xs font-semibold text-slate-300 uppercase mb-2">3. Volatility Context</div>
                    <div className="text-2xl font-bold font-mono text-amber-400">IV Rank {metrics.ivRank}%</div>
                    <p className="text-xs text-slate-400 mt-2">
                      VIX is at {selectedTicker.vix.toFixed(2)}. Option premiums carry {metrics.ivRank < 40 ? 'low extrinsic pricing, providing safe entry for directional option buyers' : 'elevated implied volatility; stop loss discipline is mandatory'}.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Section 3: Real-Time Quantitative Parameters & Engine Tuning */}
        <section id="section-quant" className="space-y-3 pt-2">
          {/* Section Accordion Header */}
          <div 
            onClick={() => toggleSection('quant')}
            className={`bg-slate-900/90 hover:bg-slate-900 border rounded-lg p-3 sm:p-4 flex items-center justify-between gap-3 cursor-pointer transition-colors shadow-sm select-none ${
              expandedSections.quant ? 'border-emerald-500/50 ring-1 ring-emerald-500/30' : 'border-slate-800'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shrink-0">
                <Gauge className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <span>Real-Time Quantitative Parameters</span>
                </h3>
                <p className="text-xs text-slate-400 font-mono hidden sm:block mt-0.5">
                  VWAP Channel · RSI · MACD Velocity · EMA 9/21 · Net Gamma (GEX) · Order Flow · VIX State
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button className="p-1 text-slate-400 hover:text-white" title={expandedSections.quant ? "Collapse section" : "Expand section"}>
                {expandedSections.quant ? <ChevronUp className="w-5 h-5 text-emerald-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
              </button>
            </div>
          </div>

          {/* Section Body */}
          {expandedSections.quant && (
            <div className="pt-1">
              <RealtimeQuantSection 
                indicators={signal.realtimeIndicators} 
                currency={selectedTicker.currency} 
              />
            </div>
          )}
        </section>

        {/* Section 4: Grounded Target Entry & Exit Payoff Architecture */}
        <section id="section-grounded_payoff" className="space-y-3 pt-2">
          {/* Section Accordion Header */}
          <div 
            onClick={() => toggleSection('grounded_payoff')}
            className={`bg-slate-900/90 hover:bg-slate-900 border rounded-lg p-3 sm:p-4 flex items-center justify-between gap-3 cursor-pointer transition-colors shadow-sm select-none ${
              expandedSections.grounded_payoff ? 'border-emerald-500/50 ring-1 ring-emerald-500/30' : 'border-slate-800'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shrink-0">
                <Compass className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <span>Grounded Target Entry & Exit Payoff Architecture</span>
                </h3>
                <p className="text-xs text-slate-400 font-mono hidden sm:block mt-0.5">
                  Multi-Pivot Target Synthesis, Spot Derivation & Option Premium Risk/Reward Matrix
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button className="p-1 text-slate-400 hover:text-white" title={expandedSections.grounded_payoff ? "Collapse section" : "Expand section"}>
                {expandedSections.grounded_payoff ? <ChevronUp className="w-5 h-5 text-emerald-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
              </button>
            </div>
          </div>

          {/* Section Body */}
          {expandedSections.grounded_payoff && (
            <div className="pt-1">
              <GroundedPayoffSection 
                synthesis={signal.targetExitSynthesis}
                signal={signal}
                currency={selectedTicker.currency}
              />
            </div>
          )}
        </section>

        {/* Section 5: Strike Recommendation History & Profitability Trends */}
        <section id="section-trends" className="space-y-3 pt-2">
          {/* Section Accordion Header */}
          <div 
            onClick={() => toggleSection('trends')}
            className={`bg-slate-900/90 hover:bg-slate-900 border rounded-lg p-3 sm:p-4 flex items-center justify-between gap-3 cursor-pointer transition-colors shadow-sm select-none ${
              expandedSections.trends ? 'border-emerald-500/50 ring-1 ring-emerald-500/30' : 'border-slate-800'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shrink-0">
                <History className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <span>Strike History & Profitability Trends</span>
                  <span className="text-[11px] font-mono text-sky-400 font-bold bg-sky-950/60 px-2 py-0.5 rounded border border-sky-800/60">
                    {strikeAnalytics.overallWinRate}% Win Rate
                  </span>
                </h3>
                <p className="text-xs text-slate-400 font-mono hidden sm:block mt-0.5">
                  Historical signal log, strike win rate rankings, and cumulative trend convergence
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button className="p-1 text-slate-400 hover:text-white" title={expandedSections.trends ? "Collapse section" : "Expand section"}>
                {expandedSections.trends ? <ChevronUp className="w-5 h-5 text-emerald-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
              </button>
            </div>
          </div>

          {/* Section Body */}
          {expandedSections.trends && (
            <div className="pt-1">
              <StrikeHistoryTrends
                ticker={selectedTicker}
                chain={chain}
                history={strikeHistory}
                analytics={strikeAnalytics}
                onSelectContract={handleSelectContract}
              />
            </div>
          )}
        </section>

        {/* Section 4: OI Distribution & Walls */}
        <section id="section-oi_map" className="space-y-3 pt-2">
          {/* Section Accordion Header */}
          <div 
            onClick={() => toggleSection('oi_map')}
            className={`bg-slate-900/90 hover:bg-slate-900 border rounded-lg p-3 sm:p-4 flex items-center justify-between gap-3 cursor-pointer transition-colors shadow-sm select-none ${
              expandedSections.oi_map ? 'border-emerald-500/50 ring-1 ring-emerald-500/30' : 'border-slate-800'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shrink-0">
                <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <span>OI Distribution & Institutional Walls</span>
                  <span className="text-[11px] font-mono text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
                    Max Pain: {metrics.maxPainStrike}
                  </span>
                </h3>
                <p className="text-xs text-slate-400 font-mono hidden sm:block mt-0.5">
                  Visual open interest distribution chart across call & put strikes
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button className="p-1 text-slate-400 hover:text-white" title={expandedSections.oi_map ? "Collapse section" : "Expand section"}>
                {expandedSections.oi_map ? <ChevronUp className="w-5 h-5 text-emerald-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
              </button>
            </div>
          </div>

          {/* Section Body */}
          {expandedSections.oi_map && (
            <div className="pt-1">
              <OiDistributionChart
                rows={filteredRows}
                ticker={selectedTicker}
                metrics={metrics}
                onSelectStrike={handleSelectStrike}
              />
            </div>
          )}
        </section>

        {/* Section 5: Strategy & Payoff Simulator */}
        <section id="section-strategy" className="space-y-3 pt-2">
          {/* Section Accordion Header */}
          <div 
            onClick={() => toggleSection('strategy')}
            className={`bg-slate-900/90 hover:bg-slate-900 border rounded-lg p-3 sm:p-4 flex items-center justify-between gap-3 cursor-pointer transition-colors shadow-sm select-none ${
              expandedSections.strategy ? 'border-emerald-500/50 ring-1 ring-emerald-500/30' : 'border-slate-800'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shrink-0">
                <SlidersHorizontal className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <span>Options Payoff & Risk Simulator</span>
                  <span className="text-[11px] font-mono text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
                    Interactive Greeks
                  </span>
                </h3>
                <p className="text-xs text-slate-400 font-mono hidden sm:block mt-0.5">
                  Simulate payoff curves, profit zones, and theta decay timelines
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button className="p-1 text-slate-400 hover:text-white" title={expandedSections.strategy ? "Collapse section" : "Expand section"}>
                {expandedSections.strategy ? <ChevronUp className="w-5 h-5 text-emerald-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
              </button>
            </div>
          </div>

          {/* Section Body */}
          {expandedSections.strategy && (
            <div className="pt-1">
              <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-6 text-white">
                <div className="max-w-2xl mx-auto text-center py-6">
                  <h3 className="text-xl font-bold mb-2 flex items-center justify-center gap-2">
                    <SlidersHorizontal className="w-5 h-5 text-emerald-400" />
                    <span>Options Payoff & Risk Simulator</span>
                  </h3>
                  <p className="text-sm text-slate-400 mb-6">
                    Inspect payoff curves, breakeven thresholds, and Greeks for any strike. Currently recommended contract is ready for simulation below:
                  </p>
                  <button
                    onClick={() => handleSelectContract(signal.recommendedStrike, signal.recommendedType)}
                    className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg transition-colors cursor-pointer text-sm shadow-md"
                  >
                    Launch Simulator for {signal.recommendedStrike} {signal.recommendedType}
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Section 6: Real-time News Feed Wire */}
        <section id="section-news" className="space-y-3 pt-2">
          {/* Section Accordion Header */}
          <div 
            onClick={() => toggleSection('news')}
            className={`bg-slate-900/90 hover:bg-slate-900 border rounded-lg p-3 sm:p-4 flex items-center justify-between gap-3 cursor-pointer transition-colors shadow-sm select-none ${
              expandedSections.news ? 'border-emerald-500/50 ring-1 ring-emerald-500/30' : 'border-slate-800'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shrink-0">
                <Newspaper className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white flex flex-wrap items-center gap-2">
                  <span>Options Market News & Macro Catalysts</span>
                  <span className="text-[11px] font-mono text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60 shrink-0">
                    {newsFeed.length} Wire Items
                  </span>
                  
                  {/* Overall news-based market movement badge beside section header */}
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold uppercase border tracking-wider shrink-0 ${
                    overallNewsSentiment === 'BULLISH' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                    overallNewsSentiment === 'BEARISH' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
                    'bg-slate-800 text-slate-300 border-slate-700'
                  }`}>
                    {overallNewsSentiment === 'BULLISH' ? <TrendingUp className="w-3 h-3 text-emerald-400" /> : overallNewsSentiment === 'BEARISH' ? <TrendingDown className="w-3 h-3 text-rose-400" /> : <Clock className="w-3 h-3 text-slate-400" />}
                    <span>Market Sentiment: {overallNewsSentiment}</span>
                  </span>
                </h3>
                <p className="text-xs text-slate-400 font-mono hidden sm:block mt-0.5">
                  Overnight global market catalysts and live intraday breaking news Affecting CE & PE strikes
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button className="p-1 text-slate-400 hover:text-white" title={expandedSections.news ? "Collapse section" : "Expand section"}>
                {expandedSections.news ? <ChevronUp className="w-5 h-5 text-emerald-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
              </button>
            </div>
          </div>

          {/* Section Body */}
          {expandedSections.news && (
            <div className="pt-1">
              <NewsWidget
                news={newsFeed}
                selectedTicker={selectedTicker}
                onSelectTickerBySymbol={handleSelectTickerBySymbol}
                onRefreshNews={refreshNews}
                isNewsLoading={isNewsLoading}
              />
            </div>
          )}
        </section>
      </main>

      {/* Payoff Simulation Modal */}
      <OptionPayoffModal
        contract={modalContract}
        ticker={selectedTicker}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        signal={signal}
      />

      {/* Universal Fixed Bottom Navigation Bar (Active for both Desktop and Mobile views) */}
      <nav 
        aria-label="Bottom Navigation Toolbar"
        className="fixed bottom-0 left-0 right-0 z-50 bg-slate-950/95 backdrop-blur-md border-t border-slate-800/90 py-1.5 sm:py-2 px-1 sm:px-4 shadow-2xl safe-area-bottom font-sans"
      >
        <div className="max-w-[1200px] mx-auto flex items-center justify-between sm:justify-center sm:gap-1.5 md:gap-3 overflow-x-auto no-scrollbar px-1">
          {/* Home Option */}
          <button
            onClick={() => handleNavigateSection('home')}
            className={`shrink-0 sm:flex-none flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 py-1 px-2 sm:px-3 sm:py-1.5 rounded-lg transition-all cursor-pointer min-h-[44px] sm:min-h-[38px] group ${
              activeNavSection === 'home'
                ? 'bg-sky-500/15 text-sky-300 font-bold border border-sky-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-900/80'
            }`}
            title="Home - Scroll to Top & Collapse All Sections"
          >
            <Home className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-sky-400 group-hover:scale-110 transition-transform shrink-0" />
            <span className="text-[9px] sm:text-xs font-medium tracking-tight whitespace-nowrap">Home</span>
          </button>

          {/* Option Chain */}
          <button
            onClick={() => handleNavigateSection('chain')}
            className={`shrink-0 sm:flex-none flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 py-1 px-2 sm:px-3 sm:py-1.5 rounded-lg transition-all cursor-pointer min-h-[44px] sm:min-h-[38px] ${
              activeNavSection === 'chain' && expandedSections.chain 
                ? 'bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/40 shadow-sm' 
                : 'text-slate-400 hover:text-white hover:bg-slate-900/80'
            }`}
            title="Expand & Scroll to Option Chain Matrix"
          >
            <Table2 className="w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0" />
            <span className="text-[9px] sm:text-xs font-medium tracking-tight whitespace-nowrap">
              <span className="hidden md:inline">Option </span>Chain
            </span>
          </button>

          {/* CE / PE Signal */}
          <button
            onClick={() => handleNavigateSection('signals')}
            className={`shrink-0 sm:flex-none flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 py-1 px-2 sm:px-3 sm:py-1.5 rounded-lg transition-all cursor-pointer min-h-[44px] sm:min-h-[38px] ${
              activeNavSection === 'signals' && expandedSections.signals 
                ? 'bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/40 shadow-sm' 
                : 'text-slate-400 hover:text-white hover:bg-slate-900/80'
            }`}
            title="Expand & Scroll to Trade Recommendation"
          >
            <Zap className="w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0" />
            <span className="text-[9px] sm:text-xs font-medium tracking-tight whitespace-nowrap">
              Signal
            </span>
          </button>

          {/* Quant Params */}
          <button
            onClick={() => handleNavigateSection('quant')}
            className={`shrink-0 sm:flex-none flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 py-1 px-2 sm:px-3 sm:py-1.5 rounded-lg transition-all cursor-pointer min-h-[44px] sm:min-h-[38px] ${
              activeNavSection === 'quant' && expandedSections.quant 
                ? 'bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/40 shadow-sm' 
                : 'text-slate-400 hover:text-white hover:bg-slate-900/80'
            }`}
            title="Expand & Scroll to Quantitative Parameters"
          >
            <Gauge className="w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0" />
            <span className="text-[9px] sm:text-xs font-medium tracking-tight whitespace-nowrap">
              Quant<span className="hidden md:inline"> Params</span>
            </span>
          </button>

          {/* Grounded Payoff */}
          <button
            onClick={() => handleNavigateSection('grounded_payoff')}
            className={`shrink-0 sm:flex-none flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 py-1 px-2 sm:px-3 sm:py-1.5 rounded-lg transition-all cursor-pointer min-h-[44px] sm:min-h-[38px] ${
              activeNavSection === 'grounded_payoff' && expandedSections.grounded_payoff 
                ? 'bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/40 shadow-sm' 
                : 'text-slate-400 hover:text-white hover:bg-slate-900/80'
            }`}
            title="Expand & Scroll to Grounded Target Entry & Exit Payoff"
          >
            <Compass className="w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0" />
            <span className="text-[9px] sm:text-xs font-medium tracking-tight whitespace-nowrap">
              <span className="hidden md:inline">Grounded </span>Payoff
            </span>
          </button>

          {/* Strike History Trends */}
          <button
            onClick={() => handleNavigateSection('trends')}
            className={`shrink-0 sm:flex-none flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 py-1 px-2 sm:px-3 sm:py-1.5 rounded-lg transition-all cursor-pointer min-h-[44px] sm:min-h-[38px] ${
              activeNavSection === 'trends' && expandedSections.trends 
                ? 'bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/40 shadow-sm' 
                : 'text-slate-400 hover:text-white hover:bg-slate-900/80'
            }`}
            title="Expand & Scroll to Strike History & Win Rates"
          >
            <History className="w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0" />
            <span className="text-[9px] sm:text-xs font-medium tracking-tight whitespace-nowrap">
              Trends
            </span>
          </button>

          {/* OI Walls */}
          <button
            onClick={() => handleNavigateSection('oi_map')}
            className={`shrink-0 sm:flex-none flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 py-1 px-2 sm:px-3 sm:py-1.5 rounded-lg transition-all cursor-pointer min-h-[44px] sm:min-h-[38px] ${
              activeNavSection === 'oi_map' && expandedSections.oi_map 
                ? 'bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/40 shadow-sm' 
                : 'text-slate-400 hover:text-white hover:bg-slate-900/80'
            }`}
            title="Expand & Scroll to OI Walls & Max Pain Distribution"
          >
            <BarChart3 className="w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0" />
            <span className="text-[9px] sm:text-xs font-medium tracking-tight whitespace-nowrap">OI Walls</span>
          </button>

          {/* Payoff Simulator */}
          <button
            onClick={() => handleNavigateSection('strategy')}
            className={`shrink-0 sm:flex-none flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 py-1 px-2 sm:px-3 sm:py-1.5 rounded-lg transition-all cursor-pointer min-h-[44px] sm:min-h-[38px] ${
              activeNavSection === 'strategy' && expandedSections.strategy 
                ? 'bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/40 shadow-sm' 
                : 'text-slate-400 hover:text-white hover:bg-slate-900/80'
            }`}
            title="Expand & Scroll to Payoff & Greeks Simulator"
          >
            <SlidersHorizontal className="w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0" />
            <span className="text-[9px] sm:text-xs font-medium tracking-tight whitespace-nowrap">Simulator</span>
          </button>

          {/* News Wire */}
          <button
            onClick={() => handleNavigateSection('news')}
            className={`shrink-0 sm:flex-none flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 py-1 px-2 sm:px-3 sm:py-1.5 rounded-lg transition-all cursor-pointer min-h-[44px] sm:min-h-[38px] relative ${
              activeNavSection === 'news' && expandedSections.news 
                ? 'bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/40 shadow-sm' 
                : 'text-slate-400 hover:text-white hover:bg-slate-900/80'
            }`}
            title="Expand & Scroll to Live News Wire & Catalysts"
          >
            <Newspaper className="w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0" />
            <span className="text-[9px] sm:text-xs font-medium tracking-tight whitespace-nowrap">
              News<span className="hidden md:inline"> Wire</span>
            </span>
            {newsFeed && newsFeed.length > 0 && (
              <span className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5 w-2 h-2 rounded-full bg-emerald-400 font-bold animate-pulse" />
            )}
          </button>
        </div>
      </nav>
    </div>
  );
}
