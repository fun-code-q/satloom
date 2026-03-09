/**
 * Enhanced Error Handler
 * 
 * Provides comprehensive error handling, error tracking,
 * and user-friendly error messages.
 */

interface ErrorInfo {
    id: string;
    message: string;
    stack?: string;
    timestamp: number;
    userAgent?: string;
    url?: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    context?: Record<string, unknown>;
}

interface ErrorHandlerConfig {
    maxErrors: number;
    enableReporting: boolean;
    onError?: (error: ErrorInfo) => void;
}

class EnhancedErrorHandler {
    private static instance: EnhancedErrorHandler;
    private errors: ErrorInfo[] = [];
    private config: ErrorHandlerConfig = {
        maxErrors: 100,
        enableReporting: true,
        onError: undefined,
    };
    private errorListeners: Set<(error: ErrorInfo) => void> = new Set();

    private constructor() { }

    static getInstance(): EnhancedErrorHandler {
        if (!EnhancedErrorHandler.instance) {
            EnhancedErrorHandler.instance = new EnhancedErrorHandler();
        }
        return EnhancedErrorHandler.instance;
    }

    /**
     * Initialize error handler
     */
    initialize(config: Partial<ErrorHandlerConfig>): void {
        this.config = { ...this.config, ...config };

        if (typeof window !== 'undefined') {
            window.addEventListener('error', this.handleGlobalError.bind(this));
            window.addEventListener('unhandledrejection', this.handleUnhandledRejection.bind(this));
        }
    }

    /**
     * Handle global errors
     */
    private handleGlobalError(event: ErrorEvent): void {
        const errorInfo = this.createErrorInfo({
            message: event.message,
            stack: event.error?.stack,
            severity: 'high',
            context: { filename: event.filename, lineno: event.lineno, colno: event.colno },
        });

        this.reportError(errorInfo);
    }

    /**
     * Handle unhandled promise rejections
     */
    private handleUnhandledRejection(event: PromiseRejectionEvent): void {
        const errorInfo = this.createErrorInfo({
            message: event.reason?.message || 'Unhandled Promise Rejection',
            stack: event.reason?.stack,
            severity: 'medium',
        });

        this.reportError(errorInfo);
    }

    /**
     * Create error info object
     */
    private createErrorInfo(options: Partial<ErrorInfo>): ErrorInfo {
        const message = typeof options.message === 'string' ? options.message : 'Unknown error';
        const stack = options.stack || (options.message as unknown as Error)?.stack;

        return {
            id: 'err-' + Date.now() + '-' + Math.random().toString(36).substring(2, 11),
            message: message,
            stack: stack,
            timestamp: Date.now(),
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
            url: typeof window !== 'undefined' ? window.location.href : undefined,
            severity: options.severity || 'medium',
            context: options.context,
        };
    }

    /**
     * Report an error
     */
    reportError(error: Error | ErrorInfo | string, context?: Record<string, unknown>): string {
        let errorInfo: ErrorInfo;

        if (typeof error === 'string') {
            errorInfo = this.createErrorInfo({ message: error, context });
        } else if ('id' in error && 'timestamp' in error) {
            errorInfo = { ...error, context: { ...error.context, ...context } };
        } else {
            errorInfo = this.createErrorInfo({
                message: error.message,
                stack: error.stack,
                context
            });
        }

        // Add to errors array
        this.errors.unshift(errorInfo);

        // Trim old errors
        if (this.errors.length > this.config.maxErrors) {
            this.errors = this.errors.slice(0, this.config.maxErrors);
        }

        // Notify listeners
        this.errorListeners.forEach(listener => listener(errorInfo));

        // Console log for development
        if (process.env.NODE_ENV === 'development') {
            console.error('Error reported:', errorInfo);
        }

        // Report to external service
        if (this.config.enableReporting) {
            this.sendToReportingService(errorInfo);
        }

        return errorInfo.id;
    }

    /**
     * Send error to reporting service
     */
    private sendToReportingService(errorInfo: ErrorInfo): void {
        if (this.config.onError) {
            this.config.onError(errorInfo);
        }
    }

    /**
     * Add error listener
     */
    addErrorListener(listener: (error: ErrorInfo) => void): () => void {
        this.errorListeners.add(listener);
        return () => this.errorListeners.delete(listener);
    }

    /**
     * Get all errors
     */
    getErrors(): ErrorInfo[] {
        return [...this.errors];
    }

    /**
     * Get errors by severity
     */
    getErrorsBySeverity(severity: ErrorInfo['severity']): ErrorInfo[] {
        return this.errors.filter(e => e.severity === severity);
    }

    /**
     * Get recent errors
     */
    getRecentErrors(limit = 10): ErrorInfo[] {
        return this.errors.slice(0, limit);
    }

    /**
     * Clear all errors
     */
    clearErrors(): void {
        this.errors = [];
    }

    /**
     * Create error message for user
     */
    createUserMessage(error: Error | string): string {
        const message = typeof error === 'string' ? error : error.message;

        // Map common errors to user-friendly messages
        const errorMap: Record<string, string> = {
            'Network Error': 'Unable to connect. Please check your internet connection.',
            'Failed to fetch': 'Unable to connect to the server. Please try again.',
            'Firebase': 'Connection lost. Reconnecting...',
            'WebRTC': 'Unable to establish connection. Please try again.',
            'timeout': 'The operation timed out. Please try again.',
            'permission': 'Permission denied. Please check your settings.',
        };

        // Find matching error message
        for (const [key, value] of Object.entries(errorMap)) {
            if (message.toLowerCase().includes(key.toLowerCase())) {
                return value;
            }
        }

        // Default message
        return 'An error occurred. Please try again.';
    }

    /**
     * Log performance error
     */
    logPerformanceError(operation: string, duration: number, threshold = 3000): void {
        if (duration > threshold) {
            this.reportError({
                id: 'perf-' + Date.now(),
                message: `Slow operation: ${operation}`,
                timestamp: Date.now(),
                severity: 'low',
                context: { operation, duration, threshold },
            });
        }
    }

    /**
     * Get error statistics
     */
    getErrorStats(): {
        total: number;
        bySeverity: Record<string, number>;
        recent: number;
    } {
        const oneHourAgo = Date.now() - 60 * 60 * 1000;

        return {
            total: this.errors.length,
            bySeverity: {
                low: this.errors.filter(e => e.severity === 'low').length,
                medium: this.errors.filter(e => e.severity === 'medium').length,
                high: this.errors.filter(e => e.severity === 'high').length,
                critical: this.errors.filter(e => e.severity === 'critical').length,
            },
            recent: this.errors.filter(e => e.timestamp > oneHourAgo).length,
        };
    }

    /**
     * Handle async operation errors
     */
    async wrapAsync<T>(
        operation: () => Promise<T>,
        context?: Record<string, unknown>
    ): Promise<T | null> {
        try {
            return await operation();
        } catch (error) {
            this.reportError(error as Error, context);
            return null;
        }
    }

    /**
     * Safe function execution
     */
    safeExecute<T>(
        operation: () => T,
        fallback: T,
        context?: Record<string, unknown>
    ): T {
        try {
            return operation();
        } catch (error) {
            this.reportError(error as Error, context);
            return fallback;
        }
    }

    /**
     * Create retry wrapper
     */
    createRetryHandler<T>(
        operation: () => Promise<T>,
        options: {
            maxRetries: number;
            delay: number;
            onRetry?: (attempt: number, error: Error) => void;
        }
    ): Promise<T> {
        let attempts = 0;

        const execute = async (): Promise<T> => {
            try {
                return await operation();
            } catch (error) {
                attempts++;
                if (attempts >= options.maxRetries) {
                    this.reportError(error as Error, { attempts, maxRetries: options.maxRetries });
                    throw error;
                }

                options.onRetry?.(attempts, error as Error);
                await new Promise(resolve => setTimeout(resolve, options.delay * attempts));
                return execute();
            }
        };

        return execute();
    }

    /**
     * Log API error
     */
    logApiError(endpoint: string, status: number, response?: unknown): void {
        const severity = status >= 500 ? 'high' : status >= 400 ? 'medium' : 'low';

        this.reportError({
            id: 'api-' + Date.now(),
            message: `API Error: ${endpoint} - ${status}`,
            timestamp: Date.now(),
            severity,
            context: { endpoint, status, response },
        });
    }

    /**
     * Log validation error
     */
    logValidationError(field: string, value: unknown, reason: string): void {
        this.reportError({
            id: 'validation-' + Date.now(),
            message: `Validation error: ${field}`,
            timestamp: Date.now(),
            severity: 'low',
            context: { field, value, reason },
        });
    }

    /**
     * Export errors for debugging
     */
    exportErrors(format: 'json' | 'csv' = 'json'): string {
        if (format === 'json') {
            return JSON.stringify(this.errors, null, 2);
        }

        // CSV format
        const headers = 'ID,Message,Severity,Timestamp,URL\n';
        const rows = this.errors.map(e =>
            `${e.id},"${e.message.replace(/"/g, '""')}",${e.severity},${e.timestamp},${e.url || ''}`
        ).join('\n');

        return headers + rows;
    }

    /**
     * Configure error boundaries (placeholder for React integration)
     */
    configureErrorBoundary(): {
        getDerivedStateFromError: (error: Error) => { hasError: boolean; errorId: string };
        componentDidCatch: (error: Error, info: { componentStack: string }) => void;
    } {
        return {
            getDerivedStateFromError: (error: Error) => {
                const errorId = this.reportError(error);
                return { hasError: true, errorId };
            },
            componentDidCatch: (error: Error, info: { componentStack: string }) => {
                this.reportError(error, { componentStack: info.componentStack });
            },
        };
    }
}

export const errorHandler = EnhancedErrorHandler.getInstance();
export type { ErrorInfo, ErrorHandlerConfig };
