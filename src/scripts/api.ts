// ============================================
// Habit Build - API Client
// ============================================

import { getAuthToken } from './auth';
import { 
  withCache, 
  invalidateSocialCache, 
  CACHE_TTL,
  forceRefresh 
} from './cache';

// API base URL - will be same origin in production
const API_BASE = '/api';

// API response types
export interface APIResponse<T> {
  data?: T;
  error?: string;
  code?: string;
}

export interface User {
  id: string;
  name: string;
  friendCode: string;
  createdAt?: string;
}

export interface RegisterResponse {
  user: User;
  authToken: string;
  recoveryPhrase: string[];
}

export interface RecoverResponse {
  user: User;
  authToken: string;
}

export interface FriendRequest {
  id: string;
  from: {
    id: string;
    name: string;
    friendCode: string;
  };
  createdAt: string;
}

export interface Friend {
  id: string;
  name: string;
  friendCode: string;
  friendshipId: string;
  since: string;
}

export interface FeedItem {
  id: string;
  friend: {
    id: string;
    name: string;
  };
  challenge: {
    id: string;
    name: string;
    currentDay: number;
    totalDays: number;
  };
  date: string;
  completedGoals: number;
  totalGoals: number;
  streak: number;
  timestamp: string;
}

export interface SyncChallenge {
  id: string;
  name: string;
  startDate: string;
  duration: number;
  strictMode: boolean;
  status: 'active' | 'completed' | 'failed' | 'abandoned';
  endDate?: string;
  failedOnDay?: number;
  visibleToFriends: boolean;
  shareGoals: boolean;
  shareStreak: boolean;
  shareDailyStatus: boolean;
  shareNotes: boolean;
  goals: { id: string; name: string; color: string }[];
  updatedAt: string;
}

export interface SyncEntry {
  id: string;
  challengeId: string;
  goalId: string;
  date: string;
  completed: boolean;
  note?: string;
  updatedAt: string;
}

/**
 * Make an API request
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<APIResponse<T>> {
  const token = getAuthToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }
  
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return {
        error: data.error || 'Request failed',
        code: data.code,
      };
    }
    
    return { data };
  } catch (error) {
    console.error('API request failed:', error);
    return {
      error: 'Network error',
      code: 'NETWORK_ERROR',
    };
  }
}

// ============================================
// Auth API
// ============================================

/**
 * Register a new account
 */
export async function register(name: string): Promise<APIResponse<RegisterResponse>> {
  return apiRequest<RegisterResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

/**
 * Recover account with recovery phrase
 */
export async function recover(recoveryPhrase: string[]): Promise<APIResponse<RecoverResponse>> {
  return apiRequest<RecoverResponse>('/auth/recover', {
    method: 'POST',
    body: JSON.stringify({ recoveryPhrase }),
  });
}

/**
 * Get current user info
 */
export async function getCurrentUser(): Promise<APIResponse<User>> {
  return apiRequest<User>('/auth/me');
}

// ============================================
// Friends API
// ============================================

/**
 * Send friend request by friend code
 */
export async function sendFriendRequest(friendCode: string): Promise<APIResponse<{ message: string; status: string; recipientName?: string }>> {
  return apiRequest('/friends/invite', {
    method: 'POST',
    body: JSON.stringify({ friendCode }),
  });
}

/**
 * Get pending friend requests (cached)
 */
export async function getFriendRequests(forceReload = false): Promise<APIResponse<{ requests: FriendRequest[] }>> {
  const fetcher = () => apiRequest<{ requests: FriendRequest[] }>('/friends/requests');
  
  if (forceReload) {
    return forceRefresh('friendRequests', CACHE_TTL.friendRequests, fetcher);
  }
  
  return withCache('friendRequests', CACHE_TTL.friendRequests, fetcher);
}

/**
 * Respond to friend request
 */
export async function respondToFriendRequest(
  friendshipId: string,
  action: 'accept' | 'deny'
): Promise<APIResponse<{ message: string; status: string }>> {
  const result = await apiRequest<{ message: string; status: string }>('/friends/respond', {
    method: 'POST',
    body: JSON.stringify({ friendshipId, action }),
  });
  
  // Invalidate social cache on successful response
  if (!result.error) {
    invalidateSocialCache();
  }
  
  return result;
}

/**
 * Get list of friends (cached)
 */
export async function getFriends(forceReload = false): Promise<APIResponse<{ friends: Friend[] }>> {
  const fetcher = () => apiRequest<{ friends: Friend[] }>('/friends/list');
  
  if (forceReload) {
    return forceRefresh('friends', CACHE_TTL.friends, fetcher);
  }
  
  return withCache('friends', CACHE_TTL.friends, fetcher);
}

/**
 * Remove a friend
 */
export async function removeFriend(friendshipId: string): Promise<APIResponse<{ message: string }>> {
  const result = await apiRequest<{ message: string }>('/friends/remove', {
    method: 'POST',
    body: JSON.stringify({ friendshipId }),
  });
  
  // Invalidate social cache on successful removal
  if (!result.error) {
    invalidateSocialCache();
  }
  
  return result;
}

// ============================================
// Sync API
// ============================================

/**
 * Push local changes to server
 */
export async function syncPush(data: {
  challenges: SyncChallenge[];
  entries: SyncEntry[];
  lastSyncAt: string | null;
}): Promise<APIResponse<{ success: boolean; syncedAt: string }>> {
  return apiRequest('/sync/push', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Pull changes from server
 */
export async function syncPull(since?: string): Promise<APIResponse<{
  challenges: SyncChallenge[];
  entries: SyncEntry[];
  serverTime: string;
}>> {
  const params = since ? `?since=${encodeURIComponent(since)}` : '';
  return apiRequest(`/sync/pull${params}`);
}

// ============================================
// Feed API
// ============================================

/**
 * Get friends' activity feed (cached)
 */
export async function getFeed(limit = 20, offset = 0, forceReload = false): Promise<APIResponse<{
  items: FeedItem[];
  hasMore: boolean;
}>> {
  const fetcher = () => apiRequest<{ items: FeedItem[]; hasMore: boolean }>(`/feed?limit=${limit}&offset=${offset}`);
  const cacheKey = `${limit}-${offset}`;
  
  if (forceReload) {
    return forceRefresh('feed', CACHE_TTL.feed, fetcher, cacheKey);
  }
  
  return withCache('feed', CACHE_TTL.feed, fetcher, cacheKey);
}

/**
 * Refresh all social data (friends, requests, feed)
 * Call this when user manually triggers a refresh
 */
export async function refreshAllSocialData(): Promise<void> {
  invalidateSocialCache();
}
