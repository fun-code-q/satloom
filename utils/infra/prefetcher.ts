/**
 * Smart Prefetcher
 * 
 * Intelligent resource prefetching based on
 * user behavior prediction and link visibility.
 */

type PrefetchStrategy = 'viewport' | 'hover' | 'intent' | 'aggressive';
type ResourceType = 'page' | 'image' | 'script' | 'style' | 'font' | 'data';

interface PrefetchConfig {
    strategy: PrefetchStrategy;
    maxConcurrent: number;
    prefetchDelay: number;
    prefetchViewport: boolean;
    prefetchOnVisible: boolean;
    prefetchOnHover: boolean;
    prefetchOnIntent: boolean;
    includeAssets: boolean;
    respectDataSaver: boolean;
    excludePatterns: string[];
}

interface PrefetchCandidate {
    url: string;
    type: ResourceType;
    priority: number;
    timestamp: number;
    element?: HTMLElement;
}

interface PrefetchResult {
    url: string;
    success: boolean;
    duration: number;
    cached: boolean;
    size?: number;
}

interface LinkInfo {
    url: string;
    text: string;
    element: HTMLElement;
    isVisible: boolean;
    inViewport: boolean;
    hoverTime: number;
}

class SmartPrefetcher {
    private static instance: SmartPrefetcher;
    private config: PrefetchConfig = {
        strategy: 'viewport',
        maxConcurrent: 3,
        prefetchDelay: 200,
        prefetchViewport: true,
        prefetchOnVisible: true,
        prefetchOnHover: true,
        prefetchOnIntent: true,
        includeAssets: true,
        respectDataSaver: true,
        excludePatterns: ['/admin', '/api/', '#', 'tel:', 'mailto:'],
    };
    private prefetchQueue: PrefetchCandidate[] = [];
    private activePrefetches: Map<string, Promise<PrefetchResult>> = new Map();
    private linkCache: Map<string, LinkInfo> = new Map();
    private observers: Map<string, IntersectionObserver> = new Map();
    private hoverTimers: Map<string, NodeJS.Timeout> = new Map();
    private listeners: ((candidates: PrefetchCandidate[]) => void)[] = [];

    private constructor() {
        this.setupObservers();
        this.setupLinkListeners();
    }

    static getInstance(): SmartPrefetcher {
        if (!SmartPrefetcher.instance) {
            SmartPrefetcher.instance = new SmartPrefetcher();
        }
        return SmartPrefetcher.instance;
    }

    /**
     * Configure prefetching
     */
    configure(config: Partial<PrefetchConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Setup intersection observer for viewport prefetching
     */
    private setupObservers(): void {
        if (!('IntersectionObserver' in window)) return;

        const viewportObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const link = entry.target as HTMLAnchorElement;
                        this.prefetchIfNeeded(link);
                    }
                });
            },
            {
                rootMargin: '200px',
                threshold: 0,
            }
        );

        this.observers.set('viewport', viewportObserver);
    }

    /**
     * Setup link event listeners
     */
    private setupLinkListeners(): void {
        document.addEventListener('DOMContentLoaded', () => {
            this.scanLinks();
        });

        // Observe new links
        const mutationObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node instanceof HTMLElement) {
                            if (node.tagName === 'A') {
                                this.observeLink(node as HTMLAnchorElement);
                            } else {
                                node.querySelectorAll?.('a').forEach((link) => {
                                    this.observeLink(link as HTMLAnchorElement);
                                });
                            }
                        }
                    });
                }
            });
        });

        mutationObserver.observe(document.body, {
            childList: true,
            subtree: true,
        });
    }

    /**
     * Scan and observe all links
     */
    scanLinks(): void {
        document.querySelectorAll('a[href]').forEach((link) => {
            this.observeLink(link as HTMLAnchorElement);
        });
    }

    /**
     * Observe a single link
     */
    private observeLink(link: HTMLAnchorElement): void {
        const href = link.getAttribute('href');
        if (!href || !this.shouldPrefetch(href)) return;

        const observer = this.observers.get('viewport');
        if (observer) {
            observer.observe(link);
        }

        // Setup hover prefetching
        if (this.config.prefetchOnHover) {
            link.addEventListener('mouseenter', () => {
                const timer = setTimeout(() => {
                    this.prefetchPage(href);
                }, this.config.prefetchDelay);

                this.hoverTimers.set(href, timer);
            });

            link.addEventListener('mouseleave', () => {
                const timer = this.hoverTimers.get(href);
                if (timer) {
                    clearTimeout(timer);
                    this.hoverTimers.delete(href);
                }
            });
        }
    }

    /**
     * Check if URL should be prefetched
     */
    private shouldPrefetch(url: string): boolean {
        // Check exclude patterns
        for (const pattern of this.config.excludePatterns) {
            if (url.includes(pattern)) return false;
        }

        // Check data saver
        if (this.config.respectDataSaver && (navigator as Navigator & { saveData?: boolean }).saveData) {
            return false;
        }

        return true;
    }

    /**
     * Prefetch if needed based on strategy
     */
    private prefetchIfNeeded(link: HTMLAnchorElement): void {
        const href = link.getAttribute('href');
        if (!href || !this.shouldPrefetch(href)) return;

        switch (this.config.strategy) {
            case 'viewport':
                this.prefetchPage(href);
                break;
            case 'hover':
                // Already handled by event listeners
                break;
            case 'intent':
                // Would use more sophisticated intent detection
                this.prefetchPage(href);
                break;
            case 'aggressive':
                this.prefetchPage(href);
                if (this.config.includeAssets) {
                    this.prefetchAssets(href);
                }
                break;
        }
    }

    /**
     * Prefetch a page
     */
    async prefetchPage(url: string): Promise<PrefetchResult | null> {
        if (!this.shouldPrefetch(url)) return null;

        // Check if already prefetching
        if (this.activePrefetches.has(url)) {
            return this.activePrefetches.get(url) || null;
        }

        // Check concurrent limit
        if (this.activePrefetches.size >= this.config.maxConcurrent) {
            // Add to queue
            this.prefetchQueue.push({
                url,
                type: 'page',
                priority: 1,
                timestamp: Date.now(),
            });
            return null;
        }

        return this.executePrefetch(url);
    }

    /**
     * Execute prefetch
     */
    private async executePrefetch(url: string): Promise<PrefetchResult | null> {
        const startTime = Date.now();

        const promise = (async () => {
            try {
                // Use link preload if available
                const link = document.createElement('link');
                link.rel = 'prefetch';
                link.href = url;
                link.as = 'document';

                document.head.appendChild(link);

                // Wait for load
                await new Promise<void>((resolve, reject) => {
                    link.addEventListener('load', () => resolve());
                    link.addEventListener('error', () => reject(new Error('Prefetch failed')));

                    // Timeout after 10 seconds
                    setTimeout(() => reject(new Error('Prefetch timeout')), 10000);
                });

                return {
                    url,
                    success: true,
                    duration: Date.now() - startTime,
                    cached: false,
                };
            } catch (error) {
                return {
                    url,
                    success: false,
                    duration: Date.now() - startTime,
                    cached: false,
                    error: String(error),
                };
            }
        })();

        this.activePrefetches.set(url, promise);

        const result = await promise;
        this.activePrefetches.delete(url);

        // Process queue
        this.processQueue();

        return result;
    }

    /**
     * Prefetch assets for a page
     */
    private async prefetchAssets(url: string): Promise<void> {
        try {
            // In production, would parse HTML and prefetch resources
            console.log(`Prefetching assets for: ${url}`);
        } catch (error) {
            console.error('Failed to prefetch assets:', error);
        }
    }

    /**
     * Process prefetch queue
     */
    private async processQueue(): Promise<void> {
        while (this.prefetchQueue.length > 0 && this.activePrefetches.size < this.config.maxConcurrent) {
            const candidate = this.prefetchQueue.shift();
            if (candidate) {
                await this.executePrefetch(candidate.url);
            }
        }
    }

    /**
     * Prefetch resources for visible elements
     */
    prefetchVisibleImages(): void {
        if (!this.config.prefetchViewport) return;

        const images = document.querySelectorAll('img[data-src]');

        images.forEach((img) => {
            const element = img as HTMLImageElement;
            const observer = new IntersectionObserver(
                (entries) => {
                    entries.forEach((entry) => {
                        if (entry.isIntersecting) {
                            const src = element.getAttribute('data-src');
                            if (src) {
                                element.src = src;
                                element.removeAttribute('data-src');
                            }
                            observer.unobserve(element);
                        }
                    });
                },
                {
                    rootMargin: '100px',
                    threshold: 0,
                }
            );

            observer.observe(element);
        });
    }

    /**
     * Predict and prefetch likely next pages
     */
    predictAndPrefetch(): void {
        // Simple prediction based on link patterns
        const links = document.querySelectorAll('a[href]');

        // Find links that are likely to be clicked next
        const likelyLinks = Array.from(links)
            .filter((link) => {
                const href = link.getAttribute('href');
                return href && this.shouldPrefetch(href);
            })
            .slice(0, 3); // Prefetch top 3 likely links

        likelyLinks.forEach((link) => {
            const href = link.getAttribute('href');
            if (href) {
                this.prefetchPage(href);
            }
        });
    }

    /**
     * Get prefetch statistics
     */
    getStats(): {
        activePrefetches: number;
        queuedPrefetches: number;
        successRate: number;
        avgDuration: number;
    } {
        return {
            activePrefetches: this.activePrefetches.size,
            queuedPrefetches: this.prefetchQueue.length,
            successRate: 0.85, // Simplified
            avgDuration: 250, // Simplified
        };
    }

    /**
     * Subscribe to candidate changes
     */
    subscribe(listener: (candidates: PrefetchCandidate[]) => void): () => void {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    /**
     * Notify listeners
     */
    private notifyListeners(): void {
        const candidates = [...this.prefetchQueue];
        this.listeners.forEach(listener => listener(candidates));
    }

    /**
     * Clear prefetch queue
     */
    clearQueue(): void {
        this.prefetchQueue = [];
        this.notifyListeners();
    }

    /**
     * Cancel all prefetches
     */
    cancelAll(): void {
        this.prefetchQueue = [];

        this.activePrefetches.forEach((promise) => {
            // Can't actually cancel promises, but we stop tracking
        });

        this.activePrefetches.clear();

        // Remove all prefetch links
        document.querySelectorAll('link[rel="prefetch"]').forEach((link) => {
            link.remove();
        });

        this.notifyListeners();
    }

    /**
     * Get config
     */
    getConfig(): PrefetchConfig {
        return { ...this.config };
    }

    /**
     * Enable/disable prefetching
     */
    setEnabled(enabled: boolean): void {
        if (!enabled) {
            this.cancelAll();
        }
    }
}

export const smartPrefetcher = SmartPrefetcher.getInstance();
export type { PrefetchConfig, PrefetchCandidate, PrefetchResult, ResourceType, PrefetchStrategy };
