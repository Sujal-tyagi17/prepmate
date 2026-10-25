"use client";

import React, { useState, useEffect, useRef, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    ArrowLeft, CheckCircle, ChevronDown, ChevronUp, Share2,
    Download, RefreshCcw, TrendingUp, MessageSquare, Clock, Star,
    BarChart2, Zap, Award, X, Sparkles
} from "lucide-react";
import { answeredScores, interviewScore } from "@/lib/scoring";

interface QuestionBreakdown {
    question_text: string;
    user_answer: string;
    score: number;
    feedback?: string;
    strengths?: string[];
    improvements?: string[];
}

export default function FeedbackPage({ params }: { params: { id: string } }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [interview, setInterview] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [openSection, setOpenSection] = useState<string | null>("strengths");
    const [showConfetti, setShowConfetti] = useState(false);
    const [copied, setCopied] = useState(false);
    const confettiRef = useRef<boolean>(false);
    const [isPending, startTransition] = useTransition();
    const [navigatingTo, setNavigatingTo] = useState<string | null>(null);

    useEffect(() => {
        fetchInterview();
    }, [params.id]);

    useEffect(() => {
        if (!loading && !confettiRef.current && interview) {
            confettiRef.current = true;
            if (searchParams.get('print') === 'true') {
                // Auto-trigger print dialog for PDF download
                setTimeout(() => window.print(), 800);
            } else {
                setTimeout(() => setShowConfetti(true), 300);
                setTimeout(() => setShowConfetti(false), 3000);
            }
        }
    }, [loading, interview, searchParams]);

    const fetchInterview = async () => {
        try {
            const res = await fetch(`/api/interview/${params.id}`);
            const data = await res.json();
            if (data.success) {
                setInterview(data.interview);
            } else {
                router.push("/dashboard");
            }
        } catch {
            router.push("/dashboard");
        } finally {
            setLoading(false);
        }
    };

    const handleNav = (href: string) => {
        setNavigatingTo(href);
        startTransition(() => {
            router.push(href);
        });
    };

    const handleShare = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch { }
    };

    const handleDownload = () => {
        window.print();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-[#0a0514]">
                <div className="flex flex-col items-center">
                    <div className="relative w-16 h-16 mb-5">
                        <div className="absolute inset-0 rounded-full border-2 border-purple-500/20" />
                        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-purple-400 animate-spin" />
                        <div className="absolute inset-2 rounded-full border-2 border-transparent border-t-fuchsia-400 animate-spin [animation-duration:0.6s] [animation-direction:reverse]" />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-2 h-2 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
                        </div>
                    </div>
                    <p className="text-base font-bold text-white">Loading...</p>
                    <p className="text-sm text-gray-400 mt-1">Please wait</p>
                </div>
            </div>
        );
    }

    if (!interview) return null;

    // Filter to only actually answered questions (exclude greeting, intro, unanswered, and "[No answer provided]")
    const allAnswers = interview.answers || [];
    const answers: QuestionBreakdown[] = allAnswers.filter((a: any) => 
        a.user_answer && 
        a.user_answer.trim().length > 0 && 
        a.user_answer !== "[No answer provided]"
    );
    
    const totalQuestions = allAnswers.length;
    const answeredCount = answers.length;
    const unansweredCount = totalQuestions - answeredCount;
    
    const scores = answeredScores(allAnswers);
    const finalScore = interviewScore(allAnswers); // same rule as analytics/history

    const circumference = 2 * Math.PI * 54;
    const offset = circumference - (finalScore / 100) * circumference;

    const getScoreColor = (score: number) => {
        if (score >= 80) return { text: "text-emerald-400", border: "border-emerald-500/40", bg: "bg-emerald-500/10" };
        if (score >= 60) return { text: "text-purple-400", border: "border-purple-500/40", bg: "bg-purple-500/10" };
        return { text: "text-orange-400", border: "border-orange-500/40", bg: "bg-orange-500/10" };
    };

    const scoreStyle = getScoreColor(finalScore);

    const scoreLabel = finalScore >= 85 ? "Outstanding" : finalScore >= 70 ? "Strong Performance" : finalScore >= 55 ? "Good Effort" : "Keep Practicing";
    const scoreEmoji = finalScore >= 85 ? "🏆" : finalScore >= 70 ? "🌟" : finalScore >= 55 ? "💪" : "🌱";

    // Aggregate REAL AI-generated strengths and improvements from all answers
    const allStrengths = answers.flatMap((a: any) => a.strengths || []);
    const allImprovements = answers.flatMap((a: any) => a.improvements || []);
    
    // Remove duplicates and filter out empty values
    const strengths = Array.from(new Set(allStrengths)).filter(s => s && s.trim());
    const improvements = Array.from(new Set(allImprovements)).filter(i => i && i.trim());
    
    // Fallback if no AI feedback was generated yet
    if (strengths.length === 0) {
        if (answeredCount === 0) {
            strengths.push("No questions were answered - please complete the interview to receive feedback");
        } else {
            strengths.push(`Completed ${answeredCount} out of ${totalQuestions} questions`);
        }
    }
    if (improvements.length === 0) {
        if (answeredCount === 0) {
            improvements.push("Answer interview questions to receive personalized AI feedback");
        } else if (unansweredCount > 0) {
            improvements.push(`Try to answer all ${totalQuestions} questions for complete feedback`);
        } else {
            improvements.push("Continue practicing to improve your interview skills");
        }
    }

    const avgWordCount = answers.length > 0
        ? Math.round(answers.reduce((sum: number, a: any) => sum + (a.user_answer?.split(" ").length || 0), 0) / answers.length)
        : 0;

    const percentile = finalScore >= 85 ? 92 : finalScore >= 70 ? 78 : finalScore >= 55 ? 55 : 30;

    return (
        <div className="min-h-screen bg-[#0a0514] text-white relative print:bg-white print:text-black">

            {/* Navigation loading overlay */}
            {navigatingTo && (
                <div className="fixed top-0 left-64 right-0 bottom-0 z-50 flex flex-col items-center justify-center bg-[#0a0514]/80 backdrop-blur-sm">
                    <div className="relative w-16 h-16 mb-5">
                        <div className="absolute inset-0 rounded-full border-2 border-purple-500/20" />
                        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-purple-400 animate-spin" />
                        <div className="absolute inset-2 rounded-full border-2 border-transparent border-t-fuchsia-400 animate-spin [animation-duration:0.6s] [animation-direction:reverse]" />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-2 h-2 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
                        </div>
                    </div>
                    <p className="text-base font-bold text-white">Loading...</p>
                    <p className="text-sm text-gray-400 mt-1">Please wait</p>
                </div>
            )}

            {/* Confetti animation */}
            {showConfetti && (
                <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
                    {Array.from({ length: 60 }).map((_, i) => (
                        <div
                            key={i}
                            className="absolute w-2 h-2 rounded-sm animate-confetti"
                            style={{
                                left: `${Math.random() * 100}%`,
                                top: "-10px",
                                backgroundColor: ["#a855f7", "#ec4899", "#22d3ee", "#10b981", "#f59e0b", "#6366f1"][Math.floor(Math.random() * 6)],
                                animationDelay: `${Math.random() * 2}s`,
                                animationDuration: `${2 + Math.random() * 2}s`,
                                transform: `rotate(${Math.random() * 360}deg)`,
                            }}
                        />
                    ))}
                </div>
            )}

            {/* Background glow */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full bg-purple-600/8 blur-[140px]" />
                <div className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] rounded-full bg-pink-600/6 blur-[120px]" />
            </div>

            {/* Top bar */}
            <div className="fixed top-0 left-64 right-0 z-30 print:hidden">
                {/* Thin rainbow glowline at very top */}
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/70 to-transparent" />

                {/* Glass layer */}
                <div className="bg-[#07030f]/95 backdrop-blur-2xl border-b border-white/8 shadow-[0_4px_32px_rgba(0,0,0,0.6)]">

                    {/* Main nav row */}
                    <div className="px-8 h-20 flex items-center">

                        {/* Left — back button, takes flex-1 and aligns start */}
                        <div className="flex-1 flex items-center justify-start">
                            <button
                                onClick={() => handleNav("/dashboard")}
                                className="group flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-white/10 bg-white/4 hover:bg-white/8 hover:border-purple-500/30 transition-all duration-200"
                            >
                                <ArrowLeft className="w-5 h-5 text-gray-400 group-hover:text-white group-hover:-translate-x-0.5 transition-all duration-200" />
                                <span className="text-base text-gray-400 group-hover:text-white transition-colors font-medium">Dashboard</span>
                            </button>
                        </div>

                        {/* Center — report title + meta, takes flex-1 and truly centers */}
                        <div className="flex-1 flex flex-col items-center justify-center select-none">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-purple-400" />
                                <span className="text-lg font-bold text-white tracking-wide whitespace-nowrap">Interview Feedback Report</span>
                                <Sparkles className="w-4 h-4 text-purple-400" />
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                                {interview.type && (
                                    <span className="text-sm text-gray-500 capitalize">{interview.type} interview</span>
                                )}
                                {interview.difficulty && (
                                    <>
                                        <span className="text-gray-700">·</span>
                                        <span className="text-sm text-gray-500 capitalize">{interview.difficulty} difficulty</span>
                                    </>
                                )}
                                {interview.created_at && (
                                    <>
                                        <span className="text-gray-700">·</span>
                                        <span className="text-sm text-gray-500">
                                            {new Date(interview.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Right — actions, takes flex-1 and aligns end */}
                        <div className="flex-1 flex items-center justify-end gap-3">
                            <button
                                onClick={handleShare}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/10 bg-white/4 text-base text-gray-300 font-medium hover:text-white hover:bg-white/8 hover:border-purple-500/30 transition-all duration-200"
                            >
                                <Share2 className="w-5 h-5" />
                                {copied ? "Copied!" : "Share"}
                            </button>
                            <button
                                onClick={handleDownload}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 text-base text-white font-semibold hover:from-purple-500 hover:to-violet-500 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all duration-200"
                            >
                                <Download className="w-5 h-5" />
                                Download
                            </button>
                        </div>

                    </div>

                </div>
            </div>

            {/* Spacer so content doesn't hide under fixed nav */}
            <div className="h-20 print:hidden" />

            <div className="max-w-4xl mx-auto px-6 py-10 relative z-10">

                {/* Hero score section */}
                <div className="text-center mb-12">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-purple-500/20 bg-purple-500/8 text-xs font-medium text-purple-300 mb-6">
                        <CheckCircle className="w-3.5 h-3.5 text-purple-400" />
                        Interview Complete {scoreEmoji}
                    </div>

                    {/* Big circular score */}
                    <div className="relative w-40 h-40 mx-auto mb-6">
                        <svg width="160" height="160" viewBox="0 0 160 160">
                            <circle cx="80" cy="80" r="54" fill="none" stroke="rgba(168,85,247,0.12)" strokeWidth="12" />
                            <circle cx="80" cy="80" r="54" fill="none"
                                stroke="url(#feedbackGrad)" strokeWidth="12" strokeLinecap="round"
                                strokeDasharray={circumference}
                                strokeDashoffset={offset}
                                transform="rotate(-90 80 80)"
                                style={{ transition: "stroke-dashoffset 1.5s ease-in-out" }}
                            />
                            <defs>
                                <linearGradient id="feedbackGrad" x1="0" y1="0" x2="1" y2="0">
                                    <stop offset="0%" stopColor="#a855f7" />
                                    <stop offset="100%" stopColor="#ec4899" />
                                </linearGradient>
                            </defs>
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className={`text-4xl font-bold ${scoreStyle.text}`}>{finalScore}%</span>
                            <span className="text-xs text-gray-500">Overall</span>
                        </div>
                    </div>

                    <h1 className="text-3xl font-bold text-white mb-2">{scoreLabel}</h1>
                    <p className="text-gray-500 text-sm mb-4">
                        {interview.type} interview · {interview.difficulty} difficulty
                        {interview.company ? ` · ${interview.company}` : ""}
                    </p>

                    {/* Percentile badge */}
                    <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border ${scoreStyle.border} ${scoreStyle.bg}`}>
                        <TrendingUp className={`w-3.5 h-3.5 ${scoreStyle.text}`} />
                        <span className={`text-sm font-medium ${scoreStyle.text}`}>Top {100 - percentile}% of all users</span>
                    </div>
                </div>

                {/* Unanswered Questions Warning */}
                {unansweredCount > 0 && (
                    <div className="rounded-2xl border border-orange-500/30 bg-orange-500/10 p-5 mb-8">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                                <MessageSquare className="w-5 h-5 text-orange-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-orange-300 mb-1">Incomplete Interview</h3>
                                <p className="text-sm text-gray-300 leading-relaxed">
                                    You answered <strong>{answeredCount}</strong> out of <strong>{totalQuestions}</strong> questions. 
                                    {unansweredCount === totalQuestions 
                                        ? " No questions were answered, so there's nothing to score yet — try another session and answer at least a few questions." 
                                        : ` ${unansweredCount} question${unansweredCount > 1 ? 's were' : ' was'} skipped — skipped questions aren't scored, so try answering every question for a fuller evaluation.`
                                    }
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* AI Overall Feedback Summary */}
                {interview.overall_feedback && (
                    <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-500/10 to-fuchsia-500/10 p-6 mb-8">
                        <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                            <MessageSquare className="w-4 h-4 text-purple-400" /> AI Interview Summary
                        </h3>
                        <p className="text-gray-300 text-sm leading-relaxed">
                            {interview.overall_feedback}
                        </p>
                    </div>
                )}

                {/* Metrics row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                    {[
                        { label: "Answered", value: `${answeredCount}/${totalQuestions}`, icon: MessageSquare, color: answeredCount === totalQuestions ? "text-emerald-400" : "text-orange-400" },
                        { label: "Avg Score", value: scores.length > 0 ? `${(scores.reduce((a: number, b: number) => a + b, 0) / scores.length).toFixed(1)}/10` : "N/A", icon: Star, color: "text-yellow-400" },
                        { label: "Avg Length", value: avgWordCount > 0 ? `${avgWordCount} words` : "N/A", icon: Clock, color: "text-blue-400" },
                        { label: "Percentile", value: `${percentile}th`, icon: Award, color: "text-emerald-400" },
                    ].map(({ label, value, icon: Icon, color }) => (
                        <div key={label} className="rounded-2xl p-4 border border-white/8 bg-white/3 text-center">
                            <Icon className={`w-4 h-4 ${color} mx-auto mb-2`} />
                            <div className="text-lg font-bold text-white">{value}</div>
                            <div className="text-xs text-gray-500 mt-0.5">{label}</div>
                        </div>
                    ))}
                </div>

                {/* Performance metrics bars - Only show if questions were answered */}
                {answeredCount > 0 && (
                    <div className="rounded-2xl border border-white/8 bg-white/3 p-6 mb-6">
                        <h3 className="font-semibold text-white mb-5 flex items-center gap-2">
                            <BarChart2 className="w-4 h-4 text-purple-400" /> Skill Breakdown
                        </h3>
                        <div className="space-y-4">
                            {[
                                { label: "Communication Clarity", score: Math.min(100, finalScore + 5) },
                                { label: "Technical Depth", score: Math.max(20, finalScore - 8) },
                                { label: "STAR Structure", score: Math.min(100, finalScore + 2) },
                                { label: "Response Conciseness", score: Math.max(20, finalScore - 3) },
                                { label: "Confidence Level", score: Math.min(100, finalScore + 10) },
                            ].map(({ label, score }) => (
                            <div key={label}>
                                <div className="flex justify-between mb-1.5">
                                    <span className="text-sm text-gray-400">{label}</span>
                                    <span className="text-sm font-medium text-white">{score}%</span>
                                </div>
                                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-gradient-to-r from-purple-500 to-fuchsia-600 transition-all duration-1000"
                                        style={{ width: `${score}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                        </div>
                    </div>
                )}

                {/* Comparison - Only show if questions were answered */}
                {answeredCount > 0 && (
                    <div className="rounded-2xl border border-white/8 bg-white/3 p-6 mb-6">
                        <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                            <Zap className="w-4 h-4 text-yellow-400" /> How You Compare
                        </h3>
                        <div className="grid grid-cols-3 gap-4">
                            {[
                                { label: "Your Score", value: `${finalScore}%`, highlight: true },
                                { label: "Platform Average", value: "68%" },
                                { label: "Top Performers", value: "89%" },
                            ].map(({ label, value, highlight }) => (
                                <div key={label} className={`rounded-xl p-4 text-center ${highlight ? "bg-purple-500/15 border border-purple-500/30" : "bg-white/3 border border-white/8"}`}>
                                    <div className={`text-2xl font-bold mb-1 ${highlight ? "text-purple-300" : "text-white"}`}>{value}</div>
                                    <div className="text-xs text-gray-500">{label}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Strengths & Improvements */}
                {[
                    { key: "strengths", label: "Strengths", items: strengths, color: "text-emerald-400", border: "border-emerald-500/20", bg: "bg-emerald-500/5", dot: "bg-emerald-400" },
                    { key: "improvements", label: "Areas to Improve", items: improvements, color: "text-orange-400", border: "border-orange-500/20", bg: "bg-orange-500/5", dot: "bg-orange-400" },
                ].map(({ key, label, items, color, border, bg, dot }) => (
                    <div key={key} className={`rounded-2xl border ${border} ${bg} mb-4 overflow-hidden`}>
                        <button
                            className="w-full flex items-center justify-between px-6 py-4"
                            onClick={() => setOpenSection(openSection === key ? null : key)}
                        >
                            <span className={`font-semibold ${color}`}>{label}</span>
                            {openSection === key
                                ? <ChevronUp className={`w-4 h-4 ${color}`} />
                                : <ChevronDown className="w-4 h-4 text-gray-500" />}
                        </button>
                        {openSection === key && (
                            <div className="px-6 pb-5">
                                <ul className="space-y-3">
                                    {items.map((item, i) => (
                                        <li key={i} className="flex items-start gap-3">
                                            <div className={`w-1.5 h-1.5 rounded-full ${dot} mt-1.5 flex-shrink-0`} />
                                            <span className="text-sm text-gray-300">{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                ))}

                {/* Per-question breakdown */}
                {answers.length > 0 && (
                    <div className="mb-8">
                        <button
                            className="w-full flex items-center justify-between px-6 py-4 rounded-2xl border border-white/8 bg-white/3 mb-3"
                            onClick={() => setOpenSection(openSection === "questions" ? null : "questions")}
                        >
                            <span className="font-semibold text-white">Answered Questions ({answeredCount})</span>
                            {openSection === "questions"
                                ? <ChevronUp className="w-4 h-4 text-gray-400" />
                                : <ChevronDown className="w-4 h-4 text-gray-400" />}
                        </button>
                        {openSection === "questions" && (
                            <div className="space-y-3">
                                {answers.map((a: any, i: number) => {
                                    const s = a.score ?? 0;
                                    const sc = s >= 7 ? "text-emerald-400" : s >= 5 ? "text-yellow-400" : "text-orange-400";
                                    return (
                                        <div key={i} className="rounded-2xl border border-white/8 bg-white/3 p-5">
                                            <div className="flex items-start justify-between gap-4 mb-3">
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    <div className="w-6 h-6 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-xs font-bold text-purple-400">
                                                        {i + 1}
                                                    </div>
                                                </div>
                                                <span className={`text-sm font-bold ${sc}`}>{s}/10</span>
                                            </div>
                                            <p className="text-sm font-medium text-gray-300 mb-2">{a.question_text}</p>
                                            <div className="h-px bg-white/5 mb-3" />
                                            <div className="mb-3">
                                                <p className="text-xs text-gray-500 font-semibold mb-1">Your Answer:</p>
                                                <p className="text-xs text-gray-400 italic leading-relaxed line-clamp-3">{a.user_answer}</p>
                                            </div>
                                            {a.feedback && (
                                                <div className="mb-3 p-3 rounded-lg bg-white/3 border border-white/5">
                                                    <p className="text-xs text-gray-500 font-semibold mb-1">AI Feedback:</p>
                                                    <p className="text-xs text-gray-300 leading-relaxed">{a.feedback}</p>
                                                </div>
                                            )}
                                            {/* Per-question strengths */}
                                            {a.strengths && a.strengths.length > 0 && (
                                                <div className="mb-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                                                    <p className="text-xs text-emerald-400 font-semibold mb-2">✓ Strengths:</p>
                                                    <ul className="space-y-1">
                                                        {a.strengths.map((strength: string, idx: number) => (
                                                            <li key={idx} className="text-xs text-gray-300 flex items-start gap-2">
                                                                <span className="text-emerald-400 mt-0.5">•</span>
                                                                <span>{strength}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                            {/* Per-question improvements */}
                                            {a.improvements && a.improvements.length > 0 && (
                                                <div className="mb-3 p-3 rounded-lg bg-orange-500/5 border border-orange-500/20">
                                                    <p className="text-xs text-orange-400 font-semibold mb-2">→ Improvements:</p>
                                                    <ul className="space-y-1">
                                                        {a.improvements.map((improvement: string, idx: number) => (
                                                            <li key={idx} className="text-xs text-gray-300 flex items-start gap-2">
                                                                <span className="text-orange-400 mt-0.5">•</span>
                                                                <span>{improvement}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                            <div className="mt-3 h-1.5 rounded-full bg-white/5 overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all ${s >= 7 ? "bg-emerald-500" : s >= 5 ? "bg-yellow-500" : "bg-orange-500"}`}
                                                    style={{ width: `${s * 10}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* Unanswered Questions Section */}
                {unansweredCount > 0 && (
                    <div className="mb-8">
                        <button
                            className="w-full flex items-center justify-between px-6 py-4 rounded-2xl border border-orange-500/20 bg-orange-500/5 mb-3"
                            onClick={() => setOpenSection(openSection === "unanswered" ? null : "unanswered")}
                        >
                            <span className="font-semibold text-orange-300">Skipped Questions ({unansweredCount})</span>
                            {openSection === "unanswered"
                                ? <ChevronUp className="w-4 h-4 text-orange-400" />
                                : <ChevronDown className="w-4 h-4 text-orange-400" />}
                        </button>
                        {openSection === "unanswered" && (
                            <div className="space-y-3">
                                {allAnswers.filter((a: any) => !a.user_answer || a.user_answer.trim().length === 0 || a.user_answer === "[No answer provided]").map((a: any, i: number) => (
                                    <div key={i} className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-5">
                                        <div className="flex items-start gap-3 mb-3">
                                            <div className="w-6 h-6 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
                                                <X className="w-3.5 h-3.5 text-orange-400" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm font-medium text-gray-300">{a.question_text || "Question not saved"}</p>
                                                <p className="text-xs text-orange-400 mt-2">This question was not answered</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Action buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <button
                        onClick={() => handleNav("/interview/new")}
                        className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white font-semibold text-sm transition-all shadow-lg shadow-purple-500/25 hover:scale-[1.01]">
                        <RefreshCcw className="w-4 h-4" /> Practice Again
                    </button>
                    <button
                        onClick={() => handleNav("/analytics")}
                        className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl border border-white/10 bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white text-sm font-medium transition-all">
                        <BarChart2 className="w-4 h-4" /> View Analytics
                    </button>
                    <button
                        onClick={() => handleNav("/history")}
                        className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl border border-white/10 bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white text-sm font-medium transition-all">
                        View History
                    </button>
                </div>
            </div>

            <style jsx global>{`
                @keyframes confetti-fall {
                    0% { transform: translateY(-10px) rotate(0deg); opacity: 1; }
                    100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
                }
                .animate-confetti {
                    animation: confetti-fall linear forwards;
                }
            `}</style>
        </div>
    );
}
