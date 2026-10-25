/**
 * Single source of truth for interview scores, shared by the feedback page,
 * analytics, dashboard and history so they always show the same number.
 *
 * Answer scores are stored 0–10. Displayed scores are 0–100.
 * Skipped questions are not scored (they're reported separately).
 */

export const SKIPPED_ANSWER = "[No answer provided]";

type AnswerLike = { user_answer?: string | null; userAnswer?: string | null; score?: number | null };

export function isSkipped(a: AnswerLike): boolean {
    return (a.user_answer ?? a.userAnswer) === SKIPPED_ANSWER;
}

/** Scores (0–10) of the questions that were actually answered. */
export function answeredScores(answers: AnswerLike[] = []): number[] {
    return answers
        .filter((a) => !isSkipped(a))
        .map((a) => Number(a.score))
        .filter((s) => Number.isFinite(s) && s > 0);
}

/** Overall interview score, 0–100 (0 if nothing was answered). */
export function interviewScore(answers: AnswerLike[] = []): number {
    const s = answeredScores(answers);
    return s.length ? Math.round((s.reduce((a, b) => a + b, 0) / s.length) * 10) : 0;
}

/** "45m" under an hour, otherwise "1.5h". */
export function formatPracticeTime(totalMinutes: number): string {
    const m = Math.max(0, Math.round(totalMinutes || 0));
    return m < 60 ? `${m}m` : `${(m / 60).toFixed(m < 600 ? 1 : 0)}h`;
}
