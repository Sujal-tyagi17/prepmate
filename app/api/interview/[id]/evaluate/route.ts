import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { generateJSON } from "@/lib/ai";
import { INTERVIEW_PROMPTS } from "@/lib/prompts";
import { packFeedback, type Rubric } from "@/lib/answer-feedback";
import { SKIPPED_ANSWER } from "@/lib/scoring";

interface EvaluationResult {
    score: number;
    feedback: string;
    strengths: string[];
    improvements: string[];
    rubric?: Rubric;
    strongerAnswer?: string;
}

/**
 * Save an answer and score it.
 * - The answer row is inserted FIRST, so it is never lost even if the AI call fails.
 * - Pass `answerId` to re-score an already-saved answer (retry after a failure).
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { question, answer, skipped, answerId } = body;

        if (!question) {
            return NextResponse.json({ error: "Question is required" }, { status: 400 });
        }

        const { id } = await params;
        const supabase = createClient();

        const { data: interview, error: fetchError } = await supabase
            .from('interviews')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !interview) {
            return NextResponse.json({ error: "Interview not found" }, { status: 404 });
        }
        if (interview.user_id !== user.id) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Skipped question — save with score 0, no AI evaluation needed
        if (skipped || !answer || answer.trim() === SKIPPED_ANSWER) {
            const { error: insertError } = await supabase
                .from('answers')
                .insert({
                    interview_id: id,
                    question_text: question,
                    user_answer: SKIPPED_ANSWER,
                    score: 0,
                    feedback: "This question was skipped.",
                    strengths: [],
                    improvements: ["Answer all questions to receive complete feedback."],
                });
            if (insertError) {
                console.error("Error inserting skipped answer:", insertError);
                return NextResponse.json({ error: "Failed to save skipped question" }, { status: 500 });
            }
            return NextResponse.json({ success: true, skipped: true });
        }

        // 1) Persist the answer (or find the existing one when re-scoring)
        let rowId: string | null = answerId ?? null;
        if (rowId) {
            const { data: existing } = await supabase
                .from('answers')
                .select('id, interview_id')
                .eq('id', rowId)
                .single();
            if (!existing || existing.interview_id !== id) {
                return NextResponse.json({ error: "Answer not found" }, { status: 404 });
            }
        } else {
            const base = { interview_id: id, question_text: question, user_answer: answer, feedback: "Scoring in progress…", strengths: [], improvements: [] };
            let { data: inserted, error: insertError } = await supabase
                .from('answers').insert({ ...base, score: null }).select('id').single();
            if (insertError) {
                // Some schemas don't allow a null score — fall back to 0 ("not scored yet")
                ({ data: inserted, error: insertError } = await supabase
                    .from('answers').insert({ ...base, score: 0 }).select('id').single());
            }
            if (insertError || !inserted) {
                console.error("Error inserting answer:", insertError);
                return NextResponse.json({ error: "Failed to save answer" }, { status: 500 });
            }
            rowId = inserted.id;
        }

        // 2) Score it with the AI
        try {
            const systemPrompt = INTERVIEW_PROMPTS.systemPrompt(
                interview.type,
                interview.difficulty,
                interview.role,
                interview.company,
                interview.resume_text,
                interview.job_description
            );
            const evaluation = await generateJSON<EvaluationResult>(
                INTERVIEW_PROMPTS.evaluateAnswer(question, answer, interview.type),
                systemPrompt
            );
            const score = Math.min(10, Math.max(0, Math.round(Number(evaluation.score ?? 5))));
            const strengths = Array.isArray(evaluation.strengths) ? evaluation.strengths : [];
            const improvements = Array.isArray(evaluation.improvements) ? evaluation.improvements : [];

            const { error: updateError } = await supabase
                .from('answers')
                .update({
                    score,
                    feedback: packFeedback({ text: evaluation.feedback ?? "", strongerAnswer: evaluation.strongerAnswer, rubric: evaluation.rubric }),
                    strengths,
                    improvements,
                })
                .eq('id', rowId);
            if (updateError) throw updateError;

            return NextResponse.json({
                success: true,
                answerId: rowId,
                evaluation: { score, feedback: evaluation.feedback, strengths, improvements, strongerAnswer: evaluation.strongerAnswer, rubric: evaluation.rubric },
            });
        } catch (aiError: any) {
            console.error("Answer saved but scoring failed:", aiError?.message ?? aiError);
            await supabase.from('answers').update({ feedback: "Scoring was unavailable for this answer." }).eq('id', rowId);
            // The answer IS saved — tell the client so it can offer a retry instead of losing it
            return NextResponse.json({ success: false, saved: true, answerId: rowId, error: "Scoring failed" }, { status: 502 });
        }
    } catch (error) {
        console.error("Error evaluating answer:", error);
        return NextResponse.json({ error: "Failed to evaluate answer" }, { status: 500 });
    }
}
