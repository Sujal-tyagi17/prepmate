"use client";

import React, { useEffect, useRef, useState } from "react";
import { Video, VideoOff } from "lucide-react";
import InterviewerAvatar, { type InterviewerState } from "./InterviewerAvatar";

interface Props {
    state: InterviewerState;
    speechPulse: number;
    nodSignal: number;
    /** Text currently being spoken (live captions). */
    caption: string;
    /** Character index reached in the caption (from speech boundary events), -1 if unknown. */
    captionIndex: number;
    interviewerName?: string;
    className?: string;
}

const STATUS: Record<InterviewerState, { label: string; dot: string }> = {
    speaking: { label: "Speaking", dot: "bg-purple-400" },
    listening: { label: "Listening", dot: "bg-green-400" },
    thinking: { label: "Thinking…", dot: "bg-yellow-400" },
    idle: { label: "Ready", dot: "bg-gray-400" },
};

/** Video-call style tile: animated interviewer, name tag, status, captions and optional self-view. */
export default function InterviewStage({ state, speechPulse, nodSignal, caption, captionIndex, interviewerName = "Maya", className = "" }: Props) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [camOn, setCamOn] = useState(false);
    const [camError, setCamError] = useState("");

    const stopCam = () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setCamOn(false);
    };

    const toggleCam = async () => {
        if (camOn) return stopCam();
        setCamError("");
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 320, height: 240 }, audio: false });
            streamRef.current = stream;
            setCamOn(true);
        } catch {
            setCamError("Camera unavailable");
            setTimeout(() => setCamError(""), 3000);
        }
    };

    useEffect(() => {
        if (camOn && videoRef.current && streamRef.current) {
            videoRef.current.srcObject = streamRef.current;
            videoRef.current.play().catch(() => {});
        }
    }, [camOn]);

    useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

    const status = STATUS[state];
    const spoken = captionIndex >= 0 ? caption.slice(0, captionIndex) : "";
    const rest = captionIndex >= 0 ? caption.slice(captionIndex) : caption;

    return (
        <div className={`relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#1d1335] to-[#0f0a1c] ${className}`}>
            {/* soft "office" backdrop */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute right-[8%] top-[10%] w-[22%] h-[55%] rounded-lg bg-gradient-to-b from-purple-300/10 to-transparent" />
                <div className="absolute left-[6%] top-[18%] w-[16%] h-1 rounded bg-white/5" />
                <div className="absolute left-[6%] top-[30%] w-[12%] h-1 rounded bg-white/5" />
                <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/40 to-transparent" />
            </div>

            <InterviewerAvatar state={state} speechPulse={speechPulse} nodSignal={nodSignal}
                className="absolute inset-x-0 bottom-0 mx-auto h-full w-auto max-w-full" />

            {/* name tag */}
            <div className="absolute left-3 bottom-3 flex items-center gap-2 px-2.5 py-1 rounded-lg bg-black/50 backdrop-blur text-xs text-white">
                <span className="font-semibold">{interviewerName}</span>
                <span className="text-gray-400 hidden sm:inline">· AI Interviewer</span>
            </div>

            {/* status */}
            <div className="absolute left-3 top-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur text-[11px] text-gray-200" aria-live="polite">
                <span className={`w-1.5 h-1.5 rounded-full ${status.dot} ${state !== "idle" ? "animate-pulse" : ""}`} />
                {status.label}
            </div>

            {/* camera toggle + self view */}
            <button onClick={toggleCam} title={camOn ? "Turn camera off" : "Show yourself (camera is only shown to you, never recorded)"}
                aria-label={camOn ? "Turn camera off" : "Turn camera on"}
                className={`absolute right-3 top-3 p-2 rounded-full backdrop-blur border transition-all ${camOn ? "bg-purple-500/30 border-purple-400/40 text-white" : "bg-black/40 border-white/10 text-gray-300 hover:text-white"}`}>
                {camOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
            </button>
            {camError && <div className="absolute right-3 top-12 text-[11px] text-red-300 bg-black/60 px-2 py-1 rounded">{camError}</div>}
            {camOn && (
                <video ref={videoRef} muted playsInline
                    className="absolute right-3 bottom-3 w-24 sm:w-32 aspect-[4/3] object-cover rounded-xl border border-white/20 shadow-lg -scale-x-100 bg-black" />
            )}

            {/* live captions */}
            {caption && (
                <div className="absolute inset-x-3 sm:inset-x-10 bottom-12 flex justify-center pointer-events-none">
                    <p className="max-w-xl px-3 py-1.5 rounded-lg bg-black/65 backdrop-blur text-[13px] sm:text-sm leading-snug text-center line-clamp-3">
                        <span className="text-white">{spoken}</span><span className={captionIndex >= 0 ? "text-gray-400" : "text-white"}>{rest}</span>
                    </p>
                </div>
            )}
        </div>
    );
}
