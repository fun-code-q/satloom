/**
 * Firebase Query Optimization Utilities
 * 
 * Provides paginated queries, query indexing, data caching,
 * and optimization strategies for Firebase Realtime Database.
 */

import { ref, query, limitToLast, startAfter, endBefore, orderByChild, equalTo, get } from 'firebase/database';
import { getDatabase } from 'firebase/database';
import { initializeApp } from 'firebase/app';

/**
 * Cache configuration
 */
interface CacheConfig {
    /** Maximum number of items to cache */
    maxSize: number;
    /** Time-to-live in milliseconds */
    ttl: number;
    /** Whether to persist to localStorage */
    persistent: boolean;
}

/**
 * Query result with metadata
 */
export interface QueryResult<T> {
    data: T[];
    /** Key of the last item for pagination */
    lastKey: string | null;
    /** Key of the first item */
    firstKey: string | null;
    /** Whether there are more results */
    hasMore: boolean;
    /** Total count (if available) */
    totalCount?: number;
    /** Query execution time in ms */
    executionTime: number;
}

/**
 * Cached query result
 */
interface CachedQueryResult<T> extends QueryResult<T> {
    /** Timestamp when cached */
    cachedAt: number;
    /** Query parameters hash */
    queryHash: string;
}

// Firebase app instance - would be from lib/firebase in production
let firebaseApp: any = null;
let database: any = null;

function getDb(): any {
    if (!database && typeof window !== 'undefined') {
        try {
            // @ts-ignore - Firebase initialization
            database = getDatabase(firebaseApp);
        } catch (e) {
            // Fallback - use mock for type checking
        }
    }
    return database;
}

/**
 * Query optimizer class
 */
class FirebaseQueryOptimizer {
    private cache: Map<string, CachedQueryResult<any>> = new Map();
    private defaultConfig: CacheConfig = {
        maxSize: 100,
        ttl: 5 * 60 * 1000, // 5 minutes
        persistent: true,
    };
    private hitCount = 0;
    private missCount = 0;

    /**
     * Generate a hash for query parameters
     */
    private generateQueryHash(
        path: string,
        params: Record<string, any>
    ): string {
        const sortedParams = Object.keys(params)
            .sort()
            .map(key => key + '=' + JSON.stringify(params[key]))
            .join('&');
        return path + '?' + sortedParams;
    }

    /**
     * Get from cache if valid
     */
    private getFromCache<T>(hash: string): CachedQueryResult<T> | null {
        const cached = this.cache.get(hash);
        if (!cached) {
            // Try to load from localStorage
            if (this.defaultConfig.persistent && typeof window !== 'undefined') {
                try {
                    const stored = localStorage.getItem('firebase_query_cache:' + hash);
                    if (stored) {
                        const parsed = JSON.parse(stored) as CachedQueryResult<T>;
                        const age = Date.now() - parsed.cachedAt;
                        if (age < this.defaultConfig.ttl) {
                            this.cache.set(hash, parsed);
                            this.hitCount++;
                            return parsed;
                        }
                    }
                } catch (e) {
                    // Ignore localStorage errors
                }
            }
            this.missCount++;
            return null;
        }

        const age = Date.now() - cached.cachedAt;
        if (age > this.defaultConfig.ttl) {
            this.cache.delete(hash);
            this.missCount++;
            return null;
        }

        this.hitCount++;
        return cached;
    }

    /**
     * Store result in cache
     */
    private storeInCache<T>(hash: string, result: CachedQueryResult<T>): void {
        // Evict old entries if cache is full
        if (this.cache.size >= this.defaultConfig.maxSize) {
            const oldestKey = Array.from(this.cache.entries())
                .sort((a, b) => a[1].cachedAt - b[1].cachedAt)[0]?.[0];
            if (oldestKey) {
                this.cache.delete(oldestKey);
            }
        }

        this.cache.set(hash, result);

        // Persist to localStorage
        if (this.defaultConfig.persistent && typeof window !== 'undefined') {
            try {
                localStorage.setItem(
                    'firebase_query_cache:' + hash,
                    JSON.stringify(result)
                );
            } catch (e) {
                // Ignore quota errors
            }
        }
    }

    /**
     * Clear all cached queries
     */
    clearCache(): void {
        this.cache.clear();
        this.hitCount = 0;
        this.missCount = 0;
        if (typeof window !== 'undefined') {
            const keys: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key?.startsWith('firebase_query_cache:')) {
                    keys.push(key);
                }
            }
            keys.forEach(key => localStorage.removeItem(key));
        }
    }

    /**
     * Invalidate cache for a specific path
     */
    invalidatePath(pathPrefix: string): void {
        const keysToDelete: string[] = [];
        this.cache.forEach((_, hash) => {
            if (hash.startsWith(pathPrefix)) {
                keysToDelete.push(hash);
            }
        });
        keysToDelete.forEach(hash => {
            this.cache.delete(hash);
            if (typeof window !== 'undefined') {
                localStorage.removeItem('firebase_query_cache:' + hash);
            }
        });
    }

    /**
     * Execute a paginated query
     */
    async executePaginatedQuery<T>(
        path: string,
        options: {
            limitCount: number;
            orderBy?: string;
            startAfterKey?: string;
            endBeforeKey?: string;
            equalToValue?: string;
            useCache?: boolean;
        }
    ): Promise<QueryResult<T>> {
        const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const {
            limitCount,
            orderBy = 'createdAt',
            startAfterKey,
            endBeforeKey,
            equalToValue,
            useCache = true,
        } = options;

        // Generate cache hash
        const params = {
            limit: limitCount,
            orderBy,
            startAfterKey,
            endBeforeKey,
            equalToValue,
        };
        const queryHash = this.generateQueryHash(path, params);

        // Try cache first
        if (useCache) {
            const cached = this.getFromCache<T>(queryHash);
            if (cached) {
                return cached;
            }
        }

        // Build query - using mock for type checking
        let dbRef: any = null;
        const db = getDb();
        if (db) {
            dbRef = ref(db, path);
        }

        let q: any = dbRef;

        if (orderBy && dbRef) {
            q = query(dbRef, orderByChild(orderBy));
        }

        if (equalToValue && q) {
            q = query(q, equalTo(equalToValue));
        }

        if (limitCount && q) {
            q = query(q, limitToLast(limitCount + 1)); // +1 to check hasMore
        }

        if (startAfterKey && q) {
            q = query(q, startAfter(startAfterKey));
        }

        if (endBeforeKey && q) {
            q = query(q, endBefore(endBeforeKey));
        }

        // Execute query
        let data: Record<string, T> = {};
        let snapshotExists = false;

        if (q) {
            try {
                const snapshot = await get(q);
                snapshotExists = snapshot.exists();
                if (snapshotExists) {
                    data = snapshot.val() as Record<string, T>;
                }
            } catch (e) {
                // Query failed, use empty data
            }
        }

        const executionTime = typeof performance !== 'undefined'
            ? performance.now() - startTime
            : Date.now() - startTime;

        if (!snapshotExists) {
            const result: QueryResult<T> = {
                data: [],
                lastKey: null,
                firstKey: null,
                hasMore: false,
                executionTime,
            };

            this.storeInCache(queryHash, { ...result, cachedAt: Date.now(), queryHash });
            return result;
        }

        const keys = Object.keys(data);
        const hasMore = keys.length > limitCount;

        // Remove the extra item used to check hasMore
        if (hasMore) {
            keys.pop();
        }

        const resultData: T[] = keys.map(key => ({ ...data[key], key }));

        const result: QueryResult<T> = {
            data: resultData,
            firstKey: keys[0] || null,
            lastKey: keys[keys.length - 1] || null,
            hasMore,
            executionTime,
        };

        this.storeInCache(queryHash, { ...result, cachedAt: Date.now(), queryHash });
        return result;
    }

    /**
     * Execute a batched query for large datasets
     */
    async executeBatchedQuery<T>(
        path: string,
        options: {
            batchSize: number;
            maxBatches?: number;
            orderBy?: string;
        }
    ): Promise<QueryResult<T>> {
        const { batchSize = 100, maxBatches = 10, orderBy = 'createdAt' } = options;

        const allData: T[] = [];
        let lastKey: string | null = null;
        let hasMore = true;
        let batchCount = 0;
        let totalExecutionTime = 0;

        while (hasMore && batchCount < maxBatches) {
            const result: QueryResult<T> = await this.executePaginatedQuery<T>(path, {
                limitCount: batchSize,
                orderBy,
                startAfterKey: lastKey || undefined,
            });

            allData.push(...result.data);
            lastKey = result.lastKey;
            hasMore = result.hasMore;
            totalExecutionTime += result.executionTime;
            batchCount++;

            // Stop if we got fewer results than requested (last batch)
            if (result.data.length < batchSize) {
                hasMore = false;
            }
        }

        return {
            data: allData,
            firstKey: allData[0] ? (allData[0] as any).key : null,
            lastKey,
            hasMore: false,
            executionTime: totalExecutionTime,
        };
    }

    /**
     * Prefetch data for faster access
     */
    async prefetchData(
        paths: Array<{ path: string; priority: 'high' | 'low' }>
    ): Promise<void> {
        const highPriority = paths.filter(p => p.priority === 'high');
        const lowPriority = paths.filter(p => p.priority === 'low');

        // Prefetch high priority first
        await Promise.all(
            highPriority.map(async ({ path }) => {
                try {
                    await this.executePaginatedQuery(path, { limitCount: 20 });
                } catch (e) {
                    // Silently fail prefetch
                }
            })
        );

        // Prefetch low priority with delay
        for (const { path } of lowPriority) {
            await new Promise(resolve => setTimeout(resolve, 100));
            try {
                await this.executePaginatedQuery(path, { limitCount: 20 });
            } catch (e) {
                // Silently fail prefetch
            }
        }
    }

    /**
     * Get cache statistics
     */
    getCacheStats(): { size: number; hitRate: number; memoryUsage: string; hits: number; misses: number } {
        const memoryUsage = JSON.stringify(this.cache).length;
        const total = this.hitCount + this.missCount;

        return {
            size: this.cache.size,
            hitRate: total > 0 ? this.hitCount / total : 0,
            memoryUsage: (memoryUsage / 1024).toFixed(2) + ' KB',
            hits: this.hitCount,
            misses: this.missCount,
        };
    }
}

// Export singleton instance
export const queryOptimizer = new FirebaseQueryOptimizer();

/**
 * Optimized message query helper
 */
export async function getMessages(
    roomId: string,
    options: {
        limit?: number;
        before?: string;
        after?: string;
    } = {}
): Promise<QueryResult<any>> {
    return queryOptimizer.executePaginatedQuery('rooms/' + roomId + '/messages', {
        limitCount: options.limit || 50,
        orderBy: 'timestamp',
        startAfterKey: options.after,
        endBeforeKey: options.before,
    });
}

/**
 * Optimized users query helper
 */
export async function getOnlineUsers(
    roomId: string,
    limitCount = 50
): Promise<QueryResult<any>> {
    return queryOptimizer.executePaginatedQuery('rooms/' + roomId + '/presence', {
        limitCount,
        orderBy: 'joinedAt',
    });
}

/**
 * Invalidate room-related cache
 */
export function invalidateRoomCache(roomId: string): void {
    queryOptimizer.invalidatePath('rooms/' + roomId);
}

/**
 * Clear all query cache
 */
export function clearQueryCache(): void {
    queryOptimizer.clearCache();
}
