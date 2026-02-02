// ============================================
// Habit Build - localStorage Storage Layer
// Much faster than IndexedDB on iOS
// ============================================

import type { Challenge, DayEntry } from './types';

const STORAGE_KEY = 'habit-build-data';
const STORAGE_VERSION = 1;

interface StorageData {
  version: number;
  currentChallengeId: string | null;
  challenges: Challenge[];
  entries: DayEntry[];
}

// In-memory cache for instant access
let cache: StorageData | null = null;

/**
 * Get default empty storage
 */
function getDefaultStorage(): StorageData {
  return {
    version: STORAGE_VERSION,
    currentChallengeId: null,
    challenges: [],
    entries: []
  };
}

/**
 * Load data from localStorage into memory cache
 */
function loadFromStorage(): StorageData {
  if (cache) return cache;
  
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      cache = getDefaultStorage();
      return cache;
    }
    
    const data = JSON.parse(raw) as StorageData;
    
    // Handle version migrations if needed
    if (!data.version || data.version < STORAGE_VERSION) {
      data.version = STORAGE_VERSION;
    }
    
    cache = data;
    return cache;
  } catch (error) {
    console.error('Failed to load from localStorage:', error);
    cache = getDefaultStorage();
    return cache;
  }
}

/**
 * Save cache to localStorage
 */
function saveToStorage(): void {
  if (!cache) return;
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.error('Failed to save to localStorage:', error);
    // localStorage might be full - try to clear old data
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.warn('localStorage full, clearing old completed challenges');
      // Remove completed challenges older than 6 months
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const cutoff = sixMonthsAgo.toISOString().split('T')[0];
      
      cache.challenges = cache.challenges.filter(c => 
        c.status === 'active' || (c.endDate && c.endDate > cutoff)
      );
      
      // Try saving again
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
      } catch {
        console.error('Still cannot save after cleanup');
      }
    }
  }
}

// ============================================
// Settings Operations
// ============================================

export function getCurrentChallengeId(): string | null {
  const data = loadFromStorage();
  return data.currentChallengeId;
}

export function setCurrentChallengeId(id: string | null): void {
  const data = loadFromStorage();
  data.currentChallengeId = id;
  saveToStorage();
}

// ============================================
// Challenge Operations
// ============================================

export function getAllChallenges(): Challenge[] {
  const data = loadFromStorage();
  return data.challenges;
}

export function getChallenge(id: string): Challenge | null {
  const data = loadFromStorage();
  return data.challenges.find(c => c.id === id) || null;
}

export function saveChallenge(challenge: Challenge): void {
  const data = loadFromStorage();
  const index = data.challenges.findIndex(c => c.id === challenge.id);
  
  if (index >= 0) {
    data.challenges[index] = challenge;
  } else {
    data.challenges.push(challenge);
  }
  
  saveToStorage();
}

export function deleteChallenge(id: string): void {
  const data = loadFromStorage();
  data.challenges = data.challenges.filter(c => c.id !== id);
  
  if (data.currentChallengeId === id) {
    data.currentChallengeId = null;
  }
  
  saveToStorage();
}

export function getChallengesByStatus(status: Challenge['status']): Challenge[] {
  const data = loadFromStorage();
  return data.challenges.filter(c => c.status === status);
}

// ============================================
// Entry Operations
// ============================================

export function getAllEntries(): DayEntry[] {
  const data = loadFromStorage();
  return data.entries;
}

export function getEntriesByDate(date: string): DayEntry[] {
  const data = loadFromStorage();
  return data.entries.filter(e => e.date === date);
}

export function getEntriesByGoalIds(goalIds: string[]): DayEntry[] {
  const data = loadFromStorage();
  const goalIdSet = new Set(goalIds);
  return data.entries.filter(e => goalIdSet.has(e.goalId));
}

export function getEntry(date: string, goalId: string): DayEntry | null {
  const data = loadFromStorage();
  return data.entries.find(e => e.date === date && e.goalId === goalId) || null;
}

export function saveEntry(entry: DayEntry): void {
  const data = loadFromStorage();
  const index = data.entries.findIndex(e => e.date === entry.date && e.goalId === entry.goalId);
  
  if (index >= 0) {
    data.entries[index] = entry;
  } else {
    data.entries.push(entry);
  }
  
  saveToStorage();
}

export function deleteEntry(date: string, goalId: string): void {
  const data = loadFromStorage();
  data.entries = data.entries.filter(e => !(e.date === date && e.goalId === goalId));
  saveToStorage();
}

export function deleteEntriesByGoals(goalIds: string[]): void {
  const data = loadFromStorage();
  const goalIdSet = new Set(goalIds);
  data.entries = data.entries.filter(e => !goalIdSet.has(e.goalId));
  saveToStorage();
}

// ============================================
// Bulk Operations
// ============================================

export function clearAllData(): void {
  cache = getDefaultStorage();
  saveToStorage();
  
  // Also clear related localStorage keys
  localStorage.removeItem('habit-build-snapshot');
  localStorage.removeItem('habit-build-has-challenge');
}

export function exportAllData(): StorageData {
  return loadFromStorage();
}

export function importAllData(data: StorageData): void {
  cache = {
    ...getDefaultStorage(),
    ...data,
    version: STORAGE_VERSION
  };
  saveToStorage();
}

// ============================================
// Migration from IndexedDB
// ============================================

export async function migrateFromIndexedDB(): Promise<boolean> {
  // Check if we've already migrated
  if (localStorage.getItem(STORAGE_KEY)) {
    return false; // Already have data, no migration needed
  }
  
  // Check if IndexedDB has data
  if (typeof indexedDB === 'undefined') {
    return false;
  }
  
  return new Promise((resolve) => {
    const request = indexedDB.open('habit-build-db', 1);
    
    request.onerror = () => {
      console.log('No IndexedDB data to migrate');
      resolve(false);
    };
    
    request.onsuccess = () => {
      const db = request.result;
      
      try {
        const tx = db.transaction(['settings', 'challenges', 'entries'], 'readonly');
        
        const migrationData: StorageData = {
          version: STORAGE_VERSION,
          currentChallengeId: null,
          challenges: [],
          entries: []
        };
        
        // Get currentChallengeId
        const settingsStore = tx.objectStore('settings');
        const settingsReq = settingsStore.get('currentChallengeId');
        settingsReq.onsuccess = () => {
          migrationData.currentChallengeId = settingsReq.result?.value || null;
        };
        
        // Get all challenges
        const challengesStore = tx.objectStore('challenges');
        const challengesReq = challengesStore.getAll();
        challengesReq.onsuccess = () => {
          migrationData.challenges = challengesReq.result || [];
        };
        
        // Get all entries
        const entriesStore = tx.objectStore('entries');
        const entriesReq = entriesStore.getAll();
        entriesReq.onsuccess = () => {
          migrationData.entries = entriesReq.result || [];
        };
        
        tx.oncomplete = () => {
          // Save migrated data to localStorage
          if (migrationData.challenges.length > 0 || migrationData.entries.length > 0) {
            cache = migrationData;
            saveToStorage();
            console.log('Migration complete:', {
              challenges: migrationData.challenges.length,
              entries: migrationData.entries.length
            });
            
            // Optionally delete IndexedDB after successful migration
            db.close();
            indexedDB.deleteDatabase('habit-build-db');
            
            resolve(true);
          } else {
            resolve(false);
          }
        };
        
        tx.onerror = () => {
          console.error('Migration transaction failed');
          resolve(false);
        };
        
      } catch (error) {
        console.error('Migration failed:', error);
        db.close();
        resolve(false);
      }
    };
    
    request.onupgradeneeded = () => {
      // IndexedDB doesn't exist or is empty
      request.transaction?.abort();
      resolve(false);
    };
  });
}

/**
 * Initialize storage - migrates from IndexedDB if needed
 */
export async function initStorage(): Promise<void> {
  // Try to migrate from IndexedDB first
  await migrateFromIndexedDB();
  
  // Load data into cache
  loadFromStorage();
}

/**
 * Invalidate in-memory cache (for testing or forced reload)
 */
export function invalidateCache(): void {
  cache = null;
}
