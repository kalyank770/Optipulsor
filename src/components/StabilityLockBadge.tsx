import React from 'react';
import { SignalStabilityLock, SignalAction } from '../types/options';

interface StabilityLockBadgeProps {
  stabilityLock?: SignalStabilityLock;
  action?: SignalAction;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
  showTooltipOnClick?: boolean;
}

export const StabilityLockBadge: React.FC<StabilityLockBadgeProps> = () => {
  // Stability lock and timer are removed per request.
  // Trade recommendations now update dynamically in real time as per live metrics.
  return null;
};
