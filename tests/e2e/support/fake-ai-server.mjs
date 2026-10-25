// E2E ONLY — a tiny OpenAI/Groq-compatible chat server with deterministic answers.
// The app talks to it because the e2e run sets GROQ_BASE_URL to this server.
// Control endpoints: POST /__reset, POST /__mode {evalFail, evalDelayMs, badJson}, GET /__log
import http from "node:http";

const PORT = Number(process.env.FAKE_AI_PORT || 4555);
let mode = { evalFail: 0, evalDelayMs: 0, badJson: 0 };
let coreTurn = 0;
let log = [];

const completion = (content) => JSON.stringify({
    id: "fake", object: "chat.completion", created: 0, model: "fake",
    choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content } }], usage: {},
});

function respond(user) {
    if (user.includes('Respond with ONLY this JSON:\n{"kind"') && !user.includes("reply with ONLY the question text")) {
        if (mode.badJson > 0) { mode.badJson--; return { kind: "turn", content: "Sure! My next question: what is a closure?" }; }
        if (user.includes("very start of the interview"))
            return { kind: "turn", content: JSON.stringify({ kind: "intro", transition: "", question: "Could you start by walking me through your background?", format: "text" }) };
        if (user.includes("almost out of time"))
            return { kind: "turn", content: JSON.stringify({ kind: "closing", transition: "We're nearly at time, so one last question.", question: "What makes you a strong fit for this role?", format: "text" }) };
        coreTurn++;
        if (coreTurn === 2)
            return { kind: "turn", content: JSON.stringify({ kind: "new-topic", transition: "Let's try some code.", question: "Write a function that reverses a singly linked list.", format: "code" }) };
        return { kind: "turn", content: "```json\n" + JSON.stringify({ kind: coreTurn % 2 ? "follow-up" : "new-topic", transition: "Got it, thanks.", question: `Core question number ${coreTurn}: how would you design feature ${coreTurn}?`, format: "text" }) + "\n```" };
    }
    if (user.includes("reply with ONLY the question text")) return { kind: "turn-fallback", content: "\"How do closures work in JavaScript?\"" };
    if (user.includes("Evaluate this interview answer")) {
        const ans = (user.match(/Candidate's Answer: ([\s\S]*?)\n/) || [])[1] || "";
        const score = Math.min(9, 4 + Math.floor(ans.length / 40));
        return {
            kind: "eval", fail: mode.evalFail > 0, delay: mode.evalDelayMs,
            content: JSON.stringify({
                score, feedback: "Decent answer with a clear structure.", strengths: ["Clear"], improvements: ["Add metrics"],
                rubric: { communication: 8, depth: 6, structure: 7, examples: 5, conciseness: 7 },
                strongerAnswer: "A stronger answer would name a concrete project, quantify the impact, and explain the trade-offs considered.",
            }),
        };
    }
    if (user.includes("overall interview summary"))
        return { kind: "summary", content: JSON.stringify({ overallScore: 7.2, overallFeedback: "Solid communication; deepen technical trade-offs.", strengths: ["Clear"], areasForImprovement: ["Depth"], recommendations: ["Practice system design"] }) };
    return { kind: "other", content: "ok" };
}

http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
        res.setHeader("content-type", "application/json");
        if (req.url === "/__reset") { mode = { evalFail: 0, evalDelayMs: 0, badJson: 0 }; coreTurn = 0; log = []; return res.end("{}"); }
        if (req.url === "/__mode") { mode = { ...mode, ...JSON.parse(body || "{}") }; return res.end("{}"); }
        if (req.url === "/__log") return res.end(JSON.stringify(log));
        if (req.method === "GET") return res.end('{"ok":true}');

        const msgs = (JSON.parse(body || "{}").messages) || [];
        const user = msgs.filter((m) => m.role === "user").map((m) => m.content).join("\n");
        const r = respond(user);
        log.push({ kind: r.kind, user: user.slice(0, 4000) });
        const send = () => {
            if (r.fail) { mode.evalFail--; res.statusCode = 500; return res.end(JSON.stringify({ error: { message: "fake upstream failure" } })); }
            res.end(completion(r.content));
        };
        r.delay ? setTimeout(send, r.delay) : send();
    });
}).listen(PORT, () => console.log(`fake AI listening on ${PORT}`));
