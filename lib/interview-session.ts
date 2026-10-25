/**
 * Session timing for time-boxed interviews.
 *
 * The planned length is stored (in seconds) in `interviews.duration` while the
 * interview is in progress. When the interview is completed, the PATCH route
 * overwrites it with the actual elapsed time, which is what analytics uses.
 */

export const DEFAULT_SESSION_SECONDS = 15 * 60;
export const MAX_SESSION_SECONDS = 30 * 60;

export type InterviewPhase = "intro" | "core" | "closing";

export function plannedSessionSeconds(interview: { duration?: number | null }): number {
    const d = Number(interview?.duration);
    if (!d || d <= 0) return DEFAULT_SESSION_SECONDS; // interviews created before time-boxing existed
    return Math.min(MAX_SESSION_SECONDS, d);
}

/** How long before the end the interviewer starts wrapping up (one closing question). */
export function closingWindowSeconds(totalSeconds: number): number {
    return Math.round(Math.min(210, Math.max(90, totalSeconds * 0.12)));
}

export function sessionTiming(
    interview: { duration?: number | null; started_at?: string | null; created_at?: string | null },
    now: number = Date.now()
) {
    const total = plannedSessionSeconds(interview);
    const startIso = interview.started_at || interview.created_at;
    const start = startIso ? new Date(startIso).getTime() : now;
    const elapsed = Math.max(0, Math.floor((now - start) / 1000));
    const remaining = total - elapsed;
    return { total, elapsed, remaining, closingWindow: closingWindowSeconds(total) };
}

export function pickPhase(answerCount: number, remaining: number, closingWindow: number): InterviewPhase | "done" {
    if (remaining <= 0 && answerCount > 0) return "done";
    if (answerCount === 0) return "intro";
    if (remaining <= closingWindow) return "closing";
    return "core";
}
