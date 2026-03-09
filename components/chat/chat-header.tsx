"use client"

import React from "react"
import { Button } from "../ui/button"
import { AnimatedLogo } from "../animated-logo"
import { UserMoodSelector } from "./user-mood-selector"
import { UserActivityIndicators } from "../user-activity-indicators"
import type { UserPresence } from "@/utils/infra/user-presence"
import type { Message } from "../message-bubble"
import type { MenuGroup } from "./chat-types"
import {
    Film, Gamepad2, Briefcase, Hammer, MoreVertical, Settings,
    Copy, Pin, X, Search,
} from "lucide-react"
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator,
} from "../ui/dropdown-menu"

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
}: ChatHeaderProps) {
    return (
        <>
            {/* Header */}
            <div className="flex items-center justify-between p-4 z-20 min-h-[70px] flex-shrink-0">
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
                                <Button variant="ghost" size="icon" className="text-gray-300 hover:text-white hover:bg-white/10 bg-white/5 rounded-xl h-10 w-10 transition-colors" title="Productivity & Collaboration">
                                    <Briefcase className="w-5 h-5" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" side="bottom" className="bg-slate-800 border-slate-700 text-white min-w-56 animate-none rounded-xl shadow-2xl" sideOffset={5}>
                                <DropdownMenuLabel className="text-xs text-slate-400 uppercase tracking-wider px-2 py-1.5 font-semibold">{productivityGroup.label}</DropdownMenuLabel>
                                {productivityGroup.items.map((item, i) => (
                                    <DropdownMenuItem key={i} onClick={item.action} className="hover:bg-slate-700 cursor-pointer min-h-[44px] haptic flex items-center gap-3 px-3 transition-colors">
                                        <item.icon className="w-4 h-4 flex-shrink-0" /><span>{item.label}</span>
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

            {/* Online Users Bar */}
            {onlineUsers.length > 1 && (
                <div className="px-3 py-2 bg-slate-800/50 border-b border-slate-700">
                    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide online-users-bar">
                        <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">Online:</span>
                        {onlineUsers.map((user) => (
                            <div key={user.id} className="flex items-center gap-1.5 bg-slate-700/50 rounded-full px-2.5 py-1.5 whitespace-nowrap flex-shrink-0">
                                {user.avatar ? (
                                    <img src={user.avatar || "/placeholder.svg"} alt={user.name} className="w-5 h-5 rounded-full" />
                                ) : (
                                    <div className="w-5 h-5 rounded-full bg-slate-600 flex items-center justify-center">
                                        <span className="text-xs">{user.name[0]}</span>
                                    </div>
                                )}
                                <span className="text-xs text-white">{user.name}</span>
                                {user.mood && <span className="text-xs" title={user.mood.text}>{user.mood.emoji}</span>}
                                {user.currentActivity && user.currentActivity !== "chat" && (
                                    <span className="text-xs text-cyan-400 hidden sm:inline">({user.currentActivity})</span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <UserActivityIndicators users={onlineUsers} currentUserId={currentUserId} />
        </>
    )
}
