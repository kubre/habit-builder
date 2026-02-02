// ============================================
// Habit Build - API Utilities
// ============================================

/**
 * Generate a random UUID
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Generate a friend code (HABIT-XXXX format)
 */
export function generateFriendCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude similar chars (0/O, 1/I)
  let code = '';
  const randomValues = crypto.getRandomValues(new Uint8Array(4));
  for (let i = 0; i < 4; i++) {
    code += chars[randomValues[i] % chars.length];
  }
  return `HABIT-${code}`;
}

/**
 * Generate a secure auth token
 */
export function generateAuthToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Hash a string using SHA-256
 */
export async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * BIP39-style word list (simplified - 256 common words)
 * In production, use the full 2048-word BIP39 list
 */
export const WORD_LIST = [
  'apple', 'arrow', 'badge', 'beach', 'bells', 'berry', 'birds', 'bloom',
  'blush', 'board', 'boats', 'books', 'brace', 'bread', 'brick', 'bride',
  'brush', 'cabin', 'cable', 'cakes', 'camps', 'candy', 'cards', 'cargo',
  'carry', 'caves', 'chain', 'chalk', 'charm', 'chase', 'chess', 'chips',
  'choir', 'chops', 'cider', 'cinch', 'civic', 'claim', 'clamp', 'class',
  'clean', 'clear', 'clerk', 'click', 'cliff', 'climb', 'cling', 'clock',
  'close', 'cloth', 'cloud', 'clown', 'clubs', 'coach', 'coast', 'cocoa',
  'coral', 'couch', 'cover', 'craft', 'crane', 'crash', 'crate', 'cream',
  'creek', 'crest', 'crisp', 'crops', 'cross', 'crowd', 'crown', 'crush',
  'curve', 'cycle', 'dairy', 'dance', 'deals', 'delta', 'denim', 'depth',
  'disco', 'diver', 'dodge', 'doing', 'dolls', 'donor', 'doors', 'dough',
  'downs', 'dozen', 'draft', 'drain', 'drake', 'drama', 'drank', 'drape',
  'dream', 'dress', 'dried', 'drift', 'drill', 'drink', 'drive', 'drops',
  'dunes', 'dwarf', 'eager', 'eagle', 'early', 'earth', 'easel', 'eaten',
  'edges', 'elder', 'elite', 'ember', 'empty', 'enjoy', 'enter', 'entry',
  'equal', 'equip', 'erupt', 'essay', 'evade', 'event', 'every', 'exact',
  'exams', 'exits', 'extra', 'fable', 'faces', 'facts', 'faint', 'fairy',
  'faith', 'falls', 'false', 'fancy', 'farms', 'fatal', 'favor', 'feast',
  'fence', 'ferry', 'fetch', 'fever', 'fiber', 'field', 'fifth', 'fifty',
  'fight', 'fills', 'films', 'final', 'finch', 'finds', 'fired', 'firms',
  'first', 'fixed', 'flame', 'flash', 'flask', 'flats', 'flesh', 'flies',
  'fling', 'flint', 'float', 'flock', 'flood', 'floor', 'flora', 'flour',
  'fluid', 'flush', 'focal', 'focus', 'folks', 'force', 'forge', 'forms',
  'forth', 'forum', 'found', 'frame', 'frank', 'fraud', 'fresh', 'fried',
  'frizz', 'front', 'frost', 'fruit', 'fuels', 'fully', 'funds', 'funny',
  'fuzzy', 'gains', 'games', 'gangs', 'gases', 'gauge', 'gazer', 'gears',
  'geese', 'gems', 'genes', 'genre', 'ghost', 'giant', 'gifts', 'girls',
  'given', 'gives', 'glade', 'gland', 'glare', 'glass', 'gleam', 'globe',
  'gloom', 'glory', 'gloss', 'glove', 'glyph', 'gnome', 'goats', 'godly',
  'going', 'golfs', 'goods', 'goose', 'gorge', 'grace', 'grade', 'grain',
  'grand', 'grant', 'grape', 'graph', 'grasp', 'grass', 'grave', 'grays',
  'graze', 'great', 'green', 'greet', 'grief', 'grill', 'grind', 'grips',
];

/**
 * Generate a 12-word recovery phrase
 */
export function generateRecoveryPhrase(): string[] {
  const words: string[] = [];
  const randomValues = crypto.getRandomValues(new Uint8Array(12));
  for (let i = 0; i < 12; i++) {
    const index = randomValues[i] % WORD_LIST.length;
    words.push(WORD_LIST[index]);
  }
  return words;
}

/**
 * Hash recovery phrase for storage
 */
export async function hashRecoveryPhrase(phrase: string[]): Promise<string> {
  return hashString(phrase.join(' ').toLowerCase());
}

/**
 * Create a JSON response
 * Note: CORS headers are now handled by middleware for proper origin validation
 */
export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Create an error response
 */
export function errorResponse(message: string, status = 400, code?: string): Response {
  return jsonResponse({ error: message, code }, status);
}

/**
 * Parse JSON body from request
 */
export async function parseBody<T>(request: Request): Promise<T | null> {
  try {
    return await request.json() as T;
  } catch {
    return null;
  }
}

/**
 * Get current ISO timestamp
 */
export function nowISO(): string {
  return new Date().toISOString();
}

/**
 * Validate auth token from request header
 */
export function getAuthToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

/**
 * UUID validation regex pattern
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validate that a string is a valid UUID format
 */
export function isValidUUID(str: string): boolean {
  return UUID_PATTERN.test(str);
}

/**
 * Friend code validation regex pattern (HABIT-XXXX format)
 * Characters: A-Z excluding I/O, digits 2-9 excluding 0/1
 */
const FRIEND_CODE_PATTERN = /^HABIT-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/;

/**
 * Validate that a string is a valid friend code format
 */
export function isValidFriendCode(str: string): boolean {
  return FRIEND_CODE_PATTERN.test(str);
}
