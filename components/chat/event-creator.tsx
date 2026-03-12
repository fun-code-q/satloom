"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { X, Calendar, Clock, MapPin, AlignLeft } from "lucide-react"
import { format } from "date-fns"

interface EventCreatorProps {
    onSend: (eventData: {
        title: string
        date: string
        time: string
        location: string
        description: string
    }) => void
    onCancel: () => void
}

export function EventCreator({ onSend, onCancel }: EventCreatorProps) {
    const [title, setTitle] = useState("")
    const [date, setDate] = useState("")
    const [time, setTime] = useState("")
    const [location, setLocation] = useState("")
    const [description, setDescription] = useState("")

    const handleSend = () => {
        if (title.trim() && date && time) {
            onSend({
                title,
                date,
                time,
                location,
                description,
            })
        }
    }

    return (
        <div className="w-full max-w-md bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-slate-800/50 bg-slate-800/30">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                        <Calendar className="w-4 h-4 text-cyan-400" />
                    </div>
                    <h3 className="font-semibold text-slate-100 italic tracking-tight">Create Event</h3>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onCancel}
                    className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"
                >
                    <X className="w-4 h-4" />
                </Button>
            </div>

            <div className="p-5 space-y-4">
                <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1 block mb-1">Event Title</label>
                    <Input
                        id="event-title"
                        name="title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="What's happening?"
                        className="w-full bg-slate-950/50 border-slate-800 text-slate-100 placeholder:text-slate-600 h-11 focus:border-cyan-500/50 focus:ring-cyan-500/20 transition-all rounded-xl font-medium"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1 mb-1">
                            <Calendar className="w-3 h-3" /> Date
                        </label>
                        <Input
                            id="event-date"
                            name="date"
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="w-full bg-slate-950/40 border-slate-800 text-slate-100 placeholder:text-slate-700 h-10 focus:border-cyan-500/30 focus:ring-cyan-500/10 transition-all rounded-lg"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1 mb-1">
                            <Clock className="w-3 h-3" /> Time
                        </label>
                        <Input
                            id="event-time"
                            name="time"
                            type="time"
                            value={time}
                            onChange={(e) => setTime(e.target.value)}
                            className="w-full bg-slate-950/40 border-slate-800 text-slate-100 placeholder:text-slate-700 h-10 focus:border-cyan-500/30 focus:ring-cyan-500/10 transition-all rounded-lg"
                        />
                    </div>
                </div>

                <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1 mb-1">
                        <MapPin className="w-3 h-3" /> Location (Optional)
                    </label>
                    <Input
                        id="event-location"
                        name="location"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="Where is it?"
                        className="w-full bg-slate-950/40 border-slate-800 text-slate-100 placeholder:text-slate-600 h-10 focus:border-cyan-500/30 focus:ring-cyan-500/10 transition-all rounded-lg"
                    />
                </div>

                <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1 mb-1">
                        <AlignLeft className="w-3 h-3" /> Description (Optional)
                    </label>
                    <Textarea
                        id="event-description"
                        name="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Add some details..."
                        className="w-full bg-slate-950/40 border-slate-800 text-slate-100 placeholder:text-slate-600 focus:border-cyan-500/30 focus:ring-cyan-500/10 transition-all rounded-xl resize-none"
                        rows={3}
                    />
                </div>

                <Button
                    onClick={handleSend}
                    className="w-full h-12 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg shadow-cyan-900/20 transition-all disabled:opacity-50 disabled:grayscale mt-2"
                    disabled={!title.trim() || !date || !time}
                >
                    Create Event
                </Button>
            </div>
        </div>
    )
}
