// ============================================
// GET /api/friends/list - Get accepted friends
// ============================================

import type { Env, DBUser, Friend } from '../../types';
import { jsonResponse, errorResponse } from '../../utils';

interface FriendRow {
  friendship_id: string;
  friend_id: string;
  friend_name: string;
  friend_code: string;
  since: string;
  challenge_id: string | null;
  challenge_name: string | null;
  challenge_start_date: string | null;
  challenge_duration: number | null;
}

export const onRequestGet: PagesFunction<Env, '', { user: DBUser }> = async (context) => {
  const { env, data } = context;
  const user = data.user;
  
  if (!user) {
    return errorResponse('Not authenticated', 401, 'AUTH_REQUIRED');
  }
  
  // Get accepted friendships with active challenge info (both directions)
  const results = await env.DB.prepare(`
    SELECT 
      f.id as friendship_id,
      CASE 
        WHEN f.requester_id = ? THEN f.recipient_id
        ELSE f.requester_id
      END as friend_id,
      u.name as friend_name,
      u.friend_code as friend_code,
      f.updated_at as since,
      c.id as challenge_id,
      c.name as challenge_name,
      c.start_date as challenge_start_date,
      c.duration as challenge_duration
    FROM friendships f
    JOIN users u ON u.id = CASE 
      WHEN f.requester_id = ? THEN f.recipient_id
      ELSE f.requester_id
    END
    LEFT JOIN challenges c ON c.user_id = u.id 
      AND c.status = 'active' 
      AND c.visible_to_friends = 1
    WHERE (f.requester_id = ? OR f.recipient_id = ?)
      AND f.status = 'accepted'
    ORDER BY u.name ASC
  `).bind(user.id, user.id, user.id, user.id).all<FriendRow>();
  
  // Calculate current day for each friend's challenge
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const friends: Friend[] = (results.results || []).map(row => {
    const friend: Friend = {
      id: row.friend_id,
      name: row.friend_name,
      friendCode: row.friend_code,
      friendshipId: row.friendship_id,
      since: row.since,
    };
    
    // Add active challenge if exists and visible
    if (row.challenge_id && row.challenge_start_date && row.challenge_duration) {
      const startDate = new Date(row.challenge_start_date);
      startDate.setHours(0, 0, 0, 0);
      const diffTime = today.getTime() - startDate.getTime();
      const currentDay = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
      
      // Only include if within challenge duration
      if (currentDay >= 1 && currentDay <= row.challenge_duration) {
        friend.activeChallenge = {
          id: row.challenge_id,
          name: row.challenge_name!,
          currentDay,
          totalDays: row.challenge_duration,
        };
      }
    }
    
    return friend;
  });
  
  return jsonResponse({ friends });
};
