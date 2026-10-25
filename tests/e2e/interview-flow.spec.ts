import { test, expect } from "@playwright/test";
import { setupPage, resetAll, createInterview, tapStart, answer, db, patchInterview, aiMode, countQuestionRequests } from "./helpers";

test.beforeEach(async ({ request }) => { await resetAll(request); });

test("start screen waits for a tap; clock starts then; intro is spoken by the interviewer @mobile", async ({ page, request }) => {
    await setupPage(page, "ios"); // speech only works after a tap, like iPhones
    const id = await createInterview(request, 10);
    const qReqs = countQuestionRequests(page);
    await page.goto(`/interview/${id}`);

    await expect(page.getByRole("button", { name: "Start Interview" })).toBeVisible();
    await page.waitForTimeout(1500);
    expect(qReqs.length).toBe(0);
    await expect(page.getByText("10:00").filter({ visible: true }).first()).toBeVisible(); // clock paused at full length

    const before = (await db(request)).interviews.find((i: any) => i.id === id).started_at;
    await tapStart(page);
    await expect(page.getByText("walking me through your background").first()).toBeVisible();
    const after = (await db(request)).interviews.find((i: any) => i.id === id).started_at;
    expect(after > before).toBeTruthy();

    const spoken: string[] = await page.evaluate(() => (window as any).__spoken);
    expect(spoken.some((t) => t.startsWith("Hi Sujal, I'm Maya"))).toBeTruthy();
    expect(spoken.some((t) => t.includes("walking me through"))).toBeTruthy();
    expect(qReqs.length).toBe(1); // first question requested exactly once
    await expect(page.getByLabel(/AI interviewer Maya/)).toBeVisible();
});

test("interviewer status follows the conversation: speaking → listening → thinking", async ({ page, request }) => {
    await setupPage(page);
    await aiMode(request, { evalDelayMs: 300 });
    const id = await createInterview(request);
    await page.goto(`/interview/${id}`);
    await tapStart(page);
    await expect(page.getByText("Speaking").first()).toBeVisible();
    await expect(page.getByText("Listening").first()).toBeVisible({ timeout: 20_000 });
    await answer(page, "I'm a final-year CSE student at VIT and interned at HCLTech.");
    await expect(page.getByText(/Thinking…|Speaking/).first()).toBeVisible();
});

test("next question arrives while the previous answer is still being scored", async ({ page, request }) => {
    await setupPage(page);
    await aiMode(request, { evalDelayMs: 5000 }); // slow scoring
    const id = await createInterview(request);
    await page.goto(`/interview/${id}`);
    await tapStart(page);
    await expect(page.getByText("walking me through your background").first()).toBeVisible();
    await page.waitForTimeout(400);

    const t0 = Date.now();
    await answer(page, "I'm a final-year CSE student at VIT; I interned at HCLTech building a Redis-backed rate limiter.");
    await expect(page.getByText("Core question number 1").first()).toBeVisible();
    expect(Date.now() - t0).toBeLessThan(4000); // didn't wait for the 5s scoring
    await expect(page.getByText("Scoring…").first()).toBeVisible();
    await expect(page.getByText(/^\d\/10$/).first()).toBeVisible({ timeout: 15_000 }); // score lands later

    // the next question was generated with the just-submitted answer in its transcript
    const log = await (await request.get("http://localhost:4555/__log")).json();
    const turn = log.filter((l: any) => l.kind === "turn")[1];
    expect(turn.user).toContain("Redis-backed rate limiter");
});

test("reload mid-interview offers Continue and resumes with the transcript", async ({ page, request }) => {
    await setupPage(page);
    const id = await createInterview(request);
    await page.goto(`/interview/${id}`);
    await tapStart(page);
    await expect(page.getByText("walking me through your background").first()).toBeVisible();
    await page.waitForTimeout(300);
    await answer(page, "Final-year student with a Redis rate-limiter internship project.");
    await expect(page.getByText("Core question number 1").first()).toBeVisible();
    await page.waitForTimeout(1500);

    const qReqs = countQuestionRequests(page);
    await page.reload();
    await expect(page.getByRole("button", { name: "Continue Interview" })).toBeVisible();
    expect(qReqs.length).toBe(0);
    await tapStart(page);
    await expect(page.getByText("Welcome back").first()).toBeVisible();
    await expect(page.getByText("reverses a singly linked list").first()).toBeVisible(); // next question after resuming
    await expect(page.getByText("Redis rate-limiter internship project")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("undefined");
    expect(qReqs.length).toBe(1);
});

test("skip, closing question near the end, then feedback with AI summary", async ({ page, request }) => {
    await setupPage(page);
    const id = await createInterview(request, 10);
    await page.goto(`/interview/${id}`);
    await tapStart(page);
    await expect(page.getByText("walking me through your background").first()).toBeVisible();
    await page.waitForTimeout(300);
    await answer(page, "I'm a CSE student who built a Redis-backed rate limiter at HCLTech.");
    await expect(page.getByText("Core question number 1").first()).toBeVisible();
    await page.waitForTimeout(300);

    await page.getByRole("button", { name: "Skip", exact: true }).click();
    await page.getByRole("button", { name: "Skip Question" }).click();
    await expect(page.getByText("(skipped)")).toBeVisible();
    await expect(page.getByText("reverses a singly linked list").first()).toBeVisible();

    await patchInterview(request, id, { started_at: new Date(Date.now() - 540_000).toISOString() });
    await page.locator("[data-testid=code-editor] .cm-content").click();
    await page.keyboard.type("def reverse(head):\n    return head");
    await page.getByRole("button", { name: "Submit" }).click();
    await expect(page.getByText("strong fit for this role").first()).toBeVisible();
    await expect(page.getByText("Wrap-up")).toBeVisible();
    await page.waitForTimeout(300);
    await answer(page, "I ship end-to-end features and care about reliability.");
    await page.waitForURL(`**/interview/${id}/feedback`);
    await expect(page.getByText("Solid communication")).toBeVisible();

    const data = await db(request);
    const iv = data.interviews.find((i: any) => i.id === id);
    expect(iv.status).toBe("completed");
    expect(iv.duration).toBeGreaterThanOrEqual(540);
    const answers = data.answers.filter((a: any) => a.interview_id === id);
    expect(answers.length).toBe(4);
    expect(answers.some((a: any) => a.user_answer === "[No answer provided]")).toBeTruthy();
    const summary = (await (await request.get("http://localhost:4555/__log")).json()).find((l: any) => l.kind === "summary");
    expect(summary.user).toContain("Redis-backed rate limiter");
    expect(summary.user).not.toContain("undefined");
});

test("time running out does not cut off an answer; submitting then ends the interview @mobile", async ({ page, request }) => {
    await setupPage(page);
    const id = await createInterview(request, 10);
    await page.goto(`/interview/${id}`);
    await tapStart(page);
    await expect(page.getByText("walking me through your background").first()).toBeVisible();
    await page.waitForTimeout(300);
    await answer(page, "Quick intro answer.");
    await expect(page.getByText("Core question number").first()).toBeVisible();

    await patchInterview(request, id, { started_at: new Date(Date.now() - 590_000).toISOString() });
    await page.reload();
    await tapStart(page);
    await expect(page.getByText("strong fit for this role").first()).toBeVisible(); // inside closing window
    await expect(page.getByRole("button", { name: "Continue Interview" })).toHaveCount(0);
    await expect(page.getByText("finish this answer and submit")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("textarea")).toBeVisible();
    await answer(page, "Wrapping up my answer after time ran out.");
    await page.waitForURL(`**/interview/${id}/feedback`);
});

test("End Interview finishes early and records the actual duration", async ({ page, request }) => {
    await setupPage(page);
    const id = await createInterview(request, 20);
    await page.goto(`/interview/${id}`);
    await tapStart(page);
    await expect(page.getByText("walking me through your background").first()).toBeVisible();
    await page.waitForTimeout(300);
    await answer(page, "Short intro answer.");
    await expect(page.getByText("Core question number").first()).toBeVisible();
    await page.getByRole("button", { name: /^End( Interview)?$/ }).filter({ visible: true }).first().click();
    await page.waitForURL(`**/interview/${id}/feedback`);
    const iv = (await db(request)).interviews.find((i: any) => i.id === id);
    expect(iv.status).toBe("completed");
    expect(iv.duration).toBeLessThan(120);
    // the answer given just before ending was scored before the summary ran
    const a = (await db(request)).answers.find((x: any) => x.interview_id === id);
    expect(a.score).toBeGreaterThan(0);
});

test("leaving during the intro sends no further question requests", async ({ page, request }) => {
    await setupPage(page);
    const id = await createInterview(request, 15);
    await page.goto(`/interview/${id}`);
    const qReqs = countQuestionRequests(page);
    await tapStart(page);
    await page.waitForTimeout(100);
    await page.goto("/dashboard");
    await page.waitForTimeout(3000);
    expect(qReqs.length).toBeLessThanOrEqual(1); // only the one fetched during the intro
});
