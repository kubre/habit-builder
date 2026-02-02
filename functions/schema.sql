-- Habit Build Database Schema
-- Cloudflare D1 (SQLite)

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  friend_code TEXT UNIQUE NOT NULL,
  auth_token_hash TEXT NOT NULL,
  recovery_phrase_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Friendships (mutual relationship)
CREATE TABLE IF NOT EXISTS friendships (
  id TEXT PRIMARY KEY,
  requester_id TEXT NOT NULL,
  recipient_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'denied')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(requester_id, recipient_id)
);

-- Challenges (synced from local)
CREATE TABLE IF NOT EXISTS challenges (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  duration INTEGER NOT NULL,
  strict_mode INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'failed', 'abandoned')),
  end_date TEXT,
  failed_on_day INTEGER,
  visible_to_friends INTEGER NOT NULL DEFAULT 0,
  share_goals INTEGER NOT NULL DEFAULT 1,
  share_streak INTEGER NOT NULL DEFAULT 1,
  share_daily_status INTEGER NOT NULL DEFAULT 1,
  share_notes INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Goals (part of challenges)
CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  challenge_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Entries (daily check-ins)
CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  challenge_id TEXT NOT NULL,
  goal_id TEXT NOT NULL,
  date TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE,
  FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE,
  UNIQUE(goal_id, date)
);

-- Sync log (track last sync per user)
CREATE TABLE IF NOT EXISTS sync_log (
  user_id TEXT PRIMARY KEY,
  last_sync_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_friend_code ON users(friend_code);
CREATE INDEX IF NOT EXISTS idx_users_auth_token ON users(auth_token_hash);
CREATE INDEX IF NOT EXISTS idx_friendships_recipient ON friendships(recipient_id, status);
CREATE INDEX IF NOT EXISTS idx_friendships_requester ON friendships(requester_id, status);
CREATE INDEX IF NOT EXISTS idx_challenges_user ON challenges(user_id);
CREATE INDEX IF NOT EXISTS idx_challenges_visible ON challenges(user_id, visible_to_friends);
CREATE INDEX IF NOT EXISTS idx_goals_challenge ON goals(challenge_id);
CREATE INDEX IF NOT EXISTS idx_entries_user_date ON entries(user_id, date);
CREATE INDEX IF NOT EXISTS idx_entries_challenge ON entries(challenge_id);
CREATE INDEX IF NOT EXISTS idx_entries_goal_date ON entries(goal_id, date);
