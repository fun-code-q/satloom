/**
 * Code Splitting Utilities for Performance Optimization
 * 
 * Provides route-based and component-based code splitting,
 * chunk management, and dynamic loading strategies.
 */

interface ChunkInfo {
    id: string;
    size: number;
    loaded: boolean;
    loading: boolean;
    dependencies: string[];
}

/**
 * Dynamic import configuration for code splitting
 */
export interface DynamicImportConfig {
    /** Unique name for the chunk */
    name: string;
    /** Function that returns a Promise for the module */
    importer: () => Promise<any>;
    /** Whether to preload this chunk */
    preload?: boolean;
    /** Whether this is a critical chunk */
    critical?: boolean;
    /** Dependencies on other chunks */
    dependencies?: string[];
}

/**
 * Chunk manager for tracking loaded chunks
 */
class ChunkManager {
    private chunks: Map<string, ChunkInfo> = new Map();
    private preloadQueue: string[] = [];
    private maxConcurrentLoads = 3;
    private currentLoads = 0;

    /**
     * Register a new chunk
     */
    registerChunk(config: DynamicImportConfig): void {
        const info: ChunkInfo = {
            id: config.name,
            size: 0,
            loaded: false,
            loading: false,
            dependencies: config.dependencies || [],
        };
        this.chunks.set(config.name, info);

        // Preload if marked as critical
        if (config.critical) {
            this.preload(config.name);
        }
    }

    /**
     * Load a chunk dynamically
     */
    async loadChunk(name: string): Promise<any> {
        const chunk = this.chunks.get(name);
        if (!chunk) {
            throw new Error('Chunk not found: ' + name);
        }

        // Return cached module if already loaded
        if (chunk.loaded) {
            return this.getModule(name);
        }

        // Wait for loading if already in progress
        if (chunk.loading) {
            return new Promise<any>((resolve, reject) => {
                const checkLoaded = setInterval(() => {
                    const updatedChunk = this.chunks.get(name);
                    if (updatedChunk?.loaded) {
                        clearInterval(checkLoaded);
                        this.getModule(name).then(resolve).catch(reject);
                    }
                }, 50);
                // Timeout after 30 seconds
                setTimeout(() => {
                    clearInterval(checkLoaded);
                    reject(new Error('Chunk load timeout: ' + name));
                }, 30000);
            });
        }

        // Check dependencies first
        await this.loadDependencies(chunk.dependencies);

        // Start loading
        chunk.loading = true;
        this.currentLoads++;

        try {
            // This would be replaced with actual dynamic import in usage
            const module = await this.executeImport(name);
            chunk.loaded = true;
            chunk.loading = false;
            this.currentLoads--;

            return module;
        } catch (error) {
            chunk.loading = false;
            this.currentLoads--;
            throw error;
        }
    }

    /**
     * Load chunk dependencies
     */
    private async loadDependencies(dependencies: string[]): Promise<void> {
        const unloadedDeps = dependencies.filter(dep => {
            const chunk = this.chunks.get(dep);
            return chunk && !chunk.loaded;
        });

        await Promise.all(unloadedDeps.map(dep => this.loadChunk(dep)));
    }

    /**
     * Preload a chunk for faster subsequent access
     */
    async preload(name: string): Promise<void> {
        const chunk = this.chunks.get(name);
        if (!chunk || chunk.loaded || chunk.loading) return;

        // Add to preload queue
        if (!this.preloadQueue.includes(name)) {
            this.preloadQueue.push(name);
        }

        // Process preload queue
        await this.processPreloadQueue();
    }

    /**
     * Process preload queue with concurrency limit
     */
    private async processPreloadQueue(): Promise<void> {
        while (this.preloadQueue.length > 0 && this.currentLoads < this.maxConcurrentLoads) {
            const name = this.preloadQueue.shift()!;
            const chunk = this.chunks.get(name);
            if (chunk && !chunk.loaded && !chunk.loading) {
                this.loadChunk(name).catch(() => {
                    // Silently fail preload
                });
            }
        }
    }

    /**
     * Get cached module
     */
    private async getModule(name: string): Promise<any> {
        // In real implementation, this would return cached module
        return null;
    }

    /**
     * Execute dynamic import (placeholder for actual implementation)
     */
    private async executeImport(name: string): Promise<any> {
        return null;
    }

    /**
     * Get chunk status for debugging
     */
    getChunkStatus(): ChunkInfo[] {
        return Array.from(this.chunks.values());
    }

    /**
     * Get total loaded size
     */
    getTotalLoadedSize(): number {
        return Array.from(this.chunks.values())
            .filter(chunk => chunk.loaded)
            .reduce((total, chunk) => total + chunk.size, 0);
    }

    /**
     * Unload unused chunks to free memory
     */
    unloadUnused(keep: string[]): void {
        for (const [name, chunk] of this.chunks) {
            if (!keep.includes(name) && chunk.loaded) {
                chunk.loaded = false;
                // In real implementation, would also clear module cache
            }
        }
    }
}

// Global chunk manager instance
export const chunkManager = new ChunkManager();

// Predefined chunk configurations
export const chunkConfigs: DynamicImportConfig[] = [
    {
        name: 'pdf-viewer',
        // @ts-ignore - Dynamic import for optional dependency
        importer: () => import('react-pdf'),
        preload: true,
        critical: false,
    },
    {
        name: 'monaco-editor',
        // @ts-ignore - Dynamic import for optional dependency
        importer: () => import('@monaco-editor/react'),
        preload: false,
        critical: false,
    },
    {
        name: 'three-fiber',
        // @ts-ignore - Dynamic import for optional dependency
        importer: () => import('@react-three/fiber'),
        preload: false,
        critical: false,
    },
    {
        name: 'calendar',
        // @ts-ignore - Dynamic import for optional dependency
        importer: () => import('react-big-calendar'),
        preload: false,
        critical: false,
    },
];

// Register all predefined chunks
chunkConfigs.forEach(config => chunkManager.registerChunk(config));

/**
 * Load chunk with error handling
 */
export async function loadChunkSafe(name: string): Promise<any> {
    try {
        return await chunkManager.loadChunk(name);
    } catch (error) {
        console.error('Failed to load chunk: ' + name, error);
        return null;
    }
}

/**
 * Preload multiple chunks
 */
export async function preloadChunks(names: string[]): Promise<void> {
    await Promise.all(names.map(name => chunkManager.preload(name)));
}

/**
 * Priority-based chunk loading
 */
export async function loadWithPriority(
    chunks: Array<{ name: string; priority: 'high' | 'medium' | 'low' }>
): Promise<Map<string, any>> {
    const results = new Map<string, any>();

    // Sort by priority
    const sorted = chunks.sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    // Load high priority first
    const highPriority = sorted.filter(c => c.priority === 'high');
    for (const chunk of highPriority) {
        const module = await loadChunkSafe(chunk.name);
        if (module) {
            results.set(chunk.name, module);
        }
    }

    // Load medium priority in parallel
    const mediumPriority = sorted.filter(c => c.priority === 'medium');
    const mediumModules = await Promise.all(
        mediumPriority.map(chunk => loadChunkSafe(chunk.name))
    );
    mediumModules.forEach((module, i) => {
        if (module) {
            results.set(mediumPriority[i].name, module);
        }
    });

    // Load low priority sequentially to avoid bandwidth issues
    const lowPriority = sorted.filter(c => c.priority === 'low');
    for (const chunk of lowPriority) {
        const module = await loadChunkSafe(chunk.name);
        if (module) {
            results.set(chunk.name, module);
        }
    }

    return results;
}

/**
 * Check if chunk is loaded
 */
export function isChunkLoaded(name: string): boolean {
    const chunk = chunkManager.getChunkStatus().find(c => c.id === name);
    return chunk?.loaded || false;
}

/**
 * Get loading progress for multiple chunks
 */
export function getLoadingProgress(names: string[]): { loaded: number; total: number; percentage: number } {
    const status = chunkManager.getChunkStatus();
    const loaded = status.filter(c => names.includes(c.id) && c.loaded).length;
    const total = names.length;
    return {
        loaded,
        total,
        percentage: total > 0 ? Math.round((loaded / total) * 100) : 0,
    };
}

/**
 * Bundle size estimation (simplified)
 */
export function estimateBundleSize(
    chunks: string[],
    avgChunkSizeKB = 50
): number {
    return chunks.length * avgChunkSizeKB;
}

/**
 * Critical path optimization - load only what's needed for initial render
 */
export async function loadCriticalPath(): Promise<Map<string, any>> {
    const criticalChunks = [
        { name: 'chat-core', priority: 'high' as const },
        { name: 'message-bubble', priority: 'high' as const },
        { name: 'chat-input', priority: 'high' as const },
    ];

    return loadWithPriority(criticalChunks);
}

/**
 * Progressive loading - load features as user interacts
 */
export function setupProgressiveLoading(): () => void {
    const interactions: Array<{ event: string; selector: string; chunks: string[] }> = [
        { event: 'click', selector: '[data-preview="pdf"]', chunks: ['pdf-viewer'] },
        { event: 'click', selector: '[data-preview="code"]', chunks: ['monaco-editor'] },
        { event: 'click', selector: '[data-preview="3d"]', chunks: ['three-fiber'] },
        { event: 'click', selector: '[data-rich-text]', chunks: ['rich-text'] },
        { event: 'click', selector: '[data-whiteboard]', chunks: ['whiteboard'] },
        { event: 'click', selector: '[data-calendar]', chunks: ['calendar'] },
    ];

    const handleInteraction = (chunks: string[]) => {
        preloadChunks(chunks).catch(() => {
            // Silently fail progressive loading
        });
    };

    if (typeof window !== 'undefined') {
        interactions.forEach(({ event, selector, chunks }) => {
            document.addEventListener(event, (e) => {
                if ((e.target as Element).matches?.(selector)) {
                    handleInteraction(chunks);
                }
            }, { passive: true });
        });
    }

    // Return cleanup function
    return () => {
        // Cleanup would remove event listeners
    };
}

/**
 * Service worker integration for caching chunks
 */
export async function cacheChunksForOffline(
    chunks: string[],
    swUrl = '/sw.js'
): Promise<void> {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        try {
            await navigator.serviceWorker.ready;
            // Tell service worker to cache these chunks
            await fetch('/api/cache-chunks', {
                method: 'POST',
                body: JSON.stringify({ chunks }),
                headers: { 'Content-Type': 'application/json' },
            });
        } catch (error) {
            console.warn('Failed to cache chunks for offline:', error);
        }
    }
}
