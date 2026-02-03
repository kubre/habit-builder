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
export function getCurrentDayNumber(): number {
  const challenge = getCurrentChallenge();
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
 * Check if a day was missed (past, zero goals completed, and challenge was active)
 */
export function isDayMissed(
  date: string,
  _goals: Goal[],
  entries: DayEntry[],
  startDate: string
): boolean {
  // Can't miss future days or today
  if (!isPast(date)) return false;
  
  // Can't miss days before challenge started
  if (date < startDate) return false;
  
  // Only "missed" if NO goals were completed (partial days are not missed)
  const dateEntries = entries.filter(e => e.date === date);
  const completedCount = dateEntries.filter(e => e.completed).length;
  
  return completedCount === 0;
}

/**
 * Get status for each day of the challenge
 */
export function getDayStatuses(challenge: Challenge): DayStatus[] {
  const entries = getChallengeEntries(challenge.id);
  return computeDayStatuses(challenge, entries);
}

/**
 * Compute day statuses from pre-fetched entries
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
 * Calculate current streak from statuses
 */
export function calculateCurrentStreakFromStatuses(statuses: DayStatus[]): number {
  const today = getToday();
  
  let startIndex = statuses.findIndex(s => s.date === today);
  
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
 * Calculate current streak
 */
export function calculateCurrentStreak(challenge: Challenge): number {
  const statuses = getDayStatuses(challenge);
  return calculateCurrentStreakFromStatuses(statuses);
}

/**
 * Calculate best streak from statuses
 */
export function calculateBestStreakFromStatuses(statuses: DayStatus[]): number {
  let bestStreak = 0;
  let currentStreak = 0;
  
  for (const status of statuses) {
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
 * Calculate best streak
 */
export function calculateBestStreak(challenge: Challenge): number {
  const statuses = getDayStatuses(challenge);
  return calculateBestStreakFromStatuses(statuses);
}

/**
 * Get comprehensive challenge statistics
 */
export function getChallengeStats(challenge: Challenge): ChallengeStats {
  const statuses = getDayStatuses(challenge);
  const today = getToday();
  const currentDay = getDayNumber(challenge.startDate, today);
  
  const pastStatuses = statuses.filter(s => s.isPast || s.isToday);
  const completedDays = pastStatuses.filter(s => s.isComplete).length;
  
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
 * Check for strict mode violation
 */
export function checkStrictModeViolation(challenge: Challenge): number | null {
  if (!challenge.strictMode) return null;
  if (challenge.status !== 'active') return null;
  
  const statuses = getDayStatuses(challenge);
  const missedDay = statuses.find(s => s.isMissed);
  
  if (missedDay) {
    endChallenge(challenge.id, 'failed', missedDay.dayNumber);
    return missedDay.dayNumber;
  }
  
  return null;
}

/**
 * Check if challenge is completed
 */
export function checkChallengeCompletion(challenge: Challenge): boolean {
  const stats = getChallengeStats(challenge);
  
  if (stats.currentDay >= challenge.duration && 
      stats.totalDaysCompleted === challenge.duration) {
    endChallenge(challenge.id, 'completed');
    return true;
  }
  
  return false;
}

/**
 * Get goals completion status for today
 */
export function getTodayGoalsStatus(challenge: Challenge): {
  goal: Goal;
  completed: boolean;
  note?: string;
}[] {
  const today = getToday();
  const entries = getEntriesForDate(today);
  
  return challenge.goals.map(goal => {
    const entry = entries.find(e => e.goalId === goal.id);
    return {
      goal,
      completed: entry?.completed ?? false,
      note: entry?.note
    };
  });
}

/**
 * Get goals completion status from pre-fetched entries
 */
export function getTodayGoalsStatusFromEntries(
  challenge: Challenge, 
  todayEntries: DayEntry[]
): { goal: Goal; completed: boolean; note?: string }[] {
  return challenge.goals.map(goal => {
    const entry = todayEntries.find(e => e.goalId === goal.id);
    return {
      goal,
      completed: entry?.completed ?? false,
      note: entry?.note
    };
  });
}

/**
 * Get challenge statistics from pre-fetched entries
 */
export function getChallengeStatsFromEntries(
  challenge: Challenge,
  allEntries: DayEntry[]
): ChallengeStats {
  const statuses = computeDayStatuses(challenge, allEntries);
  const today = getToday();
  const currentDay = getDayNumber(challenge.startDate, today);
  
  const pastStatuses = statuses.filter(s => s.isPast || s.isToday);
  const completedDays = pastStatuses.filter(s => s.isComplete).length;
  
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
