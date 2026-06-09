import { formatInTimeZone, toDate } from 'date-fns-tz';
import { addDays, format, getDay } from 'date-fns';

export type ICTSession = 'ASIA' | 'LONDON' | 'NYAM' | 'NYPM' | 'OFF_SESSION';

const NY_TIMEZONE = 'America/New_York';

/**
 * Returns a formatted ISO string of the date in New York timezone.
 */
export function getNYTime(date: Date = new Date()): string {
  return formatInTimeZone(date, NY_TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss.SSSXXX");
}

/**
 * Returns the day of the week in New York (e.g., "Monday", "Sunday").
 */
export function getNYDayOfWeek(date: Date = new Date()): string {
  return formatInTimeZone(date, NY_TIMEZONE, 'EEEE');
}

/**
 * Determines if the FX market is open.
 * FX Market: Sunday 17:00 NY to Friday 17:00 NY.
 */
export function isMarketOpen(date: Date = new Date()): boolean {
  const nyDayStr = formatInTimeZone(date, NY_TIMEZONE, 'i'); // 1 (Mon) to 7 (Sun)
  const nyHourStr = formatInTimeZone(date, NY_TIMEZONE, 'H');
  
  const day = parseInt(nyDayStr);
  const hours = parseInt(nyHourStr);

  // Friday after 17:00 NY (day 5)
  if (day === 5 && hours >= 17) return false;
  // Saturday (day 6)
  if (day === 6) return false;
  // Sunday before 17:00 NY (day 7)
  if (day === 7 && hours < 17) return false;

  return true;
}

/**
 * Returns the FX Trading Date (Rollover at 17:00 NY).
 * Sunday 17:00 NY starts the "Monday" trading day.
 */
export function getTradingDate(date: Date = new Date()): string {
  const nyDateISO = formatInTimeZone(date, NY_TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss");
  const nyDate = new Date(nyDateISO);
  
  const nyDayStr = formatInTimeZone(date, NY_TIMEZONE, 'i');
  const nyHourStr = formatInTimeZone(date, NY_TIMEZONE, 'H');
  
  const day = parseInt(nyDayStr);
  const hours = parseInt(nyHourStr);

  let tradingDate = nyDate;

  // If Sunday after 17:00 NY, it's Monday's trading day
  if (day === 7 && hours >= 17) {
    tradingDate = addDays(nyDate, 1);
  }

  return format(tradingDate, 'yyyy-MM-dd');
}

/**
 * Determines the current ICT Session based on NY time.
 * Market-aware: Returns OFF_SESSION if the market is closed.
 */
export function getICTSession(date: Date = new Date()): ICTSession {
  if (!isMarketOpen(date)) {
    return 'OFF_SESSION';
  }

  const nyTimeStr = formatInTimeZone(date, NY_TIMEZONE, 'HH:mm');
  const [hours, minutes] = nyTimeStr.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes;

  // ASIA: 18:00 – 02:00 NY
  // LONDON: 02:00 – 05:00 NY (Killzone)
  // NYAM: 07:00 – 10:00 NY (Killzone)
  // NYPM: 13:00 – 16:00 NY

  if (totalMinutes >= 18 * 60 || totalMinutes < 2 * 60) {
    return 'ASIA';
  } else if (totalMinutes >= 2 * 60 && totalMinutes < 5 * 60) {
    return 'LONDON';
  } else if (totalMinutes >= 7 * 60 && totalMinutes < 10 * 60) {
    return 'NYAM';
  } else if (totalMinutes >= 13 * 60 && totalMinutes < 16 * 60) {
    return 'NYPM';
  } else {
    return 'OFF_SESSION';
  }
}
