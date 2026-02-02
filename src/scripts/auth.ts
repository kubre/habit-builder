// ============================================
// Habit Build - Auth & Account Management
// Uses localStorage for instant access
// ============================================

// Storage keys
const ACCOUNT_STORAGE_KEY = 'habit-build-account';
const TOKEN_STORAGE_KEY = 'habit-build-token';

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
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  }
  return null;
}

/**
 * Store the auth token
 */
export function setAuthToken(token: string): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  }
}

/**
 * Clear the auth token
 */
export function clearAuthToken(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

/**
 * Get the local account info (now sync but kept async interface for compatibility)
 */
export async function getLocalAccount(): Promise<LocalAccount | null> {
  if (typeof localStorage === 'undefined') return null;
  
  try {
    const raw = localStorage.getItem(ACCOUNT_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LocalAccount;
  } catch {
    return null;
  }
}

/**
 * Save local account info
 */
export async function saveLocalAccount(account: LocalAccount): Promise<void> {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(account));
    setAuthToken(account.authToken);
  }
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
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(ACCOUNT_STORAGE_KEY);
  }
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
