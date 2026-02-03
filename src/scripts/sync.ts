// ============================================
// Habit Build - Sync Engine
// ============================================

import * as api from './api';
import * as storage from './localStorage';
import * as auth from './auth';
import type { Challenge, DayEntry } from './types';

export interface SyncResult {
  success: boolean;
  pushed: { challenges: number; entries: number };
  pulled: { challenges: number; entries: number };
  error?: string;
}

/**
 * Convert local Challenge to SyncChallenge format
 */
function toSyncChallenge(challenge: Challenge): api.SyncChallenge {
  return {
    id: challenge.id,
    name: challenge.name,
    startDate: challenge.startDate,
    duration: challenge.duration,
    strictMode: challenge.strictMode,
    status: challenge.status,
    endDate: challenge.endDate,
    failedOnDay: challenge.failedOnDay,
    visibleToFriends: challenge.visibleToFriends ?? true,
    shareGoals: challenge.shareGoals ?? true,
    shareStreak: challenge.shareStreak ?? true,
    shareDailyStatus: challenge.shareDailyStatus ?? true,
    shareNotes: challenge.shareNotes ?? false,
    goals: challenge.goals.map(g => ({
      id: g.id,
      name: g.name,
      color: g.color,
    })),
    updatedAt: challenge.updatedAt || new Date().toISOString(),
  };
}

/**
 * Convert SyncChallenge to local Challenge format
 */
function fromSyncChallenge(sync: api.SyncChallenge): Challenge {
  return {
    id: sync.id,
    name: sync.name,
    startDate: sync.startDate,
    duration: sync.duration,
    strictMode: sync.strictMode,
    status: sync.status,
    endDate: sync.endDate,
    failedOnDay: sync.failedOnDay,
    visibleToFriends: sync.visibleToFriends,
    shareGoals: sync.shareGoals,
    shareStreak: sync.shareStreak,
    shareDailyStatus: sync.shareDailyStatus,
    shareNotes: sync.shareNotes,
    goals: sync.goals as Challenge['goals'], // Cast since API types are looser
    updatedAt: sync.updatedAt,
  };
}

/**
 * Convert local DayEntry to SyncEntry format
 */
function toSyncEntry(entry: DayEntry, challengeId: string): api.SyncEntry {
  return {
    id: `${entry.goalId}-${entry.date}`,
    challengeId,
    goalId: entry.goalId,
    date: entry.date,
    completed: entry.completed,
    note: entry.note,
    updatedAt: entry.updatedAt || new Date().toISOString(),
  };
}

/**
 * Convert SyncEntry to local DayEntry format
 */
function fromSyncEntry(sync: api.SyncEntry): DayEntry {
  return {
    date: sync.date,
    goalId: sync.goalId,
    completed: sync.completed,
    note: sync.note,
    updatedAt: sync.updatedAt,
  };
}

/**
 * Perform a full sync with the server
 * 1. Pull changes from server
 * 2. Merge with local data (last-write-wins)
 * 3. Push local changes to server
 */
export async function performSync(): Promise<SyncResult> {
  const account = await auth.getLocalAccount();
  
  if (!account) {
    return {
      success: false,
      pushed: { challenges: 0, entries: 0 },
      pulled: { challenges: 0, entries: 0 },
      error: 'Not logged in',
    };
  }
  
  const lastSyncAt = account.lastSyncAt;
  
  try {
    // Step 1: Pull changes from server
    const pullResult = await api.syncPull(lastSyncAt || undefined);
    
    if (pullResult.error) {
      return {
        success: false,
        pushed: { challenges: 0, entries: 0 },
        pulled: { challenges: 0, entries: 0 },
        error: pullResult.error,
      };
    }
    
    const serverData = pullResult.data!;
    let pulledChallenges = 0;
    let pulledEntries = 0;
    
    // Step 2: Fetch all local data (now synchronous from localStorage)
    const localChallenges = storage.getAllChallenges();
    const localEntries = storage.getAllEntries();
    
    // Build lookup maps for O(1) access instead of O(n) per item
    const localChallengeMap = new Map(localChallenges.map(c => [c.id, c]));
    const localEntryMap = new Map(localEntries.map(e => [`${e.goalId}-${e.date}`, e]));
    
    // Merge server changes into local DB
    for (const serverChallenge of serverData.challenges) {
      const localChallenge = localChallengeMap.get(serverChallenge.id);
      
      // If no local version, or server is newer, use server version
      if (!localChallenge || 
          (serverChallenge.updatedAt > (localChallenge.updatedAt || ''))) {
        storage.saveChallenge(fromSyncChallenge(serverChallenge));
        pulledChallenges++;
      }
    }
    
    for (const serverEntry of serverData.entries) {
      const entryKey = `${serverEntry.goalId}-${serverEntry.date}`;
      const localEntry = localEntryMap.get(entryKey);
      
      // If no local version, or server is newer, use server version
      if (!localEntry || 
          (serverEntry.updatedAt > (localEntry.updatedAt || ''))) {
        storage.saveEntry(fromSyncEntry(serverEntry));
        pulledEntries++;
      }
    }
    
    // Step 3: Push local changes to server (reuse already-fetched data)
    
    // Filter to only include data that needs syncing
    // (updated after last sync or never synced)
    const challengesToPush = localChallenges
      .filter(c => !lastSyncAt || (c.updatedAt && c.updatedAt > lastSyncAt))
      .map(toSyncChallenge);
    
    // Build goalId -> challengeId map for O(1) lookup
    const goalToChallengeMap = new Map<string, string>();
    for (const challenge of localChallenges) {
      for (const goal of challenge.goals) {
        goalToChallengeMap.set(goal.id, challenge.id);
      }
    }
    
    const entriesToPush: api.SyncEntry[] = [];
    
    for (const entry of localEntries) {
      if (!lastSyncAt || (entry.updatedAt && entry.updatedAt > lastSyncAt)) {
        const challengeId = goalToChallengeMap.get(entry.goalId);
        if (challengeId) {
          entriesToPush.push(toSyncEntry(entry, challengeId));
        }
      }
    }
    
    const pushResult = await api.syncPush({
      challenges: challengesToPush,
      entries: entriesToPush,
      lastSyncAt,
    });
    
    if (pushResult.error) {
      // Even if push fails, we've already pulled - partial success
      console.error('Push failed:', pushResult.error);
    }
    
    // Update last sync timestamp
    const newSyncAt = pushResult.data?.syncedAt || serverData.serverTime;
    await auth.updateLastSyncAt(newSyncAt);
    
    return {
      success: true,
      pushed: { 
        challenges: challengesToPush.length, 
        entries: entriesToPush.length 
      },
      pulled: { 
        challenges: pulledChallenges, 
        entries: pulledEntries 
      },
    };
    
  } catch (error) {
    console.error('Sync error:', error);
    return {
      success: false,
      pushed: { challenges: 0, entries: 0 },
      pulled: { challenges: 0, entries: 0 },
      error: error instanceof Error ? error.message : 'Sync failed',
    };
  }
}

/**
 * Check if sync is needed (called on app open)
 */
export async function shouldSync(): Promise<boolean> {
  const account = await auth.getLocalAccount();
  if (!account) return false;
  
  // Sync if never synced before
  if (!account.lastSyncAt) return true;
  
  // Sync if last sync was more than 1 minute ago
  const lastSync = new Date(account.lastSyncAt);
  const now = new Date();
  const diffMinutes = (now.getTime() - lastSync.getTime()) / (1000 * 60);
  
  return diffMinutes > 1;
}

/**
 * Sync on app open if needed
 */
export async function syncOnOpen(): Promise<SyncResult | null> {
  if (await shouldSync()) {
    return performSync();
  }
  return null;
}

/**
 * Try to recover data from cloud when local storage is empty
 * This handles cases where localStorage is cleared by the browser
 * Returns true if data was recovered, false otherwise
 */
export async function tryRecoverFromCloud(): Promise<boolean> {
  const account = await auth.getLocalAccount();
  
  // No account = can't recover
  if (!account) {
    console.log('No account found, cannot recover from cloud');
    return false;
  }
  
  console.log('Attempting to recover data from cloud...');
  
  try {
    // Pull all data from server (no lastSyncAt = get everything)
    const pullResult = await api.syncPull();
    
    if (pullResult.error) {
      console.error('Cloud recovery failed:', pullResult.error);
      return false;
    }
    
    const serverData = pullResult.data!;
    
    // Check if there's any data to recover
    if (serverData.challenges.length === 0) {
      console.log('No challenges found on server');
      return false;
    }
    
    console.log(`Recovering ${serverData.challenges.length} challenges and ${serverData.entries.length} entries`);
    
    // Save all challenges
    for (const serverChallenge of serverData.challenges) {
      storage.saveChallenge(fromSyncChallenge(serverChallenge));
    }
    
    // Save all entries
    for (const serverEntry of serverData.entries) {
      storage.saveEntry(fromSyncEntry(serverEntry));
    }
    
    // Find and set the active challenge
    // First try to find an active challenge, otherwise use the most recent one
    const activeChallenge = serverData.challenges.find(c => c.status === 'active');
    if (activeChallenge) {
      storage.setCurrentChallengeId(activeChallenge.id);
      console.log('Set active challenge:', activeChallenge.name);
    } else if (serverData.challenges.length > 0) {
      // No active challenge - set the most recent one (they can start a new one from settings)
      // Sort by updatedAt descending and pick the first
      const sortedChallenges = [...serverData.challenges].sort((a, b) => 
        (b.updatedAt || '').localeCompare(a.updatedAt || '')
      );
      storage.setCurrentChallengeId(sortedChallenges[0].id);
      console.log('Set most recent challenge:', sortedChallenges[0].name);
    }
    
    // Update sync timestamp
    await auth.updateLastSyncAt(serverData.serverTime);
    
    console.log('Cloud recovery successful!');
    return true;
    
  } catch (error) {
    console.error('Cloud recovery error:', error);
    return false;
  }
}
