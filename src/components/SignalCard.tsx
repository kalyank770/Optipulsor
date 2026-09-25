import React, { useState, useEffect, useRef } from 'react';
import { 
  TradeSignal, 
  TickerConfig, 
  MarketMetrics,
  OptionChainRow
} from '../types/options';
import { 
  TrendingUp, 
  TrendingDown, 
  ShieldAlert, 
  Copy, 
  CheckCircle2, 
  Maximize2,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Calculator,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';

interface SignalCardProps {
  signal: TradeSignal;
  ticker: TickerConfig;
  metrics: MarketMetrics;
  chain?: OptionChainRow[];
  onSelectContractForSimulation: (strike: number, type: 'CE' | 'PE') => void;
  onSetManualSpotPrice?: (price: number) => void;
  onSyncLiveExchange?: () => void;
  isSyncing?: boolean;
}

export const SignalCard: React.FC<SignalCardProps> = ({
  signal,
  ticker,
  metrics,
  chain,
  onSelectContractForSimulation,
  isSyncing = false,
}) => {
  const [copied, setCopied] = useState(false);
  const [lots, setLots] = useState<number>(1);
  const [priceFlash, setPriceFlash] = useState<'UP' | 'DOWN' | null>(null);

  const isCE = signal.action === 'BUY_CE';
  const isPE = signal.action === 'BUY_PE';
  const isNeutral = signal.action === 'WAIT_NEUTRAL';

  // Find live contract quote directly from the option chain
  const recommendedRow = chain?.find(r => r.strike === signal.recommendedStrike);
  const liveContract = signal.recommendedType === 'CE' ? recommendedRow?.ce : recommendedRow?.pe;

  // Real-time contract premium (LTP)
  const currentLTP = liveContract?.ltp ?? signal.recommendedContractLTP;
  const prevLtpRef = useRef<number>(currentLTP);

  // Price tick visual flash detector
  useEffect(() => {
    if (prevLtpRef.current !== currentLTP) {
      if (currentLTP > prevLtpRef.current) {
        setPriceFlash('UP');
      } else if (currentLTP < prevLtpRef.current) {
        setPriceFlash('DOWN');
      }
      prevLtpRef.current = currentLTP;
      const t = setTimeout(() => setPriceFlash(null), 1200);
      return () => clearTimeout(t);
    }
  }, [currentLTP]);

  // Total quantity and capital calculations based on selected lots
  const lotSize = ticker.lotSize;
  const totalQty = Math.max(1, lots) * lotSize;
  const totalCapital = currentLTP * totalQty;

  // Real-time Target 1 P&L calculation
  const target1 = signal.target1;
  const t1Points = Number((target1 - currentLTP).toFixed(2));
  const t1ProfitTotal = Number((t1Points * totalQty).toFixed(2));
  const t1ProfitPct = totalCapital > 0 ? Number(((t1ProfitTotal / totalCapital) * 100).toFixed(1)) : 40.0;

  // Real-time Target 2 P&L calculation
  const target2 = signal.target2;
  const t2Points = Number((target2 - currentLTP).toFixed(2));
  const t2ProfitTotal = Number((t2Points * totalQty).toFixed(2));
  const t2ProfitPct = totalCapital > 0 ? Number(((t2ProfitTotal / totalCapital) * 100).toFixed(1)) : 75.0;

  // Real-time Stop Loss P&L calculation
  const stopLoss = signal.stopLoss;
  const slRiskPoints = Number((currentLTP - stopLoss).toFixed(2));
  const slLossTotal = Number((slRiskPoints * totalQty).toFixed(2));
  const slLossPct = totalCapital > 0 ? Number(((slLossTotal / totalCapital) * 100).toFixed(1)) : 25.0;

  // 1-Point tick value (How much ₹ P&L moves for every 1 point move in option premium)
  const tickValue1Pt = 1.0 * totalQty;

  // Expiry breakeven spot price
  const breakevenSpot = signal.recommendedType === 'CE' 
    ? signal.recommendedStrike + currentLTP 
    : signal.recommendedStrike - currentLTP;

  // Quick lot selection pills
  const quickLots = [1, 2, 5, 10];

  const handleCopy = () => {
    const text = `OptiPulse Live Signal: ${signal.action === 'BUY_CE' ? 'CALL (CE)' : signal.action === 'BUY_PE' ? 'PUT (PE)' : 'NEUTRAL'}\nTicker: ${ticker.symbol} (Spot: ${ticker.currency}${ticker.spotPrice.toLocaleString()})\nRecommended: ${signal.recommendedStrike} ${signal.recommendedType} @ ${ticker.currency}${currentLTP.toFixed(2)}\nSelected Lots: ${lots} (${totalQty} Qty)\nCapital Deployed: ${ticker.currency}${totalCapital.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\nPredicted Target 1 Profit: +${ticker.currency}${t1ProfitTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (+${t1ProfitPct}%)\nPredicted Target 2 Profit: +${ticker.currency}${t2ProfitTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (+${t2ProfitPct}%)\nPredicted Max Risk (SL): -${ticker.currency}${slLossTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (-${slLossPct}%)\n1-Point Move = ±${ticker.currency}${tickValue1Pt.toFixed(2)} P&L\nBreakeven Spot: ${ticker.currency}${breakevenSpot.toFixed(2)}\nR:R: ${signal.riskRewardRatio}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`rounded-xl border p-5 transition-all shadow-md ${
      isCE ? 'bg-slate-900/95 border-emerald-500/40 shadow-emerald-950/20' :
      isPE ? 'bg-slate-900/95 border-rose-500/40 shadow-rose-950/20' :
      'bg-slate-900/95 border-slate-800'
    }`}>
      {/* Top Header: Recommendation, Bias, Live Spot, and Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3.5">
          <div className={`p-3 rounded-lg flex items-center justify-center shrink-0 ${
            isCE ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' :
            isPE ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30' :
            'bg-amber-500/15 text-amber-400 border border-amber-500/30'
          }`}>
            {isCE && <TrendingUp className="w-6 h-6" />}
            {isPE && <TrendingDown className="w-6 h-6" />}
            {isNeutral && <ShieldAlert className="w-6 h-6" />}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-semibold tracking-wider text-slate-400">
                Action Recommendation
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-xs font-mono text-slate-300">
                Spot: <strong className="text-white">{ticker.currency}{ticker.spotPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
              </span>
              <span className={`text-[11px] font-mono font-bold ${ticker.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {ticker.change >= 0 ? '+' : ''}{ticker.change.toFixed(2)} ({ticker.change >= 0 ? '+' : ''}{ticker.changePercent.toFixed(2)}%)
              </span>
            </div>

            <h2 className="text-2xl font-bold tracking-tight text-white mt-0.5 flex flex-wrap items-center gap-3">
              {isCE && <span className="text-emerald-400">BUY CALL (CE) — {signal.recommendedStrike} CE</span>}
              {isPE && <span className="text-rose-400">BUY PUT (PE) — {signal.recommendedStrike} PE</span>}
              {isNeutral && <span className="text-amber-400">STAY NEUTRAL / WAIT</span>}

              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded border ${
                signal.strength === 'STRONG' ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300' :
                signal.strength === 'MODERATE' ? 'border-sky-500/40 bg-sky-950/40 text-sky-300' :
                'border-amber-500/40 bg-amber-950/40 text-amber-300'
              }`}>
                {signal.strength} BIAS ({signal.confidence}%)
              </span>
            </h2>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 transition-colors cursor-pointer"
            title="Copy real-money trade details to clipboard"
          >
            {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied Details' : 'Copy Trade'}</span>
          </button>

          <button
            onClick={() => onSelectContractForSimulation(signal.recommendedStrike, signal.recommendedType)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded transition-colors cursor-pointer shadow-sm"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Payoff Simulator</span>
          </button>
        </div>
      </div>

      {/* Live Contract Quote Strip */}
      <div className="mt-4 p-3.5 rounded-lg bg-slate-950 border border-slate-800/90 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-bold">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>LIVE NFO CONTRACT</span>
          </div>

          <div className="font-mono text-white font-bold text-sm">
            {ticker.symbol} {signal.recommendedStrike} {signal.recommendedType}
          </div>

          {liveContract?.moneyness && (
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono font-semibold">
              {liveContract.moneyness}
            </span>
          )}
        </div>

        {/* Live Contract Price & Spread */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors ${
            priceFlash === 'UP' ? 'bg-emerald-500/30 text-emerald-300' :
            priceFlash === 'DOWN' ? 'bg-rose-500/30 text-rose-300' :
            'bg-slate-900 text-white'
          }`}>
            <span className="text-slate-400 text-[11px]">LTP:</span>
            <span className="text-lg font-bold">
              {ticker.currency}{currentLTP.toFixed(2)}
            </span>
            {liveContract?.change !== undefined && (
              <span className={`text-[11px] font-semibold flex items-center ${liveContract.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {liveContract.change >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {liveContract.change >= 0 ? '+' : ''}{liveContract.change.toFixed(2)} ({liveContract.changePercent}%)
              </span>
            )}
          </div>

          {liveContract?.bidPrice !== undefined && liveContract?.askPrice !== undefined && (
            <div className="text-slate-400 text-[11px] hidden sm:flex items-center gap-2">
              <span>Bid: <strong className="text-slate-200">{ticker.currency}{liveContract.bidPrice.toFixed(2)}</strong></span>
              <span>·</span>
              <span>Ask: <strong className="text-slate-200">{ticker.currency}{liveContract.askPrice.toFixed(2)}</strong></span>
              <span>·</span>
              <span>Spread: <strong className="text-sky-300">{ticker.currency}{(liveContract.askPrice - liveContract.bidPrice).toFixed(2)}</strong></span>
            </div>
          )}

          {liveContract?.greeks && (
            <div className="text-[11px] text-slate-400 hidden md:flex items-center gap-2 border-l border-slate-800 pl-3">
              <span>Delta: <strong className="text-slate-200">{liveContract.greeks.delta.toFixed(3)}</strong></span>
              <span>Theta: <strong className="text-slate-200">{liveContract.greeks.theta.toFixed(1)}</strong></span>
              <span>IV: <strong className="text-slate-200">{liveContract.iv}%</strong></span>
            </div>
          )}
        </div>
      </div>

      {/* Lot Sizer Control Bar */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-950/60 rounded-lg border border-slate-800/60">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
            <Calculator className="w-4 h-4 text-sky-400" />
            <span>Position Size:</span>
          </div>

          {/* Quick lot pills */}
          <div className="flex items-center gap-1">
            {quickLots.map(q => (
              <button
                key={q}
                onClick={() => setLots(q)}
                className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-colors cursor-pointer ${
                  lots === q 
                    ? 'bg-sky-500 text-slate-950 shadow-sm' 
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                }`}
              >
                {q} {q === 1 ? 'Lot' : 'Lots'}
              </button>
            ))}
          </div>

          {/* Stepper for custom lots */}
          <div className="flex items-center border border-slate-700 bg-slate-900 rounded overflow-hidden">
            <button
              onClick={() => setLots(Math.max(1, lots - 1))}
              className="px-2 py-1 text-xs font-bold text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer transition-colors"
              title="Decrease lot"
            >
              -
            </button>
            <span className="px-2.5 py-1 text-xs font-mono font-bold text-white min-w-[50px] text-center">
              {lots} {lots === 1 ? 'Lot' : 'Lots'}
            </span>
            <button
              onClick={() => setLots(lots + 1)}
              className="px-2 py-1 text-xs font-bold text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer transition-colors"
              title="Increase lot"
            >
              +
            </button>
          </div>
        </div>

        {/* Total Quantity & Tick Sensitivity */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="text-slate-300">
            Exchange Contract Size: <strong className="text-white">{lotSize} Qty/lot</strong>
          </div>
          <span className="text-slate-600">·</span>
          <div className="text-sky-300 font-bold">
            Total Qty: <strong className="text-white">{totalQty} units</strong>
          </div>
          <span className="text-slate-600">·</span>
          <div className="text-emerald-400 font-semibold" title="P&L change per 1 rupee move in contract premium">
            1 Pt Move = <strong className="font-bold">±{ticker.currency}{tickValue1Pt.toFixed(2)}</strong>
          </div>
        </div>
      </div>

      {/* Real-Money Real-Time Predicted Profit & Loss Matrix */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mt-4">
        {/* Metric 1: Capital Deployed */}
        <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] uppercase font-semibold text-slate-400">
            <span>Capital Deployed</span>
            <span className="text-[10px] text-slate-500 font-mono">{lots} {lots === 1 ? 'Lot' : 'Lots'}</span>
          </div>
          <div className="my-2">
            <div className="text-2xl font-bold font-mono text-white tracking-tight">
              {ticker.currency}{totalCapital.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
              {totalQty} Qty × {ticker.currency}{currentLTP.toFixed(2)} LTP
            </div>
          </div>
          <div className="text-[10px] text-slate-500 border-t border-slate-900 pt-1.5 flex items-center justify-between">
            <span>Total Outlay</span>
            <span className="text-slate-400 font-mono">Max Risk Boundary</span>
          </div>
        </div>

        {/* Metric 2: Target 1 Predicted Profit */}
        <div className="bg-slate-950 p-3.5 rounded-lg border border-emerald-500/30 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] uppercase font-semibold text-emerald-400">
            <span className="flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5" />
              Target 1 Predicted Profit
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
              +{t1ProfitPct}%
            </span>
          </div>
          <div className="my-2">
            <div className="text-2xl font-bold font-mono text-emerald-400 tracking-tight">
              +{ticker.currency}{t1ProfitTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-emerald-300/80 font-mono mt-0.5">
              Exit @ {ticker.currency}{target1.toFixed(2)} (+{ticker.currency}{t1Points.toFixed(2)} pts)
            </div>
          </div>
          <div className="text-[10px] text-slate-400 border-t border-slate-900 pt-1.5 flex items-center justify-between font-mono">
            <span>Base Objective</span>
            <span className="text-emerald-400 font-bold">R:R {signal.riskRewardRatio}</span>
          </div>
        </div>

        {/* Metric 3: Target 2 Predicted Profit */}
        <div className="bg-slate-950 p-3.5 rounded-lg border border-sky-500/30 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] uppercase font-semibold text-sky-400">
            <span className="flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5" />
              Target 2 Predicted Profit
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-sky-500/10 border border-sky-500/20 text-sky-300">
              +{t2ProfitPct}%
            </span>
          </div>
          <div className="my-2">
            <div className="text-2xl font-bold font-mono text-sky-400 tracking-tight">
              +{ticker.currency}{t2ProfitTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-sky-300/80 font-mono mt-0.5">
              Exit @ {ticker.currency}{target2.toFixed(2)} (+{ticker.currency}{t2Points.toFixed(2)} pts)
            </div>
          </div>
          <div className="text-[10px] text-slate-400 border-t border-slate-900 pt-1.5 flex items-center justify-between font-mono">
            <span>Runner Objective</span>
            <span className="text-sky-300 font-bold">Extended Gain</span>
          </div>
        </div>

        {/* Metric 4: Stop Loss Predicted Max Loss */}
        <div className="bg-slate-950 p-3.5 rounded-lg border border-rose-500/30 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] uppercase font-semibold text-rose-400">
            <span className="flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              Stop Loss Max Risk
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-500/10 border border-rose-500/20 text-rose-300">
              -{slLossPct}%
            </span>
          </div>
          <div className="my-2">
            <div className="text-2xl font-bold font-mono text-rose-400 tracking-tight">
              -{ticker.currency}{slLossTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-rose-300/80 font-mono mt-0.5">
              Cut @ {ticker.currency}{stopLoss.toFixed(2)} (-{ticker.currency}{slRiskPoints.toFixed(2)} pts)
            </div>
          </div>
          <div className="text-[10px] text-slate-400 border-t border-slate-900 pt-1.5 flex items-center justify-between font-mono">
            <span>Capital Protection</span>
            <span className="text-rose-400 font-bold">Strict SL Exit</span>
          </div>
        </div>
      </div>

      {/* Execution Guidance & Key Levels Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3.5 text-xs font-mono">
        <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
          <span className="text-slate-400 block text-[10px] uppercase font-sans">Recommended Entry Zone</span>
          <span className="text-white font-bold text-sm mt-0.5 block">
            {ticker.currency}{signal.entryRange[0].toFixed(2)} - {signal.entryRange[1].toFixed(2)}
          </span>
        </div>

        <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
          <span className="text-slate-400 block text-[10px] uppercase font-sans">Expiry Breakeven Spot</span>
          <span className="text-sky-400 font-bold text-sm mt-0.5 block">
            {ticker.currency}{breakevenSpot.toFixed(2)}
          </span>
        </div>

        <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
          <span className="text-slate-400 block text-[10px] uppercase font-sans">Net Risk vs Reward</span>
          <span className="text-emerald-400 font-bold text-sm mt-0.5 block">
            {signal.riskRewardRatio} ({ticker.currency}{slLossTotal.toFixed(0)} : {ticker.currency}{t1ProfitTotal.toFixed(0)})
          </span>
        </div>

        <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
          <span className="text-slate-400 block text-[10px] uppercase font-sans">1 Rupee Move Impact</span>
          <span className="text-white font-bold text-sm mt-0.5 block">
            ±{ticker.currency}{tickValue1Pt.toFixed(2)} / pt
          </span>
        </div>
      </div>

      {/* Clean Trade Rationale Summary */}
      <div className="mt-3.5 p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs leading-relaxed text-slate-300">
        <span className="font-bold text-white mr-2">Trade Rationale:</span>
        {signal.summaryNote}
      </div>
    </div>
  );
};
