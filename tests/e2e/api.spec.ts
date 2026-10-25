import { test, expect } from "@playwright/test";
import { resetAll, createInterview, db, patchInterview, aiMode, AI } from "./helpers";

test.beforeEach(async ({ request }) => { await resetAll(request); });

const ago = (s: number) => new Date(Date.now() - s * 1000).toISOString();

test("session length is clamped to 5–30 minutes (default 15)", async ({ request }) => {
    const sec = async (body: any) => (await (await request.post("/api/interview/create", { data: { type: "technical", difficulty: "easy", ...body } })).json()).interview.durationSeconds;
    expect(await sec({ durationMinutes: 90 })).toBe(1800);
    expect(await sec({ durationMinutes: 1 })).toBe(300);
    expect(await sec({})).toBe(900);
});

test("phases are driven by the clock: intro → core → closing → done", async ({ request }) => {
    const id = await createInterview(request, 10);
    const ask = async (body: any = {}) => (await request.post(`/api/interview/${id}/question`, { data: body })).json();

    const q1 = await ask();
    expect(q1.kind).toBe("intro");
    expect(q1.transition).toBe("");
    // the just-given answer is included even before it is saved
    const q2 = await ask({ lastQuestion: q1.question, lastAnswer: "My background is in distributed caching." });
    expect(["follow-up", "new-topic"]).toContain(q2.kind);
    const log = await (await request.get(`${AI}/__log`)).json();
    expect(log.filter((l: any) => l.kind === "turn")[1].user).toContain("distributed caching");

    await request.post(`/api/interview/${id}/evaluate`, { data: { question: q1.question, answer: "My background is in distributed caching." } });
    await patchInterview(request, id, { started_at: ago(530) });
    expect((await ask()).kind).toBe("closing");
    await patchInterview(request, id, { started_at: ago(605) });
    expect((await ask()).done).toBe(true);
});

test("evaluate saves first, stores rubric + stronger answer, and supports re-scoring", async ({ request }) => {
    const id = await createInterview(request);
    const ok = await (await request.post(`/api/interview/${id}/evaluate`, { data: { question: "Q?", answer: "A reasonably detailed answer about trade-offs." } })).json();
    expect(ok.success).toBe(true);
    expect(ok.evaluation.rubric.communication).toBe(8);
    expect(ok.evaluation.strongerAnswer).toContain("stronger answer");
    const row = (await db(request)).answers[0];
    expect(JSON.parse(row.feedback)["pm.v2"]).toBe(true);

    await aiMode(request, { evalFail: 3 });
    const failed = await request.post(`/api/interview/${id}/evaluate`, { data: { question: "Q2?", answer: "Second answer." } });
    expect(failed.status()).toBe(502);
    const fb = await failed.json();
    expect(fb.saved).toBe(true);
    const retry = await (await request.post(`/api/interview/${id}/evaluate`, { data: { question: "Q2?", answer: "Second answer.", answerId: fb.answerId } })).json();
    expect(retry.success).toBe(true);
    const rows = (await db(request)).answers.filter((a: any) => a.question_text === "Q2?");
    expect(rows.length).toBe(1);
    expect(rows[0].score).toBeGreaterThan(0);
});

test("completing records real duration (even with no answers) and is idempotent", async ({ request }) => {
    const id = await createInterview(request, 15);
    const done = await (await request.patch(`/api/interview/${id}`, { data: { status: "completed" } })).json();
    expect(done.interview.status).toBe("completed");
    expect(done.interview.duration).toBeLessThan(60);
    expect(done.interview.completed_at).toBeTruthy();
    await patchInterview(request, id, { duration: 42 });
    const again = await (await request.patch(`/api/interview/${id}`, { data: { status: "completed" } })).json();
    expect(again.interview.duration).toBe(42);
});

test("falls back to plain text when the model returns invalid JSON", async ({ request }) => {
    const id = await createInterview(request, 20);
    await aiMode(request, { badJson: 1 });
    const q = await (await request.post(`/api/interview/${id}/question`, { data: {} })).json();
    expect(q.success).toBe(true);
    expect(q.question).toBe("How do closures work in JavaScript?");
});

test("test control endpoint is only available in E2E mode", async ({ request }) => {
    // sanity check that the harness is active (in production this route returns 404)
    expect((await request.get("/api/testctl")).status()).toBe(200);
});
