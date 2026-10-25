"use client";

import React, { useEffect, useRef } from "react";

export type InterviewerState = "idle" | "speaking" | "listening" | "thinking";

interface Props {
    state: InterviewerState;
    /** Increment on every spoken word boundary to drive lip-sync. */
    speechPulse?: number;
    /** Increment while the candidate is speaking to trigger a small nod. */
    nodSignal?: number;
    className?: string;
}

const SKIN = "#c68a64";
const SKIN_SHADE = "#a96f4c";
const HAIR = "#2b1b16";
const BLAZER = "#2c3150";
const BLAZER_DARK = "#20243d";
const SHIRT = "#ece9f3";
const LIP = "#a4515a";
const MOUTH = "#4a1823";
const IRIS = "#3b2416";

/**
 * Original, illustrated AI interviewer ("Maya"). Animation runs in a single
 * requestAnimationFrame loop that writes SVG attributes directly (no React
 * re-render per frame).
 */
export default function InterviewerAvatar({ state, speechPulse = 0, nodSignal = 0, className = "" }: Props) {
    const headRef = useRef<SVGGElement>(null);
    const bodyRef = useRef<SVGGElement>(null);
    const mouthRef = useRef<SVGEllipseElement>(null);
    const teethRef = useRef<SVGRectElement>(null);
    const lowerLipRef = useRef<SVGPathElement>(null);
    const eyeLRef = useRef<SVGEllipseElement>(null);
    const eyeRRef = useRef<SVGEllipseElement>(null);
    const irisLRef = useRef<SVGGElement>(null);
    const irisRRef = useRef<SVGGElement>(null);
    const browLRef = useRef<SVGPathElement>(null);
    const browRRef = useRef<SVGPathElement>(null);
    const lidLRef = useRef<SVGPathElement>(null);
    const lidRRef = useRef<SVGPathElement>(null);

    const stateRef = useRef(state);
    const pulseRef = useRef(0);
    const nodRef = useRef(0);
    useEffect(() => { stateRef.current = state; }, [state]);
    useEffect(() => { pulseRef.current = performance.now(); }, [speechPulse]);
    useEffect(() => { if (nodSignal) nodRef.current = performance.now(); }, [nodSignal]);

    useEffect(() => {
        const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        let raf = 0;
        let mouth = 0, mouthTarget = 0, nextMouthChange = 0;
        let nextBlink = performance.now() + 1500, blinkUntil = 0;
        let gazeX = 0, gazeY = 0, gazeTX = 0, gazeTY = 0, nextGaze = 0;
        let tilt = 0, brow = 0;

        const frame = (now: number) => {
            const t = now / 1000;
            const st = stateRef.current;

            // --- mouth (lip-sync) ---
            if (st === "speaking") {
                if (now - pulseRef.current < 90) mouthTarget = 0.75 + Math.random() * 0.25; // word boundary
                else if (now > nextMouthChange) {
                    mouthTarget = Math.random() < 0.18 ? 0.08 : 0.2 + Math.random() * 0.75;
                    nextMouthChange = now + 70 + Math.random() * 90;
                }
            } else mouthTarget = 0;
            mouth += (mouthTarget - mouth) * 0.35;

            // --- blinking ---
            if (now > nextBlink) {
                blinkUntil = now + 130;
                nextBlink = now + 2200 + Math.random() * 3800 + (Math.random() < 0.15 ? -1900 : 0); // occasional double blink
            }
            const eyeOpen = now < blinkUntil ? 0.08 : st === "thinking" ? 0.85 : 1;

            // --- gaze ---
            if (now > nextGaze) {
                if (st === "thinking") { gazeTX = 2.6; gazeTY = -2.6; }
                else if (st === "listening") { gazeTX = (Math.random() - 0.5) * 1.2; gazeTY = 0.4; }
                else if (st === "speaking") { gazeTX = (Math.random() - 0.5) * 1.6; gazeTY = (Math.random() - 0.5) * 0.8; }
                else { gazeTX = (Math.random() - 0.5) * 3; gazeTY = (Math.random() - 0.5) * 1.5; }
                nextGaze = now + (st === "thinking" ? 900 : 700 + Math.random() * 1800);
            }
            gazeX += (gazeTX - gazeX) * 0.12; gazeY += (gazeTY - gazeY) * 0.12;

            // --- head pose ---
            const tiltTarget = st === "listening" ? 4 : st === "thinking" ? -3 : 0;
            tilt += (tiltTarget - tilt) * 0.05;
            const sway = reduce ? 0 : Math.sin(t / 1.9) * 1.1 + (st === "speaking" ? Math.sin(t * 2.3) * 0.8 : 0);
            const nodAge = now - nodRef.current;
            const nod = !reduce && nodAge < 650 ? Math.sin((nodAge / 650) * Math.PI * 2) * 3 : 0;
            const breathe = reduce ? 1 : 1 + Math.sin(t / 1.35) * 0.007;

            const browTarget = st === "thinking" ? -3.5 : st === "speaking" && now - pulseRef.current < 200 && Math.random() < 0.04 ? -2.5 : 0;
            brow += (browTarget - brow) * 0.15;

            headRef.current?.setAttribute("transform", `translate(0 ${nod.toFixed(2)}) rotate(${(tilt + sway).toFixed(2)} 200 205)`);
            bodyRef.current?.setAttribute("transform", `translate(200 300) scale(1 ${breathe.toFixed(4)}) translate(-200 -300)`);

            const open = Math.max(0, mouth);
            mouthRef.current?.setAttribute("ry", (1.2 + open * 9).toFixed(2));
            mouthRef.current?.setAttribute("rx", (12 - open * 2.5).toFixed(2));
            teethRef.current?.setAttribute("opacity", open > 0.35 ? "0.9" : "0");
            lowerLipRef.current?.setAttribute("transform", `translate(0 ${(open * 8).toFixed(2)})`);

            const ry = (5.2 * eyeOpen).toFixed(2);
            eyeLRef.current?.setAttribute("ry", ry);
            eyeRRef.current?.setAttribute("ry", ry);
            const lidY = ((1 - eyeOpen) * 5.5).toFixed(2);
            lidLRef.current?.setAttribute("transform", `translate(0 ${lidY})`);
            lidRRef.current?.setAttribute("transform", `translate(0 ${lidY})`);
            const irisT = `translate(${gazeX.toFixed(2)} ${gazeY.toFixed(2)})`;
            irisLRef.current?.setAttribute("transform", irisT);
            irisRRef.current?.setAttribute("transform", irisT);
            irisLRef.current?.setAttribute("opacity", eyeOpen < 0.3 ? "0" : "1");
            irisRRef.current?.setAttribute("opacity", eyeOpen < 0.3 ? "0" : "1");
            browLRef.current?.setAttribute("transform", `translate(0 ${brow.toFixed(2)})`);
            browRRef.current?.setAttribute("transform", `translate(0 ${brow.toFixed(2)})`);

            raf = requestAnimationFrame(frame);
        };
        raf = requestAnimationFrame(frame);
        return () => cancelAnimationFrame(raf);
    }, []);

    return (
        <svg viewBox="0 0 400 300" className={className} role="img" aria-label={`AI interviewer Maya, ${state}`} preserveAspectRatio="xMidYMax meet">
            <defs>
                <radialGradient id="pm-face" cx="45%" cy="40%" r="65%">
                    <stop offset="0%" stopColor="#d79a73" />
                    <stop offset="100%" stopColor={SKIN} />
                </radialGradient>
                <linearGradient id="pm-blazer" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={BLAZER} />
                    <stop offset="100%" stopColor={BLAZER_DARK} />
                </linearGradient>
            </defs>

            {/* Body */}
            <g ref={bodyRef}>
                <path d="M70 300 C 78 250, 120 228, 165 220 L 235 220 C 280 228, 322 250, 330 300 Z" fill="url(#pm-blazer)" />
                {/* shirt */}
                <path d="M170 221 L 200 268 L 230 221 Z" fill={SHIRT} />
                {/* lapels */}
                <path d="M165 220 L 200 270 L 186 300 L 150 300 L 158 252 Z" fill={BLAZER_DARK} opacity="0.85" />
                <path d="M235 220 L 200 270 L 214 300 L 250 300 L 242 252 Z" fill={BLAZER_DARK} opacity="0.85" />
                {/* neck */}
                <path d="M182 186 L 182 222 Q 200 236 218 222 L 218 186 Z" fill={SKIN_SHADE} />
            </g>

            {/* Head */}
            <g ref={headRef}>
                {/* hair back */}
                <path d="M138 128 C 132 70, 175 52, 204 54 C 238 55, 270 76, 264 132 C 268 168, 262 196, 250 210 L 150 210 C 138 194, 134 166, 138 128 Z" fill={HAIR} />
                {/* ears */}
                <ellipse cx="151" cy="138" rx="7" ry="11" fill={SKIN_SHADE} />
                <ellipse cx="249" cy="138" rx="7" ry="11" fill={SKIN_SHADE} />
                {/* face */}
                <path d="M152 120 C 152 84, 175 70, 200 70 C 225 70, 248 84, 248 120 C 248 160, 232 190, 200 196 C 168 190, 152 160, 152 120 Z" fill="url(#pm-face)" />
                {/* cheeks */}
                <ellipse cx="172" cy="152" rx="10" ry="6" fill="#d9786f" opacity="0.18" />
                <ellipse cx="228" cy="152" rx="10" ry="6" fill="#d9786f" opacity="0.18" />
                {/* hair front / fringe */}
                <path d="M150 118 C 150 82, 178 62, 206 64 C 236 66, 254 88, 252 116 C 238 98, 222 88, 198 86 C 182 98, 166 108, 150 118 Z" fill={HAIR} />

                {/* brows */}
                <path ref={browLRef} d="M166 112 Q 176 106 188 110" stroke={HAIR} strokeWidth="3.2" strokeLinecap="round" fill="none" />
                <path ref={browRRef} d="M212 110 Q 224 106 234 112" stroke={HAIR} strokeWidth="3.2" strokeLinecap="round" fill="none" />

                {/* eyes */}
                <ellipse ref={eyeLRef} cx="177" cy="126" rx="8" ry="5.2" fill="#fbf8f6" />
                <ellipse ref={eyeRRef} cx="223" cy="126" rx="8" ry="5.2" fill="#fbf8f6" />
                <g ref={irisLRef}><circle cx="177" cy="126" r="4" fill={IRIS} /><circle cx="178.3" cy="124.6" r="1.2" fill="#fff" opacity="0.9" /></g>
                <g ref={irisRRef}><circle cx="223" cy="126" r="4" fill={IRIS} /><circle cx="224.3" cy="124.6" r="1.2" fill="#fff" opacity="0.9" /></g>
                {/* upper lids (lashes line) */}
                <path ref={lidLRef} d="M168 122.5 Q 177 117.5 186 122.5" stroke="#3a2620" strokeWidth="2" fill="none" strokeLinecap="round" />
                <path ref={lidRRef} d="M214 122.5 Q 223 117.5 232 122.5" stroke="#3a2620" strokeWidth="2" fill="none" strokeLinecap="round" />

                {/* nose */}
                <path d="M200 132 Q 197 146 193 152 Q 200 156 207 152" stroke={SKIN_SHADE} strokeWidth="2" fill="none" strokeLinecap="round" />

                {/* mouth */}
                <ellipse ref={mouthRef} cx="200" cy="169" rx="12" ry="1.2" fill={MOUTH} />
                <rect ref={teethRef} x="191" y="164.5" width="18" height="3.2" rx="1.5" fill="#fff" opacity="0" />
                <path d="M186 167 Q 193 163 200 165 Q 207 163 214 167" stroke={LIP} strokeWidth="2.6" fill="none" strokeLinecap="round" />
                <path ref={lowerLipRef} d="M188 171 Q 200 176 212 171" stroke={LIP} strokeWidth="2.6" fill="none" strokeLinecap="round" />
            </g>
        </svg>
    );
}
