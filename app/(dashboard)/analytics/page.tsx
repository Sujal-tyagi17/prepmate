"use client";

import React, { useState, useEffect, useMemo } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, Target, Brain, Clock, Award } from "lucide-react";

const tooltipStyle = {
    backgroundColor: "#111118",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "12px",
    color: "#fff",
    fontSize: "12px",
    padding: "8px 12px",
};

export default function AnalyticsPage() {
    const [analytics, setAnalytics] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [hoveredCell, setHoveredCell] = useState<{ date: string; count: number; x: number; y: number } | null>(null);

    useEffect(() => { fetchAnalytics(); }, []);

    const fetchAnalytics = async () => {
        try {
            const res = await fetch("/api/analytics");
            const data = await res.json();
            if (data.success) setAnalytics(data.analytics);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    // REAL performance trend data from API
    const trendData = analytics?.performanceTrend?.length > 0
        ? analytics.performanceTrend.map((item: any, i: number) => ({
            name: `S${i + 1}`,
            score: Math.round(item.score * 10), // Convert to percentage
            type: item.type
        }))
        : [];

    // REAL topic performance data from API
    const topicData = analytics?.topicPerformance?.length > 0
        ? analytics.topicPerformance
        : [];

    // REAL interview type breakdown from API
    const typeColors: Record<string, string> = {
        technical: "#a855f7",
        behavioral: "#ec4899",
        "system-design": "#22d3ee",
        mixed: "#f59e0b"
    };
    
    const totalInterviewsForTypes: number = Number((Object.values(analytics?.typeBreakdown || {}) as number[]).reduce((a: number, b: number) => a + b, 0)) || 1;
    const typeData = analytics?.typeBreakdown
        ? Object.entries(analytics.typeBreakdown).map(([name, count]) => ({
            name: name.charAt(0).toUpperCase() + name.slice(1).replace('-', ' '),
            value: Math.round((Number(count) / totalInterviewsForTypes) * 100),
            color: typeColors[name] || "#6b7280"
        }))
        : [];

    // Compute heatmap CLIENT-SIDE using browser local timezone (avoids UTC vs IST mismatch)
    const heatmapData = useMemo(() => {
        const timestamps: string[] = analytics?.completedTimestamps || [];
        // Convert each timestamp to a local date string YYYY-MM-DD using the browser's timezone
        const localDates = timestamps.map((ts) => {
            const d = new Date(ts);
            return d.toLocaleDateString('en-CA'); // 'en-CA' gives YYYY-MM-DD in local timezone
        });
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
    }, [analytics?.completedTimestamps]);

    const statCards = [
        { label: "Total Sessions", value: analytics?.totalInterviews ?? 0, icon: Brain, color: "purple" },
        { label: "Average Score", value: analytics?.averageScore ? `${analytics.averageScore}%` : "0%", icon: Target, color: "pink" },
        { label: "Best Score", value: analytics?.bestScore ? `${analytics.bestScore}%` : "0%", icon: Award, color: "cyan" },
        { label: "Day Streak", value: analytics?.streak ?? 0, icon: TrendingUp, color: "orange" },
    ];

    const colorMap: Record<string, string> = {
        purple: "bg-purple-500/15 text-purple-400 border-purple-500/20",
        pink: "bg-pink-500/15 text-pink-400 border-pink-500/20",
        cyan: "bg-cyan-500/15 text-cyan-400 border-cyan-500/20",
        orange: "bg-orange-500/15 text-orange-400 border-orange-500/20",
    };

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center min-h-screen">
                <div className="flex flex-col items-center gap-4">
                    <div className="relative w-12 h-12">
                        <div className="absolute inset-0 rounded-full border-2 border-purple-500/20 border-t-purple-500 animate-spin" />
                        <div className="absolute inset-0 rounded-full border-2 border-fuchsia-500/10 border-b-fuchsia-500 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }} />
                    </div>
                    <p className="text-white font-semibold text-sm">Loading...</p>
                    <p className="text-gray-500 text-xs">Please wait</p>
                </div>
            </div>
        );
    }

    return (
        <div className="px-4 sm:px-6 lg:px-10 py-6 lg:py-8 max-w-7xl">
            <div className="mb-8">
                <p className="text-xs font-semibold text-purple-400 tracking-widest uppercase mb-1">Your Progress</p>
                <h1 className="text-3xl font-bold text-white">Performance <span className="grad-text">Analytics</span></h1>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {statCards.map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className={`rounded-2xl p-5 border ${colorMap[color]}`} style={{ background: `linear-gradient(135deg, rgba(0,0,0,0.3), rgba(0,0,0,0.2))` }}>
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${colorMap[color]}`}>
                            <Icon className="w-4.5 h-4.5" size={18} />
                        </div>
                        {loading ? (
                            <div className="h-7 w-16 bg-white/10 rounded animate-pulse mb-1" />
                        ) : (
                            <div className="text-2xl font-bold text-white mb-1">{value}</div>
                        )}
                        <div className="text-xs text-gray-500">{label}</div>
                    </div>
                ))}
            </div>

            {/* Charts row */}
            <div className="grid lg:grid-cols-3 gap-5 mb-8">

                {/* Performance Trend — line chart (2/3 width) */}
                <div className="lg:col-span-2 rounded-2xl border border-white/8 bg-white/3 p-6">
                    <h3 className="font-semibold text-white mb-1">Performance Trend</h3>
                    <p className="text-xs text-gray-500 mb-5">Score over your recent sessions</p>
                    {trendData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={200}>
                            <LineChart data={trendData}>
                                <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "rgba(168,85,247,0.2)" }} />
                                <XAxis dataKey="name" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis domain={[0, 100]} tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
                                <Line type="monotone" dataKey="score" stroke="url(#lineGrad)" strokeWidth={2.5}
                                    dot={{ fill: "#a855f7", r: 4, strokeWidth: 0 }}
                                    activeDot={{ r: 6, fill: "#a855f7" }} />
                                <defs>
                                    <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                                        <stop offset="0%" stopColor="#a855f7" />
                                        <stop offset="100%" stopColor="#ec4899" />
                                    </linearGradient>
                                </defs>
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-[200px] flex items-center justify-center text-gray-500 text-sm">
                            Complete interviews to see your performance trend
                        </div>
                    )}
                </div>

                {/* Interview Types — donut */}
                <div className="rounded-2xl border border-white/8 bg-white/3 p-6">
                    <h3 className="font-semibold text-white mb-1">Interview Types</h3>
                    <p className="text-xs text-gray-500 mb-4">Breakdown by category</p>
                    {typeData.length > 0 ? (
                        <>
                            <ResponsiveContainer width="100%" height={150}>
                                <PieChart>
                                    <Pie data={typeData} cx="50%" cy="50%" innerRadius={40} outerRadius={65}
                                        dataKey="value" strokeWidth={0}>
                                        {typeData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={tooltipStyle} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="space-y-2 mt-3">
                                {typeData.map((d) => (
                                    <div key={d.name} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                                            <span className="text-xs text-gray-400">{d.name}</span>
                                        </div>
                                        <span className="text-xs font-medium text-gray-300">{d.value}%</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="h-[150px] flex items-center justify-center text-gray-500 text-sm text-center px-4">
                            Try different interview types to see breakdown
                        </div>
                    )}
                </div>
            </div>

            {/* Topic scores */}
            <div className="grid lg:grid-cols-2 gap-5">
                <div className="rounded-2xl border border-white/8 bg-white/3 p-6">
                    <h3 className="font-semibold text-white mb-1">Topic Performance</h3>
                    <p className="text-xs text-gray-500 mb-5">Score by subject area</p>
                    {topicData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={180}>
                            <BarChart data={topicData} layout="vertical">
                                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(168,85,247,0.05)" }} />
                                <XAxis type="number" domain={[0, 100]} tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis type="category" dataKey="topic" tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
                                <Bar dataKey="score" fill="url(#barGrad)" radius={[0, 6, 6, 0]} barSize={14} />
                                <defs>
                                    <linearGradient id="barGrad" x1="0" y1="0" x2="1" y2="0">
                                        <stop offset="0%" stopColor="#a855f7" />
                                        <stop offset="100%" stopColor="#ec4899" />
                                    </linearGradient>
                                </defs>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-[180px] flex items-center justify-center text-gray-500 text-sm">
                            Complete interviews to see topic breakdown
                        </div>
                    )}
                </div>

                {/* Practice heatmap */}
                <div className="rounded-2xl border border-white/8 bg-white/3 p-6 relative">
                    <h3 className="font-semibold text-white mb-1">Practice Frequency</h3>
                    <p className="text-xs text-gray-500 mb-5">Sessions in the last 7 weeks</p>
                    {heatmapData.length > 0 ? (
                        <div className="flex items-start gap-1">
                            {Array.from({ length: 7 }, (_, week) => (
                                <div key={week} className="flex flex-col gap-1">
                                    {Array.from({ length: 7 }, (_, day) => {
                                        const index = week * 7 + day;
                                        if (index >= heatmapData.length) return null;
                                        const cell = heatmapData[index];
                                        const intensities = ["bg-white/5", "bg-purple-500/20", "bg-purple-500/50", "bg-purple-500/90"];
                                        return (
                                            <div 
                                                key={day}
                                                className={`w-7 h-7 rounded-md ${intensities[cell.intensity]} transition-all hover:ring-2 hover:ring-purple-400 hover:scale-110 cursor-pointer`}
                                                onMouseEnter={(e) => {
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    setHoveredCell({
                                                        date: new Date(cell.date + 'T12:00:00').toLocaleDateString('en-US', { 
                                                            month: 'short', 
                                                            day: 'numeric', 
                                                            year: 'numeric' 
                                                        }),
                                                        count: cell.count,
                                                        x: rect.left + rect.width / 2,
                                                        y: rect.top - 10
                                                    });
                                                }}
                                                onMouseLeave={() => setHoveredCell(null)}
                                            />
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-gray-500 text-sm">
                            Complete interviews to see your practice frequency
                        </div>
                    )}
                    <div className="flex items-center gap-2 mt-4">
                        <span className="text-xs text-gray-600">Less</span>
                        {["bg-white/5", "bg-purple-500/20", "bg-purple-500/50", "bg-purple-500/90"].map((c, i) => (
                            <div key={i} className={`w-4 h-4 rounded-sm ${c}`} />
                        ))}
                        <span className="text-xs text-gray-600">More</span>
                    </div>

                    {/* Custom Tooltip */}
                    {hoveredCell && (
                        <div 
                            className="fixed z-50 pointer-events-none"
                            style={{
                                left: `${hoveredCell.x}px`,
                                top: `${hoveredCell.y}px`,
                                transform: 'translate(-50%, -100%)'
                            }}
                        >
                            <div className="bg-[#1a1625] border border-purple-500/30 rounded-lg px-3 py-2 shadow-2xl shadow-purple-500/20">
                                <div className="text-white text-xs font-bold mb-0.5">
                                    {hoveredCell.date}
                                </div>
                                <div className="text-gray-400 text-xs">
                                    {hoveredCell.count} session{hoveredCell.count !== 1 ? 's' : ''}
                                </div>
                            </div>
                            <div className="w-2 h-2 bg-[#1a1625] border-r border-b border-purple-500/30 transform rotate-45 mx-auto -mt-1" />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
