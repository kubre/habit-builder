// ============================================
// POST /api/auth/recover - Recover account with phrase
// ============================================

import type { Env, RecoverRequest, RecoverResponse, DBUser } from "../../types";
import {
  generateAuthToken,
  hashString,
  hashRecoveryPhrase,
  jsonResponse,
  errorResponse,
  parseBody,
  nowISO,
} from "../../utils";

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  // Parse request body
  const body = await parseBody<RecoverRequest>(request);
  if (!body?.recoveryPhrase || !Array.isArray(body.recoveryPhrase)) {
    return errorResponse("Recovery phrase is required", 400, "INVALID_REQUEST");
  }

  const phrase = body.recoveryPhrase;
  // if (phrase.length !== 12) {
  //   return errorResponse('Recovery phrase must be exactly 12 words', 400, 'INVALID_PHRASE');
  // }

  // // Validate all words are strings
  // if (!phrase.every(word => typeof word === 'string' && word.length > 0)) {
  //   return errorResponse('Invalid recovery phrase format', 400, 'INVALID_PHRASE');
  // }

  // Hash the phrase and look up user
  const phraseHash = await hashRecoveryPhrase(phrase);
  const user = await env.DB.prepare(
    "SELECT * FROM users WHERE recovery_phrase_hash = ?",
  )
    .bind(phraseHash)
    .first<DBUser>();

  if (!user) {
    return errorResponse("Invalid recovery phrase", 401, "RECOVERY_FAILED");
  }

  // Generate new auth token
  const newAuthToken = generateAuthToken();
  const newTokenHash = await hashString(newAuthToken);

  // Update user's auth token
  try {
    await env.DB.prepare(
      `
      UPDATE users SET auth_token_hash = ?, updated_at = ? WHERE id = ?
    `,
    )
      .bind(newTokenHash, nowISO(), user.id)
      .run();
  } catch (error) {
    console.error("Failed to update auth token:", error);
    return errorResponse("Failed to recover account", 500, "DATABASE_ERROR");
  }

  // Return success response with new token
  const response: RecoverResponse = {
    user: {
      id: user.id,
      name: user.name,
      friendCode: user.friend_code,
    },
    authToken: newAuthToken,
  };

  return jsonResponse(response);
};
