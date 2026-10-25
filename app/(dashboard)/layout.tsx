"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useClerk, useUser } from "@clerk/nextjs";
import { useState, useEffect, useTransition } from "react";
import {
    LayoutDashboard, Brain, BarChart2, Clock, Settings,
    LogOut, ChevronRight, Sparkles, User, Loader2, Menu, X
} from "lucide-react";
import PrepMateLogo from "@/components/ui/PrepMateLogo";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const navItems = [
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/interview/new", icon: Brain, label: "New Interview" },
    { href: "/analytics", icon: BarChart2, label: "Analytics" },
    { href: "/history", icon: Clock, label: "History" },
    { href: "/profile", icon: Settings, label: "Settings" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { user } = useClerk();
    const { user: clerkUser } = useUser();
    const { signOut } = useClerk();
    const [isPending, startTransition] = useTransition();
    const [loadingHref, setLoadingHref] = useState<string | null>(null);
    const [topBarProgress, setTopBarProgress] = useState(0);
    const [mobileNavOpen, setMobileNavOpen] = useState(false);

    // Clear loading state when pathname changes (navigation complete)
    useEffect(() => {
        setLoadingHref(null);
        setTopBarProgress(0);
        setMobileNavOpen(false);
    }, [pathname]);

    // Lock background scroll while the mobile drawer is open; close it on Escape
    useEffect(() => {
        if (!mobileNavOpen) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMobileNavOpen(false); };
        window.addEventListener("keydown", onKey);
        return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
    }, [mobileNavOpen]);

    // Animate top progress bar while loading
    useEffect(() => {
        if (!loadingHref) return;
        setTopBarProgress(20);
        const t1 = setTimeout(() => setTopBarProgress(60), 200);
        const t2 = setTimeout(() => setTopBarProgress(85), 500);
        return () => { clearTimeout(t1); clearTimeout(t2); };
    }, [loadingHref]);

    const handleNavClick = (e: React.MouseEvent, href: string) => {
        if (href === pathname) { setMobileNavOpen(false); return; }
        e.preventDefault();
        setLoadingHref(href);
        startTransition(() => {
            router.push(href);
        });
    };

    // On /interview/[id] (not /interview/new) — full screen mode, hide sidebar
    const isActiveInterview = /^\/interview\/(?!new$)[^/]+$/.test(pathname ?? "");

    if (isActiveInterview) {
        return <div className="bg-[#0a0514] text-white">{children}</div>;
    }

    return (
        <div className="flex min-h-screen bg-[#0a0514] text-white">

            {/* ── Top Progress Bar ── */}
            {loadingHref && (
                <div className="fixed top-0 left-0 right-0 z-50 h-0.5 bg-transparent">
                    <div
                        className="h-full bg-gradient-to-r from-purple-500 to-fuchsia-500 transition-all duration-500 ease-out shadow-[0_0_8px_rgba(168,85,247,0.8)]"
                        style={{ width: `${topBarProgress}%` }}
                    />
                </div>
            )}

            {/* ── Mobile top bar ── */}
            <header className="lg:hidden fixed top-0 inset-x-0 z-40 h-14 flex items-center justify-between px-4 border-b border-white/5 bg-[#0a0514]/90 backdrop-blur-xl pt-[env(safe-area-inset-top)]">
                <button
                    onClick={() => setMobileNavOpen(true)}
                    className="-ml-2 p-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/5 active:bg-white/10"
                    aria-label="Open menu"
                    aria-expanded={mobileNavOpen}
                >
                    <Menu className="w-5 h-5" />
                </button>
                <Link href="/dashboard" aria-label="PrepMate home">
                    <PrepMateLogo size="sm" variant="horizontal" animated={false} />
                </Link>
                <a href="/profile" onClick={(e) => handleNavClick(e, "/profile")} aria-label="Profile"
                    className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center overflow-hidden">
                    {clerkUser?.imageUrl
                        ? <img src={clerkUser.imageUrl} alt="" className="w-full h-full object-cover" />
                        : <User className="w-4 h-4 text-white" />}
                </a>
            </header>

            {/* ── Mobile drawer backdrop ── */}
            <div
                onClick={() => setMobileNavOpen(false)}
                className={`lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${mobileNavOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                aria-hidden="true"
            />

            {/* ── Sidebar (drawer on mobile, fixed on desktop) ── */}
            <aside className={`fixed left-0 top-0 bottom-0 w-72 max-w-[85vw] lg:w-64 flex flex-col border-r border-white/5 z-50 lg:z-40 bg-[#0a0514] lg:bg-[#0a0514]/80 backdrop-blur-xl transition-transform duration-300 ease-out lg:translate-x-0 ${mobileNavOpen ? "translate-x-0 shadow-2xl shadow-black" : "-translate-x-full"}`}>

                {/* Logo */}
                <div className="px-6 py-5 lg:py-6 border-b border-white/5 flex items-center justify-between">
                    <Link href="/dashboard">
                        <PrepMateLogo size="sm" variant="horizontal" animated={false} />
                    </Link>
                    <button
                        onClick={() => setMobileNavOpen(false)}
                        className="lg:hidden -mr-2 p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5"
                        aria-label="Close menu"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Nav */}
                <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
                    {navItems.map(({ href, icon: Icon, label }) => {
                        const active = pathname === href || (href !== "/dashboard" && href !== "/interview/new" && pathname.startsWith(href));
                        const interviewNewActive = href === "/interview/new" && pathname === "/interview/new";
                        const isActive = active || interviewNewActive;
                        const isLoading = loadingHref === href;
                        return (
                            <a key={href} href={href}
                                onClick={(e) => handleNavClick(e, href)}
                                className={`group flex items-center gap-3 px-3 py-3 lg:py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${isActive
                                    ? "bg-purple-500/15 text-purple-300 border border-purple-500/20 shadow-lg shadow-purple-500/10"
                                    : isLoading
                                    ? "bg-white/5 text-gray-300 border border-white/10"
                                    : "text-gray-400 hover:text-white hover:bg-white/5"
                                    }`}>
                                {isLoading ? (
                                    <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                                ) : (
                                    <Icon className={`w-4 h-4 ${isActive ? "text-purple-400" : "text-gray-500 group-hover:text-gray-300"}`} size={18} />
                                )}
                                {label}
                                {isActive && !isLoading && <ChevronRight className="w-3.5 h-3.5 ml-auto text-purple-400/60" />}
                                {isLoading && <Loader2 className="w-3 h-3 ml-auto text-purple-400/60 animate-spin" />}
                            </a>
                        );
                    })}
                </nav>

                {/* Quick action */}
                <div className="px-3 pb-4">
                    <a href="/interview/new"
                        onClick={(e) => handleNavClick(e, "/interview/new")}
                        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white text-sm font-semibold transition-all shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:scale-[1.02] cursor-pointer">
                        {loadingHref === "/interview/new" ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Sparkles className="w-4 h-4" />
                        )}
                        Start Interview
                    </a>
                </div>

                {/* User */}
                <div className="px-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] border-t border-white/5 pt-4">
                    <div className="flex items-center gap-3 px-3 py-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {clerkUser?.imageUrl
                                ? <img src={clerkUser.imageUrl} alt="" className="w-full h-full object-cover" />
                                : <User className="w-4 h-4 text-white" />
                            }
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">
                                {clerkUser?.firstName ?? "User"}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                                {clerkUser?.primaryEmailAddress?.emailAddress?.split('@')[0] ?? ""}
                            </p>
                        </div>
                        <button
                            onClick={() => signOut({ redirectUrl: "/" })}
                            className="p-2 -mr-2 text-gray-500 hover:text-red-400 transition-colors flex-shrink-0"
                            title="Sign out"
                            aria-label="Sign out"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </aside>

            {/* ── Main content ── */}
            <main className="flex-1 min-w-0 lg:ml-64 pt-14 lg:pt-0 min-h-screen relative">

                {/* Full-screen page transition overlay */}
                {loadingHref && (
                    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#0a0514]/80 backdrop-blur-sm">
                        {/* Spinner ring */}
                        <div className="relative w-16 h-16 mb-5">
                            <div className="absolute inset-0 rounded-full border-2 border-purple-500/20" />
                            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-purple-400 animate-spin" />
                            <div className="absolute inset-2 rounded-full border-2 border-transparent border-t-fuchsia-400 animate-spin [animation-duration:0.6s] [animation-direction:reverse]" />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-2 h-2 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
                            </div>
                        </div>
                        {/* Label */}
                        <p className="text-base font-bold text-white">Loading...</p>
                        <p className="text-sm text-gray-400 mt-1">Please wait</p>
                    </div>
                )}

                <div className={`transition-opacity duration-150 ${loadingHref ? "opacity-30 pointer-events-none" : "opacity-100"}`}>
                    <ErrorBoundary>
                        {children}
                    </ErrorBoundary>
                </div>
            </main>
        </div>
    );
}
