// ============================================
// DELETE /api/friends/remove - Remove a friend
// ============================================

import type { Env, DBUser, DBFriendship } from '../../types';
import {
  jsonResponse,
  errorResponse,
  parseBody,
} from '../../utils';

interface RemoveRequest {
  friendshipId: string;
}

export const onRequestPost: PagesFunction<Env, '', { user: DBUser }> = async (context) => {
  const { env, request, data } = context;
  const user = data.user;
  
  if (!user) {
    return errorResponse('Not authenticated', 401, 'AUTH_REQUIRED');
  }
  
  // Parse request body
  const body = await parseBody<RemoveRequest>(request);
  if (!body?.friendshipId) {
    return errorResponse('Friendship ID is required', 400, 'INVALID_REQUEST');
  }
  
  // Find the friendship
  const friendship = await env.DB.prepare(
    'SELECT * FROM friendships WHERE id = ?'
  ).bind(body.friendshipId).first<DBFriendship>();
  
  if (!friendship) {
    return errorResponse('Friendship not found', 404, 'FRIENDSHIP_NOT_FOUND');
  }
  
  // Must be part of the friendship to remove it
  if (friendship.requester_id !== user.id && friendship.recipient_id !== user.id) {
    return errorResponse('You cannot remove this friendship', 403, 'NOT_AUTHORIZED');
  }
  
  // Delete the friendship
  try {
    await env.DB.prepare(
      'DELETE FROM friendships WHERE id = ?'
    ).bind(friendship.id).run();
    
  } catch (error) {
    console.error('Failed to delete friendship:', error);
    return errorResponse('Failed to remove friend', 500, 'DATABASE_ERROR');
  }
  
  return jsonResponse({ message: 'Friend removed' });
};
