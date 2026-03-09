import { getFirebaseDatabase } from "@/lib/firebase"
import { ref, set, get, update, remove, onValue } from "firebase/database"

export interface CalendarEvent {
    id: string
    title: string
    description?: string
    startTime: number
    endTime: number
    roomId?: string
    createdBy: string
    createdByName: string
    attendees: string[]
    reminders: number[] // Minutes before event to remind
    recurrence?: {
        type: "daily" | "weekly" | "monthly" | "custom"
        interval: number
        until?: number
    }
    color?: string
    isAllDay: boolean
}

export interface Reminder {
    id: string
    eventId: string
    userId: string
    time: number
    message: string
    acknowledged: boolean
}

export interface Availability {
    userId: string
    status: "available" | "busy" | "away" | "dnd"
    until?: number
    message?: string
}

export class CalendarManager {
    private static instance: CalendarManager
    private listeners: Array<() => void> = []

    static getInstance(): CalendarManager {
        if (!CalendarManager.instance) {
            CalendarManager.instance = new CalendarManager()
        }
        return CalendarManager.instance
    }

    // Create an event
    async createEvent(
        roomId: string | null,
        event: Omit<CalendarEvent, "id"> & { createdBy?: string; createdByName?: string; attendees?: string[] }
    ): Promise<CalendarEvent | null> {
        if (!getFirebaseDatabase()!) return null

        try {
            const eventId = `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

            const newEvent: CalendarEvent = {
                ...event,
                id: eventId,
                createdBy: event.createdBy || "unknown",
                createdByName: event.createdByName || "Unknown User",
                attendees: event.attendees || [],
            }

            await set(ref(getFirebaseDatabase()!, `calendar/events/${eventId}`), newEvent)

            // Create reminders
            for (const minutes of event.reminders || []) {
                const reminderTime = event.startTime - minutes * 60 * 1000
                if (reminderTime > Date.now()) {
                    const reminder: Reminder = {
                        id: `reminder_${eventId}_${minutes}`,
                        eventId,
                        userId: event.createdBy || "unknown",
                        time: reminderTime,
                        message: `Reminder: ${event.title} starts in ${minutes} minutes`,
                        acknowledged: false,
                    }
                    await set(ref(getFirebaseDatabase()!, `calendar/reminders/${reminder.id}`), reminder)
                }
            }

            return newEvent
        } catch (error) {
            console.error("Failed to create event:", error)
            return null
        }
    }

    // Get event by ID
    async getEvent(eventId: string): Promise<CalendarEvent | null> {
        if (!getFirebaseDatabase()!) return null

        try {
            const eventRef = ref(getFirebaseDatabase()!, `calendar/events/${eventId}`)
            const snapshot = await get(eventRef)
            return snapshot.exists() ? (snapshot.val() as CalendarEvent) : null
        } catch (error) {
            console.error("Failed to get event:", error)
            return null
        }
    }

    // Get events for a date range
    async getEvents(startTime: number, endTime: number): Promise<CalendarEvent[]> {
        if (!getFirebaseDatabase()!) return []

        try {
            const eventsRef = ref(getFirebaseDatabase()!, "calendar/events")
            const snapshot = await get(eventsRef)

            if (!snapshot.exists()) {
                return []
            }

            const events: CalendarEvent[] = []
            snapshot.forEach((child) => {
                const event = child.val() as CalendarEvent
                if (event.startTime >= startTime && event.startTime <= endTime) {
                    events.push(event)
                }
            })

            return events.sort((a, b) => a.startTime - b.startTime)
        } catch (error) {
            console.error("Failed to get events:", error)
            return []
        }
    }

    // Get events for a specific day
    async getEventsForDay(date: Date): Promise<CalendarEvent[]> {
        const startOfDay = new Date(date)
        startOfDay.setHours(0, 0, 0, 0)

        const endOfDay = new Date(date)
        endOfDay.setHours(23, 59, 59, 999)

        return this.getEvents(startOfDay.getTime(), endOfDay.getTime())
    }

    // Update event
    async updateEvent(eventId: string, updates: Partial<CalendarEvent>): Promise<boolean> {
        if (!getFirebaseDatabase()!) return false

        try {
            await update(ref(getFirebaseDatabase()!, `calendar/events/${eventId}`), updates)
            return true
        } catch (error) {
            console.error("Failed to update event:", error)
            return false
        }
    }

    // Delete event
    async deleteEvent(eventId: string): Promise<boolean> {
        if (!getFirebaseDatabase()!) return false

        try {
            // Delete event
            await remove(ref(getFirebaseDatabase()!, `calendar/events/${eventId}`))

            // Delete associated reminders
            const remindersRef = ref(getFirebaseDatabase()!, "calendar/reminders")
            const snapshot = await get(remindersRef)

            if (snapshot.exists()) {
                snapshot.forEach((child) => {
                    const reminder = child.val() as Reminder
                    if (reminder.eventId === eventId && getFirebaseDatabase()!) {
                        remove(ref(getFirebaseDatabase()!, `calendar/reminders/${child.key}`))
                    }
                })
            }

            return true
        } catch (error) {
            console.error("Failed to delete event:", error)
            return false
        }
    }

    // Add attendee to event
    async addAttendee(eventId: string, userId: string): Promise<boolean> {
        if (!getFirebaseDatabase()!) return false

        try {
            const event = await this.getEvent(eventId)
            if (!event) return false

            if (!event.attendees.includes(userId)) {
                event.attendees.push(userId)
                await this.updateEvent(eventId, { attendees: event.attendees })
            }

            return true
        } catch (error) {
            console.error("Failed to add attendee:", error)
            return false
        }
    }

    // Set availability status
    async setAvailability(userId: string, status: Availability["status"], message?: string, until?: number): Promise<boolean> {
        if (!getFirebaseDatabase()!) return false

        try {
            const availability: Availability = {
                userId,
                status,
                message,
                until,
            }

            await set(ref(getFirebaseDatabase()!, `availability/${userId}`), availability)
            return true
        } catch (error) {
            console.error("Failed to set availability:", error)
            return false
        }
    }

    // Get availability for user
    async getAvailability(userId: string): Promise<Availability | null> {
        if (!getFirebaseDatabase()!) return null

        try {
            const availabilityRef = ref(getFirebaseDatabase()!, `availability/${userId}`)
            const snapshot = await get(availabilityRef)

            if (!snapshot.exists()) {
                return null
            }

            const availability = snapshot.val() as Availability

            // Check if availability has expired
            if (availability.until && availability.until < Date.now()) {
                return { userId, status: "available" }
            }

            return availability
        } catch (error) {
            console.error("Failed to get availability:", error)
            return null
        }
    }

    // Get availability for multiple users
    async getAvailabilityForUsers(userIds: string[]): Promise<Map<string, Availability>> {
        if (!getFirebaseDatabase()!) return new Map()

        const availabilityMap = new Map<string, Availability>()

        try {
            await Promise.all(
                userIds.map(async (userId) => {
                    const availability = await this.getAvailability(userId)
                    if (availability) {
                        availabilityMap.set(userId, availability)
                    }
                })
            )
        } catch (error) {
            console.error("Failed to get availability for users:", error)
        }

        return availabilityMap
    }

    // Get pending reminders for user
    async getReminders(userId: string): Promise<Reminder[]> {
        if (!getFirebaseDatabase()!) return []

        try {
            const remindersRef = ref(getFirebaseDatabase()!, "calendar/reminders")
            const snapshot = await get(remindersRef)

            if (!snapshot.exists()) {
                return []
            }

            const reminders: Reminder[] = []
            snapshot.forEach((child) => {
                const reminder = child.val() as Reminder
                if (reminder.userId === userId && !reminder.acknowledged && reminder.time > Date.now()) {
                    reminders.push(reminder)
                }
            })

            return reminders.sort((a, b) => a.time - b.time)
        } catch (error) {
            console.error("Failed to get reminders:", error)
            return []
        }
    }

    // Acknowledge reminder
    async acknowledgeReminder(reminderId: string): Promise<boolean> {
        if (!getFirebaseDatabase()!) return false

        try {
            await update(ref(getFirebaseDatabase()!, `calendar/reminders/${reminderId}`), { acknowledged: true })
            return true
        } catch (error) {
            console.error("Failed to acknowledge reminder:", error)
            return false
        }
    }

    // Schedule meeting (quick create event with room)
    async scheduleMeeting(
        title: string,
        startTime: number,
        duration: number, // minutes
        createdBy: string,
        createdByName: string,
        attendeeIds: string[]
    ): Promise<CalendarEvent | null> {
        const roomId = `meeting_${Date.now()}`

        return this.createEvent(roomId, {
            title,
            startTime,
            endTime: startTime + duration * 60 * 1000,
            createdBy,
            createdByName,
            attendees: attendeeIds,
            reminders: [15, 60], // 15 min and 1 hour before
            color: "#3B82F6",
            isAllDay: false,
        })
    }

    // Listen for events
    listenForEvents(
        startTime: number,
        endTime: number,
        callback: (events: CalendarEvent[]) => void
    ): () => void {
        if (!getFirebaseDatabase()!) return () => { }

        const eventsRef = ref(getFirebaseDatabase()!, "calendar/events")

        const unsubscribe = onValue(eventsRef, (snapshot) => {
            if (!snapshot.exists()) {
                callback([])
                return
            }

            const events: CalendarEvent[] = []
            snapshot.forEach((child) => {
                const event = child.val() as CalendarEvent
                if (event.startTime >= startTime && event.startTime <= endTime) {
                    events.push(event)
                }
            })

            callback(events.sort((a, b) => a.startTime - b.startTime))
        })

        this.listeners.push(unsubscribe)
        return unsubscribe
    }

    // Listen for availability changes
    listenForAvailability(
        userId: string,
        callback: (availability: Availability | null) => void
    ): () => void {
        if (!getFirebaseDatabase()!) return () => { }

        const availabilityRef = ref(getFirebaseDatabase()!, `availability/${userId}`)

        const unsubscribe = onValue(availabilityRef, (snapshot) => {
            if (!snapshot.exists()) {
                callback(null)
                return
            }
            callback(snapshot.val() as Availability)
        })

        this.listeners.push(unsubscribe)
        return unsubscribe
    }

    // Generate time slots for a day
    static generateTimeSlots(startHour: number = 0, endHour: number = 23): Date[] {
        const slots: Date[] = []
        for (let hour = startHour; hour <= endHour; hour++) {
            slots.push(new Date(new Date().setHours(hour, 0, 0, 0)))
        }
        return slots
    }

    // Check if time slot is available
    static isSlotAvailable(events: CalendarEvent[], slotStart: number, slotEnd: number): boolean {
        return !events.some(
            (event) => event.startTime < slotEnd && event.endTime > slotStart
        )
    }

    // Get suggested meeting times
    async suggestMeetingTimes(
        attendeeIds: string[],
        duration: number, // minutes
        preferredDate: Date,
        range: number = 7 // days
    ): Promise<{ startTime: number; endTime: number; availableAttendees: number }[]> {
        const suggestions: { startTime: number; endTime: number; availableAttendees: number }[] = []
        const startOfDay = new Date(preferredDate)
        startOfDay.setHours(9, 0, 0, 0) // Start from 9 AM
        const endOfDay = new Date(preferredDate)
        endOfDay.setHours(17, 0, 0, 0) // End at 5 PM

        for (let day = 0; day < range; day++) {
            const currentDate = new Date(startOfDay)
            currentDate.setDate(currentDate.getDate() + day)

            // Skip weekends
            if (currentDate.getDay() === 0 || currentDate.getDay() === 6) continue

            const dayStart = currentDate.getTime()
            const dayEnd = new Date(currentDate).setHours(17, 0, 0, 0)

            const events = await this.getEvents(dayStart, dayEnd)
            const availability = await this.getAvailabilityForUsers(attendeeIds)

            // Check each hour
            for (let hour = 9; hour < 17; hour++) {
                const slotStart = new Date(currentDate).setHours(hour, 0, 0, 0)
                const slotEnd = slotStart + duration * 60 * 1000

                // Check if all attendees are available
                const busyAttendees = Array.from(availability.values()).filter(
                    (a) => a.status === "busy" || a.status === "dnd"
                ).length

                const eventsConflict = events.some(
                    (event) => event.startTime < slotEnd && event.endTime > slotStart
                )

                if (!eventsConflict && busyAttendees === 0) {
                    suggestions.push({
                        startTime: slotStart,
                        endTime: slotEnd,
                        availableAttendees: attendeeIds.length,
                    })
                }
            }
        }

        return suggestions
    }

    cleanup(): void {
        this.listeners.forEach((unsubscribe) => unsubscribe())
        this.listeners = []
    }
}
