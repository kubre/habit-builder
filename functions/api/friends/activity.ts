// ============================================
// GET /api/friends/activity?friendId=X&challengeId=Y&date=Z
// Get detailed activity for a specific friend on a specific date
// ============================================

import type { Env, DBUser, FriendGoalDetail, FriendActivityResponse } from '../../types';
import { jsonResponse, errorResponse, isValidUUID } from '../../utils';

export const onRequestGet: PagesFunction<Env, '', { user: DBUser }> = async (context) => {
  const { env, request, data } = context;
  const user = data.user;
  
  if (!user) {
    return errorResponse('Not authenticated', 401, 'AUTH_REQUIRED');
  }
  
  const url = new URL(request.url);
  const friendId = url.searchParams.get('friendId');
  const challengeId = url.searchParams.get('challengeId');
  const date = url.searchParams.get('date');
  
  if (!friendId || !isValidUUID(friendId)) {
    return errorResponse('Invalid friend ID', 400, 'INVALID_FRIEND_ID');
  }
  
  if (!challengeId || !isValidUUID(challengeId)) {
    return errorResponse('Invalid challenge ID', 400, 'INVALID_CHALLENGE_ID');
  }
  
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return errorResponse('Invalid date format', 400, 'INVALID_DATE');
  }
  
  try {
    // Verify friendship exists and is accepted
    const friendship = await env.DB.prepare(`
      SELECT id FROM friendships
      WHERE ((requester_id = ? AND recipient_id = ?) OR (requester_id = ? AND recipient_id = ?))
        AND status = 'accepted'
    `).bind(user.id, friendId, friendId, user.id).first();
    
    if (!friendship) {
      return errorResponse('Not friends with this user', 403, 'NOT_FRIENDS');
    }
    
    // Get friend info
    const friend = await env.DB.prepare(
      'SELECT id, name FROM users WHERE id = ?'
    ).bind(friendId).first<{ id: string; name: string }>();
    
    if (!friend) {
      return errorResponse('Friend not found', 404, 'FRIEND_NOT_FOUND');
    }
    
    // Get challenge with sharing settings
    const challenge = await env.DB.prepare(`
      SELECT 
        id, name, start_date, duration, 
        visible_to_friends, share_goals, share_streak, share_daily_status, share_notes
      FROM challenges
      WHERE id = ? AND user_id = ? AND visible_to_friends = 1 AND status = 'active'
    `).bind(challengeId, friendId).first<{
      id: string;
      name: string;
      start_date: string;
      duration: number;
      visible_to_friends: number;
      share_goals: number;
      share_streak: number;
      share_daily_status: number;
      share_notes: number;
    }>();
    
    if (!challenge) {
      return errorResponse('Challenge not found or not visible', 404, 'CHALLENGE_NOT_FOUND');
    }
    
    // Calculate current day
    const startDate = new Date(challenge.start_date);
    const entryDate = new Date(date);
    const dayNumber = Math.floor((entryDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    // Get goals for this challenge
    const goalsResult = await env.DB.prepare(`
      SELECT id, name, color FROM goals WHERE challenge_id = ?
    `).bind(challengeId).all<{ id: string; name: string; color: string }>();
    
    const goals = goalsResult.results || [];
    
    // Get entries for this date
    const entriesResult = await env.DB.prepare(`
      SELECT goal_id, completed, note FROM entries 
      WHERE challenge_id = ? AND date = ?
    `).bind(challengeId, date).all<{ goal_id: string; completed: number; note: string | null }>();
    
    const entriesMap = new Map<string, { goal_id: string; completed: number; note: string | null }>(
      (entriesResult.results || []).map(e => [e.goal_id, e])
    );
    
    // Build goal details based on sharing settings
    const goalDetails: FriendGoalDetail[] = goals.map(goal => {
      const entry = entriesMap.get(goal.id);
      
      const detail: FriendGoalDetail = {
        id: goal.id,
        name: challenge.share_goals ? goal.name : 'Hidden Goal',
        color: challenge.share_goals ? goal.color : 'slate',
        completed: challenge.share_daily_status ? (entry?.completed === 1) : false,
      };
      
      // Only include note if sharing is enabled
      if (challenge.share_notes && entry?.note) {
        detail.note = entry.note;
      }
      
      return detail;
    });
    
    const response: FriendActivityResponse = {
      friend: {
        id: friend.id,
        name: friend.name,
      },
      challenge: {
        id: challenge.id,
        name: challenge.name,
        currentDay: dayNumber,
        totalDays: challenge.duration,
        startDate: challenge.start_date,
      },
      date,
      goals: goalDetails,
      shareSettings: {
        shareGoals: challenge.share_goals === 1,
        shareStreak: challenge.share_streak === 1,
        shareDailyStatus: challenge.share_daily_status === 1,
        shareNotes: challenge.share_notes === 1,
      },
    };
    
    return jsonResponse(response);
    
  } catch (error) {
    console.error('Friend activity error:', error);
    return errorResponse('Failed to fetch activity', 500, 'ACTIVITY_ERROR');
  }
};
