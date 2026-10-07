export interface PaperTradeOrder {
  id: string;
  tickerSymbol: string;
  underlyingSpot: number;
  strike: number;
  optionType: 'CE' | 'PE' | 'SPOT';
  expiryDate: string;
  orderType: 'BUY' | 'SELL';
  lots: number;
  lotSize: number;
  totalQty: number;
  entryPrice: number;
  currentLtp: number;
  stopLoss: number;
  target1: number;
  target2: number;
  trailingSl?: number;
  entryTime: string;
  exitTime?: string;
  exitPrice?: number;
  exitReason?: 'MANUAL_SQUARE_OFF' | 'SL_HIT' | 'TARGET_1_HIT' | 'TARGET_2_HIT' | 'PARTIAL_EXIT' | 'TRAILING_SL_HIT';
  status: 'OPEN' | 'CLOSED';
  realizedPnL?: number;
  unrealizedPnL: number;
  notes?: string;
  strategyName?: string;
}

export interface PaperPortfolio {
  initialBalance: number;
  availableCash: number;
  usedMargin: number;
  totalRealizedPnL: number;
  openPositions: PaperTradeOrder[];
  closedTrades: PaperTradeOrder[];
}
