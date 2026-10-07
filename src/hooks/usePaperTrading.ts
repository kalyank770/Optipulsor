import { useState, useEffect, useCallback, useMemo } from 'react';
import { PaperPortfolio, PaperTradeOrder } from '../types/paperTrading';
import { TickerConfig, OptionChainRow } from '../types/options';

const STORAGE_KEY = 'optipulse_paper_trading_v2';
const DEFAULT_INITIAL_BALANCE = 1000000; // ₹10,00,000 / $100,000

export interface NewOrderParams {
  tickerSymbol: string;
  underlyingSpot: number;
  strike: number;
  optionType: 'CE' | 'PE' | 'SPOT';
  expiryDate: string;
  orderType: 'BUY' | 'SELL';
  lots: number;
  lotSize: number;
  entryPrice: number;
  stopLoss: number;
  target1: number;
  target2: number;
  trailingSl?: number;
  strategyName?: string;
  notes?: string;
}

// Helper utility to consolidate duplicate open positions using weighted averaging
function consolidateOpenPositions(positions: PaperTradeOrder[]): PaperTradeOrder[] {
  const openMap = new Map<string, PaperTradeOrder>();
  const closedOrOther: PaperTradeOrder[] = [];

  for (const pos of positions) {
    if (pos.status !== 'OPEN') {
      closedOrOther.push(pos);
      continue;
    }

    const key = `${pos.tickerSymbol}_${pos.strike}_${pos.optionType}_${pos.orderType}`;
    if (!openMap.has(key)) {
      openMap.set(key, { ...pos });
    } else {
      const existing = openMap.get(key)!;
      const combinedQty = existing.totalQty + pos.totalQty;
      const combinedLots = existing.lots + pos.lots;
      const avgEntryPrice = Number(
        ((existing.entryPrice * existing.totalQty + pos.entryPrice * pos.totalQty) / combinedQty).toFixed(2)
      );

      const ratioOld = existing.totalQty / combinedQty;
      const ratioNew = pos.totalQty / combinedQty;

      const weightedSl = Number((existing.stopLoss * ratioOld + pos.stopLoss * ratioNew).toFixed(2));
      const weightedTp1 = Number((existing.target1 * ratioOld + pos.target1 * ratioNew).toFixed(2));
      const weightedTp2 = Number((existing.target2 * ratioOld + pos.target2 * ratioNew).toFixed(2));

      const liveLtp = pos.currentLtp > 0 ? pos.currentLtp : existing.currentLtp;
      const priceDiff = pos.orderType === 'BUY' ? liveLtp - avgEntryPrice : avgEntryPrice - liveLtp;
      const unrealizedPnL = Number((priceDiff * combinedQty).toFixed(2));

      openMap.set(key, {
        ...existing,
        lots: combinedLots,
        totalQty: combinedQty,
        entryPrice: avgEntryPrice,
        currentLtp: liveLtp,
        stopLoss: weightedSl,
        target1: weightedTp1,
        target2: weightedTp2,
        unrealizedPnL,
        notes: `Averaged position (${combinedLots} lots @ avg ₹${avgEntryPrice})`
      });
    }
  }

  return [...Array.from(openMap.values()), ...closedOrOther];
}

export function usePaperTrading(currentTicker?: TickerConfig, chain?: OptionChainRow[]) {
  const [portfolio, setPortfolio] = useState<PaperPortfolio>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.availableCash === 'number') {
          // Consolidate any duplicate open positions from previous storage
          if (Array.isArray(parsed.openPositions)) {
            parsed.openPositions = consolidateOpenPositions(parsed.openPositions);
          }
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load paper trading portfolio from storage', e);
    }
    return {
      initialBalance: DEFAULT_INITIAL_BALANCE,
      availableCash: DEFAULT_INITIAL_BALANCE,
      usedMargin: 0,
      totalRealizedPnL: 0,
      openPositions: [],
      closedTrades: [],
    };
  });

  const [autoExecuteStopLoss, setAutoExecuteStopLoss] = useState<boolean>(true);
  const [lastNotification, setLastNotification] = useState<string | null>(null);

  // Save to LocalStorage whenever portfolio changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(portfolio));
    } catch (e) {
      console.error('Failed to save paper trading portfolio', e);
    }
  }, [portfolio]);

  // Recalculate live prices & unrealized P&L for open positions when market ticks arrive
  useEffect(() => {
    if (!currentTicker || !chain || portfolio.openPositions.length === 0) return;

    setPortfolio(prev => {
      let updatedPositions = false;
      const newOpenPositions: PaperTradeOrder[] = [];
      const autoClosedTrades: PaperTradeOrder[] = [];
      let totalUsedMargin = 0;

      for (const pos of prev.openPositions) {
        // Only update live LTP if symbol matches current ticker or option chain contains strike
        if (pos.tickerSymbol === currentTicker.symbol) {
          let liveLtp = pos.currentLtp;

          if (pos.optionType === 'SPOT') {
            liveLtp = currentTicker.spotPrice;
          } else {
            const row = chain.find(r => r.strike === pos.strike);
            if (row) {
              const contract = pos.optionType === 'CE' ? row.ce : row.pe;
              if (contract && contract.ltp > 0) {
                liveLtp = contract.ltp;
              }
            }
          }

          // Compute Unrealized P&L
          // For BUY: (currentLtp - entryPrice) * totalQty
          // For SELL: (entryPrice - currentLtp) * totalQty
          const priceDiff = pos.orderType === 'BUY' 
            ? liveLtp - pos.entryPrice 
            : pos.entryPrice - liveLtp;
          const unrealizedPnL = Number((priceDiff * pos.totalQty).toFixed(2));

          // Check Auto SL/Target execution if enabled
          let shouldAutoClose = false;
          let closeReason: PaperTradeOrder['exitReason'] = undefined;
          let exitPrice = liveLtp;

          if (autoExecuteStopLoss) {
            if (pos.orderType === 'BUY') {
              if (pos.stopLoss > 0 && liveLtp <= pos.stopLoss) {
                shouldAutoClose = true;
                closeReason = 'SL_HIT';
                exitPrice = pos.stopLoss;
              } else if (pos.target2 > 0 && liveLtp >= pos.target2) {
                shouldAutoClose = true;
                closeReason = 'TARGET_2_HIT';
                exitPrice = pos.target2;
              } else if (pos.target1 > 0 && liveLtp >= pos.target1 && !pos.notes?.includes('T1_HIT_NOTIFIED')) {
                // Non-intrusive notification when target 1 is hit
                setLastNotification(`🎯 Target 1 Achieved for ${pos.tickerSymbol} ${pos.strike} ${pos.optionType} @ ₹${liveLtp}`);
              }
            } else {
              // SELL Order
              if (pos.stopLoss > 0 && liveLtp >= pos.stopLoss) {
                shouldAutoClose = true;
                closeReason = 'SL_HIT';
                exitPrice = pos.stopLoss;
              } else if (pos.target2 > 0 && liveLtp <= pos.target2) {
                shouldAutoClose = true;
                closeReason = 'TARGET_2_HIT';
                exitPrice = pos.target2;
              }
            }
          }

          if (shouldAutoClose) {
            updatedPositions = true;
            const realizedPnL = Number((
              (pos.orderType === 'BUY' ? exitPrice - pos.entryPrice : pos.entryPrice - exitPrice) * pos.totalQty
            ).toFixed(2));

            const closedPos: PaperTradeOrder = {
              ...pos,
              currentLtp: exitPrice,
              status: 'CLOSED',
              exitTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              exitPrice,
              exitReason: closeReason,
              realizedPnL,
              unrealizedPnL: 0
            };
            autoClosedTrades.push(closedPos);
            setLastNotification(`⚡ Auto Position Square-Off: ${pos.tickerSymbol} ${pos.strike} ${pos.optionType} (${closeReason}) | P&L: ₹${realizedPnL.toLocaleString()}`);
            continue;
          }

          if (liveLtp !== pos.currentLtp || unrealizedPnL !== pos.unrealizedPnL) {
            updatedPositions = true;
          }

          const marginForPos = pos.entryPrice * pos.totalQty;
          totalUsedMargin += marginForPos;

          newOpenPositions.push({
            ...pos,
            currentLtp: liveLtp,
            unrealizedPnL
          });
        } else {
          // Different ticker position
          const marginForPos = pos.entryPrice * pos.totalQty;
          totalUsedMargin += marginForPos;
          newOpenPositions.push(pos);
        }
      }

      if (!updatedPositions && autoClosedTrades.length === 0) {
        return prev;
      }

      // Compute newly released margin and realized P&L from auto-closed trades
      let releasedMargin = 0;
      let newRealizedPnLDelta = 0;
      for (const closed of autoClosedTrades) {
        releasedMargin += closed.entryPrice * closed.totalQty;
        newRealizedPnLDelta += closed.realizedPnL || 0;
      }

      return {
        ...prev,
        availableCash: Number((prev.availableCash + releasedMargin + newRealizedPnLDelta).toFixed(2)),
        usedMargin: Number(totalUsedMargin.toFixed(2)),
        totalRealizedPnL: Number((prev.totalRealizedPnL + newRealizedPnLDelta).toFixed(2)),
        openPositions: newOpenPositions,
        closedTrades: [...autoClosedTrades, ...prev.closedTrades]
      };
    });
  }, [currentTicker, chain, autoExecuteStopLoss]);

  // Execute a new Paper Order
  const executeOrder = useCallback((params: NewOrderParams): { success: boolean; message: string } => {
    const totalQty = Math.max(1, params.lots) * params.lotSize;
    const requiredMargin = params.entryPrice * totalQty;

    if (requiredMargin <= 0) {
      return { success: false, message: 'Invalid price or lot quantity.' };
    }

    if (portfolio.availableCash < requiredMargin) {
      return { 
        success: false, 
        message: `Insufficient margin. Required: ${currentTicker?.currency || '₹'}${requiredMargin.toLocaleString()} | Available: ${currentTicker?.currency || '₹'}${portfolio.availableCash.toLocaleString()}` 
      };
    }

    setPortfolio(prev => {
      const existingIndex = prev.openPositions.findIndex(
        p =>
          p.status === 'OPEN' &&
          p.tickerSymbol === params.tickerSymbol &&
          p.strike === params.strike &&
          p.optionType === params.optionType &&
          p.orderType === params.orderType
      );

      const newAvailableCash = Number((prev.availableCash - requiredMargin).toFixed(2));
      const newUsedMargin = Number((prev.usedMargin + requiredMargin).toFixed(2));

      if (existingIndex !== -1) {
        // Average into existing open position
        const existingPos = prev.openPositions[existingIndex];
        const combinedQty = existingPos.totalQty + totalQty;
        const combinedLots = existingPos.lots + Math.max(1, params.lots);
        
        // Weighted Average Price Calculation
        const avgEntryPrice = Number(
          ((existingPos.entryPrice * existingPos.totalQty + params.entryPrice * totalQty) / combinedQty).toFixed(2)
        );

        const ratioOld = existingPos.totalQty / combinedQty;
        const ratioNew = totalQty / combinedQty;

        const weightedSl = Number((existingPos.stopLoss * ratioOld + params.stopLoss * ratioNew).toFixed(2));
        const weightedTp1 = Number((existingPos.target1 * ratioOld + params.target1 * ratioNew).toFixed(2));
        const weightedTp2 = Number((existingPos.target2 * ratioOld + params.target2 * ratioNew).toFixed(2));

        const liveLtp = existingPos.currentLtp > 0 ? existingPos.currentLtp : params.entryPrice;
        const priceDiff = existingPos.orderType === 'BUY' ? liveLtp - avgEntryPrice : avgEntryPrice - liveLtp;
        const unrealizedPnL = Number((priceDiff * combinedQty).toFixed(2));

        const updatedPosition: PaperTradeOrder = {
          ...existingPos,
          lots: combinedLots,
          totalQty: combinedQty,
          entryPrice: avgEntryPrice,
          currentLtp: liveLtp,
          stopLoss: weightedSl,
          target1: weightedTp1,
          target2: weightedTp2,
          unrealizedPnL,
          notes: `Averaged position (${combinedLots} lots @ avg ₹${avgEntryPrice})`
        };

        const updatedPositions = [...prev.openPositions];
        updatedPositions[existingIndex] = updatedPosition;

        return {
          ...prev,
          availableCash: newAvailableCash,
          usedMargin: newUsedMargin,
          openPositions: updatedPositions
        };
      } else {
        // Create new position entry
        const newOrder: PaperTradeOrder = {
          id: 'paper_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          tickerSymbol: params.tickerSymbol,
          underlyingSpot: params.underlyingSpot,
          strike: params.strike,
          optionType: params.optionType,
          expiryDate: params.expiryDate,
          orderType: params.orderType,
          lots: Math.max(1, params.lots),
          lotSize: params.lotSize,
          totalQty,
          entryPrice: params.entryPrice,
          currentLtp: params.entryPrice,
          stopLoss: params.stopLoss,
          target1: params.target1,
          target2: params.target2,
          trailingSl: params.trailingSl,
          entryTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          status: 'OPEN',
          unrealizedPnL: 0,
          strategyName: params.strategyName || 'OptiPulse AI Trade',
          notes: params.notes
        };

        return {
          ...prev,
          availableCash: newAvailableCash,
          usedMargin: newUsedMargin,
          openPositions: [newOrder, ...prev.openPositions]
        };
      }
    });

    setLastNotification(
      `✅ Position Updated: ${params.orderType} ${params.lots} Lot(s) ${params.tickerSymbol} ${params.strike} ${params.optionType} @ ₹${params.entryPrice}`
    );
    return {
      success: true,
      message: `Successfully executed ${params.lots} Lot(s) ${params.tickerSymbol} ${params.strike} ${params.optionType}`
    };
  }, [portfolio.availableCash, currentTicker?.currency]);

  // Square off an open position
  const squareOffPosition = useCallback((orderId: string, customExitPrice?: number, reason: PaperTradeOrder['exitReason'] = 'MANUAL_SQUARE_OFF') => {
    setPortfolio(prev => {
      const targetPos = prev.openPositions.find(p => p.id === orderId);
      if (!targetPos) return prev;

      const exitPrice = customExitPrice ?? targetPos.currentLtp;
      const priceDiff = targetPos.orderType === 'BUY' 
        ? exitPrice - targetPos.entryPrice 
        : targetPos.entryPrice - exitPrice;
      const realizedPnL = Number((priceDiff * targetPos.totalQty).toFixed(2));
      const marginToRelease = targetPos.entryPrice * targetPos.totalQty;

      const closedPos: PaperTradeOrder = {
        ...targetPos,
        status: 'CLOSED',
        exitTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        exitPrice,
        exitReason: reason,
        realizedPnL,
        unrealizedPnL: 0
      };

      const remainingOpen = prev.openPositions.filter(p => p.id !== orderId);
      const updatedAvailableCash = Number((prev.availableCash + marginToRelease + realizedPnL).toFixed(2));
      const updatedUsedMargin = Number((prev.usedMargin - marginToRelease).toFixed(2));
      const updatedTotalRealizedPnL = Number((prev.totalRealizedPnL + realizedPnL).toFixed(2));

      return {
        ...prev,
        availableCash: updatedAvailableCash,
        usedMargin: Math.max(0, updatedUsedMargin),
        totalRealizedPnL: updatedTotalRealizedPnL,
        openPositions: remainingOpen,
        closedTrades: [closedPos, ...prev.closedTrades]
      };
    });

    setLastNotification(`🔒 Position Squared Off @ ₹${customExitPrice || 'Market'}`);
  }, []);

  // Partial Square Off
  const partialSquareOff = useCallback((orderId: string, lotsToExit: number, customExitPrice?: number) => {
    setPortfolio(prev => {
      const targetPos = prev.openPositions.find(p => p.id === orderId);
      if (!targetPos || lotsToExit <= 0 || lotsToExit >= targetPos.lots) {
        return prev;
      }

      const exitPrice = customExitPrice ?? targetPos.currentLtp;
      const exitQty = lotsToExit * targetPos.lotSize;
      const remainingLots = targetPos.lots - lotsToExit;
      const remainingQty = remainingLots * targetPos.lotSize;

      const priceDiff = targetPos.orderType === 'BUY'
        ? exitPrice - targetPos.entryPrice
        : targetPos.entryPrice - exitPrice;
      const realizedPnL = Number((priceDiff * exitQty).toFixed(2));
      const marginToRelease = targetPos.entryPrice * exitQty;

      // Closed partial record
      const partialClosedPos: PaperTradeOrder = {
        ...targetPos,
        id: targetPos.id + '_partial_' + Date.now(),
        lots: lotsToExit,
        totalQty: exitQty,
        status: 'CLOSED',
        exitTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        exitPrice,
        exitReason: 'PARTIAL_EXIT',
        realizedPnL,
        unrealizedPnL: 0,
        notes: `Partial exit (${lotsToExit}/${targetPos.lots} lots)`
      };

      // Updated remaining position
      const updatedOpenPositions = prev.openPositions.map(p => {
        if (p.id === orderId) {
          const newUnrealized = Number((
            (p.orderType === 'BUY' ? p.currentLtp - p.entryPrice : p.entryPrice - p.currentLtp) * remainingQty
          ).toFixed(2));
          return {
            ...p,
            lots: remainingLots,
            totalQty: remainingQty,
            unrealizedPnL: newUnrealized
          };
        }
        return p;
      });

      return {
        ...prev,
        availableCash: Number((prev.availableCash + marginToRelease + realizedPnL).toFixed(2)),
        usedMargin: Number(Math.max(0, prev.usedMargin - marginToRelease).toFixed(2)),
        totalRealizedPnL: Number((prev.totalRealizedPnL + realizedPnL).toFixed(2)),
        openPositions: updatedOpenPositions,
        closedTrades: [partialClosedPos, ...prev.closedTrades]
      };
    });

    setLastNotification(`✂️ Partial Exit Executed for ${lotsToExit} Lot(s)`);
  }, []);

  // Update SL and Targets
  const updatePositionSlTp = useCallback((orderId: string, newSl: number, newTp1: number, newTp2: number) => {
    setPortfolio(prev => ({
      ...prev,
      openPositions: prev.openPositions.map(p => {
        if (p.id === orderId) {
          return {
            ...p,
            stopLoss: newSl,
            target1: newTp1,
            target2: newTp2
          };
        }
        return p;
      })
    }));
    setLastNotification('⚙️ Stop Loss & Take Profit levels updated');
  }, []);

  // Reset Account / Portfolio
  const resetPortfolio = useCallback((newInitialCash: number = DEFAULT_INITIAL_BALANCE) => {
    const cleanPortfolio: PaperPortfolio = {
      initialBalance: newInitialCash,
      availableCash: newInitialCash,
      usedMargin: 0,
      totalRealizedPnL: 0,
      openPositions: [],
      closedTrades: [],
    };
    setPortfolio(cleanPortfolio);
    setLastNotification(`🔄 Paper Trading Portfolio Reset to ₹${newInitialCash.toLocaleString()}`);
  }, []);

  // Calculated Portfolio Summary Metrics
  const summaryMetrics = useMemo(() => {
    const totalUnrealizedPnL = portfolio.openPositions.reduce((acc, p) => acc + p.unrealizedPnL, 0);
    const netPortfolioValue = portfolio.availableCash + portfolio.usedMargin + totalUnrealizedPnL;
    const totalPnL = portfolio.totalRealizedPnL + totalUnrealizedPnL;
    const totalReturnPercent = portfolio.initialBalance > 0 
      ? (totalPnL / portfolio.initialBalance) * 100 
      : 0;

    const totalClosed = portfolio.closedTrades.length;
    const winningTrades = portfolio.closedTrades.filter(t => (t.realizedPnL || 0) > 0);
    const losingTrades = portfolio.closedTrades.filter(t => (t.realizedPnL || 0) < 0);
    const winRate = totalClosed > 0 ? (winningTrades.length / totalClosed) * 100 : 0;

    const totalProfitAmount = winningTrades.reduce((acc, t) => acc + (t.realizedPnL || 0), 0);
    const totalLossAmount = Math.abs(losingTrades.reduce((acc, t) => acc + (t.realizedPnL || 0), 0));
    const profitFactor = totalLossAmount > 0 ? totalProfitAmount / totalLossAmount : totalProfitAmount > 0 ? 99.9 : 0;

    return {
      totalUnrealizedPnL,
      netPortfolioValue,
      totalPnL,
      totalReturnPercent,
      totalClosed,
      winRate,
      winningTradesCount: winningTrades.length,
      losingTradesCount: losingTrades.length,
      profitFactor,
      avgWin: winningTrades.length > 0 ? totalProfitAmount / winningTrades.length : 0,
      avgLoss: losingTrades.length > 0 ? totalLossAmount / losingTrades.length : 0
    };
  }, [portfolio]);

  return {
    portfolio,
    executeOrder,
    squareOffPosition,
    partialSquareOff,
    updatePositionSlTp,
    resetPortfolio,
    summaryMetrics,
    autoExecuteStopLoss,
    setAutoExecuteStopLoss,
    lastNotification,
    setLastNotification
  };
}
