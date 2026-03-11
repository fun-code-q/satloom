"use client";

import { useState } from "react";
import { Smile, X, Check, Coffee, Code, Music, Moon, Zap, Laptop, Briefcase, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface UserMoodSelectorProps {
    currentMood?: { emoji: string; text: string };
    onMoodChange: (mood: { emoji: string; text: string } | null) => void;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

const PRESET_MOODS = [
    { emoji: "😊", text: "Happy" },
    { emoji: "😤", text: "Busy" },
    { emoji: "🎧", text: "Listening" },
    { emoji: "💻", text: "Coding" },
    { emoji: "☕", text: "Coffee Break" },
    { emoji: "💤", text: "Away" },
    { emoji: "🔥", text: "On Fire" },
    { emoji: "🎮", text: "Gaming" },
];

export function UserMoodSelector({ currentMood, onMoodChange, open, onOpenChange }: UserMoodSelectorProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    const isOpen = open !== undefined ? open : internalOpen;
    const setIsOpen = onOpenChange !== undefined ? onOpenChange : setInternalOpen;

    const [customText, setCustomText] = useState(currentMood?.text || "");
    const [selectedEmoji, setSelectedEmoji] = useState(currentMood?.emoji || "😊");

    const handleSave = () => {
        onMoodChange({ emoji: selectedEmoji, text: customText });
        setIsOpen(false);
    };

    const handleClear = () => {
        onMoodChange(null);
        setCustomText("");
        setSelectedEmoji("😊");
        setIsOpen(false);
    };

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-2 px-2 text-slate-400 hover:text-cyan-400 hover:bg-slate-800/50 transition-all rounded-full"
                    title="Set your mood"
                >
                    {currentMood ? (
                        <>
                            <span className="text-base leading-none">{currentMood.emoji}</span>
                            <span className="text-xs font-medium truncate max-w-[80px]">
                                {currentMood.text}
                            </span>
                        </>
                    ) : (
                        <>
                            <Smile className="w-4 h-4" />
                            <span className="text-xs">Set Status</span>
                        </>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 bg-slate-900 border-slate-700 p-3 shadow-2xl z-[300]">
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-slate-200">Set Status</h4>
                        {currentMood && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleClear}
                                className="h-6 text-[10px] text-red-400 hover:text-red-300 hover:bg-red-950/30"
                            >
                                Clear
                            </Button>
                        )}
                    </div>

                    <div className="flex gap-2">
                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 text-xl">
                            {selectedEmoji}
                        </div>
                        <Input
                            value={customText}
                            onChange={(e) => setCustomText(e.target.value)}
                            placeholder="What's your status?"
                            className="h-10 bg-slate-800 border-slate-700 text-white text-sm"
                            onKeyDown={(e) => e.key === "Enter" && handleSave()}
                        />
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                        {PRESET_MOODS.map((mood) => (
                            <button
                                key={mood.text}
                                onClick={() => {
                                    setSelectedEmoji(mood.emoji);
                                    setCustomText(mood.text);
                                }}
                                className={`p-2 rounded-lg transition-colors text-xl flex items-center justify-center ${selectedEmoji === mood.emoji
                                    ? "bg-cyan-900/40 border border-cyan-500/50"
                                    : "bg-slate-800/50 border border-transparent hover:bg-slate-800"
                                    }`}
                                title={mood.text}
                            >
                                {mood.emoji}
                            </button>
                        ))}
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsOpen(false)}
                            className="text-slate-400 hover:text-white"
                        >
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleSave}
                            className="bg-cyan-600 hover:bg-cyan-500 text-white gap-1"
                        >
                            <Check className="w-3.5 h-3.5" />
                            Save
                        </Button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
