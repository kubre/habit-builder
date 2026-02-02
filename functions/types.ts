// ============================================
// Habit Build - API Types
// ============================================

// Environment bindings
export interface Env {
  DB: D1Database;
}

// Database models
export interface DBUser {
  id: string;
  name: string;
  friend_code: string;
  auth_token_hash: string;
  recovery_phrase_hash: string;
  created_at: string;
  updated_at: string;
}

export interface DBFriendship {
  id: string;
  requester_id: string;
  recipient_id: string;
  status: 'pending' | 'accepted' | 'denied';
  created_at: string;
  updated_at: string;
}

export interface DBChallenge {
  id: string;
  user_id: string;
  name: string;
  start_date: string;
  duration: number;
  strict_mode: number; // SQLite uses 0/1 for boolean
  status: 'active' | 'completed' | 'failed' | 'abandoned';
  end_date: string | null;
  failed_on_day: number | null;
  visible_to_friends: number;
  share_goals: number;
  share_streak: number;
  share_daily_status: number;
  share_notes: number;
  created_at: string;
  updated_at: string;
}

export interface DBGoal {
  id: string;
  challenge_id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface DBEntry {
  id: string;
  user_id: string;
  challenge_id: string;
  goal_id: string;
  date: string;
  completed: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}

// API Request/Response types
export interface RegisterRequest {
  name: string;
}

export interface RegisterResponse {
  user: {
    id: string;
    name: string;
    friendCode: string;
  };
  authToken: string;
  recoveryPhrase: string[];
}

export interface RecoverRequest {
  recoveryPhrase: string[];
}

export interface RecoverResponse {
  user: {
    id: string;
    name: string;
    friendCode: string;
  };
  authToken: string;
}

export interface UserResponse {
  id: string;
  name: string;
  friendCode: string;
  createdAt: string;
}

export interface FriendInviteRequest {
  friendCode: string;
}

export interface FriendRespondRequest {
  friendshipId: string;
  action: 'accept' | 'deny';
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

export interface SyncPushRequest {
  challenges: SyncChallenge[];
  entries: SyncEntry[];
  lastSyncAt: string | null;
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
  goals: SyncGoal[];
  updatedAt: string;
}

export interface SyncGoal {
  id: string;
  name: string;
  color: string;
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

export interface SyncPullResponse {
  challenges: SyncChallenge[];
  entries: SyncEntry[];
  serverTime: string;
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

export interface FeedResponse {
  items: FeedItem[];
  hasMore: boolean;
}

// Auth context for requests
export interface AuthContext {
  user: DBUser;
}

// API error response
export interface APIError {
  error: string;
  code?: string;
}
