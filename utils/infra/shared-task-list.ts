/**
 * Shared Task List Manager
 * 
 * Manages real-time collaborative task lists for rooms.
 */

import { getFirebaseDatabase } from "@/lib/firebase"
import { ref, set, get, update, onValue, remove } from "firebase/database"

export interface TaskItem {
    id: string
    text: string
    completed: boolean
    createdAt: number
    createdBy: string
    assignedTo?: string
    priority: "low" | "medium" | "high"
    dueDate?: number
}

export interface TaskList {
    roomId: string
    title: string
    tasks: Record<string, TaskItem>
    createdAt: number
    lastModified: number
    lastModifiedBy: string
}

interface TaskListState {
    isActive: boolean
    tasks: TaskItem[]
    title: string
    filter: "all" | "active" | "completed"
    sortBy: "date" | "priority" | "alphabetical"
}

class TaskListManager {
    private static instance: TaskListManager
    private state: TaskListState = {
        isActive: false,
        tasks: [],
        title: "Tasks",
        filter: "all",
        sortBy: "date",
    }
    private listeners: ((state: TaskListState) => void)[] = []
    private roomId: string | null = null
    private userId: string | null = null
    private userName: string = "Anonymous"
    private unsubscribers: (() => void)[] = []

    private constructor() { }

    static getInstance(): TaskListManager {
        if (!TaskListManager.instance) {
            TaskListManager.instance = new TaskListManager()
        }
        return TaskListManager.instance
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
     * Initialize task list for a room
     */
    async initializeTaskList(): Promise<void> {
        if (!this.roomId || !getFirebaseDatabase()!) return

        try {
            const tasksRef = ref(getFirebaseDatabase()!, `rooms/${this.roomId}/productivity/tasks`)
            const snapshot = await get(tasksRef)

            if (!snapshot.exists()) {
                // Create initial welcome task
                const welcomeTask: TaskItem = {
                    id: `task-${Date.now()}`,
                    text: "Welcome to the shared task list!",
                    completed: false,
                    createdAt: Date.now(),
                    createdBy: this.userName,
                    priority: "medium",
                }

                await set(tasksRef, {
                    roomId: this.roomId,
                    title: "Task List",
                    tasks: {
                        [welcomeTask.id]: welcomeTask,
                    },
                    createdAt: Date.now(),
                    lastModified: Date.now(),
                    lastModifiedBy: this.userName,
                })
            }

            this.state.isActive = true
            this.notifyListeners()
        } catch (error) {
            console.error("Failed to initialize task list:", error)
        }
    }

    /**
     * Add a new task
     */
    async addTask(text: string, priority: TaskItem["priority"] = "medium"): Promise<TaskItem | null> {
        if (!this.roomId || !getFirebaseDatabase() || !this.userId) return null

        try {
            const task: TaskItem = {
                id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                text,
                completed: false,
                createdAt: Date.now(),
                createdBy: this.userName,
                priority,
            }

            const taskRef = ref(getFirebaseDatabase()!, `rooms/${this.roomId}/productivity/tasks/tasks/${task.id}`)
            await set(taskRef, task)

            // Update last modified
            const tasksMetaRef = ref(getFirebaseDatabase()!, `rooms/${this.roomId}/productivity/tasks`)
            await update(tasksMetaRef, {
                lastModified: Date.now(),
                lastModifiedBy: this.userName,
            })

            this.state.tasks = [...this.state.tasks, task]
            this.notifyListeners()

            return task
        } catch (error) {
            console.error("Failed to add task:", error)
            return null
        }
    }

    /**
     * Toggle task completion
     */
    async toggleTask(taskId: string): Promise<boolean> {
        const task = this.state.tasks.find((t) => t.id === taskId)
        if (!task) return false

        return this.updateTask(taskId, { completed: !task.completed })
    }

    /**
     * Update a task
     */
    async updateTask(
        taskId: string,
        updates: Partial<TaskItem>
    ): Promise<boolean> {
        if (!this.roomId || !getFirebaseDatabase() || !this.state.tasks.find((t) => t.id === taskId))
            return false

        try {
            const taskRef = ref(getFirebaseDatabase()!, `rooms/${this.roomId}/productivity/tasks/tasks/${taskId}`)
            const currentTask = this.state.tasks.find((t) => t.id === taskId)

            await update(taskRef, updates)

            // Update local state
            this.state.tasks = this.state.tasks.map((t) =>
                t.id === taskId ? { ...t, ...updates } : t
            )

            // Update last modified
            const tasksMetaRef = ref(getFirebaseDatabase()!, `rooms/${this.roomId}/productivity/tasks`)
            await update(tasksMetaRef, {
                lastModified: Date.now(),
                lastModifiedBy: this.userName,
            })

            this.notifyListeners()
            return true
        } catch (error) {
            console.error("Failed to update task:", error)
            return false
        }
    }

    /**
     * Delete a task
     */
    async deleteTask(taskId: string): Promise<boolean> {
        if (!this.roomId || !getFirebaseDatabase() || !this.state.tasks.find((t) => t.id === taskId))
            return false

        try {
            const taskRef = ref(getFirebaseDatabase()!, `rooms/${this.roomId}/productivity/tasks/tasks/${taskId}`)
            await remove(taskRef)

            this.state.tasks = this.state.tasks.filter((t) => t.id !== taskId)

            // Update last modified
            const tasksMetaRef = ref(getFirebaseDatabase()!, `rooms/${this.roomId}/productivity/tasks`)
            await update(tasksMetaRef, {
                lastModified: Date.now(),
                lastModifiedBy: this.userName,
            })

            this.notifyListeners()
            return true
        } catch (error) {
            console.error("Failed to delete task:", error)
            return false
        }
    }

    /**
     * Clear completed tasks
     */
    async clearCompleted(): Promise<void> {
        const completedTasks = this.state.tasks.filter((t) => t.completed)

        for (const task of completedTasks) {
            await this.deleteTask(task.id)
        }
    }

    /**
     * Set filter
     */
    setFilter(filter: TaskListState["filter"]): void {
        this.state.filter = filter
        this.notifyListeners()
    }

    /**
     * Set sort
     */
    setSortBy(sortBy: TaskListState["sortBy"]): void {
        this.state.sortBy = sortBy
        this.notifyListeners()
    }

    /**
     * Get filtered and sorted tasks
     */
    getFilteredTasks(): TaskItem[] {
        let filtered = [...this.state.tasks]

        // Apply filter
        switch (this.state.filter) {
            case "active":
                filtered = filtered.filter((t) => !t.completed)
                break
            case "completed":
                filtered = filtered.filter((t) => t.completed)
                break
        }

        // Apply sort
        switch (this.state.sortBy) {
            case "priority":
                const priorityOrder = { high: 0, medium: 1, low: 2 }
                filtered.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
                break
            case "alphabetical":
                filtered.sort((a, b) => a.text.localeCompare(b.text))
                break
            case "date":
            default:
                filtered.sort((a, b) => b.createdAt - a.createdAt)
        }

        return filtered
    }

    /**
     * Get stats
     */
    getStats(): { total: number; active: number; completed: number; completionRate: number } {
        const total = this.state.tasks.length
        const active = this.state.tasks.filter((t) => !t.completed).length
        const completed = total - active
        const completionRate = total > 0 ? (completed / total) * 100 : 0

        return { total, active, completed, completionRate }
    }

    /**
     * Get current state
     */
    getState(): TaskListState {
        return { ...this.state }
    }

    /**
     * Subscribe to state changes
     */
    subscribe(listener: (state: TaskListState) => void): () => void {
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
     * Listen for task list changes
     */
    listenForTasks(): void {
        if (!this.roomId || !getFirebaseDatabase()!) return

        const tasksRef = ref(getFirebaseDatabase()!, `rooms/${this.roomId}/productivity/tasks`)
        const unsubscribe = onValue(tasksRef, (snapshot) => {
            const data = snapshot.val() as TaskList | null

            if (data?.tasks) {
                this.state.isActive = true
                this.state.tasks = Object.values(data.tasks)
                this.state.title = data.title || "Tasks"
            } else {
                this.state.isActive = false
                this.state.tasks = []
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
            tasks: [],
            title: "Tasks",
            filter: "all",
            sortBy: "date",
        }
    }
}

export const taskListManager = TaskListManager.getInstance()
export type { TaskListState }
