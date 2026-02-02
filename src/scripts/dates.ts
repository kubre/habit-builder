// ============================================
// Habit Build - Date Utilities
// ============================================

/**
 * Get today's date as ISO string (YYYY-MM-DD) in local timezone
 */
export function getToday(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse an ISO date string to Date object
 */
export function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Format a date as ISO string (YYYY-MM-DD)
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get the day number within a challenge (1-indexed)
 */
export function getDayNumber(startDate: string, targetDate: string): number {
  const start = parseDate(startDate);
  const target = parseDate(targetDate);
  const diffTime = target.getTime() - start.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays + 1;
}

/**
 * Get array of all dates in a challenge
 */
export function getChallengeDates(startDate: string, duration: number): string[] {
  const dates: string[] = [];
  const start = parseDate(startDate);
  
  for (let i = 0; i < duration; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    dates.push(formatDate(date));
  }
  
  return dates;
}

/**
 * Check if a date is in the past (before today)
 */
export function isPast(dateStr: string): boolean {
  const today = getToday();
  return dateStr < today;
}

/**
 * Check if a date is today
 */
export function isToday(dateStr: string): boolean {
  return dateStr === getToday();
}

/**
 * Check if a date is in the future (after today)
 */
export function isFuture(dateStr: string): boolean {
  const today = getToday();
  return dateStr > today;
}

/**
 * Get the date N days from a start date
 */
export function addDays(dateStr: string, days: number): string {
  const date = parseDate(dateStr);
  date.setDate(date.getDate() + days);
  return formatDate(date);
}

/**
 * Format date for display (e.g., "Mon, Jan 15")
 */
export function formatDisplayDate(dateStr: string): string {
  const date = parseDate(dateStr);
  const options: Intl.DateTimeFormatOptions = { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric' 
  };
  return date.toLocaleDateString('en-US', options);
}

/**
 * Format date for display with year (e.g., "January 15, 2024")
 */
export function formatFullDate(dateStr: string): string {
  const date = parseDate(dateStr);
  const options: Intl.DateTimeFormatOptions = { 
    month: 'long', 
    day: 'numeric',
    year: 'numeric'
  };
  return date.toLocaleDateString('en-US', options);
}

/**
 * Get day of week (0 = Sunday, 6 = Saturday)
 */
export function getDayOfWeek(dateStr: string): number {
  return parseDate(dateStr).getDay();
}

/**
 * Get abbreviated day name
 */
export function getDayName(dateStr: string): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[getDayOfWeek(dateStr)];
}

/**
 * Get number of days between two dates
 */
export function daysBetween(startDate: string, endDate: string): number {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  const diffTime = end.getTime() - start.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}
