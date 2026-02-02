// ============================================
// POST /api/friends/invite - Send friend request
// ============================================

import type { Env, DBUser, DBFriendship, FriendInviteRequest } from '../../types';
import {
  generateId,
  jsonResponse,
  errorResponse,
  parseBody,
  nowISO,
  isValidFriendCode,
} from '../../utils';

export const onRequestPost: PagesFunction<Env, '', { user: DBUser }> = async (context) => {
  const { env, request, data } = context;
  const user = data.user;
  
  if (!user) {
    return errorResponse('Not authenticated', 401, 'AUTH_REQUIRED');
  }
  
  // Parse request body
  const body = await parseBody<FriendInviteRequest>(request);
  if (!body?.friendCode || typeof body.friendCode !== 'string') {
    return errorResponse('Friend code is required', 400, 'INVALID_REQUEST');
  }
  
  const friendCode = body.friendCode.trim().toUpperCase();
  
  // Validate friend code format before database query
  if (!isValidFriendCode(friendCode)) {
    return errorResponse('Invalid friend code format. Expected HABIT-XXXX', 400, 'INVALID_FRIEND_CODE');
  }
  
  // Can't add yourself
  if (friendCode === user.friend_code) {
    return errorResponse("You can't add yourself as a friend", 400, 'SELF_INVITE');
  }
  
  // Find the recipient user
  const recipient = await env.DB.prepare(
    'SELECT * FROM users WHERE friend_code = ?'
  ).bind(friendCode).first<DBUser>();
  
  if (!recipient) {
    return errorResponse('User not found with that friend code', 404, 'USER_NOT_FOUND');
  }
  
  // Check if friendship already exists (in either direction)
  const existing = await env.DB.prepare(`
    SELECT * FROM friendships 
    WHERE (requester_id = ? AND recipient_id = ?)
       OR (requester_id = ? AND recipient_id = ?)
  `).bind(user.id, recipient.id, recipient.id, user.id).first<DBFriendship>();
  
  if (existing) {
    if (existing.status === 'accepted') {
      return errorResponse('You are already friends', 400, 'ALREADY_FRIENDS');
    } else if (existing.status === 'pending') {
      if (existing.requester_id === user.id) {
        return errorResponse('Friend request already sent', 400, 'REQUEST_PENDING');
      } else {
        // They sent us a request - auto-accept
        await env.DB.prepare(`
          UPDATE friendships SET status = 'accepted', updated_at = ? WHERE id = ?
        `).bind(nowISO(), existing.id).run();
        
        return jsonResponse({ 
          message: 'Friend request accepted! They had already sent you a request.',
          status: 'accepted'
        });
      }
    } else if (existing.status === 'denied') {
      // Allow re-request if previously denied (update the existing record)
      if (existing.requester_id === user.id) {
        await env.DB.prepare(`
          UPDATE friendships SET status = 'pending', updated_at = ? WHERE id = ?
        `).bind(nowISO(), existing.id).run();
        
        return jsonResponse({ 
          message: 'Friend request sent again',
          status: 'pending'
        }, 201);
      }
    }
  }
  
  // Create new friendship request
  const id = generateId();
  const now = nowISO();
  
  try {
    await env.DB.prepare(`
      INSERT INTO friendships (id, requester_id, recipient_id, status, created_at, updated_at)
      VALUES (?, ?, ?, 'pending', ?, ?)
    `).bind(id, user.id, recipient.id, now, now).run();
    
  } catch (error) {
    console.error('Failed to create friendship:', error);
    return errorResponse('Failed to send friend request', 500, 'DATABASE_ERROR');
  }
  
  return jsonResponse({ 
    message: 'Friend request sent',
    status: 'pending',
    recipientName: recipient.name,
  }, 201);
};
