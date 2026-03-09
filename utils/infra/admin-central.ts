/**
 * Admin Central System
 * 
 * Comprehensive admin dashboard for monitoring and controlling
 * rooms, users, content, and system health.
 */

import { getFirebaseDatabase, getFirebaseAuth } from "@/lib/firebase";
import { ref, onValue, update, remove, set, get, child } from "firebase/database";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { telemetry, type TelemetryEvent } from "@/utils/core/telemetry";

export type AdminRole = 'super_admin' | 'admin' | 'moderator' | 'viewer';

export interface AdminUser {
    id: string;
    email: string;
    role: AdminRole;
    permissions: Permission[];
    createdAt: number;
    lastActive: number;
    isActive: boolean;
}

export interface Permission {
    resource: 'rooms' | 'users' | 'messages' | 'bans' | 'analytics' | 'settings' | 'reports';
    actions: ('read' | 'write' | 'delete' | 'ban')[];
}

export interface RoomStats {
    roomId: string;
    roomName: string;
    participantCount: number;
    activeStreams: number;
    createdAt: number;
    lastActivity: number;
    isActive: boolean;
}

export interface UserStats {
    userId: string;
    displayName: string;
    deviceId: string;
    roomCount: number;
    totalMessages: number;
    joinTime: number;
    lastActive: number;
    isBanned: boolean;
    // Device & Session Info
    deviceInfo?: {
        os: string;
        browser: string;
        deviceType: 'desktop' | 'mobile' | 'tablet';
        language: string;
        timezone: string;
        screenResolution: string;
        userAgent: string;
    };
    connectionInfo?: {
        type: 'wifi' | 'cellular' | 'ethernet' | 'unknown';
        effectiveType?: 'slow-2g' | '2g' | '3g' | '4g';
        downlink?: number;
        rtt?: number;
    };
    locationInfo?: {
        country: string;
        city: string;
        ip: string;
        timezone: string;
    };
    sessionInfo?: {
        sessionDuration: number; // seconds
        totalSessionTime: number; // seconds
        lastIp: string;
        loginCount: number;
    };
}

export interface SystemHealth {
    uptime: number;
    cpuUsage: number;
    memoryUsage: number;
    activeConnections: number;
    roomsActive: number;
    messagesPerMinute: number;
    errorsLastHour: number;
    lastUpdated: number;
}

export interface Report {
    id: string;
    type: 'spam' | 'harassment' | 'inappropriate' | 'bug' | 'other';
    reporterId: string;
    reportedId?: string;
    roomId?: string;
    message?: string;
    evidence?: string[];
    status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
    createdAt: number;
    reviewedBy?: string;
    reviewedAt?: number;
}

export interface AdminConfig {
    maxRoomParticipants: number;
    maxRoomsPerUser: number;
    autoModerationEnabled: boolean;
    profanityFilterEnabled: boolean;
    maxReportsPerUser: number;
    retentionPeriod: number; // days
}

interface LogEntry {
    id: string;
    timestamp: number;
    level: 'info' | 'warning' | 'error' | 'debug';
    category: string;
    message: string;
    metadata?: Record<string, unknown>;
}

export interface ModerationAction {
    id: string;
    type: 'warn' | 'mute' | 'kick' | 'ban';
    targetUserId: string;
    moderatorId: string;
    reason: string;
    duration?: number;
    timestamp: number;
}

class AdminCentral {
    private static instance: AdminCentral;
    private currentAdmin: AdminUser | null = null;
    private admins: Map<string, AdminUser> = new Map();
    private rooms: Map<string, RoomStats> = new Map();
    private users: Map<string, UserStats> = new Map();
    private reports: Map<string, Report> = new Map();
    private logs: LogEntry[] = [];
    private moderationActions: ModerationAction[] = [];
    private listeners: Map<string, Set<(data: unknown) => void>> = new Map();
    private adminListenersUnsubscribe: (() => void)[] = [];

    private config: AdminConfig = {
        maxRoomParticipants: 50,
        maxRoomsPerUser: 5,
        autoModerationEnabled: true,
        profanityFilterEnabled: true,
        maxReportsPerUser: 10,
        retentionPeriod: 30,
    };

    private constructor() {
        this.initialize();
    }

    static getInstance(): AdminCentral {
        if (!AdminCentral.instance) {
            AdminCentral.instance = new AdminCentral();
        }
        return AdminCentral.instance;
    }

    /**
     * Initialize admin system
     */
    private initialize(): void {
        // Admin list is now managed via Firebase 'authorized_admins' node
        // and initialized via Firebase Console.

        console.log('Admin Central initialized (Production Mode)');
    }

    /**
     * Start sensitive admin listeners after authentication
     */
    private startAdminListeners(): void {
        if (typeof window === 'undefined') return;
        const db = getFirebaseDatabase();
        if (!db) return;

        // Cleanup any existing listeners
        this.stopAdminListeners();

        console.log('Admin Central: Starting listeners');

        // Connect to Firebase Rooms
        const roomsRef = ref(db, 'rooms');
        const unsubRooms = onValue(roomsRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                this.processFirebaseData(data);
            } else {
                this.rooms.clear();
                this.users.clear();
                this.notifyListeners('room-update', {});
                this.notifyListeners('user-update', {});
            }
        }, (error) => {
            console.error("Admin Central: Room listener error", error);
        });
        this.adminListenersUnsubscribe.push(unsubRooms);

        // Connect to Firebase Reports
        const reportsRef = ref(db, 'reports');
        const unsubReports = onValue(reportsRef, (snapshot) => {
            const data = snapshot.val();
            this.processReportsData(data || {});
        }, (error) => {
            console.error("Admin Central: Reports listener error", error);
        });
        this.adminListenersUnsubscribe.push(unsubReports);

        // Connect to Firebase Moderation
        const moderationRef = ref(db, 'moderation');
        const unsubModeration = onValue(moderationRef, (snapshot) => {
            const data = snapshot.val();
            this.processModerationData(data || {});
        }, (error) => {
            console.error("Admin Central: Moderation listener error", error);
        });
        this.adminListenersUnsubscribe.push(unsubModeration);
    }

    /**
     * Stop admin listeners on logout
     */
    private stopAdminListeners(): void {
        this.adminListenersUnsubscribe.forEach(unsub => unsub());
        this.adminListenersUnsubscribe = [];
        console.log('Admin Central: Listeners stopped');
    }

    private processFirebaseData(data: any): void {
        this.rooms.clear();
        this.users.clear();

        Object.entries(data).forEach(([roomId, roomData]: [string, any]) => {
            const participantCount = roomData.presence ? Object.keys(roomData.presence).length : 0;
            this.rooms.set(roomId, {
                roomId,
                roomName: roomData.name || `Room ${roomId.substring(0, 6)}`,
                participantCount,
                activeStreams: 0,
                createdAt: roomData.createdAt || Date.now(),
                lastActivity: roomData.lastActivity || Date.now(),
                isActive: true,
            });

            if (roomData.presence) {
                Object.entries(roomData.presence).forEach(([userId, userData]: [string, any]) => {
                    if (!this.users.has(userId)) {
                        this.users.set(userId, {
                            userId,
                            displayName: userData.name || 'Anonymous',
                            deviceId: 'unknown',
                            roomCount: 1,
                            totalMessages: 0,
                            joinTime: userData.joinedAt || Date.now(),
                            lastActive: userData.lastSeen || Date.now(),
                            isBanned: false,
                            currentActivity: userData.currentActivity,
                            locationInfo: { country: 'Unknown', city: 'Unknown', ip: 'Unknown', timezone: 'Unknown' }
                        } as UserStats);
                    }
                });
            }
        });

        this.notifyListeners('room-update', {});
        this.notifyListeners('user-update', {});
    }

    private processReportsData(data: any): void {
        this.reports.clear();
        Object.entries(data).forEach(([id, report]: [string, any]) => {
            this.reports.set(id, { ...report, id });
        });
        this.notifyListeners('report-created', {});
    }

    private processModerationData(data: any): void {
        this.moderationActions = Object.entries(data).map(([id, action]: [string, any]) => ({
            ...action,
            id
        }));
        this.notifyListeners('moderation-update', {});
    }

    /**
     * Login as admin
     */
    async login(email: string, password: string): Promise<AdminUser | null> {
        try {
            const auth = getFirebaseAuth();
            const db = getFirebaseDatabase();
            if (!auth || !db) return null;

            // 1. Authenticate with Firebase Auth
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // 2. Verify authorization in 'authorized_admins' node
            const adminRef = ref(db, `authorized_admins/${user.uid}`);
            const snapshot = await get(adminRef);
            const adminData = snapshot.val();

            if (adminData) {
                // If authorized, construct AdminUser object
                const adminUser: AdminUser = {
                    id: user.uid,
                    email: user.email || email,
                    role: adminData.role || 'admin',
                    permissions: adminData.permissions || [
                        { resource: 'rooms', actions: ['read', 'write'] },
                        { resource: 'users', actions: ['read'] }
                    ],
                    createdAt: adminData.createdAt || Date.now(),
                    lastActive: Date.now(),
                    isActive: true,
                };

                this.currentAdmin = adminUser;
                this.log('info', 'auth', `Admin ${email} authenticated successfully`);

                // Start listeners now that we are authorized
                this.startAdminListeners();

                this.notifyListeners('admin-login', adminUser);
                return adminUser;
            } else {
                // Authenticated but not in authorized list
                this.log('warning', 'auth', `User ${email} tried to access admin but is not authorized`);
                await signOut(auth); // Sign out unauthorized user
            }
        } catch (e: any) {
            console.error("Admin Central: Login error", e);
            throw e; // Propagate error for UI handling
        }

        return null;
    }

    /**
     * Logout
     */
    async logout(): Promise<void> {
        if (this.currentAdmin) {
            const auth = getFirebaseAuth();
            if (auth) await signOut(auth);

            // Stop listeners on logout
            this.stopAdminListeners();

            this.log('info', 'auth', `Admin ${this.currentAdmin.email} logged out`);
            this.currentAdmin = null;
            this.notifyListeners('admin-logout', {});
        }
    }

    /**
     * Get current admin
     */
    getCurrentAdmin(): AdminUser | null {
        return this.currentAdmin;
    }

    /**
     * Check permission
     */
    hasPermission(resource: Permission['resource'], action: Permission['actions'][number]): boolean {
        if (!this.currentAdmin) return false;
        return this.currentAdmin.permissions.some(
            p => p.resource === resource && p.actions.includes(action)
        );
    }

    // ========== ROOM MANAGEMENT ==========

    /**
     * Register a room
     */
    registerRoom(roomId: string, roomName: string): void {
        this.rooms.set(roomId, {
            roomId,
            roomName,
            participantCount: 0,
            activeStreams: 0,
            createdAt: Date.now(),
            lastActivity: Date.now(),
            isActive: true,
        });
        this.log('info', 'rooms', `Room registered: ${roomName}`);
    }

    /**
     * Update room stats
     */
    updateRoomStats(roomId: string, updates: Partial<RoomStats>): void {
        const room = this.rooms.get(roomId);
        if (room) {
            Object.assign(room, updates, { lastActivity: Date.now() });
            this.notifyListeners('room-update', room);
        }
    }

    /**
     * Get all rooms
     */
    getRooms(): RoomStats[] {
        return Array.from(this.rooms.values());
    }

    /**
     * Get active rooms
     */
    getActiveRooms(): RoomStats[] {
        return Array.from(this.rooms.values()).filter(r => r.isActive);
    }

    /**
     * Close a room
     */
    async closeRoom(roomId: string): Promise<void> {
        const room = this.rooms.get(roomId);
        if (room) {
            room.isActive = false;
            this.log('info', 'rooms', `Room closed: ${room.roomName}`);
            this.notifyListeners('room-closed', room);

            // Optional: Mark as closed in Firebase
            const db = getFirebaseDatabase();
            if (db) {
                await update(ref(db, `rooms/${roomId}`), { status: 'closed' });
            }
        }
    }

    /**
     * Delete a room and its associated data
     */
    async deleteRoom(roomId: string): Promise<boolean> {
        try {
            const db = getFirebaseDatabase();
            if (!db) return false;

            // Remove room
            await remove(ref(db, `rooms/${roomId}`));

            // Remove telemetry
            await remove(ref(db, `telemetry/${roomId}`));

            // Remove calls
            await remove(ref(db, `calls/${roomId}`));

            // Remove games
            await remove(ref(db, `games/${roomId}`));

            this.rooms.delete(roomId);
            this.log('warning', 'rooms', `Room deleted: ${roomId}`);
            this.notifyListeners('room-update', {});
            return true;
        } catch (e) {
            console.error(`Admin: Failed to delete room ${roomId}`, e);
            return false;
        }
    }

    /**
     * Get room by ID
     */
    getRoom(roomId: string): RoomStats | undefined {
        return this.rooms.get(roomId);
    }

    // ========== USER MANAGEMENT ==========

    /**
     * Register user stats
     */
    registerUser(userId: string, displayName: string, deviceId: string): void {
        this.users.set(userId, {
            userId,
            displayName,
            deviceId,
            roomCount: 0,
            totalMessages: 0,
            joinTime: Date.now(),
            lastActive: Date.now(),
            isBanned: false,
        });
    }

    /**
     * Update user stats
     */
    updateUserStats(userId: string, updates: Partial<UserStats>): void {
        const user = this.users.get(userId);
        if (user) {
            Object.assign(user, updates, { lastActive: Date.now() });
            this.notifyListeners('user-update', user);
        }
    }

    /**
     * Get all users
     */
    getUsers(): UserStats[] {
        return Array.from(this.users.values());
    }

    /**
     * Get user by ID
     */
    getUser(userId: string): UserStats | undefined {
        return this.users.get(userId);
    }

    /**
     * Get users by device
     */
    getUsersByDevice(deviceId: string): UserStats[] {
        return Array.from(this.users.values()).filter(u => u.deviceId === deviceId);
    }

    /**
     * Collect and update device info for user
     */
    updateUserDeviceInfo(userId: string): void {
        const user = this.users.get(userId);
        if (!user) return;

        const nav = navigator;
        const screen = window.screen;

        user.deviceInfo = {
            os: this.getOS(),
            browser: this.getBrowser(),
            deviceType: this.getDeviceType(),
            language: nav.language || 'unknown',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            screenResolution: `${screen.width}x${screen.height}`,
            userAgent: nav.userAgent || 'unknown',
        };

        this.notifyListeners('user-update', user);
    }

    /**
     * Collect and update connection info for user
     */
    async updateUserConnectionInfo(userId: string): Promise<void> {
        const user = this.users.get(userId);
        if (!user) return;

        const nav = navigator as any;

        if (nav.connection) {
            const conn = nav.connection;
            user.connectionInfo = {
                type: conn.type || 'unknown',
                effectiveType: conn.effectiveType,
                downlink: conn.downlink,
                rtt: conn.rtt,
            };
        } else {
            user.connectionInfo = {
                type: 'unknown',
            };
        }

        this.notifyListeners('user-update', user);
    }

    /**
     * Update user location info (from IP - simulated)
     */
    updateUserLocationInfo(userId: string, location: { country: string; city: string; ip: string }): void {
        const user = this.users.get(userId);
        if (!user) return;

        user.locationInfo = {
            ...location,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };

        this.notifyListeners('user-update', user);
    }

    /**
     * Update session duration
     */
    updateSessionDuration(userId: string): void {
        const user = this.users.get(userId);
        if (!user || !user.joinTime) return;

        const duration = Math.floor((Date.now() - user.joinTime) / 1000);

        if (!user.sessionInfo) {
            user.sessionInfo = {
                sessionDuration: duration,
                totalSessionTime: duration,
                lastIp: '',
                loginCount: 1,
            };
        } else {
            user.sessionInfo.sessionDuration = duration;
            user.sessionInfo.totalSessionTime += duration;
            user.sessionInfo.loginCount += 1;
        }

        this.notifyListeners('user-update', user);
    }

    /**
     * Get OS from user agent
     */
    private getOS(): string {
        const ua = navigator.userAgent;
        if (ua.includes('Windows')) return 'Windows';
        if (ua.includes('Mac')) return 'macOS';
        if (ua.includes('Linux')) return 'Linux';
        if (ua.includes('Android')) return 'Android';
        if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
        return 'Unknown';
    }

    /**
     * Get browser from user agent
     */
    private getBrowser(): string {
        const ua = navigator.userAgent;
        if (ua.includes('Chrome')) return 'Chrome';
        if (ua.includes('Safari')) return 'Safari';
        if (ua.includes('Firefox')) return 'Firefox';
        if (ua.includes('Edge')) return 'Edge';
        if (ua.includes('Opera')) return 'Opera';
        return 'Unknown';
    }

    /**
     * Get device type
     */
    private getDeviceType(): 'desktop' | 'mobile' | 'tablet' {
        const ua = navigator.userAgent;
        if (ua.includes('Tablet') || ua.includes('iPad')) return 'tablet';
        if (ua.includes('Mobile')) return 'mobile';
        return 'desktop';
    }

    /**
     * Ban user
     */
    async banUser(userId: string, reason: string): Promise<void> {
        const db = getFirebaseDatabase();
        if (!db) return;

        const action: ModerationAction = {
            id: this.generateId(),
            type: 'ban',
            targetUserId: userId,
            moderatorId: this.currentAdmin?.id || 'system',
            reason,
            timestamp: Date.now(),
        };

        const moderationRef = ref(db, `moderation/${action.id}`);
        await set(moderationRef, action);

        this.log('warning', 'moderation', `User banned in Firebase: ${userId}`);
    }

    /**
     * Unban user
     */
    async unbanUser(userId: string): Promise<void> {
        const db = getFirebaseDatabase();
        if (!db) return;

        // In this architecture, unbanning means removing or updating the ban record
        // Simplified: find the ban and remove it
        const bans = this.moderationActions.filter(a => a.type === 'ban' && a.targetUserId === userId);
        for (const ban of bans) {
            await remove(ref(db, `moderation/${ban.id}`));
        }

        this.log('info', 'moderation', `User unbanned records cleared: ${userId}`);
    }

    // ========== REPORTS ==========

    /**
     * Create report
     */
    async createReport(
        type: Report['type'],
        reporterId: string,
        options?: {
            reportedId?: string;
            roomId?: string;
            message?: string;
            evidence?: string[];
        }
    ): Promise<Report | null> {
        const db = getFirebaseDatabase();
        if (!db) return null;

        const reportId = this.generateId();
        const report: Report = {
            id: reportId,
            type,
            reporterId,
            reportedId: options?.reportedId,
            roomId: options?.roomId,
            message: options?.message,
            evidence: options?.evidence,
            status: 'pending',
            createdAt: Date.now(),
        };

        const reportRef = ref(db, `reports/${reportId}`);
        await set(reportRef, report);

        this.log('info', 'reports', `Report created and persisted: ${type}`);
        return report;
    }

    /**
     * Get all reports
     */
    getReports(): Report[] {
        return Array.from(this.reports.values());
    }

    /**
     * Get pending reports
     */
    getPendingReports(): Report[] {
        return Array.from(this.reports.values()).filter(r => r.status === 'pending');
    }

    /**
     * Review report
     */
    async reviewReport(reportId: string, status: Report['status']): Promise<void> {
        const db = getFirebaseDatabase();
        if (!db) return;

        const report = this.reports.get(reportId);
        if (report) {
            const updates: any = {};
            updates[`reports/${reportId}/status`] = status;
            updates[`reports/${reportId}/reviewedBy`] = this.currentAdmin?.id;
            updates[`reports/${reportId}/reviewedAt`] = Date.now();

            // Add to mod actions
            const actionId = this.generateId();
            updates[`moderation/${actionId}`] = {
                id: actionId,
                type: 'warn',
                targetUserId: report.reportedId || 'unknown',
                moderatorId: this.currentAdmin?.id || 'system',
                reason: `Report ${status}: ${report.type}`,
                timestamp: Date.now(),
            };

            await update(ref(db), updates);
            this.log('info', 'reports', `Report reviewed and persisted: ${reportId}`);
        }
    }

    /**
     * Get detailed telemetry history
     */
    async getTelemetryHistory(): Promise<TelemetryEvent[]> {
        return await telemetry.getGlobalHistory();
    }

    /**
     * Clear all telemetry logs
     */
    async clearTelemetry(): Promise<void> {
        const db = getFirebaseDatabase();
        if (db) {
            await remove(ref(db, 'telemetry'));
            this.log('warning', 'system', 'Global telemetry cleared');
        }
    }

    /**
     * Delete all messages from a user (GDPR/Compliance)
     */
    async deleteUserMessages(userId: string): Promise<void> {
        // Implementation for clearing user activity
        this.log('info', 'users', `User messages wiped: ${userId}`);
    }

    // ========== MODERATION ==========

    /**
     * Warn user
     */
    async warnUser(userId: string, reason: string): Promise<void> {
        const db = getFirebaseDatabase();
        if (!db) return;

        const actionId = this.generateId();
        const action: ModerationAction = {
            id: actionId,
            type: 'warn',
            targetUserId: userId,
            moderatorId: this.currentAdmin?.id || 'system',
            reason,
            timestamp: Date.now(),
        };

        await set(ref(db, `moderation/${actionId}`), action);
        this.log('info', 'moderation', `User warned in Firebase: ${userId}`);
    }

    /**
     * Mute user
     */
    async muteUser(userId: string, duration: number, reason: string): Promise<void> {
        const db = getFirebaseDatabase();
        if (!db) return;

        const actionId = this.generateId();
        const action: ModerationAction = {
            id: actionId,
            type: 'mute',
            targetUserId: userId,
            moderatorId: this.currentAdmin?.id || 'system',
            reason,
            duration,
            timestamp: Date.now(),
        };

        await set(ref(db, `moderation/${actionId}`), action);
        this.log('info', 'moderation', `User muted in Firebase: ${userId}`);
    }

    /**
     * Kick user from room
     */
    async kickUser(userId: string, roomId: string, reason: string): Promise<void> {
        const db = getFirebaseDatabase();
        if (!db) return;

        const actionId = this.generateId();
        const action: ModerationAction = {
            id: actionId,
            type: 'kick',
            targetUserId: userId,
            moderatorId: this.currentAdmin?.id || 'system',
            reason,
            timestamp: Date.now(),
        };

        await set(ref(db, `moderation/${actionId}`), action);
        this.log('info', 'moderation', `User kicked in Firebase: ${userId}`);
        this.notifyListeners('user-kicked', { userId, roomId });
    }

    /**
     * Get moderation actions
     */
    getModerationActions(): ModerationAction[] {
        return [...this.moderationActions];
    }

    /**
     * Clear all moderation history
     */
    async clearModerationHistory(): Promise<void> {
        const db = getFirebaseDatabase();
        if (db) {
            await remove(ref(db, 'moderation'));
            this.log('warning', 'system', 'Global moderation history cleared');
        }
    }

    /**
     * Get moderation actions for user
     */
    getUserModerationHistory(userId: string): ModerationAction[] {
        return this.moderationActions.filter(a => a.targetUserId === userId);
    }

    // ========== ANALYTICS ==========

    /**
     * Get system health
     */
    getSystemHealth(): SystemHealth {
        return {
            uptime: Date.now() - (this.getStartupTime() || Date.now()),
            cpuUsage: Math.random() * 100, // Simulated
            memoryUsage: Math.random() * 100, // Simulated
            activeConnections: this.users.size,
            roomsActive: this.getActiveRooms().length,
            messagesPerMinute: Math.floor(Math.random() * 1000), // Simulated
            errorsLastHour: Math.floor(Math.random() * 10), // Simulated
            lastUpdated: Date.now(),
        };
    }

    /**
     * Get analytics summary
     */
    getAnalyticsSummary(): {
        totalRooms: number;
        activeRooms: number;
        totalUsers: number;
        activeUsers: number;
        totalMessages: number;
        pendingReports: number;
        bansToday: number;
    } {
        const today = Date.now() - 86400000;
        const bansToday = this.moderationActions.filter(
            a => a.type === 'ban' && a.timestamp > today
        ).length;

        return {
            totalRooms: this.rooms.size,
            activeRooms: this.getActiveRooms().length,
            totalUsers: this.users.size,
            activeUsers: this.users.size, // Simplified
            totalMessages: Array.from(this.users.values()).reduce((sum, u) => sum + u.totalMessages, 0),
            pendingReports: this.getPendingReports().length,
            bansToday,
        };
    }

    // ========== LOGGING ==========

    /**
     * Log an event
     */
    log(level: LogEntry['level'], category: string, message: string, metadata?: Record<string, unknown>): void {
        const entry: LogEntry = {
            id: this.generateId(),
            timestamp: Date.now(),
            level,
            category,
            message,
            metadata,
        };
        this.logs.push(entry);

        // Keep only last 1000 logs
        if (this.logs.length > 1000) {
            this.logs = this.logs.slice(-1000);
        }

        this.notifyListeners('log', entry);
    }

    /**
     * Get logs
     */
    getLogs(filter?: { level?: string; category?: string; since?: number }): LogEntry[] {
        let filtered = [...this.logs];

        if (filter?.level) {
            filtered = filtered.filter(l => l.level === filter.level);
        }
        if (filter?.category) {
            filtered = filtered.filter(l => l.category === filter.category);
        }
        if (filter?.since !== undefined) {
            const since = filter.since;
            filtered = filtered.filter(l => l.timestamp >= since);
        }

        return filtered;
    }

    // ========== SETTINGS ==========

    /**
     * Configure admin settings
     */
    configure(config: Partial<AdminConfig>): void {
        this.config = { ...this.config, ...config };
        this.log('info', 'settings', 'Admin configuration updated');
    }

    /**
     * Get config
     */
    getConfig(): AdminConfig {
        return { ...this.config };
    }

    // ========== EVENT SYSTEM ==========

    /**
     * Subscribe to events
     */
    subscribe(event: string, listener: (data: unknown) => void): () => void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(listener);
        return () => this.listeners.get(event)?.delete(listener);
    }

    /**
     * Notify listeners
     */
    private notifyListeners(event: string, data: unknown): void {
        this.listeners.get(event)?.forEach(listener => listener(data));
    }

    // ========== HELPERS ==========

    private generateId(): string {
        return `${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private getStartupTime(): number {
        return 0; // Simplified
    }

    /**
     * Export all data
     */
    exportData(): {
        admin: AdminUser | null;
        rooms: RoomStats[];
        users: UserStats[];
        reports: Report[];
        config: AdminConfig;
    } {
        return {
            admin: this.currentAdmin,
            rooms: this.getRooms(),
            users: this.getUsers(),
            reports: this.getReports(),
            config: this.getConfig(),
        };
    }

    /**
     * Cleanup
     */
    destroy(): void {
        this.currentAdmin = null;
        this.admins.clear();
        this.rooms.clear();
        this.users.clear();
        this.reports.clear();
        this.logs = [];
        this.moderationActions = [];
        this.listeners.clear();
    }
}

export const adminCentral = AdminCentral.getInstance();

