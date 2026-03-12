"use client"

import React, { useState, useEffect } from "react"
import { burnerLinkManager, LINK_EXPIRY_OPTIONS, MAX_VIEW_OPTIONS } from "@/utils/infra/burner-link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { BaseModal } from "@/components/base-modal"
import { Link, Copy, Trash2, Clock, Eye, FileText, Link as LinkIcon, Lock } from "lucide-react"
import { cn } from "@/lib/utils"

interface BurnerLinkModalProps {
    isOpen: boolean
    onClose: () => void
    roomId: string
    userId: string
}

export function BurnerLinkModal({ isOpen, onClose, roomId, userId }: BurnerLinkModalProps) {
    const [activeTab, setActiveTab] = useState<"create" | "view">("create")
    const [linkType, setLinkType] = useState<"text" | "link">("text")
    const [content, setContent] = useState("")
    const [expiry, setExpiry] = useState(LINK_EXPIRY_OPTIONS[1].value) // 24 hours
    const [maxViews, setMaxViews] = useState(MAX_VIEW_OPTIONS[1].value) // 10 views
    const [password, setPassword] = useState("")
    const [activeLinks, setActiveLinks] = useState<any[]>([])
    const [isGenerating, setIsGenerating] = useState(false)
    const [newLink, setNewLink] = useState<string | null>(null)
    const [viewCode, setViewCode] = useState("")
    const [viewedContent, setViewedContent] = useState<string | null>(null)
    const [viewError, setViewError] = useState<string | null>(null)

    useEffect(() => {
        if (isOpen) {
            burnerLinkManager.initialize(roomId, userId)
            burnerLinkManager.refreshLinks()

            const unsubscribe = burnerLinkManager.subscribe((state) => {
                setActiveLinks(state.activeLinks.filter(l => l.createdBy === userId))
                setIsGenerating(state.isGenerating)
            })

            return () => {
                unsubscribe()
            }
        }
    }, [isOpen, roomId, userId])

    const handleGenerate = async () => {
        if (!content.trim()) return

        setIsGenerating(true)
        try {
            const link = await burnerLinkManager.generateLink(
                linkType,
                content,
                undefined,
                undefined,
                undefined,
                expiry,
                maxViews === Infinity ? 999999 : maxViews,
                password || undefined
            )
            setNewLink(burnerLinkManager.getShareUrl(link.code))
        } finally {
            setIsGenerating(false)
        }
    }

    const handleView = async () => {
        if (!viewCode.trim()) return

        setViewError(null)
        setViewedContent(null)

        // First try to get the link
        const link = await burnerLinkManager.getLink(viewCode.toUpperCase())
        if (!link) {
            setViewError("Link not found")
            return
        }

        // Try to view the link
        const result = await burnerLinkManager.viewLink(link.id)
        if (result.success) {
            setViewedContent(result.content)
        } else {
            setViewError(result.error || "Failed to view link")
        }
    }

    const handleCopy = async (text: string) => {
        await burnerLinkManager.copyToClipboard(text)
    }

    const handleDelete = async (id: string) => {
        await burnerLinkManager.deleteLink(id)
    }

    const formatExpiry = (timestamp: number): string => {
        const diff = timestamp - Date.now()
        if (diff <= 0) return "Expired"

        const hours = Math.floor(diff / (1000 * 60 * 60))
        const days = Math.floor(hours / 24)

        if (days > 0) return `${days}d ${hours % 24}h`
        return `${hours}h ${Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))}m`
    }

    return (
        <BaseModal isOpen={isOpen} onClose={onClose} title="Burner Links" className="max-w-lg">
            <div className="space-y-4">
                {/* Tab Switch */}
                <div className="flex gap-2">
                    <Button
                        variant={activeTab === "create" ? "default" : "outline"}
                        className="flex-1"
                        onClick={() => setActiveTab("create")}
                    >
                        <LinkIcon className="h-4 w-4 mr-2" />
                        Create
                    </Button>
                    <Button
                        variant={activeTab === "view" ? "default" : "outline"}
                        className="flex-1"
                        onClick={() => setActiveTab("view")}
                    >
                        <Eye className="h-4 w-4 mr-2" />
                        View
                    </Button>
                </div>

                {/* Create Tab */}
                {activeTab === "create" && (
                    <>
                        {/* Type Selection */}
                        <div className="flex gap-2">
                            <Button
                                variant={linkType === "text" ? "default" : "outline"}
                                size="sm"
                                onClick={() => setLinkType("text")}
                                className="flex-1"
                            >
                                <FileText className="h-4 w-4 mr-2" />
                                Text
                            </Button>
                            <Button
                                variant={linkType === "link" ? "default" : "outline"}
                                size="sm"
                                onClick={() => setLinkType("link")}
                                className="flex-1"
                            >
                                <Link className="h-4 w-4 mr-2" />
                                Link
                            </Button>
                        </div>

                        {/* Content Input */}
                        <div>
                            <Label className="text-slate-300">
                                {linkType === "text" ? "Message" : "URL"}
                            </Label>
                            {linkType === "text" ? (
                                <Textarea
                                    id="burner-content-text"
                                    name="burner-content"
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    placeholder="Enter your secret message..."
                                    className="bg-slate-700 border-slate-600 mt-1"
                                    rows={4}
                                />
                            ) : (
                                <Input
                                    id="burner-content-url"
                                    name="burner-url"
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    placeholder="https://example.com"
                                    className="bg-slate-700 border-slate-600 mt-1"
                                />
                            )}
                        </div>

                        {/* Options */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label className="text-slate-300 flex items-center gap-1">
                                    <Clock className="h-4 w-4" />
                                    Expires In
                                </Label>
                                <select
                                    value={expiry}
                                    onChange={(e) => setExpiry(Number(e.target.value))}
                                    className="w-full mt-1 p-2 rounded bg-slate-700 border border-slate-600 text-white"
                                >
                                    {LINK_EXPIRY_OPTIONS.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <Label className="text-slate-300 flex items-center gap-1">
                                    <Eye className="h-4 w-4" />
                                    Max Views
                                </Label>
                                <select
                                    value={maxViews === Infinity ? "unlimited" : maxViews}
                                    onChange={(e) => setMaxViews(e.target.value === "unlimited" ? Infinity : Number(e.target.value))}
                                    className="w-full mt-1 p-2 rounded bg-slate-700 border border-slate-600 text-white"
                                >
                                    {MAX_VIEW_OPTIONS.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <Label className="text-slate-300 flex items-center gap-1">
                                <Lock className="h-4 w-4" />
                                Password (optional)
                            </Label>
                            <Input
                                id="burner-password"
                                name="burner-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Leave empty for no password"
                                type="password"
                                className="bg-slate-700 border-slate-600 mt-1"
                            />
                        </div>

                        {/* Generate Button */}
                        <Button
                            onClick={handleGenerate}
                            disabled={!content.trim() || isGenerating}
                            className="w-full bg-gradient-to-r from-purple-500 to-pink-500"
                        >
                            {isGenerating ? "Generating..." : "Generate Burner Link"}
                        </Button>

                        {/* New Link Result */}
                        {newLink && (
                            <Card className="bg-slate-800 border-slate-700">
                                <CardContent className="pt-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-green-400 text-sm font-medium">Link Created!</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <Input
                                            id="burner-new-link"
                                            name="burner-new-link"
                                            value={newLink}
                                            readOnly
                                            className="bg-slate-700 border-slate-600 text-sm"
                                        />
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => handleCopy(newLink)}
                                        >
                                            <Copy className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="mt-2 w-full"
                                        onClick={() => {
                                            setNewLink(null)
                                            setContent("")
                                        }}
                                    >
                                        Create Another
                                    </Button>
                                </CardContent>
                            </Card>
                        )}

                        {/* Active Links */}
                        {activeLinks.length > 0 && !newLink && (
                            <Card className="bg-slate-800 border-slate-700">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-white text-sm">Your Active Links</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {activeLinks.map((link) => (
                                        <div
                                            key={link.id}
                                            className="flex items-center justify-between p-2 rounded bg-slate-700"
                                        >
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                <span className="font-mono text-purple-400 text-sm">
                                                    {link.code}
                                                </span>
                                                <span className="text-xs text-slate-400 truncate max-w-32">
                                                    {link.type === "text" ? link.content : link.content}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className="text-xs">
                                                    <Clock className="h-3 w-3 mr-1" />
                                                    {formatExpiry(link.expiresAt)}
                                                </Badge>
                                                <Badge variant="outline" className="text-xs">
                                                    <Eye className="h-3 w-3 mr-1" />
                                                    {link.views}/{link.maxViews === Infinity ? "∞" : link.maxViews}
                                                </Badge>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-red-400"
                                                    onClick={() => handleDelete(link.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        )}
                    </>
                )}

                {/* View Tab */}
                {activeTab === "view" && (
                    <div className="space-y-4">
                        <div>
                            <Label className="text-slate-300">Enter Link Code</Label>
                            <div className="flex gap-2 mt-1">
                                <Input
                                    id="burner-view-code"
                                    name="burner-code"
                                    value={viewCode}
                                    onChange={(e) => setViewCode(e.target.value.toUpperCase())}
                                    placeholder="XXXXXX"
                                    className="font-mono text-lg bg-slate-700 border-slate-600"
                                    maxLength={6}
                                />
                                <Button onClick={handleView} disabled={!viewCode.trim()}>
                                    <Eye className="h-4 w-4 mr-2" />
                                    View
                                </Button>
                            </div>
                        </div>

                        {viewError && (
                            <div className="p-3 rounded bg-red-500/20 text-red-400 text-sm">
                                {viewError}
                            </div>
                        )}

                        {viewedContent && (
                            <Card className="bg-slate-800 border-slate-700">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-white text-sm flex items-center gap-2">
                                        <LinkIcon className="h-4 w-4 text-green-400" />
                                        Content
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {linkType === "link" ? (
                                        <a
                                            href={viewedContent}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-purple-400 hover:underline break-all"
                                        >
                                            {viewedContent}
                                        </a>
                                    ) : (
                                        <p className="text-white whitespace-pre-wrap">{viewedContent}</p>
                                    )}
                                </CardContent>
                            </Card>
                        )}
                    </div>
                )}
            </div>
        </BaseModal>
    )
}
