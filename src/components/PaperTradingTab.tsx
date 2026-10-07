import React, { useState, useMemo } from 'react';
import { 
  PaperPortfolio, 
  PaperTradeOrder 
} from '../types/paperTrading';
import { 
  TickerConfig, 
  OptionChainRow, 
  TradeSignal
} from '../types/options';
import { MultiTimeframePredictionSuite } from '../types/htfPredictions';
import { NewOrderParams } from '../hooks/usePaperTrading';
import { POPULAR_TICKERS } from '../data/marketTickers';
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  Zap, 
  RefreshCw, 
  ShieldAlert, 
  Target, 
  CheckCircle2, 
  AlertCircle, 
  DollarSign, 
  BarChart3, 
  History, 
  Play, 
  X, 
  Sliders, 
  ArrowUpRight, 
  ArrowDownRight, 
  Lock, 
  HelpCircle,
  Download,
  Scissors,
  Edit2,
  SlidersHorizontal,
  Flame,
  Award
} from 'lucide-react';

interface PaperTradingTabProps {
  portfolio: PaperPortfolio;
  summaryMetrics: {
    totalUnrealizedPnL: number;
    netPortfolioValue: number;
    totalPnL: number;
    totalReturnPercent: number;
    totalClosed: number;
    winRate: number;
    winningTradesCount: number;
    losingTradesCount: number;
    profitFactor: number;
    avgWin: number;
    avgLoss: number;
  };
  currentTicker: TickerConfig;
  chain: OptionChainRow[];
  signal: TradeSignal;
  htfPredictions?: MultiTimeframePredictionSuite;
  onExecuteOrder: (params: NewOrderParams) => { success: boolean; message: string };
  onSquareOffPosition: (orderId: string, customExitPrice?: number, reason?: PaperTradeOrder['exitReason']) => void;
  onPartialSquareOff: (orderId: string, lotsToExit: number, customExitPrice?: number) => void;
  onUpdatePositionSlTp: (orderId: string, newSl: number, newTp1: number, newTp2: number) => void;
  onResetPortfolio: (newInitialCash?: number) => void;
  autoExecuteStopLoss: boolean;
  onToggleAutoStopLoss: (enabled: boolean) => void;
  lastNotification: string | null;
  onDismissNotification: () => void;
}

export const PaperTradingTab: React.FC<PaperTradingTabProps> = ({
  portfolio,
  summaryMetrics,
  currentTicker,
  chain,
  signal,
  htfPredictions,
  onExecuteOrder,
  onSquareOffPosition,
  onPartialSquareOff,
  onUpdatePositionSlTp,
  onResetPortfolio,
  autoExecuteStopLoss,
  onToggleAutoStopLoss,
  lastNotification,
  onDismissNotification
}) => {
  const currency = currentTicker.currency || '₹';

  // Manual Order Desk Form State
  const [selectedTickerSymbol, setSelectedTickerSymbol] = useState<string>(currentTicker.symbol);
  const [selectedOptionType, setSelectedOptionType] = useState<'CE' | 'PE'>('CE');
  const [selectedStrike, setSelectedStrike] = useState<number>(signal.recommendedStrike || currentTicker.atmStrike);
  const [lotsInput, setLotsInput] = useState<number>(1);
  const [customPrice, setCustomPrice] = useState<string>('');
  const [customSl, setCustomSl] = useState<string>('');
  const [customTp1, setCustomTp1] = useState<string>('');
  const [customTp2, setCustomTp2] = useState<string>('');

  // UI Modal States
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetCashChoice, setResetCashChoice] = useState<number>(1000000);
  
  // Partial Exit Modal
  const [partialModalPos, setPartialModalPos] = useState<PaperTradeOrder | null>(null);
  const [partialExitLots, setPartialExitLots] = useState<number>(1);

  // Edit SL/TP Modal
  const [editSlTpPos, setEditSlTpPos] = useState<PaperTradeOrder | null>(null);
  const [editSlInput, setEditSlInput] = useState<string>('');
  const [editTp1Input, setEditTp1Input] = useState<string>('');
  const [editTp2Input, setEditTp2Input] = useState<string>('');

  // Find target contract from live chain
  const activeTickerObj = POPULAR_TICKERS.find(t => t.symbol === selectedTickerSymbol) || currentTicker;
  const activeRow = chain.find(r => r.strike === selectedStrike);
  const activeContract = selectedOptionType === 'CE' ? activeRow?.ce : activeRow?.pe;
  const liveLtp = activeContract?.ltp || (selectedStrike === signal.recommendedStrike ? signal.recommendedContractLTP : 120.00);

  // Default target calculations for manual form
  const entryPriceToUse = customPrice ? parseFloat(customPrice) : liveLtp;
  const calculatedSl = customSl ? parseFloat(customSl) : Number((entryPriceToUse * 0.85).toFixed(2));
  const calculatedTp1 = customTp1 ? parseFloat(customTp1) : Number((entryPriceToUse * 1.25).toFixed(2));
  const calculatedTp2 = customTp2 ? parseFloat(customTp2) : Number((entryPriceToUse * 1.50).toFixed(2));

  const totalQty = Math.max(1, lotsInput) * activeTickerObj.lotSize;
  const requiredMargin = entryPriceToUse * totalQty;

  const handleExecuteManualOrder = () => {
    const res = onExecuteOrder({
      tickerSymbol: selectedTickerSymbol,
      underlyingSpot: activeTickerObj.spotPrice,
      strike: selectedStrike,
      optionType: selectedOptionType,
      expiryDate: activeTickerObj.expiryDates?.[0] || '13-Oct-2026',
      orderType: 'BUY',
      lots: Math.max(1, lotsInput),
      lotSize: activeTickerObj.lotSize,
      entryPrice: entryPriceToUse,
      stopLoss: calculatedSl,
      target1: calculatedTp1,
      target2: calculatedTp2,
      strategyName: `Manual Paper Order (${selectedOptionType})`
    });
    if (!res.success) {
      alert(res.message);
    }
  };

  // Quick Execute Suggested Signal
  const handleQuickExecuteSignal = (
    strike: number, 
    type: 'CE' | 'PE', 
    entryLtp: number, 
    sl: number, 
    tp1: number, 
    tp2: number, 
    strategyName: string,
    lots: number = 1
  ) => {
    const res = onExecuteOrder({
      tickerSymbol: currentTicker.symbol,
      underlyingSpot: currentTicker.spotPrice,
      strike,
      optionType: type,
      expiryDate: currentTicker.expiryDates?.[0] || '13-Oct-2026',
      orderType: 'BUY',
      lots,
      lotSize: currentTicker.lotSize,
      entryPrice: entryLtp > 0 ? entryLtp : 100,
      stopLoss: sl,
      target1: tp1,
      target2: tp2,
      strategyName
    });
    if (!res.success) {
      alert(res.message);
    }
  };

  // Export Paper Trading Journal
  const handleExportJournal = () => {
    if (portfolio.closedTrades.length === 0) {
      alert('No closed paper trades to export yet.');
      return;
    }
    const headers = ['Trade_ID', 'Symbol', 'Strike', 'Option', 'Lots', 'Entry_Price', 'Exit_Price', 'Realized_PnL', 'Exit_Reason', 'Entry_Time', 'Exit_Time', 'Strategy'];
    const rows = portfolio.closedTrades.map(t => [
      t.id,
      t.tickerSymbol,
      t.strike,
      t.optionType,
      t.lots,
      t.entryPrice,
      t.exitPrice,
      t.realizedPnL,
      t.exitReason,
      t.entryTime,
      t.exitTime,
      t.strategyName
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `OptiPulse_PaperTrading_Journal_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* SECTION 1: VIRTUAL CAPITAL & PORTFOLIO METRICS DASHBOARD */}
      <div className="bg-slate-900/90 border border-slate-800/90 rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">Paper Trading Simulator Desk</h2>
                <span className="text-[10px] font-mono font-semibold uppercase text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                  Live Market Feed • Dummy Money
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Practice entry &amp; exit strategies on real option chain data with zero financial risk
              </p>
            </div>
          </div>

          {/* Quick Actions Bar */}
          <div className="flex items-center gap-2.5 self-start lg:self-auto flex-wrap">
            {/* Auto SL Toggle */}
            <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 cursor-pointer hover:border-slate-700 transition-colors">
              <input 
                type="checkbox"
                checked={autoExecuteStopLoss}
                onChange={(e) => onToggleAutoStopLoss(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500/20"
              />
              <span className="flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                <span>Auto SL / Target Execution</span>
              </span>
            </label>

            {/* Reset Capital */}
            <button
              onClick={() => setIsResetModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-mono transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
              <span>Reset Balance</span>
            </button>
          </div>
        </div>

        {/* Portfolio Key Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs font-mono">
          {/* Net Portfolio Value */}
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80 col-span-2 sm:col-span-1 lg:col-span-2">
            <div className="text-slate-400 text-[11px] mb-1 uppercase tracking-wider flex items-center justify-between">
              <span>Net Portfolio Value</span>
              <Flame className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-white flex items-baseline gap-2">
              <span>{currency}{summaryMetrics.netPortfolioValue.toLocaleString()}</span>
              <span className={`text-xs font-bold ${summaryMetrics.totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {summaryMetrics.totalPnL >= 0 ? '+' : ''}{summaryMetrics.totalReturnPercent.toFixed(2)}%
              </span>
            </div>
            <div className="mt-1 text-[11px] text-slate-400 flex items-center gap-2">
              <span>Initial: {currency}{portfolio.initialBalance.toLocaleString()}</span>
              <span>·</span>
              <span className={summaryMetrics.totalPnL >= 0 ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                Total P&amp;L: {currency}{summaryMetrics.totalPnL >= 0 ? '+' : ''}{summaryMetrics.totalPnL.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Available Cash / Margin */}
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
            <div className="text-slate-400 text-[11px] mb-1 uppercase tracking-wider">Available Cash</div>
            <div className="text-base sm:text-lg font-bold text-emerald-400">{currency}{portfolio.availableCash.toLocaleString()}</div>
            <div className="mt-1 text-[11px] text-slate-500">Margin Free</div>
          </div>

          {/* Used Margin */}
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
            <div className="text-slate-400 text-[11px] mb-1 uppercase tracking-wider">Used Margin</div>
            <div className="text-base sm:text-lg font-bold text-amber-400">{currency}{portfolio.usedMargin.toLocaleString()}</div>
            <div className="mt-1 text-[11px] text-slate-500">{portfolio.openPositions.length} Open Position(s)</div>
          </div>

          {/* Realized Live P&L */}
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
            <div className="text-slate-400 text-[11px] mb-1 uppercase tracking-wider">Realized P&amp;L</div>
            <div className={`text-base sm:text-lg font-bold ${portfolio.totalRealizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {currency}{portfolio.totalRealizedPnL >= 0 ? '+' : ''}{portfolio.totalRealizedPnL.toLocaleString()}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">{summaryMetrics.totalClosed} Closed Trade(s)</div>
          </div>

          {/* Win Rate */}
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
            <div className="text-slate-400 text-[11px] mb-1 uppercase tracking-wider">Win Rate</div>
            <div className="text-base sm:text-lg font-bold text-sky-400">{summaryMetrics.winRate.toFixed(1)}%</div>
            <div className="mt-1 text-[11px] text-slate-500">
              {summaryMetrics.winningTradesCount}W / {summaryMetrics.losingTradesCount}L
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: AI SUGGESTED TRADES (DIRECT 1-CLICK PAPER EXECUTION) */}
      <div className="bg-slate-900/90 border border-slate-800/90 rounded-xl p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <span>Active OptiPulse AI Suggested Trades</span>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                  1-Click Execution
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Directly trade the real-time high-probability predictions generated by the quant engine
              </p>
            </div>
          </div>
        </div>

        {/* Active Signal Execution Card */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {/* Main Intraday Signal */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/90 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-xs font-bold font-mono ${
                  signal.action === 'BUY_CE' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                  signal.action === 'BUY_PE' ? 'bg-rose-950 text-rose-400 border border-rose-800' :
                  'bg-slate-800 text-slate-300'
                }`}>
                  {signal.action === 'BUY_CE' ? 'BULLISH CALL' : signal.action === 'BUY_PE' ? 'BEARISH PUT' : 'NEUTRAL / WAIT'}
                </span>
                <span className="text-xs font-mono font-bold text-white">
                  {currentTicker.symbol} {signal.recommendedStrike} {signal.recommendedType}
                </span>
              </div>
              <span className="text-xs font-mono text-slate-400">
                Confidence: <strong className="text-emerald-400">{signal.confidence}%</strong>
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center text-xs font-mono bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/60">
              <div>
                <div className="text-slate-400 text-[10px]">LTP</div>
                <div className="text-sm font-bold text-white">{currency}{(signal.recommendedContractLTP || 108.50).toFixed(2)}</div>
              </div>
              <div>
                <div className="text-slate-400 text-[10px]">STOP LOSS</div>
                <div className="text-sm font-bold text-rose-400">{currency}{signal.stopLoss.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-slate-400 text-[10px]">TARGET 1</div>
                <div className="text-sm font-bold text-emerald-400">{currency}{signal.target1.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-slate-400 text-[10px]">TARGET 2</div>
                <div className="text-sm font-bold text-emerald-300">{currency}{signal.target2.toFixed(2)}</div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="text-xs text-slate-400 font-mono">
                1 Lot ({currentTicker.lotSize} Qty) = <strong className="text-slate-200">{currency}{((signal.recommendedContractLTP || 108.50) * currentTicker.lotSize).toLocaleString()}</strong>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleQuickExecuteSignal(
                    signal.recommendedStrike,
                    signal.recommendedType,
                    signal.recommendedContractLTP || 108.50,
                    signal.stopLoss,
                    signal.target1,
                    signal.target2,
                    `OptiPulse Intraday Signal (${signal.action})`,
                    1
                  )}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold font-mono transition-colors cursor-pointer flex items-center gap-1 shadow-sm"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Paper Buy 1 Lot</span>
                </button>
                <button
                  onClick={() => handleQuickExecuteSignal(
                    signal.recommendedStrike,
                    signal.recommendedType,
                    signal.recommendedContractLTP || 108.50,
                    signal.stopLoss,
                    signal.target1,
                    signal.target2,
                    `OptiPulse Intraday Signal (${signal.action})`,
                    5
                  )}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 text-xs font-bold font-mono transition-colors cursor-pointer"
                >
                  <span>5 Lots</span>
                </button>
              </div>
            </div>
          </div>

          {/* Higher Timeframe Predictions Suggested Execution */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/90 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-white flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-sky-400" />
                <span>Higher-Timeframe Trend Setup</span>
              </span>
              <span className="text-xs font-mono text-slate-400">Multi-Horizon</span>
            </div>

            {htfPredictions ? (
              <div className="space-y-2">
                {[htfPredictions.next1Day, htfPredictions.next1Week].map((horizon, idx) => {
                  const isBull = horizon.predictedBias === 'BULLISH';
                  const recStrike = horizon.recommendedStrike || signal.recommendedStrike;
                  const recType = horizon.recommendedType || (isBull ? 'CE' : 'PE');
                  const estLtp = horizon.recommendedContractLTP || 115;
                  const estSl = horizon.stopLossLTP || Number((estLtp * 0.82).toFixed(2));
                  const estTp = horizon.target1LTP || Number((estLtp * 1.35).toFixed(2));

                  return (
                    <div key={idx} className="flex items-center justify-between bg-slate-900/80 p-2 rounded-lg border border-slate-800/80 text-xs font-mono">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className={`font-bold ${isBull ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {horizon.horizonLabel} {horizon.predictedBias}
                          </span>
                          <span className="text-slate-300">({currentTicker.symbol} {recStrike} {recType})</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Target Spot: {currency}{horizon.projectedSpotTarget.toLocaleString()} | Entry ~{currency}{estLtp}
                        </div>
                      </div>

                      <button
                        onClick={() => handleQuickExecuteSignal(
                          recStrike,
                          recType,
                          estLtp,
                          estSl,
                          estTp,
                          horizon.target2LTP || Number((estTp * 1.15).toFixed(2)),
                          `HTF ${horizon.horizonLabel} Setup`,
                          1
                        )}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 border border-sky-500/30 text-[11px] font-bold transition-colors cursor-pointer"
                      >
                        Execute
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-400 font-mono italic">
                Gathering multi-timeframe prediction signals...
              </p>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 3: MANUAL ORDER PLACEMENT DESK */}
      <div className="bg-slate-900/90 border border-slate-800/90 rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shrink-0">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">Custom Market Paper Order Console</h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Place custom paper trades on any option strike from the live chain
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 text-xs font-mono">
          {/* Ticker Selector */}
          <div>
            <label className="text-slate-400 mb-1 block">Ticker Instrument</label>
            <select
              value={selectedTickerSymbol}
              onChange={(e) => {
                setSelectedTickerSymbol(e.target.value);
                const found = POPULAR_TICKERS.find(t => t.symbol === e.target.value);
                if (found) setSelectedStrike(found.atmStrike);
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-bold focus:border-emerald-500 focus:outline-none"
            >
              {POPULAR_TICKERS.map(t => (
                <option key={t.symbol} value={t.symbol}>
                  {t.symbol} ({t.category})
                </option>
              ))}
            </select>
          </div>

          {/* Option Type */}
          <div>
            <label className="text-slate-400 mb-1 block">Option Type</label>
            <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedOptionType('CE')}
                className={`py-1.5 rounded font-bold transition-colors ${
                  selectedOptionType === 'CE' 
                    ? 'bg-emerald-500 text-slate-950 shadow-sm' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                CALL (CE)
              </button>
              <button
                type="button"
                onClick={() => setSelectedOptionType('PE')}
                className={`py-1.5 rounded font-bold transition-colors ${
                  selectedOptionType === 'PE' 
                    ? 'bg-rose-500 text-white shadow-sm' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                PUT (PE)
              </button>
            </div>
          </div>

          {/* Strike Price */}
          <div>
            <label className="text-slate-400 mb-1 block">Strike Price</label>
            <select
              value={selectedStrike}
              onChange={(e) => setSelectedStrike(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-bold focus:border-emerald-500 focus:outline-none"
            >
              {chain.map(r => (
                <option key={r.strike} value={r.strike}>
                  {r.strike} {r.isATM ? '(ATM)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Lot Quantity */}
          <div>
            <label className="text-slate-400 mb-1 block">Lots (1 Lot = {activeTickerObj.lotSize} Qty)</label>
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setLotsInput(prev => Math.max(1, prev - 1))}
                className="px-3 py-2 bg-slate-900 text-slate-300 hover:bg-slate-800 font-bold border-r border-slate-800"
              >
                -
              </button>
              <input
                type="number"
                min="1"
                max="100"
                value={lotsInput}
                onChange={(e) => setLotsInput(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full bg-transparent text-center text-white font-bold py-2 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setLotsInput(prev => prev + 1)}
                className="px-3 py-2 bg-slate-900 text-slate-300 hover:bg-slate-800 font-bold border-l border-slate-800"
              >
                +
              </button>
            </div>
          </div>

          {/* Execute Button */}
          <div className="flex flex-col justify-end">
            <button
              onClick={handleExecuteManualOrder}
              className="w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold font-mono transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Place Paper Buy Order</span>
            </button>
          </div>
        </div>

        {/* Live Order Estimate Footer */}
        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-3">
            <span className="text-slate-400">Live LTP: <strong className="text-white">{currency}{liveLtp.toFixed(2)}</strong></span>
            <span>·</span>
            <span className="text-slate-400">Total Qty: <strong className="text-emerald-400">{totalQty}</strong></span>
            <span>·</span>
            <span className="text-slate-400">Required Capital: <strong className="text-amber-400">{currency}{requiredMargin.toLocaleString()}</strong></span>
          </div>

          <div className="flex items-center gap-3 text-[11px]">
            <span className="text-slate-400">SL: <strong className="text-rose-400">{currency}{calculatedSl}</strong></span>
            <span className="text-slate-400">TP1: <strong className="text-emerald-400">{currency}{calculatedTp1}</strong></span>
            <span className="text-slate-400">TP2: <strong className="text-emerald-300">{currency}{calculatedTp2}</strong></span>
          </div>
        </div>
      </div>

      {/* SECTION 4: OPEN POSITIONS TABLE (LIVE TICKER) */}
      <div className="bg-slate-900/90 border border-slate-800/90 rounded-xl p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shrink-0">
              <Flame className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <span>Active Open Paper Positions</span>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                  {portfolio.openPositions.length} Live
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Real-time position tracking updating live on incoming market stream ticks
              </p>
            </div>
          </div>

          {portfolio.openPositions.length > 0 && (
            <div className="text-xs font-mono font-bold text-slate-300">
              Total Live P&amp;L:{' '}
              <span className={summaryMetrics.totalUnrealizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {currency}{summaryMetrics.totalUnrealizedPnL >= 0 ? '+' : ''}{summaryMetrics.totalUnrealizedPnL.toLocaleString()}
              </span>
            </div>
          )}
        </div>

        {portfolio.openPositions.length === 0 ? (
          <div className="text-center py-10 bg-slate-950/60 rounded-xl border border-slate-800/60 text-slate-400 font-mono text-xs space-y-2">
            <Target className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-slate-300 font-semibold">No Active Open Paper Positions</p>
            <p className="text-slate-500 max-w-md mx-auto">
              Execute an AI suggested trade above or place a custom order from the market console to start trading live.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider bg-slate-950">
                  <th className="py-2.5 px-3">Contract / Symbol</th>
                  <th className="py-2.5 px-3 text-right">Lots (Qty)</th>
                  <th className="py-2.5 px-3 text-right">Entry Price</th>
                  <th className="py-2.5 px-3 text-right">Live LTP</th>
                  <th className="py-2.5 px-3 text-right">SL / Targets</th>
                  <th className="py-2.5 px-3 text-right">Unrealized P&amp;L</th>
                  <th className="py-2.5 px-3 text-center">Manage Position</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {portfolio.openPositions.map((pos) => {
                  const isProfit = pos.unrealizedPnL >= 0;
                  const roiPercent = ((pos.currentLtp - pos.entryPrice) / pos.entryPrice) * 100;

                  return (
                    <tr key={pos.id} className="hover:bg-slate-800/40 transition-colors">
                      {/* Contract */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            pos.optionType === 'CE' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400 border border-rose-800'
                          }`}>
                            {pos.optionType}
                          </span>
                          <div>
                            <div className="font-bold text-white">{pos.tickerSymbol} {pos.strike}</div>
                            <div className="text-[10px] text-slate-400">{pos.strategyName || 'Paper Position'} · {pos.entryTime}</div>
                          </div>
                        </div>
                      </td>

                      {/* Lots */}
                      <td className="py-3 px-3 text-right font-bold text-slate-200">
                        {pos.lots} Lot(s) ({pos.totalQty})
                      </td>

                      {/* Entry Price */}
                      <td className="py-3 px-3 text-right font-bold text-slate-300">
                        {currency}{pos.entryPrice.toFixed(2)}
                      </td>

                      {/* Live LTP */}
                      <td className="py-3 px-3 text-right font-bold text-white">
                        {currency}{pos.currentLtp.toFixed(2)}
                      </td>

                      {/* SL / Targets */}
                      <td className="py-3 px-3 text-right text-[11px]">
                        <div>SL: <span className="text-rose-400 font-bold">{currency}{pos.stopLoss}</span></div>
                        <div>T1: <span className="text-emerald-400 font-bold">{currency}{pos.target1}</span></div>
                      </td>

                      {/* Unrealized P&L */}
                      <td className="py-3 px-3 text-right">
                        <div className={`font-bold text-sm ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {currency}{isProfit ? '+' : ''}{pos.unrealizedPnL.toLocaleString()}
                        </div>
                        <div className={`text-[10px] font-semibold ${isProfit ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {isProfit ? '+' : ''}{roiPercent.toFixed(2)}%
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Square Off */}
                          <button
                            onClick={() => onSquareOffPosition(pos.id, pos.currentLtp, 'MANUAL_SQUARE_OFF')}
                            className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/40 text-[11px] font-bold transition-colors cursor-pointer"
                            title="Square Off Position at Market Price"
                          >
                            Square Off
                          </button>

                          {/* Partial Exit */}
                          {pos.lots > 1 && (
                            <button
                              onClick={() => {
                                setPartialModalPos(pos);
                                setPartialExitLots(1);
                              }}
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] transition-colors cursor-pointer"
                              title="Partial Exit Lots"
                            >
                              <Scissors className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Modify SL/TP */}
                          <button
                            onClick={() => {
                              setEditSlTpPos(pos);
                              setEditSlInput(pos.stopLoss.toString());
                              setEditTp1Input(pos.target1.toString());
                              setEditTp2Input(pos.target2.toString());
                            }}
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] transition-colors cursor-pointer"
                            title="Modify SL & Take Profit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION 5: COMPLETED TRADES JOURNAL & PERFORMANCE ANALYTICS */}
      <div className="bg-slate-900/90 border border-slate-800/90 rounded-xl p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shrink-0">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <span>Completed Paper Trades Journal</span>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                  {portfolio.closedTrades.length} Trades
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Audit log of all squared off paper trades and execution performance analytics
              </p>
            </div>
          </div>

          {portfolio.closedTrades.length > 0 && (
            <button
              onClick={handleExportJournal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-mono transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span>Export CSV Journal</span>
            </button>
          )}
        </div>

        {portfolio.closedTrades.length === 0 ? (
          <div className="text-center py-8 bg-slate-950/60 rounded-xl border border-slate-800/60 text-slate-400 font-mono text-xs">
            <p className="text-slate-400">No closed paper trades in history.</p>
            <p className="text-slate-500 mt-1">Squared off positions will automatically record here with realized P&amp;L metrics.</p>
          </div>
        ) : (
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider bg-slate-950">
                  <th className="py-2 px-3">Contract</th>
                  <th className="py-2 px-3 text-right">Lots</th>
                  <th className="py-2 px-3 text-right">Entry</th>
                  <th className="py-2 px-3 text-right">Exit</th>
                  <th className="py-2 px-3 text-right">Realized P&amp;L</th>
                  <th className="py-2 px-3 text-center">Exit Reason</th>
                  <th className="py-2 px-3 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {portfolio.closedTrades.map((trade) => {
                  const pnl = trade.realizedPnL || 0;
                  const isWin = pnl >= 0;

                  return (
                    <tr key={trade.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-2.5 px-3 font-bold text-white">
                        {trade.tickerSymbol} {trade.strike} {trade.optionType}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-300">{trade.lots}</td>
                      <td className="py-2.5 px-3 text-right text-slate-300">{currency}{trade.entryPrice.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right text-slate-300">{currency}{(trade.exitPrice || 0).toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right font-bold">
                        <span className={isWin ? 'text-emerald-400' : 'text-rose-400'}>
                          {currency}{isWin ? '+' : ''}{pnl.toLocaleString()}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          trade.exitReason === 'TARGET_1_HIT' || trade.exitReason === 'TARGET_2_HIT' 
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : trade.exitReason === 'SL_HIT'
                            ? 'bg-rose-950 text-rose-400 border border-rose-800'
                            : 'bg-slate-800 text-slate-300'
                        }`}>
                          {trade.exitReason || 'SQUARED OFF'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right text-[11px] text-slate-400">
                        {trade.exitTime}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: RESET CAPITAL */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 max-w-md w-full space-y-4 shadow-2xl font-mono text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-emerald-400" />
                <span>Reset Virtual Paper Balance</span>
              </h3>
              <button onClick={() => setIsResetModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-slate-300">
              Resetting will clear all active open positions and trade logs, restoring your virtual starting balance. Select starting capital:
            </p>

            <div className="grid grid-cols-2 gap-2">
              {[
                { label: '₹1,00,000 (1 Lakh)', val: 100000 },
                { label: '₹5,00,000 (5 Lakhs)', val: 500000 },
                { label: '₹10,00,000 (10 Lakhs)', val: 1000000 },
                { label: '$100,000 (USD)', val: 100000 },
              ].map(opt => (
                <button
                  key={opt.val + opt.label}
                  onClick={() => setResetCashChoice(opt.val)}
                  className={`p-2.5 rounded-lg border font-bold text-left transition-colors ${
                    resetCashChoice === opt.val
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsResetModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 font-bold hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onResetPortfolio(resetCashChoice);
                  setIsResetModalOpen(false);
                }}
                className="px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: PARTIAL EXIT */}
      {partialModalPos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 max-w-md w-full space-y-4 shadow-2xl font-mono text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Scissors className="w-4 h-4 text-emerald-400" />
                <span>Partial Square Off</span>
              </h3>
              <button onClick={() => setPartialModalPos(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <div className="font-bold text-white">{partialModalPos.tickerSymbol} {partialModalPos.strike} {partialModalPos.optionType}</div>
              <div className="text-slate-400 mt-1">Total Lots Held: {partialModalPos.lots} | Live LTP: {currency}{partialModalPos.currentLtp}</div>
            </div>

            <div>
              <label className="text-slate-400 mb-1 block">Number of Lots to Exit (1 to {partialModalPos.lots - 1})</label>
              <input
                type="number"
                min="1"
                max={partialModalPos.lots - 1}
                value={partialExitLots}
                onChange={(e) => setPartialExitLots(Math.min(partialModalPos.lots - 1, Math.max(1, parseInt(e.target.value) || 1)))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-bold"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button onClick={() => setPartialModalPos(null)} className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 font-bold">
                Cancel
              </button>
              <button
                onClick={() => {
                  onPartialSquareOff(partialModalPos.id, partialExitLots, partialModalPos.currentLtp);
                  setPartialModalPos(null);
                }}
                className="px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400"
              >
                Execute Partial Exit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: EDIT SL / TP */}
      {editSlTpPos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 max-w-md w-full space-y-4 shadow-2xl font-mono text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-emerald-400" />
                <span>Modify Stop Loss &amp; Targets</span>
              </h3>
              <button onClick={() => setEditSlTpPos(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-slate-400 mb-1 block">Stop Loss Price ({currency})</label>
                <input
                  type="number"
                  step="0.05"
                  value={editSlInput}
                  onChange={(e) => setEditSlInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-bold"
                />
              </div>

              <div>
                <label className="text-slate-400 mb-1 block">Target 1 Price ({currency})</label>
                <input
                  type="number"
                  step="0.05"
                  value={editTp1Input}
                  onChange={(e) => setEditTp1Input(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-bold"
                />
              </div>

              <div>
                <label className="text-slate-400 mb-1 block">Target 2 Price ({currency})</label>
                <input
                  type="number"
                  step="0.05"
                  value={editTp2Input}
                  onChange={(e) => setEditTp2Input(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-bold"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button onClick={() => setEditSlTpPos(null)} className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 font-bold">
                Cancel
              </button>
              <button
                onClick={() => {
                  onUpdatePositionSlTp(
                    editSlTpPos.id,
                    parseFloat(editSlInput) || editSlTpPos.stopLoss,
                    parseFloat(editTp1Input) || editSlTpPos.target1,
                    parseFloat(editTp2Input) || editSlTpPos.target2
                  );
                  setEditSlTpPos(null);
                }}
                className="px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
