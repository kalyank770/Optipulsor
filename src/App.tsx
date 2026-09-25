import React, { useState, useMemo } from 'react';
import { useLiveOptionChain } from './hooks/useLiveOptionChain';
import { Header } from './components/Header';
import { SignalCard } from './components/SignalCard';
import { FilterBar } from './components/FilterBar';
import { OptionChainTable } from './components/OptionChainTable';
import { OiDistributionChart } from './components/OiDistributionChart';
import { NewsWidget } from './components/NewsWidget';
import { OptionPayoffModal } from './components/OptionPayoffModal';
import { OptionContract, OptionType } from './types/options';
import { POPULAR_TICKERS } from './data/marketTickers';
import { 
  Download, 
  Table2,
  Zap,
  BarChart3,
  SlidersHorizontal,
  Newspaper
} from 'lucide-react';

export default function App() {
  const {
    selectedTicker,
    expiryIndex,
    chain,
    metrics,
    signal,
    filters,
    setFilters,
    newsFeed,
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
    syncLiveExchange,
    setManualSpotPrice,
    setManualContractLtp,
    handleSelectTicker,
    handleSelectExpiry,
    handleForceRefresh,
  } = useLiveOptionChain();

  // Active view navigation
  const [activeView, setActiveView] = useState<'chain' | 'signals' | 'oi_map' | 'news' | 'strategy'>('chain');

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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Bar Contract Navigation & Live Spot Quote Strip */}
      <Header
        selectedTicker={selectedTicker}
        onSelectTicker={handleSelectTicker}
        activeView={activeView}
        setActiveView={setActiveView}
        isLiveActive={isLiveActive}
        onToggleLive={() => setIsLiveActive(!isLiveActive)}
        updateIntervalMs={updateIntervalMs}
        onChangeInterval={setUpdateIntervalMs}
        onForceRefresh={handleForceRefresh}
        lastUpdated={lastUpdated}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled(!soundEnabled)}
        unreadNewsCount={newsFeed.length}
        isSyncing={isSyncing}
        onSyncLiveExchange={syncLiveExchange}
        syncStatusMsg={dataSourceNote}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-2.5 sm:px-6 py-3 sm:py-6 space-y-3.5 sm:space-y-6 pb-24 md:pb-8">
        {/* CE vs PE Recommendation Signal Card (Always prominent) */}
        <section aria-label="Trade Signal">
          <SignalCard
            signal={signal}
            ticker={selectedTicker}
            metrics={metrics}
            chain={chain}
            onSelectContractForSimulation={handleSelectContract}
            isSyncing={isSyncing}
          />
        </section>

        {/* Tab 1: Option Chain Matrix View (Default) */}
        {activeView === 'chain' && (
          <div className="space-y-4">
            {/* Filter Bar with Expiry, Strike Range, Moneyness, and Volatility Metrics */}
            <FilterBar
              filters={filters}
              setFilters={setFilters}
              ticker={selectedTicker}
              expiryIndex={expiryIndex}
              onSelectExpiry={handleSelectExpiry}
              filteredCount={filteredRows.length}
              totalCount={chain.length}
            />

            {/* Quick Action Toolbar */}
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

            {/* Institutional Option Chain Split Matrix Table */}
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

        {/* Tab 2: Dedicated CE/PE Signal Engine Analysis Tab */}
        {activeView === 'signals' && (
          <div className="space-y-6">
            <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-5">
              <h3 className="text-base font-bold text-white mb-2">
                Algorithmic Signal Matrix & Institutional Order Flow
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed max-w-4xl mb-4">
                OptiPulse pairs real-time option chain dynamics with spot price action to evaluate whether long call (CE) or long put (PE) offers asymmetric edge. The model continuously tracks Put-Call Ratio (PCR), Open Interest (OI) buildup, Max Pain gravitation, and implied volatility crush risks.
              </p>

              {/* Multi-point telemetry table */}
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

            {/* Quick News alignment in signals tab */}
            <NewsWidget
              news={newsFeed}
              selectedTicker={selectedTicker}
              onSelectTickerBySymbol={handleSelectTickerBySymbol}
            />
          </div>
        )}

        {/* Tab 3: OI Distribution & Walls */}
        {activeView === 'oi_map' && (
          <div className="space-y-6">
            <OiDistributionChart
              rows={filteredRows}
              ticker={selectedTicker}
              metrics={metrics}
              onSelectStrike={handleSelectStrike}
            />
          </div>
        )}

        {/* Tab 4: Strategy & Payoff Simulator */}
        {activeView === 'strategy' && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-6">
            <div className="max-w-2xl mx-auto text-center py-8">
              <h3 className="text-xl font-bold text-white mb-2">Options Payoff & Risk Simulator</h3>
              <p className="text-sm text-slate-400 mb-6">
                Inspect payoff curves, breakeven thresholds, and Greeks for any strike. Currently recommended contract is ready for simulation below:
              </p>
              <button
                onClick={() => handleSelectContract(signal.recommendedStrike, signal.recommendedType)}
                className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg transition-colors cursor-pointer text-sm"
              >
                Launch Simulator for {signal.recommendedStrike} {signal.recommendedType}
              </button>
            </div>
          </div>
        )}

        {/* Tab 5: Real-time News Feed */}
        {activeView === 'news' && (
          <div className="space-y-4">
            <NewsWidget
              news={newsFeed}
              selectedTicker={selectedTicker}
              onSelectTickerBySymbol={handleSelectTickerBySymbol}
            />
          </div>
        )}
      </main>

      {/* Payoff Simulation Modal */}
      <OptionPayoffModal
        contract={modalContract}
        ticker={selectedTicker}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      {/* Mobile Bottom Navigation Bar (Fixed for mobile trading experience) */}
      <nav 
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 px-1.5 py-1 flex items-center justify-around shadow-2xl safe-area-bottom"
      >
        <button
          onClick={() => setActiveView('chain')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg transition-colors cursor-pointer min-h-[44px] ${
            activeView === 'chain' 
              ? 'text-emerald-400 font-bold' 
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Table2 className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Chain</span>
        </button>

        <button
          onClick={() => setActiveView('signals')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg transition-colors cursor-pointer min-h-[44px] ${
            activeView === 'signals' 
              ? 'text-emerald-400 font-bold' 
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Zap className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Signal</span>
        </button>

        <button
          onClick={() => setActiveView('oi_map')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg transition-colors cursor-pointer min-h-[44px] ${
            activeView === 'oi_map' 
              ? 'text-emerald-400 font-bold' 
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <BarChart3 className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">OI Walls</span>
        </button>

        <button
          onClick={() => setActiveView('strategy')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg transition-colors cursor-pointer min-h-[44px] ${
            activeView === 'strategy' 
              ? 'text-emerald-400 font-bold' 
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <SlidersHorizontal className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Payoff</span>
        </button>

        <button
          onClick={() => setActiveView('news')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg transition-colors cursor-pointer min-h-[44px] ${
            activeView === 'news' 
              ? 'text-emerald-400 font-bold' 
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Newspaper className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">News</span>
        </button>
      </nav>
    </div>
  );
}
