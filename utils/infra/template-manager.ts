import { getFirebaseDatabase } from "@/lib/firebase"
import { ref, set, get, remove, update, onValue } from "firebase/database"

export type TemplateType = "whiteboard" | "quiz" | "playground" | "theater" | "game"

export interface Template {
    id: string
    name: string
    description: string
    type: TemplateType
    thumbnail?: string
    createdBy: string
    createdByName: string
    createdAt: number
    isPublic: boolean
    usageCount: number
    // Type-specific content
    content: {
        // Whiteboard specific
        whiteboardData?: string
        whiteboardBackground?: string
        whiteboardStrokes?: Array<{
            points: number[]
            color: string
            width: number
        }>
        // Quiz specific
        quizQuestions?: Array<{
            question: string
            options: string[]
            correctAnswer: number
            timeLimit?: number
            points: number
        }>
        quizSettings?: {
            timeLimit?: number
            passingScore?: number
            shuffleQuestions?: boolean
            showResults?: boolean
        }
        // Playground specific
        playgroundConfig?: {
            mode: "dots-and-boxes" | "tic-tac-toe" | "connect-four"
            gridSize?: number
            winCondition?: number
            timeLimit?: number
        }
        // Theater specific
        theaterConfig?: {
            videoUrl?: string
            startTime?: number
            syncPlayback?: boolean
        }
        // General
        settings?: Record<string, unknown>
    }
    tags?: string[]
}

export interface TemplateCategory {
    id: string
    name: string
    icon: string
    description: string
    templates: string[] // Template IDs
}

// In-memory cache for templates
const templateCache = new Map<string, Template>()

export class TemplateManager {
    private static instance: TemplateManager
    private listeners: Array<() => void> = []

    static getInstance(): TemplateManager {
        if (!TemplateManager.instance) {
            TemplateManager.instance = new TemplateManager()
        }
        return TemplateManager.instance
    }

    // Create a template
    async createTemplate(
        userId: string,
        userName: string,
        template: Omit<Template, "id" | "createdBy" | "createdByName" | "createdAt" | "usageCount">
    ): Promise<Template | null> {
        if (!getFirebaseDatabase()!) return null

        try {
            const templateId = `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

            const newTemplate: Template = {
                ...template,
                id: templateId,
                createdBy: userId,
                createdByName: userName,
                createdAt: Date.now(),
                usageCount: 0,
            }

            await set(ref(getFirebaseDatabase()!, `templates/${templateId}`), newTemplate)
            templateCache.set(templateId, newTemplate)

            return newTemplate
        } catch (error) {
            console.error("Failed to create template:", error)
            return null
        }
    }

    // Get template by ID
    async getTemplate(templateId: string): Promise<Template | null> {
        if (templateCache.has(templateId)) {
            return templateCache.get(templateId)!
        }

        if (!getFirebaseDatabase()!) return null

        try {
            const templateRef = ref(getFirebaseDatabase()!, `templates/${templateId}`)
            const snapshot = await get(templateRef)

            if (snapshot.exists()) {
                const template = snapshot.val() as Template
                templateCache.set(templateId, template)
                return template
            }

            return null
        } catch (error) {
            console.error("Failed to get template:", error)
            return null
        }
    }

    // Get public templates
    async getPublicTemplates(type?: TemplateType): Promise<Template[]> {
        if (!getFirebaseDatabase()!) return []

        try {
            const templatesRef = ref(getFirebaseDatabase()!, "templates")
            const snapshot = await get(templatesRef)

            if (!snapshot.exists()) {
                return []
            }

            const templates: Template[] = []
            snapshot.forEach((child) => {
                const template = child.val() as Template
                if (template.isPublic && (!type || template.type === type)) {
                    templates.push(template)
                }
            })

            // Sort by usage count (most popular first)
            return templates.sort((a, b) => b.usageCount - a.usageCount)
        } catch (error) {
            console.error("Failed to get public templates:", error)
            return []
        }
    }

    // Get user's templates
    async getUserTemplates(userId: string): Promise<Template[]> {
        if (!getFirebaseDatabase()!) return []

        try {
            const templatesRef = ref(getFirebaseDatabase()!, "templates")
            const snapshot = await get(templatesRef)

            if (!snapshot.exists()) {
                return []
            }

            const templates: Template[] = []
            snapshot.forEach((child) => {
                const template = child.val() as Template
                if (template.createdBy === userId) {
                    templates.push(template)
                }
            })

            return templates.sort((a, b) => b.createdAt - a.createdAt)
        } catch (error) {
            console.error("Failed to get user templates:", error)
            return []
        }
    }

    // Update template
    async updateTemplate(templateId: string, updates: Partial<Template>): Promise<boolean> {
        if (!getFirebaseDatabase()!) return false

        try {
            const templateRef = ref(getFirebaseDatabase()!, `templates/${templateId}`)
            await update(templateRef, updates)

            // Update cache
            const cached = templateCache.get(templateId)
            if (cached) {
                templateCache.set(templateId, { ...cached, ...updates })
            }

            return true
        } catch (error) {
            console.error("Failed to update template:", error)
            return false
        }
    }

    // Delete template
    async deleteTemplate(templateId: string): Promise<boolean> {
        if (!getFirebaseDatabase()!) return false

        try {
            await remove(ref(getFirebaseDatabase()!, `templates/${templateId}`))
            templateCache.delete(templateId)
            return true
        } catch (error) {
            console.error("Failed to delete template:", error)
            return false
        }
    }

    // Increment usage count
    async incrementUsage(templateId: string): Promise<void> {
        if (!getFirebaseDatabase()!) return

        try {
            const template = await this.getTemplate(templateId)
            if (template) {
                await update(ref(getFirebaseDatabase()!, `templates/${templateId}`), {
                    usageCount: template.usageCount + 1,
                })
            }
        } catch (error) {
            console.error("Failed to increment usage:", error)
        }
    }

    // Apply template to a room
    async applyTemplateToRoom(
        roomId: string,
        templateId: string
    ): Promise<{ success: boolean; error?: string }> {
        if (!getFirebaseDatabase()!) return { success: false, error: "Database not available" }

        try {
            const template = await this.getTemplate(templateId)
            if (!template) {
                return { success: false, error: "Template not found" }
            }

            // Increment usage count
            await this.incrementUsage(templateId)

            // Apply template content to room based on type
            switch (template.type) {
                case "whiteboard":
                    await set(ref(getFirebaseDatabase()!, `rooms/${roomId}/whiteboard`), {
                        data: template.content.whiteboardData || "",
                        background: template.content.whiteboardBackground || "white",
                        strokes: template.content.whiteboardStrokes || [],
                        templateId,
                    })
                    break

                case "quiz":
                    await set(ref(getFirebaseDatabase()!, `rooms/${roomId}/quiz`), {
                        questions: template.content.quizQuestions || [],
                        settings: template.content.quizSettings || {},
                        templateId,
                    })
                    break

                case "playground":
                    await set(ref(getFirebaseDatabase()!, `rooms/${roomId}/playground`), {
                        config: template.content.playgroundConfig || {},
                        templateId,
                    })
                    break

                case "theater":
                    await set(ref(getFirebaseDatabase()!, `rooms/${roomId}/theater`), {
                        config: template.content.theaterConfig || {},
                        templateId,
                    })
                    break

                case "game":
                    // Apply game-specific template
                    await set(ref(getFirebaseDatabase()!, `rooms/${roomId}/game`), {
                        settings: template.content.settings || {},
                        templateId,
                    })
                    break
            }

            return { success: true }
        } catch (error) {
            console.error("Failed to apply template:", error)
            return { success: false, error: "Failed to apply template" }
        }
    }

    // Search templates
    async searchTemplates(
        query: string,
        type?: TemplateType,
        tags?: string[]
    ): Promise<Template[]> {
        if (!getFirebaseDatabase()!) return []

        try {
            const templates = await this.getPublicTemplates(type)
            const lowerQuery = query.toLowerCase()

            return templates.filter((template) => {
                const matchesQuery =
                    template.name.toLowerCase().includes(lowerQuery) ||
                    template.description.toLowerCase().includes(lowerQuery) ||
                    template.tags?.some((tag) => tag.toLowerCase().includes(lowerQuery))

                const matchesTags = !tags || tags.length === 0 || tags.some((t) => template.tags?.includes(t))

                return matchesQuery && matchesTags
            })
        } catch (error) {
            console.error("Failed to search templates:", error)
            return []
        }
    }

    // Get featured templates
    async getFeaturedTemplates(limit: number = 6): Promise<Template[]> {
        const templates = await this.getPublicTemplates()
        return templates
            .filter((t) => t.usageCount > 0)
            .sort((a, b) => b.usageCount - a.usageCount)
            .slice(0, limit)
    }

    // Get template categories
    getDefaultCategories(): TemplateCategory[] {
        return [
            {
                id: "whiteboard",
                name: "Whiteboard",
                icon: "🎨",
                description: "Pre-configured whiteboard layouts and drawings",
                templates: [],
            },
            {
                id: "quiz",
                name: "Quiz",
                icon: "❓",
                description: "Ready-to-use quiz templates",
                templates: [],
            },
            {
                id: "playground",
                name: "Playground",
                icon: "🎮",
                description: "Game room configurations",
                templates: [],
            },
            {
                id: "theater",
                name: "Theater",
                icon: "🎬",
                description: "Watch party setups",
                templates: [],
            },
            {
                id: "game",
                name: "Games",
                icon: "🏆",
                description: "Tournament and game templates",
                templates: [],
            },
        ]
    }

    // Clone a template
    async cloneTemplate(templateId: string, userId: string, userName: string): Promise<Template | null> {
        const original = await this.getTemplate(templateId)
        if (!original) return null

        return this.createTemplate(userId, userName, {
            name: `${original.name} (Copy)`,
            description: original.description,
            type: original.type,
            thumbnail: original.thumbnail,
            isPublic: false,
            content: { ...original.content },
            tags: original.tags,
        })
    }

    // Export template as JSON
    exportTemplate(template: Template): string {
        return JSON.stringify(template, null, 2)
    }

    // Import template from JSON
    async importTemplate(
        json: string,
        userId: string,
        userName: string
    ): Promise<{ success: boolean; template?: Template; error?: string }> {
        try {
            const data = JSON.parse(json) as Partial<Template>

            // Validate required fields
            if (!data.name || !data.type || !data.content) {
                return { success: false, error: "Invalid template format" }
            }

            const template = await this.createTemplate(userId, userName, {
                name: data.name,
                description: data.description || "",
                type: data.type,
                thumbnail: data.thumbnail,
                isPublic: data.isPublic || false,
                content: data.content,
                tags: data.tags,
            })

            if (!template) {
                return { success: false, error: "Failed to create template" }
            }

            return { success: true, template }
        } catch (error) {
            console.error("Failed to import template:", error)
            return { success: false, error: "Invalid JSON format" }
        }
    }

    // Listen for template updates
    listenForTemplates(callback: (templates: Template[]) => void): () => void {
        if (!getFirebaseDatabase()!) return () => { }

        const templatesRef = ref(getFirebaseDatabase()!, "templates")

        const unsubscribe = onValue(templatesRef, (snapshot) => {
            if (!snapshot.exists()) {
                callback([])
                return
            }

            const templates: Template[] = []
            snapshot.forEach((child) => {
                templates.push(child.val() as Template)
            })

            callback(templates)
        })

        this.listeners.push(unsubscribe)
        return unsubscribe
    }

    // Clear cache
    clearCache(): void {
        templateCache.clear()
    }

    cleanup(): void {
        this.listeners.forEach((unsubscribe) => unsubscribe())
        this.listeners = []
        this.clearCache()
    }
}
