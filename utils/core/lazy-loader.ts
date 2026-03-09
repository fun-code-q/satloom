/**
 * Lazy Loading Utilities for Performance Optimization
 * 
 * Provides dynamic import helpers and loading state management
 * for code splitting and lazy loading components.
 */

// Lazy load mapping for heavy components
const componentLazyMap: Record<string, any> = {};

/**
 * Preload a component for faster subsequent rendering
 * @param componentName - Name of the component to preload
 */
export function preloadComponent(componentName: string): void {
    if (typeof window === 'undefined') return;

    const loaders: Record<string, () => Promise<any>> = {
        'code-preview': () => import('../../components/previews/code-preview'),
        'model-preview': () => import('../../components/previews/model-preview'),
        'office-preview': () => import('../../components/previews/office-preview'),
        'pdf-preview': () => import('../../components/previews/pdf-preview'),
        'picture-in-picture': () => import('../../components/picture-in-picture'),
        'virtual-background-selector': () => import('../../components/virtual-background-selector'),
        'breakout-rooms-modal': () => import('../../components/breakout-rooms-modal'),
        'template-modal': () => import('../../components/template-modal'),
    };

    const loader = loaders[componentName];
    if (loader) {
        loader().catch(() => {
            // Silently fail preload errors
        });
    }
}

/**
 * Prefetch data for components
 * @param prefetchFn - Function to prefetch data
 * @param delay - Delay in ms before prefetching
 */
export function prefetchData(prefetchFn: () => Promise<void>, delay = 1000): void {
    if (typeof window === 'undefined') return;

    setTimeout(() => {
        prefetchFn().catch(() => {
            // Silently fail prefetch errors
        });
    }, delay);
}

/**
 * Batch multiple imports for parallel loading
 * @param imports - Array of import functions
 */
export async function batchImports<T>(imports: Array<() => Promise<T>>): Promise<T[]> {
    return Promise.all(imports.map((importFn) => importFn()));
}

/**
 * Resource hint utilities
 */
export const resourceHints = {
    /**
     * Add preconnect hint for external domains
     */
    addPreconnect(domain: string): void {
        if (typeof document === 'undefined') return;

        const existing = document.querySelector('link[rel="preconnect"][href="' + domain + '"]');
        if (existing) return;

        const link = document.createElement('link');
        link.rel = 'preconnect';
        link.href = domain;
        link.crossOrigin = 'anonymous';
        document.head.appendChild(link);
    },

    /**
     * Add DNS prefetch hint for external domains
     */
    addDnsPrefetch(domain: string): void {
        if (typeof document === 'undefined') return;

        const existing = document.querySelector('link[rel="dns-prefetch"][href="' + domain + '"]');
        if (existing) return;

        const link = document.createElement('link');
        link.rel = 'dns-prefetch';
        link.href = domain;
        document.head.appendChild(link);
    },

    /**
     * Preload critical resource
     */
    preloadResource(url: string, as: 'script' | 'style' | 'image' | 'font' = 'script'): void {
        if (typeof document === 'undefined') return;

        const existing = document.querySelector('link[rel="preload"][href="' + url + '"]');
        if (existing) return;

        const link = document.createElement('link');
        link.rel = 'preload';
        link.href = url;
        if (as !== 'script') link.setAttribute('as', as);
        document.head.appendChild(link);
    }
};

/**
 * Memory-efficient image loading
 */
export function loadImageOptimized(src: string, quality = 80): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => resolve(img);
        img.onerror = reject;

        // Add quality param for WebP/JPEG optimization
        const optimizedSrc = src.includes('?')
            ? src + '&quality=' + quality
            : src + '?quality=' + quality;

        img.src = optimizedSrc;
    });
}

/**
 * Lazy load images with Intersection Observer
 */
export function setupLazyImages(
    selector = 'img[data-src]',
    rootMargin = '50px'
): void {
    if (typeof window === 'undefined') return;

    const images = document.querySelectorAll<HTMLImageElement>(selector);
    if (images.length === 0) return;

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const img = entry.target as HTMLImageElement;
                    if (img.dataset.src) {
                        img.src = img.dataset.src;
                    }
                    img.removeAttribute('data-src');
                    observer.unobserve(img);
                }
            });
        },
        { rootMargin }
    );

    images.forEach((img) => observer.observe(img));
}

/**
 * Debounce utility for performance optimization
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null;

    return function (...args: Parameters<T>) {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

/**
 * Throttle utility for performance optimization
 */
export function throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
): (...args: Parameters<T>) => void {
    let inThrottle = false;

    return function (...args: Parameters<T>) {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => { inThrottle = false; }, limit);
        }
    };
}

/**
 * Memoize expensive computations
 */
export function memoize<T, R>(
    fn: (...args: T[]) => R,
    maxCacheSize = 100
): (...args: T[]) => R {
    const cache = new Map<T[], R>();
    const cacheKeys: T[][] = [];

    return function (...args: T[]): R {
        // Find existing cache entry
        for (let i = 0; i < cacheKeys.length; i++) {
            const key = cacheKeys[i];
            if (key.length === args.length && key.every((k, j) => k === args[j])) {
                return cache.get(key)!;
            }
        }

        // Compute new value
        const result = fn(...args);

        // Add to cache
        if (cacheKeys.length >= maxCacheSize) {
            const removedKey = cacheKeys.shift()!;
            cache.delete(removedKey);
        }
        cacheKeys.push(args);
        cache.set(args, result);

        return result;
    };
}

/**
 * Async memoize for promises
 */
export async function asyncMemoize<T, R>(
    fn: (arg: T) => Promise<R>
): Promise<(arg: T) => Promise<R>> {
    const cache = new Map<T, R>();

    return async function (arg: T): Promise<R> {
        if (cache.has(arg)) {
            return cache.get(arg)!;
        }

        const result = await fn(arg);
        cache.set(arg, result);
        return result;
    };
}

/**
 * Batch DOM updates for better performance
 */
export function batchDOMUpdates(updates: () => void): void {
    if (typeof window === 'undefined') {
        updates();
        return;
    }

    if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(() => {
            updates();
        });
    } else {
        requestAnimationFrame(() => {
            updates();
        });
    }
}

/**
 * Calculate render time for performance monitoring
 */
export function measureRenderTime(componentName: string): () => void {
    const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

    return () => {
        const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const renderTime = endTime - startTime;

        if (typeof console !== 'undefined' && renderTime > 16) {
            console.warn(componentName + ' render took ' + renderTime.toFixed(2) + 'ms');
        }
    };
}

/**
 * Memory usage monitoring (Chrome DevTools API)
 */
export function getMemoryUsage(): { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } | null {
    if (typeof performance !== 'undefined' && (performance as any).memory) {
        return (performance as any).memory;
    }
    return null;
}

/**
 * Network type detection for adaptive performance
 */
export function getNetworkType(): 'slow-2g' | '2g' | '3g' | '4g' | 'unknown' {
    if (typeof navigator !== 'undefined' && 'connection' in navigator) {
        const connection = (navigator as any).connection;
        return connection.effectiveType || 'unknown';
    }
    return 'unknown';
}

/**
 * Adaptive quality based on network speed
 */
export function getAdaptiveQuality(): { videoQuality: number; imageQuality: number; preloadEnabled: boolean } {
    const networkType = getNetworkType();

    switch (networkType) {
        case 'slow-2g':
            return { videoQuality: 0.3, imageQuality: 50, preloadEnabled: false };
        case '2g':
            return { videoQuality: 0.5, imageQuality: 60, preloadEnabled: false };
        case '3g':
            return { videoQuality: 0.7, imageQuality: 80, preloadEnabled: true };
        case '4g':
            return { videoQuality: 1.0, imageQuality: 90, preloadEnabled: true };
        default:
            return { videoQuality: 0.8, imageQuality: 85, preloadEnabled: true };
    }
}
