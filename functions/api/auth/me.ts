// ============================================
// GET /api/auth/me - Get current user info
// ============================================

import type { Env, DBUser, UserResponse } from '../../types';
import { jsonResponse, errorResponse } from '../../utils';

export const onRequestGet: PagesFunction<Env, '', { user: DBUser }> = async (context) => {
  const user = context.data.user;
  
  if (!user) {
    return errorResponse('Not authenticated', 401, 'AUTH_REQUIRED');
  }
  
  const response: UserResponse = {
    id: user.id,
    name: user.name,
    friendCode: user.friend_code,
    createdAt: user.created_at,
  };
  
  return jsonResponse(response);
};
