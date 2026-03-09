"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ExternalLink, Loader2 } from "lucide-react";

interface LinkPreviewProps {
    url: string;
}

interface Metadata {
    title?: string;
    description?: string;
    image?: string;
    siteName?: string;
}

export function LinkPreview({ url }: LinkPreviewProps) {
    const [metadata, setMetadata] = useState<Metadata | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        let isMounted = true;

        async function fetchMetadata() {
            if (typeof window === "undefined" || !url || url.length < 5) {
                setLoading(false);
                setError(true);
                return;
            }

            try {
                setLoading(true);
                const res = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`);
                if (!res.ok) throw new Error("Failed to fetch");
                const data = await res.json();
                if (isMounted) {
                    setMetadata(data);
                    setError(false);
                }
            } catch (err) {
                if (isMounted) setError(true);
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        fetchMetadata();
        return () => {
            isMounted = false;
        };
    }, [url]);

    if (loading) {
        return (
            <div className="flex items-center gap-2 p-3 mt-2 rounded-lg bg-slate-800/50 border border-slate-700 w-full max-w-sm">
                <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                <span className="text-xs text-slate-400">Loading preview...</span>
            </div>
        );
    }

    if (error || !metadata || (!metadata.title && !metadata.description)) {
        return null; // Don't show anything on error or if no useful metadata found
    }

    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="block mt-2 rounded-xl overflow-hidden bg-slate-800/80 border border-slate-700 hover:border-cyan-500/50 transition-colors group max-w-md"
        >
            {metadata.image && (
                <div className="relative aspect-video w-full overflow-hidden border-b border-slate-700">
                    <img
                        src={metadata.image}
                        alt={metadata.title || "Preview"}
                        className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105"
                    />
                </div>
            )}
            <div className="p-3 space-y-1">
                {metadata.siteName && (
                    <span className="text-[10px] uppercase tracking-wider text-cyan-400 font-semibold block">
                        {metadata.siteName}
                    </span>
                )}
                <h3 className="text-sm font-semibold text-slate-100 line-clamp-1 group-hover:text-cyan-400 transition-colors">
                    {metadata.title || url}
                </h3>
                {metadata.description && (
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                        {metadata.description}
                    </p>
                )}
                <div className="flex items-center gap-1.5 pt-1 text-[10px] text-slate-500 transition-colors group-hover:text-slate-400">
                    <ExternalLink className="w-3 h-3" />
                    <span className="truncate">{url}</span>
                </div>
            </div>
        </a>
    );
}
