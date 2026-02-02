// ============================================
// GET /api/feed - Get friends' shared updates
// ============================================

import type { Env, DBUser, FeedItem, FeedResponse } from '../../types';
import { jsonResponse, errorResponse, isValidUUID } from '../../utils';

interface FeedRow {
  friend_id: string;
  friend_name: string;
  challenge_id: string;
  challenge_name: string;
  challenge_start_date: string;
  challenge_duration: number;
  date: string;
  completed_count: number;
  total_goals: number;
}

export const onRequestGet: PagesFunction<Env, '', { user: DBUser }> = async (context) => {
  const { env, request, data } = context;
  const user = data.user;
  
  if (!user) {
    return errorResponse('Not authenticated', 401, 'AUTH_REQUIRED');
  }
  
  // Get pagination params
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50);
  const offset = parseInt(url.searchParams.get('offset') || '0');
  
  try {
    // Get friend IDs first
    const friendsResult = await env.DB.prepare(`
      SELECT 
        CASE 
          WHEN requester_id = ? THEN recipient_id
          ELSE requester_id
        END as friend_id
      FROM friendships
      WHERE (requester_id = ? OR recipient_id = ?)
        AND status = 'accepted'
    `).bind(user.id, user.id, user.id).all<{ friend_id: string }>();
    
    const friendIds = (friendsResult.results || []).map(r => r.friend_id);
    
    if (friendIds.length === 0) {
      return jsonResponse({ items: [], hasMore: false });
    }
    
    // Validate all friend IDs are valid UUIDs before using in SQL
    // This is defense-in-depth since IDs come from our own DB
    const validFriendIds = friendIds.filter(id => isValidUUID(id));
    if (validFriendIds.length === 0) {
      return jsonResponse({ items: [], hasMore: false });
    }
    
    // Build feed query - get daily summaries for friends with visible challenges
    // This query gets the completion status for each friend's challenges per day
    const placeholders = validFriendIds.map(() => '?').join(',');
    
    const feedResult = await env.DB.prepare(`
      SELECT 
        u.id as friend_id,
        u.name as friend_name,
        c.id as challenge_id,
        c.name as challenge_name,
        c.start_date as challenge_start_date,
        c.duration as challenge_duration,
        e.date,
        SUM(e.completed) as completed_count,
        COUNT(e.id) as total_goals
      FROM entries e
      JOIN challenges c ON e.challenge_id = c.id
      JOIN users u ON c.user_id = u.id
      WHERE c.user_id IN (${placeholders})
        AND c.visible_to_friends = 1
        AND c.status = 'active'
      GROUP BY u.id, c.id, e.date
      ORDER BY e.date DESC, u.name ASC
      LIMIT ? OFFSET ?
    `).bind(...validFriendIds, limit + 1, offset).all<FeedRow>();
    
    const rows = feedResult.results || [];
    const hasMore = rows.length > limit;
    const items: FeedItem[] = rows.slice(0, limit).map((row, index) => {
      // Calculate current day number
      const startDate = new Date(row.challenge_start_date);
      const entryDate = new Date(row.date);
      const dayNumber = Math.floor((entryDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      
      return {
        id: `${row.friend_id}-${row.challenge_id}-${row.date}`,
        friend: {
          id: row.friend_id,
          name: row.friend_name,
        },
        challenge: {
          id: row.challenge_id,
          name: row.challenge_name,
          currentDay: dayNumber,
          totalDays: row.challenge_duration,
        },
        date: row.date,
        completedGoals: row.completed_count,
        totalGoals: row.total_goals,
        streak: 0, // Would need additional query to calculate
        timestamp: row.date,
      };
    });
    
    const response: FeedResponse = {
      items,
      hasMore,
    };
    
    return jsonResponse(response);
    
  } catch (error) {
    console.error('Feed error:', error);
    return errorResponse('Failed to fetch feed', 500, 'FEED_ERROR');
  }
};
