"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export const DEMO_VIDEO_SRC = "/demo/prepmate-demo.mp4";
const POSTER = "/demo/prepmate-demo-poster.jpg";

/** Full-screen modal that plays the product walkthrough video. */
export default function DemoVideoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    const closeRef = useRef<HTMLButtonElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (!open) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", onKey);
        closeRef.current?.focus();
        videoRef.current?.play().catch(() => { /* user can press play */ });
        return () => {
            document.body.style.overflow = prev;
            window.removeEventListener("keydown", onKey);
        };
    }, [open, onClose]);

    if (!open || typeof document === "undefined") return null;

    // Portal to <body> so animated/transformed parent sections can't affect fixed positioning
    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-8" role="dialog" aria-modal="true" aria-label="PrepMate demo video">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-5xl">
                <div className="flex items-center justify-between mb-2 px-1">
                    <p className="text-sm text-gray-300">PrepMate Demo</p>
                    <button ref={closeRef} onClick={onClose} aria-label="Close demo video"
                        className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <video
                    ref={videoRef}
                    src={DEMO_VIDEO_SRC}
                    poster={POSTER}
                    controls
                    autoPlay
                    muted
                    playsInline
                    preload="metadata"
                    className="w-full rounded-2xl border border-white/10 shadow-2xl shadow-purple-900/40 bg-black"
                >
                    Your browser can&apos;t play this video. <a href={DEMO_VIDEO_SRC}>Download it</a> instead.
                </video>
            </div>
        </div>,
        document.body
    );
}
