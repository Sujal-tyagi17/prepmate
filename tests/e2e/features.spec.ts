import { test, expect, type Page } from "@playwright/test";
import { setupPage, resetAll, createInterview, tapStart, answer, db, aiMode } from "./helpers";

test.beforeEach(async ({ request }) => { await resetAll(request); });

async function startAndAnswerIntro(page: Page, request: any, minutes = 10) {
    const id = await createInterview(request, minutes);
    await page.goto(`/interview/${id}`);
    await tapStart(page);
    await expect(page.getByText("walking me through your background").first()).toBeVisible();
    await page.waitForTimeout(300);
    return id;
}

test("coding questions open the code editor and the answer is saved as fenced code @mobile", async ({ page, request }) => {
    await setupPage(page);
    const id = await startAndAnswerIntro(page, request);
    await expect(page.getByTestId("code-editor")).toHaveCount(0); // normal questions: plain text box
    await answer(page, "Final-year CSE student.");
    await expect(page.getByText("Core question number 1").first()).toBeVisible();
    await page.waitForTimeout(300);
    await answer(page, "I'd shard by user id and cache hot keys.");

    await expect(page.getByText("reverses a singly linked list").first()).toBeVisible();
    await expect(page.getByTestId("code-editor")).toBeVisible();
    await page.getByLabel("Programming language").selectOption("cpp");
    await page.locator("[data-testid=code-editor] .cm-content").click();
    await page.keyboard.type("Node* reverse(Node* h) { return h; }");
    await page.locator("textarea").fill("Iterate and flip next pointers; O(n) time, O(1) space.");
    await page.getByRole("button", { name: "Submit" }).click();

    await expect(page.locator("pre code").filter({ hasText: "Node* reverse" })).toBeVisible();
    await expect.poll(async () => (await db(request)).answers.find((a: any) => a.interview_id === id && a.user_answer.includes("```cpp"))?.score ?? 0).toBeGreaterThan(0);
    const evalPrompt = (await (await request.get("http://localhost:4555/__log")).json()).filter((l: any) => l.kind === "eval").pop();
    expect(evalPrompt.user).toContain("fenced block");
});

test("hands-free mode submits after silence, and 'Not yet' cancels it", async ({ page, request }) => {
    await setupPage(page);
    const id = await createInterview(request, 10);
    await page.goto(`/interview/${id}`);
    await page.getByRole("button", { name: "Hands-free Off" }).click();
    await expect(page.getByRole("button", { name: "Hands-free On" })).toBeVisible();
    await tapStart(page);
    await expect(page.getByText("walking me through your background").first()).toBeVisible();
    await expect(page.getByText("Listening").first()).toBeVisible();

    // "Not yet" pauses the auto-submit
    await expect.poll(() => page.evaluate(() => (window as any).__say("I am a final year student"))).toBe(true);
    await expect(page.getByText(/Auto-submitting in \ds/)).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: "Not yet" }).click();
    await page.waitForTimeout(4500);
    expect((await db(request)).answers.length).toBe(0);

    // after pausing, the candidate submits manually; on the next question hands-free works again
    await page.getByRole("button", { name: "Submit" }).click();
    await expect(page.getByText("Core question number 1").first()).toBeVisible();
    await expect.poll(() => page.evaluate(() => (window as any).__say("I would shard the data by user id and add a cache"))).toBe(true);
    await expect(page.getByText(/Auto-submitting in \ds/)).toBeVisible({ timeout: 5000 });
    await expect.poll(async () => (await db(request)).answers.length, { timeout: 10_000 }).toBe(2);
    expect((await db(request)).answers[1].user_answer).toContain("shard the data");
});

test("the AI voice uses the speed chosen in Settings", async ({ page, request }) => {
    await setupPage(page);
    await request.get("/api/user/profile"); // creates the test user
    await request.patch("/api/user/profile", { data: { voiceSpeed: 1.5 } });
    await startAndAnswerIntro(page, request);
    const rates: number[] = await page.evaluate(() => (window as any).__rates);
    expect(rates.length).toBeGreaterThan(0);
    for (const r of rates) expect(r).toBeCloseTo(1.425, 3);
});

test("if scoring fails the answer is kept and can be re-scored", async ({ page, request }) => {
    await setupPage(page);
    const id = await startAndAnswerIntro(page, request);
    await aiMode(request, { evalFail: 3 }); // SDK makes 3 attempts → scoring fails
    await answer(page, "My answer that the AI fails to score the first time.");
    await expect(page.getByRole("button", { name: /Not scored · Retry/ })).toBeVisible();
    let rows = (await db(request)).answers.filter((a: any) => a.interview_id === id);
    expect(rows.length).toBe(1); // saved even though scoring failed
    await page.getByRole("button", { name: /Not scored · Retry/ }).click();
    await expect(page.getByText(/^\d\/10$/).first()).toBeVisible();
    rows = (await db(request)).answers.filter((a: any) => a.interview_id === id);
    expect(rows.length).toBe(1);
    expect(rows[0].score).toBeGreaterThan(0);
});

test("if the network drops, the answer is not lost and Retry saves it", async ({ page, request }) => {
    await setupPage(page);
    const id = await startAndAnswerIntro(page, request);
    await page.route("**/evaluate", (r) => r.abort());
    await answer(page, "Answer sent while offline.");
    await expect(page.getByRole("button", { name: /Not saved · Retry/ })).toBeVisible({ timeout: 15_000 });
    await page.unroute("**/evaluate");
    await page.getByRole("button", { name: /Not saved · Retry/ }).click();
    await expect(page.getByText(/^\d\/10$/).first()).toBeVisible();
    expect((await db(request)).answers.filter((a: any) => a.interview_id === id && a.user_answer === "Answer sent while offline.").length).toBe(1);
});

test("feedback shows real rubric skills, stronger answers and personal progress — no made-up stats", async ({ page, request }) => {
    await setupPage(page);
    // first interview
    let id = await startAndAnswerIntro(page, request);
    await answer(page, "I'm a CSE student; I built a Redis-backed rate limiter at HCLTech for an internal API.");
    await expect(page.getByText("Core question number 1").first()).toBeVisible();
    await page.getByRole("button", { name: /^End( Interview)?$/ }).filter({ visible: true }).first().click();
    await page.waitForURL(`**/interview/${id}/feedback`);

    const body = page.locator("body");
    await expect(page.getByText("Skill Breakdown")).toBeVisible();
    await expect(page.getByText("Communication Clarity")).toBeVisible();
    await expect(page.getByText("80%").first()).toBeVisible(); // rubric communication 8/10
    await expect(page.getByText("first completed interview")).toBeVisible();
    await expect(body).not.toContainText("of all users");
    await expect(body).not.toContainText("Percentile");
    await expect(body).not.toContainText("Platform Average");
    await page.getByRole("button", { name: /Answered Questions/ }).click();
    await expect(page.getByText("A stronger answer would include").first()).toBeVisible();

    // second interview → compared against the first
    await request.post("http://localhost:4555/__reset");
    id = await startAndAnswerIntro(page, request);
    await answer(page, "Short answer.");
    await expect(page.getByText("Core question number 1").first()).toBeVisible();
    await page.getByRole("button", { name: /^End( Interview)?$/ }).filter({ visible: true }).first().click();
    await page.waitForURL(`**/interview/${id}/feedback`);
    await expect(page.getByText("Your Average (1)")).toBeVisible();
    await expect(page.getByText(/pts vs your average/)).toBeVisible();
});

test("dashboard, analytics, history and feedback agree on the score; pages render cleanly", async ({ page, request }) => {
    await setupPage(page);
    const id = await startAndAnswerIntro(page, request);
    await answer(page, "I'm a CSE student; I built a Redis-backed rate limiter at HCLTech for an internal API.");
    await expect(page.getByText("Core question number 1").first()).toBeVisible();
    await page.getByRole("button", { name: /^End( Interview)?$/ }).filter({ visible: true }).first().click();
    await page.waitForURL(`**/interview/${id}/feedback`);
    await expect(page.getByText("Overall").first()).toBeVisible();
    const fbPct = Number(((await page.locator("body").innerText()).match(/(\d+)%\s*Overall/) || [])[1]);

    const an = (await (await request.get("/api/analytics")).json()).analytics;
    expect(fbPct).toBeGreaterThan(0);
    expect(an.allInterviews.find((i: any) => i.id === id).score).toBe(fbPct);
    expect(an.recentInterviews.find((i: any) => i.id === id).score).toBe(fbPct);

    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    for (const p of ["/dashboard", "/analytics", "/history", "/profile", "/interview/new"]) {
        await page.goto(p);
        await page.waitForTimeout(1500);
        await expect(page.locator("body")).not.toContainText(/Application error|undefined|NaN/);
    }
    await expect(page.locator("body")).not.toContainText("Top 25%");
    expect(errors).toEqual([]);
});
