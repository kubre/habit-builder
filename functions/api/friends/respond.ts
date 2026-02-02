// ============================================
// POST /api/friends/respond - Accept or deny friend request
// ============================================

import type { Env, DBUser, DBFriendship, FriendRespondRequest } from '../../types';
import {
  jsonResponse,
  errorResponse,
  parseBody,
  nowISO,
} from '../../utils';

export const onRequestPost: PagesFunction<Env, '', { user: DBUser }> = async (context) => {
  const { env, request, data } = context;
  const user = data.user;
  
  if (!user) {
    return errorResponse('Not authenticated', 401, 'AUTH_REQUIRED');
  }
  
  // Parse request body
  const body = await parseBody<FriendRespondRequest>(request);
  if (!body?.friendshipId || !body?.action) {
    return errorResponse('Friendship ID and action are required', 400, 'INVALID_REQUEST');
  }
  
  if (body.action !== 'accept' && body.action !== 'deny') {
    return errorResponse('Action must be "accept" or "deny"', 400, 'INVALID_ACTION');
  }
  
  // Find the friendship request
  const friendship = await env.DB.prepare(
    'SELECT * FROM friendships WHERE id = ?'
  ).bind(body.friendshipId).first<DBFriendship>();
  
  if (!friendship) {
    return errorResponse('Friend request not found', 404, 'REQUEST_NOT_FOUND');
  }
  
  // Must be the recipient to respond
  if (friendship.recipient_id !== user.id) {
    return errorResponse('You cannot respond to this request', 403, 'NOT_RECIPIENT');
  }
  
  // Must be pending
  if (friendship.status !== 'pending') {
    return errorResponse('This request has already been responded to', 400, 'ALREADY_RESPONDED');
  }
  
  // Update the friendship status
  const newStatus = body.action === 'accept' ? 'accepted' : 'denied';
  
  try {
    await env.DB.prepare(`
      UPDATE friendships SET status = ?, updated_at = ? WHERE id = ?
    `).bind(newStatus, nowISO(), friendship.id).run();
    
  } catch (error) {
    console.error('Failed to update friendship:', error);
    return errorResponse('Failed to respond to request', 500, 'DATABASE_ERROR');
  }
  
  return jsonResponse({ 
    message: body.action === 'accept' ? 'Friend request accepted' : 'Friend request denied',
    status: newStatus,
  });
};
