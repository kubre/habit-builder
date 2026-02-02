// ============================================
// GET /api/sync/pull - Download changes since last sync
// ============================================

import type { 
  Env, 
  DBUser, 
  DBChallenge, 
  DBGoal, 
  DBEntry,
  SyncPullResponse,
  SyncChallenge,
  SyncEntry,
} from '../../types';
import { jsonResponse, errorResponse, nowISO } from '../../utils';

export const onRequestGet: PagesFunction<Env, '', { user: DBUser }> = async (context) => {
  const { env, request, data } = context;
  const user = data.user;
  
  if (!user) {
    return errorResponse('Not authenticated', 401, 'AUTH_REQUIRED');
  }
  
  // Get lastSyncAt from query params
  const url = new URL(request.url);
  const lastSyncAt = url.searchParams.get('since') || '1970-01-01T00:00:00Z';
  
  try {
    // Get challenges updated since last sync
    const challengeResults = await env.DB.prepare(`
      SELECT * FROM challenges 
      WHERE user_id = ? AND updated_at > ?
      ORDER BY updated_at ASC
    `).bind(user.id, lastSyncAt).all<DBChallenge>();
    
    const challenges: SyncChallenge[] = [];
    
    for (const c of challengeResults.results || []) {
      // Get goals for this challenge
      const goalResults = await env.DB.prepare(
        'SELECT * FROM goals WHERE challenge_id = ?'
      ).bind(c.id).all<DBGoal>();
      
      challenges.push({
        id: c.id,
        name: c.name,
        startDate: c.start_date,
        duration: c.duration,
        strictMode: c.strict_mode === 1,
        status: c.status,
        endDate: c.end_date || undefined,
        failedOnDay: c.failed_on_day || undefined,
        visibleToFriends: c.visible_to_friends === 1,
        shareGoals: c.share_goals === 1,
        shareStreak: c.share_streak === 1,
        shareDailyStatus: c.share_daily_status === 1,
        shareNotes: c.share_notes === 1,
        goals: (goalResults.results || []).map(g => ({
          id: g.id,
          name: g.name,
          color: g.color,
        })),
        updatedAt: c.updated_at,
      });
    }
    
    // Get entries updated since last sync
    const entryResults = await env.DB.prepare(`
      SELECT * FROM entries 
      WHERE user_id = ? AND updated_at > ?
      ORDER BY updated_at ASC
    `).bind(user.id, lastSyncAt).all<DBEntry>();
    
    const entries: SyncEntry[] = (entryResults.results || []).map(e => ({
      id: e.id,
      challengeId: e.challenge_id,
      goalId: e.goal_id,
      date: e.date,
      completed: e.completed === 1,
      note: e.note || undefined,
      updatedAt: e.updated_at,
    }));
    
    const response: SyncPullResponse = {
      challenges,
      entries,
      serverTime: nowISO(),
    };
    
    return jsonResponse(response);
    
  } catch (error) {
    console.error('Sync pull error:', error);
    return errorResponse('Failed to fetch data', 500, 'SYNC_ERROR');
  }
};
