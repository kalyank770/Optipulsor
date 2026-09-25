import React from 'react';
import { 
  OptionChainRow, 
  TickerConfig, 
  OptionContract 
} from '../types/options';

interface OptionChainTableProps {
  rows: OptionChainRow[];
  ticker: TickerConfig;
  recommendedStrike?: number;
  recommendedType?: 'CE' | 'PE';
  maxPainStrike: number;
  onSelectContract: (strike: number, type: 'CE' | 'PE') => void;
}

export const OptionChainTable: React.FC<OptionChainTableProps> = ({
  rows,
  ticker,
  recommendedStrike,
  recommendedType,
  maxPainStrike,
  onSelectContract,
}) => {
  // Compute max OI in current rows to normalize bar indicators
  const maxOI = Math.max(...rows.flatMap(r => [r.ce.openInterest, r.pe.openInterest]), 1);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-lg overflow-hidden shadow-xl">
      <div className="overflow-x-auto">
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
              // Calls are ITM when Strike < SpotPrice
              // Puts are ITM when Strike > SpotPrice
              const ceITM = strike < ticker.spotPrice;
              const peITM = strike > ticker.spotPrice;

              const ceBarWidth = Math.min(100, (row.ce.openInterest / maxOI) * 100);
              const peBarWidth = Math.min(100, (row.pe.openInterest / maxOI) * 100);

              const ceFlashClass = 
                row.ce.lastTickDirection === 'up' ? 'animate-flash-up' :
                row.ce.lastTickDirection === 'down' ? 'animate-flash-down' : '';

              const peFlashClass = 
                row.pe.lastTickDirection === 'up' ? 'animate-flash-up' :
                row.pe.lastTickDirection === 'down' ? 'animate-flash-down' : '';

              return (
                <tr 
                  key={strike}
                  className={`transition-colors group hover:bg-slate-800/40 ${
                    isATM ? 'bg-amber-500/5 font-medium' : ''
                  }`}
                >
                  {/* CE: Open Interest with relative bar */}
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
                    } ${isRecCE ? 'ring-2 ring-emerald-500 bg-emerald-950/40' : ''} ${ceFlashClass}`}
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
                    } ${isRecPE ? 'ring-2 ring-rose-500 bg-rose-950/40' : ''} ${peFlashClass}`}
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

                  {/* PE: Open Interest with relative bar */}
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
