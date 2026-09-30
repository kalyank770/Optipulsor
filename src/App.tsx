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
  X
} from 'lucide-react';

export type WorkspaceTab = 'chain' | 'quant' | 'performance' | 'news';

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
    handleSelectTicker,
    handleSelectExpiry,
    handleForceRefresh,
  } = useLiveOptionChain();

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
      />

      {/* Main Workspace Area */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-2.5 sm:px-6 py-3 sm:py-5 space-y-4 sm:space-y-6 pb-12 sm:pb-16">
        {/* Pre-Market Discovery Banner if active */}
        {usePreMarket && (
          <div className="bg-amber-950/40 border border-amber-500/30 rounded-lg p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <Zap className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="font-mono text-amber-200">
                <span>Pre-Market Discovery Spot: </span>
                <strong className="text-white">
                  {selectedTicker.currency}{(selectedTicker.preMarketPrice || selectedTicker.spotPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </strong>
                <span className="text-slate-500 mx-1.5">·</span>
                <span>Gap: </span>
                <span className={selectedTicker.change >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  {selectedTicker.change >= 0 ? '+' : ''}{selectedTicker.change.toFixed(2)} ({selectedTicker.changePercent >= 0 ? '+' : ''}{selectedTicker.changePercent.toFixed(2)}%)
                </span>
              </div>
            </div>
            <button
              onClick={() => toggleUsePreMarket(false)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold cursor-pointer shrink-0 self-start sm:self-auto"
            >
              <Power className="w-3.5 h-3.5 text-amber-400" />
              <span>Restore Regular Spot</span>
            </button>
          </div>
        )}

        {/* Primary Trade Recommendation Signal Card */}
        <section aria-label="Trade Signal" id="section-signal">
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
          />
        </section>

        {/* Workstation Tab Navigation Bar */}
        <div className="bg-slate-900/95 border border-slate-800/90 rounded-xl p-1 sm:p-1.5 shadow-sm sticky top-14 z-30 backdrop-blur-md">
          <div className="flex items-center justify-between gap-1 overflow-x-auto no-scrollbar text-xs font-medium">
            {/* Tab 1: Option Chain */}
            <button
              onClick={() => setActiveTab('chain')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg transition-all cursor-pointer shrink-0 min-h-[38px] ${
                activeTab === 'chain'
                  ? 'bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Table2 className="w-4 h-4 text-emerald-400" />
              <span>Option Chain & Depth</span>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-800/80 px-1.5 py-0.2 rounded border border-slate-700/50">
                {filteredRows.length}
              </span>
            </button>

            {/* Tab 2: Quant & Order Flow */}
            <button
              onClick={() => setActiveTab('quant')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg transition-all cursor-pointer shrink-0 min-h-[38px] ${
                activeTab === 'quant'
                  ? 'bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Zap className="w-4 h-4 text-emerald-400" />
              <span>Order Flow & Quant</span>
            </button>

            {/* Tab 3: Strike History & Stats */}
            <button
              onClick={() => setActiveTab('performance')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg transition-all cursor-pointer shrink-0 min-h-[38px] ${
                activeTab === 'performance'
                  ? 'bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <History className="w-4 h-4 text-sky-400" />
              <span>Strike History</span>
              <span className="text-[10px] font-mono text-sky-300 bg-sky-950/60 px-1.5 py-0.2 rounded border border-sky-800/50">
                {strikeAnalytics.overallWinRate}% Win
              </span>
            </button>

            {/* Tab 4: News & Catalysts */}
            <button
              onClick={() => setActiveTab('news')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg transition-all cursor-pointer shrink-0 min-h-[38px] relative ${
                activeTab === 'news'
                  ? 'bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Radio className="w-4 h-4 text-amber-400" />
              <span>News & Catalysts</span>
              {newsFeed.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </button>
          </div>
        </div>

        {/* WORKSPACE VIEW 1: OPTION CHAIN & MARKET DEPTH */}
        {activeTab === 'chain' && (
          <section id="section-chain" className="space-y-4 animate-fade-in">
            <div className="bg-slate-900/90 border border-slate-800/90 rounded-xl p-3 sm:p-4 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shrink-0">
                    <Table2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                      <span>Option Chain Ladder Matrix</span>
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
