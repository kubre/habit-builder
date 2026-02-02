// ============================================
// GET /api/friends/requests - Get pending friend requests
// ============================================

import type { Env, DBUser, FriendRequest } from '../../types';
import { jsonResponse, errorResponse } from '../../utils';

interface RequestWithUser {
  id: string;
  requester_id: string;
  created_at: string;
  requester_name: string;
  requester_friend_code: string;
}

export const onRequestGet: PagesFunction<Env, '', { user: DBUser }> = async (context) => {
  const { env, data } = context;
  const user = data.user;
  
  if (!user) {
    return errorResponse('Not authenticated', 401, 'AUTH_REQUIRED');
  }
  
  // Get pending requests where current user is recipient
  const results = await env.DB.prepare(`
    SELECT 
      f.id,
      f.requester_id,
      f.created_at,
      u.name as requester_name,
      u.friend_code as requester_friend_code
    FROM friendships f
    JOIN users u ON f.requester_id = u.id
    WHERE f.recipient_id = ? AND f.status = 'pending'
    ORDER BY f.created_at DESC
  `).bind(user.id).all<RequestWithUser>();
  
  const requests: FriendRequest[] = (results.results || []).map(row => ({
    id: row.id,
    from: {
      id: row.requester_id,
      name: row.requester_name,
      friendCode: row.requester_friend_code,
    },
    createdAt: row.created_at,
  }));
  
  return jsonResponse({ requests });
};
