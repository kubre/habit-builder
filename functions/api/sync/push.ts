// ============================================
// POST /api/sync/push - Upload local changes
// ============================================

import type { Env, DBUser, SyncPushRequest, SyncChallenge, SyncEntry, SyncGoal } from '../../types';
import {
  generateId,
  jsonResponse,
  errorResponse,
  parseBody,
  nowISO,
} from '../../utils';

// ============================================
// Input Validation
// ============================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const VALID_STATUSES = ['active', 'completed', 'failed', 'abandoned'];
const VALID_COLORS = ['coral', 'sage', 'gold', 'slate', 'sky', 'plum'];

/**
 * Validate a UUID string
 */
function isValidUUID(str: unknown): str is string {
  return typeof str === 'string' && UUID_REGEX.test(str);
}

/**
 * Validate a date string (YYYY-MM-DD format)
 */
function isValidDate(str: unknown): str is string {
  if (typeof str !== 'string' || !DATE_REGEX.test(str)) return false;
  const date = new Date(str);
  return !isNaN(date.getTime());
}

/**
 * Validate a goal object
 */
function isValidGoal(goal: unknown): goal is SyncGoal {
  if (!goal || typeof goal !== 'object') return false;
  const g = goal as Record<string, unknown>;
  
  if (!isValidUUID(g.id)) return false;
  if (typeof g.name !== 'string' || g.name.length < 1 || g.name.length > 100) return false;
  if (typeof g.color !== 'string' || !VALID_COLORS.includes(g.color)) return false;
  
  return true;
}

/**
 * Validate a challenge object
 */
function isValidChallenge(challenge: unknown): challenge is SyncChallenge {
  if (!challenge || typeof challenge !== 'object') return false;
  const c = challenge as Record<string, unknown>;
  
  // Required fields
  if (!isValidUUID(c.id)) return false;
  if (typeof c.name !== 'string' || c.name.length < 1 || c.name.length > 100) return false;
  if (!isValidDate(c.startDate)) return false;
  if (typeof c.duration !== 'number' || c.duration < 1 || c.duration > 365) return false;
  if (typeof c.strictMode !== 'boolean') return false;
  if (typeof c.status !== 'string' || !VALID_STATUSES.includes(c.status)) return false;
  
  // Optional fields
  if (c.endDate !== undefined && c.endDate !== null && !isValidDate(c.endDate)) return false;
  if (c.failedOnDay !== undefined && c.failedOnDay !== null) {
    if (typeof c.failedOnDay !== 'number' || c.failedOnDay < 1 || c.failedOnDay > 365) return false;
  }
  
  // Boolean sharing settings
  if (typeof c.visibleToFriends !== 'boolean') return false;
  if (typeof c.shareGoals !== 'boolean') return false;
  if (typeof c.shareStreak !== 'boolean') return false;
  if (typeof c.shareDailyStatus !== 'boolean') return false;
  if (typeof c.shareNotes !== 'boolean') return false;
  
  // Goals array
  if (!Array.isArray(c.goals) || c.goals.length > 10) return false;
  for (const goal of c.goals) {
    if (!isValidGoal(goal)) return false;
  }
  
  return true;
}

/**
 * Validate an entry object
 */
function isValidEntry(entry: unknown): entry is SyncEntry {
  if (!entry || typeof entry !== 'object') return false;
  const e = entry as Record<string, unknown>;
  
  if (typeof e.id !== 'string' || e.id.length < 1 || e.id.length > 100) return false;
  if (!isValidUUID(e.challengeId)) return false;
  if (!isValidUUID(e.goalId)) return false;
  if (!isValidDate(e.date)) return false;
  if (typeof e.completed !== 'boolean') return false;
  
  // Note is optional but must be string if present and limited in length
  if (e.note !== undefined && e.note !== null) {
    if (typeof e.note !== 'string' || e.note.length > 1000) return false;
  }
  
  return true;
}

export const onRequestPost: PagesFunction<Env, '', { user: DBUser }> = async (context) => {
  const { env, request, data } = context;
  const user = data.user;
  
  if (!user) {
    return errorResponse('Not authenticated', 401, 'AUTH_REQUIRED');
  }
  
  // Parse request body
  const body = await parseBody<SyncPushRequest>(request);
  if (!body) {
    return errorResponse('Invalid request body', 400, 'INVALID_REQUEST');
  }
  
  const { challenges = [], entries = [] } = body;
  
  // Validate limits
  if (challenges.length > 50) {
    return errorResponse('Too many challenges in request', 400, 'TOO_MANY_CHALLENGES');
  }
  if (entries.length > 500) {
    return errorResponse('Too many entries in request', 400, 'TOO_MANY_ENTRIES');
  }
  
  // Validate all challenges
  const validChallenges: SyncChallenge[] = [];
  for (const challenge of challenges) {
    if (isValidChallenge(challenge)) {
      validChallenges.push(challenge);
    }
  }
  
  // Validate all entries
  const validEntries: SyncEntry[] = [];
  for (const entry of entries) {
    if (isValidEntry(entry)) {
      validEntries.push(entry);
    }
  }
  
  const now = nowISO();
  
  try {
    // Process validated challenges only
    for (const challenge of validChallenges) {
      // Check if challenge exists
      const existing = await env.DB.prepare(
        'SELECT id, updated_at FROM challenges WHERE id = ? AND user_id = ?'
      ).bind(challenge.id, user.id).first();
      
      if (existing) {
        // Update existing challenge (last-write-wins)
        await env.DB.prepare(`
          UPDATE challenges SET
            name = ?,
            start_date = ?,
            duration = ?,
            strict_mode = ?,
            status = ?,
            end_date = ?,
            failed_on_day = ?,
            visible_to_friends = ?,
            share_goals = ?,
            share_streak = ?,
            share_daily_status = ?,
            share_notes = ?,
            updated_at = ?
          WHERE id = ? AND user_id = ?
        `).bind(
          challenge.name,
          challenge.startDate,
          challenge.duration,
          challenge.strictMode ? 1 : 0,
          challenge.status,
          challenge.endDate || null,
          challenge.failedOnDay || null,
          challenge.visibleToFriends ? 1 : 0,
          challenge.shareGoals ? 1 : 0,
          challenge.shareStreak ? 1 : 0,
          challenge.shareDailyStatus ? 1 : 0,
          challenge.shareNotes ? 1 : 0,
          challenge.updatedAt || now,
          challenge.id,
          user.id
        ).run();
      } else {
        // Insert new challenge
        await env.DB.prepare(`
          INSERT INTO challenges (
            id, user_id, name, start_date, duration, strict_mode, status,
            end_date, failed_on_day, visible_to_friends, share_goals,
            share_streak, share_daily_status, share_notes, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          challenge.id,
          user.id,
          challenge.name,
          challenge.startDate,
          challenge.duration,
          challenge.strictMode ? 1 : 0,
          challenge.status,
          challenge.endDate || null,
          challenge.failedOnDay || null,
          challenge.visibleToFriends ? 1 : 0,
          challenge.shareGoals ? 1 : 0,
          challenge.shareStreak ? 1 : 0,
          challenge.shareDailyStatus ? 1 : 0,
          challenge.shareNotes ? 1 : 0,
          now,
          challenge.updatedAt || now
        ).run();
      }
      
      // Sync goals for this challenge
      for (const goal of challenge.goals || []) {
        const existingGoal = await env.DB.prepare(
          'SELECT id FROM goals WHERE id = ?'
        ).bind(goal.id).first();
        
        if (!existingGoal) {
          await env.DB.prepare(`
            INSERT INTO goals (id, challenge_id, user_id, name, color, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `).bind(goal.id, challenge.id, user.id, goal.name, goal.color, now).run();
        } else {
          await env.DB.prepare(`
            UPDATE goals SET name = ?, color = ? WHERE id = ?
          `).bind(goal.name, goal.color, goal.id).run();
        }
      }
    }
    
    // Process validated entries only
    for (const entry of validEntries) {
      // Verify the goal belongs to the user before allowing entry
      const goalOwner = await env.DB.prepare(
        'SELECT user_id FROM goals WHERE id = ?'
      ).bind(entry.goalId).first<{ user_id: string }>();
      
      // Skip entries for goals the user doesn't own
      if (!goalOwner || goalOwner.user_id !== user.id) {
        continue;
      }
      
      const existingEntry = await env.DB.prepare(
        'SELECT id, updated_at FROM entries WHERE goal_id = ? AND date = ?'
      ).bind(entry.goalId, entry.date).first();
      
      if (existingEntry) {
        // Update existing entry
        await env.DB.prepare(`
          UPDATE entries SET
            completed = ?,
            note = ?,
            updated_at = ?
          WHERE goal_id = ? AND date = ?
        `).bind(
          entry.completed ? 1 : 0,
          entry.note || null,
          entry.updatedAt || now,
          entry.goalId,
          entry.date
        ).run();
      } else {
        // Insert new entry
        await env.DB.prepare(`
          INSERT INTO entries (id, user_id, challenge_id, goal_id, date, completed, note, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          entry.id || generateId(),
          user.id,
          entry.challengeId,
          entry.goalId,
          entry.date,
          entry.completed ? 1 : 0,
          entry.note || null,
          now,
          entry.updatedAt || now
        ).run();
      }
    }
    
    // Update sync log
    await env.DB.prepare(`
      INSERT INTO sync_log (user_id, last_sync_at)
      VALUES (?, ?)
      ON CONFLICT(user_id) DO UPDATE SET last_sync_at = ?
    `).bind(user.id, now, now).run();
    
  } catch (error) {
    console.error('Sync push error:', error);
    return errorResponse('Failed to sync data', 500, 'SYNC_ERROR');
  }
  
  return jsonResponse({ 
    success: true,
    syncedAt: now,
    challengesCount: challenges.length,
    entriesCount: entries.length,
  });
};
