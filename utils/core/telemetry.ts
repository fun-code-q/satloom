/**
 * Telemetry Manager
 *
 * Handles granular logging of user activities (Games, Quizzes, Theater, Calls)
 * and session metadata for administrative monitoring.
 *
 * PRIVACY NOTE (Tier 0): event *collection* is currently neutralized.
 * The README states "No third-party tracking. No Google Analytics, no Meta
 * Pixel, no Sentry." Previously, logEvent() fetched the visitor's approximate
 * geolocation from a third party (ipapi.co) and wrote display-name + geo +
 * device metadata to Firebase — directly contradicting that promise.
 *
 * logEvent() is now a no-op: no third-party fetch, no device fingerprint, no
 * Firebase write. All ~20 call sites are preserved unchanged, so a future,
 * consented telemetry design can be wired back in here without touching them.
 * The read-side helpers (listenToTelemetry, getGlobalHistory) remain so the
 * admin panel (admin-central.ts) keeps working — it will simply show no new
 * data, which is the intended "we stopped collecting" state.
 */

import { getFirebaseDatabase } from "@/lib/firebase";
import { ref, onValue, query, limitToLast, get } from "firebase/database";

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

    private constructor() { }

    static getInstance(): TelemetryManager {
        if (!TelemetryManager.instance) {
            TelemetryManager.instance = new TelemetryManager();
        }
        return TelemetryManager.instance;
    }

    /**
     * Log an event.
     *
     * Tier 0 (privacy): neutralized to a no-op. See the file-level PRIVACY NOTE.
     * Returns immediately without any network call or database write. The
     * signature is unchanged so existing call sites compile and behave
     * identically (they just stop collecting). A consented telemetry design
     * can be implemented here later.
     */
    async logEvent(
        _type: TelemetryEventType,
        _roomId: string,
        _userId: string,
        _userName: string,
        _details?: Record<string, any>
    ): Promise<void> {
        return;
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
