"use client"

import React, { useEffect, useState, useCallback } from "react"
import { taskListManager, type TaskItem } from "@/utils/infra/shared-task-list"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Trash2, Plus, AlertCircle, CheckCircle2, Circle, Filter, ArrowUpDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface SharedTaskListPanelProps {
    roomId: string
    userId: string
    userName: string
}

const PRIORITY_BADGES = {
    low: "bg-blue-500/20 text-blue-400 text-xs px-2 py-0.5 rounded",
    medium: "bg-yellow-500/20 text-yellow-400 text-xs px-2 py-0.5 rounded",
    high: "bg-red-500/20 text-red-400 text-xs px-2 py-0.5 rounded",
}

export function SharedTaskListPanel({ roomId, userId, userName }: SharedTaskListPanelProps) {
    const [tasks, setTasks] = useState<TaskItem[]>([])
    const [filter, setFilter] = useState<"all" | "active" | "completed">("all")
    const [sortBy, setSortBy] = useState<"date" | "priority" | "alphabetical">("date")
    const [newTaskText, setNewTaskText] = useState("")
    const [newTaskPriority, setNewTaskPriority] = useState<TaskItem["priority"]>("medium")
    const [isAdding, setIsAdding] = useState(false)

    const lastInitializedRoom = React.useRef<string | null>(null)

    useEffect(() => {
        if (lastInitializedRoom.current !== roomId) {
            lastInitializedRoom.current = roomId
            taskListManager.initialize(roomId, userId, userName)
            taskListManager.initializeTaskList()
            taskListManager.listenForTasks()
        }

        const unsubscribe = taskListManager.subscribe((state) => {
            setTasks(taskListManager.getFilteredTasks())
            setFilter(state.filter)
            setSortBy(state.sortBy)
        })

        return () => {
            unsubscribe()
            if (lastInitializedRoom.current === roomId) {
                lastInitializedRoom.current = null
                taskListManager.destroy()
            }
        }
    }, [roomId, userId, userName])

    const handleAddTask = useCallback(async () => {
        if (!newTaskText.trim()) return

        await taskListManager.addTask(newTaskText, newTaskPriority)
        setNewTaskText("")
        setIsAdding(false)
    }, [newTaskText, newTaskPriority])

    const handleToggleTask = useCallback(async (taskId: string) => {
        await taskListManager.toggleTask(taskId)
    }, [])

    const handleDeleteTask = useCallback(async (taskId: string) => {
        await taskListManager.deleteTask(taskId)
    }, [])

    const handleClearCompleted = useCallback(async () => {
        await taskListManager.clearCompleted()
    }, [])

    const stats = {
        total: tasks.length,
        completed: tasks.filter((t) => t.completed).length,
        active: tasks.filter((t) => !t.completed).length,
        progress: tasks.length > 0 ? (tasks.filter((t) => t.completed).length / tasks.length) * 100 : 0,
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-border">
                <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <h2 className="font-semibold">Tasks</h2>
                    <span className="text-xs text-muted-foreground">
                        {stats.active} remaining
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setFilter(filter === "all" ? "active" : filter === "active" ? "completed" : "all")}
                    >
                        <Filter className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setSortBy(sortBy === "date" ? "priority" : sortBy === "priority" ? "alphabetical" : "date")}
                    >
                        <ArrowUpDown className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Progress */}
            {tasks.length > 0 && (
                <div className="px-3 py-2 border-b border-border">
                    <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Progress</span>
                        <span>{Math.round(stats.progress)}%</span>
                    </div>
                    <Progress value={stats.progress} className="h-1.5" />
                </div>
            )}

            {/* Add Task Form */}
            {isAdding ? (
                <div className="p-3 border-b border-border bg-muted/30">
                    <div className="space-y-3">
                        <Input
                            placeholder="What needs to be done?"
                            value={newTaskText}
                            onChange={(e) => setNewTaskText(e.target.value)}
                            className="bg-background"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handleAddTask()
                                if (e.key === "Escape") setIsAdding(false)
                            }}
                        />
                        <div className="flex items-center justify-between">
                            <div className="flex gap-1">
                                {(["low", "medium", "high"] as const).map((p) => (
                                    <button
                                        key={p}
                                        onClick={() => setNewTaskPriority(p)}
                                        className={cn(
                                            "text-xs px-2 py-1 rounded capitalize transition-all",
                                            newTaskPriority === p ? PRIORITY_BADGES[p] : "bg-muted text-muted-foreground"
                                        )}
                                    >
                                        {p}
                                    </button>
                                ))}
                            </div>
                            <div className="flex gap-1">
                                <Button size="sm" onClick={handleAddTask}>
                                    <Plus className="h-4 w-4 mr-1" />
                                    Add
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)}>
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="p-3 border-b border-border">
                    <Button
                        variant="outline"
                        className="w-full justify-start text-muted-foreground"
                        onClick={() => setIsAdding(true)}
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Add a task...
                    </Button>
                </div>
            )}

            {/* Task List */}
            <div className="flex-1 overflow-auto">
                <div className="p-2 space-y-1">
                    {tasks.map((task) => (
                        <div
                            key={task.id}
                            className={cn(
                                "flex items-start gap-3 p-2 rounded-lg transition-all group",
                                task.completed ? "bg-muted/30" : "hover:bg-muted/50"
                            )}
                        >
                            <Checkbox
                                checked={task.completed}
                                onCheckedChange={() => handleToggleTask(task.id)}
                                className="mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                                <p className={cn(
                                    "text-sm font-medium break-words",
                                    task.completed && "line-through text-muted-foreground"
                                )}>
                                    {task.text}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className={cn("capitalize text-xs", PRIORITY_BADGES[task.priority])}>
                                        {task.priority}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">
                                        by {task.createdBy}
                                    </span>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => handleDeleteTask(task.id)}
                            >
                                <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                        </div>
                    ))}

                    {tasks.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No tasks yet</p>
                            <p className="text-xs">Add your first task above!</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            {tasks.some((t) => t.completed) && (
                <div className="p-3 border-t border-border">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-muted-foreground"
                        onClick={handleClearCompleted}
                    >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Clear completed ({stats.completed})
                    </Button>
                </div>
            )}
        </div>
    )
}
