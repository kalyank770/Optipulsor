import React, { useState, useEffect, useRef } from 'react';
import { 
  TradeSignal, 
  TickerConfig, 
  MarketMetrics,
  OptionChainRow
} from '../types/options';
import { AfterMarketOpeningCard } from './AfterMarketOpeningCard';
import { PredictionValidationCard } from './PredictionValidationCard';
import { MarketHoursStatus } from '../utils/marketHours';
import { NSE_CROSS_EXPIRY_22900_QUOTES, resolveNextExpiryContractQuote } from '../data/officialNseQuotes';
import { AdvanceTradeCard } from './AdvanceTradeCard';
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
  ChevronUp,
  Power,
  Calendar,
  Clock,
  FileCheck2
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
  usePreMarket?: boolean;
  onTogglePreMarket?: () => void;
  marketStatus?: MarketHoursStatus;
  onSelectTab?: (tab: string) => void;
  giftNiftyLastSynced?: Date;
  isGiftNiftySyncing?: boolean;
  onRefreshGiftNifty?: () => void;
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
  usePreMarket = false,
  onTogglePreMarket,
  marketStatus,
  onSelectTab,
  giftNiftyLastSynced,
  isGiftNiftySyncing = false,
  onRefreshGiftNifty,
}) => {
  const isLight = theme === 'light';
  const [copied, setCopied] = useState(false);
  const [lots, setLots] = useState<number>(1);
  const [priceFlash, setPriceFlash] = useState<'UP' | 'DOWN' | null>(null);

  const advSetup = signal.advanceTradeSetup;
  const isAdvActive = Boolean(marketStatus?.isOpen && advSetup && advSetup.anticipatedAction !== 'WAIT_NEUTRAL');

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

  const activeAction = isAdvActive && advSetup ? advSetup.anticipatedAction : signal.action;
  const isCE = activeAction === 'BUY_CE';
  const isPE = activeAction === 'BUY_PE';
  const isNeutral = activeAction === 'WAIT_NEUTRAL';

  // Find live contract quote directly from the option chain
  const recommendedRow = chain?.find(r => r.strike === signal.recommendedStrike);
  const liveContract = signal.recommendedType === 'CE' ? recommendedRow?.ce : recommendedRow?.pe;

  // Active trade contract resolution:
  // When market is closed (After-Market mode) and current contract has expired/settled at <= 0.05:
  // Dynamically resolve exact contract quote for target strike (e.g. 22850 CE) on active tradeable next expiry (13-Oct-2026)
  const isAfterMarket = !marketStatus?.isOpen;
  const isCurrentContractExpired = liveContract && liveContract.ltp <= 0.05;

  const nextExpiryQuote = ticker.symbol.includes('NIFTY')
    ? resolveNextExpiryContractQuote(signal.recommendedStrike, signal.recommendedType, 1, ticker.spotPrice)
    : undefined;

  const shouldUseNextExpiry = isAfterMarket && (isCurrentContractExpired || !liveContract || (liveContract && liveContract.ltp <= 0.05));

  const currentLTP = shouldUseNextExpiry
    ? (nextExpiryQuote ? nextExpiryQuote.ltp : (signal.recommendedContractLTP > 0.05 ? signal.recommendedContractLTP : 108.50))
    : (liveContract?.ltp ?? signal.recommendedContractLTP);

  const displayContractChange = shouldUseNextExpiry
    ? (nextExpiryQuote ? nextExpiryQuote.change : 19.00)
    : (liveContract?.change ?? 0);

  const displayContractChangePercent = shouldUseNextExpiry
    ? (nextExpiryQuote ? nextExpiryQuote.changePercent : 22.80)
    : (liveContract?.changePercent ?? 0);

  const displayBidPrice = shouldUseNextExpiry
    ? (nextExpiryQuote ? nextExpiryQuote.bid : Number((currentLTP * 0.992).toFixed(2)))
    : (liveContract?.bidPrice ?? 0);

  const displayAskPrice = shouldUseNextExpiry
    ? (nextExpiryQuote ? nextExpiryQuote.ask : Number((currentLTP * 1.008).toFixed(2)))
    : (liveContract?.askPrice ?? 0);

  const displayExpiryDate = shouldUseNextExpiry
    ? (nextExpiryQuote?.expiryDate || ticker.expiryDates?.[1] || '13-Oct-2026')
    : (ticker.expiryDates?.[0] || '06-Oct-2026');

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
  const entryLTP = signal.recommendedContractLTP || currentLTP;
  const isTarget1Achieved = currentLTP >= target1;
  const t1Points = isTarget1Achieved 
    ? Number((target1 - entryLTP).toFixed(2)) 
    : Number((target1 - currentLTP).toFixed(2));
  const t1ProfitTotal = Number((t1Points * totalQty).toFixed(2));
  const t1ProfitPct = Number((((target1 - entryLTP) / Math.max(entryLTP, 0.05)) * 100).toFixed(1));

  // Real-time Target 2 P&L calculation
  const target2 = signal.target2;
  const isTarget2Achieved = currentLTP >= target2;
  const t2Points = isTarget2Achieved 
    ? Number((target2 - entryLTP).toFixed(2)) 
    : Number((target2 - currentLTP).toFixed(2));
  const t2ProfitTotal = Number((t2Points * totalQty).toFixed(2));
  const t2ProfitPct = Number((((target2 - entryLTP) / Math.max(entryLTP, 0.05)) * 100).toFixed(1));

  // Real-time Stop Loss P&L calculation
  const stopLoss = signal.stopLoss;
  const slRiskPoints = Math.max(0, Number((currentLTP - stopLoss).toFixed(2)));
  const slLossTotal = Number((slRiskPoints * totalQty).toFixed(2));
  const slLossPct = Number((((entryLTP - stopLoss) / Math.max(entryLTP, 0.05)) * 100).toFixed(1));

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
      {/* Primary Institutional Early-Anticipation Recommendation Card */}
      {signal.advanceTradeSetup && (
        <div>
          <AdvanceTradeCard
            setup={signal.advanceTradeSetup}
            signal={signal}
            ticker={ticker}
            metrics={metrics}
            chain={chain}
            marketStatus={marketStatus}
            usePreMarket={usePreMarket}
            onTogglePreMarket={onTogglePreMarket}
            onSelectContractForSimulation={onSelectContractForSimulation}
            onSelectTab={onSelectTab}
            theme={theme}
            isCompact={false}
          />
        </div>
      )}

      {/* Closing Auction (CAS · 3:30 - 3:40 PM) Notice */}
      {marketStatus?.isCasSession && (
        <div className="mt-3 px-3.5 py-2.5 rounded-lg bg-amber-950/30 border border-amber-500/40 text-amber-200 text-xs flex items-center justify-between gap-3 flex-wrap font-sans">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
            <div>
              <span className="font-bold text-amber-300">Closing Auction (CAS · 3:30–3:40 PM): </span>
              <span className="text-slate-300 text-xs">Continuous F&amp;O closed. Final settlement price being discovered.</span>
            </div>
          </div>
          <span className="text-[11px] font-mono text-amber-300 px-2 py-0.5 rounded bg-amber-900/60 border border-amber-500/30 shrink-0">
            Settles at 3:40 PM
          </span>
        </div>
      )}

      {/* Dynamic Trade Lifecycle & Institutional Trade Intelligence Banner */}
      {!signal.afterMarketAnalytics && (() => {
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
                  <span>Flow: {signal.realtimeIndicators?.orderFlow?.sentiment?.replace(/_/g, ' ') || 'Order Flow Dominance'}</span>
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
          if (signal.sidewaysMarketAnalysis?.isSideways) {
            const sw = signal.sidewaysMarketAnalysis;
            return (
              <div className="mt-3 p-3.5 rounded-xl bg-gradient-to-br from-amber-950/40 via-slate-900/90 to-amber-950/20 border border-amber-500/40 text-amber-200 text-xs shadow-lg space-y-3 font-sans">
                {/* Header Title & Regime Type */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/25 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                      <ShieldAlert className="w-4 h-4 text-amber-400" />
                    </div>
                    <div>
                      <div className="font-bold text-amber-300 text-xs sm:text-sm flex items-center gap-2 flex-wrap">
                        <span>⏸️ Active Scenario: Sideways Range-Bound Equilibrium</span>
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-normal">
                          {sw.regimeType.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <span className="text-[11px] text-amber-200/80 font-mono">
                        Theta Decay Market · Both CE & PE Option Buying Strictly Prohibited
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className="text-slate-400 text-[11px]">Sideways Confidence:</span>
                    <span className="font-bold text-amber-300 px-2 py-0.5 rounded bg-amber-950 border border-amber-500/30">
                      {sw.sidewaysConfidence}%
                    </span>
                  </div>
                </div>

                {/* 4-Box Range Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
                  <div className="p-2 rounded-lg bg-slate-900/90 border border-rose-500/30">
                    <span className="text-[10px] text-slate-400 uppercase block font-sans">🛑 Resistance Ceiling</span>
                    <span className="text-sm font-extrabold text-rose-400 block mt-0.5">
                      {ticker.currency}{sw.rangeCeiling.toLocaleString()}
                    </span>
                    <span className="text-[9.5px] text-slate-400 block truncate">Major Call Wall</span>
                  </div>

                  <div className="p-2 rounded-lg bg-slate-900/90 border border-amber-500/30">
                    <span className="text-[10px] text-slate-400 uppercase block font-sans">🎯 Range Pin Strike</span>
                    <span className="text-sm font-extrabold text-amber-300 block mt-0.5">
                      {ticker.currency}{sw.rangePinStrike.toLocaleString()}
                    </span>
                    <span className="text-[9.5px] text-slate-400 block truncate">Max Pain / ATM Center</span>
                  </div>

                  <div className="p-2 rounded-lg bg-slate-900/90 border border-emerald-500/30">
                    <span className="text-[10px] text-slate-400 uppercase block font-sans">🛡️ Support Floor</span>
                    <span className="text-sm font-extrabold text-emerald-400 block mt-0.5">
                      {ticker.currency}{sw.rangeFloor.toLocaleString()}
                    </span>
                    <span className="text-[9.5px] text-slate-400 block truncate">Major Put Wall</span>
                  </div>

                  <div className="p-2 rounded-lg bg-slate-900/90 border border-sky-500/30">
                    <span className="text-[10px] text-slate-400 uppercase block font-sans">📏 Range Span</span>
                    <span className="text-sm font-extrabold text-sky-400 block mt-0.5">
                      {sw.rangeSpanPoints} pts
                    </span>
                    <span className="text-[9.5px] text-slate-400 block truncate">{sw.compressionPercentage}% Volatility Squeeze</span>
                  </div>
                </div>

                {/* Compression Progress Bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-mono text-amber-200/90">
                    <span>Range Compression Level</span>
                    <span className="font-bold text-amber-300">{sw.compressionPercentage}% Compressed (Low Realized Volatility)</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-amber-500 to-rose-500 rounded-full transition-all duration-500"
                      style={{ width: `${sw.compressionPercentage}%` }}
                    />
                  </div>
                </div>

                {/* Diagnostic Reasons (Why it is Sideways Today) */}
                <div className="space-y-1.5 pt-1 border-t border-amber-500/20">
                  <span className="text-[11px] font-bold text-white uppercase tracking-wider block font-mono">
                    Why Today's Market Is Sideways:
                  </span>
                  <ul className="space-y-1 text-slate-300 text-xs">
                    {sw.reasons.map((r, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-amber-400 mt-0.5 font-bold">•</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Option Buyer vs Option Seller Playbook */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1 border-t border-amber-500/20">
                  <div className="p-2 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-200">
                    <div className="font-bold text-rose-300 text-xs flex items-center gap-1 font-mono">
                      <span>🚫 Option Buyer Warning:</span>
                    </div>
                    <p className="text-[11px] text-rose-200/90 mt-1 leading-snug">
                      {sw.optionBuyerStrategy}
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-200">
                    <div className="font-bold text-emerald-300 text-xs flex items-center gap-1 font-mono">
                      <span>💼 Option Seller / Hedger Strategy:</span>
                    </div>
                    <p className="text-[11px] text-emerald-200/90 mt-1 leading-snug">
                      {sw.optionSellerStrategy}
                    </p>
                  </div>
                </div>

                {/* Breakout Watch Triggers & Power Hour Note */}
                <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-700/80 text-[11px] font-mono flex flex-wrap items-center justify-between gap-2 text-slate-300">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-slate-400 font-sans">Breakout Triggers:</span>
                    <span className="text-emerald-400 font-bold">Bullish: Spot &gt; {ticker.currency}{sw.breakoutWatchLevels.bullishBreakoutTrigger}</span>
                    <span className="text-slate-500">|</span>
                    <span className="text-rose-400 font-bold">Bearish: Spot &lt; {ticker.currency}{sw.breakoutWatchLevels.bearishBreakdownTrigger}</span>
                  </div>
                  <span className="text-amber-300/90 text-[10px] font-sans">
                    ⏰ {sw.breakoutWatchLevels.powerHourNote}
                  </span>
                </div>
              </div>
            );
          }

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
                  <span>⚡ Active Entry Signal</span>
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">
                  R:R {signal.riskRewardRatio}
                </span>
              </div>
              <p className="text-emerald-200/90 text-xs leading-relaxed">
                <strong>Catalyst & Confluence:</strong> {signal.candleAnalysis?.confluencePattern || 'Multi-timeframe 2m/5m/15m momentum alignment'} · {signal.realtimeIndicators?.orderFlow?.sentiment?.replace(/_/g, ' ') || 'Order Flow Dominance'}.
              </p>
              <div className="pt-1 text-[11px] text-emerald-300/80 border-t border-emerald-500/20 flex flex-wrap items-center justify-between gap-2 font-mono">
                <span>Rule: Enter on 5m candle close confirmation · Max 1-2% risk</span>
                <span>Action: Scale 50% at Target 1 · Trail SL to Cost</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* After-Market & Pre-Market Opening Analytics Card */}
      {signal.afterMarketAnalytics && (
        <AfterMarketOpeningCard 
          analytics={signal.afterMarketAnalytics} 
          ticker={ticker} 
          theme={theme}
          giftNiftyLastSynced={giftNiftyLastSynced}
          isGiftNiftySyncing={isGiftNiftySyncing}
          onRefreshGiftNifty={onRefreshGiftNifty}
        />
      )}

      {/* Pre & After-Market Prediction vs Live Opening Validation Engine */}
      <PredictionValidationCard
        ticker={ticker}
        analytics={signal.afterMarketAnalytics}
        signal={signal}
        optionChain={chain || []}
        metrics={metrics}
        marketStatus={marketStatus}
        theme={theme}
      />

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
              {signal.constituentAnalysis.asOnTime && (
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  {signal.constituentAnalysis.asOnTime}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[11px] font-mono">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                signal.constituentAnalysis?.overallHeavyweightBias?.includes('BULLISH') ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' :
                signal.constituentAnalysis?.overallHeavyweightBias?.includes('BEARISH') ? 'bg-rose-500/15 text-rose-300 border-rose-500/30' :
                'bg-amber-500/15 text-amber-300 border-amber-500/30'
              }`}>
                {signal.constituentAnalysis?.overallHeavyweightBias?.replace(/_/g, ' ') || 'Neutral'} ({signal.constituentAnalysis?.breadthScore && signal.constituentAnalysis.breadthScore > 0 ? '+' : ''}{signal.constituentAnalysis?.breadthScore || 0}/10)
              </span>
              <button className="p-1 text-slate-400 hover:text-white" title={expandedSubSections.heavyweights ? "Collapse section" : "Expand section"}>
                {expandedSubSections.heavyweights ? <ChevronUp className="w-4 h-4 text-emerald-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>
            </div>
          </div>

          {expandedSubSections.heavyweights && (
            <div className="p-3 pt-2">
              {/* Summary Note */}
              <div className="mb-2 text-[11px] text-slate-300 bg-slate-900/60 p-2 rounded border border-slate-800 flex items-center justify-between">
                <span>{signal.constituentAnalysis.summaryNote}</span>
                <span className="text-[10px] text-emerald-400 font-mono font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  Live Exchange Feed
                </span>
              </div>

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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs mb-2.5">
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

              {/* All Individual Heavyweight Constituents Live Matrix */}
              {signal.constituentAnalysis.constituents && signal.constituentAnalysis.constituents.length > 0 && (
                <div className="mb-2.5 rounded bg-slate-900/80 border border-slate-800 overflow-hidden">
                  <div className="p-2 bg-slate-950 border-b border-slate-800 text-[11px] font-bold text-slate-300 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <BarChart2 className="w-3.5 h-3.5 text-sky-400" />
                      All Heavyweight Derivative Constituents
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {signal.constituentAnalysis.constituents.length} stocks
                    </span>
                  </div>
                  <div className="overflow-x-auto max-h-56 overflow-y-auto">
                    <table className="w-full text-[11px] font-mono text-left">
                      <thead className="bg-slate-950 text-[10px] text-slate-400 uppercase sticky top-0 border-b border-slate-800">
                        <tr>
                          <th className="p-1.5 pl-2.5">Stock</th>
                          <th className="p-1.5">Sector</th>
                          <th className="p-1.5 text-right">Weight</th>
                          <th className="p-1.5 text-right">LTP (₹)</th>
                          <th className="p-1.5 text-right">Change</th>
                          <th className="p-1.5 text-right">Impact</th>
                          <th className="p-1.5 pr-2.5 text-center">Buildup</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-200">
                        {signal.constituentAnalysis.constituents.map(c => {
                          const isPos = c.change >= 0;
                          return (
                            <tr key={c.symbol} className="hover:bg-slate-800/40 transition-colors">
                              <td className="p-1.5 pl-2.5 font-bold text-white flex items-center gap-1">
                                {c.symbol}
                                <span className="text-[9.5px] text-slate-400 font-sans truncate max-w-[80px]">({c.name})</span>
                              </td>
                              <td className="p-1.5 text-[10px] text-slate-400">{c.sector}</td>
                              <td className="p-1.5 text-right text-slate-300">{c.niftyWeight}%</td>
                              <td className="p-1.5 text-right font-bold">₹{c.spotPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                              <td className={`p-1.5 text-right font-semibold ${isPos ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {isPos ? '+' : ''}{c.change} ({isPos ? '+' : ''}{c.changePercent}%)
                              </td>
                              <td className={`p-1.5 text-right font-bold ${c.niftyContributionPoints >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {c.niftyContributionPoints >= 0 ? '+' : ''}{c.niftyContributionPoints} pts
                              </td>
                              <td className="p-1.5 pr-2.5 text-center">
                                <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-semibold border ${
                                  c.buildup === 'Long Buildup' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' :
                                  c.buildup === 'Short Buildup' ? 'bg-rose-500/10 text-rose-300 border-rose-500/30' :
                                  c.buildup === 'Short Covering' ? 'bg-sky-500/10 text-sky-300 border-sky-500/30' :
                                  'bg-amber-500/10 text-amber-300 border-amber-500/30'
                                }`}>
                                  {c.buildup}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

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

      {/* Trade Rationale */}
      <div className="mt-3 p-2.5 sm:p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs leading-relaxed text-slate-300">
        <span className="font-bold text-white mr-1.5">Trade Rationale:</span>
        {signal.summaryNote}
      </div>
    </div>
  );
};
