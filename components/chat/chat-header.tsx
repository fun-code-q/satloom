"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "../ui/button"
import { AnimatedLogo } from "../animated-logo"
import { UserMoodSelector } from "./user-mood-selector"
import { UserActivityIndicators } from "../user-activity-indicators"
import type { UserPresence } from "@/utils/infra/user-presence"
import type { Message } from "../message-bubble"
import type { MenuGroup } from "./chat-types"
import type { RoomMember } from "@/stores/chat-store"
import {
    Film, Gamepad2, Briefcase, Hammer, MoreVertical, Settings,
    Copy, Pin, X, Search, Maximize2, Minimize2, ChevronDown, ChevronRight,
    Phone, LogOut,
} from "lucide-react"
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator,
} from "../ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger, PopoverClose } from "../ui/popover"
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar"
import { UserPresenceSystem } from "@/utils/infra/user-presence"
import { ChatSearch } from "./chat-search"

interface ChatHeaderProps {
    roomId: string
    isHost: boolean
    // Mood
    currentUserMood: { emoji: string; text: string } | null
    setCurrentUserMood: (mood: { emoji: string; text: string } | null) => void
    isMoodSelectorOpen: boolean
    setIsMoodSelectorOpen: (val: boolean) => void
    // Handlers
    handleCopyRoomLink: () => void
    handleLeaveRoom: () => void
    handleUnpinMessage: () => void
    // Menu groups
    mediaGroup: MenuGroup
    gamesGroup: MenuGroup
    productivityGroup: MenuGroup
    settingsGroup: MenuGroup
    appSettingsGroup: MenuGroup
    communicationGroup: MenuGroup
    menuGroups: MenuGroup[]
    // Dropdown states
    isMenuOpen: boolean
    setIsMenuOpen: (val: boolean) => void
    isMediaMenuOpen: boolean
    setIsMediaMenuOpen: (val: boolean) => void
    isGamesMenuOpen: boolean
    setIsGamesMenuOpen: (val: boolean) => void
    isProductivityMenuOpen: boolean
    setIsProductivityMenuOpen: (val: boolean) => void
    isSettingsMenuOpen: boolean
    setIsSettingsMenuOpen: (val: boolean) => void
    isAppMenuOpen: boolean
    setIsAppMenuOpen: (val: boolean) => void
    // Online users
    onlineUsers: UserPresence[]
    currentUserId: string
    currentUserName: string
    // Pinned message
    pinnedMessage: Message | null
    // Kick user
    onKickUser?: (userId: string) => void
    // Status
    firebaseConnected: boolean
    // Search
    showChatSearch: boolean
    setShowChatSearch: (val: boolean) => void
    hasUnreadNotes: boolean
    hasUnreadTasks: boolean
    roomMembers: RoomMember[]
    showParticipants: boolean
    setShowParticipants: (val: boolean) => void
    autoHide?: boolean
    isMobile: boolean
}

export function ChatHeader({
    roomId, isHost,
    currentUserMood, setCurrentUserMood, isMoodSelectorOpen, setIsMoodSelectorOpen,
    handleCopyRoomLink, handleLeaveRoom, handleUnpinMessage,
    mediaGroup, gamesGroup, productivityGroup, settingsGroup, appSettingsGroup, communicationGroup, menuGroups,
    isMenuOpen, setIsMenuOpen, isMediaMenuOpen, setIsMediaMenuOpen,
    isGamesMenuOpen, setIsGamesMenuOpen, isProductivityMenuOpen, setIsProductivityMenuOpen,
    isSettingsMenuOpen, setIsSettingsMenuOpen, isAppMenuOpen, setIsAppMenuOpen,
    onlineUsers, currentUserId, currentUserName, pinnedMessage, onKickUser,
    firebaseConnected,
    showChatSearch, setShowChatSearch,
    showParticipants, setShowParticipants,
    hasUnreadNotes, hasUnreadTasks,
    roomMembers,
    isMobile,
    autoHide = false,
}: ChatHeaderProps) {
    const [isHeaderVisible, setIsHeaderVisible] = useState(true)
    const headerTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const userPresence = UserPresenceSystem.getInstance()
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [isSettingsFolded, setIsSettingsFolded] = useState(true)

    // Sync sub-menus on main menu close
    useEffect(() => {
        if (!isMenuOpen) {
            setIsMediaMenuOpen(false)
            setIsGamesMenuOpen(false)
            setIsProductivityMenuOpen(false)
            setIsSettingsMenuOpen(false)
            setIsAppMenuOpen(false)
        }
    }, [isMenuOpen, setIsMediaMenuOpen, setIsGamesMenuOpen, setIsProductivityMenuOpen, setIsSettingsMenuOpen, setIsAppMenuOpen])

    const anyMenuOpen = isMenuOpen || isMediaMenuOpen || isGamesMenuOpen || isProductivityMenuOpen || isSettingsMenuOpen || isAppMenuOpen || isMoodSelectorOpen || showChatSearch

    const resetHideTimer = useCallback(() => {
        setIsHeaderVisible(true)
        if (headerTimeoutRef.current) clearTimeout(headerTimeoutRef.current)

        if (autoHide && !anyMenuOpen) {
            headerTimeoutRef.current = setTimeout(() => {
                setIsHeaderVisible(false)
            }, 3000)
        }
    }, [anyMenuOpen, autoHide])

    useEffect(() => {
        if (!autoHide) {
            setIsHeaderVisible(true)
            if (headerTimeoutRef.current) clearTimeout(headerTimeoutRef.current)
            return
        }
        resetHideTimer()
        return () => {
            if (headerTimeoutRef.current) clearTimeout(headerTimeoutRef.current)
        }
    }, [resetHideTimer, autoHide])

    const handleMouseMove = () => resetHideTimer()

    // Fullscreen toggle handler
    const toggleFullscreen = useCallback(() => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().then(() => {
                setIsFullscreen(true)
            }).catch((err) => {
                console.error("Error attempting to enable fullscreen:", err)
            })
        } else {
            document.exitFullscreen().then(() => {
                setIsFullscreen(false)
            }).catch((err) => {
                console.error("Error attempting to exit fullscreen:", err)
            })
        }
    }, [])

    // Listen for fullscreen changes
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement)
        }

        document.addEventListener("fullscreenchange", handleFullscreenChange)
        return () => {
            document.removeEventListener("fullscreenchange", handleFullscreenChange)
        }
    }, [])

    return (
        <>
            {/* Invisible hover zone at the top to re-summon the header */}
            <div
                className="fixed top-0 left-0 right-0 h-4 z-[250]"
                onMouseEnter={resetHideTimer}
                onTouchStart={resetHideTimer}
            />

            <div
                data-chat-header
                className={`absolute top-0 left-0 right-0 z-[250] transition-transform duration-500 ease-in-out ${isHeaderVisible || anyMenuOpen ? "translate-y-0" : "-translate-y-full"
                    }`}
                onMouseMove={handleMouseMove}
                onMouseLeave={resetHideTimer}
                onTouchStart={resetHideTimer}
            >
                {/* Header Background */}
                <div className="bg-black/40 backdrop-blur-2xl shadow-xl border-b border-white/10 flex flex-col">
                    {/* Header Row */}
                    <div className="flex items-center justify-between px-4 py-2 flex-shrink-0 gap-2">
                        <div className={`flex items-center gap-2 md:gap-4 flex-shrink-0 ${(showChatSearch && !isMobile) ? 'opacity-50 grayscale scale-95 pointer-events-none' : ''} ${showChatSearch ? 'hidden sm:flex' : 'flex'}`}>
                            <div 
                                className="scale-110 transform-gpu overflow-visible flex-shrink-0 mr-10 cursor-pointer hover:opacity-80 transition-opacity active:scale-105"
                                onClick={() => setShowParticipants(!showParticipants)}
                                title={showParticipants ? "Hide participants" : "Show participants"}
                            >
                                <AnimatedLogo />
                            </div>
                            <UserMoodSelector
                                currentMood={currentUserMood || undefined}
                                onMoodChange={(mood) => setCurrentUserMood(mood)}
                                open={isMoodSelectorOpen}
                                onOpenChange={setIsMoodSelectorOpen}
                            />
                            {!firebaseConnected && (
                                <div className="px-2 py-1 bg-red-500/20 border border-red-500/50 rounded text-[10px] text-red-400 font-bold animate-pulse">
                                    OFFLINE: DB ERROR
                                </div>
                            )}
                        </div>

                        {showChatSearch && <ChatSearch />}

                        <div className="flex items-center justify-end flex-shrink-0 gap-1.5 md:gap-2 ml-auto select-none">
                            <Button
                                variant="ghost" size="icon"
                                className={`rounded-xl h-8 w-8 flex-shrink-0 transition-all duration-300 ${showChatSearch 
                                    ? 'text-cyan-400' 
                                    : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                                onClick={() => setShowChatSearch(!showChatSearch)}
                                title="Search messages"
                            >
                                <Search className="w-4 h-4" />
                            </Button>

                            {/* Desktop Copy Action */}
                            <div className="hidden md:flex items-center">
                                <Button
                                    variant="ghost" size="icon"
                                    className="text-gray-400 hover:text-white hover:bg-white/10 bg-white/[0.03] border border-white/[0.05] rounded-xl h-9 w-9 transition-all flex-shrink-0"
                                    onClick={handleCopyRoomLink}
                                    title={`Copy Room Link (${roomId})`}
                                >
                                    <Copy className="w-4 h-4" />
                                </Button>
                            </div>

                            {/* Mobile Call Icon and Dropdown */}
                            <div className="md:hidden">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost" size="icon"
                                            className="text-gray-400 hover:text-white hover:bg-white/10 rounded-xl h-8 w-8 transition-all flex-shrink-0"
                                            title="Voice & Video Calls"
                                        >
                                            <Phone className="w-4 h-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                        align="end" side="bottom"
                                        className="bg-slate-900/95 backdrop-blur-xl border border-white/10 text-white min-w-[200px] rounded-2xl shadow-2xl z-[300] p-1.5 animate-in fade-in zoom-in-95 duration-200"
                                        sideOffset={8}
                                    >
                                        <DropdownMenuLabel className="text-[10px] text-slate-500 uppercase tracking-[0.2em] px-3 py-2 font-bold">
                                            Start a Call
                                        </DropdownMenuLabel>
                                        {communicationGroup.items
                                            .filter(item => !item.label.toLowerCase().includes("screen"))
                                            .map((item: any, i: number) => (
                                                <DropdownMenuItem
                                                    key={i}
                                                    onClick={item.action}
                                                    className="hover:bg-white/10 rounded-xl cursor-pointer min-h-[44px] haptic flex items-center gap-3 px-3 transition-colors group"
                                                >
                                                    <item.icon className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
                                                    <span className="text-sm font-medium">{item.label}</span>
                                                </DropdownMenuItem>
                                            ))
                                        }
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            {/* Mobile Media Icon and Dropdown */}
                            <div className="md:hidden">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost" size="icon"
                                            className="text-gray-400 hover:text-white hover:bg-white/10 rounded-xl h-8 w-8 transition-all flex-shrink-0"
                                            title="Media & Watch Together"
                                        >
                                            <Film className="w-4 h-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                        align="end" side="bottom"
                                        className="bg-slate-900/95 backdrop-blur-xl border border-white/10 text-white min-w-[220px] rounded-2xl shadow-2xl z-[300] p-1.5 animate-in fade-in zoom-in-95 duration-200"
                                        sideOffset={8}
                                    >
                                        <DropdownMenuLabel className="text-[10px] text-slate-500 uppercase tracking-[0.2em] px-3 py-2 font-bold">
                                            {mediaGroup.label}
                                        </DropdownMenuLabel>
                                        {mediaGroup.items
                                            .filter(item => !item.label.toLowerCase().includes("soundboard"))
                                            .map((item, i) => (
                                                <DropdownMenuItem
                                                    key={i}
                                                    onClick={item.action}
                                                    className="hover:bg-white/10 rounded-xl cursor-pointer min-h-[44px] haptic flex items-center gap-3 px-3 transition-colors group"
                                                >
                                                    <item.icon className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
                                                    <span className="text-sm font-medium">{item.label}</span>
                                                </DropdownMenuItem>
                                            ))
                                        }
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            {/* Mobile Games Icon and Dropdown */}
                            <div className="md:hidden">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost" size="icon"
                                            className="text-gray-400 hover:text-white hover:bg-white/10 rounded-xl h-8 w-8 transition-all flex-shrink-0"
                                            title="Games & Entertainment"
                                        >
                                            <Gamepad2 className="w-4 h-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                        align="end" side="bottom"
                                        className="bg-slate-900/95 backdrop-blur-xl border border-white/10 text-white min-w-[220px] rounded-2xl shadow-2xl z-[300] p-1.5 animate-in fade-in zoom-in-95 duration-200"
                                        sideOffset={8}
                                    >
                                        <DropdownMenuLabel className="text-[10px] text-slate-500 uppercase tracking-[0.2em] px-3 py-2 font-bold">
                                            {gamesGroup.label}
                                        </DropdownMenuLabel>
                                        {gamesGroup.items.map((item, i) => (
                                            <DropdownMenuItem
                                                key={i}
                                                onClick={item.action}
                                                className="hover:bg-white/10 rounded-xl cursor-pointer min-h-[44px] haptic flex items-center gap-3 px-3 transition-colors group"
                                            >
                                                <item.icon className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
                                                <span className="text-sm font-medium">{item.label}</span>
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            {/* Mobile Productivity Icon and Dropdown */}
                            <div className="md:hidden">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost" size="icon"
                                            className="text-gray-400 hover:text-white hover:bg-white/10 rounded-xl h-8 w-8 transition-all relative flex-shrink-0"
                                            title="Productivity & Collaboration"
                                        >
                                            <Briefcase className="w-4 h-4" />
                                            {(hasUnreadNotes || hasUnreadTasks) && (
                                                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-slate-900 animate-pulse" />
                                            )}
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                        align="end" side="bottom"
                                        className="bg-slate-900/95 backdrop-blur-xl border border-white/10 text-white min-w-[220px] rounded-2xl shadow-2xl z-[300] p-1.5 animate-in fade-in zoom-in-95 duration-200"
                                        sideOffset={8}
                                    >
                                        <DropdownMenuLabel className="text-[10px] text-slate-500 uppercase tracking-[0.2em] px-3 py-2 font-bold">
                                            {productivityGroup.label}
                                        </DropdownMenuLabel>
                                        {productivityGroup.items.map((item, i) => (
                                            <DropdownMenuItem
                                                key={i}
                                                onClick={item.action}
                                                className="hover:bg-white/10 rounded-xl cursor-pointer min-h-[44px] haptic flex items-center justify-between px-3 transition-colors group"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <item.icon className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
                                                    <span className="text-sm font-medium">{item.label}</span>
                                                </div>
                                                {((item.label.toLowerCase().includes("notes") && hasUnreadNotes) ||
                                                    (item.label.toLowerCase().includes("task") && hasUnreadTasks)) && (
                                                        <span className="w-1.5 h-1.5 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                                                    )}
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            {/* Main Menu (3-dot on Mobile) */}
                            <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" 
                                        className="text-gray-400 hover:text-white hover:bg-white/10 rounded-xl h-8 w-8 transition-all relative flex-shrink-0" 
                                        title={isMenuOpen ? "Close Menu" : "Communication & Tools"}
                                    >
                                        <MoreVertical className="md:hidden w-4.5 h-4.5" />
                                        <Phone className="hidden md:block w-4.5 h-4.5" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent 
                                    align="end" side="bottom" 
                                    className="bg-slate-900/95 backdrop-blur-xl border border-white/10 text-white min-w-[260px] max-h-[85vh] overflow-y-auto rounded-2xl shadow-2xl z-[300] p-1.5 animate-in fade-in zoom-in-95 duration-200" 
                                    sideOffset={8}
                                >
                                    {/* Mobile Only Quick Actions */}
                                    <div className="md:hidden">
                                        {/* Top Actions Row */}
                                        <div className="flex items-center gap-2 px-2 py-2 mb-1">
                                            <Button
                                                variant="ghost" size="icon"
                                                onClick={toggleFullscreen}
                                                className="h-12 w-12 bg-slate-700/50 hover:bg-slate-700 text-cyan-400 rounded-xl haptic"
                                            >
                                                {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                                            </Button>

                                            <Button
                                                variant="ghost"
                                                onClick={handleCopyRoomLink}
                                                className="flex-1 h-12 bg-slate-700/50 hover:bg-slate-700 text-cyan-400 rounded-xl font-mono text-sm haptic justify-center"
                                            >
                                                {roomId}
                                            </Button>
                                        </div>

                                        <DropdownMenuSeparator className="bg-slate-700/50 my-1" />

                                        {[
                                            { group: settingsGroup, label: "Tools" },
                                            { group: appSettingsGroup, label: "Settings", isFoldable: true }
                                        ].map(({ group, label, isFoldable }: { group: MenuGroup; label: string; isFoldable?: boolean }, idx: number) => (
                                            <React.Fragment key={idx}>
                                                <div
                                                    className={`flex items-center justify-between px-3 py-2 ${isFoldable ? 'cursor-pointer hover:bg-slate-700/50 transition-colors rounded-lg mx-1' : ''}`}
                                                    onClick={() => isFoldable && setIsSettingsFolded(!isSettingsFolded)}
                                                >
                                                    <DropdownMenuLabel className="p-0 text-[10px] text-slate-400 uppercase tracking-widest font-bold opacity-70">
                                                        {label}
                                                    </DropdownMenuLabel>
                                                    {isFoldable && (
                                                        isSettingsFolded ? <ChevronRight className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />
                                                    )}
                                                </div>

                                                {(!isFoldable || !isSettingsFolded) && (
                                                    <div className="space-y-0.5 animate-in fade-in slide-in-from-top-1 duration-200">
                                                        {group.items
                                                            .filter((item: any) => {
                                                                if (label === "Media" && item.label.toLowerCase().includes("soundboard")) return false
                                                                return true
                                                            })
                                                            .map((item: any, i: number) => (
                                                                <DropdownMenuItem key={i} onClick={item.action} className="hover:bg-slate-700 cursor-pointer min-h-[48px] haptic flex items-center justify-between px-3">
                                                                    <div className="flex items-center gap-3">
                                                                        <item.icon className="w-4 h-4 flex-shrink-0 text-slate-400" />
                                                                        <span>{item.label}</span>
                                                                    </div>
                                                                    {((item.label.toLowerCase().includes("notes") && hasUnreadNotes) ||
                                                                        (item.label.toLowerCase().includes("task") && hasUnreadTasks)) && (
                                                                            <span className="w-2 h-2 bg-red-500 rounded-full" />
                                                                        )}
                                                                </DropdownMenuItem>
                                                            ))}
                                                    </div>
                                                )}
                                                <DropdownMenuSeparator className="bg-slate-700/50 my-1" />
                                            </React.Fragment>
                                        ))}
                                    </div>

                                    {/* Desktop Only Actions - Only Call Items now */}
                                    <div className="hidden md:block">
                                        <DropdownMenuLabel className="text-[10px] text-slate-400 uppercase tracking-widest px-3 py-2 font-bold opacity-70">
                                            Communication
                                        </DropdownMenuLabel>
                                        {communicationGroup.items.map((item: any, i: number) => (
                                            <DropdownMenuItem key={i} onClick={item.action} className="hover:bg-slate-700 cursor-pointer min-h-[48px] haptic flex items-center justify-between px-3">
                                                <div className="flex items-center gap-3">
                                                    <item.icon className="w-4 h-4 flex-shrink-0 text-slate-400" />
                                                    <span>{item.label}</span>
                                                </div>
                                            </DropdownMenuItem>
                                        ))}
                                    </div>
                                </DropdownMenuContent>
                            </DropdownMenu>

                            <div className="hidden md:flex items-center gap-2">
                                {/* Media Menu */}
                                <DropdownMenu open={isMediaMenuOpen} onOpenChange={setIsMediaMenuOpen}>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="text-gray-300 hover:text-white hover:bg-white/10 bg-white/5 rounded-xl h-10 w-10 transition-colors flex-shrink-0" title="Media & Watch Together">
                                            <Film className="w-5 h-5" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" side="bottom" className="bg-slate-800 border-slate-700 text-white min-w-56 animate-none rounded-xl shadow-2xl z-[300]" sideOffset={5}>
                                        <DropdownMenuLabel className="text-xs text-slate-400 uppercase tracking-wider px-2 py-1.5 font-semibold">{mediaGroup.label}</DropdownMenuLabel>
                                        {mediaGroup.items.map((item, i) => (
                                            <DropdownMenuItem key={i} onClick={item.action} className="hover:bg-slate-700 cursor-pointer min-h-[44px] haptic flex items-center gap-3 px-3 transition-colors">
                                                <item.icon className="w-4 h-4 flex-shrink-0" /><span>{item.label}</span>
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>

                                {/* Games Menu */}
                                <DropdownMenu open={isGamesMenuOpen} onOpenChange={setIsGamesMenuOpen}>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="text-gray-300 hover:text-white hover:bg-white/10 bg-white/5 rounded-xl h-10 w-10 transition-colors flex-shrink-0" title="Games & Entertainment">
                                            <Gamepad2 className="w-5 h-5" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" side="bottom" className="bg-slate-800 border-slate-700 text-white min-w-56 animate-none rounded-xl shadow-2xl z-[300]" sideOffset={5}>
                                        <DropdownMenuLabel className="text-xs text-slate-400 uppercase tracking-wider px-2 py-1.5 font-semibold">{gamesGroup.label}</DropdownMenuLabel>
                                        {gamesGroup.items.map((item, i) => (
                                            <DropdownMenuItem key={i} onClick={item.action} className="hover:bg-slate-700 cursor-pointer min-h-[44px] haptic flex items-center gap-3 px-3 transition-colors">
                                                <item.icon className="w-4 h-4 flex-shrink-0" /><span>{item.label}</span>
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>

                                {/* Productivity Menu */}
                                <DropdownMenu open={isProductivityMenuOpen} onOpenChange={setIsProductivityMenuOpen}>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="text-gray-300 hover:text-white hover:bg-white/10 bg-white/5 rounded-xl h-10 w-10 transition-colors relative flex-shrink-0" title="Productivity & Collaboration">
                                            <Briefcase className="w-5 h-5" />
                                            {(hasUnreadNotes || hasUnreadTasks) && (
                                                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-slate-900 animate-pulse" />
                                            )}
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" side="bottom" className="bg-slate-800 border-slate-700 text-white min-w-56 animate-none rounded-xl shadow-2xl z-[300]" sideOffset={5}>
                                        <DropdownMenuLabel className="text-xs text-slate-400 uppercase tracking-wider px-2 py-1.5 font-semibold">{productivityGroup.label}</DropdownMenuLabel>
                                        {productivityGroup.items.map((item, i) => (
                                            <DropdownMenuItem key={i} onClick={item.action} className="hover:bg-slate-700 cursor-pointer min-h-[44px] haptic flex items-center justify-between px-3 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <item.icon className="w-4 h-4 flex-shrink-0" />
                                                    <span>{item.label}</span>
                                                </div>
                                                {((item.label.toLowerCase().includes("notes") && hasUnreadNotes) ||
                                                    (item.label.toLowerCase().includes("task") && hasUnreadTasks)) && (
                                                        <span className="w-2 h-2 bg-red-500 rounded-full" />
                                                    )}
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>

                                {/* Settings Menu */}
                                <DropdownMenu open={isSettingsMenuOpen} onOpenChange={setIsSettingsMenuOpen}>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="text-gray-300 hover:text-white hover:bg-white/10 bg-white/5 rounded-xl h-10 w-10 transition-colors flex-shrink-0" title="Tools & Settings">
                                            <Hammer className="w-5 h-5" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" side="bottom" className="bg-slate-800 border-slate-700 text-white min-w-56 animate-none rounded-xl shadow-2xl z-[300]" sideOffset={5}>
                                        <DropdownMenuLabel className="text-xs text-slate-400 uppercase tracking-wider px-2 py-1.5 font-semibold">{settingsGroup.label}</DropdownMenuLabel>
                                        {settingsGroup.items.map((item, i) => (
                                            <DropdownMenuItem key={i} onClick={item.action} className="hover:bg-slate-700 cursor-pointer min-h-[44px] haptic flex items-center gap-3 px-3 transition-colors">
                                                <item.icon className="w-4 h-4 flex-shrink-0" /><span>{item.label}</span>
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>

                                {/* App Settings Menu (Gear Icon) */}
                                <DropdownMenu open={isAppMenuOpen} onOpenChange={setIsAppMenuOpen}>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="text-gray-300 hover:text-white hover:bg-white/10 bg-white/5 rounded-xl h-10 w-10 transition-colors flex-shrink-0" title="Settings">
                                            <Settings className="w-5 h-5" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" side="bottom" className="bg-slate-800 border-slate-700 text-white min-w-56 animate-none rounded-xl shadow-2xl z-[300]" sideOffset={5}>
                                        <DropdownMenuLabel className="text-xs text-slate-400 uppercase tracking-wider px-2 py-1.5 font-semibold">{appSettingsGroup.label}</DropdownMenuLabel>
                                        {appSettingsGroup.items.map((item, i) => (
                                            <DropdownMenuItem key={i} onClick={item.action} className="hover:bg-slate-700 cursor-pointer min-h-[44px] haptic flex items-center gap-3 px-3 transition-colors">
                                                <item.icon className="w-4 h-4 flex-shrink-0" /><span>{item.label}</span>
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            <Button
                                variant="ghost" size="icon"
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10 md:bg-[#F44336] md:text-white rounded-xl md:rounded-full h-8 w-8 md:h-10 md:w-10 md:shadow-lg transition-transform hover:scale-105 active:scale-95 flex-shrink-0"
                                onClick={handleLeaveRoom}
                                title={isHost ? "Destroy Room" : "Leave Room"}
                            >
                                <LogOut className="w-4 h-4 md:w-5 md:h-5" />
                            </Button>
                        </div>
                    </div>

                    {/* Pinned Message and Activity (Below the main row) */}
                    {pinnedMessage && (
                        <div className="bg-slate-800/95 backdrop-blur-md border-b border-slate-700 px-3 py-2 flex items-center justify-between min-h-[48px] flex-shrink-0">
                            <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
                                <Pin className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                                <div className="flex flex-col overflow-hidden flex-1 min-w-0">
                                    <span className="text-xs font-medium text-cyan-400">Pinned Message</span>
                                    <span className="text-sm text-gray-200 truncate">{pinnedMessage.text}</span>
                                </div>
                            </div>
                            {isHost && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-white flex-shrink-0 haptic" onClick={handleUnpinMessage}>
                                    <X className="w-3 h-3" />
                                </Button>
                            )}
                        </div>
                    )}

                    {/* Participants Bar (Persistent Members) */}
                    {showParticipants && (roomMembers?.length > 1) && (
                        <div className="px-3 py-2 bg-slate-800/50 border-b border-slate-700 animate-in slide-in-from-top-2 duration-300">
                            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide online-users-bar flex-nowrap">
                                <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">Participants:</span>
                                {(roomMembers || []).map((member) => {
                                    const onlineUser = (onlineUsers || []).find(u => u.name === member.name)
                                    const isOnline = !!onlineUser

                                    return (
                                        <Popover key={member.name}>
                                            <PopoverTrigger asChild>
                                                <button className={`flex items-center gap-1.5 bg-slate-700/50 hover:bg-slate-700 rounded-full px-2.5 py-1.5 whitespace-nowrap flex-shrink-0 transition-colors haptic ${!isOnline ? 'opacity-60 grayscale-[0.5]' : ''}`}>
                                                    <Avatar className="w-5 h-5 relative">
                                                        <AvatarImage src={member.avatar || onlineUser?.avatar} alt={member.name} />
                                                        <AvatarFallback className="text-[10px] bg-slate-600">{member.name[0]}</AvatarFallback>
                                                        {isOnline && (
                                                            <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-500 border border-slate-800 rounded-full" />
                                                        )}
                                                    </Avatar>
                                                    <span className="text-xs text-white">{member.name}</span>
                                                    {onlineUser?.mood && <span className="text-xs">{onlineUser.mood.emoji}</span>}
                                                </button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-64 bg-slate-800 border-slate-700 p-0 overflow-hidden rounded-2xl shadow-2xl animate-in zoom-in-95 z-[300]" sideOffset={8}>
                                                <div className="p-4 flex flex-col items-center gap-3">
                                                    <div className="relative">
                                                        <Avatar className="w-20 h-20 border-4 border-slate-700 shadow-xl">
                                                            <AvatarImage src={member.avatar || onlineUser?.avatar} alt={member.name} />
                                                            <AvatarFallback className="text-2xl bg-slate-700 text-white font-bold">{member.name[0]}</AvatarFallback>
                                                        </Avatar>
                                                        {isOnline && (
                                                            <div className="absolute bottom-1 right-1 w-4 h-4 bg-green-500 border-2 border-slate-800 rounded-full" />
                                                        )}
                                                    </div>
                                                    <div className="text-center">
                                                        <h3 className="text-lg font-bold text-white flex items-center justify-center gap-2">
                                                            {member.name}
                                                            {onlineUser?.mood && <span title={onlineUser.mood.text}>{onlineUser.mood.emoji}</span>}
                                                        </h3>
                                                        <p className="text-xs text-gray-400 uppercase tracking-widest mt-1">
                                                            {isOnline ? (onlineUser.currentActivity ? onlineUser.currentActivity.replace("-", " ") : "In Chat") : "Offline"}
                                                        </p>
                                                    </div>
                                                    {onlineUser?.mood?.text && (
                                                        <div className="bg-slate-700/50 px-3 py-1.5 rounded-lg text-sm text-gray-200 text-center italic w-full">
                                                            &quot;{onlineUser.mood.text}&quot;
                                                        </div>
                                                    )}
                                                    <div className="w-full h-px bg-slate-700/50 my-1" />
                                                    {isHost && member.name !== currentUserName && (
                                                        <div className="flex gap-2 w-full mt-2">
                                                            <Button
                                                                variant="destructive"
                                                                className="flex-1 text-xs text-white bg-red-500/80 hover:bg-red-600 rounded-xl flex items-center justify-center gap-1.5"
                                                                onClick={() => {
                                                                    if (onKickUser) {
                                                                        const targetUserId = onlineUser ? userPresence.createUniqueUserId(member.name) : ""
                                                                        if (targetUserId) {
                                                                            onKickUser(targetUserId)
                                                                        }
                                                                    }
                                                                }}
                                                            >
                                                                <X className="w-3.5 h-3.5" />
                                                                Kick from Room
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="absolute top-2 right-2">
                                                    <PopoverClose className="h-6 w-6 rounded-full flex items-center justify-center hover:bg-slate-700 text-gray-400 hover:text-white transition-colors">
                                                        <X className="w-4 h-4" />
                                                    </PopoverClose>
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <UserActivityIndicators users={onlineUsers} currentUserId={currentUserId} />
        </>
    )
}
