import { expect, type Page, type APIRequestContext } from "@playwright/test";

export const AI = "http://localhost:4555";

/**
 * Browser stand-ins for the Web Speech APIs.
 * synthesis — "chrome": queued utterances (~250ms each), cancel() fires onerror like real browsers
 *             "ios":    speak() is silently ignored until first called inside a user tap
 * recognition — a fake microphone; tests call window.__say("text") to "speak".
 */
export function speechInitScript(mode: "chrome" | "ios") {
    return ({ mode }: { mode: string }) => {
        const q: any[] = [];
        let speaking: any = null, timer: any = null, unlocked = mode === "chrome";
        (window as any).__spoken = [];
        (window as any).__rates = [];
        const next = () => {
            if (speaking) return;
            speaking = q.shift() || null;
            if (!speaking) return;
            const u = speaking;
            u.onstart && u.onstart();
            u.onboundary && setTimeout(() => speaking === u && u.onboundary({ charIndex: Math.floor(u.text.length / 2) }), 80);
            timer = setTimeout(() => { if (speaking !== u) return; speaking = null; u.onend && u.onend(); next(); }, 250);
        };
        const synth = {
            speak(u: any) {
                if (!unlocked) { if ((navigator as any).userActivation?.isActive) unlocked = true; else return; }
                if (u.text.trim()) { (window as any).__spoken.push(u.text); (window as any).__rates.push(u.rate); }
                q.push(u); next();
            },
            cancel() { clearTimeout(timer); const all = [speaking, ...q].filter(Boolean); q.length = 0; speaking = null; all.forEach((u) => u.onerror && u.onerror({ error: "interrupted" })); },
            getVoices: () => [], get speaking() { return !!speaking; }, pending: false, pause() {}, resume() {},
        };
        Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });

        class FakeRecognition {
            continuous = false; interimResults = false; lang = "en-US";
            onresult: any = null; onerror: any = null; onend: any = null;
            running = false;
            start() { this.running = true; (window as any).__rec = this; }
            stop() { if (this.running) { this.running = false; this.onend && this.onend(); } }
        }
        (window as any).SpeechRecognition = FakeRecognition;
        (window as any).webkitSpeechRecognition = FakeRecognition;
        (window as any).__say = (text: string) => {
            const rec = (window as any).__rec;
            if (!rec || !rec.running) return false;
            rec.onresult && rec.onresult({ results: [[{ transcript: text }]] });
            return true;
        };
    };
}

export async function setupPage(page: Page, mode: "chrome" | "ios" = "chrome") {
    await page.addInitScript(speechInitScript(mode), { mode });
}

export async function resetAll(request: APIRequestContext) {
    await request.post("/api/testctl", { data: { action: "reset" } });
    await request.post(`${AI}/__reset`);
}

export async function aiMode(request: APIRequestContext, m: Record<string, number>) {
    await request.post(`${AI}/__mode`, { data: m });
}

export async function db(request: APIRequestContext) {
    return (await request.get("/api/testctl")).json();
}

export async function patchInterview(request: APIRequestContext, id: string, values: Record<string, unknown>) {
    await request.post("/api/testctl", { data: { action: "patch", table: "interviews", id, values } });
}

export async function createInterview(request: APIRequestContext, minutes = 10, extra: Record<string, unknown> = {}) {
    const res = await request.post("/api/interview/create", {
        data: { type: "technical", difficulty: "medium", role: "Full Stack Engineer", company: "Razorpay", durationMinutes: minutes, ...extra },
    });
    const body = await res.json();
    expect(body.success).toBeTruthy();
    return body.interview.id as string;
}

export async function tapStart(page: Page) {
    const btn = page.getByRole("button", { name: /^(Start|Continue) Interview$/ });
    await btn.click();
}

export async function answer(page: Page, text: string) {
    await page.locator("textarea").first().fill(text);
    await page.getByRole("button", { name: "Submit" }).click();
}

/** Counts POSTs to the question endpoint. */
export function countQuestionRequests(page: Page) {
    const reqs: string[] = [];
    page.on("request", (r) => { if (r.method() === "POST" && r.url().endsWith("/question")) reqs.push(r.url()); });
    return reqs;
}
