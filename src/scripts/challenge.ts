// ============================================
// Habit Build - Challenge Business Logic
// ============================================

import type { Challenge, DayEntry, Goal } from './types';
import { 
  getCurrentChallenge, 
  getChallengeEntries, 
  getEntriesForDate,
  endChallenge 
} from './store';
import { 
  getToday, 
  getDayNumber, 
  getChallengeDates,
  isPast
} from './dates';

export interface DayStatus {
  date: string;
  dayNumber: number;
  isToday: boolean;
  isPast: boolean;
  isFuture: boolean;
  completedGoals: number;
  totalGoals: number;
  isComplete: boolean;
  isMissed: boolean;
}

export interface ChallengeStats {
  currentStreak: number;
  bestStreak: number;
  totalDaysCompleted: number;
  totalDays: number;
  completionRate: number;
  currentDay: number;
  daysRemaining: number;
}

/**
 * Get the current day number in the active challenge
 */
export async function getCurrentDayNumber(): Promise<number> {
  const challenge = await getCurrentChallenge();
  if (!challenge) return 0;
  return getDayNumber(challenge.startDate, getToday());
}

/**
 * Check if all goals are completed for a specific date
 */
export function isDayComplete(
  date: string, 
  goals: Goal[], 
  entries: DayEntry[]
): boolean {
  const dateEntries = entries.filter(e => e.date === date);
  const completedGoalIds = new Set(
    dateEntries.filter(e => e.completed).map(e => e.goalId)
  );
  return goals.every(g => completedGoalIds.has(g.id));
}

/**
 * Check if a day was missed (past, not complete, and challenge was active)
 */
export function isDayMissed(
  date: string,
  goals: Goal[],
  entries: DayEntry[],
  startDate: string
): boolean {
  // Can't miss future days or today
  if (!isPast(date)) return false;
  
  // Can't miss days before challenge started
  if (date < startDate) return false;
  
  return !isDayComplete(date, goals, entries);
}

/**
 * Get status for each day of the challenge
 */
export async function getDayStatuses(challenge: Challenge): Promise<DayStatus[]> {
  const entries = await getChallengeEntries(challenge.id);
  return computeDayStatuses(challenge, entries);
}

/**
 * Compute day statuses from pre-fetched entries (avoids repeated DB calls)
 */
export function computeDayStatuses(challenge: Challenge, entries: DayEntry[]): DayStatus[] {
  const dates = getChallengeDates(challenge.startDate, challenge.duration);
  const today = getToday();
  
  // Build a Map for O(1) lookups instead of O(n) filter per day
  const entriesByDate = new Map<string, DayEntry[]>();
  for (const entry of entries) {
    const existing = entriesByDate.get(entry.date) || [];
    existing.push(entry);
    entriesByDate.set(entry.date, existing);
  }
  
  return dates.map((date, index) => {
    const dayNumber = index + 1;
    const dateEntries = entriesByDate.get(date) || [];
    const completedGoals = dateEntries.filter(e => e.completed).length;
    const isComplete = isDayComplete(date, challenge.goals, entries);
    const isMissed = isDayMissed(date, challenge.goals, entries, challenge.startDate);
    
    return {
      date,
      dayNumber,
      isToday: date === today,
      isPast: date < today,
      isFuture: date > today,
      completedGoals,
      totalGoals: challenge.goals.length,
      isComplete,
      isMissed
    };
  });
}

/**
 * Calculate current streak (consecutive days completed ending today or yesterday)
 * Accepts pre-computed statuses to avoid redundant DB calls
 */
export function calculateCurrentStreakFromStatuses(statuses: DayStatus[]): number {
  const today = getToday();
  
  // Find today's or yesterday's index as starting point
  let startIndex = statuses.findIndex(s => s.date === today);
  
  // If today isn't complete yet, start from yesterday
  if (startIndex >= 0 && !statuses[startIndex].isComplete) {
    startIndex--;
  }
  
  if (startIndex < 0) return 0;
  
  let streak = 0;
  for (let i = startIndex; i >= 0; i--) {
    if (statuses[i].isComplete) {
      streak++;
    } else {
      break;
    }
  }
  
  return streak;
}

/**
 * Calculate current streak (legacy async version for backward compatibility)
 */
export async function calculateCurrentStreak(challenge: Challenge): Promise<number> {
  const statuses = await getDayStatuses(challenge);
  return calculateCurrentStreakFromStatuses(statuses);
}

/**
 * Calculate best streak ever achieved in the challenge
 * Accepts pre-computed statuses to avoid redundant DB calls
 */
export function calculateBestStreakFromStatuses(statuses: DayStatus[]): number {
  let bestStreak = 0;
  let currentStreak = 0;
  
  for (const status of statuses) {
    // Don't count future days
    if (status.isFuture) break;
    
    if (status.isComplete) {
      currentStreak++;
      bestStreak = Math.max(bestStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  }
  
  return bestStreak;
}

/**
 * Calculate best streak (legacy async version for backward compatibility)
 */
export async function calculateBestStreak(challenge: Challenge): Promise<number> {
  const statuses = await getDayStatuses(challenge);
  return calculateBestStreakFromStatuses(statuses);
}

/**
 * Get comprehensive challenge statistics
 * Optimized to fetch data once and reuse for all calculations
 */
export async function getChallengeStats(challenge: Challenge): Promise<ChallengeStats> {
  // Single DB call - statuses are computed once and reused
  const statuses = await getDayStatuses(challenge);
  const today = getToday();
  const currentDay = getDayNumber(challenge.startDate, today);
  
  const pastStatuses = statuses.filter(s => s.isPast || s.isToday);
  const completedDays = pastStatuses.filter(s => s.isComplete).length;
  
  // Use pre-computed statuses instead of fetching again
  const currentStreak = calculateCurrentStreakFromStatuses(statuses);
  const bestStreak = calculateBestStreakFromStatuses(statuses);
  
  const activeDays = Math.min(currentDay, challenge.duration);
  const completionRate = activeDays > 0 
    ? Math.round((completedDays / activeDays) * 100) 
    : 0;
  
  return {
    currentStreak,
    bestStreak,
    totalDaysCompleted: completedDays,
    totalDays: challenge.duration,
    completionRate,
    currentDay: Math.min(currentDay, challenge.duration),
    daysRemaining: Math.max(0, challenge.duration - currentDay)
  };
}

/**
 * Check for strict mode violation and handle it
 * Returns the day number that was missed, or null if no violation
 */
export async function checkStrictModeViolation(challenge: Challenge): Promise<number | null> {
  if (!challenge.strictMode) return null;
  if (challenge.status !== 'active') return null;
  
  const statuses = await getDayStatuses(challenge);
  
  // Find the first missed day (past and not complete)
  const missedDay = statuses.find(s => s.isMissed);
  
  if (missedDay) {
    // End the challenge as failed
    await endChallenge(challenge.id, 'failed', missedDay.dayNumber);
    return missedDay.dayNumber;
  }
  
  return null;
}

/**
 * Check if challenge is completed
 */
export async function checkChallengeCompletion(challenge: Challenge): Promise<boolean> {
  const stats = await getChallengeStats(challenge);
  
  if (stats.currentDay >= challenge.duration && 
      stats.totalDaysCompleted === challenge.duration) {
    await endChallenge(challenge.id, 'completed');
    return true;
  }
  
  return false;
}

/**
 * Get goals completion status for today
 */
export async function getTodayGoalsStatus(challenge: Challenge): Promise<{
  goal: Goal;
  completed: boolean;
  note?: string;
}[]> {
  const today = getToday();
  const entries = await getEntriesForDate(today);
  
  return challenge.goals.map(goal => {
    const entry = entries.find(e => e.goalId === goal.id);
    return {
      goal,
      completed: entry?.completed ?? false,
      note: entry?.note
    };
  });
}
