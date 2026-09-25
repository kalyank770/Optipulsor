import React, { useState } from 'react';
import { 
  OptionChainRow, 
  TickerConfig 
} from '../types/options';
import { 
  Smartphone, 
  Table2, 
  ArrowUpRight, 
  ArrowDownRight,
  TrendingUp,
  TrendingDown
} from 'lucide-react';

interface OptionChainTableProps {
  rows: OptionChainRow[];
  ticker: TickerConfig;
  recommendedStrike?: number;
  recommendedType?: 'CE' | 'PE';
  maxPainStrike: number;
  onSelectContract: (strike: number, type: 'CE' | 'PE') => void;
  onSetManualContractLtp?: (strike: number, type: 'CE' | 'PE', ltp: number) => void;
}

export const OptionChainTable: React.FC<OptionChainTableProps> = ({
  rows,
  ticker,
  recommendedStrike,
  recommendedType,
  maxPainStrike,
  onSelectContract,
  onSetManualContractLtp,
}) => {
  const [mobileMode, setMobileMode] = useState<'compact' | 'matrix'>('compact');

  // Compute max OI in current rows to normalize bar indicators
  const maxOI = Math.max(...rows.flatMap(r => [r.ce.openInterest, r.pe.openInterest]), 1);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-lg overflow-hidden shadow-xl">
      {/* Mobile View Toggle Bar (Visible on mobile screens) */}
      <div className="md:hidden flex items-center justify-between p-2.5 bg-slate-950 border-b border-slate-800 text-xs">
        <span className="font-semibold text-slate-300 flex items-center gap-1.5">
          <span>Option Ladder</span>
          <span className="text-[10px] text-slate-500 font-mono">({rows.length} strikes)</span>
        </span>

        <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded border border-slate-800">
          <button
            onClick={() => setMobileMode('compact')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer min-h-[30px] ${
              mobileMode === 'compact'
                ? 'bg-emerald-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Compact</span>
          </button>
          <button
            onClick={() => setMobileMode('matrix')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer min-h-[30px] ${
              mobileMode === 'matrix'
                ? 'bg-emerald-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Table2 className="w-3.5 h-3.5" />
            <span>Full Matrix</span>
          </button>
        </div>
      </div>

      {/* 1. Mobile Compact Cards View (Designed specifically for small screens) */}
      <div className={`md:hidden ${mobileMode === 'compact' ? 'block' : 'hidden'}`}>
        {/* Compact Column Super-Header */}
        <div className="grid grid-cols-7 bg-slate-950 border-b border-slate-800 text-[11px] font-bold text-center py-2 px-2 select-none">
          <div className="col-span-3 text-emerald-400 flex items-center justify-center gap-1">
            <TrendingUp className="w-3 h-3" />
            <span>CALL (CE)</span>
          </div>
          <div className="col-span-1 text-white">STRIKE</div>
          <div className="col-span-3 text-rose-400 flex items-center justify-center gap-1">
            <TrendingDown className="w-3 h-3" />
            <span>PUT (PE)</span>
          </div>
        </div>

        {/* Compact Strikes List */}
        <div className="divide-y divide-slate-800/80 font-mono text-xs">
          {rows.map(row => {
            const strike = row.strike;
            const isATM = row.isATM;
            const isMaxPain = strike === maxPainStrike;
            const isRecCE = recommendedType === 'CE' && recommendedStrike === strike;
            const isRecPE = recommendedType === 'PE' && recommendedStrike === strike;

            const ceITM = strike < ticker.spotPrice;
            const peITM = strike > ticker.spotPrice;

            return (
              <div 
                key={strike} 
                className={`grid grid-cols-7 items-center p-2 transition-colors ${
                  isATM ? 'bg-amber-500/10' : ''
                }`}
              >
                {/* CE Card: Left 3 columns */}
                <div 
                  onClick={() => onSelectContract(strike, 'CE')}
                  className={`col-span-3 p-1.5 rounded-lg border cursor-pointer active:scale-98 transition-all ${
                    isRecCE 
                      ? 'bg-emerald-950/50 border-emerald-500 ring-1 ring-emerald-500' 
                      : ceITM 
                      ? 'bg-amber-950/20 border-amber-900/40 hover:bg-amber-950/30' 
                      : 'bg-slate-950/60 border-slate-800 hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-emerald-400 tracking-tight">
                      {ticker.currency}{row.ce.ltp.toFixed(2)}
                    </span>
                    <span className={`text-[10px] font-semibold ${row.ce.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {row.ce.change >= 0 ? '+' : ''}{row.ce.changePercent.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                    <span>OI: {(row.ce.openInterest / 1000).toFixed(0)}k</span>
                    <span className="text-slate-500">IV: {row.ce.iv.toFixed(0)}%</span>
                  </div>
                </div>

                {/* Center Strike: 1 column */}
                <div className="col-span-1 flex flex-col items-center justify-center px-1 text-center">
                  <span className={`font-bold text-xs ${isATM ? 'text-amber-300' : 'text-white'}`}>
                    {strike}
                  </span>
                  {isATM && (
                    <span className="text-[8px] font-bold px-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      ATM
                    </span>
                  )}
                  {isMaxPain && !isATM && (
                    <span className="text-[8px] font-bold px-1 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40">
                      PAIN
                    </span>
                  )}
                </div>

                {/* PE Card: Right 3 columns */}
                <div 
                  onClick={() => onSelectContract(strike, 'PE')}
                  className={`col-span-3 p-1.5 rounded-lg border cursor-pointer active:scale-98 transition-all ${
                    isRecPE 
                      ? 'bg-rose-950/50 border-rose-500 ring-1 ring-rose-500' 
                      : peITM 
                      ? 'bg-amber-950/20 border-amber-900/40 hover:bg-amber-950/30' 
                      : 'bg-slate-950/60 border-slate-800 hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-semibold ${row.pe.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {row.pe.change >= 0 ? '+' : ''}{row.pe.changePercent.toFixed(1)}%
                    </span>
                    <span className="text-sm font-bold text-rose-400 tracking-tight">
                      {ticker.currency}{row.pe.ltp.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                    <span className="text-slate-500">IV: {row.pe.iv.toFixed(0)}%</span>
                    <span>OI: {(row.pe.openInterest / 1000).toFixed(0)}k</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Full 15-Column Institutional Matrix Table (Always on desktop, switchable on mobile) */}
      <div className={`overflow-x-auto ${mobileMode === 'compact' ? 'hidden md:block' : 'block'}`}>
        <table className="w-full text-xs font-mono tabular-nums border-collapse select-none">
          <thead>
            {/* Top Super-header */}
            <tr className="border-b border-slate-800 bg-slate-950 text-slate-300">
              <th colSpan={7} className="py-2.5 px-3 text-center font-bold tracking-wider text-emerald-400 border-r border-slate-800 uppercase bg-emerald-950/20">
                CALL OPTIONS (CE)
              </th>
              <th className="py-2.5 px-4 text-center font-bold tracking-wider text-white bg-slate-900 uppercase">
                STRIKE
              </th>
              <th colSpan={7} className="py-2.5 px-3 text-center font-bold tracking-wider text-rose-400 border-l border-slate-800 uppercase bg-rose-950/20">
                PUT OPTIONS (PE)
              </th>
            </tr>
            {/* Column Headers */}
            <tr className="border-b border-slate-800 bg-slate-950/80 text-[11px] text-slate-400">
              {/* CE Columns */}
              <th className="py-2 px-2 text-right">OI</th>
              <th className="py-2 px-2 text-right">Chg OI</th>
              <th className="py-2 px-2 text-right">Volume</th>
              <th className="py-2 px-2 text-right">IV%</th>
              <th className="py-2 px-2 text-right">Delta</th>
              <th className="py-2 px-2 text-right">Theta</th>
              <th className="py-2 px-3 text-right font-bold text-slate-200 border-r border-slate-800">LTP</th>

              {/* Center Strike */}
              <th className="py-2 px-4 text-center font-bold text-white bg-slate-900/90">
                Strike
              </th>

              {/* PE Columns */}
              <th className="py-2 px-3 text-left font-bold text-slate-200 border-l border-slate-800">LTP</th>
              <th className="py-2 px-2 text-left">Theta</th>
              <th className="py-2 px-2 text-left">Delta</th>
              <th className="py-2 px-2 text-left">IV%</th>
              <th className="py-2 px-2 text-left">Volume</th>
              <th className="py-2 px-2 text-left">Chg OI</th>
              <th className="py-2 px-2 text-left">OI</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300">
            {rows.map(row => {
              const strike = row.strike;
              const isATM = row.isATM;
              const isMaxPain = strike === maxPainStrike;
              const isRecCE = recommendedType === 'CE' && recommendedStrike === strike;
              const isRecPE = recommendedType === 'PE' && recommendedStrike === strike;

              // ITM conditions:
              const ceITM = strike < ticker.spotPrice;
              const peITM = strike > ticker.spotPrice;

              const ceBarWidth = Math.min(100, (row.ce.openInterest / maxOI) * 100);
              const peBarWidth = Math.min(100, (row.pe.openInterest / maxOI) * 100);

              return (
                <tr 
                  key={strike}
                  className={`transition-colors group hover:bg-slate-800/40 ${
                    isATM ? 'bg-amber-500/5 font-medium' : ''
                  }`}
                >
                  {/* CE: Open Interest */}
                  <td 
                    onClick={() => onSelectContract(strike, 'CE')}
                    className={`py-2 px-2 text-right relative cursor-pointer ${
                      ceITM ? 'bg-amber-950/15' : ''
                    }`}
                  >
                    <div 
                      className="absolute right-0 top-1 bottom-1 bg-emerald-500/10 pointer-events-none rounded-l"
                      style={{ width: `${ceBarWidth}%` }}
                    />
                    <span className="relative z-10 text-slate-300">
                      {row.ce.openInterest.toLocaleString()}
                    </span>
                  </td>

                  {/* CE: Chg OI */}
                  <td 
                    onClick={() => onSelectContract(strike, 'CE')}
                    className={`py-2 px-2 text-right cursor-pointer ${
                      ceITM ? 'bg-amber-950/15' : ''
                    } ${
                      row.ce.oiChange >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {row.ce.oiChange >= 0 ? '+' : ''}{row.ce.oiChange.toLocaleString()}
                  </td>

                  {/* CE: Volume */}
                  <td 
                    onClick={() => onSelectContract(strike, 'CE')}
                    className={`py-2 px-2 text-right text-slate-400 cursor-pointer ${
                      ceITM ? 'bg-amber-950/15' : ''
                    }`}
                  >
                    {row.ce.volume.toLocaleString()}
                  </td>

                  {/* CE: IV% */}
                  <td 
                    onClick={() => onSelectContract(strike, 'CE')}
                    className={`py-2 px-2 text-right text-slate-400 cursor-pointer ${
                      ceITM ? 'bg-amber-950/15' : ''
                    }`}
                  >
                    {row.ce.iv.toFixed(1)}%
                  </td>

                  {/* CE: Delta */}
                  <td 
                    onClick={() => onSelectContract(strike, 'CE')}
                    className={`py-2 px-2 text-right text-slate-400 cursor-pointer ${
                      ceITM ? 'bg-amber-950/15' : ''
                    }`}
                  >
                    {row.ce.greeks.delta.toFixed(2)}
                  </td>

                  {/* CE: Theta */}
                  <td 
                    onClick={() => onSelectContract(strike, 'CE')}
                    className={`py-2 px-2 text-right text-rose-400/80 cursor-pointer ${
                      ceITM ? 'bg-amber-950/15' : ''
                    }`}
                  >
                    {row.ce.greeks.theta.toFixed(1)}
                  </td>

                  {/* CE: LTP */}
                  <td 
                    onClick={() => onSelectContract(strike, 'CE')}
                    className={`py-2 px-3 text-right font-bold border-r border-slate-800 cursor-pointer ${
                      ceITM ? 'bg-amber-950/20 text-emerald-300' : 'text-emerald-400'
                    } ${isRecCE ? 'ring-2 ring-emerald-500 bg-emerald-950/40' : ''}`}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>{ticker.currency}{row.ce.ltp.toFixed(2)}</span>
                      <span className={`text-[10px] font-normal ${
                        row.ce.change >= 0 ? 'text-emerald-500' : 'text-rose-500'
                      }`}>
                        ({row.ce.change >= 0 ? '+' : ''}{row.ce.changePercent.toFixed(1)}%)
                      </span>
                    </div>
                  </td>

                  {/* CENTER: STRIKE PRICE */}
                  <td className={`py-2 px-4 text-center font-bold text-sm bg-slate-950 relative ${
                    isATM ? 'text-amber-300 bg-amber-950/30' : 'text-white'
                  }`}>
                    <div className="flex items-center justify-center gap-1.5">
                      <span>{strike.toLocaleString()}</span>
                      {isATM && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
                          ATM
                        </span>
                      )}
                      {isMaxPain && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40 font-mono" title="Max Pain Strike">
                          PAIN
                        </span>
                      )}
                    </div>
                  </td>

                  {/* PE: LTP */}
                  <td 
                    onClick={() => onSelectContract(strike, 'PE')}
                    className={`py-2 px-3 text-left font-bold border-l border-slate-800 cursor-pointer ${
                      peITM ? 'bg-amber-950/20 text-rose-300' : 'text-rose-400'
                    } ${isRecPE ? 'ring-2 ring-rose-500 bg-rose-950/40' : ''}`}
                  >
                    <div className="flex items-center justify-start gap-1">
                      <span>{ticker.currency}{row.pe.ltp.toFixed(2)}</span>
                      <span className={`text-[10px] font-normal ${
                        row.pe.change >= 0 ? 'text-emerald-500' : 'text-rose-500'
                      }`}>
                        ({row.pe.change >= 0 ? '+' : ''}{row.pe.changePercent.toFixed(1)}%)
                      </span>
                    </div>
                  </td>

                  {/* PE: Theta */}
                  <td 
                    onClick={() => onSelectContract(strike, 'PE')}
                    className={`py-2 px-2 text-left text-rose-400/80 cursor-pointer ${
                      peITM ? 'bg-amber-950/15' : ''
                    }`}
                  >
                    {row.pe.greeks.theta.toFixed(1)}
                  </td>

                  {/* PE: Delta */}
                  <td 
                    onClick={() => onSelectContract(strike, 'PE')}
                    className={`py-2 px-2 text-left text-slate-400 cursor-pointer ${
                      peITM ? 'bg-amber-950/15' : ''
                    }`}
                  >
                    {row.pe.greeks.delta.toFixed(2)}
                  </td>

                  {/* PE: IV% */}
                  <td 
                    onClick={() => onSelectContract(strike, 'PE')}
                    className={`py-2 px-2 text-left text-slate-400 cursor-pointer ${
                      peITM ? 'bg-amber-950/15' : ''
                    }`}
                  >
                    {row.pe.iv.toFixed(1)}%
                  </td>

                  {/* PE: Volume */}
                  <td 
                    onClick={() => onSelectContract(strike, 'PE')}
                    className={`py-2 px-2 text-left text-slate-400 cursor-pointer ${
                      peITM ? 'bg-amber-950/15' : ''
                    }`}
                  >
                    {row.pe.volume.toLocaleString()}
                  </td>

                  {/* PE: Chg OI */}
                  <td 
                    onClick={() => onSelectContract(strike, 'PE')}
                    className={`py-2 px-2 text-left cursor-pointer ${
                      peITM ? 'bg-amber-950/15' : ''
                    } ${
                      row.pe.oiChange >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {row.pe.oiChange >= 0 ? '+' : ''}{row.pe.oiChange.toLocaleString()}
                  </td>

                  {/* PE: Open Interest */}
                  <td 
                    onClick={() => onSelectContract(strike, 'PE')}
                    className={`py-2 px-2 text-left relative cursor-pointer ${
                      peITM ? 'bg-amber-950/15' : ''
                    }`}
                  >
                    <div 
                      className="absolute left-0 top-1 bottom-1 bg-rose-500/10 pointer-events-none rounded-r"
                      style={{ width: `${peBarWidth}%` }}
                    />
                    <span className="relative z-10 text-slate-300">
                      {row.pe.openInterest.toLocaleString()}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
