// ============================================
// Habit Build - Data Store (IndexedDB)
// ============================================

import type { 
  AppState, 
  Challenge, 
  DayEntry, 
  Goal 
} from './types';
import * as db from './db';

/**
 * Generate a unique ID using native crypto.randomUUID()
 */
export function generateId(): string {
  // Use native browser crypto API
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ============================================
// Challenge Operations
// ============================================

/**
 * Get the current active challenge
 */
export async function getCurrentChallenge(): Promise<Challenge | null> {
  const currentId = await db.getSetting<string>('currentChallengeId');
  if (!currentId) return null;
  return db.getChallenge(currentId);
}

/**
 * Create a new challenge and set it as active
 */
export async function createChallenge(
  name: string,
  goals: Omit<Goal, 'id'>[],
  duration: number,
  strictMode: boolean
): Promise<Challenge> {
  const challenge: Challenge = {
    id: generateId(),
    name,
    startDate: new Date().toISOString().split('T')[0],
    duration,
    strictMode,
    goals: goals.map(g => ({ ...g, id: generateId() })),
    status: 'active'
  };
  
  await db.saveChallenge(challenge);
  await db.setSetting('currentChallengeId', challenge.id);
  
  return challenge;
}

/**
 * Update an existing challenge
 */
export async function updateChallenge(
  challengeId: string, 
  updates: Partial<Omit<Challenge, 'id'>>
): Promise<Challenge | null> {
  const challenge = await db.getChallenge(challengeId);
  if (!challenge) return null;
  
  const updated = { ...challenge, ...updates };
  await db.saveChallenge(updated);
  
  return updated;
}

/**
 * End a challenge (complete, fail, or abandon)
 */
export async function endChallenge(
  challengeId: string,
  status: 'completed' | 'failed' | 'abandoned',
  failedOnDay?: number
): Promise<void> {
  const challenge = await db.getChallenge(challengeId);
  if (!challenge) return;
  
  challenge.status = status;
  challenge.endDate = new Date().toISOString().split('T')[0];
  
  if (failedOnDay !== undefined) {
    challenge.failedOnDay = failedOnDay;
  }
  
  await db.saveChallenge(challenge);
  
  // Clear current challenge if it was the active one
  const currentId = await db.getSetting<string>('currentChallengeId');
  if (currentId === challengeId) {
    await db.setSetting('currentChallengeId', null);
  }
}

/**
 * Get all past (non-active) challenges
 */
export async function getPastChallenges(): Promise<Challenge[]> {
  const challenges = await db.getAllChallenges();
  return challenges.filter(c => c.status !== 'active');
}

// ============================================
// Entry Operations
// ============================================

/**
 * Get all entries for a specific challenge
 */
export async function getChallengeEntries(challengeId: string): Promise<DayEntry[]> {
  const challenge = await db.getChallenge(challengeId);
  if (!challenge) return [];
  
  const goalIds = new Set(challenge.goals.map(g => g.id));
  const allEntries = await db.getAllEntries();
  
  return allEntries.filter(e => goalIds.has(e.goalId));
}

/**
 * Get entries for a specific date
 */
export async function getEntriesForDate(date: string): Promise<DayEntry[]> {
  return db.getEntriesByDate(date);
}

/**
 * Get entry for a specific goal on a specific date
 */
export async function getEntry(date: string, goalId: string): Promise<DayEntry | null> {
  return db.getEntry(date, goalId);
}

/**
 * Set/update an entry for a goal on a date
 */
export async function setEntry(
  date: string, 
  goalId: string, 
  completed: boolean,
  note?: string
): Promise<DayEntry> {
  const entry: DayEntry = {
    date,
    goalId,
    completed,
    note
  };
  
  await db.saveEntry(entry);
  return entry;
}

/**
 * Toggle completion status for a goal on a date
 */
export async function toggleEntry(date: string, goalId: string): Promise<DayEntry> {
  const existing = await db.getEntry(date, goalId);
  const completed = existing ? !existing.completed : true;
  return setEntry(date, goalId, completed, existing?.note);
}

/**
 * Update note for an entry
 */
export async function updateEntryNote(
  date: string, 
  goalId: string, 
  note: string
): Promise<DayEntry | null> {
  const existing = await db.getEntry(date, goalId);
  if (!existing) return null;
  return setEntry(date, goalId, existing.completed, note);
}

// ============================================
// Export/Import
// ============================================

/**
 * Export all data as JSON
 */
export async function exportData(): Promise<string> {
  const state = await db.exportAllData();
  return JSON.stringify(state, null, 2);
}

/**
 * Import data from JSON
 */
export async function importData(json: string): Promise<boolean> {
  try {
    const data = JSON.parse(json) as AppState;
    
    // Basic validation
    if (!Array.isArray(data.challenges) || !Array.isArray(data.entries)) {
      throw new Error('Invalid data structure');
    }
    
    await db.importAllData(data);
    return true;
  } catch (e) {
    console.error('Failed to import data:', e);
    return false;
  }
}

/**
 * Clear all data
 */
export async function clearAllData(): Promise<void> {
  await db.clearAllData();
}

/**
 * Initialize the database connection
 */
export async function initStore(): Promise<void> {
  await db.openDB();
}

/**
 * Check if database is available
 */
export function isStoreAvailable(): boolean {
  return db.isDBAvailable();
}
