// ============================================
// Habit Build - Auth & Account Management
// ============================================

import * as db from './db';

// Account store key
const ACCOUNT_KEY = 'account';

export interface LocalAccount {
  id: string;
  name: string;
  friendCode: string;
  authToken: string;
  recoveryPhraseShown: boolean;
  lastSyncAt: string | null;
  createdAt: string;
}

/**
 * Get the stored auth token
 */
export function getAuthToken(): string | null {
  // Try localStorage first for quick access
  if (typeof localStorage !== 'undefined') {
    const token = localStorage.getItem('habit-build-token');
    if (token) return token;
  }
  return null;
}

/**
 * Store the auth token
 */
export function setAuthToken(token: string): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('habit-build-token', token);
  }
}

/**
 * Clear the auth token
 */
export function clearAuthToken(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('habit-build-token');
  }
}

/**
 * Get the local account info
 */
export async function getLocalAccount(): Promise<LocalAccount | null> {
  try {
    return await db.getSetting<LocalAccount>(ACCOUNT_KEY);
  } catch {
    return null;
  }
}

/**
 * Save local account info
 */
export async function saveLocalAccount(account: LocalAccount): Promise<void> {
  await db.setSetting(ACCOUNT_KEY, account);
  setAuthToken(account.authToken);
}

/**
 * Update local account
 */
export async function updateLocalAccount(updates: Partial<LocalAccount>): Promise<void> {
  const account = await getLocalAccount();
  if (account) {
    await saveLocalAccount({ ...account, ...updates });
  }
}

/**
 * Clear local account (logout)
 */
export async function clearLocalAccount(): Promise<void> {
  await db.deleteSetting(ACCOUNT_KEY);
  clearAuthToken();
}

/**
 * Check if user is logged in (has account)
 */
export async function isLoggedIn(): Promise<boolean> {
  const account = await getLocalAccount();
  return account !== null && account.authToken !== null;
}

/**
 * Create a new account from registration response
 */
export async function createAccountFromRegistration(
  user: { id: string; name: string; friendCode: string },
  authToken: string
): Promise<LocalAccount> {
  const account: LocalAccount = {
    id: user.id,
    name: user.name,
    friendCode: user.friendCode,
    authToken,
    recoveryPhraseShown: false,
    lastSyncAt: null,
    createdAt: new Date().toISOString(),
  };
  
  await saveLocalAccount(account);
  return account;
}

/**
 * Update account from recovery
 */
export async function updateAccountFromRecovery(
  user: { id: string; name: string; friendCode: string },
  authToken: string
): Promise<LocalAccount> {
  const existingAccount = await getLocalAccount();
  
  const account: LocalAccount = {
    id: user.id,
    name: user.name,
    friendCode: user.friendCode,
    authToken,
    recoveryPhraseShown: true, // They've already seen it if recovering
    lastSyncAt: existingAccount?.lastSyncAt || null,
    createdAt: existingAccount?.createdAt || new Date().toISOString(),
  };
  
  await saveLocalAccount(account);
  return account;
}

/**
 * Mark recovery phrase as shown
 */
export async function markRecoveryPhraseShown(): Promise<void> {
  await updateLocalAccount({ recoveryPhraseShown: true });
}

/**
 * Update last sync timestamp
 */
export async function updateLastSyncAt(timestamp: string): Promise<void> {
  await updateLocalAccount({ lastSyncAt: timestamp });
}

/**
 * Get last sync timestamp
 */
export async function getLastSyncAt(): Promise<string | null> {
  const account = await getLocalAccount();
  return account?.lastSyncAt || null;
}
