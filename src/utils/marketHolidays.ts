/**
 * Official Exchange Trading Holiday Calendars
 * - Indian Stock Exchanges: NSE (National Stock Exchange) & BSE (Bombay Stock Exchange)
 * - US Stock Exchanges: NYSE (New York Stock Exchange) & NASDAQ
 */

export interface MarketHolidayInfo {
  isHoliday: boolean;
  holidayName?: string;
  exchange: 'NSE' | 'BSE' | 'NYSE' | 'NASDAQ';
  nextTradingDate?: string;
  nextTradingDayName?: string;
  description?: string;
}

// Indian Stock Market (NSE/BSE) Official Trading Holidays (YYYY-MM-DD)
export const INDIAN_MARKET_HOLIDAYS: Record<string, string> = {
  // 2025
  '2025-01-26': 'Republic Day',
  '2025-02-26': 'Maha Shivratri',
  '2025-03-14': 'Holi',
  '2025-03-31': 'Id-Ul-Fitr (Ramzan Id)',
  '2025-04-10': 'Mahavir Jayanti',
  '2025-04-14': 'Dr. Baba Saheb Ambedkar Jayanti',
  '2025-04-18': 'Good Friday',
  '2025-05-01': 'Maharashtra Day',
  '2025-06-07': 'Bakri Id (Id-Ul-Adha)',
  '2025-07-06': 'Muharram',
  '2025-08-15': 'Independence Day',
  '2025-10-02': 'Mahatma Gandhi Jayanti',
  '2025-10-21': 'Dussehra (Vijayadashami)',
  '2025-10-22': 'Diwali Balipratipada',
  '2025-11-05': 'Guru Nanak Jayanti',
  '2025-12-25': 'Christmas',

  // 2026 (Current Academic & Live Year)
  '2026-01-26': 'Republic Day',
  '2026-02-17': 'Maha Shivratri',
  '2026-03-04': 'Holi',
  '2026-03-27': 'Ram Navami',
  '2026-03-31': 'Mahavir Jayanti',
  '2026-04-03': 'Good Friday',
  '2026-04-14': 'Dr. Baba Saheb Ambedkar Jayanti',
  '2026-05-01': 'Maharashtra Day',
  '2026-05-28': 'Bakri Id (Id-Ul-Adha)',
  '2026-06-26': 'Muharram',
  '2026-08-15': 'Independence Day',
  '2026-09-04': 'Milad-un-Nabi (Id-e-Milad)',
  '2026-10-02': 'Mahatma Gandhi Jayanti',
  '2026-10-20': 'Dussehra (Vijayadashami)',
  '2026-11-08': 'Diwali (Laxmi Pujan - Muhurat Trading Only)',
  '2026-11-10': 'Diwali Balipratipada',
  '2026-11-24': 'Guru Nanak Jayanti',
  '2026-12-25': 'Christmas',

  // 2027
  '2027-01-26': 'Republic Day',
  '2027-03-08': 'Maha Shivratri',
  '2027-03-23': 'Holi',
  '2027-03-26': 'Good Friday',
  '2027-04-14': 'Dr. Baba Saheb Ambedkar Jayanti',
  '2027-05-01': 'Maharashtra Day',
  '2027-08-15': 'Independence Day',
  '2027-10-02': 'Mahatma Gandhi Jayanti',
  '2027-10-10': 'Dussehra',
  '2027-10-29': 'Diwali',
  '2027-11-14': 'Guru Nanak Jayanti',
  '2027-12-25': 'Christmas',
};

// US Stock Market (NYSE / NASDAQ) Official Trading Holidays (YYYY-MM-DD)
export const US_MARKET_HOLIDAYS: Record<string, string> = {
  // 2025
  '2025-01-01': "New Year's Day",
  '2025-01-20': 'Martin Luther King Jr. Day',
  '2025-02-17': "Washington's Birthday (Presidents' Day)",
  '2025-04-18': 'Good Friday',
  '2025-05-26': 'Memorial Day',
  '2025-06-19': 'Juneteenth National Independence Day',
  '2025-07-04': 'Independence Day',
  '2025-09-01': 'Labor Day',
  '2025-11-27': 'Thanksgiving Day',
  '2025-12-25': 'Christmas Day',

  // 2026
  '2026-01-01': "New Year's Day",
  '2026-01-19': 'Martin Luther King Jr. Day',
  '2026-02-16': "Washington's Birthday (Presidents' Day)",
  '2026-04-03': 'Good Friday',
  '2026-05-25': 'Memorial Day',
  '2026-06-19': 'Juneteenth National Independence Day',
  '2026-07-03': 'Independence Day (Observed)',
  '2026-09-07': 'Labor Day',
  '2026-11-26': 'Thanksgiving Day',
  '2026-12-25': 'Christmas Day',

  // 2027
  '2027-01-01': "New Year's Day",
  '2027-01-18': 'Martin Luther King Jr. Day',
  '2027-02-15': "Washington's Birthday (Presidents' Day)",
  '2027-03-26': 'Good Friday',
  '2027-05-31': 'Memorial Day',
  '2027-06-18': 'Juneteenth (Observed)',
  '2027-07-05': 'Independence Day (Observed)',
  '2027-09-06': 'Labor Day',
  '2027-11-25': 'Thanksgiving Day',
  '2027-12-24': 'Christmas Day (Observed)',
};

/**
 * Checks whether a given Date is an official trading holiday for the specified exchange market.
 */
export function checkMarketHoliday(date: Date, isIndian: boolean = true): MarketHolidayInfo {
  const timeZone = isIndian ? 'Asia/Kolkata' : 'America/New_York';
  
  // Format target date as YYYY-MM-DD in the local exchange timezone
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const dateStr = formatter.format(date); // 'YYYY-MM-DD'
  
  // Check perpetual fixed-date Indian national holidays
  const parts = dateStr.split('-');
  const monthDay = `${parts[1]}-${parts[2]}`;
  
  const exchange = isIndian ? 'NSE' : 'NYSE';

  if (isIndian) {
    let holidayName = INDIAN_MARKET_HOLIDAYS[dateStr];
    
    // Perpetual Indian Fixed-Date National Gazetted Holidays
    if (!holidayName) {
      if (monthDay === '10-02') holidayName = 'Mahatma Gandhi Jayanti';
      else if (monthDay === '01-26') holidayName = 'Republic Day';
      else if (monthDay === '08-15') holidayName = 'Independence Day';
      else if (monthDay === '05-01') holidayName = 'Maharashtra Day';
      else if (monthDay === '12-25') holidayName = 'Christmas';
    }

    if (holidayName) {
      // Find the next active trading session
      const nextDate = getNextTradingDate(date, true);
      return {
        isHoliday: true,
        holidayName,
        exchange: 'NSE',
        nextTradingDate: nextDate.dateStr,
        nextTradingDayName: nextDate.dayName,
        description: `National Stock Exchange of India (NSE) is CLOSED today for ${holidayName}. Regular trading resumes ${nextDate.dayName} (${nextDate.dateStr}) at 09:15 AM IST.`,
      };
    }
  } else {
    let holidayName = US_MARKET_HOLIDAYS[dateStr];

    // Perpetual US Fixed-Date Holidays
    if (!holidayName) {
      if (monthDay === '01-01') holidayName = "New Year's Day";
      else if (monthDay === '06-19') holidayName = 'Juneteenth National Independence Day';
      else if (monthDay === '07-04') holidayName = 'Independence Day';
      else if (monthDay === '12-25') holidayName = 'Christmas Day';
    }

    if (holidayName) {
      const nextDate = getNextTradingDate(date, false);
      return {
        isHoliday: true,
        holidayName,
        exchange: 'NYSE',
        nextTradingDate: nextDate.dateStr,
        nextTradingDayName: nextDate.dayName,
        description: `US Stock Exchanges (NYSE/NASDAQ) are CLOSED today for ${holidayName}. Regular trading resumes ${nextDate.dayName} (${nextDate.dateStr}) at 09:30 AM ET.`,
      };
    }
  }

  return {
    isHoliday: false,
    exchange,
  };
}

/**
 * Calculates the next active business trading day, skipping weekends and holidays.
 */
function getNextTradingDate(currentDate: Date, isIndian: boolean): { dateStr: string; dayName: string } {
  const timeZone = isIndian ? 'Asia/Kolkata' : 'America/New_York';
  const checkDate = new Date(currentDate.getTime());
  
  for (let i = 1; i <= 10; i++) {
    checkDate.setDate(checkDate.getDate() + 1);
    
    // Check day of week in timezone
    const dayFormatter = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' });
    const dayName = dayFormatter.format(checkDate);
    
    // Skip Saturdays and Sundays
    if (dayName === 'Sat' || dayName === 'Sun') continue;
    
    // Check if this date is also a holiday
    const holidayCheck = checkMarketHoliday(checkDate, isIndian);
    if (!holidayCheck.isHoliday) {
      const dateFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
      return {
        dateStr: dateFormatter.format(checkDate),
        dayName: dayFormatter.format(checkDate),
      };
    }
  }

  return {
    dateStr: 'Next Business Day',
    dayName: 'Monday',
  };
}
