"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { X, Plus, Trash2, BarChart2 } from "lucide-react"

interface PollCreatorProps {
    onSend: (question: string, options: string[]) => void
    onCancel: () => void
}

export function PollCreator({ onSend, onCancel }: PollCreatorProps) {
    const [question, setQuestion] = useState("")
    const [options, setOptions] = useState(["", ""])

    const handleAddOption = () => {
        if (options.length < 10) {
            setOptions([...options, ""])
        }
    }

    const handleRemoveOption = (index: number) => {
        if (options.length > 2) {
            const newOptions = [...options]
            newOptions.splice(index, 1)
            setOptions(newOptions)
        }
    }

    const handleOptionChange = (index: number, value: string) => {
        const newOptions = [...options]
        newOptions[index] = value
        setOptions(newOptions)
    }

    const handleSend = () => {
        const validOptions = options.filter(opt => opt.trim() !== "")
        if (question.trim() && validOptions.length >= 2) {
            onSend(question, validOptions)
        }
    }

    return (
        <div className="w-full max-w-md bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-slate-800/50 bg-slate-800/30">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                        <BarChart2 className="w-4 h-4 text-cyan-400" />
                    </div>
                    <h3 className="font-semibold text-slate-100 italic tracking-tight">Create Poll</h3>
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

            <div className="p-5 space-y-6">
                {/* Question Section */}
                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">The Question</label>
                    <Input
                        id="poll-question"
                        name="poll-question"
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        placeholder="What's on your mind?"
                        className="w-full bg-slate-950/50 border-slate-800 text-slate-100 placeholder:text-slate-600 h-11 focus:border-cyan-500/50 focus:ring-cyan-500/20 transition-all rounded-xl"
                    />
                </div>

                {/* Options Section */}
                <div className="space-y-3">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Options</label>
                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                        {options.map((option, index) => (
                            <div key={index} className="flex gap-2 group animate-in slide-in-from-left-2 duration-200" style={{ animationDelay: `${index * 50}ms` }}>
                                <Input
                                    id={`poll-option-${index}`}
                                    name={`poll-option-${index}`}
                                    value={option}
                                    onChange={(e) => handleOptionChange(index, e.target.value)}
                                    placeholder={`Option ${index + 1}`}
                                    className="flex-1 bg-slate-950/40 border-slate-800 text-slate-100 placeholder:text-slate-700 h-10 focus:border-cyan-500/30 focus:ring-cyan-500/10 transition-all rounded-lg"
                                />
                                {options.length > 2 && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleRemoveOption(index)}
                                        className="h-10 w-10 text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-all opacity-0 group-hover:opacity-100"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Add Option Trigger */}
                {options.length < 10 && (
                    <Button
                        variant="ghost"
                        onClick={handleAddOption}
                        className="w-full h-10 border border-dashed border-slate-800 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-all rounded-xl"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        <span className="text-sm font-medium">Add another option</span>
                    </Button>
                )}

                {/* Send Button */}
                <Button
                    onClick={handleSend}
                    className="w-full h-12 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg shadow-cyan-900/20 transition-all disabled:opacity-50 disabled:grayscale"
                    disabled={!question.trim() || options.filter(opt => opt.trim() !== "").length < 2}
                >
                    Launch Poll
                </Button>
            </div>
        </div>
    )
}
