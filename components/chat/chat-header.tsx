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
    Copy, Pin, X, Search,
} from "lucide-react"
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator,
} from "../ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger, PopoverClose } from "../ui/popover"
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar"

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
    // Pinned message
    pinnedMessage: Message | null
    // Status
    firebaseConnected: boolean
    // Search
    showChatSearch: boolean
    setShowChatSearch: (val: boolean) => void
    hasUnreadNotes: boolean
    hasUnreadTasks: boolean
    roomMembers: RoomMember[]
    autoHide?: boolean
}

export function ChatHeader({
    roomId, isHost,
    currentUserMood, setCurrentUserMood, isMoodSelectorOpen, setIsMoodSelectorOpen,
    handleCopyRoomLink, handleLeaveRoom, handleUnpinMessage,
    mediaGroup, gamesGroup, productivityGroup, settingsGroup, appSettingsGroup, menuGroups,
    isMenuOpen, setIsMenuOpen, isMediaMenuOpen, setIsMediaMenuOpen,
    isGamesMenuOpen, setIsGamesMenuOpen, isProductivityMenuOpen, setIsProductivityMenuOpen,
    isSettingsMenuOpen, setIsSettingsMenuOpen, isAppMenuOpen, setIsAppMenuOpen,
    onlineUsers, currentUserId, pinnedMessage,
    firebaseConnected,
    showChatSearch, setShowChatSearch,
    hasUnreadNotes, hasUnreadTasks,
    roomMembers,
    autoHide = true,
}: ChatHeaderProps) {
    const [isHeaderVisible, setIsHeaderVisible] = useState(true)
    const headerTimeoutRef = useRef<NodeJS.Timeout | null>(null)

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

    return (
        <>
            {/* Invisible hover zone at the top to re-summon the header */}
            <div
                className="fixed top-0 left-0 right-0 h-4 z-[60]"
                onMouseEnter={resetHideTimer}
                onTouchStart={resetHideTimer}
            />

            <div
                className={`absolute top-0 left-0 right-0 z-40 transition-transform duration-500 ease-in-out ${isHeaderVisible || anyMenuOpen ? "translate-y-0" : "-translate-y-full"
                    }`}
                onMouseMove={handleMouseMove}
                onMouseLeave={resetHideTimer}
                onTouchStart={resetHideTimer}
            >
                {/* Header Background */}
                <div className="bg-slate-900/60 backdrop-blur-md shadow-lg border-b border-white/5 flex flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 min-h-[70px] flex-shrink-0">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                            <AnimatedLogo />
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

                        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                            {/* Desktop Actions */}
                            <div className="hidden md:flex items-center gap-2">
                                <Button
                                    variant="ghost" size="icon"
                                    className={`rounded-xl h-10 w-10 transition-colors ${showChatSearch ? 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30' : 'text-gray-300 hover:text-white hover:bg-white/10 bg-white/5'}`}
                                    onClick={() => setShowChatSearch(!showChatSearch)}
                                    title="Search messages"
                                >
                                    <Search className="w-4 h-4" />
                                </Button>

                                <Button
                                    variant="ghost" size="icon"
                                    className="text-gray-300 hover:text-white hover:bg-white/10 bg-white/5 rounded-xl h-10 w-10 transition-colors"
                                    onClick={handleCopyRoomLink}
                                    title={`Copy Room Link (${roomId})`}
                                >
                                    <Copy className="w-4 h-4" />
                                </Button>

                                {/* Media Menu */}
                                <DropdownMenu open={isMediaMenuOpen} onOpenChange={setIsMediaMenuOpen}>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="text-gray-300 hover:text-white hover:bg-white/10 bg-white/5 rounded-xl h-10 w-10 transition-colors" title="Media & Watch Together">
                                            <Film className="w-5 h-5" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" side="bottom" className="bg-slate-800 border-slate-700 text-white min-w-56 animate-none rounded-xl shadow-2xl" sideOffset={5}>
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
                                        <Button variant="ghost" size="icon" className="text-gray-300 hover:text-white hover:bg-white/10 bg-white/5 rounded-xl h-10 w-10 transition-colors" title="Games & Entertainment">
                                            <Gamepad2 className="w-5 h-5" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" side="bottom" className="bg-slate-800 border-slate-700 text-white min-w-56 animate-none rounded-xl shadow-2xl" sideOffset={5}>
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
                                        <Button variant="ghost" size="icon" className="text-gray-300 hover:text-white hover:bg-white/10 bg-white/5 rounded-xl h-10 w-10 transition-colors relative" title="Productivity & Collaboration">
                                            <Briefcase className="w-5 h-5" />
                                            {(hasUnreadNotes || hasUnreadTasks) && (
                                                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-slate-900 animate-pulse" />
                                            )}
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" side="bottom" className="bg-slate-800 border-slate-700 text-white min-w-56 animate-none rounded-xl shadow-2xl" sideOffset={5}>
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
                                        <Button variant="ghost" size="icon" className="text-gray-300 hover:text-white hover:bg-white/10 bg-white/5 rounded-xl h-10 w-10 transition-colors" title="Tools & Settings">
                                            <Hammer className="w-5 h-5" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" side="bottom" className="bg-slate-800 border-slate-700 text-white min-w-56 animate-none rounded-xl shadow-2xl" sideOffset={5}>
                                        <DropdownMenuLabel className="text-xs text-slate-400 uppercase tracking-wider px-2 py-1.5 font-semibold">{settingsGroup.label}</DropdownMenuLabel>
                                        {settingsGroup.items.map((item, i) => (
                                            <DropdownMenuItem key={i} onClick={item.action} className="hover:bg-slate-700 cursor-pointer min-h-[44px] haptic flex items-center gap-3 px-3 transition-colors">
                                                <item.icon className="w-4 h-4 flex-shrink-0" /><span>{item.label}</span>
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>

                                {/* App Settings Menu */}
                                <DropdownMenu open={isAppMenuOpen} onOpenChange={setIsAppMenuOpen}>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="text-gray-300 hover:text-white hover:bg-white/10 bg-white/5 rounded-xl h-10 w-10 transition-colors" title="Settings">
                                            <Settings className="w-5 h-5" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" side="bottom" className="bg-slate-800 border-slate-700 text-white min-w-56 animate-none rounded-xl shadow-2xl" sideOffset={5}>
                                        <DropdownMenuLabel className="text-xs text-slate-400 uppercase tracking-wider px-2 py-1.5 font-semibold">{appSettingsGroup.label}</DropdownMenuLabel>
                                        {appSettingsGroup.items.map((item, i) => (
                                            <DropdownMenuItem key={i} onClick={item.action} className="hover:bg-slate-700 cursor-pointer min-h-[44px] haptic flex items-center gap-3 px-3 transition-colors">
                                                <item.icon className="w-4 h-4 flex-shrink-0" /><span>{item.label}</span>
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            {/* Mobile Combined Menu + Universal More Options */}
                            <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="text-gray-300 hover:text-white hover:bg-white/10 bg-white/5 rounded-xl h-10 w-10 transition-colors" title="Game Controls & Tools">
                                        <MoreVertical className="w-5 h-5" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" side="bottom" className="bg-slate-800 border-slate-700 text-white min-w-[280px] sm:min-w-64 max-h-[85vh] overflow-y-auto animate-none rounded-2xl shadow-2xl" sideOffset={8}>
                                    {/* Mobile Only Quick Actions */}
                                    <div className="md:hidden">
                                        <DropdownMenuLabel className="text-[10px] text-cyan-400 uppercase tracking-widest px-3 py-2 font-bold opacity-80">Quick Toolset</DropdownMenuLabel>
                                        <DropdownMenuItem onClick={handleCopyRoomLink} className="hover:bg-slate-700 cursor-pointer min-h-[48px] haptic flex items-center gap-3 px-3">
                                            <Copy className="w-4 h-4 text-cyan-400" /><span>Copy Room ID ({roomId})</span>
                                        </DropdownMenuItem>

                                        <DropdownMenuSeparator className="bg-slate-700/50 my-1" />

                                        {[mediaGroup, gamesGroup, productivityGroup, settingsGroup, appSettingsGroup].map((group, idx) => (
                                            <React.Fragment key={idx}>
                                                <DropdownMenuLabel className="text-[10px] text-slate-400 uppercase tracking-widest px-3 py-2 font-bold opacity-70">{group.label}</DropdownMenuLabel>
                                                {group.items.map((item, i) => (
                                                    <DropdownMenuItem key={i} onClick={item.action} className="hover:bg-slate-700 cursor-pointer min-h-[48px] haptic flex items-center gap-3 px-3">
                                                        <item.icon className="w-4 h-4 flex-shrink-0 text-slate-400" /><span>{item.label}</span>
                                                    </DropdownMenuItem>
                                                ))}
                                                <DropdownMenuSeparator className="bg-slate-700/50 my-1" />
                                            </React.Fragment>
                                        ))}
                                    </div>

                                    {/* Standard More Options (Communication, etc.) */}
                                    <DropdownMenuLabel className="text-[10px] text-pink-400 uppercase tracking-widest px-3 py-2 font-bold opacity-80">Sessions & Social</DropdownMenuLabel>
                                    {menuGroups.map((group, groupIndex) => (
                                        <React.Fragment key={groupIndex}>
                                            {groupIndex > 0 && <DropdownMenuLabel className="text-[10px] text-slate-400 uppercase tracking-widest px-3 py-2 font-bold opacity-70">{group.label}</DropdownMenuLabel>}
                                            {group.items.map((item, itemIndex) => (
                                                <DropdownMenuItem key={itemIndex} onClick={item.action} className="hover:bg-slate-700 cursor-pointer min-h-[48px] haptic flex items-center gap-3 px-3">
                                                    <item.icon className="w-4 h-4 flex-shrink-0 text-slate-400" /><span>{item.label}</span>
                                                </DropdownMenuItem>
                                            ))}
                                            {groupIndex < menuGroups.length - 1 && <DropdownMenuSeparator className="bg-slate-700/50 my-1" />}
                                        </React.Fragment>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>

                            <Button
                                variant="ghost" size="icon"
                                className="text-white hover:bg-red-600 bg-[#F44336] rounded-full h-10 w-10 shadow-lg transition-transform hover:scale-105 active:scale-95 flex-shrink-0"
                                onClick={handleLeaveRoom}
                                title={isHost ? "Destroy Room" : "Leave Room"}
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
                                </svg>
                            </Button>
                        </div>
                    </div>

                    {/* Pinned Message */}
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
                    {(roomMembers.length > 1) && (
                        <div className="px-3 py-2 bg-slate-800/50 border-b border-slate-700">
                            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide online-users-bar flex-nowrap">
                                <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">Participants:</span>
                                {roomMembers.map((member) => {
                                    const onlineUser = onlineUsers.find(u => u.name === member.name)
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
                                            <PopoverContent className="w-64 bg-slate-800 border-slate-700 p-0 overflow-hidden rounded-2xl shadow-2xl animate-in zoom-in-95" sideOffset={8}>
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
                                                            "{onlineUser.mood.text}"
                                                        </div>
                                                    )}
                                                    <div className="w-full h-px bg-slate-700/50 my-1" />
                                                    <div className="flex gap-2 w-full">
                                                        <Button variant="ghost" className="flex-1 text-xs text-slate-300 hover:text-white hover:bg-slate-700 rounded-xl">View Profile</Button>
                                                        <Button variant="ghost" className="flex-1 text-xs text-slate-300 hover:text-white hover:bg-slate-700 rounded-xl">Message</Button>
                                                    </div>
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
