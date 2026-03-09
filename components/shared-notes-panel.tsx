"use client"

import React, { useEffect, useState, useCallback } from "react"
import { sharedNotesManager, type Note } from "@/utils/infra/shared-notes"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Trash2, Pin, GripVertical, Edit2, Check, X, StickyNote } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

interface SharedNotesPanelProps {
    roomId: string
    userId: string
    userName: string
}

const NOTE_COLORS = [
    "#fef3c7", // amber
    "#dcfce7", // green
    "#dbeafe", // blue
    "#fae8ff", // purple
    "#fce7f3", // pink
    "#f1f5f9", // slate
    "#fee2e2", // red
    "#fef9c3", // yellow
]

export function SharedNotesPanel({ roomId, userId, userName }: SharedNotesPanelProps) {
    const [notes, setNotes] = useState<Note[]>([])
    const [activeNoteId, setActiveNoteId] = useState<string | null>(null)
    const [isEditing, setIsEditing] = useState(false)
    const [editTitle, setEditTitle] = useState("")
    const [editContent, setEditContent] = useState("")
    const [isCreating, setIsCreating] = useState(false)
    const [newTitle, setNewTitle] = useState("")
    const [newColor, setNewColor] = useState(NOTE_COLORS[0])

    useEffect(() => {
        sharedNotesManager.initialize(roomId, userId, userName)
        sharedNotesManager.initializeNotes()

        const unsubscribe = sharedNotesManager.subscribe((state) => {
            setNotes(sharedNotesManager.getSortedNotes())
            setActiveNoteId(state.activeNoteId)
        })

        sharedNotesManager.listenForNotes()

        return () => {
            unsubscribe()
            sharedNotesManager.destroy()
        }
    }, [roomId, userId, userName])

    const handleCreateNote = useCallback(async () => {
        if (!newTitle.trim()) return

        await sharedNotesManager.createNote(newTitle, "", newColor)
        setNewTitle("")
        setIsCreating(false)
    }, [newTitle, newColor])

    const handleStartEdit = useCallback((note: Note) => {
        setEditTitle(note.title)
        setEditContent(note.content)
        setIsEditing(true)
    }, [])

    const handleSaveEdit = useCallback(async (noteId: string) => {
        await sharedNotesManager.updateNote(noteId, {
            title: editTitle,
            content: editContent,
        })
        setIsEditing(false)
    }, [editTitle, editContent])

    const handleDeleteNote = useCallback(async (noteId: string) => {
        await sharedNotesManager.deleteNote(noteId)
    }, [])

    const handleTogglePin = useCallback(async (noteId: string) => {
        await sharedNotesManager.togglePin(noteId)
    }, [])

    const activeNote = notes.find((n) => n.id === activeNoteId)

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-border">
                <div className="flex items-center gap-2">
                    <StickyNote className="h-5 w-5 text-primary" />
                    <h2 className="font-semibold">Shared Notes</h2>
                    <span className="text-xs text-muted-foreground">({notes.length})</span>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsCreating(true)}
                    className="gap-1"
                >
                    <Plus className="h-4 w-4" />
                    New
                </Button>
            </div>

            {/* Create Note Form */}
            {isCreating && (
                <div className="p-3 border-b border-border bg-muted/30">
                    <div className="space-y-3">
                        <Input
                            placeholder="Note title..."
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            className="bg-background"
                            autoFocus
                        />
                        <div className="flex items-center gap-2">
                            <div className="flex gap-1">
                                {NOTE_COLORS.map((color) => (
                                    <button
                                        key={color}
                                        onClick={() => setNewColor(color)}
                                        className={cn(
                                            "w-6 h-6 rounded-full border-2 transition-all",
                                            newColor === color ? "border-primary scale-110" : "border-transparent"
                                        )}
                                        style={{ backgroundColor: color }}
                                    />
                                ))}
                            </div>
                            <div className="flex gap-1 ml-auto">
                                <Button size="sm" onClick={handleCreateNote}>
                                    <Check className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setIsCreating(false)}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Notes List */}
            <ScrollArea className="flex-1 p-3">
                <div className="space-y-2">
                    {notes.map((note) => (
                        <Card
                            key={note.id}
                            className={cn(
                                "cursor-pointer transition-all hover:shadow-md",
                                activeNoteId === note.id && "ring-2 ring-primary"
                            )}
                            style={{ backgroundColor: note.color || "#f1f5f9" }}
                            onClick={() => sharedNotesManager.setActiveNote(note.id)}
                        >
                            <CardHeader className="p-3 pb-1">
                                <div className="flex items-start justify-between gap-2">
                                    <CardTitle className="text-sm font-medium line-clamp-1">
                                        {note.title}
                                    </CardTitle>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                handleTogglePin(note.id)
                                            }}
                                        >
                                            <Pin
                                                className={cn(
                                                    "h-3 w-3",
                                                    note.isPinned ? "text-primary fill-primary" : "text-muted-foreground"
                                                )}
                                            />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                handleDeleteNote(note.id)
                                            }}
                                        >
                                            <Trash2 className="h-3 w-3 text-destructive" />
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-3 pt-1">
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                    {note.content || "Empty note..."}
                                </p>
                                <div className="flex items-center justify-between mt-2">
                                    <span className="text-[10px] text-muted-foreground">
                                        by {note.createdBy}
                                    </span>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 text-xs"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            handleStartEdit(note)
                                        }}
                                    >
                                        <Edit2 className="h-3 w-3 mr-1" />
                                        Edit
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}

                    {notes.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                            <StickyNote className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No notes yet</p>
                            <p className="text-xs">Create your first note!</p>
                        </div>
                    )}
                </div>
            </ScrollArea>

            {/* Edit Modal */}
            {isEditing && activeNote && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
                        <CardHeader className="flex-shrink-0">
                            <Input
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                className="text-lg font-semibold bg-transparent border-none focus-visible:ring-0 px-0"
                                placeholder="Note title..."
                            />
                        </CardHeader>
                        <CardContent className="flex-1 overflow-auto flex-shrink-0">
                            <Textarea
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                className="min-h-[200px] resize-none border-none focus-visible:ring-0 p-0"
                                placeholder="Write your note here..."
                            />
                        </CardContent>
                        <div className="flex justify-end gap-2 p-3 border-t bg-muted/30 flex-shrink-0">
                            <Button variant="outline" onClick={() => setIsEditing(false)}>
                                Cancel
                            </Button>
                            <Button onClick={() => handleSaveEdit(activeNote.id)}>
                                <Check className="h-4 w-4 mr-1" />
                                Save
                            </Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    )
}
