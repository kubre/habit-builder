// ============================================
// Habit Build - Sync Engine
// ============================================

import * as api from './api';
import * as db from './db';
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
    visibleToFriends: challenge.visibleToFriends ?? false,
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
    goals: sync.goals,
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
    
    // Step 2: Merge server changes into local DB
    for (const serverChallenge of serverData.challenges) {
      const localChallenge = await db.getChallenge(serverChallenge.id);
      
      // If no local version, or server is newer, use server version
      if (!localChallenge || 
          (serverChallenge.updatedAt > (localChallenge.updatedAt || ''))) {
        await db.saveChallenge(fromSyncChallenge(serverChallenge));
        pulledChallenges++;
      }
    }
    
    for (const serverEntry of serverData.entries) {
      const localEntry = await db.getEntry(serverEntry.date, serverEntry.goalId);
      
      // If no local version, or server is newer, use server version
      if (!localEntry || 
          (serverEntry.updatedAt > (localEntry.updatedAt || ''))) {
        await db.saveEntry(fromSyncEntry(serverEntry));
        pulledEntries++;
      }
    }
    
    // Step 3: Push local changes to server
    const localChallenges = await db.getAllChallenges();
    const localEntries = await db.getAllEntries();
    
    // Filter to only include data that needs syncing
    // (updated after last sync or never synced)
    const challengesToPush = localChallenges
      .filter(c => !lastSyncAt || (c.updatedAt && c.updatedAt > lastSyncAt))
      .map(toSyncChallenge);
    
    // Map entries to their challenge IDs
    const challengeMap = new Map(localChallenges.map(c => [c.id, c]));
    const entriesToPush: api.SyncEntry[] = [];
    
    for (const entry of localEntries) {
      if (!lastSyncAt || (entry.updatedAt && entry.updatedAt > lastSyncAt)) {
        // Find which challenge this entry belongs to
        for (const challenge of localChallenges) {
          if (challenge.goals.some(g => g.id === entry.goalId)) {
            entriesToPush.push(toSyncEntry(entry, challenge.id));
            break;
          }
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
