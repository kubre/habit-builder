// ============================================
// Habit Build - Data Caching Layer
// ============================================

/**
 * Cache entry with TTL support
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

/**
 * Cache configuration for different data types
 */
export const CACHE_TTL = {
  // User's own data - short TTL as it changes frequently
  challenges: 5 * 60 * 1000,        // 5 minutes
  entries: 5 * 60 * 1000,           // 5 minutes
  currentChallenge: 5 * 60 * 1000,  // 5 minutes
  
  // Social data - can be cached longer
  friends: 15 * 60 * 1000,          // 15 minutes
  friendRequests: 5 * 60 * 1000,    // 5 minutes
  feed: 10 * 60 * 1000,             // 10 minutes
  
  // User profile - rarely changes
  account: 60 * 60 * 1000,          // 1 hour
} as const;

/**
 * In-memory cache store
 */
const memoryCache = new Map<string, CacheEntry<unknown>>();

/**
 * Cache version for invalidation
 */
let cacheVersion = 1;

/**
 * Generate a cache key
 */
function getCacheKey(namespace: string, key?: string): string {
  return key ? `${namespace}:${key}:v${cacheVersion}` : `${namespace}:v${cacheVersion}`;
}

/**
 * Get data from cache
 */
export function getFromCache<T>(namespace: string, key?: string): T | null {
  const cacheKey = getCacheKey(namespace, key);
  const entry = memoryCache.get(cacheKey) as CacheEntry<T> | undefined;
  
  if (!entry) {
    return null;
  }
  
  // Check if expired
  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(cacheKey);
    return null;
  }
  
  return entry.data;
}

/**
 * Set data in cache with TTL
 */
export function setInCache<T>(
  namespace: string, 
  data: T, 
  ttl: number,
  key?: string
): void {
  const cacheKey = getCacheKey(namespace, key);
  const now = Date.now();
  
  memoryCache.set(cacheKey, {
    data,
    timestamp: now,
    expiresAt: now + ttl,
  });
}

/**
 * Invalidate specific cache entry
 */
export function invalidateCache(namespace: string, key?: string): void {
  const cacheKey = getCacheKey(namespace, key);
  memoryCache.delete(cacheKey);
}

/**
 * Invalidate all entries in a namespace
 */
export function invalidateNamespace(namespace: string): void {
  const prefix = `${namespace}:`;
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix) || key === `${namespace}:v${cacheVersion}`) {
      memoryCache.delete(key);
    }
  }
}

/**
 * Invalidate all cache (bump version)
 */
export function invalidateAllCache(): void {
  cacheVersion++;
  memoryCache.clear();
}

/**
 * Invalidate caches related to user's own data
 * Call this when user makes changes to their data
 */
export function invalidateUserDataCache(): void {
  invalidateNamespace('challenges');
  invalidateNamespace('entries');
  invalidateNamespace('currentChallenge');
  invalidateNamespace('stats');
}

/**
 * Invalidate social/friend-related caches
 * Call this when friend relationships change
 */
export function invalidateSocialCache(): void {
  invalidateNamespace('friends');
  invalidateNamespace('friendRequests');
  invalidateNamespace('feed');
}

/**
 * Cache wrapper for async functions
 * Provides automatic caching with configurable TTL
 */
export async function withCache<T>(
  namespace: string,
  ttl: number,
  fetcher: () => Promise<T>,
  key?: string
): Promise<T> {
  // Try to get from cache first
  const cached = getFromCache<T>(namespace, key);
  if (cached !== null) {
    return cached;
  }
  
  // Fetch fresh data
  const data = await fetcher();
  
  // Store in cache
  setInCache(namespace, data, ttl, key);
  
  return data;
}

/**
 * Check if cache entry exists and is valid
 */
export function isCached(namespace: string, key?: string): boolean {
  return getFromCache(namespace, key) !== null;
}

/**
 * Get cache statistics (useful for debugging)
 */
export function getCacheStats(): { entries: number; namespaces: Set<string> } {
  const namespaces = new Set<string>();
  
  for (const key of memoryCache.keys()) {
    const namespace = key.split(':')[0];
    namespaces.add(namespace);
  }
  
  return {
    entries: memoryCache.size,
    namespaces,
  };
}

/**
 * Force refresh a cached value, bypassing and updating the cache
 */
export async function forceRefresh<T>(
  namespace: string,
  ttl: number,
  fetcher: () => Promise<T>,
  key?: string
): Promise<T> {
  // Invalidate existing cache
  invalidateCache(namespace, key);
  
  // Fetch fresh data
  const data = await fetcher();
  
  // Store in cache
  setInCache(namespace, data, ttl, key);
  
  return data;
}

/**
 * Prefetch and cache data in background
 * Useful for preloading data before user navigates
 */
export function prefetch<T>(
  namespace: string,
  ttl: number,
  fetcher: () => Promise<T>,
  key?: string
): void {
  // Only prefetch if not already cached
  if (!isCached(namespace, key)) {
    // Fire and forget - don't await
    fetcher()
      .then(data => setInCache(namespace, data, ttl, key))
      .catch(() => {/* Silently ignore prefetch failures */});
  }
}
