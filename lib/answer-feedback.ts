/**
 * Rich per-answer feedback, stored as JSON inside the existing `answers.feedback`
 * text column (no database migration needed). Older rows hold plain text and are
 * still read correctly by parseFeedback().
 */

export const RUBRIC = [
    { key: "communication", label: "Communication Clarity" },
    { key: "depth", label: "Depth & Accuracy" },
    { key: "structure", label: "Structure" },
    { key: "examples", label: "Use of Examples" },
    { key: "conciseness", label: "Conciseness" },
] as const;

export type RubricKey = (typeof RUBRIC)[number]["key"];
export type Rubric = Partial<Record<RubricKey, number>>;

export interface RichFeedback {
    text: string;
    strongerAnswer?: string;
    rubric?: Rubric;
}

const MARKER = "pm.v2";

export function packFeedback(f: RichFeedback): string {
    const rubric: Rubric = {};
    for (const { key } of RUBRIC) {
        const v = Number(f.rubric?.[key]);
        if (Number.isFinite(v)) rubric[key] = Math.min(10, Math.max(0, Math.round(v)));
    }
    return JSON.stringify({ [MARKER]: true, text: f.text || "", strongerAnswer: f.strongerAnswer || undefined, rubric });
}

export function parseFeedback(raw: string | null | undefined): RichFeedback {
    if (!raw) return { text: "" };
    if (raw.startsWith("{") && raw.includes(MARKER)) {
        try {
            const o = JSON.parse(raw);
            if (o && o[MARKER]) return { text: o.text || "", strongerAnswer: o.strongerAnswer, rubric: o.rubric || {} };
        } catch {
            /* fall through to plain text */
        }
    }
    return { text: raw };
}

/** Average each rubric dimension across answers (0–100), only where scores exist. */
export function averageRubric(feedbacks: (string | null | undefined)[]): { key: RubricKey; label: string; score: number; n: number }[] {
    const parsed = feedbacks.map(parseFeedback);
    return RUBRIC.map(({ key, label }) => {
        const vals = parsed.map((p) => p.rubric?.[key]).filter((v): v is number => typeof v === "number");
        return { key, label, n: vals.length, score: vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) : 0 };
    }).filter((r) => r.n > 0);
}
