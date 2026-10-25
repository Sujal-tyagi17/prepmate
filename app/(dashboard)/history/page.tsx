"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Clock, Search, LayoutGrid, List, Download, ArrowUpDown, Brain, ArrowRight, SlidersHorizontal, Share2, Link as LinkIcon, FileText } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

const types = ["All", "Technical", "Behavioral", "System Design", "Mixed"];
const sortOptions = [
    { value: "newest", label: "Newest First" },
    { value: "oldest", label: "Oldest First" },
    { value: "highest", label: "Highest Score" },
    { value: "lowest", label: "Lowest Score" },
];

export default function HistoryPage() {
    const router = useRouter();
    const [interviews, setInterviews] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("All");
    const [search, setSearch] = useState("");
    const [sort, setSort] = useState("newest");
    const [view, setView] = useState<"list" | "grid">("list");
    const [scoreFilter, setScoreFilter] = useState("All");
    const [page, setPage] = useState(1);
    const [shareMenuOpen, setShareMenuOpen] = useState<string | null>(null);
    const PER_PAGE = 10;

    useEffect(() => { 
        fetchHistory(); 
        cleanupAbandonedInterviews();
    }, []);

    // Close share menu when clicking outside
    useEffect(() => {
        const handleClickOutside = () => setShareMenuOpen(null);
        if (shareMenuOpen) {
            document.addEventListener('click', handleClickOutside);
            return () => document.removeEventListener('click', handleClickOutside);
        }
    }, [shareMenuOpen]);

    const cleanupAbandonedInterviews = async () => {
        try {
            // Silently clean up abandoned interviews in the background
            await fetch("/api/interviews/cleanup", { method: "GET" });
            // Also try to auto-complete interviews with answers
            await fetch("/api/interviews/cleanup", { method: "POST" });
            // Refresh the list after cleanup to get updated statuses
            setTimeout(() => fetchHistory(), 500);
        } catch (e) { 
            // Fail silently - this is just background cleanup
            console.log("Cleanup complete");
        }
    };

    const fetchHistory = async () => {
        try {
            const res = await fetch("/api/analytics");
            const data = await res.json();
            if (data.success) setInterviews(data.analytics.allInterviews || []);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const filtered = interviews
        .filter(iv => {
            const matchType = filter === "All" || iv.type?.toLowerCase() === filter.toLowerCase().replace(" ", "-");
            const matchSearch = !search || iv.type?.toLowerCase().includes(search.toLowerCase()) || iv.company?.toLowerCase().includes(search.toLowerCase()) || iv.difficulty?.toLowerCase().includes(search.toLowerCase());
            const s = iv.score ?? 0;
            const matchScore = scoreFilter === "All" || (scoreFilter === "0-50" && s < 50) || (scoreFilter === "50-80" && s >= 50 && s < 80) || (scoreFilter === "80+" && s >= 80);
            return matchType && matchSearch && matchScore;
        })
        .sort((a, b) => {
            if (sort === "newest") return new Date(b.date).getTime() - new Date(a.date).getTime();
            if (sort === "oldest") return new Date(a.date).getTime() - new Date(b.date).getTime();
            if (sort === "highest") return (b.score ?? 0) - (a.score ?? 0);
            if (sort === "lowest") return (a.score ?? 0) - (b.score ?? 0);
            return 0;
        });

    const totalPages = Math.ceil(filtered.length / PER_PAGE);
    const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

    const exportCSV = () => {
        const headers = ["Date", "Type", "Difficulty", "Company", "Score", "Status"];
        const rows = filtered.map(iv => [
            new Date(iv.date).toLocaleDateString(),
            iv.type || "",
            iv.difficulty || "",
            iv.company || "",
            iv.score ?? "",
            iv.status || "",
        ]);
        const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "interview-history.csv"; a.click();
        URL.revokeObjectURL(url);
    };

    const getScoreColor = (score: number) => {
        if (score >= 80) return "#10b981";
        if (score >= 60) return "#a855f7";
        return "#f59e0b";
    };

    const typeColor = (type: string) => {
        switch (type?.toLowerCase()) {
            case "technical": return "bg-purple-500/10 text-purple-400 border-purple-500/20";
            case "behavioral": return "bg-pink-500/10 text-pink-400 border-pink-500/20";
            case "system-design": return "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
            default: return "bg-orange-500/10 text-orange-400 border-orange-500/20";
        }
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
                <p className="text-xs font-semibold text-purple-400 tracking-widest uppercase mb-1">Your Sessions</p>
                <h1 className="text-3xl font-bold text-white">Interview <span className="grad-text">History</span></h1>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col gap-3 mb-6">
                {/* Row 1: search + view toggle + export */}
                <div className="flex gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                            placeholder="Search by type, company, difficulty..."
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-purple-500/50 transition-all"
                        />
                    </div>
                    <div className="flex gap-1 p-1 rounded-xl bg-white/5 border border-white/10">
                        <button onClick={() => setView("list")}
                            className={`p-2 rounded-lg transition-all ${view === "list" ? "bg-purple-500/20 text-purple-400" : "text-gray-500 hover:text-white"}`}>
                            <List className="w-4 h-4" />
                        </button>
                        <button onClick={() => setView("grid")}
                            className={`p-2 rounded-lg transition-all ${view === "grid" ? "bg-purple-500/20 text-purple-400" : "text-gray-500 hover:text-white"}`}>
                            <LayoutGrid className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Row 2: type filter chips + score filter + sort */}
                <div className="flex flex-nowrap sm:flex-wrap gap-2 items-center overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 pb-1 sm:pb-0">
                    {types.map((t) => (
                        <button key={t} onClick={() => { setFilter(t); setPage(1); }}
                            className={`flex-shrink-0 whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-all ${filter === t
                                ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                                : "bg-white/5 text-gray-400 border border-white/10 hover:border-white/20 hover:text-white"}`}>
                            {t}
                        </button>
                    ))}
                    <div className="h-4 w-px flex-shrink-0 bg-white/10" />
                    {/* Score filter */}
                    {["All", "80+", "50-80", "0-50"].map(s => (
                        <button key={s} onClick={() => { setScoreFilter(s); setPage(1); }}
                            className={`flex-shrink-0 whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-all ${scoreFilter === s
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                : "bg-white/5 text-gray-400 border border-white/10 hover:border-white/20 hover:text-white"}`}>
                            {s === "All" ? "All Scores" : `Score ${s}`}
                        </button>
                    ))}
                    <div className="ml-auto flex-shrink-0">
                        <select value={sort} onChange={(e) => setSort(e.target.value)}
                            className="bg-white/5 border border-white/10 text-gray-400 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500/50 cursor-pointer">
                            {sortOptions.map(o => <option key={o.value} value={o.value} className="bg-[#1a1025]">{o.label}</option>)}
                        </select>
                    </div>
                </div>
                <p className="text-xs text-gray-600">{filtered.length} interview{filtered.length !== 1 ? "s" : ""} found</p>
            </div>

            {/* Interview list / grid */}
            {loading ? (
                <div className={view === "grid" ? "grid grid-cols-1 sm:grid-cols-2 gap-3" : "space-y-3"}>
                    {[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-2xl bg-white/3 animate-pulse" />)}
                </div>
            ) : paginated.length === 0 ? (
                <div className="rounded-2xl border border-white/8 bg-white/3 p-14 text-center">
                    <Brain className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400 mb-6">No interviews found</p>
                    <Link href="/interview/new"
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white text-sm font-semibold hover:scale-[1.02] transition-all shadow-lg shadow-purple-500/25">
                        Start New Interview
                    </Link>
                </div>
            ) : view === "list" ? (
                <div className="space-y-3">
                    {paginated.map((iv: any) => {
                        const score = iv.score ?? 0;
                        const scoreColor = getScoreColor(score);
                        const circumference = 2 * Math.PI * 18;
                        const offsetVal = circumference - (score / 100) * circumference;
                        return (
                            <div key={iv.id} onClick={() => router.push(`/interview/${iv.id}/feedback`)} className="w-full flex items-center gap-3 sm:gap-5 px-4 sm:px-5 py-4 sm:py-5 cursor-pointer rounded-2xl bg-white/3 border border-white/8 hover:border-purple-500/20 hover:bg-white/5 transition-all group relative">
                                <div className="flex-shrink-0 relative w-12 h-12">
                                    <svg width="48" height="48" viewBox="0 0 48 48">
                                        <circle cx="24" cy="24" r="18" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="5" />
                                        <circle cx="24" cy="24" r="18" fill="none"
                                            stroke={scoreColor} strokeWidth="5"
                                            strokeLinecap="round"
                                            strokeDasharray={circumference}
                                            strokeDashoffset={offsetVal}
                                            transform="rotate(-90 24 24)" />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="text-xs font-bold text-white">{score > 0 ? score : "—"}</span>
                                    </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1 min-w-0">
                                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize whitespace-nowrap ${typeColor(iv.type)}`}>{(iv.type || "Interview").replace("-", " ")}</span>
                                        <span className="text-xs text-gray-500 capitalize whitespace-nowrap">{iv.difficulty || "Standard"}<span className="hidden sm:inline"> difficulty</span></span>
                                    </div>
                                    <p className="text-sm font-medium text-white truncate">{iv.company || "General Interview"}</p>
                                    <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5 whitespace-nowrap">
                                        <Clock className="w-3 h-3 flex-shrink-0" />
                                        {new Date(iv.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                        <span className={`sm:hidden ${iv.status === "completed" ? "text-green-400" : iv.status === "abandoned" ? "text-gray-400" : "text-yellow-400"}`}>
                                            · {iv.status === "completed" ? "Completed" : iv.status === "abandoned" ? "Abandoned" : "In progress"}
                                        </span>
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                                    <div className={`hidden sm:block text-xs px-2.5 py-1 rounded-full font-medium border ${
                                        iv.status === "completed" 
                                            ? "bg-green-500/10 text-green-400 border-green-500/20" 
                                            : iv.status === "abandoned"
                                            ? "bg-gray-500/10 text-gray-400 border-gray-500/20"
                                            : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                                    }`}>
                                        {iv.status === "completed" ? "Completed" : iv.status === "abandoned" ? "Abandoned" : "In Progress"}
                                    </div>
                                    
                                    {/* Share Button */}
                                    <div className="relative">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setShareMenuOpen(shareMenuOpen === iv.id ? null : iv.id);
                                            }}
                                            className={`p-2 rounded-lg border transition-all ${
                                                shareMenuOpen === iv.id
                                                    ? "bg-purple-500/15 border-purple-500/40 text-purple-400"
                                                    : "bg-white/5 border-white/10 hover:border-purple-500/30 hover:bg-purple-500/10 text-gray-400 hover:text-purple-400"
                                            }`}
                                        >
                                            <Share2 className="w-4 h-4" />
                                        </button>
                                        
                                        {shareMenuOpen === iv.id && (
                                            <div className="absolute right-0 bottom-full mb-2 z-50 w-52 rounded-2xl border border-white/10 bg-[#110a1e] shadow-[0_8px_32px_rgba(0,0,0,0.6),0_0_0_1px_rgba(139,92,246,0.1)] overflow-hidden">
                                                {/* Arrow pointer */}
                                                <div className="absolute -bottom-[5px] right-3 w-2.5 h-2.5 rotate-45 bg-[#110a1e] border-r border-b border-white/10" />
                                                <div className="px-3 pt-2.5 pb-1">
                                                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Share Report</p>
                                                </div>
                                                <div className="px-1.5 pb-1.5 flex flex-col gap-0.5">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            navigator.clipboard.writeText(`${window.location.origin}/interview/${iv.id}/feedback`);
                                                            toast.success("Link copied to clipboard!");
                                                            setShareMenuOpen(null);
                                                        }}
                                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/6 text-left transition-colors group/item"
                                                    >
                                                        <div className="w-7 h-7 rounded-lg bg-purple-500/15 border border-purple-500/20 flex items-center justify-center flex-shrink-0">
                                                            <LinkIcon className="w-3.5 h-3.5 text-purple-400" />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-medium text-white">Copy Link</p>
                                                            <p className="text-[10px] text-gray-500">Share via URL</p>
                                                        </div>
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setShareMenuOpen(null);
                                                            router.push(`/interview/${iv.id}/feedback?print=true`);
                                                        }}
                                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/6 text-left transition-colors group/item"
                                                    >
                                                        <div className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-500/20 flex items-center justify-center flex-shrink-0">
                                                            <FileText className="w-3.5 h-3.5 text-cyan-400" />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-medium text-white">Download PDF</p>
                                                            <p className="text-[10px] text-gray-500">Save as PDF file</p>
                                                        </div>
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    
                                    <button
                                        onClick={(e) => { e.stopPropagation(); router.push(`/interview/${iv.id}/feedback`); }}
                                        className="hidden sm:block p-2 rounded-lg hover:bg-white/5 transition-colors"
                                        aria-label="View feedback"
                                    >
                                        <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-purple-400 transition-colors" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {paginated.map((iv: any) => {
                        const score = iv.score ?? 0;
                        const scoreColor = getScoreColor(score);
                        return (
                            <div key={iv.id} className="flex flex-col p-5 rounded-2xl bg-white/3 border border-white/8 hover:border-purple-500/20 hover:bg-white/5 transition-all group relative">
                                <div className="flex items-center justify-between mb-3">
                                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${typeColor(iv.type)}`}>{iv.type || "Interview"}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-2xl font-bold" style={{ color: scoreColor }}>{score > 0 ? `${score}%` : "—"}</span>
                                        
                                        {/* Share Button */}
                                        <div className="relative">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setShareMenuOpen(shareMenuOpen === iv.id ? null : iv.id);
                                                }}
                                                className={`p-1.5 rounded-lg border transition-all ${
                                                    shareMenuOpen === iv.id
                                                        ? "bg-purple-500/15 border-purple-500/40 text-purple-400"
                                                        : "bg-white/5 border-white/10 hover:border-purple-500/30 hover:bg-purple-500/10 text-gray-400 hover:text-purple-400"
                                                }`}
                                            >
                                                <Share2 className="w-3.5 h-3.5" />
                                            </button>
                                            
                                            {shareMenuOpen === iv.id && (
                                                <div className="absolute right-0 bottom-full mb-2 z-50 w-52 rounded-2xl border border-white/10 bg-[#110a1e] shadow-[0_8px_32px_rgba(0,0,0,0.6),0_0_0_1px_rgba(139,92,246,0.1)] overflow-hidden">
                                                    <div className="absolute -bottom-[5px] right-3 w-2.5 h-2.5 rotate-45 bg-[#110a1e] border-r border-b border-white/10" />
                                                    <div className="px-3 pt-2.5 pb-1">
                                                        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Share Report</p>
                                                    </div>
                                                    <div className="px-1.5 pb-1.5 flex flex-col gap-0.5">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                navigator.clipboard.writeText(`${window.location.origin}/interview/${iv.id}/feedback`);
                                                                toast.success("Link copied to clipboard!");
                                                                setShareMenuOpen(null);
                                                            }}
                                                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/6 text-left transition-colors"
                                                        >
                                                            <div className="w-7 h-7 rounded-lg bg-purple-500/15 border border-purple-500/20 flex items-center justify-center flex-shrink-0">
                                                                <LinkIcon className="w-3.5 h-3.5 text-purple-400" />
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-medium text-white">Copy Link</p>
                                                                <p className="text-[10px] text-gray-500">Share via URL</p>
                                                            </div>
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setShareMenuOpen(null);
                                                                router.push(`/interview/${iv.id}/feedback?print=true`);
                                                            }}
                                                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/6 text-left transition-colors"
                                                        >
                                                            <div className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-500/20 flex items-center justify-center flex-shrink-0">
                                                                <FileText className="w-3.5 h-3.5 text-cyan-400" />
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-medium text-white">Download PDF</p>
                                                                <p className="text-[10px] text-gray-500">Save as PDF file</p>
                                                            </div>
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <button onClick={() => router.push(`/interview/${iv.id}/feedback`)} className="flex-1 text-left">
                                    <p className="text-sm font-medium text-white mb-1">{iv.company || "General Interview"}</p>
                                    <p className="text-xs text-gray-500 capitalize mb-3">{iv.difficulty || "Standard"} difficulty</p>
                                    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden mb-3">
                                        <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, backgroundColor: scoreColor }} />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs text-gray-600">{new Date(iv.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                                        <div className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                                            iv.status === "completed" 
                                                ? "bg-green-500/10 text-green-400 border-green-500/20" 
                                                : iv.status === "abandoned"
                                                ? "bg-gray-500/10 text-gray-400 border-gray-500/20"
                                                : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                                        }`}>
                                            {iv.status === "completed" ? "Completed" : iv.status === "abandoned" ? "Abandoned" : "In Progress"}
                                        </div>
                                    </div>
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-8">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                        className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-400 hover:text-white disabled:opacity-40 transition-all">
                        ← Prev
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                        <button key={p} onClick={() => setPage(p)}
                            className={`w-9 h-9 rounded-lg text-sm font-medium transition-all ${p === page ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" : "bg-white/5 border border-white/10 text-gray-400 hover:text-white"}`}>
                            {p}
                        </button>
                    ))}
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                        className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-400 hover:text-white disabled:opacity-40 transition-all">
                        Next →
                    </button>
                </div>
            )}
        </div>
    );
}
