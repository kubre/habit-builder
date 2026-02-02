// ============================================
// Habit Build - IndexedDB Wrapper
// ============================================

import type { AppState, Challenge, DayEntry } from './types';

const DB_NAME = 'habit-build-db';
const DB_VERSION = 1;

// Store names
const STORES = {
  challenges: 'challenges',
  entries: 'entries',
  settings: 'settings'
} as const;

let dbInstance: IDBDatabase | null = null;

/**
 * Initialize and open the IndexedDB database
 */
export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    // Return existing connection if available
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    // Check if we're in a browser environment
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not available'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open database'));
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create challenges store with id as key
      if (!db.objectStoreNames.contains(STORES.challenges)) {
        const challengeStore = db.createObjectStore(STORES.challenges, { keyPath: 'id' });
        challengeStore.createIndex('status', 'status', { unique: false });
      }

      // Create entries store with composite key (date + goalId)
      if (!db.objectStoreNames.contains(STORES.entries)) {
        const entryStore = db.createObjectStore(STORES.entries, { keyPath: ['date', 'goalId'] });
        entryStore.createIndex('date', 'date', { unique: false });
        entryStore.createIndex('goalId', 'goalId', { unique: false });
      }

      // Create settings store for app settings like currentChallengeId
      if (!db.objectStoreNames.contains(STORES.settings)) {
        db.createObjectStore(STORES.settings, { keyPath: 'key' });
      }
    };
  });
}

/**
 * Close the database connection
 */
export function closeDB(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

// ============================================
// Settings Operations
// ============================================

/**
 * Get a setting value
 */
export async function getSetting<T>(key: string): Promise<T | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.settings, 'readonly');
    const store = tx.objectStore(STORES.settings);
    const request = store.get(key);

    request.onsuccess = () => {
      resolve(request.result?.value ?? null);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Set a setting value
 */
export async function setSetting<T>(key: string, value: T): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.settings, 'readwrite');
    const store = tx.objectStore(STORES.settings);
    const request = store.put({ key, value });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete a setting
 */
export async function deleteSetting(key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.settings, 'readwrite');
    const store = tx.objectStore(STORES.settings);
    const request = store.delete(key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ============================================
// Challenge Operations
// ============================================

/**
 * Get all challenges
 */
export async function getAllChallenges(): Promise<Challenge[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.challenges, 'readonly');
    const store = tx.objectStore(STORES.challenges);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get a challenge by ID
 */
export async function getChallenge(id: string): Promise<Challenge | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.challenges, 'readonly');
    const store = tx.objectStore(STORES.challenges);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save a challenge (create or update)
 */
export async function saveChallenge(challenge: Challenge): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.challenges, 'readwrite');
    const store = tx.objectStore(STORES.challenges);
    const request = store.put(challenge);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete a challenge
 */
export async function deleteChallenge(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.challenges, 'readwrite');
    const store = tx.objectStore(STORES.challenges);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get challenges by status
 */
export async function getChallengesByStatus(status: Challenge['status']): Promise<Challenge[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.challenges, 'readonly');
    const store = tx.objectStore(STORES.challenges);
    const index = store.index('status');
    const request = index.getAll(status);

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

// ============================================
// Entry Operations
// ============================================

/**
 * Get all entries
 */
export async function getAllEntries(): Promise<DayEntry[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.entries, 'readonly');
    const store = tx.objectStore(STORES.entries);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get entries for a specific date
 */
export async function getEntriesByDate(date: string): Promise<DayEntry[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.entries, 'readonly');
    const store = tx.objectStore(STORES.entries);
    const index = store.index('date');
    const request = index.getAll(date);

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get entries for a specific goal
 */
export async function getEntriesByGoal(goalId: string): Promise<DayEntry[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.entries, 'readonly');
    const store = tx.objectStore(STORES.entries);
    const index = store.index('goalId');
    const request = index.getAll(goalId);

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get a specific entry
 */
export async function getEntry(date: string, goalId: string): Promise<DayEntry | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.entries, 'readonly');
    const store = tx.objectStore(STORES.entries);
    const request = store.get([date, goalId]);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save an entry (create or update)
 */
export async function saveEntry(entry: DayEntry): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.entries, 'readwrite');
    const store = tx.objectStore(STORES.entries);
    const request = store.put(entry);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete an entry
 */
export async function deleteEntry(date: string, goalId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.entries, 'readwrite');
    const store = tx.objectStore(STORES.entries);
    const request = store.delete([date, goalId]);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete all entries for a list of goal IDs
 */
export async function deleteEntriesByGoals(goalIds: string[]): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORES.entries, 'readwrite');
  const store = tx.objectStore(STORES.entries);
  
  // Get all entries and delete those matching the goal IDs
  const entries = await getAllEntries();
  const entriesToDelete = entries.filter(e => goalIds.includes(e.goalId));
  
  for (const entry of entriesToDelete) {
    store.delete([entry.date, entry.goalId]);
  }
  
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ============================================
// Bulk Operations
// ============================================

/**
 * Clear all data from the database
 */
export async function clearAllData(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(
      [STORES.challenges, STORES.entries, STORES.settings],
      'readwrite'
    );
    
    tx.objectStore(STORES.challenges).clear();
    tx.objectStore(STORES.entries).clear();
    tx.objectStore(STORES.settings).clear();

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Export all data as AppState
 */
export async function exportAllData(): Promise<AppState> {
  const [challenges, entries, currentChallengeId] = await Promise.all([
    getAllChallenges(),
    getAllEntries(),
    getSetting<string>('currentChallengeId')
  ]);

  return {
    currentChallengeId,
    challenges,
    entries
  };
}

/**
 * Import data from AppState
 */
export async function importAllData(state: AppState): Promise<void> {
  // Clear existing data first
  await clearAllData();

  const db = await openDB();
  
  // Start a transaction for all stores
  const tx = db.transaction(
    [STORES.challenges, STORES.entries, STORES.settings],
    'readwrite'
  );

  // Import challenges
  const challengeStore = tx.objectStore(STORES.challenges);
  for (const challenge of state.challenges) {
    challengeStore.put(challenge);
  }

  // Import entries
  const entryStore = tx.objectStore(STORES.entries);
  for (const entry of state.entries) {
    entryStore.put(entry);
  }

  // Import settings
  const settingsStore = tx.objectStore(STORES.settings);
  settingsStore.put({ key: 'currentChallengeId', value: state.currentChallengeId });

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Check if database is available (browser environment check)
 */
export function isDBAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.indexedDB;
}
