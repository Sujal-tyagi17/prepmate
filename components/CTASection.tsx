"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Play, Sparkles } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import DemoVideoModal from "@/components/DemoVideoModal";

function useInView(threshold = 0.2) {
    const ref = useRef<HTMLDivElement>(null);
    const [inView, setInView] = useState(false);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const obs = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting) { setInView(true); obs.disconnect(); } },
            { threshold }
        );
        obs.observe(el);
        return () => obs.disconnect();
    }, [threshold]);
    return { ref, inView };
}

const TRUST_LABELS = [
    "No credit card required",
    "Free forever",
    "Practice unlimited",
];

export default function CTASection() {
    const { ref, inView } = useInView(0.15);
    const { isSignedIn } = useAuth();
    const router = useRouter();
    const reduce = useReducedMotion();

    const handleStart = () => {
        window.dispatchEvent(new CustomEvent("pm:navstart"));
        router.push(isSignedIn ? "/dashboard" : "/sign-up");
    };
    const [demoOpen, setDemoOpen] = useState(false);
    const handleWatchDemo = () => setDemoOpen(true);

    return (
        <section className="relative py-28 px-6 overflow-hidden bg-[#0a0514]">
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] rounded-full opacity-[0.18]"
                    style={{ background: "radial-gradient(ellipse, #7c3aed, transparent 70%)", filter: "blur(80px)" }} />
                <div className="absolute top-0 right-0 w-[400px] h-[300px] rounded-full opacity-[0.12]"
                    style={{ background: "radial-gradient(ellipse, #ec4899, transparent 70%)", filter: "blur(60px)" }} />
                <div className="absolute bottom-0 left-0 w-[350px] h-[250px] rounded-full opacity-[0.10]"
                    style={{ background: "radial-gradient(ellipse, #06b6d4, transparent 70%)", filter: "blur(60px)" }} />
            </div>

            <div ref={ref} className="relative z-10 max-w-4xl mx-auto">
                <motion.div
                    initial={{ opacity: 0, y: 40, scale: 0.97 }}
                    animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
                    transition={{ duration: reduce ? 0 : 0.65, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
                    className="relative rounded-3xl overflow-hidden"
                    style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.08), rgba(236,72,153,0.06), rgba(6,182,212,0.05))" }}
                >
                    <div className="absolute inset-0 rounded-3xl pointer-events-none"
                        style={{ boxShadow: "inset 0 0 0 1px rgba(139,92,246,0.25)" }} />
                    <div className="absolute top-0 left-0 right-0 h-px"
                        style={{ background: "linear-gradient(to right, transparent 0%, rgba(139,92,246,0.8) 25%, rgba(236,72,153,0.6) 50%, rgba(6,182,212,0.6) 75%, transparent 100%)" }} />

                    <div className="relative px-8 py-16 sm:px-16 text-center backdrop-blur-sm">
                        <motion.h2
                            initial={{ opacity: 0, y: 20 }}
                            animate={inView ? { opacity: 1, y: 0 } : {}}
                            transition={{ duration: reduce ? 0 : 0.55, delay: 0.18 }}
                            className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-[1.1] tracking-tight mb-6"
                        >
                            Ready to Ace Your{" "}
                            <span className="bg-gradient-to-r from-purple-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">
                                Next Interview?
                            </span>
                        </motion.h2>

                        <motion.p
                            initial={{ opacity: 0, y: 15 }}
                            animate={inView ? { opacity: 1, y: 0 } : {}}
                            transition={{ duration: reduce ? 0 : 0.5, delay: 0.28 }}
                            className="text-lg sm:text-xl text-gray-400 leading-relaxed max-w-xl mx-auto mb-12"
                        >
                            Built by a student, for students.{" "}
                            <span className="text-gray-200">PrepMate helps you practice interviews</span>{" "}
                            anytime, anywhere.
                        </motion.p>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={inView ? { opacity: 1, y: 0 } : {}}
                            transition={{ duration: reduce ? 0 : 0.5, delay: 0.38 }}
                            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10"
                        >
                            <motion.button
                                onClick={handleStart}
                                whileHover={{ scale: 1.04, boxShadow: "0 0 36px rgba(139,92,246,0.55)" }}
                                whileTap={{ scale: 0.97 }}
                                className="flex items-center gap-3 px-9 py-4 rounded-2xl text-base font-bold text-white"
                                style={{ background: "linear-gradient(135deg, #7c3aed 0%, #a855f7 40%, #ec4899 100%)", boxShadow: "0 0 20px rgba(139,92,246,0.35)" }}
                            >
                                <Sparkles style={{ width: 18, height: 18 }} />
                                Start Free Practice
                                <ArrowRight className="w-4 h-4" />
                            </motion.button>
                            <motion.button
                                onClick={handleWatchDemo}
                                whileHover={{ scale: 1.04 }}
                                whileTap={{ scale: 0.97 }}
                                className="flex items-center gap-3 px-9 py-4 rounded-2xl text-base font-semibold text-gray-300 border border-white/10 hover:border-purple-500/40 hover:text-white transition-colors duration-200"
                            >
                                <Play className="w-4 h-4" />
                                Watch Demo
                            </motion.button>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={inView ? { opacity: 1 } : {}}
                            transition={{ duration: reduce ? 0 : 0.5, delay: 0.52 }}
                            className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2"
                        >
                            {TRUST_LABELS.map((label, i) => (
                                <span key={i} className="flex items-center gap-1.5 text-sm text-gray-500">
                                    <span className="w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                                        <svg className="w-2.5 h-2.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                    </span>
                                    {label}
                                    {i < TRUST_LABELS.length - 1 && <span className="ml-4 text-gray-700 hidden sm:inline">•</span>}
                                </span>
                            ))}
                        </motion.div>
                    </div>
                </motion.div>
            </div>
        <DemoVideoModal open={demoOpen} onClose={() => setDemoOpen(false)} />
        </section>
    );
}
