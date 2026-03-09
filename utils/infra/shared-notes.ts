/**
 * Shared Notes Manager
 * 
 * Manages real-time collaborative notes for rooms.
 */

import { getFirebaseDatabase } from "@/lib/firebase"
import { ref, set, get, update, onValue, remove } from "firebase/database"

export interface Note {
    id: string
    title: string
    content: string
    createdAt: number
    updatedAt: number
    createdBy: string
    color?: string
    isPinned: boolean
}

export interface SharedNotes {
    roomId: string
    notes: Record<string, Note>
    lastModified: number
    lastModifiedBy: string
}

interface NotesState {
    isActive: boolean
    notes: Record<string, Note>
    lastModified: number
    activeNoteId: string | null
}

class SharedNotesManager {
    private static instance: SharedNotesManager
    private state: NotesState = {
        isActive: false,
        notes: {},
        lastModified: 0,
        activeNoteId: null,
    }
    private listeners: ((state: NotesState) => void)[] = []
    private roomId: string | null = null
    private userId: string | null = null
    private userName: string = "Anonymous"
    private unsubscribers: (() => void)[] = []

    private constructor() { }

    static getInstance(): SharedNotesManager {
        if (!SharedNotesManager.instance) {
            SharedNotesManager.instance = new SharedNotesManager()
        }
        return SharedNotesManager.instance
    }

    /**
     * Initialize for a room
     */
    initialize(roomId: string, userId: string, userName: string): void {
        this.roomId = roomId
        this.userId = userId
        this.userName = userName
    }

    /**
     * Initialize notes for a room
     */
    async initializeNotes(): Promise<void> {
        if (!this.roomId || !getFirebaseDatabase()!) return

        try {
            const notesRef = ref(getFirebaseDatabase()!, `notes/${this.roomId}`)
            const snapshot = await get(notesRef)

            if (!snapshot.exists()) {
                // Create initial welcome note
                const welcomeNote: Note = {
                    id: `note-${Date.now()}`,
                    title: "Welcome!",
                    content: "This is a shared note. Click to edit and collaborate with others in real-time.",
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    createdBy: this.userName,
                    color: "#fef3c7",
                    isPinned: true,
                }

                await set(notesRef, {
                    roomId: this.roomId,
                    notes: {
                        [welcomeNote.id]: welcomeNote,
                    },
                    lastModified: Date.now(),
                    lastModifiedBy: this.userName,
                })
            }

            this.state.isActive = true
            this.notifyListeners()
        } catch (error) {
            console.error("Failed to initialize notes:", error)
        }
    }

    /**
     * Create a new note
     */
    async createNote(title: string, content: string = "", color?: string): Promise<Note | null> {
        if (!this.roomId || !getFirebaseDatabase() || !this.userId) return null

        try {
            const note: Note = {
                id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                title,
                content,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                createdBy: this.userName,
                color: color || "#f8fafc",
                isPinned: false,
            }

            const noteRef = ref(getFirebaseDatabase()!, `notes/${this.roomId}/notes/${note.id}`)
            await set(noteRef, note)

            // Update last modified
            const notesMetaRef = ref(getFirebaseDatabase()!, `notes/${this.roomId}`)
            await update(notesMetaRef, {
                lastModified: Date.now(),
                lastModifiedBy: this.userName,
            })

            this.state.notes[note.id] = note
            this.state.activeNoteId = note.id
            this.notifyListeners()

            return note
        } catch (error) {
            console.error("Failed to create note:", error)
            return null
        }
    }

    /**
     * Update a note
     */
    async updateNote(noteId: string, updates: Partial<Note>): Promise<boolean> {
        if (!this.roomId || !getFirebaseDatabase() || !this.state.notes[noteId]) return false

        try {
            const noteRef = ref(getFirebaseDatabase()!, `notes/${this.roomId}/notes/${noteId}`)
            const currentNote = this.state.notes[noteId]

            await update(noteRef, {
                ...updates,
                updatedAt: Date.now(),
            })

            // Update local state
            this.state.notes[noteId] = {
                ...currentNote,
                ...updates,
                updatedAt: Date.now(),
            }

            // Update last modified
            const notesMetaRef = ref(getFirebaseDatabase()!, `notes/${this.roomId}`)
            await update(notesMetaRef, {
                lastModified: Date.now(),
                lastModifiedBy: this.userName,
            })

            this.notifyListeners()
            return true
        } catch (error) {
            console.error("Failed to update note:", error)
            return false
        }
    }

    /**
     * Delete a note
     */
    async deleteNote(noteId: string): Promise<boolean> {
        if (!this.roomId || !getFirebaseDatabase() || !this.state.notes[noteId]) return false

        try {
            const noteRef = ref(getFirebaseDatabase()!, `notes/${this.roomId}/notes/${noteId}`)
            await remove(noteRef)

            delete this.state.notes[noteId]

            if (this.state.activeNoteId === noteId) {
                this.state.activeNoteId = null
            }

            // Update last modified
            const notesMetaRef = ref(getFirebaseDatabase()!, `notes/${this.roomId}`)
            await update(notesMetaRef, {
                lastModified: Date.now(),
                lastModifiedBy: this.userName,
            })

            this.notifyListeners()
            return true
        } catch (error) {
            console.error("Failed to delete note:", error)
            return false
        }
    }

    /**
     * Toggle pin status
     */
    async togglePin(noteId: string): Promise<boolean> {
        const note = this.state.notes[noteId]
        if (!note) return false

        return this.updateNote(noteId, { isPinned: !note.isPinned })
    }

    /**
     * Set active note
     */
    setActiveNote(noteId: string | null): void {
        this.state.activeNoteId = noteId
        this.notifyListeners()
    }

    /**
     * Get all notes sorted by pinned status and update time
     */
    getSortedNotes(): Note[] {
        return Object.values(this.state.notes).sort((a, b) => {
            // Pinned notes first
            if (a.isPinned && !b.isPinned) return -1
            if (!a.isPinned && b.isPinned) return 1
            // Then by updated time
            return b.updatedAt - a.updatedAt
        })
    }

    /**
     * Get active note
     */
    getActiveNote(): Note | null {
        if (!this.state.activeNoteId) return null
        return this.state.notes[this.state.activeNoteId] || null
    }

    /**
     * Get current state
     */
    getState(): NotesState {
        return { ...this.state }
    }

    /**
     * Subscribe to state changes
     */
    subscribe(listener: (state: NotesState) => void): () => void {
        this.listeners.push(listener)
        return () => {
            this.listeners = this.listeners.filter((l) => l !== listener)
        }
    }

    /**
     * Notify all listeners
     */
    private notifyListeners(): void {
        this.listeners.forEach((listener) => listener(this.getState()))
    }

    /**
     * Listen for notes changes
     */
    listenForNotes(): void {
        if (!this.roomId || !getFirebaseDatabase()!) return

        const notesRef = ref(getFirebaseDatabase()!, `notes/${this.roomId}`)
        const unsubscribe = onValue(notesRef, (snapshot) => {
            const data = snapshot.val() as SharedNotes | null

            if (data?.notes) {
                this.state.isActive = true
                this.state.notes = data.notes
                this.state.lastModified = data.lastModified || 0
            } else {
                this.state.isActive = false
                this.state.notes = {}
            }

            this.notifyListeners()
        })

        this.unsubscribers.push(unsubscribe)
    }

    /**
     * Clean up
     */
    destroy(): void {
        this.unsubscribers.forEach((unsub) => unsub())
        this.unsubscribers = []
        this.roomId = null
        this.userId = null

        this.state = {
            isActive: false,
            notes: {},
            lastModified: 0,
            activeNoteId: null,
        }
    }
}

export const sharedNotesManager = SharedNotesManager.getInstance()
export type { NotesState }
