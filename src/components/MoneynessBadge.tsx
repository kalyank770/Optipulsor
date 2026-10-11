import React from 'react';
import { Moneyness, OptionType } from '../types/options';

/**
 * Calculates whether an option contract strike is ITM, ATM, or OTM
 */
export function getMoneyness(
  strike: number,
  type: OptionType,
  spotPrice: number,
  strikeStep: number = 50
): Moneyness {
  if (Math.abs(strike - spotPrice) <= strikeStep * 0.45) {
    return 'ATM';
  }
  if (type === 'CE') {
    return strike < spotPrice ? 'ITM' : 'OTM';
  } else {
    return strike > spotPrice ? 'ITM' : 'OTM';
  }
}

export function getMoneynessBadgeClasses(moneyness: Moneyness): string {
  switch (moneyness) {
    case 'ITM':
      return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    case 'ATM':
      return 'bg-sky-500/20 text-sky-300 border-sky-500/40';
    case 'OTM':
      return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    default:
      return 'bg-slate-800 text-slate-300 border-slate-700';
  }
}

export function getMoneynessDescription(moneyness: Moneyness): string {
  switch (moneyness) {
    case 'ITM':
      return 'In-The-Money (Strong Intrinsic Value & Delta)';
    case 'ATM':
      return 'At-The-Money (Maximum Gamma & Liquidity)';
    case 'OTM':
      return 'Out-of-The-Money (High Leverage / Pure Extrinsic)';
    default:
      return '';
  }
}

interface MoneynessBadgeProps {
  moneyness: Moneyness;
  className?: string;
  size?: 'xs' | 'sm' | 'md';
  showTooltip?: boolean;
}

export const MoneynessBadge: React.FC<MoneynessBadgeProps> = ({
  moneyness,
  className = '',
  size = 'xs',
  showTooltip = true,
}) => {
  const sizeClasses = 
    size === 'xs'
      ? 'text-[10px] px-1.5 py-0.2'
      : size === 'sm'
      ? 'text-[11px] px-2 py-0.5'
      : 'text-xs px-2.5 py-0.5';

  return (
    <span
      className={`inline-flex items-center font-mono font-bold rounded border uppercase tracking-wider shadow-2xs ${sizeClasses} ${getMoneynessBadgeClasses(moneyness)} ${className}`}
      title={showTooltip ? `${moneyness} · ${getMoneynessDescription(moneyness)}` : undefined}
    >
      {moneyness}
    </span>
  );
};
