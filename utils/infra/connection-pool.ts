/**
 * Connection Pool
 * 
 * Manages WebSocket/Firebase connections with pooling,
 * reuse, and automatic failover.
 */

type ConnectionType = 'firebase' | 'websocket' | 'webrtc' | 'api';
type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'failed' | 'reconnecting';

interface PooledConnection {
    id: string;
    type: ConnectionType;
    state: ConnectionState;
    createdAt: number;
    lastUsed: number;
    useCount: number;
    connection: unknown;
    metadata: Record<string, unknown>;
}

interface PoolConfig {
    minSize: number;
    maxSize: number;
    maxIdleTime: number; // ms
    connectionTimeout: number; // ms
    healthCheckInterval: number; // ms
    retryAttempts: number;
    retryDelay: number; // ms
    enableReuse: boolean;
}

interface HealthCheckResult {
    connected: boolean;
    latency: number;
    error?: string;
}

type ConnectionCallback = (event: { type: string; connectionId?: string; error?: unknown }) => void;

class ConnectionPool {
    private static instance: ConnectionPool;
    private connections: Map<string, PooledConnection> = new Map();
    private availableConnections: Map<string, string> = new Map(); // type -> connectionId
    private config: PoolConfig = {
        minSize: 2,
        maxSize: 10,
        maxIdleTime: 5 * 60 * 1000, // 5 minutes
        connectionTimeout: 10000, // 10 seconds
        healthCheckInterval: 30000, // 30 seconds
        retryAttempts: 3,
        retryDelay: 1000, // 1 second
        enableReuse: true,
    };
    private callbacks: ConnectionCallback[] = [];
    private healthCheckTimer: NodeJS.Timeout | null = null;
    private listeners: ((connections: PooledConnection[]) => void)[] = [];

    private constructor() {
        this.startHealthChecks();
    }

    static getInstance(): ConnectionPool {
        if (!ConnectionPool.instance) {
            ConnectionPool.instance = new ConnectionPool();
        }
        return ConnectionPool.instance;
    }

    /**
     * Configure the connection pool
     */
    configure(config: Partial<PoolConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Acquire a connection from the pool
     */
    async acquire(type: ConnectionType, metadata?: Record<string, unknown>): Promise<PooledConnection> {
        // Check for available connection
        if (this.config.enableReuse && this.availableConnections.has(type)) {
            const connectionId = this.availableConnections.get(type)!;
            const connection = this.connections.get(connectionId);

            if (connection && this.isConnectionValid(connection)) {
                // Reuse existing connection
                connection.lastUsed = Date.now();
                connection.useCount++;
                this.availableConnections.delete(type);

                this.notifyConnectionAcquired(connection);
                return connection;
            }
        }

        // Check pool size limit
        if (this.connections.size >= this.config.maxSize) {
            // Try to reclaim an old connection
            await this.reclaimOldConnections();

            if (this.connections.size >= this.config.maxSize) {
                throw new Error('Connection pool exhausted');
            }
        }

        // Create new connection
        const connection = await this.createConnection(type, metadata);
        this.connections.set(connection.id, connection);

        this.notifyConnectionAcquired(connection);
        return connection;
    }

    /**
     * Release connection back to pool
     */
    release(connectionId: string): boolean {
        const connection = this.connections.get(connectionId);
        if (!connection) return false;

        // Check if connection is still valid
        if (!this.isConnectionValid(connection)) {
            this.removeConnection(connectionId);
            return false;
        }

        if (this.config.enableReuse) {
            // Mark as available
            this.availableConnections.set(connection.type, connectionId);
            connection.lastUsed = Date.now();
        } else {
            // Close connection if not reusable
            this.closeConnection(connection);
        }

        this.notifyListeners();
        return true;
    }

    /**
     * Remove connection from pool
     */
    removeConnection(connectionId: string): boolean {
        const connection = this.connections.get(connectionId);
        if (!connection) return false;

        this.availableConnections.delete(connection.type);
        this.connections.delete(connectionId);

        this.closeConnection(connection);
        this.notifyListeners();

        return true;
    }

    /**
     * Create a new connection
     */
    private async createConnection(type: ConnectionType, metadata?: Record<string, unknown>): Promise<PooledConnection> {
        const connectionId = `conn_${type}_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        const connection: PooledConnection = {
            id: connectionId,
            type,
            state: 'connecting',
            createdAt: Date.now(),
            lastUsed: Date.now(),
            useCount: 0,
            connection: null,
            metadata: metadata || {},
        };

        try {
            // Create connection based on type
            switch (type) {
                case 'firebase':
                    connection.connection = await this.createFirebaseConnection(metadata);
                    break;
                case 'websocket':
                    connection.connection = await this.createWebSocketConnection(metadata);
                    break;
                case 'webrtc':
                    connection.connection = await this.createWebRTCConnection(metadata);
                    break;
                case 'api':
                    connection.connection = await this.createAPIConnection(metadata);
                    break;
            }

            connection.state = 'connected';
        } catch (error) {
            connection.state = 'failed';
            connection.metadata = { error: String(error) };
        }

        return connection;
    }

    /**
     * Create Firebase connection (placeholder)
     */
    private async createFirebaseConnection(_metadata?: Record<string, unknown>): Promise<unknown> {
        // In production, this would initialize Firebase connection
        return { type: 'firebase', ready: true };
    }

    /**
     * Create WebSocket connection (placeholder)
     */
    private async createWebSocketConnection(_metadata?: Record<string, unknown>): Promise<unknown> {
        // In production, this would create WebSocket
        return { type: 'websocket', ready: true };
    }

    /**
     * Create WebRTC connection (placeholder)
     */
    private async createWebRTCConnection(_metadata?: Record<string, unknown>): Promise<unknown> {
        // In production, this would create RTCPeerConnection
        return { type: 'webrtc', ready: true };
    }

    /**
     * Create API connection (placeholder)
     */
    private async createAPIConnection(_metadata?: Record<string, unknown>): Promise<unknown> {
        // In production, this would prepare API connection
        return { type: 'api', ready: true };
    }

    /**
     * Check if connection is valid
     */
    private isConnectionValid(connection: PooledConnection): boolean {
        if (connection.state !== 'connected') return false;

        // Check idle time
        const idleTime = Date.now() - connection.lastUsed;
        if (idleTime > this.config.maxIdleTime) {
            return false;
        }

        return true;
    }

    /**
     * Reclaim old idle connections
     */
    private async reclaimOldConnections(): Promise<void> {
        const oldConnections: string[] = [];

        this.connections.forEach((connection, id) => {
            const idleTime = Date.now() - connection.lastUsed;
            if (idleTime > this.config.maxIdleTime * 0.8) {
                oldConnections.push(id);
            }
        });

        for (const id of oldConnections) {
            if (this.connections.size <= this.config.minSize) break;
            this.removeConnection(id);
        }
    }

    /**
     * Close a connection
     */
    private closeConnection(connection: PooledConnection): void {
        // In production, this would properly close the connection
        connection.state = 'disconnected';
    }

    /**
     * Health check all connections
     */
    private async performHealthCheck(connection: PooledConnection): Promise<HealthCheckResult> {
        const start = Date.now();

        try {
            // In production, this would send a ping and wait for response
            await new Promise(resolve => setTimeout(resolve, 50));

            return {
                connected: true,
                latency: Date.now() - start,
            };
        } catch (error) {
            return {
                connected: false,
                latency: Date.now() - start,
                error: String(error),
            };
        }
    }

    /**
     * Start periodic health checks
     */
    private startHealthChecks(): void {
        this.healthCheckTimer = setInterval(async () => {
            const results: { id: string; result: HealthCheckResult }[] = [];

            for (const [id, connection] of this.connections) {
                const result = await this.performHealthCheck(connection);
                results.push({ id, result });

                if (!result.connected && connection.state === 'connected') {
                    // Mark as failed
                    connection.state = 'disconnected';
                    this.availableConnections.delete(connection.type);
                    this.notifyConnectionFailed(connection, result.error);
                }
            }

            this.notifyListeners();
        }, this.config.healthCheckInterval);
    }

    /**
     * Force reconnect a connection
     */
    async reconnect(connectionId: string): Promise<boolean> {
        const connection = this.connections.get(connectionId);
        if (!connection) return false;

        const oldState = connection.state;
        connection.state = 'reconnecting';

        try {
            // In production, this would attempt to reconnect
            connection.state = 'connected';
            connection.lastUsed = Date.now();
            this.notifyConnectionRestored(connection);
            return true;
        } catch (error) {
            connection.state = oldState;
            this.notifyConnectionFailed(connection, error);
            return false;
        }
    }

    /**
     * Get connection by ID
     */
    getConnection(connectionId: string): PooledConnection | null {
        return this.connections.get(connectionId) || null;
    }

    /**
     * Get all connections
     */
    getAllConnections(): PooledConnection[] {
        return Array.from(this.connections.values());
    }

    /**
     * Get connection statistics
     */
    getStats(): {
        totalConnections: number;
        availableConnections: number;
        connectedConnections: number;
        failedConnections: number;
        averageLatency: number;
    } {
        const connections = Array.from(this.connections.values());
        const connected = connections.filter(c => c.state === 'connected');
        const failed = connections.filter(c => c.state === 'failed');

        // Calculate average latency from health checks (simplified)
        const avgLatency = 50; // Placeholder

        return {
            totalConnections: connections.length,
            availableConnections: this.availableConnections.size,
            connectedConnections: connected.length,
            failedConnections: failed.length,
            averageLatency: avgLatency,
        };
    }

    /**
     * Subscribe to connection events
     */
    onConnection(callback: ConnectionCallback): () => void {
        this.callbacks.push(callback);
        return () => {
            this.callbacks = this.callbacks.filter(c => c !== callback);
        };
    }

    /**
     * Subscribe to state changes
     */
    subscribe(listener: (connections: PooledConnection[]) => void): () => void {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    /**
     * Notify connection acquired
     */
    private notifyConnectionAcquired(connection: PooledConnection): void {
        this.callbacks.forEach(cb => cb({ type: 'acquired', connectionId: connection.id }));
    }

    /**
     * Notify connection failed
     */
    private notifyConnectionFailed(connection: PooledConnection, error?: unknown): void {
        this.callbacks.forEach(cb => cb({ type: 'failed', connectionId: connection.id, error }));
    }

    /**
     * Notify connection restored
     */
    private notifyConnectionRestored(connection: PooledConnection): void {
        this.callbacks.forEach(cb => cb({ type: 'restored', connectionId: connection.id }));
    }

    /**
     * Notify listeners
     */
    private notifyListeners(): void {
        const connections = Array.from(this.connections.values());
        this.listeners.forEach(listener => listener(connections));
    }

    /**
     * Clear all connections
     */
    clear(): void {
        this.connections.forEach((_, id) => this.removeConnection(id));
        this.availableConnections.clear();

        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
            this.healthCheckTimer = null;
        }

        this.notifyListeners();
    }
}

export const connectionPool = ConnectionPool.getInstance();
export type { PooledConnection, PoolConfig, HealthCheckResult, ConnectionType, ConnectionState };
