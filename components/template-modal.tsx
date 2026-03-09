"use client"

import React, { useState, useEffect, useCallback } from "react"
import { BaseModal } from "./base-modal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TemplateManager, TemplateType } from "@/utils/infra/template-manager"

interface TemplateModalProps {
    isOpen: boolean
    onClose: () => void
    onSelectTemplate: (templateId: string) => void
    userId: string
    userName: string
    currentRoomId?: string
}

export function TemplateModal({
    isOpen,
    onClose,
    onSelectTemplate,
    userId,
    userName,
    currentRoomId,
}: TemplateModalProps) {
    const [activeTab, setActiveTab] = useState("all")
    const [searchQuery, setSearchQuery] = useState("")
    const [templates, setTemplates] = useState<ReturnType<typeof TemplateManager.prototype.getPublicTemplates> extends never ? never[] : Awaited<ReturnType<typeof TemplateManager.prototype.getPublicTemplates>>>([])
    const [userTemplates, setUserTemplates] = useState<Awaited<ReturnType<typeof TemplateManager.prototype.getUserTemplates>>>([])
    const [loading, setLoading] = useState(false)
    const [selectedCategory, setSelectedCategory] = useState<TemplateType | "all">("all")

    const manager = TemplateManager.getInstance()

    const loadTemplates = useCallback(async () => {
        setLoading(true)
        try {
            const [publicTemplates, personalTemplates] = await Promise.all([
                manager.getPublicTemplates(selectedCategory === "all" ? undefined : selectedCategory),
                manager.getUserTemplates(userId),
            ])
            setTemplates(publicTemplates as any)
            setUserTemplates(personalTemplates)
        } catch (error) {
            console.error("Failed to load templates:", error)
        } finally {
            setLoading(false)
        }
    }, [userId, selectedCategory])

    useEffect(() => {
        if (isOpen) {
            loadTemplates()
        }
    }, [isOpen, loadTemplates])

    const handleSearch = useCallback(async () => {
        if (!searchQuery.trim()) {
            loadTemplates()
            return
        }

        setLoading(true)
        try {
            const results = await manager.searchTemplates(
                searchQuery,
                selectedCategory === "all" ? undefined : selectedCategory
            )
            setTemplates(results)
        } catch (error) {
            console.error("Failed to search templates:", error)
        } finally {
            setLoading(false)
        }
    }, [searchQuery, selectedCategory, loadTemplates, manager])

    const handleSelectTemplate = (templateId: string) => {
        onSelectTemplate(templateId)
        onClose()
    }

    const handleCreateFromCurrent = () => {
        // This would create a template from the current room state
        // For now, show a toast or alert
        alert("Feature coming soon: Save current room as template")
    }

    const getTypeIcon = (type: TemplateType) => {
        switch (type) {
            case "whiteboard":
                return "🎨"
            case "quiz":
                return "❓"
            case "playground":
                return "🎮"
            case "theater":
                return "🎬"
            case "game":
                return "🏆"
            default:
                return "📄"
        }
    }

    const getTypeName = (type: TemplateType) => {
        switch (type) {
            case "whiteboard":
                return "Whiteboard"
            case "quiz":
                return "Quiz"
            case "playground":
                return "Playground"
            case "theater":
                return "Theater"
            case "game":
                return "Game"
            default:
                return type
        }
    }

    const templateCategories: { id: TemplateType | "all"; name: string; icon: string }[] = [
        { id: "all", name: "All", icon: "📚" },
        { id: "whiteboard", name: "Whiteboard", icon: "🎨" },
        { id: "quiz", name: "Quiz", icon: "❓" },
        { id: "playground", name: "Playground", icon: "🎮" },
        { id: "theater", name: "Theater", icon: "🎬" },
        { id: "game", name: "Games", icon: "🏆" },
    ]

    return (
        <BaseModal
            isOpen={isOpen}
            onClose={onClose}
            title="Templates"
            description="Browse and use templates for your room"
            className="max-w-4xl"
        >
            <div className="space-y-4">
                {/* Search and Filter */}
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Input
                            placeholder="Search templates..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                            className="pr-10"
                        />
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                            onClick={handleSearch}
                        >
                            🔍
                        </Button>
                    </div>
                </div>

                {/* Category Filter */}
                <div className="flex gap-2 overflow-x-auto pb-2">
                    {templateCategories.map((category) => (
                        <Badge
                            key={category.id}
                            variant={selectedCategory === category.id ? "default" : "outline"}
                            className="cursor-pointer whitespace-nowrap px-3 py-1"
                            onClick={() => setSelectedCategory(category.id)}
                        >
                            <span className="mr-1">{category.icon}</span>
                            {category.name}
                        </Badge>
                    ))}
                </div>

                {/* Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="w-full grid grid-cols-2">
                        <TabsTrigger value="all">Public Templates</TabsTrigger>
                        <TabsTrigger value="my">My Templates</TabsTrigger>
                    </TabsList>

                    <TabsContent value="all" className="mt-4">
                        {loading ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                            </div>
                        ) : templates.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <p>No templates found</p>
                                <p className="text-sm">Try adjusting your search or filters</p>
                            </div>
                        ) : (
                            <ScrollArea className="h-[400px] pr-4">
                                <div className="grid gap-3">
                                    {templates.map((template: any) => (
                                        <div
                                            key={template.id}
                                            className="border rounded-lg p-4 hover:bg-accent/50 cursor-pointer transition-colors"
                                            onClick={() => handleSelectTemplate(template.id)}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className="text-3xl">{getTypeIcon(template.type)}</div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-semibold truncate">{template.name}</h4>
                                                        <Badge variant="secondary" className="text-xs">
                                                            {getTypeName(template.type)}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                                                        {template.description}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <span className="text-xs text-muted-foreground">
                                                            by {template.createdByName}
                                                        </span>
                                                        <span className="text-xs text-muted-foreground">•</span>
                                                        <span className="text-xs text-muted-foreground">
                                                            Used {template.usageCount} times
                                                        </span>
                                                    </div>
                                                    {template.tags && template.tags.length > 0 && (
                                                        <div className="flex gap-1 mt-2">
                                                            {template.tags.slice(0, 3).map((tag: string) => (
                                                                <Badge key={tag} variant="outline" className="text-xs">
                                                                    {tag}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        )}
                    </TabsContent>

                    <TabsContent value="my" className="mt-4">
                        <div className="flex justify-end mb-3">
                            <Button variant="outline" size="sm" onClick={handleCreateFromCurrent}>
                                <span className="mr-1">➕</span>
                                Create from Current
                            </Button>
                        </div>
                        {loading ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                            </div>
                        ) : userTemplates.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <p>You haven't created any templates yet</p>
                                <p className="text-sm mt-1">Create one from your current room!</p>
                            </div>
                        ) : (
                            <ScrollArea className="h-[350px] pr-4">
                                <div className="grid gap-3">
                                    {userTemplates.map((template: any) => (
                                        <div
                                            key={template.id}
                                            className="border rounded-lg p-4 hover:bg-accent/50 cursor-pointer transition-colors"
                                            onClick={() => handleSelectTemplate(template.id)}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className="text-3xl">{getTypeIcon(template.type)}</div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-semibold truncate">{template.name}</h4>
                                                        {template.isPublic && (
                                                            <Badge variant="secondary" className="text-xs">
                                                                Public
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                                                        {template.description}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <span className="text-xs text-muted-foreground">
                                                            Created {new Date(template.createdAt).toLocaleDateString()}
                                                        </span>
                                                        <span className="text-xs text-muted-foreground">•</span>
                                                        <span className="text-xs text-muted-foreground">
                                                            Used {template.usageCount} times
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        )}
                    </TabsContent>
                </Tabs>
            </div>
        </BaseModal>
    )
}
