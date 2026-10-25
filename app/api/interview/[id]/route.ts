import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { generateJSON } from "@/lib/ai";
import { INTERVIEW_PROMPTS } from "@/lib/prompts";
import { sendEmail } from "@/lib/email";
import { emailTemplates } from "@/lib/email-templates";

interface SummaryResult {
    overallScore: number;
    overallFeedback: string;
    strengths: string[];
    areasForImprovement: string[];
    recommendations: string[];
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { id } = await params;
        const supabase = createClient();
        
        const { data: interview, error } = await supabase
            .from('interviews')
            .select(`
                *,
                answers (*)
            `)
            .eq('id', id)
            .single();

        if (error || !interview) {
            return NextResponse.json({ error: "Interview not found" }, { status: 404 });
        }

        if (interview.user_id !== user.id) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Add user info to the response
        interview.user = {
            name: user.name,
            email: user.email
        };

        return NextResponse.json({ success: true, interview });
    } catch (error) {
        console.error("Error fetching interview:", error);
        return NextResponse.json({ error: "Failed to fetch interview" }, { status: 500 });
    }
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { id } = await params;
        const supabase = createClient();

        const body = await req.json();
        const { status, overallScore, overallFeedback, start } = body;

        // First, fetch the interview to verify ownership and get current answers
        const { data: interview, error: fetchError } = await supabase
            .from('interviews')
            .select(`
                *,
                answers (*)
            `)
            .eq('id', id)
            .single();

        if (fetchError || !interview) {
            return NextResponse.json({ error: "Interview not found" }, { status: 404 });
        }

        if (interview.user_id !== user.id) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const updates: any = {};

        // Candidate tapped "Start" — the session clock begins now (only before any answers)
        if (start === true && interview.status === "in-progress" && (interview.answers || []).length === 0) {
            updates.started_at = new Date().toISOString();
        }
        if (status) updates.status = status;
        if (overallScore !== undefined) updates.overall_score = overallScore;
        if (overallFeedback) updates.overall_feedback = overallFeedback;

        // When completing, always record the real end time and actual duration
        // (while in progress, `duration` holds the planned session length).
        if (status === "completed" && interview.status !== "completed") {
            updates.completed_at = new Date().toISOString();
            updates.duration = Math.floor(
                (new Date(updates.completed_at).getTime() - new Date(interview.started_at).getTime()) / 1000
            );
        }

        // If completing with answers, generate the AI summary
        if (status === "completed" && interview.status !== "completed" && interview.answers && interview.answers.length > 0) {
            // Summarize in the order the questions were asked
            interview.answers.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

            // Generate comprehensive summary with Gemini
            try {
                const summary = await generateJSON<SummaryResult>(
                    INTERVIEW_PROMPTS.generateSummary(interview.answers)
                );
                updates.overall_score = Math.min(10, Math.max(0, summary.overallScore ?? 7));
                updates.overall_feedback = summary.overallFeedback;
            } catch (aiError) {
                console.error("AI summary generation failed, using fallback:", aiError);
                // Fallback: calc average score manually
                const scores = interview.answers.map((a: any) => a.score ?? 0);
                updates.overall_score = scores.length > 0 
                    ? Math.round((scores.reduce((s: number, n: number) => s + n, 0) / scores.length) * 10) / 10 
                    : 0;
            }
        }

        const { data: updatedInterview, error: updateError } = await supabase
            .from('interviews')
            .update(updates)
            .eq('id', id)
            .select(`
                *,
                answers (*)
            `)
            .single();

        if (updateError) {
            console.error("Error updating interview:", updateError);
            return NextResponse.json({ error: "Failed to update interview" }, { status: 500 });
        }

        // Send score update email when interview is completed
        if (status === "completed" && updatedInterview?.overall_score) {
            try {
                // Get user's notification preferences
                const { data: userData } = await supabase
                    .from('users')
                    .select('notification_score_updates, average_score')
                    .eq('id', user.id)
                    .single();

                if (userData?.notification_score_updates) {
                    const currentScore = Math.round(updatedInterview.overall_score * 10);
                    const previousScore = Math.round((userData.average_score || 0) * 10);
                    
                    const scoreEmail = emailTemplates.scoreUpdate(
                        user.name,
                        currentScore,
                        previousScore
                    );
                    
                    await sendEmail({
                        to: user.email,
                        subject: scoreEmail.subject,
                        html: scoreEmail.html
                    });
                    
                    console.log("[INTERVIEW] Score update email sent to:", user.email);
                }
            } catch (emailError) {
                console.error("[INTERVIEW] Failed to send score update email:", emailError);
                // Don't fail the request if email fails
            }
        }

        return NextResponse.json({ success: true, interview: updatedInterview });
    } catch (error) {
        console.error("Error updating interview:", error);
        return NextResponse.json({ error: "Failed to update interview" }, { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { id } = await params;
        const supabase = createClient();

        // Verify ownership before deleting
        const { data: interview, error: fetchError } = await supabase
            .from('interviews')
            .select('user_id')
            .eq('id', id)
            .single();

        if (fetchError || !interview) {
            return NextResponse.json({ error: "Interview not found" }, { status: 404 });
        }

        if (interview.user_id !== user.id) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Answers will be automatically deleted via CASCADE
        const { error: deleteError } = await supabase
            .from('interviews')
            .delete()
            .eq('id', id);

        if (deleteError) {
            console.error("Error deleting interview:", deleteError);
            return NextResponse.json({ error: "Failed to delete interview" }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: "Interview deleted" });
    } catch (error) {
        console.error("Error deleting interview:", error);
        return NextResponse.json({ error: "Failed to delete interview" }, { status: 500 });
    }
}
