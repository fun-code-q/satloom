"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Users, Plus, DoorOpen, DoorClosed, Copy, Check, X, Send, UserPlus } from "lucide-react"
import { BreakoutRoomsManager, BreakoutRoom, BreakoutInvite } from "@/utils/infra/breakout-rooms-manager"
import { toast } from "sonner"

interface BreakoutRoomsModalProps {
    isOpen: boolean
    onClose: () => void
    roomId: string
    currentUserId: string
    currentUserName: string
}

export function BreakoutRoomsModal({
    isOpen,
    onClose,
    roomId,
    currentUserId,
    currentUserName,
}: BreakoutRoomsModalProps) {
    const [breakoutRooms, setBreakoutRooms] = useState<BreakoutRoom[]>([])
    const [pendingInvites, setPendingInvites] = useState<BreakoutInvite[]>([])
    const [newRoomName, setNewRoomName] = useState("")
    const [newRoomMaxParticipants, setNewRoomMaxParticipants] = useState(10)
    const [createdRoomId, setCreatedRoomId] = useState<string | null>(null)
    const [copiedId, setCopiedId] = useState<string | null>(null)

    const breakoutManager = BreakoutRoomsManager.getInstance()

    // Load breakout rooms and invites
    useEffect(() => {
        if (!isOpen) return

        const loadData = async () => {
            const rooms = await breakoutManager.getBreakoutRooms(roomId)
            setBreakoutRooms(rooms)

            const invites = await breakoutManager.getPendingInvites(roomId, currentUserId)
            setPendingInvites(invites)
        }

        loadData()

        // Listen for changes
        const unsubRooms = breakoutManager.listenForBreakoutRooms(roomId, (rooms) => {
            setBreakoutRooms(rooms)
        })

        const unsubInvites = breakoutManager.listenForInvites(roomId, currentUserId, (invites) => {
            setPendingInvites(invites)
        })

        return () => {
            unsubRooms()
            unsubInvites()
        }
    }, [isOpen, roomId, currentUserId])

    // Create breakout room
    const handleCreateRoom = async () => {
        if (!newRoomName.trim()) {
            toast.error("Please enter a room name")
            return
        }

        const breakoutRoomId = Math.random().toString(36).substring(2, 8).toUpperCase()

        const success = await breakoutManager.createBreakoutRoom(
            roomId,
            breakoutRoomId,
            newRoomName.trim(),
            currentUserId,
            currentUserName,
            newRoomMaxParticipants
        )

        if (success) {
            toast.success(`Created breakout room: ${newRoomName}`)
            setCreatedRoomId(breakoutRoomId)
            setNewRoomName("")
        } else {
            toast.error("Failed to create room")
        }
    }

    // Join breakout room
    const handleJoinRoom = async (breakoutRoomId: string) => {
        const result = await breakoutManager.joinBreakoutRoom(roomId, breakoutRoomId, currentUserId, currentUserName)

        if (result.success) {
            toast.success("Joined breakout room")
            onClose()
        } else {
            toast.error(result.error || "Failed to join room")
        }
    }

    // Leave breakout room
    const handleLeaveRoom = async (breakoutRoomId: string) => {
        const success = await breakoutManager.leaveBreakoutRoom(roomId, breakoutRoomId, currentUserId)

        if (success) {
            toast.success("Left breakout room")
        } else {
            toast.error("Failed to leave room")
        }
    }

    // Close breakout room (creator only)
    const handleCloseRoom = async (breakoutRoom: BreakoutRoom) => {
        const result = await breakoutManager.closeBreakoutRoom(roomId, breakoutRoom.id, currentUserId)

        if (result.success) {
            toast.success(`Closed breakout room: ${breakoutRoom.name}`)
        } else {
            toast.error(result.error || "Failed to close room")
        }
    }

    // Send invite
    const handleSendInvite = async (breakoutRoomId: string, breakoutRoomName: string, toUserId: string) => {
        const success = await breakoutManager.sendInvite(
            roomId,
            breakoutRoomId,
            breakoutRoomName,
            currentUserId,
            currentUserName,
            toUserId
        )

        if (success) {
            toast.success("Invite sent")
        } else {
            toast.error("Failed to send invite")
        }
    }

    // Respond to invite
    const handleRespondToInvite = async (invite: BreakoutInvite, response: "accepted" | "declined") => {
        await breakoutManager.respondToInvite(roomId, invite.id, invite, response)

        if (response === "accepted") {
            toast.success(`Joined ${invite.breakoutRoomName}`)
            onClose()
        } else {
            toast.success("Invite declined")
        }
    }

    // Copy room ID
    const copyToClipboard = async (id: string) => {
        await navigator.clipboard.writeText(id)
        setCopiedId(id)
        setTimeout(() => setCopiedId(null), 2000)
    }

    // Check if user is creator of a room
    const isCreator = (room: BreakoutRoom) => room.createdBy === currentUserId

    // Check if user is in a room
    const isInRoom = (room: BreakoutRoom) => room.participants.includes(currentUserId)

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-cyan-400" />
                        Breakout Rooms
                    </DialogTitle>
                </DialogHeader>

                {/* Pending Invites */}
                {pendingInvites.length > 0 && (
                    <div className="mb-4 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                        <h3 className="text-sm font-medium text-amber-400 mb-2">Pending Invites</h3>
                        <div className="space-y-2">
                            {pendingInvites.map((invite) => (
                                <div key={invite.id} className="flex items-center justify-between">
                                    <div>
                                        <span className="text-sm">{invite.fromUserName} invited you to </span>
                                        <span className="font-medium">{invite.breakoutRoomName}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="text-green-400 hover:text-green-300"
                                            onClick={() => handleRespondToInvite(invite, "accepted")}
                                        >
                                            <Check className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="text-red-400 hover:text-red-300"
                                            onClick={() => handleRespondToInvite(invite, "declined")}
                                        >
                                            <X className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Created Room Success */}
                {createdRoomId && (
                    <div className="mb-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-green-400">Room created! Share this ID:</p>
                                <p className="text-lg font-mono font-bold mt-1">{createdRoomId}</p>
                            </div>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => copyToClipboard(createdRoomId)}
                                className="text-green-400 hover:text-green-300"
                            >
                                {copiedId === createdRoomId ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            </Button>
                        </div>
                    </div>
                )}

                {/* Create New Room */}
                <div className="p-4 bg-slate-800/50 rounded-lg mb-4">
                    <h3 className="text-sm font-medium text-gray-400 mb-3">Create Breakout Room</h3>
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <Input
                                value={newRoomName}
                                onChange={(e) => setNewRoomName(e.target.value)}
                                placeholder="Room name"
                                className="bg-slate-900 border-slate-600 text-white"
                                maxLength={30}
                            />
                        </div>
                        <div className="w-24">
                            <Input
                                type="number"
                                value={newRoomMaxParticipants}
                                onChange={(e) => setNewRoomMaxParticipants(parseInt(e.target.value) || 10)}
                                min={2}
                                max={50}
                                className="bg-slate-900 border-slate-600 text-white"
                            />
                        </div>
                        <Button
                            onClick={handleCreateRoom}
                            className="bg-cyan-500 hover:bg-cyan-600"
                            disabled={!newRoomName.trim()}
                        >
                            <Plus className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                {/* Existing Rooms */}
                <div>
                    <h3 className="text-sm font-medium text-gray-400 mb-2">Active Breakout Rooms</h3>

                    {breakoutRooms.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p>No breakout rooms active</p>
                            <p className="text-sm">Create one above to get started!</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {breakoutRooms.map((room) => (
                                <div
                                    key={room.id}
                                    className={`p-3 rounded-lg border ${isInRoom(room)
                                            ? "bg-cyan-500/10 border-cyan-500/30"
                                            : "bg-slate-800/50 border-slate-700"
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="font-medium">{room.name}</h4>
                                            <p className="text-xs text-gray-400">
                                                {room.participants.length}/{room.maxParticipants} participants
                                                {room.createdBy !== currentUserId && room.participants.length > 0 && (
                                                    <span className="ml-2">
                                                        • {room.participants.length} joined
                                                    </span>
                                                )}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {isInRoom(room) ? (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="text-red-400 hover:text-red-300"
                                                    onClick={() => handleLeaveRoom(room.id)}
                                                >
                                                    <DoorOpen className="w-4 h-4" />
                                                    Leave
                                                </Button>
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    className="bg-cyan-500 hover:bg-cyan-600"
                                                    onClick={() => handleJoinRoom(room.id)}
                                                    disabled={room.participants.length >= room.maxParticipants}
                                                >
                                                    <DoorClosed className="w-4 h-4" />
                                                    Join
                                                </Button>
                                            )}

                                            {isCreator(room) && (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="text-gray-400 hover:text-white"
                                                    onClick={() => handleCloseRoom(room)}
                                                >
                                                    <X className="w-4 h-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Participant list */}
                                    <div className="mt-2 flex flex-wrap gap-1">
                                        {room.participants.slice(0, 5).map((participantId) => (
                                            <span
                                                key={participantId}
                                                className="text-xs px-2 py-0.5 bg-slate-700 rounded-full text-gray-300"
                                            >
                                                {participantId === currentUserId ? "You" : "User"}
                                            </span>
                                        ))}
                                        {room.participants.length > 5 && (
                                            <span className="text-xs text-gray-400">
                                                +{room.participants.length - 5} more
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
