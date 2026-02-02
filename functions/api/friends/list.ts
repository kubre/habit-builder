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
}

export const onRequestGet: PagesFunction<Env, '', { user: DBUser }> = async (context) => {
  const { env, data } = context;
  const user = data.user;
  
  if (!user) {
    return errorResponse('Not authenticated', 401, 'AUTH_REQUIRED');
  }
  
  // Get accepted friendships (both directions)
  const results = await env.DB.prepare(`
    SELECT 
      f.id as friendship_id,
      CASE 
        WHEN f.requester_id = ? THEN f.recipient_id
        ELSE f.requester_id
      END as friend_id,
      u.name as friend_name,
      u.friend_code as friend_code,
      f.updated_at as since
    FROM friendships f
    JOIN users u ON u.id = CASE 
      WHEN f.requester_id = ? THEN f.recipient_id
      ELSE f.requester_id
    END
    WHERE (f.requester_id = ? OR f.recipient_id = ?)
      AND f.status = 'accepted'
    ORDER BY u.name ASC
  `).bind(user.id, user.id, user.id, user.id).all<FriendRow>();
  
  const friends: Friend[] = (results.results || []).map(row => ({
    id: row.friend_id,
    name: row.friend_name,
    friendCode: row.friend_code,
    friendshipId: row.friendship_id,
    since: row.since,
  }));
  
  return jsonResponse({ friends });
};
