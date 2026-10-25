import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { answeredScores, interviewScore } from "@/lib/scoring";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const supabase = createClient();

        // Fetch completed interviews with their answers
        const { data: interviews, error: interviewError } = await supabase
            .from('interviews')
            .select(`
                *,
                answers (*)
            `)
            .eq('user_id', user.id)
            .eq('status', 'completed')
            .order('completed_at', { ascending: false });

        // Fetch ALL other interviews (in-progress, abandoned) for history page
        const { data: otherInterviews } = await supabase
            .from('interviews')
            .select(`
                *,
                answers (*)
            `)
            .eq('user_id', user.id)
            .neq('status', 'completed')
            .order('created_at', { ascending: false });

        // Combine all interviews for history
        const allInterviewsData = [
            ...(interviews || []),
            ...(otherInterviews || [])
        ].sort((a, b) => {
            const dateA = new Date(a.completed_at || a.started_at || a.created_at).getTime();
            const dateB = new Date(b.completed_at || b.started_at || b.created_at).getTime();
            return dateB - dateA;
        });

        if (interviewError) {
            console.error("Error fetching interviews:", interviewError);
            return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
        }

        const totalInterviews = interviews?.length || 0;

        // Average across every answered question (skips excluded), 0–100
        const allScores = (interviews || []).flatMap((iv: any) => answeredScores(iv.answers || []));
        const averageScore =
            allScores.length > 0
                ? Math.round((allScores.reduce((s: number, n: number) => s + n, 0) / allScores.length) * 10)
                : 0;

        // Best single-interview score, 0–100 (same rule as the feedback page)
        const bestScore = (interviews || []).reduce((m: number, iv: any) => Math.max(m, interviewScore(iv.answers || [])), 0);

        // Calculate streak (consecutive days with interviews)
        // Use UTC ISO date (YYYY-MM-DD) to avoid server timezone shifting dates
        const toUTCDate = (ts: string | null): string | null => {
            if (!ts) return null;
            const d = new Date(ts);
            return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
        };
        const interviewDates = interviews
            ?.map((iv: any) => toUTCDate(iv.completed_at || iv.started_at || iv.created_at))
            .filter(Boolean) as string[] || [];
        const uniqueDates = Array.from(new Set(interviewDates)).sort().reverse();
        
        let streak = 0;
        const todayUTC = toUTCDate(new Date().toISOString())!;
        const yesterdayUTC = toUTCDate(new Date(Date.now() - 86400000).toISOString())!;
        if (uniqueDates.includes(todayUTC) || (uniqueDates.length > 0 && uniqueDates[0] === yesterdayUTC)) {
            streak = 1;
            for (let i = 1; i < uniqueDates.length; i++) {
                const prevDate = new Date(uniqueDates[i - 1]);
                const currDate = new Date(uniqueDates[i]);
                const diffDays = Math.floor((prevDate.getTime() - currDate.getTime()) / 86400000);
                if (diffDays === 1) {
                    streak++;
                } else {
                    break;
                }
            }
        }

        // Calculate total time
        const totalMinutes = Math.round(
            (interviews || []).reduce((s: number, iv: any) => s + (iv.duration ?? 0), 0) / 60
        );

        // Category breakdown
        const categoryStats: Record<string, { count: number; avgScore: number }> = {};
        (interviews || []).forEach((iv: any) => {
            if (!categoryStats[iv.type]) categoryStats[iv.type] = { count: 0, avgScore: 0 };
            categoryStats[iv.type].count++;
            const scores = (iv.answers || []).map((a: any) => a.score ?? 0);
            const avg = scores.length > 0 ? scores.reduce((s: number, n: number) => s + n, 0) / scores.length : 0;
            categoryStats[iv.type].avgScore =
                (categoryStats[iv.type].avgScore * (categoryStats[iv.type].count - 1) + avg) /
                categoryStats[iv.type].count;
        });

        // Performance trend (last 12 interviews)
        const performanceTrend = (interviews || [])
            .slice(0, 12)
            .reverse()
            .map((iv: any) => {
                return {
                    date: iv.completed_at,
                    score: interviewScore(iv.answers || []) / 10, // 0–10, one decimal
                    type: iv.type,
                };
            });

        // Strengths / improvements aggregation
        const strengthCounts: Record<string, number> = {};
        const improvementCounts: Record<string, number> = {};
        (interviews || []).forEach((iv: any) =>
            (iv.answers || []).forEach((a: any) => {
                ((a.strengths || []) as string[]).forEach((s: string) => { 
                    strengthCounts[s] = (strengthCounts[s] ?? 0) + 1; 
                });
                ((a.improvements || []) as string[]).forEach((i: string) => { 
                    improvementCounts[i] = (improvementCounts[i] ?? 0) + 1; 
                });
            })
        );

        const topStrengths = Object.entries(strengthCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([k]) => k);
        
        const topImprovements = Object.entries(improvementCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([k]) => k);

        // Interview type breakdown (for pie chart)
        const typeBreakdown: Record<string, number> = {};
        (interviews || []).forEach((iv: any) => {
            typeBreakdown[iv.type] = (typeBreakdown[iv.type] || 0) + 1;
        });

        // Send raw timestamps — heatmap is computed client-side
        // so it uses the user's browser timezone, not the server's UTC timezone.
        const completedTimestamps = (interviews || [])
            .map((iv: any) => iv.completed_at || iv.started_at || iv.created_at)
            .filter(Boolean) as string[];

        // Topic performance (from question categories if available)
        const topicScores: Record<string, { total: number; count: number }> = {};
        (interviews || []).forEach((iv: any) => {
            (iv.answers || []).forEach((a: any) => {
                // Use interview type as topic for now (you can enhance this with question categories)
                const topic = iv.type;
                if (!topicScores[topic]) topicScores[topic] = { total: 0, count: 0 };
                if (a.score) {
                    topicScores[topic].total += a.score * 10;
                    topicScores[topic].count++;
                }
            });
        });
        
        const topicPerformance = Object.entries(topicScores).map(([topic, data]) => ({
            topic: topic.charAt(0).toUpperCase() + topic.slice(1).replace('-', ' '),
            score: data.count > 0 ? Math.round(data.total / data.count) : 0,
            count: data.count
        }));

        return NextResponse.json({
            success: true,
            analytics: {
                totalInterviews,
                averageScore,
                bestScore,
                streak,
                totalMinutes,
                categoryStats,
                typeBreakdown,
                topicPerformance,
                completedTimestamps,
                performanceTrend,
                topStrengths,
                topImprovements,
                recentInterviews: (interviews || []).slice(0, 5).map((iv: any) => ({
                    id: iv.id,
                    type: iv.type,
                    difficulty: iv.difficulty,
                    role: iv.role,
                    company: iv.company,
                    date: iv.completed_at || iv.started_at || iv.created_at,
                    status: iv.status,
                    questionsCount: (iv.answers || []).length,
                    score: interviewScore(iv.answers || []), // 0–100, same as feedback page
                })),
                allInterviews: allInterviewsData.map((iv: any) => ({
                    id: iv.id,
                    type: iv.type,
                    difficulty: iv.difficulty,
                    role: iv.role,
                    company: iv.company,
                    date: iv.completed_at || iv.started_at || iv.created_at,
                    status: iv.status,
                    questionsCount: (iv.answers || []).length,
                    score: interviewScore(iv.answers || []), // 0–100, same as feedback page
                })),
            },
        });
    } catch (error) {
        console.error("Error fetching analytics:", error);
        return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
    }
}
