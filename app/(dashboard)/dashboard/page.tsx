"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState, useEffect, useTransition, useMemo } from "react";
import { Loader2, Sparkles, TrendingUp, Clock, Target, ArrowRight, Brain, BarChart2, Flame, Trophy, Zap, BookOpen } from "lucide-react";
import { formatPracticeTime } from "@/lib/scoring";

export default function DashboardPage() {
    const { user, isLoaded } = useUser();
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
    const [recentInterviews, setRecentInterviews] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const handleNav = (href: string) => {
        setNavigatingTo(href);
        startTransition(() => router.push(href));
    };
    const [stats, setStats] = useState({ total: 0, avgScore: 0, streak: 0, hoursPracticed: "0m", improvement: 0 });
    const [completedTimestamps, setCompletedTimestamps] = useState<string[]>([]);
    const [hoveredCell, setHoveredCell] = useState<{ date: string; count: number } | null>(null);
    const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

    // Compute heatmap client-side using browser local timezone (avoids UTC vs IST mismatch)
    const heatmapData = useMemo(() => {
        const localDates = completedTimestamps.map((ts) => new Date(ts).toLocaleDateString('en-CA'));
        const result = [];
        const now = new Date();
        for (let i = 48; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(now.getDate() - i);
            const dateStr = d.toLocaleDateString('en-CA');
            const count = localDates.filter((ld) => ld === dateStr).length;
            result.push({ date: dateStr, count, intensity: Math.min(3, count) });
        }
        return result;
    }, [completedTimestamps]);

    useEffect(() => {
        if (isLoaded) fetchData();
    }, [isLoaded]);

    const fetchData = async () => {
        try {
            const res = await fetch("/api/analytics");
            const data = await res.json();
            if (data.success) {
                const interviews = data.analytics.recentInterviews || [];
                setRecentInterviews(interviews);
                const scores = interviews.map((iv: any) => iv.score ?? 0).filter((s: number) => s > 0);
                const firstScore = scores.length > 1 ? scores[scores.length - 1] : 0;
                const lastScore = scores.length > 0 ? scores[0] : 0;
                setStats({
                    total: data.analytics.totalInterviews || 0,
                    avgScore: Math.round(data.analytics.averageScore || 0),
                    streak: data.analytics.streak || 0,
                    hoursPracticed: formatPracticeTime(data.analytics.totalMinutes || 0),
                    improvement: scores.length > 1 ? Math.round(lastScore - firstScore) : 0,
                });
                // Use completedTimestamps — heatmap computed client-side
                setCompletedTimestamps(data.analytics.completedTimestamps || []);
            }
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    if (!isLoaded || loading) {
        return (
            <div className="px-4 sm:px-6 lg:px-10 py-6 lg:py-8 max-w-7xl">
                {/* Skeleton Header */}
                <div className="mb-10 animate-pulse">
                    <div className="h-4 w-32 bg-white/10 rounded mb-2"></div>
                    <div className="h-8 w-64 bg-white/10 rounded"></div>
                </div>

                {/* Skeleton Stat Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="rounded-2xl p-5 border border-white/10 bg-white/5 animate-pulse">
                            <div className="h-16 w-16 bg-white/10 rounded-full mb-2"></div>
                            <div className="h-4 w-20 bg-white/10 rounded"></div>
                        </div>
                    ))}
                </div>

                {/* Skeleton Content */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="rounded-2xl p-6 border border-white/10 bg-white/5 animate-pulse">
                        <div className="h-6 w-48 bg-white/10 rounded mb-4"></div>
                        <div className="space-y-3">
                            {[1, 2, 3].map(i => <div key={i} className="h-20 bg-white/10 rounded"></div>)}
                        </div>
                    </div>
                    <div className="rounded-2xl p-6 border border-white/10 bg-white/5 animate-pulse">
                        <div className="h-6 w-48 bg-white/10 rounded mb-4"></div>
                        <div className="h-64 bg-white/10 rounded"></div>
                    </div>
                </div>
            </div>
        );
    }

    const firstName = user?.firstName || user?.fullName?.split(" ")[0] || "there";
    const avgScore = stats.avgScore;
    const circumference = 2 * Math.PI * 36;
    const offset = circumference - (avgScore / 100) * circumference;

    // Achievement badges
    const badges = [
        { icon: "🎯", label: "First Interview", earned: stats.total >= 1,   color: "from-purple-500 to-fuchsia-500" },
        { icon: "🔥", label: "5-Day Streak",    earned: stats.streak >= 5,  color: "from-orange-400 to-red-500" },
        { icon: "⭐", label: "High Scorer",     earned: avgScore >= 80,     color: "from-fuchsia-500 to-purple-600" },
        { icon: "🚀", label: "10 Sessions",     earned: stats.total >= 10,  color: "from-purple-600 to-fuchsia-500" },
        { icon: "💎", label: "Elite Performer", earned: avgScore >= 90,     color: "from-cyan-500 to-blue-600" },
        { icon: "⚡", label: "7-Day Streak",    earned: stats.streak >= 7,  color: "from-yellow-400 to-orange-500" },
    ];

    // Intensity colors for heatmap
    const intensityColors = ["bg-white/5", "bg-purple-500/25", "bg-purple-500/55", "bg-purple-500/90"];

    return (
        <div className="px-4 sm:px-6 lg:px-10 py-6 lg:py-8 max-w-7xl">

            {/* Navigation loading overlay */}
            {navigatingTo && (
                <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0a0514]/80 backdrop-blur-sm">
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

            {/* Header */}
            <div className="mb-6 sm:mb-10">
                <p className="text-gray-500 text-sm mb-1">Good to see you back 👋</p>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">Welcome, <span className="grad-text">{firstName}!</span></h1>
            </div>

            {/* Stat Cards Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">

                {/* Average Score — Circle */}
                <div className="col-span-2 lg:col-span-1 rounded-2xl p-4 sm:p-5 border border-purple-500/20 bg-gradient-to-br from-purple-500/10 to-purple-600/5 flex items-center gap-4">
                    <div className="relative flex-shrink-0">
                        <svg width="72" height="72" viewBox="0 0 84 84">
                            <circle cx="42" cy="42" r="36" fill="none" stroke="rgba(168,85,247,0.15)" strokeWidth="8" />
                            <circle cx="42" cy="42" r="36" fill="none"
                                stroke="url(#scoreGrad)" strokeWidth="8"
                                strokeLinecap="round"
                                strokeDasharray={circumference}
                                strokeDashoffset={offset}
                                transform="rotate(-90 42 42)" />
                            <defs>
                                <linearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="0">
                                    <stop offset="0%" stopColor="#a855f7" />
                                    <stop offset="100%" stopColor="#ec4899" />
                                </linearGradient>
                            </defs>
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-base font-bold text-white">{avgScore}%</span>
                        </div>
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 mb-0.5">Avg Score</p>
                        <p className="text-sm font-bold text-white">{avgScore > 0 ? (avgScore >= 80 ? "Excellent" : avgScore >= 60 ? "Good" : "Needs Work") : "—"}</p>
                        {avgScore > 0 && <p className="text-xs text-purple-400 mt-0.5">↑ Top {avgScore > 80 ? "10" : "25"}%</p>}
                    </div>
                </div>

                {/* Total sessions */}
                <div className="rounded-2xl p-4 sm:p-5 border border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-500/10 to-fuchsia-600/5">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-9 h-9 rounded-xl bg-fuchsia-500/20 flex items-center justify-center">
                            <Brain className="w-4 h-4 text-fuchsia-400" />
                        </div>
                        <span className="text-xs text-gray-600">Total</span>
                    </div>
                    <div className="text-2xl sm:text-3xl font-bold text-white mb-0.5">{loading ? <div className="h-8 w-12 bg-white/10 rounded animate-pulse" /> : stats.total}</div>
                    <div className="text-xs text-gray-500">Interview Sessions</div>
                </div>

                {/* Hours Practiced */}
                <div className="rounded-2xl p-4 sm:p-5 border border-purple-500/20 bg-gradient-to-br from-purple-500/10 to-purple-600/5">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-9 h-9 rounded-xl bg-purple-500/20 flex items-center justify-center">
                            <Clock className="w-4 h-4 text-purple-400" />
                        </div>
                        <span className="text-xs text-gray-600">Practice</span>
                    </div>
                    <div className="text-2xl sm:text-3xl font-bold text-white mb-0.5">{loading ? <div className="h-8 w-10 bg-white/10 rounded animate-pulse" /> : stats.hoursPracticed}</div>
                    <div className="text-xs text-gray-500">Time Practiced</div>
                </div>

                {/* Improvement Rate */}
                <div className="col-span-2 lg:col-span-1 rounded-2xl p-4 sm:p-5 border border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-500/10 to-fuchsia-600/5">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-9 h-9 rounded-xl bg-fuchsia-500/20 flex items-center justify-center">
                            <TrendingUp className="w-4 h-4 text-fuchsia-400" />
                        </div>
                        <span className="text-xs text-gray-600">Growth</span>
                    </div>
                    <div className={`text-3xl font-bold mb-0.5 ${stats.improvement >= 0 ? "text-fuchsia-400" : "text-orange-400"}`}>
                        {loading ? <div className="h-8 w-12 bg-white/10 rounded animate-pulse" /> : `${stats.improvement >= 0 ? "+" : ""}${stats.improvement}%`}
                    </div>
                    <div className="text-xs text-gray-500">Score Improvement</div>
                </div>
            </div>

            {/* New Session CTA */}
            <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-r from-purple-900/30 to-fuchsia-900/20 p-5 sm:p-6 mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 flex-shrink-0 rounded-2xl bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
                        <Sparkles className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-white text-base sm:text-lg">Ready for your next session?</h3>
                        <p className="text-sm text-gray-400">Start a personalized AI mock interview in seconds</p>
                    </div>
                </div>
                <button onClick={() => handleNav("/interview/new")}
                    className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white font-semibold text-sm transition-all shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:scale-[1.02] flex-shrink-0">
                    New Interview <ArrowRight className="w-4 h-4" />
                </button>
            </div>

            <div className="grid lg:grid-cols-2 gap-6 mb-8 items-stretch">
                {/* Achievement Badges */}
                <div className="rounded-2xl border border-white/8 bg-white/3 p-4 sm:p-6">
                    <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-purple-400" /> Achievements
                    </h2>
                    <div className="grid grid-cols-2 gap-3">
                        {badges.map((badge) => (
                            <div key={badge.label} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                                badge.earned ? "border-white/15 bg-white/5" : "border-white/5 bg-white/2 opacity-40"
                            }`}>
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${
                                    badge.earned ? `bg-gradient-to-br ${badge.color}` : "bg-white/10"
                                }`}>
                                    {badge.icon}
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-white">{badge.label}</p>
                                    <p className={`text-xs ${badge.earned ? "text-fuchsia-400" : "text-gray-600"}`}>
                                        {badge.earned ? "Earned ✓" : "Locked"}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Activity Heatmap */}
                <div className="rounded-2xl border border-white/8 bg-white/3 p-4 sm:p-6 flex flex-col">
                    <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
                        <Flame className="w-4 h-4 text-fuchsia-400" /> Activity (Last 7 Weeks)
                    </h2>
                    <div className="flex-1 flex items-stretch gap-1.5 sm:gap-2 min-h-[220px] lg:min-h-0 relative">
                        {Array.from({ length: 7 }, (_, week) => (
                            <div key={week} className="flex flex-col gap-2 flex-1">
                                {Array.from({ length: 7 }, (_, day) => {
                                    const index = week * 7 + day;
                                    if (index >= heatmapData.length) return <div key={day} className="flex-1 rounded-md bg-white/3" />;
                                    const cell = heatmapData[index];
                                    // Parse local date string at local noon to avoid UTC timezone shift
                                    const dateStr = new Date(cell.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                                    return (
                                        <div key={day}
                                            className={`flex-1 rounded-md ${intensityColors[cell.intensity]} hover:ring-2 hover:ring-purple-400/60 hover:scale-105 transition-all cursor-pointer relative group`}
                                            onMouseEnter={(e) => {
                                                setHoveredCell({ date: dateStr, count: cell.count });
                                                const rect = (e.target as HTMLElement).getBoundingClientRect();
                                                setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top });
                                            }}
                                            onMouseLeave={() => { setHoveredCell(null); setTooltipPos(null); }}
                                        />
                                    );
                                })}
                            </div>
                        ))}
                        {/* Custom tooltip */}
                        {hoveredCell && tooltipPos && (
                            <div
                                className="fixed z-50 pointer-events-none"
                                style={{ left: tooltipPos.x, top: tooltipPos.y - 8, transform: 'translate(-50%, -100%)' }}
                            >
                                <div className="bg-[#1a0f2e] border border-purple-500/30 rounded-xl px-3 py-2 shadow-xl shadow-purple-900/40 text-center whitespace-nowrap">
                                    <p className="text-[11px] font-semibold text-purple-300">{hoveredCell.date}</p>
                                    <p className="text-[13px] font-bold text-white mt-0.5">
                                        {hoveredCell.count === 0 ? 'No sessions' : `${hoveredCell.count} session${hoveredCell.count !== 1 ? 's' : ''}`}
                                    </p>
                                </div>
                                <div className="w-2 h-2 bg-[#1a0f2e] border-r border-b border-purple-500/30 rotate-45 mx-auto -mt-1" />
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2 mt-4">
                        <span className="text-xs text-gray-600">Less</span>
                        {intensityColors.map((c, i) => <div key={i} className={`w-4 h-4 rounded-sm ${c}`} />)}
                        <span className="text-xs text-gray-600">More</span>
                    </div>
                </div>
            </div>

            {/* Recent Interviews */}
            <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold text-white">Recent Activity</h2>
                <button onClick={() => handleNav("/history")} className="text-sm text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1">
                    View all <ArrowRight className="w-3.5 h-3.5" />
                </button>
            </div>

            {loading ? (
                <div className="space-y-3">
                    {[...Array(3)].map((_, i) => <div key={i} className="h-20 rounded-2xl bg-white/3 animate-pulse" />)}
                </div>
            ) : recentInterviews.length === 0 ? (
                <div className="rounded-2xl border border-white/8 bg-white/3 p-14 text-center">
                    <Brain className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400 mb-6 text-base">No interviews yet — let&apos;s start your first one!</p>
                    <button onClick={() => handleNav("/interview/new")}
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white text-sm font-semibold hover:scale-[1.02] transition-all shadow-lg shadow-purple-500/25">
                        <Sparkles className="w-4 h-4" /> Start Your First Interview
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    {recentInterviews.slice(0, 5).map((iv: any) => (
                        <button key={iv.id} onClick={() => handleNav(`/interview/${iv.id}/feedback`)}
                            className="w-full flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5 sm:py-4 rounded-2xl bg-white/3 border border-white/8 hover:border-purple-500/20 hover:bg-white/5 transition-all text-left group">
                            <div className="w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold"
                                style={{
                                    background: `conic-gradient(#a855f7 ${(iv.score ?? 0)}%, rgba(255,255,255,0.05) 0%)`,
                                    boxShadow: "0 0 0 3px rgba(168,85,247,0.15)"
                                }}>
                                <div className="w-9 h-9 rounded-full bg-[#0a0a0f] flex items-center justify-center">
                                    <span className="text-xs font-bold text-white">{iv.score ?? "—"}</span>
                                </div>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-white capitalize truncate">{(iv.type || "Interview").replace("-", " ")} <span className="text-gray-400">· {iv.difficulty || "—"}</span></p>
                                <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5">
                                    <Clock className="w-3 h-3" />
                                    {new Date(iv.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                </p>
                            </div>
                            <div className={`text-[11px] sm:text-xs px-2 sm:px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${
                                iv.status === "completed" 
                                    ? "bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20" 
                                    : iv.status === "abandoned"
                                    ? "bg-gray-500/10 text-gray-400 border border-gray-500/20"
                                    : "bg-orange-500/10 text-orange-400 border border-orange-500/20"
                            }`}>
                                {iv.status === "completed" ? "Completed" : iv.status === "abandoned" ? "Abandoned" : "In Progress"}
                            </div>
                            <ArrowRight className="hidden sm:block w-4 h-4 text-gray-600 group-hover:text-purple-400 transition-colors" />
                        </button>
                    ))}
                </div>
            )}

            {/* Quick actions */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8">
                {[
                    { href: "/analytics", icon: BarChart2, label: "Analytics", desc: "Charts & insights", color: "text-purple-400", bg: "bg-purple-500/15" },
                    { href: "/history", icon: BookOpen, label: "History", desc: "Past sessions", color: "text-fuchsia-400", bg: "bg-fuchsia-500/15" },
                    { href: "/profile", icon: Target, label: "Settings", desc: "Preferences", color: "text-purple-400", bg: "bg-purple-500/15" },
                    { href: "/interview/new", icon: Zap, label: "Quick Start", desc: "Mixed difficulty", color: "text-fuchsia-400", bg: "bg-fuchsia-500/15" },
                ].map(({ href, icon: Icon, label, desc, color, bg }) => (
                    <button key={href} onClick={() => handleNav(href)} className="flex items-center gap-3 p-4 rounded-2xl border border-white/8 bg-white/3 hover:border-purple-500/20 hover:bg-white/5 transition-all group text-left">
                        <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
                            <Icon className={`w-4 h-4 ${color}`} size={16} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-medium text-white">{label}</p>
                            <p className="text-xs text-gray-500">{desc}</p>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
