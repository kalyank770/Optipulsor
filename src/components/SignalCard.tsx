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
  ShieldCheck,
  Copy, 
  CheckCircle2, 
  Maximize2,
  ArrowUpRight, 
  ArrowDownRight,
  Calculator,
  AlertTriangle,
  BarChart2,
  Globe,
  Moon,
  Zap,
  Layers,
  Activity,
  Gauge,
  Radio,
  SlidersHorizontal,
  Compass,
  Target,
  Percent,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface SignalCardProps {
  signal: TradeSignal;
  ticker: TickerConfig;
  metrics: MarketMetrics;
  chain?: OptionChainRow[];
  onSelectContractForSimulation: (strike: number, type: 'CE' | 'PE') => void;
  isSyncing?: boolean;
  theme?: 'dark' | 'light';
  currentExpiryIndex?: number;
  onSelectExpiry?: (index: number) => void;
}

export const SignalCard: React.FC<SignalCardProps> = ({
  signal,
  ticker,
  metrics,
  chain,
  onSelectContractForSimulation,
  theme = 'dark',
  currentExpiryIndex = 0,
  onSelectExpiry,
}) => {
  const isLight = theme === 'light';
  const [copied, setCopied] = useState(false);
  const [lots, setLots] = useState<number>(1);
  const [priceFlash, setPriceFlash] = useState<'UP' | 'DOWN' | null>(null);

  // Sub-sections accordion state (all collapsed by default except allExpiries)
  type SubSectionKey = 'multiTimeframe' | 'highProb' | 'quantParams' | 'groundedPayoff' | 'heavyweights' | 'allExpiries';

  const [expandedSubSections, setExpandedSubSections] = useState<Record<SubSectionKey, boolean>>({
    multiTimeframe: false,
    highProb: false,
    quantParams: false,
    groundedPayoff: false,
    heavyweights: false,
    allExpiries: true, // Make it highly visible on load
  });

  const toggleSubSection = (key: SubSectionKey) => {
    setExpandedSubSections(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const isCE = signal.action === 'BUY_CE';
  const isPE = signal.action === 'BUY_PE';
  const isNeutral = signal.action === 'WAIT_NEUTRAL';

  // Find live contract quote directly from the option chain
  const recommendedRow = chain?.find(r => r.strike === signal.recommendedStrike);
  const liveContract = signal.recommendedType === 'CE' ? recommendedRow?.ce : recommendedRow?.pe;

  // Real-time dynamic contract premium (LTP)
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
  const t1ProfitPct = totalCapital > 0 ? Number(((t1ProfitTotal / totalCapital) * 100).toFixed(1)) : 15.0;

  // Real-time Target 2 P&L calculation
  const target2 = signal.target2;
  const t2Points = Number((target2 - currentLTP).toFixed(2));
  const t2ProfitTotal = Number((t2Points * totalQty).toFixed(2));
  const t2ProfitPct = totalCapital > 0 ? Number(((t2ProfitTotal / totalCapital) * 100).toFixed(1)) : 30.0;

  // Real-time Stop Loss P&L calculation
  const stopLoss = signal.stopLoss;
  const slRiskPoints = Number((currentLTP - stopLoss).toFixed(2));
  const slLossTotal = Number((slRiskPoints * totalQty).toFixed(2));
  const slLossPct = totalCapital > 0 ? Number(((slLossTotal / totalCapital) * 100).toFixed(1)) : 12.0;

  // Expiry breakeven spot price
  const breakevenSpot = signal.recommendedType === 'CE' 
    ? signal.recommendedStrike + currentLTP 
    : signal.recommendedStrike - currentLTP;

  // Quick lot selection
  const quickLots = [1, 2, 5, 10];

  const handleCopy = () => {
    const text = `OptiPulse Live Signal: ${signal.action === 'BUY_CE' ? 'CALL (CE)' : signal.action === 'BUY_PE' ? 'PUT (PE)' : 'NEUTRAL'}\nTicker: ${ticker.symbol} (Spot: ${ticker.currency}${ticker.spotPrice.toLocaleString()})\nRecommended: ${signal.recommendedStrike} ${signal.recommendedType} @ ${ticker.currency}${currentLTP.toFixed(2)}\nSelected Lots: ${lots} (${totalQty} Qty)\nCapital Deployed: ${ticker.currency}${totalCapital.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\nTarget 1: ${ticker.currency}${target1.toFixed(2)} (+${t1ProfitPct}%) [${signal.target1Basis || `Spot ${signal.spotTarget1}`}]\nTarget 2: ${ticker.currency}${target2.toFixed(2)} (+${t2ProfitPct}%) [${signal.target2Basis || `Spot ${signal.spotTarget2}`}]\nStop Loss: ${ticker.currency}${stopLoss.toFixed(2)} (-${slLossPct}%)\nBreakeven Spot: ${ticker.currency}${breakevenSpot.toFixed(2)}\nR:R: ${signal.riskRewardRatio}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`rounded-xl border p-3.5 sm:p-5 transition-all shadow-md ${
      isLight 
        ? (isCE ? 'bg-white border-emerald-500/50 text-slate-900 shadow-xl' : isPE ? 'bg-white border-rose-500/50 text-slate-900 shadow-xl' : 'bg-white border-slate-300 text-slate-900 shadow-xl')
        : (isCE ? 'bg-slate-900/95 border-emerald-500/40 text-slate-100 shadow-xl' : isPE ? 'bg-slate-900/95 border-rose-500/40 text-slate-100 shadow-xl' : 'bg-slate-900/95 border-slate-800 text-slate-100')
    }`}>
      {/* Top Header: Recommendation & Action Buttons */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 sm:pb-4 border-b ${
        isLight ? 'border-slate-200' : 'border-slate-800/80'
      }`}>
        <div className="flex items-start sm:items-center gap-3">
          <div className={`p-2.5 sm:p-3 rounded-lg flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 ${
            isCE ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' :
            isPE ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30' :
            'bg-amber-500/15 text-amber-400 border border-amber-500/30'
          }`}>
            {isCE && <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />}
            {isPE && <TrendingDown className="w-5 h-5 sm:w-6 sm:h-6" />}
            {isNeutral && <ShieldAlert className="w-5 h-5 sm:w-6 sm:h-6" />}
          </div>

          <div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className="uppercase font-semibold tracking-wider text-[11px]">Trade Recommendation</span>
              
              {/* Compact Copy Icon beside header */}
              <button
                onClick={handleCopy}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer flex items-center justify-center shrink-0"
                title="Copy Trade Recommendation Details"
              >
                {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400 hover:text-slate-200" />}
              </button>

              <span className="text-slate-600">·</span>
              <span className="font-mono text-slate-300">
                Spot: <strong className="text-white">{ticker.currency}{ticker.spotPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-0.5">
              <h2 className="text-lg sm:text-2xl font-bold tracking-tight text-white flex flex-wrap items-center gap-2">
                {signal.tradeStage === 'POST_TARGET_RETRACEMENT' ? (
                  <span className="text-amber-400">
                    {isCE ? 'CALL' : 'PUT'} — {signal.recommendedStrike} {signal.recommendedType} (Target 1 Reached · Retracing)
                  </span>
                ) : (
                  <>
                    {isCE && <span className="text-emerald-400">BUY CALL — {signal.recommendedStrike} CE</span>}
                    {isPE && <span className="text-rose-400">BUY PUT — {signal.recommendedStrike} PE</span>}
                    {isNeutral && <span className="text-amber-400">STAY NEUTRAL / WAIT</span>}
                  </>
                )}
              </h2>

              <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
                signal.strength === 'STRONG' ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300' :
                signal.strength === 'MODERATE' ? 'border-sky-500/40 bg-sky-950/40 text-sky-300' :
                'border-amber-500/40 bg-amber-950/40 text-amber-300'
              }`}>
                {signal.strength} ({signal.confidence}%)
              </span>

              {/* Trade Lifecycle State Badge */}
              {signal.tradeStage && (
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded border font-mono ${
                  signal.tradeStage === 'POST_TARGET_RETRACEMENT'
                    ? 'border-amber-500/50 bg-amber-950/60 text-amber-300 animate-pulse'
                    : signal.tradeStage === 'TARGET_1_HIT' || signal.tradeStage === 'TARGET_2_HIT'
                    ? 'border-emerald-500/50 bg-emerald-950/60 text-emerald-300'
                    : signal.tradeStage === 'EXPANDING_IN_PROFIT'
                    ? 'border-sky-500/50 bg-sky-950/60 text-sky-300'
                    : signal.tradeStage === 'STOP_LOSS_HIT'
                    ? 'border-rose-500/50 bg-rose-950/60 text-rose-300'
                    : 'border-slate-700 bg-slate-800 text-slate-300'
                }`}>
                  {signal.tradeStage === 'POST_TARGET_RETRACEMENT' && '⚠️ TARGET 1 HIT · RETRACED'}
                  {signal.tradeStage === 'TARGET_1_HIT' && '🎯 TARGET 1 HIT'}
                  {signal.tradeStage === 'TARGET_2_HIT' && '🚀 TARGET 2 HIT'}
                  {signal.tradeStage === 'EXPANDING_IN_PROFIT' && '📈 IN PROFIT'}
                  {signal.tradeStage === 'FRESH_ENTRY' && '⚡ ENTRY ZONE'}
                  {signal.tradeStage === 'STOP_LOSS_HIT' && '🛑 STOP LOSS HIT'}
                  {signal.tradeStage === 'NEUTRAL_WAIT' && '⏸️ WAIT'}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Trade Lifecycle & Institutional Trade Intelligence Banner */}
      {(() => {
        const stage = signal.tradeStage || 'FRESH_ENTRY';
        const isCE = signal.recommendedType === 'CE';
        const isNeutral = signal.action === 'WAIT_NEUTRAL';

        if (stage === 'POST_TARGET_RETRACEMENT') {
          return (
            <div className="mt-3 p-3 rounded-lg bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs flex items-start gap-2.5">
              <div className="p-1.5 rounded bg-amber-500/20 text-amber-400 shrink-0 mt-0.5">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="space-y-1 w-full">
                <div className="font-bold text-amber-300 text-xs flex items-center justify-between">
                  <span>⚠️ Target 1 Achieved Earlier · Retracement Phase Active</span>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Stand By
                  </span>
                </div>
                <p className="text-amber-200/90 text-xs leading-relaxed">
                  <strong>Tactical Directive:</strong> Target 1 was achieved earlier in this session. The market is consolidating in a post-target pullback. <em>Do not chase new entries at current levels</em> — wait for a confirmed price retest of Intraday VWAP ({ticker.currency}{signal.realtimeIndicators?.vwap.value.toLocaleString() || 'support'}) or the 9 EMA before seeking re-entry.
                </p>
                <div className="pt-1 text-[11px] text-amber-300/80 border-t border-amber-500/20 flex flex-wrap items-center justify-between gap-2 font-mono">
                  <span>Rule: Avoid FOMO chop at session extremes</span>
                  <span>Trailing SL: Locked at Cost for runners</span>
                </div>
              </div>
            </div>
          );
        }

        if (stage === 'TARGET_1_HIT') {
          return (
            <div className="mt-3 p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-xs flex items-start gap-2.5">
              <div className="p-1.5 rounded bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div className="space-y-1 w-full">
                <div className="font-bold text-emerald-300 text-xs flex items-center justify-between">
                  <span>🎯 Tactical Target 1 Captured (+{t1ProfitPct}%) · Milestone Secured</span>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Scale Out 50%
                  </span>
                </div>
                <p className="text-emerald-200/90 text-xs leading-relaxed">
                  <strong>Execution Protocol:</strong> Book 50% profits on your position immediately. Adjust the Stop Loss on the remaining 50% runner lots to your exact entry cost to guarantee a completely risk-free ride toward Target 2.
                </p>
                <div className="pt-1 text-[11px] text-emerald-300/80 border-t border-emerald-500/20 flex flex-wrap items-center justify-between gap-2 font-mono">
                  <span>Action: Book partial gains</span>
                  <span>Remaining: Risk-free runner to Target 2</span>
                </div>
              </div>
            </div>
          );
        }

        if (stage === 'TARGET_2_HIT') {
          return (
            <div className="mt-3 p-3 rounded-lg bg-sky-950/40 border border-sky-500/40 text-sky-200 text-xs flex items-start gap-2.5">
              <div className="p-1.5 rounded bg-sky-500/20 text-sky-400 shrink-0 mt-0.5">
                <Maximize2 className="w-4 h-4" />
              </div>
              <div className="space-y-1 w-full">
                <div className="font-bold text-sky-300 text-xs flex items-center justify-between">
                  <span>🚀 Structural Target 2 Captured (+{t2ProfitPct}%) · Trend Climax</span>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                    Full Exit
                  </span>
                </div>
                <p className="text-sky-200/90 text-xs leading-relaxed">
                  <strong>Execution Protocol:</strong> The 15m structural measured move is complete. Institutional liquidity sweeps and profit booking are expected near major walls. Close all remaining runner contracts and protect realized session gains.
                </p>
                <div className="pt-1 text-[11px] text-sky-300/80 border-t border-sky-500/20 flex flex-wrap items-center justify-between gap-2 font-mono">
                  <span>Objective: 100% Target Met</span>
                  <span>Next Action: Flat position, wait for next setup</span>
                </div>
              </div>
            </div>
          );
        }

        if (stage === 'EXPANDING_IN_PROFIT') {
          return (
            <div className="mt-3 p-3 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-emerald-200 text-xs flex items-start gap-2.5">
              <div className="p-1.5 rounded bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div className="space-y-1 w-full">
                <div className="font-bold text-emerald-300 text-xs flex items-center justify-between">
                  <span>📈 Momentum Expanding in Profit · Trend Acceleration</span>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Hold & Trail
                  </span>
                </div>
                <p className="text-emerald-200/90 text-xs leading-relaxed">
                  <strong>Trade Management:</strong> Favorable institutional order flow is pushing contract premiums in the trade direction. Maintain trailing stop discipline and let the position ride. Prepare partial profit booking orders as Target 1 nears.
                </p>
                <div className="pt-1 text-[11px] text-emerald-300/80 border-t border-emerald-500/20 flex flex-wrap items-center justify-between gap-2 font-mono">
                  <span>Flow: {signal.realtimeIndicators?.orderFlow.sentiment.replace(/_/g, ' ') || 'Order Flow Dominance'}</span>
                  <span>Discipline: Trail SL along 9 EMA / VWAP</span>
                </div>
              </div>
            </div>
          );
        }

        if (stage === 'STOP_LOSS_HIT') {
          return (
            <div className="mt-3 p-3 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2.5">
              <div className="p-1.5 rounded bg-rose-500/20 text-rose-400 shrink-0 mt-0.5">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="space-y-1 w-full">
                <div className="font-bold text-rose-300 text-xs flex items-center justify-between">
                  <span>🛑 Technical Invalidation Level Breached · Capital Protection Triggered</span>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    Exit Trade
                  </span>
                </div>
                <p className="text-rose-200/90 text-xs leading-relaxed">
                  <strong>Risk Directive:</strong> Invalidation floor was breached. Strict institutional discipline dictates an immediate exit to cap drawdown. Do not average losing positions — preserve capital for the next high-probability setup.
                </p>
                <div className="pt-1 text-[11px] text-rose-300/80 border-t border-rose-500/20 flex flex-wrap items-center justify-between gap-2 font-mono">
                  <span>Protocol: Hard stop triggered</span>
                  <span>Capital Preservation: Cut losses swiftly</span>
                </div>
              </div>
            </div>
          );
        }

        if (stage === 'NEUTRAL_WAIT' || isNeutral) {
          return (
            <div className="mt-3 p-3 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 text-xs flex items-start gap-2.5">
              <div className="p-1.5 rounded bg-amber-500/20 text-amber-400 shrink-0 mt-0.5">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div className="space-y-1 w-full">
                <div className="font-bold text-slate-200 text-xs flex items-center justify-between">
                  <span>⏸️ Range Equilibrium / Consolidation Phase · Stand Aside</span>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    No Action
                  </span>
                </div>
                <p className="text-slate-400 text-xs leading-relaxed">
                  <strong>Market Context:</strong> Spot is oscillating between Support ({ticker.currency}{metrics.majorSupportStrike.toLocaleString()}) and Resistance ({ticker.currency}{metrics.majorResistanceStrike.toLocaleString()}). Whipsaw risk is elevated — stay on the sidelines until a volume-confirmed directional breakout emerges.
                </p>
                <div className="pt-1 text-[11px] text-slate-400 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 font-mono">
                  <span>Pillar: Multi-timeframe consolidation</span>
                  <span>Discipline: Capital preservation mode</span>
                </div>
              </div>
            </div>
          );
        }

        // Default: FRESH_ENTRY
        return (
          <div className="mt-3 p-3 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-emerald-200 text-xs flex items-start gap-2.5">
            <div className="p-1.5 rounded bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
              <Zap className="w-4 h-4" />
            </div>
            <div className="space-y-1 w-full">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-emerald-300 text-xs flex items-center gap-1.5">
                  <span>⚡ Institutional Trade Setup Active · {isCE ? 'Call Accumulation Momentum' : 'Put Distribution Momentum'}</span>
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">
                  R:R {signal.riskRewardRatio} · {signal.strength} ({signal.confidence}%)
                </span>
              </div>
              <p className="text-emerald-200/90 text-xs leading-relaxed">
                <strong>Catalyst & Confluence:</strong> {signal.candleAnalysis?.confluencePattern || 'Multi-timeframe 2m/5m/15m momentum alignment'} · {signal.realtimeIndicators?.orderFlow.sentiment.replace(/_/g, ' ') || 'Order Flow Dominance'}.
              </p>
              <div className="pt-1 text-[11px] text-emerald-300/80 border-t border-emerald-500/20 flex flex-wrap items-center justify-between gap-2 font-mono">
                <span>Rule: Enter on 5m candle close confirmation · Max 1-2% risk</span>
                <span>Action: Scale 50% at Target 1 · Trail SL to Cost</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Live Contract Strip */}
      <div className="mt-3 p-3 rounded-lg bg-slate-950 border border-slate-800/90 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">LIVE NFO</span>
          <span className="text-slate-600">·</span>
          <span className="font-mono text-white font-bold text-xs sm:text-sm">
            {ticker.symbol} {signal.recommendedStrike} {signal.recommendedType}
          </span>
        </div>

        {/* Live Contract Price & Spread */}
        <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors ${
            priceFlash === 'UP' ? 'bg-emerald-500/30 text-emerald-300' :
            priceFlash === 'DOWN' ? 'bg-rose-500/30 text-rose-300' :
            'bg-slate-900 text-white'
          }`}>
            <span className="text-slate-400 text-[11px]">LTP:</span>
            <span className="text-base sm:text-lg font-bold">
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
            <div className="text-slate-400 text-[11px] flex items-center gap-1.5">
              <span>Bid: <strong className="text-slate-200">{ticker.currency}{liveContract.bidPrice.toFixed(2)}</strong></span>
              <span>·</span>
              <span>Ask: <strong className="text-slate-200">{ticker.currency}{liveContract.askPrice.toFixed(2)}</strong></span>
            </div>
          )}
        </div>
      </div>

      {/* Lot Sizer Control Bar */}
      <div className={`mt-3 flex flex-wrap items-center justify-between gap-2.5 p-2.5 sm:p-3 rounded-lg border ${
        isLight ? 'bg-slate-100 border-slate-200 text-slate-800' : 'bg-slate-950/60 border-slate-800/60 text-slate-300'
      }`}>
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-start">
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <Calculator className="w-4 h-4 text-sky-400 shrink-0" />
            <span className="hidden xs:inline">Position:</span>
          </div>

          {/* Quick lot buttons */}
          <div className="flex items-center gap-1">
            {quickLots.map(q => (
              <button
                key={q}
                onClick={() => setLots(q)}
                className={`px-2 py-1 text-xs font-mono font-bold rounded transition-colors cursor-pointer min-h-[32px] min-w-[32px] ${
                  lots === q 
                    ? 'bg-sky-500 text-white font-bold shadow-sm' 
                    : isLight 
                      ? 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-300' 
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                }`}
              >
                {q}L
              </button>
            ))}
          </div>

          {/* Stepper for custom lots */}
          <div className={`flex items-center rounded overflow-hidden border ${
            isLight ? 'border-slate-300 bg-white' : 'border-slate-700 bg-slate-900'
          }`}>
            <button
              onClick={() => setLots(Math.max(1, lots - 1))}
              className={`px-2.5 py-1 text-xs font-bold cursor-pointer min-h-[32px] min-w-[32px] flex items-center justify-center ${
                isLight ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
              title="Decrease lot"
            >
              -
            </button>
            <span className={`px-2 py-1 text-xs font-mono font-bold min-w-[44px] text-center ${
              isLight ? 'text-slate-900' : 'text-white'
            }`}>
              {lots} {lots === 1 ? 'Lot' : 'Lots'}
            </span>
            <button
              onClick={() => setLots(lots + 1)}
              className={`px-2.5 py-1 text-xs font-bold cursor-pointer min-h-[32px] min-w-[32px] flex items-center justify-center ${
                isLight ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
              title="Increase lot"
            >
              +
            </button>
          </div>
        </div>

        {/* Total Quantity */}
        <div className={`flex items-center justify-between sm:justify-end gap-3 text-xs font-mono w-full sm:w-auto pt-2 sm:pt-0 ${
          isLight ? 'border-t border-slate-200 sm:border-0' : 'border-t border-slate-800/60 sm:border-0'
        }`}>
          <div className="text-sky-600 dark:text-sky-300 font-bold">
            Total Quantity: <strong className={isLight ? 'text-slate-900' : 'text-white'}>{totalQty} units</strong> ({lots} Lot{lots > 1 ? 's' : ''})
          </div>
        </div>
      </div>

      {/* Real-Money Live Profit & Loss Matrix */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mt-3">
        {/* Metric 1: Capital Deployed */}
        <div className={`p-2.5 sm:p-3.5 rounded-lg border flex flex-col justify-between ${
          isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'
        }`}>
          <div className="flex items-center justify-between text-[10px] sm:text-[11px] uppercase font-semibold text-slate-500 dark:text-slate-400">
            <span>Capital Outlay</span>
            <span className="text-[10px] text-slate-400 font-mono">{lots}L</span>
          </div>
          <div className="my-1.5">
            <div className={`text-lg sm:text-2xl font-bold font-mono tracking-tight ${
              isLight ? 'text-slate-900' : 'text-white'
            }`}>
              {ticker.currency}{totalCapital.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              {totalQty} × {ticker.currency}{currentLTP.toFixed(2)}
            </div>
          </div>
          <div className={`text-[10px] text-slate-500 pt-1 flex items-center justify-between border-t ${
            isLight ? 'border-slate-200' : 'border-slate-900'
          }`}>
            <span>Max Outlay</span>
          </div>
        </div>

        {/* Metric 2: Stop Loss Points Risk / Trailing Stop Loss */}
        {(() => {
          const isBreakEven = signal.capitalProtectionStatus === 'BREAK_EVEN_LOCKED';
          const isProfitLocked = signal.capitalProtectionStatus === 'PROFIT_LOCKED';
          const displaySL = signal.trailingStopLoss || stopLoss;
          const isTrailed = isBreakEven || isProfitLocked;

          return (
            <div className={`p-2.5 sm:p-3.5 rounded-lg border flex flex-col justify-between transition-all ${
              isProfitLocked
                ? (isLight ? 'bg-emerald-50/70 border-emerald-500/40 text-emerald-950' : 'bg-slate-950 border-emerald-500/50 text-emerald-200')
                : isBreakEven
                  ? (isLight ? 'bg-amber-50/70 border-amber-500/40 text-amber-950' : 'bg-slate-950 border-amber-500/50 text-amber-200')
                  : (isLight ? 'bg-rose-50/50 border-rose-500/30 text-rose-950' : 'bg-slate-950 border-rose-500/30 text-rose-200')
            }`}>
              <div className="flex items-center justify-between text-[10px] sm:text-[11px] uppercase font-semibold">
                <span className={`flex items-center gap-1 ${
                  isProfitLocked ? 'text-emerald-500 font-bold' : isBreakEven ? 'text-amber-500 font-bold' : 'text-rose-500 dark:text-rose-400'
                }`}>
                  {isTrailed ? <ShieldCheck className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3 h-3" />}
                  {isProfitLocked ? 'Profit Lock SL' : isBreakEven ? 'Trailed SL (Cost)' : 'Stop Loss'}
                </span>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                  isProfitLocked
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : isBreakEven
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'bg-rose-500/10 text-rose-600 dark:text-rose-300'
                }`}>
                  {isProfitLocked ? '🔒 LOCKED' : isBreakEven ? '🛡️ 0% RISK' : `-${slLossPct}%`}
                </span>
              </div>
              <div className="my-1.5">
                <div className={`text-lg sm:text-2xl font-bold font-mono tracking-tight ${
                  isProfitLocked ? 'text-emerald-400' : isBreakEven ? 'text-amber-400' : 'text-rose-600 dark:text-rose-400'
                }`}>
                  {isTrailed ? `${ticker.currency}${displaySL.toFixed(2)}` : `-${slRiskPoints.toFixed(2)} pts`}
                </div>
                <div className={`text-[10px] sm:text-[11px] font-mono ${
                  isProfitLocked ? 'text-emerald-400/90' : isBreakEven ? 'text-amber-400/90' : 'text-rose-700/80 dark:text-rose-300/80'
                }`}>
                  {isProfitLocked
                    ? `Locked @ ${ticker.currency}${displaySL.toFixed(2)}`
                    : isBreakEven
                      ? `Break-even @ ${ticker.currency}${displaySL.toFixed(2)}`
                      : `Cut @ ${ticker.currency}${stopLoss.toFixed(2)}`}
                </div>
              </div>
              <div className={`text-[10px] pt-1 flex items-center justify-between font-mono border-t ${
                isLight ? 'border-slate-200 text-slate-500' : 'border-slate-900 text-slate-400'
              }`}>
                <span className="truncate mr-1 text-[9.5px]" title={signal.trailingStopNote || (signal.spotStopLoss ? `Spot Invalidation @ ${ticker.currency}${signal.spotStopLoss.toLocaleString()}` : 'Risk Limit')}>
                  {signal.trailingStopNote || (signal.spotStopLoss ? `Spot: ${ticker.currency}${signal.spotStopLoss.toLocaleString()}` : 'Risk Limit')}
                </span>
                <span className="shrink-0">{isTrailed ? 'Protected' : 'Max SL'}</span>
              </div>
            </div>
          );
        })()}

        {/* Metric 3: Target 1 Points Gain */}
        <div className={`p-2.5 sm:p-3.5 rounded-lg border border-emerald-500/30 flex flex-col justify-between ${
          isLight ? 'bg-emerald-50/50' : 'bg-slate-950'
        }`}>
          <div className="flex items-center justify-between text-[10px] sm:text-[11px] uppercase font-semibold text-emerald-600 dark:text-emerald-400">
            <span className="flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3" />
              Target 1
            </span>
            <span className="text-[10px] font-mono px-1 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
              +{t1ProfitPct}%
            </span>
          </div>
          <div className="my-1.5">
            <div className="text-lg sm:text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 tracking-tight">
              +{t1Points.toFixed(2)} pts
            </div>
            <div className="text-[10px] sm:text-[11px] text-emerald-700/80 dark:text-emerald-300/80 font-mono">
              Exit @ {ticker.currency}{target1.toFixed(2)}
            </div>
          </div>
          <div className={`text-[10px] text-slate-500 dark:text-slate-400 pt-1 flex items-center justify-between font-mono border-t ${
            isLight ? 'border-emerald-200' : 'border-slate-900'
          }`}>
            <span className="truncate mr-1 text-[9.5px] text-emerald-400/90" title={signal.target1Basis || `Spot Target`}>
              {signal.spotTarget1 ? `Spot: ${ticker.currency}${signal.spotTarget1.toLocaleString()}` : `R:R ${signal.riskRewardRatio}`}
            </span>
            <span className="shrink-0">R:R {signal.riskRewardRatio}</span>
          </div>
        </div>

        {/* Metric 4: Target 2 Points Gain */}
        <div className={`p-2.5 sm:p-3.5 rounded-lg border border-sky-500/30 flex flex-col justify-between ${
          isLight ? 'bg-sky-500/5' : 'bg-slate-950'
        }`}>
          <div className="flex items-center justify-between text-[10px] sm:text-[11px] uppercase font-semibold text-sky-600 dark:text-sky-400">
            <span className="flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3" />
              Target 2
            </span>
            <span className="text-[10px] font-mono px-1 rounded bg-sky-500/10 text-sky-600 dark:text-sky-300">
              +{t2ProfitPct}%
            </span>
          </div>
          <div className="my-1.5">
            <div className="text-lg sm:text-2xl font-bold font-mono text-sky-600 dark:text-sky-400 tracking-tight">
              +{t2Points.toFixed(2)} pts
            </div>
            <div className="text-[10px] sm:text-[11px] text-sky-700/80 dark:text-sky-300/80 font-mono">
              Exit @ {ticker.currency}{target2.toFixed(2)}
            </div>
          </div>
          <div className={`text-[10px] text-slate-500 dark:text-slate-400 pt-1 flex items-center justify-between font-mono border-t ${
            isLight ? 'border-sky-200' : 'border-slate-900'
          }`}>
            <span className="truncate mr-1 text-[9.5px] text-sky-400/90" title={signal.target2Basis || `Major Wall`}>
              {signal.spotTarget2 ? `Spot: ${ticker.currency}${signal.spotTarget2.toLocaleString()}` : 'Extended Wall'}
            </span>
            <span className="shrink-0">Runner</span>
          </div>
        </div>
      </div>

      {/* Execution Guidance & Key Levels Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 text-xs font-mono">
        <div className="p-2 rounded bg-slate-950 border border-slate-800">
          <span className="text-slate-400 block text-[10px] uppercase font-sans">Entry Zone</span>
          <span className="text-white font-bold text-xs sm:text-sm mt-0.5 block truncate">
            {ticker.currency}{signal.entryRange[0].toFixed(2)} - {signal.entryRange[1].toFixed(2)}
          </span>
        </div>

        <div className="p-2 rounded bg-slate-950 border border-slate-800">
          <span className="text-slate-400 block text-[10px] uppercase font-sans">Breakeven Spot</span>
          <span className="text-sky-400 font-bold text-xs sm:text-sm mt-0.5 block truncate">
            {ticker.currency}{breakevenSpot.toFixed(2)}
          </span>
        </div>

        <div className="p-2 rounded bg-slate-950 border border-slate-800">
          <span className="text-slate-400 block text-[10px] uppercase font-sans">Risk : Reward</span>
          <span className="text-emerald-400 font-bold text-xs sm:text-sm mt-0.5 block truncate">
            {signal.riskRewardRatio}
          </span>
        </div>
      </div>

      {/* Compact Strike Profit Possibility Strip (2 Below · Predicted · 2 Above) */}
      {signal.adjacentStrikes && signal.adjacentStrikes.length > 0 && (
        <div className="mt-3 p-2.5 sm:p-3 rounded-lg bg-slate-950/90 border border-slate-800">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-white uppercase tracking-wider">
              <Target className="w-3.5 h-3.5 text-emerald-400" />
              <span>Strike Matrix (2 Below · Predicted · 2 Above)</span>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              {signal.recommendedType === 'CE' ? 'Calls (CE)' : 'Puts (PE)'} · Click to Simulate
            </span>
          </div>

          {/* Compact 5-Strike Row */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 font-mono text-xs">
            {signal.adjacentStrikes.map((adj) => {
              const isPred = adj.isPredicted;
              return (
                <button
                  key={adj.strike}
                  onClick={() => onSelectContractForSimulation(adj.strike, adj.type)}
                  className={`p-2 rounded-md border text-left transition-colors cursor-pointer flex flex-col justify-between ${
                    isPred
                      ? 'bg-emerald-950/40 border-emerald-500/60 ring-1 ring-emerald-500/40'
                      : 'bg-slate-900/80 border-slate-800/80 hover:bg-slate-850 hover:border-slate-700'
                  }`}
                  title={`Click to simulate ${adj.strike} ${adj.type} (${adj.recommendationTag})`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className={`font-bold ${isPred ? 'text-emerald-400 font-bold' : 'text-slate-200'}`}>
                      {adj.strike} {adj.type}
                    </span>
                    {isPred ? (
                      <span className="text-[9px] px-1 py-0.2 rounded font-bold bg-emerald-500 text-slate-950 font-mono">
                        PICK
                      </span>
                    ) : (
                      <span className="text-[9.5px] text-slate-500 font-mono">
                        {adj.relativePosition > 0 ? `+${adj.relativePosition}` : adj.relativePosition}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-1 text-[11px]">
                    <span className="text-slate-400 font-sans font-normal">Price:</span>
                    <span className="text-white font-bold">
                      {ticker.currency}{adj.ltp.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-1 text-[11px] mt-0.5 pt-0.5 border-t border-slate-800/60">
                    <span className="text-slate-400 font-sans font-normal" title="Probability of Profit / Win Chance">Win Prob:</span>
                    <span className={`font-bold ${
                      adj.profitProbabilityPercent >= 70 ? 'text-emerald-400' :
                      adj.profitProbabilityPercent >= 55 ? 'text-sky-400' :
                      adj.profitProbabilityPercent >= 45 ? 'text-amber-400' : 'text-purple-400'
                    }`}>
                      {adj.profitProbabilityPercent}%
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-1 text-[10.5px] mt-0.5">
                    <span className="text-slate-400 font-sans font-normal" title="Expected Target 1 Gain %">T1 ROI:</span>
                    <span className="text-emerald-400 font-semibold">
                      +{adj.target1GainPercent}%
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Explanatory Rationale Footer */}
          <div className="mt-2 pt-1.5 border-t border-slate-800/70 flex items-center justify-between text-[10.5px] text-slate-400">
            <span className="text-slate-300">
              💡 <strong className="text-slate-200">Selection Logic:</strong> Deep ITM strikes (e.g. {signal.recommendedStrike + ticker.strikeStep * (signal.recommendedType === 'PE' ? 1 : -1)} {signal.recommendedType}) have higher Win Prob (90%+) via high Delta, but require high capital outlay with lower % leverage. The algorithm recommends <strong className="text-emerald-400">ATM {signal.recommendedStrike} {signal.recommendedType}</strong> for optimal Gamma acceleration, higher % ROI, and maximum liquidity.
            </span>
          </div>
        </div>
      )}

      {/* Multi-Timeframe Candlestick & Chart Patterns (2m | 5m | 15m) with Momentum Scoring */}
      {signal.candleAnalysis && (
        <div className="mt-3 rounded-lg bg-slate-950/80 border border-slate-800 overflow-hidden">
          <div 
            onClick={() => toggleSubSection('multiTimeframe')}
            className={`flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-900/90 hover:bg-slate-900 cursor-pointer select-none transition-colors ${
              expandedSubSections.multiTimeframe ? 'border-b border-slate-800' : ''
            }`}
          >
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Multi-Timeframe Candlestick Momentum Engine (2m · 5m · 15m)
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-mono">
              <span className="text-slate-400 hidden sm:inline">Momentum Confluence:</span>
              <span className={`font-bold px-2.5 py-0.5 rounded text-[11px] border ${
                signal.candleAnalysis.confluenceBias === 'BULLISH'
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/10'
                  : signal.candleAnalysis.confluenceBias === 'BEARISH'
                  ? 'bg-rose-500/15 text-rose-300 border-rose-500/40 shadow-sm shadow-rose-500/10'
                  : 'bg-amber-500/15 text-amber-300 border-amber-500/40'
              }`}>
                {signal.candleAnalysis.momentumAlignment?.replace(/_/g, ' ') || signal.candleAnalysis.confluenceBias} ({signal.candleAnalysis.confluenceScore > 0 ? '+' : ''}{signal.candleAnalysis.confluenceScore}/10)
              </span>
              <button className="p-1 text-slate-400 hover:text-white" title={expandedSubSections.multiTimeframe ? "Collapse section" : "Expand section"}>
                {expandedSubSections.multiTimeframe ? <ChevronUp className="w-4 h-4 text-emerald-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>
            </div>
          </div>

          {expandedSubSections.multiTimeframe && (
            <div className="p-3 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
                {/* 2-Minute Candle Momentum Analysis */}
                <div className="p-2.5 rounded bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-1.5">
                      <span className="text-sky-400 font-bold flex items-center gap-1">
                        <span>2-Min Micro Trigger</span>
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                        (signal.candleAnalysis.m2Score ?? signal.candleAnalysis.m2.momentumScore) > 0 ? 'text-emerald-400 bg-emerald-500/15 border border-emerald-500/30' :
                        (signal.candleAnalysis.m2Score ?? signal.candleAnalysis.m2.momentumScore) < 0 ? 'text-rose-400 bg-rose-500/15 border border-rose-500/30' : 'text-slate-400 bg-slate-800'
                      }`}>
                        {(signal.candleAnalysis.m2Score ?? signal.candleAnalysis.m2.momentumScore) > 0 ? '+' : ''}
                        {(signal.candleAnalysis.m2Score ?? signal.candleAnalysis.m2.momentumScore)}/10
                      </span>
                    </div>
                    
                    {/* Visual Momentum Progress Bar */}
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mb-2">
                      <div 
                        className={`h-full transition-all duration-500 ${
                          (signal.candleAnalysis.m2Score ?? signal.candleAnalysis.m2.momentumScore) >= 0 ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(10, Math.abs(signal.candleAnalysis.m2Score ?? signal.candleAnalysis.m2.momentumScore) * 10))}%` }}
                      />
                    </div>

                    <div className="font-bold text-slate-200 text-xs mt-0.5">
                      {signal.candleAnalysis.m2.pattern.replace(/2m\s*/, '')}
                    </div>
                  </div>
                  
                  <div className="mt-2.5 pt-2 border-t border-slate-800/80 text-[10.5px] font-mono text-slate-400 flex items-center justify-between">
                    <span>Support: <strong className="text-slate-200">{ticker.currency}{signal.candleAnalysis.m2.support.toLocaleString()}</strong></span>
                    <span>Resist: <strong className="text-slate-200">{ticker.currency}{signal.candleAnalysis.m2.resistance.toLocaleString()}</strong></span>
                  </div>
                </div>

                {/* 5-Minute Candle Momentum Analysis */}
                <div className="p-2.5 rounded bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-1.5">
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <span>5-Min Tactical Trend</span>
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                        (signal.candleAnalysis.m5Score ?? signal.candleAnalysis.m5.momentumScore) > 0 ? 'text-emerald-400 bg-emerald-500/15 border border-emerald-500/30' :
                        (signal.candleAnalysis.m5Score ?? signal.candleAnalysis.m5.momentumScore) < 0 ? 'text-rose-400 bg-rose-500/15 border border-rose-500/30' : 'text-slate-400 bg-slate-800'
                      }`}>
                        {(signal.candleAnalysis.m5Score ?? signal.candleAnalysis.m5.momentumScore) > 0 ? '+' : ''}
                        {(signal.candleAnalysis.m5Score ?? signal.candleAnalysis.m5.momentumScore)}/10
                      </span>
                    </div>

                    {/* Visual Momentum Progress Bar */}
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mb-2">
                      <div 
                        className={`h-full transition-all duration-500 ${
                          (signal.candleAnalysis.m5Score ?? signal.candleAnalysis.m5.momentumScore) >= 0 ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(10, Math.abs(signal.candleAnalysis.m5Score ?? signal.candleAnalysis.m5.momentumScore) * 10))}%` }}
                      />
                    </div>

                    <div className="font-bold text-slate-200 text-xs mt-0.5">
                      {signal.candleAnalysis.m5.pattern.replace(/5m\s*/, '')}
                    </div>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-slate-800/80 text-[10.5px] font-mono text-slate-400 flex items-center justify-between">
                    <span>Swing Target: <strong className="text-emerald-400">{ticker.currency}{signal.candleAnalysis.derivedExitLevel1.toLocaleString()}</strong></span>
                    <span>ATR: <strong className="text-slate-300">{ticker.currency}{signal.candleAnalysis.m5.atr}</strong></span>
                  </div>
                </div>

                {/* 15-Minute Candle Momentum Analysis */}
                <div className="p-2.5 rounded bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-1.5">
                      <span className="text-amber-400 font-bold flex items-center gap-1">
                        <span>15-Min Structure Anchor</span>
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                        (signal.candleAnalysis.m15Score ?? signal.candleAnalysis.m15.momentumScore) > 0 ? 'text-emerald-400 bg-emerald-500/15 border border-emerald-500/30' :
                        (signal.candleAnalysis.m15Score ?? signal.candleAnalysis.m15.momentumScore) < 0 ? 'text-rose-400 bg-rose-500/15 border border-rose-500/30' : 'text-slate-400 bg-slate-800'
                      }`}>
                        {(signal.candleAnalysis.m15Score ?? signal.candleAnalysis.m15.momentumScore) > 0 ? '+' : ''}
                        {(signal.candleAnalysis.m15Score ?? signal.candleAnalysis.m15.momentumScore)}/10
                      </span>
                    </div>

                    {/* Visual Momentum Progress Bar */}
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mb-2">
                      <div 
                        className={`h-full transition-all duration-500 ${
                          (signal.candleAnalysis.m15Score ?? signal.candleAnalysis.m15.momentumScore) >= 0 ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(10, Math.abs(signal.candleAnalysis.m15Score ?? signal.candleAnalysis.m15.momentumScore) * 10))}%` }}
                      />
                    </div>

                    <div className="font-bold text-slate-200 text-xs mt-0.5">
                      {signal.candleAnalysis.m15.pattern.replace(/15m\s*/, '')}
                    </div>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-slate-800/80 text-[10.5px] font-mono text-slate-400 flex items-center justify-between">
                    <span>Runner Target: <strong className="text-sky-400">{ticker.currency}{signal.candleAnalysis.derivedExitLevel2.toLocaleString()}</strong></span>
                    <span>ATR: <strong className="text-slate-300">{ticker.currency}{signal.candleAnalysis.m15.atr}</strong></span>
                  </div>
                </div>
              </div>

              <div className="mt-2.5 pt-2 border-t border-slate-800/70 text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-2">
                <span>Pattern Confluence: <strong className="text-slate-200">{signal.candleAnalysis.confluencePattern}</strong></span>
                <span className="font-mono">
                  Pattern Invalidation Stop: <strong className="text-rose-400">{ticker.currency}{signal.candleAnalysis.invalidationLevel.toLocaleString()}</strong>
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Real-Time News Impact Multiplier & Grounded Confluence Architecture */}
      {signal.targetExitSynthesis && (
        <div className="mt-3 rounded-lg bg-slate-950/80 border border-slate-800 overflow-hidden">
          <div 
            onClick={() => toggleSubSection('highProb')}
            className={`flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-900/90 hover:bg-slate-900 cursor-pointer select-none transition-colors ${
              expandedSubSections.highProb ? 'border-b border-slate-800' : ''
            }`}
          >
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                High-Probability Swing & News Multiplier Engine
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-mono">
              {signal.targetExitSynthesis.newsMultiplierData && (
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  {signal.targetExitSynthesis.newsMultiplierData.netNewsImpactMultiplier}x Swing Factor
                </span>
              )}
              <button className="p-1 text-slate-400 hover:text-white" title={expandedSubSections.highProb ? "Collapse section" : "Expand section"}>
                {expandedSubSections.highProb ? <ChevronUp className="w-4 h-4 text-emerald-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>
            </div>
          </div>

          {expandedSubSections.highProb && (
            <div className="p-3 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
                {/* Pillar A: Live & Last Night News Multiplier */}
                <div className="p-2.5 rounded bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-1">
                      <span className="text-amber-400 font-bold flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5" />
                        Real-Time News Multipliers
                      </span>
                      <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                        signal.targetExitSynthesis.newsPillar.netNewsBiasScore > 0 ? 'text-emerald-400 bg-emerald-500/10' :
                        signal.targetExitSynthesis.newsPillar.netNewsBiasScore < 0 ? 'text-rose-400 bg-rose-500/10' : 'text-slate-400 bg-slate-800'
                      }`}>
                        {signal.targetExitSynthesis.newsPillar.netNewsBiasScore > 0 ? '+' : ''}{signal.targetExitSynthesis.newsPillar.netNewsBiasScore} Net
                      </span>
                    </div>
                    
                    <div className="space-y-1.5 mt-1.5">
                      <div className="text-[11px] leading-tight">
                        <span className="text-slate-500 font-mono block text-[10px] uppercase">Overnight Anchor ({signal.targetExitSynthesis.newsMultiplierData?.overnightMultiplier ?? 1.0}x):</span>
                        <span className="text-slate-300 font-medium line-clamp-1" title={signal.targetExitSynthesis.newsPillar.overnightHeadline}>
                          {signal.targetExitSynthesis.newsPillar.overnightHeadline}
                        </span>
                      </div>
                      <div className="text-[11px] leading-tight">
                        <span className="text-slate-500 font-mono block text-[10px] uppercase">Live Breaking Catalyst ({signal.targetExitSynthesis.newsMultiplierData?.liveBreakingMultiplier ?? 1.0}x):</span>
                        <span className="text-slate-300 font-medium line-clamp-1" title={signal.targetExitSynthesis.newsPillar.liveHeadline}>
                          {signal.targetExitSynthesis.newsPillar.liveHeadline}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 pt-1.5 border-t border-slate-800/80 text-[10.5px] font-mono text-emerald-400">
                    {signal.targetExitSynthesis.newsPillar.newsTargetImpact}
                  </div>
                </div>

                {/* Pillar B: Previous Multi-Session Trend & Volatility */}
                <div className="p-2.5 rounded bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-1">
                      <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5" />
                        Trend & Measured Volatility
                      </span>
                      <span className="text-slate-400 text-[10px] font-mono">
                        {signal.targetExitSynthesis.trendPillar.trendContinuationProb}% Prob
                      </span>
                    </div>

                    <div className="space-y-1 mt-1 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Session Drift:</span>
                        <strong className="text-slate-200">{signal.targetExitSynthesis.trendPillar.prevSessionTrend}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Day Range Established:</span>
                        <strong className="text-slate-200 font-mono">{ticker.currency}{signal.targetExitSynthesis.trendPillar.dayRange} pts</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Daily Expected Move (ATR):</span>
                        <strong className="text-slate-200 font-mono">±{ticker.currency}{signal.targetExitSynthesis.trendPillar.atrDaily} pts</strong>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 pt-1.5 border-t border-slate-800/80 text-[10.5px] font-mono text-slate-300">
                    Velocity: <span className="text-emerald-400 font-semibold">{signal.targetExitSynthesis.trendPillar.momentumVerdict}</span>
                  </div>
                </div>

                {/* Pillar C: Option Chart Data & Greeks Engine */}
                <div className="p-2.5 rounded bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-1">
                      <span className="text-sky-400 font-bold flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5" />
                        Option Chart Data & Greeks
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        PCR {signal.targetExitSynthesis.optionChartPillar.pcrTotalOI.toFixed(2)}
                      </span>
                    </div>

                    <div className="space-y-1 mt-1 text-[11px] font-mono">
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-sans">Institutional Call Wall:</span>
                        <strong className="text-rose-400">{ticker.currency}{signal.targetExitSynthesis.optionChartPillar.callWall.toLocaleString()}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-sans">Institutional Put Wall:</span>
                        <strong className="text-emerald-400">{ticker.currency}{signal.targetExitSynthesis.optionChartPillar.putWall.toLocaleString()}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-sans">Max Pain Anchor:</span>
                        <strong className="text-sky-400">{ticker.currency}{signal.targetExitSynthesis.optionChartPillar.maxPain.toLocaleString()}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 pt-1.5 border-t border-slate-800/80 text-[10.5px] font-mono text-slate-400 flex justify-between">
                    <span>Δ Gain: <strong className="text-emerald-400">+{ticker.currency}{signal.targetExitSynthesis.optionChartPillar.deltaExpansion}</strong></span>
                    <span>Γ Accel: <strong className="text-sky-400">+{ticker.currency}{signal.targetExitSynthesis.optionChartPillar.gammaAcceleration}</strong></span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}



      {/* Nifty Derivative Heavyweight Companies & Sectoral Breadth (Indian Markets) */}
      {signal.constituentAnalysis && (
        <div className="mt-3 rounded-lg bg-slate-950/80 border border-slate-800 overflow-hidden">
          <div 
            onClick={() => toggleSubSection('heavyweights')}
            className={`flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-900/90 hover:bg-slate-900 cursor-pointer select-none transition-colors ${
              expandedSubSections.heavyweights ? 'border-b border-slate-800' : ''
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <BarChart2 className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Nifty 50 Derivative Heavyweights & Sectoral Breadth
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-mono">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                signal.constituentAnalysis.overallHeavyweightBias.includes('BULLISH') ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' :
                signal.constituentAnalysis.overallHeavyweightBias.includes('BEARISH') ? 'bg-rose-500/15 text-rose-300 border-rose-500/30' :
                'bg-amber-500/15 text-amber-300 border-amber-500/30'
              }`}>
                {signal.constituentAnalysis.overallHeavyweightBias.replace(/_/g, ' ')} ({signal.constituentAnalysis.breadthScore > 0 ? '+' : ''}{signal.constituentAnalysis.breadthScore}/10)
              </span>
              <button className="p-1 text-slate-400 hover:text-white" title={expandedSubSections.heavyweights ? "Collapse section" : "Expand section"}>
                {expandedSubSections.heavyweights ? <ChevronUp className="w-4 h-4 text-emerald-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>
            </div>
          </div>

          {expandedSubSections.heavyweights && (
            <div className="p-3 pt-2">
              {/* Heavyweight Breadth Metrics Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2.5 text-xs font-mono">
                <div className="p-2 rounded bg-slate-900/90 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase block font-sans">Constituent A/D</span>
                  <span className="text-xs font-bold text-emerald-400">
                    {signal.constituentAnalysis.advances} Adv <span className="text-slate-500">/</span> <span className="text-rose-400">{signal.constituentAnalysis.declines} Dec</span>
                  </span>
                </div>
                <div className="p-2 rounded bg-slate-900/90 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase block font-sans">Weighted Delta</span>
                  <span className={`text-xs font-bold ${signal.constituentAnalysis.weightedConstituentDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {signal.constituentAnalysis.weightedConstituentDelta >= 0 ? '+' : ''}{signal.constituentAnalysis.weightedConstituentDelta}%
                  </span>
                </div>
                <div className="p-2 rounded bg-slate-900/90 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase block font-sans">Net Point Impact</span>
                  <span className={`text-xs font-bold ${signal.constituentAnalysis.netNiftyPointImpact >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {signal.constituentAnalysis.netNiftyPointImpact >= 0 ? '+' : ''}{signal.constituentAnalysis.netNiftyPointImpact} pts
                  </span>
                </div>
                <div className="p-2 rounded bg-slate-900/90 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase block font-sans">Advance Ratio</span>
                  <span className="text-xs font-bold text-sky-400">
                    {signal.constituentAnalysis.advancesDeclinesRatio}x
                  </span>
                </div>
              </div>

              {/* Top Gainers and Draggers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                {/* Top Leaders */}
                <div className="p-2.5 rounded bg-slate-900/90 border border-emerald-500/20">
                  <span className="text-[10.5px] font-bold text-emerald-400 flex items-center justify-between mb-1.5 font-sans">
                    <span className="flex items-center gap-1">
                      <ArrowUpRight className="w-3.5 h-3.5" /> Top Index Leaders (Heavyweights)
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400/80">Support Pillars</span>
                  </span>
                  <div className="space-y-1 font-mono text-[11px]">
                    {signal.constituentAnalysis.topGainers.map(g => (
                      <div key={g.symbol} className="flex justify-between items-center py-0.5 border-b border-slate-800/50 last:border-0">
                        <span className="text-slate-200 font-bold">{g.symbol}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-400 font-semibold">+{g.changePercent}%</span>
                          <span className="text-[10px] px-1 rounded bg-emerald-500/10 text-emerald-300">+{g.points} pts</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top Laggards */}
                <div className="p-2.5 rounded bg-slate-900/90 border border-rose-500/20">
                  <span className="text-[10.5px] font-bold text-rose-400 flex items-center justify-between mb-1.5 font-sans">
                    <span className="flex items-center gap-1">
                      <ArrowDownRight className="w-3.5 h-3.5" /> Index Laggards & Resistance
                    </span>
                    <span className="text-[10px] font-mono text-rose-400/80">Draggers</span>
                  </span>
                  <div className="space-y-1 font-mono text-[11px]">
                    {signal.constituentAnalysis.topDraggers.map(d => (
                      <div key={d.symbol} className="flex justify-between items-center py-0.5 border-b border-slate-800/50 last:border-0">
                        <span className="text-slate-200 font-bold">{d.symbol}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-rose-400 font-semibold">{d.changePercent}%</span>
                          <span className="text-[10px] px-1 rounded bg-rose-500/10 text-rose-300">{d.points} pts</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Sectoral Breakdown Corridor */}
              <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-1.5 text-[10.5px] font-mono">
                <span className="text-slate-400 font-sans mr-1">Sector Contributions:</span>
                {signal.constituentAnalysis.sectoralBreakdown.slice(0, 5).map(s => (
                  <span 
                    key={s.sector}
                    className={`px-2 py-0.5 rounded border text-[10px] flex items-center gap-1 ${
                      s.sentiment === 'BULLISH' ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30' :
                      s.sentiment === 'BEARISH' ? 'bg-rose-950/40 text-rose-300 border-rose-500/30' :
                      'bg-slate-900 text-slate-300 border-slate-700'
                    }`}
                  >
                    <strong>{s.sector}</strong> ({s.weight}%): {s.contributionPoints >= 0 ? '+' : ''}{s.contributionPoints} pts ({s.leadingStock})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cross-Expiry Prediction Spectrum */}
      {signal.allExpiriesSignals && signal.allExpiriesSignals.length > 0 && (
        <div className={`mt-3 rounded-lg border overflow-hidden transition-all ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-950/80 border-slate-800'
        }`}>
          <div 
            onClick={() => toggleSubSection('allExpiries')}
            className={`flex flex-wrap items-center justify-between gap-2 p-3 cursor-pointer select-none transition-colors ${
              isLight 
                ? 'bg-slate-100/80 hover:bg-slate-100 text-slate-900' 
                : 'bg-slate-900/90 hover:bg-slate-900 text-white'
            } ${expandedSubSections.allExpiries ? (isLight ? 'border-b border-slate-200' : 'border-b border-slate-800') : ''}`}
          >
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
              </span>
              <Compass className="w-4 h-4 text-sky-500 dark:text-sky-400" />
              <span className="text-xs font-bold uppercase tracking-wider">
                Cross-Expiry Prediction Spectrum & Expiry Switcher
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-mono">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                isLight 
                  ? 'bg-sky-50 text-sky-700 border-sky-200' 
                  : 'bg-sky-500/15 text-sky-300 border-sky-500/30'
              }`}>
                {signal.allExpiriesSignals.length} Expiries Analyzed
              </span>
              <button 
                className={`p-1 ${isLight ? 'text-slate-500 hover:text-slate-900' : 'text-slate-400 hover:text-white'}`} 
                title={expandedSubSections.allExpiries ? "Collapse section" : "Expand section"}
              >
                {expandedSubSections.allExpiries ? <ChevronUp className="w-4 h-4 text-emerald-500" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {expandedSubSections.allExpiries && (
            <div className="p-3 pt-2 space-y-3">
              {/* DESKTOP TABULAR VIEW (Visible on screens >= sm) */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className={`border-b text-[10.5px] uppercase font-mono tracking-wider font-semibold ${
                      isLight ? 'border-slate-200 text-slate-500' : 'border-slate-800/80 text-slate-400'
                    }`}>
                      <th className="py-2.5 px-2">Expiry Date & DTE</th>
                      <th className="py-2.5 px-2">Recommendation</th>
                      <th className="py-2.5 px-2">Contract Strike</th>
                      <th className="py-2.5 px-2">Price (LTP)</th>
                      <th className="py-2.5 px-2">Targets (T1 / T2)</th>
                      <th className="py-2.5 px-2">Safety Stop Loss</th>
                      <th className="py-2.5 px-2">R:R Ratio</th>
                      <th className="py-2.5 px-2 text-right">Action / Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {signal.allExpiriesSignals.map((exp) => {
                      const isCE_exp = exp.action === 'BUY_CE';
                      const isPE_exp = exp.action === 'BUY_PE';
                      const isNeutral_exp = exp.action === 'WAIT_NEUTRAL';
                      const isActive = exp.expiryIndex === currentExpiryIndex;

                      return (
                        <tr 
                          key={exp.expiryIndex} 
                          onClick={() => {
                            if (!isActive && onSelectExpiry) {
                              onSelectExpiry(exp.expiryIndex);
                            }
                          }}
                          className={`border-b transition-colors font-mono cursor-pointer ${
                            isLight
                              ? (isActive 
                                  ? 'bg-sky-50/80 border-sky-300 font-semibold' 
                                  : 'border-slate-200/80 hover:bg-slate-50')
                              : (isActive 
                                  ? 'bg-sky-950/30 border-sky-500/40 font-semibold' 
                                  : 'border-slate-800/40 hover:bg-slate-900/60')
                          }`}
                          title={isActive ? 'Current active expiry' : 'Click to switch to this expiry contract'}
                        >
                          {/* Expiry Date & DTE */}
                          <td className="py-3 px-2 font-sans">
                            <div className="flex items-center gap-1.5">
                              <Percent className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-sky-500' : 'text-slate-400'}`} />
                              <span className={`font-bold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                                {exp.expiryDate}
                              </span>
                              {isActive && (
                                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-sky-500 text-white font-bold shrink-0 shadow-xs">
                                  ACTIVE
                                </span>
                              )}
                            </div>
                            <div className={`text-[10px] font-mono mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                              {exp.daysToExpiry !== undefined ? `${exp.daysToExpiry}d to expiry` : ''} 
                              {exp.expiryTypeLabel ? ` · ${exp.expiryTypeLabel}` : ''}
                            </div>
                          </td>

                          {/* Recommendation Action */}
                          <td className="py-3 px-2">
                            {isCE_exp && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/15 text-emerald-500 dark:text-emerald-400 border border-emerald-500/30">
                                BUY CALL (CE)
                              </span>
                            )}
                            {isPE_exp && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/15 text-rose-500 dark:text-rose-400 border border-rose-500/30">
                                BUY PUT (PE)
                              </span>
                            )}
                            {isNeutral_exp && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/15 text-amber-500 dark:text-amber-400 border border-amber-500/30">
                                WAIT / RANGE
                              </span>
                            )}
                          </td>

                          {/* Contract Strike */}
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-1.5">
                              <span className={`font-bold text-xs ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                                {exp.recommendedStrike} {exp.recommendedType}
                              </span>
                              {exp.moneyness && (
                                <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${
                                  exp.moneyness === 'ITM' 
                                    ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                                    : exp.moneyness === 'ATM'
                                      ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                      : 'bg-slate-800 text-slate-400'
                                }`}>
                                  {exp.moneyness}
                                </span>
                              )}
                            </div>
                            {isNeutral_exp && (
                              <span className="text-[10px] text-amber-500/90 font-mono block">
                                Consolidation Pivot
                              </span>
                            )}
                          </td>

                          {/* Current Live Price (LTP) */}
                          <td className="py-3 px-2">
                            <div className={`font-bold text-xs ${isLight ? 'text-slate-900' : 'text-white'}`}>
                              {ticker.currency}{exp.recommendedContractLTP.toFixed(2)}
                            </div>
                            {exp.entryRange && (
                              <div className={`text-[10px] font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                                Zone: {ticker.currency}{exp.entryRange[0].toFixed(1)}-{exp.entryRange[1].toFixed(1)}
                              </div>
                            )}
                          </td>

                          {/* Targets & Goals */}
                          <td className="py-3 px-2 text-[11px]">
                            <div className="space-y-0.5 font-mono">
                              <div className="flex items-center gap-1.5">
                                <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>
                                  {isNeutral_exp ? 'R1:' : 'T1:'}
                                </span>
                                <strong className="text-emerald-500 dark:text-emerald-400">
                                  {ticker.currency}{exp.target1.toFixed(2)}
                                </strong>
                                {exp.target1GainPercent !== undefined && (
                                  <span className="text-[10px] text-emerald-600 dark:text-emerald-300 font-semibold">
                                    (+{exp.target1GainPercent}%)
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>
                                  {isNeutral_exp ? 'R2:' : 'T2:'}
                                </span>
                                <strong className="text-sky-500 dark:text-sky-400">
                                  {ticker.currency}{exp.target2.toFixed(2)}
                                </strong>
                                {exp.target2GainPercent !== undefined && (
                                  <span className="text-[10px] text-sky-600 dark:text-sky-300 font-semibold">
                                    (+{exp.target2GainPercent}%)
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Safety Stop Loss */}
                          <td className="py-3 px-2 text-[11px] font-mono">
                            <div>
                              <strong className="text-rose-500 dark:text-rose-400">
                                {ticker.currency}{exp.stopLoss.toFixed(2)}
                              </strong>
                              {exp.stopLossRiskPercent !== undefined && (
                                <span className="text-[10px] text-rose-500/90 dark:text-rose-400/90 ml-1">
                                  (-{exp.stopLossRiskPercent}%)
                                </span>
                              )}
                            </div>
                            {exp.trailingStopLoss !== undefined && exp.trailingStopLoss > exp.stopLoss && (
                              <div className="text-[9.5px] text-emerald-500 dark:text-emerald-400 font-semibold flex items-center gap-1 mt-0.5">
                                🛡️ Trailed: {ticker.currency}{exp.trailingStopLoss.toFixed(2)}
                              </div>
                            )}
                          </td>

                          {/* Risk:Reward */}
                          <td className="py-3 px-2 text-[11px]">
                            <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10.5px] border ${
                              isLight 
                                ? 'bg-slate-100 text-slate-800 border-slate-300' 
                                : 'bg-slate-800/80 text-slate-200 border-slate-700/70'
                            }`}>
                              {exp.riskRewardRatio || '1 : 1.5'}
                            </span>
                          </td>

                          {/* Action Button / Switch Expiry */}
                          <td className="py-3 px-2 text-right">
                            {isActive ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-sky-500/15 text-sky-500 dark:text-sky-300 border border-sky-500/30 text-[10px] font-bold">
                                <CheckCircle2 className="w-3 h-3 text-sky-400" />
                                Active
                              </span>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectExpiry?.(exp.expiryIndex);
                                }}
                                className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all cursor-pointer border shadow-xs ${
                                  isLight 
                                    ? 'bg-slate-100 hover:bg-sky-500 hover:text-white border-slate-300 text-slate-700' 
                                    : 'bg-slate-900 hover:bg-sky-500 hover:text-white border-slate-700 text-slate-300'
                                }`}
                              >
                                Switch →
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* MOBILE CARDS VIEW (Visible on screens < sm, fully responsive and finger-friendly) */}
              <div className="block sm:hidden space-y-3">
                {signal.allExpiriesSignals.map((exp) => {
                  const isCE_exp = exp.action === 'BUY_CE';
                  const isPE_exp = exp.action === 'BUY_PE';
                  const isNeutral_exp = exp.action === 'WAIT_NEUTRAL';
                  const isActive = exp.expiryIndex === currentExpiryIndex;

                  return (
                    <div 
                      key={exp.expiryIndex}
                      onClick={() => {
                        if (!isActive && onSelectExpiry) {
                          onSelectExpiry(exp.expiryIndex);
                        }
                      }}
                      className={`p-3 rounded-lg border flex flex-col gap-2.5 transition-all cursor-pointer ${
                        isLight
                          ? (isActive ? 'bg-sky-50/70 border-sky-300 shadow-sm' : 'bg-slate-50 border-slate-200')
                          : (isActive ? 'bg-sky-950/20 border-sky-500/40 ring-1 ring-sky-500/30' : 'bg-slate-900/50 border-slate-800')
                      }`}
                    >
                      {/* Top Row: Date & Active Badge / Switch Button */}
                      <div className={`flex items-center justify-between gap-2 border-b pb-1.5 ${
                        isLight ? 'border-slate-200' : 'border-slate-800/60'
                      }`}>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <Percent className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                            <span className={`text-xs font-bold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                              {exp.expiryDate}
                            </span>
                            {isActive && (
                              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-sky-500 text-white font-bold">
                                ACTIVE
                              </span>
                            )}
                          </div>
                          <div className={`text-[10px] font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                            {exp.daysToExpiry !== undefined ? `${exp.daysToExpiry}d to expiry` : ''} 
                            {exp.expiryTypeLabel ? ` · ${exp.expiryTypeLabel}` : ''}
                          </div>
                        </div>

                        <div>
                          {isActive ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-500/15 text-sky-400 border border-sky-500/30">
                              Selected
                            </span>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectExpiry?.(exp.expiryIndex);
                              }}
                              className={`text-[10px] font-bold px-2.5 py-1 rounded border cursor-pointer ${
                                isLight 
                                  ? 'bg-white hover:bg-sky-500 hover:text-white border-slate-300 text-slate-700' 
                                  : 'bg-slate-800 hover:bg-sky-500 hover:text-white border-slate-700 text-slate-300'
                              }`}
                            >
                              Switch →
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Middle Row: Recommendation, Strike Target, and Current LTP */}
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                        <div>
                          {isCE_exp && (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              BUY CALL (CE)
                            </span>
                          )}
                          {isPE_exp && (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                              BUY PUT (PE)
                            </span>
                          )}
                          {isNeutral_exp && (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                              WAIT / RANGE
                            </span>
                          )}
                          
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className={`font-bold text-sm ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                              {exp.recommendedStrike} {exp.recommendedType}
                            </span>
                            {exp.moneyness && (
                              <span className="text-[9px] px-1 py-0.2 rounded font-mono font-bold bg-slate-800 text-slate-400">
                                {exp.moneyness}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right">
                          <span className={`text-[10px] uppercase block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Contract LTP</span>
                          <span className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                            {ticker.currency}{exp.recommendedContractLTP.toFixed(2)}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 block">
                            R:R {exp.riskRewardRatio || '1:1.5'}
                          </span>
                        </div>
                      </div>

                      {/* Bottom Row: Targets & Safety SL Grid */}
                      <div className={`p-2 rounded border text-[11px] font-mono ${
                        isLight ? 'bg-white border-slate-200' : 'bg-slate-950/60 border-slate-900'
                      }`}>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div>
                            <span className={`text-[9px] block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                              {isNeutral_exp ? 'RESISTANCE 1' : 'TARGET 1'}
                            </span>
                            <strong className="text-emerald-500 dark:text-emerald-400">{ticker.currency}{exp.target1.toFixed(2)}</strong>
                            {exp.target1GainPercent !== undefined && (
                              <div className="text-[9px] text-emerald-600 dark:text-emerald-400">+{exp.target1GainPercent}%</div>
                            )}
                          </div>
                          <div className={isLight ? 'border-x border-slate-200' : 'border-x border-slate-900'}>
                            <span className={`text-[9px] block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                              {isNeutral_exp ? 'RESISTANCE 2' : 'TARGET 2'}
                            </span>
                            <strong className="text-sky-500 dark:text-sky-400">{ticker.currency}{exp.target2.toFixed(2)}</strong>
                            {exp.target2GainPercent !== undefined && (
                              <div className="text-[9px] text-sky-600 dark:text-sky-400">+{exp.target2GainPercent}%</div>
                            )}
                          </div>
                          <div>
                            <span className={`text-[9px] block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                              {isNeutral_exp ? 'SUPPORT SL' : 'SAFETY SL'}
                            </span>
                            <strong className="text-rose-500 dark:text-rose-400">{ticker.currency}{exp.stopLoss.toFixed(2)}</strong>
                            {exp.stopLossRiskPercent !== undefined && (
                              <div className="text-[9px] text-rose-600 dark:text-rose-400">-{exp.stopLossRiskPercent}%</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Informative Footer */}
              <div className={`p-2.5 rounded text-[11px] font-sans flex items-start gap-2 border ${
                isLight ? 'bg-sky-50/60 border-sky-200 text-slate-700' : 'bg-slate-900/40 border-slate-800 text-slate-400'
              }`}>
                <Compass className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Cross-Expiry Intelligence:</strong> Near-weekly options offer maximum directional percentage leverage, while monthly expiries carry lower theta decay per day. Click any row or <strong>Switch</strong> to load that expiry's live option chain and directional trading setup.
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Trade Rationale */}
      <div className="mt-3 p-2.5 sm:p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs leading-relaxed text-slate-300">
        <span className="font-bold text-white mr-1.5">Trade Rationale:</span>
        {signal.summaryNote}
      </div>
    </div>
  );
};
