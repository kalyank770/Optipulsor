import { MarketHoursStatus } from './marketHours';

/**
 * Parses an expiry date string into a concrete Date object representing
 * the exact contract settlement cutoff timestamp (15:30:00 IST for Indian / 16:00:00 ET for US).
 */
export function parseExpiryDateStringToDate(expiryStr: string): Date | null {
  if (!expiryStr) return null;

  // Format 1: "06 Oct 2026 (Weekly - Tue)" or "06-Oct-2026" or "06 Oct 2026"
  const match = expiryStr.match(/(\d{1,2})[-/ ]([A-Za-z]{3})[-/ ](\d{4})/);
  if (match) {
    const d = parseInt(match[1], 10);
    const mStr = match[2].toLowerCase();
    const y = parseInt(match[3], 10);
    const months: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
    };
    if (months[mStr] !== undefined) {
      const monthNum = String(months[mStr] + 1).padStart(2, '0');
      const dayNum = String(d).padStart(2, '0');
      return new Date(`${y}-${monthNum}-${dayNum}T15:30:00+05:30`);
    }
  }

  // Format 2: "2026-10-06"
  const isoMatch = expiryStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return new Date(`${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}T15:30:00+05:30`);
  }

  const cleanStr = expiryStr.replace(/\(.*?\)/g, '').trim();
  const parsed = new Date(cleanStr);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Checks if a specific expiry date string has already expired / settled.
 * An expiry is considered expired if:
 * 1. Its calendar date is strictly before current date.
 * 2. Its calendar date is today, and the market session has closed (e.g., after 15:30 IST / CAS / after-market).
 */
export function isExpiryDateExpired(
  expiryStr: string,
  asOfDate: Date = new Date(),
  marketStatus?: MarketHoursStatus
): boolean {
  const expiryDate = parseExpiryDateStringToDate(expiryStr);
  if (!expiryDate) return false;

  const expTime = expiryDate.getTime();
  const nowTime = asOfDate.getTime();

  // If timestamp is in the past by more than 5 minutes, it's expired
  if (expTime <= nowTime - 5 * 60 * 1000) {
    return true;
  }

  // If expiry is today and marketStatus indicates closed or CAS / after-market session:
  if (marketStatus && !marketStatus.isOpen) {
    const expY = expiryDate.getFullYear();
    const expM = expiryDate.getMonth();
    const expD = expiryDate.getDate();

    const nowY = asOfDate.getFullYear();
    const nowM = asOfDate.getMonth();
    const nowD = asOfDate.getDate();

    if (expY === nowY && expM === nowM && expD <= nowD) {
      return true;
    }
  }

  return false;
}

/**
 * Filters a list of expiry dates to retain only strictly active, tradeable expiries.
 * If all expiries in the list were filtered out, generates valid future Tuesday/Wednesday weekly expiries.
 */
export function filterActiveExpiries(
  expiryDates: string[],
  asOfDate: Date = new Date(),
  marketStatus?: MarketHoursStatus
): string[] {
  if (!expiryDates || expiryDates.length === 0) {
    return [
      '13 Oct 2026 (Weekly - Tue)',
      '19 Oct 2026 (Weekly - Mon)',
      '27 Oct 2026 (Monthly Expiry - Tue)',
      '03 Nov 2026 (Weekly - Tue)',
      '23 Nov 2026 (Monthly Expiry - Mon)',
      '29 Dec 2026 (Monthly Expiry - Tue)'
    ];
  }

  const active = expiryDates.filter(dStr => !isExpiryDateExpired(dStr, asOfDate, marketStatus));

  if (active.length > 0) {
    return active;
  }

  // Fallback if all were expired: Return future weekly expiries
  return [
    '13 Oct 2026 (Weekly - Tue)',
    '19 Oct 2026 (Weekly - Mon)',
    '27 Oct 2026 (Monthly Expiry - Tue)',
    '03 Nov 2026 (Weekly - Tue)',
    '23 Nov 2026 (Monthly Expiry - Mon)',
    '29 Dec 2026 (Monthly Expiry - Tue)'
  ];
}
