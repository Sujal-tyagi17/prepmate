import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { generateText } from "@/lib/ai";
import { INTERVIEW_PROMPTS } from "@/lib/prompts";

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

        const { data: interview, error: interviewError } = await supabase
            .from('interviews')
            .select(`
                *,
                answers (question_text)
            `)
            .eq('id', id)
            .single();

        if (interviewError || !interview) {
            return NextResponse.json({ error: "Interview not found" }, { status: 404 });
        }

        if (interview.user_id !== user.id) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Collect previous questions to avoid repeats
        const previousQuestions = (interview.answers || []).map((a: any) => a.question_text);

        const systemPrompt = INTERVIEW_PROMPTS.systemPrompt(
            interview.type,
            interview.difficulty,
            interview.role,
            interview.company,
            interview.resume_text,
            interview.job_description
        );
        const userPrompt = INTERVIEW_PROMPTS.generateQuestion(
            interview.type,
            interview.difficulty,
            previousQuestions,
            interview.role,
            interview.resume_text,
            interview.job_description
        );

        const question = await generateText(userPrompt, systemPrompt);

        if (!question) {
            return NextResponse.json(
                { error: "Failed to generate question" },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true, question });
    } catch (error: any) {
        console.error("Error generating question:", error);
        const isQuota = error?.message?.includes("quota") || error?.message?.includes("429");
        return NextResponse.json(
            { error: isQuota ? "AI quota exceeded. Please configure GROQ_API_KEY." : (error?.message || "Failed to generate question") },
            { status: isQuota ? 503 : 500 }
        );
    }
}
