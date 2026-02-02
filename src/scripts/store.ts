// ============================================
// Habit Build - Data Store (localStorage)
// Synchronous storage for instant performance
// ============================================

import type { 
  AppState, 
  Challenge, 
  DayEntry, 
  Goal 
} from './types';
import * as storage from './localStorage';

/**
 * Generate a unique ID using native crypto.randomUUID()
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ============================================
// Challenge Operations
// ============================================

/**
 * Get the current active challenge
 * Now synchronous - instant access from localStorage
 */
export function getCurrentChallenge(): Challenge | null {
  const currentId = storage.getCurrentChallengeId();
  if (!currentId) return null;
  return storage.getChallenge(currentId);
}

/**
 * Create a new challenge and set it as active
 */
export function createChallenge(
  name: string,
  goals: Omit<Goal, 'id'>[],
  duration: number,
  strictMode: boolean
): Challenge {
  const now = new Date().toISOString();
  const challenge: Challenge = {
    id: generateId(),
    name,
    startDate: now.split('T')[0],
    duration,
    strictMode,
    goals: goals.map(g => ({ ...g, id: generateId() })),
    status: 'active',
    updatedAt: now
  };
  
  storage.saveChallenge(challenge);
  storage.setCurrentChallengeId(challenge.id);
  
  return challenge;
}

/**
 * Update an existing challenge
 */
export function updateChallenge(
  challengeId: string, 
  updates: Partial<Omit<Challenge, 'id'>>
): Challenge | null {
  const challenge = storage.getChallenge(challengeId);
  if (!challenge) return null;
  
  const updated = { 
    ...challenge, 
    ...updates,
    updatedAt: new Date().toISOString()
  };
  storage.saveChallenge(updated);
  
  return updated;
}

/**
 * End a challenge (complete, fail, or abandon)
 */
export function endChallenge(
  challengeId: string,
  status: 'completed' | 'failed' | 'abandoned',
  failedOnDay?: number
): void {
  const challenge = storage.getChallenge(challengeId);
  if (!challenge) return;
  
  const now = new Date().toISOString();
  challenge.status = status;
  challenge.endDate = now.split('T')[0];
  challenge.updatedAt = now;
  
  if (failedOnDay !== undefined) {
    challenge.failedOnDay = failedOnDay;
  }
  
  storage.saveChallenge(challenge);
  
  // Clear current challenge if it was the active one
  const currentId = storage.getCurrentChallengeId();
  if (currentId === challengeId) {
    storage.setCurrentChallengeId(null);
  }
}

/**
 * Get all past (non-active) challenges
 */
export function getPastChallenges(): Challenge[] {
  const challenges = storage.getAllChallenges();
  return challenges.filter(c => c.status !== 'active');
}

// ============================================
// Entry Operations
// ============================================

/**
 * Get all entries for a specific challenge
 */
export function getChallengeEntries(challengeId: string): DayEntry[] {
  const challenge = storage.getChallenge(challengeId);
  if (!challenge) return [];
  
  const goalIds = challenge.goals.map(g => g.id);
  return storage.getEntriesByGoalIds(goalIds);
}

/**
 * Get entries for a specific date
 */
export function getEntriesForDate(date: string): DayEntry[] {
  return storage.getEntriesByDate(date);
}

/**
 * Get entry for a specific goal on a specific date
 */
export function getEntry(date: string, goalId: string): DayEntry | null {
  return storage.getEntry(date, goalId);
}

/**
 * Set/update an entry for a goal on a date
 */
export function setEntry(
  date: string, 
  goalId: string, 
  completed: boolean,
  note?: string
): DayEntry {
  const entry: DayEntry = {
    date,
    goalId,
    completed,
    note,
    updatedAt: new Date().toISOString()
  };
  
  storage.saveEntry(entry);
  return entry;
}

/**
 * Toggle completion status for a goal on a date
 */
export function toggleEntry(date: string, goalId: string): DayEntry {
  const existing = storage.getEntry(date, goalId);
  const completed = existing ? !existing.completed : true;
  return setEntry(date, goalId, completed, existing?.note);
}

/**
 * Update note for an entry
 */
export function updateEntryNote(
  date: string, 
  goalId: string, 
  note: string
): DayEntry | null {
  const existing = storage.getEntry(date, goalId);
  if (!existing) return null;
  return setEntry(date, goalId, existing.completed, note);
}

// ============================================
// Export/Import
// ============================================

/**
 * Export all data as JSON
 */
export function exportData(): string {
  const data = storage.exportAllData();
  return JSON.stringify({
    currentChallengeId: data.currentChallengeId,
    challenges: data.challenges,
    entries: data.entries
  }, null, 2);
}

/**
 * Import data from JSON
 */
export function importData(json: string): boolean {
  try {
    const data = JSON.parse(json) as AppState;
    
    // Basic validation
    if (!Array.isArray(data.challenges) || !Array.isArray(data.entries)) {
      throw new Error('Invalid data structure');
    }
    
    storage.importAllData({
      version: 1,
      currentChallengeId: data.currentChallengeId,
      challenges: data.challenges,
      entries: data.entries
    });
    return true;
  } catch (e) {
    console.error('Failed to import data:', e);
    return false;
  }
}

/**
 * Clear all data
 */
export function clearAllData(): void {
  storage.clearAllData();
}

/**
 * Initialize the store - migrates from IndexedDB if needed
 */
export async function initStore(): Promise<void> {
  await storage.initStorage();
}

/**
 * Check if storage is available
 */
export function isStoreAvailable(): boolean {
  return typeof localStorage !== 'undefined';
}

/**
 * Get all data needed for initial app render
 * Instant access from localStorage - no async needed
 */
export function getInitialRenderData(today: string): {
  challenge: Challenge | null;
  todayEntries: DayEntry[];
  allEntries: DayEntry[];
} | null {
  const challenge = getCurrentChallenge();
  
  if (!challenge) {
    return null;
  }
  
  const goalIds = challenge.goals.map(g => g.id);
  const allEntries = storage.getEntriesByGoalIds(goalIds);
  const todayEntries = storage.getEntriesByDate(today).filter(e => 
    goalIds.includes(e.goalId)
  );
  
  return {
    challenge,
    todayEntries,
    allEntries
  };
}
