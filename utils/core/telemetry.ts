/**
 * Telemetry Manager
 * 
 * Handles granular logging of user activities (Games, Quizzes, Theater, Calls)
 * and session metadata for administrative monitoring.
 */

import { getFirebaseDatabase } from "@/lib/firebase";
import { ref, push, set, serverTimestamp, onValue, query, limitToLast, get } from "firebase/database";

export type TelemetryEventType =
    | 'room_created'
    | 'user_joined'
    | 'user_left'
    | 'theater_started'
    | 'game_started'
    | 'quiz_started'
    | 'karaoke_started'
    | 'whiteboard_started'
    | 'presentation_started'
    | 'call_started'
    | 'screen_share_started'
    | 'call_ended'
    | 'call_type_switched'
    | 'message_sent'
    | 'emoji_sent'
    | 'file_shared'
    | 'poll_created'
    | 'link_shared'
    | 'vibe_changed'
    | 'whiteboard_updated'
    | 'user_kicked';

export interface TelemetryEvent {
    id?: string;
    type: TelemetryEventType;
    roomId: string;
    userId: string;
    userName: string;
    timestamp: object;
    details?: Record<string, any>;
    location?: {
        country: string;
        city: string;
    };
    device?: {
        os: string;
        browser: string;
        type: string;
    };
}

class TelemetryManager {
    private static instance: TelemetryManager;
    private locationCache: { country: string; city: string } | null = null;

    private constructor() { }

    static getInstance(): TelemetryManager {
        if (!TelemetryManager.instance) {
            TelemetryManager.instance = new TelemetryManager();
        }
        return TelemetryManager.instance;
    }

    /**
     * Fetch approximate location based on IP
     */
    private async fetchLocation(): Promise<{ country: string; city: string }> {
        if (this.locationCache) return this.locationCache;

        try {
            const response = await fetch('https://ipapi.co/json/');
            const data = await response.json();
            this.locationCache = {
                country: data.country_name || 'Unknown',
                city: data.city || 'Unknown'
            };
            return this.locationCache;
        } catch (e) {
            console.error("Telemetry: Failed to fetch location", e);
            return { country: 'Unknown', city: 'Unknown' };
        }
    }

    /**
     * Get device metadata
     */
    private getDeviceMetadata() {
        const ua = navigator.userAgent;
        let type = 'desktop';
        if (/tablet|ipad/i.test(ua)) type = 'tablet';
        else if (/mobile|iphone|android/i.test(ua)) type = 'mobile';

        return {
            os: this.getOS(ua),
            browser: this.getBrowser(ua),
            type
        };
    }

    private getOS(ua: string): string {
        if (ua.includes('Windows')) return 'Windows';
        if (ua.includes('Mac')) return 'macOS';
        if (ua.includes('Linux')) return 'Linux';
        if (ua.includes('Android')) return 'Android';
        if (ua.includes('iOS') || ua.includes('iPhone')) return 'iOS';
        return 'Unknown';
    }

    private getBrowser(ua: string): string {
        if (ua.includes('Chrome')) return 'Chrome';
        if (ua.includes('Safari')) return 'Safari';
        if (ua.includes('Firefox')) return 'Firefox';
        if (ua.includes('Edge')) return 'Edge';
        return 'Unknown';
    }

    /**
     * Log an event to Firebase
     */
    async logEvent(
        type: TelemetryEventType,
        roomId: string,
        userId: string,
        userName: string,
        details?: Record<string, any>
    ): Promise<void> {
        try {
            const db = getFirebaseDatabase();
            if (!db) return;

            const location = await this.fetchLocation();
            const device = this.getDeviceMetadata();

            const eventRef = ref(db, `telemetry/${roomId}`);
            const newEventRef = push(eventRef);

            const event: TelemetryEvent = {
                type,
                roomId,
                userId,
                userName,
                timestamp: serverTimestamp(),
                // details can contain undefined values which Firebase rejects.
                // We clean it here while preserving the rest of the event structure.
                details: details ? JSON.parse(JSON.stringify(details, (_, value) =>
                    value === undefined ? null : value
                )) : {},
                location,
                device
            };

            await set(newEventRef, event);
            console.log(`Telemetry: Logged ${type} for room ${roomId}`);
        } catch (e) {
            console.error("Telemetry: Failed to log event", e);
        }
    }

    /**
     * Listen for telemetry events (Admin use)
     */
    listenToTelemetry(roomId: string, callback: (events: TelemetryEvent[]) => void) {
        const db = getFirebaseDatabase();
        if (!db) return () => { };

        const telemetryRef = query(ref(db, `telemetry/${roomId}`), limitToLast(100));
        return onValue(telemetryRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const events = Object.entries(data).map(([id, val]: [string, any]) => ({
                    ...val,
                    id
                }));
                callback(events as TelemetryEvent[]);
            } else {
                callback([]);
            }
        });
    }

    /**
     * Get global telemetry summary (Admin use)
     */
    async getGlobalHistory(): Promise<TelemetryEvent[]> {
        const db = getFirebaseDatabase();
        if (!db) return [];

        const telemetryRef = ref(db, 'telemetry');
        const snapshot = await get(telemetryRef);
        const data = snapshot.val();

        if (!data) return [];

        const allEvents: TelemetryEvent[] = [];
        Object.entries(data).forEach(([roomId, roomEvents]: [string, any]) => {
            Object.entries(roomEvents).forEach(([id, val]: [string, any]) => {
                allEvents.push({ ...val, id, roomId });
            });
        });

        return allEvents.sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0));
    }
}

export const telemetry = TelemetryManager.getInstance();
