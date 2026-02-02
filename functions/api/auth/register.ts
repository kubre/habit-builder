// ============================================
// POST /api/auth/register - Create new account
// ============================================

import type { Env, RegisterRequest, RegisterResponse } from '../../types';
import {
  generateId,
  generateFriendCode,
  generateAuthToken,
  generateRecoveryPhrase,
  hashString,
  hashRecoveryPhrase,
  jsonResponse,
  errorResponse,
  parseBody,
  nowISO,
} from '../../utils';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context;
  
  // Parse request body
  const body = await parseBody<RegisterRequest>(request);
  if (!body?.name || typeof body.name !== 'string') {
    return errorResponse('Name is required', 400, 'INVALID_REQUEST');
  }
  
  const name = body.name.trim();
  if (name.length < 1 || name.length > 50) {
    return errorResponse('Name must be 1-50 characters', 400, 'INVALID_NAME');
  }
  
  // Validate name contains only allowed characters (letters, numbers, spaces, common punctuation)
  // This prevents SQL injection and XSS at the source
  const namePattern = /^[\p{L}\p{N}\s\-'_.]+$/u;
  if (!namePattern.test(name)) {
    return errorResponse('Name contains invalid characters', 400, 'INVALID_NAME_CHARS');
  }
  
  // Generate credentials
  const id = generateId();
  const authToken = generateAuthToken();
  const recoveryPhrase = generateRecoveryPhrase();
  
  // Generate unique friend code (retry if collision)
  let friendCode: string;
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    friendCode = generateFriendCode();
    const existing = await env.DB.prepare(
      'SELECT id FROM users WHERE friend_code = ?'
    ).bind(friendCode).first();
    
    if (!existing) break;
    attempts++;
  }
  
  if (attempts >= maxAttempts) {
    return errorResponse('Failed to generate unique friend code', 500, 'CODE_GENERATION_FAILED');
  }
  
  // Hash sensitive data
  const authTokenHash = await hashString(authToken);
  const recoveryPhraseHash = await hashRecoveryPhrase(recoveryPhrase);
  
  const now = nowISO();
  
  // Insert user into database
  try {
    await env.DB.prepare(`
      INSERT INTO users (id, name, friend_code, auth_token_hash, recovery_phrase_hash, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(id, name, friendCode!, authTokenHash, recoveryPhraseHash, now, now).run();
    
    // Initialize sync log
    await env.DB.prepare(`
      INSERT INTO sync_log (user_id, last_sync_at)
      VALUES (?, ?)
    `).bind(id, now).run();
    
  } catch (error) {
    console.error('Failed to create user:', error);
    return errorResponse('Failed to create account', 500, 'DATABASE_ERROR');
  }
  
  // Return success response with credentials
  const response: RegisterResponse = {
    user: {
      id,
      name,
      friendCode: friendCode!,
    },
    authToken,
    recoveryPhrase,
  };
  
  return jsonResponse(response, 201);
};
