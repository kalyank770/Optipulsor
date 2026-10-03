import { TickerConfig } from '../types/options';
import { checkMarketHoliday } from './marketHolidays';

export interface MarketHoursStatus {
  isOpen: boolean;
  session: 'REGULAR' | 'PRE_MARKET' | 'POST_MARKET' | 'CLOSED';
  marketName: string;
  nextOpenMsg: string;
  exchangeTimeStr: string;
  tradingHoursLabel: string;
  minutesToClose?: number;
  isClosingSoon?: boolean; // true within 45 minutes of market close (Power Hour / closing window)
  isHoliday?: boolean;
  holidayName?: string;
  holidayDescription?: string;
  marketStatusMessage?: string;
  source?: string;
  tradeDate?: string;
  nextTradingDate?: string;
  nextTradingDayName?: string;
}

/**
 * Returns current exchange time parts for a timezone
 */
function getExchangeTime(timeZone: string): { dayOfWeek: number; hours: number; minutes: number; timeStr: string; dateStr: string } {
  const now = new Date();
  
  // Format to extract weekday and time in target exchange timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const parts = formatter.formatToParts(now);
  let weekdayStr = 'Mon';
  let hour = 12;
  let minute = 0;
  let month = 'Jan';
  let day = '1';

  for (const p of parts) {
    if (p.type === 'weekday') weekdayStr = p.value;
    if (p.type === 'hour') hour = parseInt(p.value, 10);
    if (p.type === 'minute') minute = parseInt(p.value, 10);
    if (p.type === 'month') month = p.value;
    if (p.type === 'day') day = p.value;
  }

  const dayMap: Record<string, number> = {
    'Sun': 0,
    'Mon': 1,
    'Tue': 2,
    'Wed': 3,
    'Thu': 4,
    'Fri': 5,
    'Sat': 6,
  };

  const dayOfWeek = dayMap[weekdayStr] ?? 1;
  const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  const dateStr = `${day} ${month}`;

  return { dayOfWeek, hours: hour, minutes: minute, timeStr, dateStr };
}

/**
 * Checks if the exchange market is currently open for the given ticker
 * - Indian Markets (NSE/BSE): Mon-Fri 09:15 AM - 03:30 PM IST
 * - US Markets (NYSE/NASDAQ): Mon-Fri 09:30 AM - 04:00 PM ET
 */
export function getMarketHoursStatus(ticker: TickerConfig): MarketHoursStatus {
  const isIndian = ticker.currency === '₹' || 
                   ticker.symbol.includes('NIFTY') || 
                   ticker.symbol.includes('BANK') || 
                   ticker.symbol.includes('SENSEX');
  const tz = isIndian ? 'Asia/Kolkata' : 'America/New_York';
  const { timeStr, dateStr } = getExchangeTime(tz);

  // 1. Check Official Exchange Trading Holidays First
  const now = new Date();
  const holiday = checkMarketHoliday(now, isIndian);
  if (holiday.isHoliday || ticker.isHoliday) {
    const holidayName = holiday.holidayName || ticker.holidayName || 'Exchange Trading Holiday';
    const holidayDesc = holiday.description || `${isIndian ? 'National Stock Exchange of India (NSE)' : 'US Stock Exchanges'} is CLOSED today for ${holidayName}. Regular trading is halted across all Cash, Futures & Options (F&O) segments.`;
    return {
      isOpen: false,
      session: 'CLOSED',
      marketName: isIndian ? 'NSE (India)' : 'NYSE/NASDAQ (US)',
      isHoliday: true,
      holidayName,
      holidayDescription: holidayDesc,
      marketStatusMessage: `Exchange Closed · ${holidayName}`,
      nextOpenMsg: holiday.nextTradingDate 
        ? `Closed for ${holidayName}. Opens ${holiday.nextTradingDayName} (${holiday.nextTradingDate}) at ${isIndian ? '09:15 AM IST' : '09:30 AM ET'}`
        : `Closed for ${holidayName}. Opens next trading session.`,
      nextTradingDate: holiday.nextTradingDate,
      nextTradingDayName: holiday.nextTradingDayName,
      tradeDate: dateStr,
      exchangeTimeStr: isIndian ? `${timeStr} IST` : `${timeStr} ET`,
      tradingHoursLabel: isIndian ? '09:15 - 15:30 IST' : '09:30 - 16:00 ET',
      source: 'Official Exchange Trading Holiday Calendar',
    };
  }

  // 2. If ticker explicitly carries an active live session state from live feed or test configuration
  if (ticker.marketState === 'OPEN') {
    return {
      isOpen: true,
      session: 'REGULAR',
      marketName: isIndian ? 'NSE (India)' : 'NYSE/NASDAQ (US)',
      nextOpenMsg: isIndian ? 'Closes today at 03:30 PM IST' : 'Closes today at 04:00 PM ET',
      exchangeTimeStr: isIndian ? `${timeStr} IST` : `${timeStr} ET`,
      tradingHoursLabel: isIndian ? '09:15 - 15:30 IST' : '09:30 - 16:00 ET',
      minutesToClose: 120,
      isClosingSoon: false,
    };
  }

  if (ticker.marketState === 'CLOSED') {
    return {
      isOpen: false,
      session: 'CLOSED',
      marketName: isIndian ? 'NSE (India)' : 'NYSE/NASDAQ (US)',
      nextOpenMsg: isIndian ? 'Regular trading opens at 09:15 AM IST' : 'Regular trading opens at 09:30 AM ET',
      exchangeTimeStr: isIndian ? `${timeStr} IST` : `${timeStr} ET`,
      tradingHoursLabel: isIndian ? '09:15 - 15:30 IST' : '09:30 - 16:00 ET',
      source: 'Verified Exchange State: CLOSED',
    };
  }

  if (isIndian) {
    const tz = 'Asia/Kolkata';
    const { dayOfWeek, hours, minutes, timeStr } = getExchangeTime(tz);
    const totalMinutes = hours * 60 + minutes;
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

    const preMarketStart = 9 * 60; // 09:00 AM
    const marketOpen = 9 * 60 + 15; // 09:15 AM
    const marketClose = 15 * 60 + 30; // 03:30 PM
    const postMarketClose = 16 * 60; // 04:00 PM

    const exchangeTimeStr = `${timeStr} IST`;
    const tradingHoursLabel = '09:15 - 15:30 IST';

    // Weekend
    if (!isWeekday) {
      return {
        isOpen: false,
        session: 'CLOSED',
        marketName: 'NSE (India)',
        nextOpenMsg: 'Opens Monday at 09:15 AM IST',
        exchangeTimeStr,
        tradingHoursLabel,
      };
    }

    // Weekday: Regular trading session
    if (totalMinutes >= marketOpen && totalMinutes <= marketClose) {
      const minutesToClose = marketClose - totalMinutes;
      const isClosingSoon = minutesToClose <= 45;
      return {
        isOpen: true,
        session: 'REGULAR',
        marketName: 'NSE (India)',
        nextOpenMsg: isClosingSoon ? `Closing in ${minutesToClose} mins (03:30 PM IST)` : 'Closes today at 03:30 PM IST',
        exchangeTimeStr,
        tradingHoursLabel,
        minutesToClose,
        isClosingSoon,
      };
    }

    // Weekday: Pre-market
    if (totalMinutes >= preMarketStart && totalMinutes < marketOpen) {
      return {
        isOpen: false,
        session: 'PRE_MARKET',
        marketName: 'NSE (India)',
        nextOpenMsg: 'Regular trading opens at 09:15 AM IST',
        exchangeTimeStr,
        tradingHoursLabel,
      };
    }

    // Weekday: Post-market closing auction
    if (totalMinutes > marketClose && totalMinutes <= postMarketClose) {
      return {
        isOpen: false,
        session: 'POST_MARKET',
        marketName: 'NSE (India)',
        nextOpenMsg: dayOfWeek === 5 ? 'Opens Monday at 09:15 AM IST' : 'Opens tomorrow at 09:15 AM IST',
        exchangeTimeStr,
        tradingHoursLabel,
      };
    }

    // Weekday: Night / Closed
    return {
      isOpen: false,
      session: 'CLOSED',
      marketName: 'NSE (India)',
      nextOpenMsg: totalMinutes < preMarketStart
        ? 'Opens today at 09:15 AM IST'
        : (dayOfWeek === 5 ? 'Opens Monday at 09:15 AM IST' : 'Opens tomorrow at 09:15 AM IST'),
      exchangeTimeStr,
      tradingHoursLabel,
    };
  } else {
    // US Market (NYSE / NASDAQ)
    const tz = 'America/New_York';
    const { dayOfWeek, hours, minutes, timeStr } = getExchangeTime(tz);
    const totalMinutes = hours * 60 + minutes;
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

    const preMarketStart = 4 * 60; // 04:00 AM ET
    const marketOpen = 9 * 60 + 30; // 09:30 AM ET
    const marketClose = 16 * 60; // 04:00 PM ET
    const postMarketClose = 20 * 60; // 08:00 PM ET

    const exchangeTimeStr = `${timeStr} ET`;
    const tradingHoursLabel = '09:30 - 16:00 ET';

    // Weekend
    if (!isWeekday) {
      return {
        isOpen: false,
        session: 'CLOSED',
        marketName: 'NYSE/NASDAQ (US)',
        nextOpenMsg: 'Opens Monday at 09:30 AM ET',
        exchangeTimeStr,
        tradingHoursLabel,
      };
    }

    // Weekday: Regular trading session
    if (totalMinutes >= marketOpen && totalMinutes <= marketClose) {
      const minutesToClose = marketClose - totalMinutes;
      const isClosingSoon = minutesToClose <= 45;
      return {
        isOpen: true,
        session: 'REGULAR',
        marketName: 'NYSE/NASDAQ (US)',
        nextOpenMsg: isClosingSoon ? `Closing in ${minutesToClose} mins (04:00 PM ET)` : 'Closes today at 04:00 PM ET',
        exchangeTimeStr,
        tradingHoursLabel,
        minutesToClose,
        isClosingSoon,
      };
    }

    // Weekday: Pre-market
    if (totalMinutes >= preMarketStart && totalMinutes < marketOpen) {
      return {
        isOpen: false,
        session: 'PRE_MARKET',
        marketName: 'NYSE/NASDAQ (US)',
        nextOpenMsg: 'Regular trading opens at 09:30 AM ET',
        exchangeTimeStr,
        tradingHoursLabel,
      };
    }

    // Weekday: Post-market
    if (totalMinutes > marketClose && totalMinutes <= postMarketClose) {
      return {
        isOpen: false,
        session: 'POST_MARKET',
        marketName: 'NYSE/NASDAQ (US)',
        nextOpenMsg: dayOfWeek === 5 ? 'Opens Monday at 09:30 AM ET' : 'Opens tomorrow at 09:30 AM ET',
        exchangeTimeStr,
        tradingHoursLabel,
      };
    }

    // Weekday: Closed
    return {
      isOpen: false,
      session: 'CLOSED',
      marketName: 'NYSE/NASDAQ (US)',
      nextOpenMsg: totalMinutes < preMarketStart
        ? 'Opens today at 09:30 AM ET'
        : (dayOfWeek === 5 ? 'Opens Monday at 09:30 AM ET' : 'Opens tomorrow at 09:30 AM ET'),
      exchangeTimeStr,
      tradingHoursLabel,
    };
  }
}
