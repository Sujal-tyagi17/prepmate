import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { generateJSON, generateText } from "@/lib/ai";
import { INTERVIEW_PROMPTS } from "@/lib/prompts";
import { pickPhase, sessionTiming } from "@/lib/interview-session";

interface NextTurn {
    kind?: "intro" | "follow-up" | "new-topic" | "closing";
    transition?: string;
    question?: string;
    format?: "text" | "code";
}

/** Strip quotes/markdown the model sometimes adds around spoken text. */
function clean(text: string | undefined): string {
    return (text ?? "")
        .replace(/^["'\s]+|["'\s]+$/g, "")
        .replace(/[*_`#]/g, "")
        .trim();
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const supabase = createClient();

        // The client sends the answer it just submitted, so the next question can be generated
        // in parallel with scoring (the answer may not be in the database yet).
        let lastQuestion = "", lastAnswer = "";
        try {
            const body = await req.json();
            lastQuestion = typeof body?.lastQuestion === "string" ? body.lastQuestion : "";
            lastAnswer = typeof body?.lastAnswer === "string" ? body.lastAnswer : "";
        } catch { /* no body */ }

        const { data: interview, error: interviewError } = await supabase
            .from('interviews')
            .select(`
                *,
                answers (question_text, user_answer, score, created_at)
            `)
            .eq('id', id)
            .single();

        if (interviewError || !interview) {
            return NextResponse.json({ error: "Interview not found" }, { status: 404 });
        }

        if (interview.user_id !== user.id) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const answers: any[] = [...(interview.answers || [])].sort(
            (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        if (lastQuestion && lastAnswer && !answers.some((a) => a.question_text === lastQuestion)) {
            answers.push({ question_text: lastQuestion, user_answer: lastAnswer, score: null });
        }

        const { total, elapsed, remaining, closingWindow } = sessionTiming(interview);
        const phase = pickPhase(answers.length, remaining, closingWindow);
        const timing = { totalSeconds: total, elapsedSeconds: elapsed, remainingSeconds: remaining };

        // Time is up — tell the client to wrap up instead of asking another question.
        if (phase === "done") {
            return NextResponse.json({ success: true, done: true, ...timing });
        }

        const systemPrompt = INTERVIEW_PROMPTS.systemPrompt(
            interview.type,
            interview.difficulty,
            interview.role,
            interview.company,
            interview.resume_text,
            interview.job_description
        );

        const turnPrompt = INTERVIEW_PROMPTS.nextTurn({
            phase,
            type: interview.type,
            difficulty: interview.difficulty,
            role: interview.role ?? undefined,
            company: interview.company ?? undefined,
            hasResume: !!interview.resume_text,
            hasJobDescription: !!interview.job_description,
            transcript: answers.map((a: any) => ({ question: a.question_text, answer: a.user_answer, score: a.score })),
            elapsedMinutes: elapsed / 60,
            remainingMinutes: Math.max(0, remaining) / 60,
            totalMinutes: Math.round(total / 60),
        });

        let turn: NextTurn;
        try {
            turn = await generateJSON<NextTurn>(turnPrompt, systemPrompt);
        } catch (parseErr) {
            // Model didn't return valid JSON — fall back to plain text as the question.
            console.warn("nextTurn JSON parse failed, falling back to text:", (parseErr as any)?.message);
            const text = await generateText(
                `${turnPrompt}\n\nActually, reply with ONLY the question text — no JSON.`,
                systemPrompt
            );
            turn = { kind: phase === "core" ? "new-topic" : phase, transition: "", question: text, format: "text" };
        }

        const question = clean(turn.question);
        if (!question) {
            return NextResponse.json({ error: "Failed to generate question" }, { status: 500 });
        }

        const kind = phase === "core"
            ? (turn.kind === "follow-up" ? "follow-up" : "new-topic")
            : phase; // intro / closing are decided by time, not by the model

        return NextResponse.json({
            success: true,
            question,
            transition: phase === "intro" ? "" : clean(turn.transition),
            kind,
            format: turn.format === "code" ? "code" : "text",
            ...timing,
        });
    } catch (error: any) {
        console.error("Error generating question:", error);
        const isQuota = error?.message?.includes("quota") || error?.message?.includes("429");
        return NextResponse.json(
            { error: isQuota ? "AI quota exceeded. Please configure GROQ_API_KEY." : (error?.message || "Failed to generate question") },
            { status: isQuota ? 503 : 500 }
        );
    }
}
