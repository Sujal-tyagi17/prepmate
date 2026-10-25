"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles, Twitter, Linkedin, Github, Instagram, Mail, ArrowRight, MapPin, Heart } from "lucide-react";

/* ─── Data ───────────────────────────────────────────────────── */
const NAV_COLUMNS = [
    {
        heading: "Product",
        links: [
            { label: "Features", href: "#features" },
            { label: "How It Works", href: "#how-it-works" },
            { label: "Success Stories", href: "#" },
            { label: "Roadmap", href: "#" },
            { label: "Changelog", href: "#" },
        ],
    },
    {
        heading: "Resources",
        links: [
            { label: "Blog", href: "#", badge: "Soon" },
            { label: "Interview Tips", href: "#" },
            { label: "Resume Templates", href: "#" },
            { label: "Career Guides", href: "#" },
            { label: "Help Center", href: "#" },
        ],
    },
    {
        heading: "Company",
        links: [
            { label: "About Us", href: "#about" },
            { label: "Contact", href: "#" },
            { label: "Privacy Policy", href: "#" },
            { label: "Terms of Service", href: "#" },
            { label: "Careers", href: "#", badge: "Hiring!" },
        ],
    },
] as const;

const SOCIALS = [
    {
        label: "Twitter / X",
        href: "https://twitter.com",
        icon: Twitter,
        glow: "#1DA1F2",
    },
    {
        label: "LinkedIn",
        href: "https://linkedin.com",
        icon: Linkedin,
        glow: "#0A66C2",
    },
    {
        label: "GitHub",
        href: "https://github.com",
        icon: Github,
        glow: "#ffffff",
    },
    {
        label: "Instagram",
        href: "https://instagram.com",
        icon: Instagram,
        glow: "#E1306C",
    },
];

const NEWSLETTER_TRUST = [
    "Free forever",
    "Unsubscribe anytime",
    "No spam",
];

/* ─── Newsletter ───────────────────────────────────────────────── */
function Newsletter() {
    const [email, setEmail] = useState("");
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;
        setSubmitted(true);
        setEmail("");
    };

    return (
        <div className="relative rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.08), rgba(236,72,153,0.05))", boxShadow: "inset 0 0 0 1px rgba(139,92,246,0.18)" }}>
            {/* Glow blobs */}
            <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-[0.10] pointer-events-none"
                style={{ background: "radial-gradient(ellipse, #A855F7, transparent 70%)", filter: "blur(50px)" }} />
            <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full opacity-[0.07] pointer-events-none"
                style={{ background: "radial-gradient(ellipse, #06b6d4, transparent 70%)", filter: "blur(40px)" }} />

            <div className="relative z-10 px-5 sm:px-8 py-7 sm:py-10">
                {/* Icon + heading */}
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center flex-shrink-0">
                        <Mail className="w-4 h-4 text-purple-400" />
                    </div>
                    <h3 className="text-lg font-bold text-white">Get Interview Tips</h3>
                </div>

                {/* Description */}
                <p className="text-sm text-gray-400 leading-relaxed mb-6 max-w-md">
                    Be the first to receive weekly interview strategies,
                    practice questions, and career resources.
                </p>

                {/* Input row or success */}
                {submitted ? (
                    <div className="flex items-center gap-2.5 px-5 py-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-400 font-medium w-fit">
                        <span>🎉</span> You&apos;re in! Check your inbox soon.
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2.5 w-full sm:max-w-md">
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="Your email address..."
                            className="flex-1 px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white placeholder-gray-600 outline-none focus:border-purple-500/40 focus:bg-white/[0.07] transition-all"
                            required
                        />
                        <motion.button
                            type="submit"
                            whileHover={{ scale: 1.04, boxShadow: "0 0 20px rgba(139,92,246,0.45)" }}
                            whileTap={{ scale: 0.97 }}
                            className="flex items-center justify-center gap-1.5 px-5 py-3 min-h-[48px] rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 text-sm font-semibold text-white shadow-lg shadow-purple-500/20 flex-shrink-0 w-full sm:w-auto"
                        >
                            Subscribe
                            <ArrowRight className="w-3.5 h-3.5" />
                        </motion.button>
                    </form>
                )}

                {/* Trust badges */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-4">
                    {NEWSLETTER_TRUST.map((label, i) => (
                        <span key={i} className="flex items-center gap-1.5 text-xs text-gray-600">
                            <span className="text-emerald-500">✓</span>
                            {label}
                            {i < NEWSLETTER_TRUST.length - 1 && (
                                <span className="ml-2 text-gray-700">•</span>
                            )}
                        </span>
                    ))}
                </div>
                <p className="mt-2 text-[10px] text-gray-700 opacity-60">🔒 100% privacy guaranteed — we never share your data.</p>
            </div>
        </div>
    );
}

/* ─── Footer link ──────────────────────────────────────────────── */
function FooterLink({ label, href, badge }: { label: string; href: string; badge?: string }) {
    const isExternal = href.startsWith("http");
    const isHash = href.startsWith("#");

    const inner = (
        <motion.span
            className="relative inline-flex items-center gap-2 text-sm text-gray-500 group-hover:text-white transition-colors duration-200"
            whileHover={{ x: 3 }}
            transition={{ duration: 0.15 }}
        >
            {label}
            {badge && (
                <span
                    className="px-1.5 py-0.5 rounded text-[10px] font-semibold leading-none"
                    style={{
                        background: badge === "Soon"
                            ? "rgba(139,92,246,0.15)"
                            : badge === "Hiring!"
                            ? "rgba(16,185,129,0.12)"
                            : "rgba(139,92,246,0.15)",
                        border: badge === "Soon"
                            ? "1px solid rgba(139,92,246,0.4)"
                            : badge === "Hiring!"
                            ? "1px solid rgba(16,185,129,0.35)"
                            : "1px solid rgba(139,92,246,0.4)",
                        color: badge === "Soon" ? "#c4b5fd" : badge === "Hiring!" ? "#6ee7b7" : "#c4b5fd",
                        boxShadow: badge === "Soon" ? "0 0 8px rgba(139,92,246,0.25)" : "none",
                    }}
                >
                    {badge}
                </span>
            )}
            <span className="absolute -bottom-px left-0 h-px w-0 group-hover:w-full bg-gradient-to-r from-purple-400 to-fuchsia-400 transition-all duration-300" />
        </motion.span>
    );

    if (isHash) {
        return (
            <a href={href} className="group block">
                {inner}
            </a>
        );
    }

    return isExternal ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className="group block">
            {inner}
        </a>
    ) : (
        <Link href={href} className="group block">
            {inner}
        </Link>
    );
}

/* ─── Social icon ──────────────────────────────────────────────── */
function SocialIcon({ href, icon: Icon, label, glow }: (typeof SOCIALS)[number]) {
    return (
        <motion.a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={label}
            whileHover={{ scale: 1.15, boxShadow: `0 0 16px ${glow}50` }}
            whileTap={{ scale: 0.92 }}
            transition={{ duration: 0.18 }}
            className="w-11 h-11 sm:w-9 sm:h-9 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/[0.1] hover:border-white/20 transition-colors duration-200"
        >
            <Icon className="w-4 h-4" strokeWidth={1.75} />
        </motion.a>
    );
}

/* ─── Main Footer ──────────────────────────────────────────────── */
export default function Footer() {
    return (
        <footer className="relative pt-0 pb-0 overflow-hidden bg-[#070312]">

            {/* Top gradient border */}
            <div className="h-px w-full"
                style={{ background: "linear-gradient(to right, transparent, rgba(139,92,246,0.6), rgba(236,72,153,0.4), transparent)" }} />

            {/* Subtle background blobs */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute bottom-0 left-1/4 w-[500px] h-[300px] rounded-full opacity-[0.04]"
                    style={{ background: "radial-gradient(ellipse, #7c3aed, transparent 70%)", filter: "blur(60px)" }} />
                <div className="absolute top-0 right-1/4 w-[400px] h-[200px] rounded-full opacity-[0.03]"
                    style={{ background: "radial-gradient(ellipse, #06b6d4, transparent 70%)", filter: "blur(60px)" }} />
            </div>

            <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">

                {/* ── Newsletter ── */}
                <div className="pt-14 pb-10 border-b border-white/[0.05]">
                    <Newsletter />
                </div>

                {/* ── Main columns ── */}
                <div className="py-10 sm:py-12 grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-10 sm:gap-10 border-b border-white/[0.05]">

                    {/* Col 1: Logo + description */}
                    <div className="col-span-2 lg:col-span-1">
                        {/* Logo */}
                        <Link href="/" className="inline-flex items-center gap-2.5 mb-4 group">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-purple-500/30 group-hover:scale-105 transition-transform duration-200">
                                <Sparkles className="w-4.5 h-4.5 text-white" style={{ width: 18, height: 18 }} />
                            </div>
                            <span className="text-lg font-bold text-white">PrepMate</span>
                        </Link>

                        <p className="text-sm text-gray-500 leading-relaxed mb-6 max-w-[220px]">
                            Your AI Partner for Interview Success. Practice smarter. Land faster.
                        </p>

                        {/* Social icons */}
                        <div className="flex items-center gap-2">
                            {SOCIALS.map(s => (
                                <SocialIcon key={s.label} {...s} />
                            ))}
                        </div>
                    </div>

                    {/* Cols 2–4: Navigation */}
                    {NAV_COLUMNS.map(col => (
                        <div key={col.heading}>
                            <h4 className="text-sm font-semibold text-white mb-4 tracking-wide">{col.heading}</h4>
                            <ul className="space-y-3">
                                {col.links.map(link => (
                                    <li key={link.label}>
                                        <FooterLink label={link.label} href={link.href} badge={"badge" in link ? link.badge : undefined} />
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                {/* ── Bottom bar ── */}
                <div className="py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600">
                    <span>© 2026 PrepMate. All rights reserved.</span>

                    <div className="flex items-center gap-1.5">
                        <span>Built with</span>
                        <Heart className="w-3 h-3 text-rose-500 fill-rose-500" />
                        <span>by</span>
                        <a
                            href="https://linkedin.com/in/sujal-tyagi"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium bg-gradient-to-r from-purple-400 to-fuchsia-400 bg-clip-text text-transparent hover:from-purple-300 hover:to-pink-300 transition-all duration-200"
                        >
                            Sujal Tyagi
                        </a>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 text-gray-600" />
                        <span>Made in India 🇮🇳</span>
                    </div>
                </div>

            </div>
        </footer>
    );
}
