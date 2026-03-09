"use client"

import { Editor } from "@monaco-editor/react"
import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"

interface CodePreviewProps {
    url: string
    name: string
}

export function CodePreview({ url, name }: CodePreviewProps) {
    const [content, setContent] = useState<string>("")
    const [loading, setLoading] = useState(true)

    // Determine language from extension
    const getLanguage = (filename: string) => {
        const ext = filename.split(".").pop()?.toLowerCase()
        switch (ext) {
            case "js":
            case "jsx":
                return "javascript"
            case "ts":
            case "tsx":
                return "typescript"
            case "py":
                return "python"
            case "html":
                return "html"
            case "css":
                return "css"
            case "json":
                return "json"
            case "md":
                return "markdown"
            case "sql":
                return "sql"
            case "java":
                return "java"
            case "cpp":
            case "c":
            case "h":
                return "cpp"
            default:
                return "plaintext"
        }
    }

    useEffect(() => {
        fetch(url)
            .then((res) => res.text())
            .then((text) => {
                setContent(text)
                setLoading(false)
            })
            .catch((err) => {
                console.error("Failed to load code:", err)
                setContent("// Failed to load code content")
                setLoading(false)
            })
    }, [url])

    return (
        <div className="h-[60vh] w-full bg-[#1e1e1e] rounded-lg overflow-hidden relative">
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#1e1e1e] z-10">
                    <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
                </div>
            )}
            <Editor
                height="100%"
                defaultLanguage={getLanguage(name)}
                value={content}
                theme="vs-dark"
                options={{
                    readOnly: true,
                    minimap: { enabled: true },
                    fontSize: 14,
                    scrollBeyondLastLine: false,
                    padding: { top: 16 },
                }}
            />
        </div>
    )
}
