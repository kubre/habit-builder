// ============================================
// Habit Build - TypeScript Types
// ============================================

export interface Goal {
  id: string;
  name: string;
  color: GoalColor;
}

export type GoalColor = 
  | 'coral' 
  | 'sage' 
  | 'gold' 
  | 'slate' 
  | 'sky' 
  | 'plum';

export const GOAL_COLORS: GoalColor[] = [
  'coral', 'sage', 'gold', 'slate', 'sky', 'plum'
];

export type ChallengeStatus = 
  | 'active' 
  | 'completed' 
  | 'failed' 
  | 'abandoned';

export interface Challenge {
  id: string;
  name: string;
  startDate: string;      // ISO date YYYY-MM-DD
  duration: number;       // days (default 75)
  strictMode: boolean;    // reset on miss
  goals: Goal[];
  status: ChallengeStatus;
  endDate?: string;       // when completed/failed
  failedOnDay?: number;   // if strict mode failed
}

export interface DayEntry {
  date: string;           // ISO date YYYY-MM-DD
  goalId: string;
  completed: boolean;
  note?: string;
}

export interface AppState {
  currentChallengeId: string | null;
  challenges: Challenge[];
  entries: DayEntry[];
}

// Duration presets
export const DURATION_PRESETS = [
  { value: 21, label: '21 days', description: 'Quick start' },
  { value: 30, label: '30 days', description: 'One month' },
  { value: 66, label: '66 days', description: 'Habit formation average' },
  { value: 75, label: '75 days', description: '75 Hard standard' },
  { value: 100, label: '100 days', description: 'Century challenge' },
] as const;

// Default values
export const DEFAULT_DURATION = 75;
export const MAX_GOALS = 5;
export const MIN_GOALS = 1;

// Database name (for IndexedDB)
export const DB_NAME = 'habit-build-db';
