"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2, CheckCircle, Mic, MicOff, Clock, Target, MessageSquare, ArrowLeft, Volume2, VolumeX, Code2, Hand, RotateCcw, AlignLeft } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { plannedSessionSeconds } from "@/lib/interview-session";
import InterviewStage from "@/components/interview/InterviewStage";
import type { InterviewerState } from "@/components/interview/InterviewerAvatar";
import CodeAnswer, { combineAnswer, loadPreferredLanguage, type CodeLanguage } from "@/components/interview/CodeAnswer";
import AnswerText from "@/components/interview/AnswerText";

/** After the session clock hits zero, the candidate gets this long to finish their current answer. */
const GRACE_SECONDS = 120;
/** After this long on one answer, show a gentle (non-blocking) nudge to wrap up. */
const LONG_ANSWER_SECONDS = 180;
/** Hands-free mode: submit after this much silence following a spoken answer. */
const HANDS_FREE_SILENCE_MS = 4000;
const HANDS_FREE_COUNTDOWN_FROM_MS = 1500;
const INTERVIEWER_NAME = "Maya";
const SKIPPED = "[No answer provided]";

const fmtClock = (secs: number) => {
    const s = Math.max(0, Math.floor(secs));
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
};
const uid = () => Math.random().toString(36).slice(2, 10);
const wordCount = (t: string) => t.replace(/```[\s\S]*?```/g, " ").split(/\s+/).filter(Boolean).length;

type ScoreStatus = "scoring" | "scored" | "unscored" | "failed" | "skipped";
interface Message {
    id: string;
    role: "ai" | "user";
    content: string;
    score?: number;
    status?: ScoreStatus;
    answerId?: string;
    question?: string; // for user messages: the question they answered (needed to retry scoring)
}

const storage = {
    get(key: string) { try { return localStorage.getItem(key); } catch { return null; } },
    set(key: string, v: string) { try { localStorage.setItem(key, v); } catch { /* ignore */ } },
};

export default function InterviewPage({ params }: { params: { id: string } }) {
    const router = useRouter();
    const [interview, setInterview] = useState<any>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [currentQuestion, setCurrentQuestion] = useState("");
    const [answer, setAnswer] = useState("");
    const [loading, setLoading] = useState(true);
    const [showSkipModal, setShowSkipModal] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [questionError, setQuestionError] = useState("");
    const [completed, setCompleted] = useState(false);
    const [speechError, setSpeechError] = useState("");
    const [endingInterview, setEndingInterview] = useState(false);
    const [endingNote, setEndingNote] = useState("Generating your feedback report");
    const [now, setNow] = useState(Date.now());
    const [userName, setUserName] = useState("");
    const [voiceEnabled, setVoiceEnabled] = useState(true);
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [answerStartedAt, setAnswerStartedAt] = useState<number | null>(null);
    const [currentKind, setCurrentKind] = useState<string>("");
    const [timeUp, setTimeUp] = useState(false);
    const [needsStart, setNeedsStart] = useState<"" | "fresh" | "resume">("");
    const [questionNumber, setQuestionNumber] = useState(0);

    // Interviewer avatar + captions
    const [speechPulse, setSpeechPulse] = useState(0);
    const [nodSignal, setNodSignal] = useState(0);
    const [caption, setCaption] = useState("");
    const [captionIndex, setCaptionIndex] = useState(-1);

    // Code answers
    const [codeMode, setCodeMode] = useState(false);
    const [code, setCode] = useState("");
    const [codeLang, setCodeLang] = useState<CodeLanguage>("python");

    // Hands-free (auto-submit after silence)
    const [handsFree, setHandsFree] = useState(false);
    const [hfCountdown, setHfCountdown] = useState<number | null>(null);
    const lastVoiceAtRef = useRef(0);
    const voiceAnswerRef = useRef(false);
    const hfPausedRef = useRef(false);

    const lastKindRef = useRef<string>("");
    const timeUpRef = useRef(false);
    const warnedRef = useRef<{ five?: boolean; one?: boolean; grace?: boolean }>({});
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const synthRef = useRef<SpeechSynthesis | null>(null);
    const recognitionRef = useRef<any>(null);
    const startClickedRef = useRef(false);
    const voiceEnabledRef = useRef(true);
    const voiceRateRef = useRef(0.95);
    const questionInFlightRef = useRef(false);
    const pendingScoresRef = useRef<Set<Promise<void>>>(new Set());
    const answerRef = useRef("");
    const lastNodLenRef = useRef(0);
    const captionTokenRef = useRef(0);
    const coarsePointerRef = useRef(false);
    const aliveRef = useRef(true);
    const endingRef = useRef(false);

    useEffect(() => { voiceEnabledRef.current = voiceEnabled; }, [voiceEnabled]);
    useEffect(() => { answerRef.current = answer; }, [answer]);
    useEffect(() => {
        aliveRef.current = true;
        return () => { aliveRef.current = false; };
    }, []);
    useEffect(() => {
        setHandsFree(storage.get("prepmate.handsFree") === "1");
        setCodeLang(loadPreferredLanguage());
        coarsePointerRef.current = typeof window !== "undefined" && !!window.matchMedia?.("(pointer: coarse)").matches;
    }, []);

    // ---------- speech recognition (candidate's voice) ----------
    useEffect(() => {
        if (typeof window === "undefined") return;
        if ("speechSynthesis" in window) synthRef.current = window.speechSynthesis;
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) return;
        const rec = new SpeechRecognition();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = "en-US";
        rec.onresult = (event: any) => {
            const transcript = Array.from(event.results).map((r: any) => r[0].transcript).join("");
            setAnswer(transcript);
            voiceAnswerRef.current = true;
            lastVoiceAtRef.current = Date.now();
            // Interviewer nods along now and then while you talk
            if (transcript.length - lastNodLenRef.current > 40) {
                lastNodLenRef.current = transcript.length;
                setNodSignal((n) => n + 1);
            }
        };
        rec.onerror = (event: any) => {
            setIsListening(false);
            if (event.error === "no-speech") {
                setSpeechError("No speech detected. Check your microphone or type your answer below.");
                setTimeout(() => setSpeechError(""), 5000);
            } else if (event.error === "not-allowed") {
                setSpeechError("Microphone access is blocked — allow it in your browser settings, or type your answer.");
            }
        };
        rec.onend = () => setIsListening(false);
        recognitionRef.current = rec;
    }, []);

    const stopListening = () => {
        try { recognitionRef.current?.stop(); } catch { /* not started */ }
        setIsListening(false);
    };

    const toggleMicrophone = () => {
        if (!recognitionRef.current) {
            toast.error("Speech recognition isn't supported in this browser — please type your answer");
            return;
        }
        if (isListening) return stopListening();
        try {
            recognitionRef.current.start();
            setIsListening(true);
            synthRef.current?.cancel();
            setIsSpeaking(false);
        } catch {
            toast.error("Could not start microphone");
        }
    };

    // ---------- derived ----------
    const userMsgs = messages.filter((m) => m.role === "user");
    const answeredCount = userMsgs.filter((m) => m.status !== "skipped").length;
    const scored = userMsgs.filter((m) => m.status === "scored" && (m.score ?? 0) > 0).map((m) => m.score as number);
    const avgScore = scored.length ? Math.round((scored.reduce((a, b) => a + b, 0) / scored.length) * 10) : 0;
    const answerWords = userMsgs.filter((m) => m.status !== "skipped").map((m) => wordCount(m.content));
    const avgWords = answerWords.length ? Math.round(answerWords.reduce((a, b) => a + b, 0) / answerWords.length) : 0;
    const scoringCount = userMsgs.filter((m) => m.status === "scoring").length;

    const sessionTotal = plannedSessionSeconds(interview ?? {});
    const sessionStart = interview ? new Date(interview.started_at || interview.created_at).getTime() : now;
    const sessionElapsed = needsStart === "fresh" ? 0 : Math.max(0, Math.floor((now - sessionStart) / 1000));
    const sessionRemaining = sessionTotal - sessionElapsed;
    const answerSeconds = answerStartedAt ? Math.floor((now - answerStartedAt) / 1000) : 0;
    const kindLabel: Record<string, string> = { intro: "Introduction", "follow-up": "Follow-up", "new-topic": "", closing: "Wrap-up" };
    const finalAnswerText = codeMode ? combineAnswer(answer, code, codeLang) : answer.trim();

    const avatarState: InterviewerState = isSpeaking ? "speaking"
        : generating ? "thinking"
        : currentQuestion && answerStartedAt ? "listening"
        : "idle";

    // ---------- session time management ----------
    useEffect(() => {
        if (!interview || completed || endingInterview || loading || needsStart) return;
        if (sessionRemaining <= 300 && sessionRemaining > 60 && !warnedRef.current.five && sessionTotal > 360) {
            warnedRef.current.five = true;
            toast("About 5 minutes left in this interview", { icon: "⏳", duration: 3000 });
        }
        if (sessionRemaining <= 60 && sessionRemaining > 0 && !warnedRef.current.one) {
            warnedRef.current.one = true;
            toast("About 1 minute left", { icon: "⏳", duration: 3000 });
        }
        if (sessionRemaining <= 0 && !timeUpRef.current) {
            timeUpRef.current = true;
            setTimeUp(true);
            if (currentQuestion) {
                toast("Time's up — finish this answer and we'll wrap up.", { icon: "⏰", duration: 5000 });
            } else if (!generating) {
                handleEndInterview();
            }
        }
        if (timeUpRef.current && sessionRemaining <= -GRACE_SECONDS && !warnedRef.current.grace) {
            warnedRef.current.grace = true;
            if (currentQuestion && finalAnswerText) handleSubmitAnswer();
            else handleEndInterview();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [now]);

    // ---------- hands-free: auto-submit after silence ----------
    useEffect(() => {
        if (!handsFree || !currentQuestion || codeMode) { setHfCountdown(null); return; }
        const iv = setInterval(() => {
            if (!voiceAnswerRef.current || hfPausedRef.current || !answerRef.current.trim()) { setHfCountdown(null); return; }
            const silence = Date.now() - lastVoiceAtRef.current;
            if (silence >= HANDS_FREE_SILENCE_MS) {
                setHfCountdown(null);
                handleSubmitAnswer();
            } else if (silence >= HANDS_FREE_COUNTDOWN_FROM_MS) {
                setHfCountdown(Math.ceil((HANDS_FREE_SILENCE_MS - silence) / 1000));
            } else setHfCountdown(null);
        }, 250);
        return () => clearInterval(iv);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [handsFree, currentQuestion, codeMode]);

    useEffect(() => {
        fetchInterview();
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => {
            clearInterval(timer);
            synthRef.current?.cancel();
            try { recognitionRef.current?.stop(); } catch { /* ignore */ }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [params.id]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    /**
     * Speak text and resolve when done. Never blocks the interview: resolves on end, error,
     * if the browser silently ignores speak() (iOS without a user gesture), or after a max duration.
     * Drives the avatar's lip-sync (word boundaries) and the live captions.
     */
    const speakAsync = useCallback((text: string): Promise<void> => new Promise((resolve) => {
        const synth = synthRef.current;
        const token = ++captionTokenRef.current;
        setCaption(text);
        setCaptionIndex(-1);
        const clearCaption = () => setTimeout(() => { if (captionTokenRef.current === token) setCaption(""); }, 1200);
        if (!text || !voiceEnabledRef.current || !synth) { clearCaption(); return resolve(); }
        let done = false, started = false;
        const finish = () => {
            if (done) return;
            done = true;
            clearTimeout(probe); clearTimeout(hard);
            setIsSpeaking(false);
            if (captionTokenRef.current === token) setCaptionIndex(text.length);
            clearCaption();
            resolve();
        };
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "en-US"; u.rate = voiceRateRef.current; u.pitch = 1.05; u.volume = 1.0;
        const voices = synth.getVoices();
        const preferred = voices.find((v) => v.lang.startsWith("en") && /female|samantha|zira|google us english|aria|jenny/i.test(v.name)) || voices.find((v) => v.lang.startsWith("en"));
        if (preferred) u.voice = preferred;
        u.onstart = () => { started = true; };
        u.onboundary = (e: SpeechSynthesisEvent) => {
            setSpeechPulse((p) => p + 1);
            if (captionTokenRef.current === token) setCaptionIndex(e.charIndex);
        };
        u.onend = finish;
        u.onerror = finish;
        const probe = setTimeout(() => { if (!started && !synth.speaking) finish(); }, 2000);
        const hard = setTimeout(finish, Math.min(60000, 3000 + (text.length * 85) / voiceRateRef.current));
        setIsSpeaking(true);
        synth.speak(u);
    }), []);

    /** Runs inside the tap handler, so audio and mic are allowed on mobile. */
    const handleStart = async () => {
        if (startClickedRef.current || !interview) return;
        startClickedRef.current = true;
        const mode = needsStart;
        setNeedsStart("");

        // Unlock speech synthesis on iOS/Android: speak (synchronously) inside the gesture
        try {
            const synth = synthRef.current;
            if (synth && voiceEnabledRef.current) {
                synth.cancel();
                const unlock = new SpeechSynthesisUtterance(" ");
                unlock.volume = 0;
                synth.speak(unlock);
            }
        } catch { /* ignore */ }

        if (mode === "resume") {
            const welcomeBack = `Welcome back. Let's pick up where we left off.`;
            setMessages((prev) => [...prev, { id: uid(), role: "ai", content: welcomeBack }]);
            generateQuestion(speakAsync(welcomeBack));
            return;
        }

        // Fresh interview: start the session clock now, not when the page was opened
        const nowIso = new Date().toISOString();
        setInterview((iv: any) => ({ ...iv, started_at: nowIso }));
        fetch(`/api/interview/${params.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ start: true }),
        }).catch(() => {});

        const firstName = (interview.user?.name || userName || "").split(" ")[0] || "there";
        const minutes = Math.round(plannedSessionSeconds(interview) / 60);
        const position = interview.role ? ` for the ${interview.role} role${interview.company ? ` at ${interview.company}` : ""}` : interview.company ? ` for ${interview.company}` : "";
        const greeting = `Hi ${firstName}, I'm ${INTERVIEWER_NAME}, and I'll be your interviewer today.`;
        const intro = `This is a ${minutes}-minute ${interview.type.replace("-", " ")} interview${position}. Take your time with each answer — there's no timer on individual questions, and I may ask a few follow-ups along the way. Let's start with a quick introduction.`;
        setMessages([{ id: uid(), role: "ai", content: greeting }, { id: uid(), role: "ai", content: intro }]);

        // Fetch the first question while the intro is being spoken; show it once speech ends
        const introSpoken = speakAsync(greeting).then(() => speakAsync(intro));
        generateQuestion(introSpoken);
    };

    const fetchInterview = async () => {
        try {
            const [response, profileRes] = await Promise.all([
                fetch(`/api/interview/${params.id}`),
                fetch(`/api/user/profile`).catch(() => null),
            ]);
            const data = await response.json();
            try {
                const profile = profileRes && profileRes.ok ? await profileRes.json() : null;
                const speed = Number(profile?.user?.voiceSpeed);
                if (speed > 0) voiceRateRef.current = Math.min(2, Math.max(0.5, speed)) * 0.95;
            } catch { /* keep default speed */ }

            if (!data.success) {
                toast.error(data.error || "Failed to load interview");
                router.push("/dashboard");
                return;
            }
            // A slow load can finish after the user already tapped Start — don't reset the session then
            if (startClickedRef.current) return;
            setInterview(data.interview);
            setUserName(data.interview.user?.name || "there");

            const ordered = [...(data.interview.answers || [])].sort(
                (a: any, b: any) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
            );
            const loaded: Message[] = [];
            ordered.forEach((a: any) => {
                const q = a.question_text ?? a.questionText;
                const ans = a.user_answer ?? a.userAnswer;
                loaded.push({ id: uid(), role: "ai", content: q });
                if (ans === SKIPPED) loaded.push({ id: uid(), role: "user", content: "(skipped)", status: "skipped", score: 0 });
                else loaded.push({ id: uid(), role: "user", content: ans, score: a.score ?? undefined, status: (a.score ?? 0) > 0 ? "scored" : "unscored", answerId: a.id, question: q });
            });
            setMessages(loaded);
            setQuestionNumber(ordered.length);

            if (data.interview.status === "completed") setCompleted(true);
            else setNeedsStart(ordered.length > 0 ? "resume" : "fresh");
        } catch (error) {
            console.error("Error fetching interview:", error);
            router.push("/dashboard");
        } finally {
            setLoading(false);
        }
    };

    const generateQuestion = async (waitFor?: Promise<void>, last?: { lastQuestion: string; lastAnswer: string }) => {
        if (!aliveRef.current) return;
        if (timeUpRef.current) { await handleEndInterview(); return; }
        if (questionInFlightRef.current) return;
        questionInFlightRef.current = true;
        setGenerating(true);
        setQuestionError("");
        setSpeechError("");
        stopListening();
        try {
            const response = await fetch(`/api/interview/${params.id}/question`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(last ?? {}),
            });
            const data = await response.json();
            if (data.success && data.done) {
                timeUpRef.current = true;
                setTimeUp(true);
                await handleEndInterview();
                return;
            }
            if (!data.success) {
                const msg = data.error || "Failed to generate question";
                const displayMsg = msg.toLowerCase().includes("quota")
                    ? "AI quota exceeded. Please add a GROQ_API_KEY in Vercel Environment Variables."
                    : `Failed to generate question: ${msg}`;
                setQuestionError(displayMsg);
                toast.error(displayMsg, { duration: 8000 });
                return;
            }
            if (waitFor) await waitFor; // e.g. let the spoken intro finish first
            if (!aliveRef.current) return;

            if (data.transition) setMessages((prev) => [...prev, { id: uid(), role: "ai", content: data.transition }]);
            setCurrentKind(data.kind || "");
            lastKindRef.current = data.kind || "";
            setAnswerStartedAt(null);
            setAnswer("");
            setCode("");
            setCodeMode(data.format === "code");
            voiceAnswerRef.current = false;
            hfPausedRef.current = false;
            lastNodLenRef.current = 0;
            setCurrentQuestion(data.question);
            setQuestionNumber((n) => n + 1);
            setGenerating(false);

            const startMicAndTimer = () => {
                if (!aliveRef.current) return;
                setAnswerStartedAt(Date.now());
                if (recognitionRef.current && data.format !== "code") {
                    try { recognitionRef.current.start(); setIsListening(true); } catch { /* needs a tap on some phones */ }
                }
            };
            synthRef.current?.cancel();
            speakAsync(data.transition ? `${data.transition} ${data.question}` : data.question).then(startMicAndTimer);
        } catch (error) {
            console.error("Error generating question:", error);
            const msg = "Failed to reach the server. Check your connection and try again.";
            setQuestionError(msg);
            toast.error(msg, { duration: 5000 });
        } finally {
            setGenerating(false);
            questionInFlightRef.current = false;
        }
    };

    /** Score an answer in the background. Retries network errors; keeps the answer if scoring fails. */
    const scoreAnswer = (msgId: string, question: string, text: string, answerId?: string) => {
        setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, status: "scoring" } : m)));
        const run = (async () => {
            for (let attempt = 0; attempt < 3; attempt++) {
                try {
                    const res = await fetch(`/api/interview/${params.id}/evaluate`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ question, answer: text, answerId }),
                    });
                    const data = await res.json();
                    if (data.success) {
                        setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, status: "scored", score: data.evaluation.score, answerId: data.answerId } : m)));
                        return;
                    }
                    if (data.saved) {
                        // Saved, but the AI couldn't score it — offer a retry, nothing is lost
                        setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, status: "unscored", answerId: data.answerId } : m)));
                        return;
                    }
                    throw new Error(data.error || "Failed");
                } catch (e) {
                    if (attempt === 2) {
                        setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, status: "failed" } : m)));
                        toast.error("Couldn't save your answer — tap Retry under it.");
                        return;
                    }
                    await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
                }
            }
        })();
        pendingScoresRef.current.add(run);
        run.finally(() => pendingScoresRef.current.delete(run));
        return run;
    };

    const saveSkippedQuestion = async (question: string) => {
        if (!question) return;
        try {
            await fetch(`/api/interview/${params.id}/evaluate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ question, skipped: true }),
            });
        } catch (e) { console.error("Failed to save skipped question", e); }
    };

    const handleSubmitAnswer = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!currentQuestion) return;
        const text = codeMode ? combineAnswer(answerRef.current, code, codeLang) : answerRef.current.trim();
        if (!text) {
            setSpeechError(codeMode ? "Write some code or explain your approach before submitting." : "Please provide an answer before submitting.");
            setTimeout(() => setSpeechError(""), 4000);
            return;
        }
        setSpeechError("");
        stopListening();
        synthRef.current?.cancel();

        const question = currentQuestion;
        const msgId = uid();
        setMessages((prev) => [
            ...prev,
            { id: uid(), role: "ai", content: question },
            { id: msgId, role: "user", content: text, status: "scoring", question },
        ]);
        setAnswer("");
        setCode("");
        setCodeMode(false);
        setCurrentQuestion("");
        setAnswerStartedAt(null);
        setHfCountdown(null);

        // Score in the background while the interviewer moves on — no waiting between questions
        scoreAnswer(msgId, question, text);
        proceedAfterAnswer({ lastQuestion: question, lastAnswer: text });
    };

    /** After an answer (or skip): wrap up if time is up or this was the closing question, else continue. */
    const proceedAfterAnswer = (last?: { lastQuestion: string; lastAnswer: string }) => {
        if (timeUpRef.current || lastKindRef.current === "closing") {
            const bye = "Thank you, that's all the time we have. I'll put together your feedback now.";
            setMessages((prev) => [...prev, { id: uid(), role: "ai", content: bye }]);
            speakAsync(bye).finally(() => handleEndInterview());
        } else {
            generateQuestion(undefined, last);
        }
    };

    const handleEndInterview = async () => {
        if (endingRef.current) return; // time-up, closing answer and End button can race
        endingRef.current = true;
        setEndingInterview(true);
        stopListening();
        synthRef.current?.cancel();
        setIsSpeaking(false);
        try {
            // Make sure every answer is saved and scored before the summary is generated
            if (pendingScoresRef.current.size > 0) {
                setEndingNote("Scoring your last answer…");
                await Promise.race([
                    Promise.allSettled(Array.from(pendingScoresRef.current)),
                    new Promise((r) => setTimeout(r, 25000)),
                ]);
            }
            setEndingNote("Generating your feedback report");
            const response = await fetch(`/api/interview/${params.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "completed" }),
            });
            const data = await response.json();
            if (!data.success) throw new Error(data.error || "Failed to end interview");
            router.push(`/interview/${params.id}/feedback`);
        } catch (error) {
            console.error("Error ending interview:", error);
            toast.error("Couldn't finish the interview. Please try again.");
            endingRef.current = false;
            setEndingInterview(false);
        }
    };

    const toggleVoice = () => {
        setVoiceEnabled((v) => {
            if (v) { synthRef.current?.cancel(); setIsSpeaking(false); }
            return !v;
        });
    };
    const toggleHandsFree = () => {
        setHandsFree((v) => {
            storage.set("prepmate.handsFree", v ? "0" : "1");
            toast(v ? "Hands-free off — tap Submit when you're done" : `Hands-free on — your answer submits after ${HANDS_FREE_SILENCE_MS / 1000}s of silence`, { icon: v ? "✋" : "🎙️", duration: 3000 });
            return !v;
        });
    };

    // ---------- render ----------
    if (loading) {
        return (
            <div className="flex items-center justify-center h-[100dvh] bg-[#0a0514]">
                <div className="flex flex-col items-center">
                    <Loader2 className="w-8 h-8 text-purple-400 animate-spin mb-4" />
                    <p className="text-base font-bold text-white">Loading...</p>
                    <p className="text-sm text-gray-400 mt-1">Please wait</p>
                </div>
            </div>
        );
    }

    if (completed) {
        return (
            <div className="flex items-center justify-center h-[100dvh] bg-[#0a0514] p-8">
                <div className="text-center max-w-md">
                    <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-white mb-2">This interview is complete</h2>
                    <p className="text-gray-400 mb-8">You answered {answeredCount} question{answeredCount === 1 ? "" : "s"}.</p>
                    <div className="flex gap-3 justify-center">
                        <Link href="/dashboard" className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm hover:bg-white/10 transition-all">
                            <ArrowLeft className="w-4 h-4" /> Dashboard
                        </Link>
                        <Link href={`/interview/${params.id}/feedback`} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white text-sm font-semibold transition-all shadow-lg shadow-purple-500/25">
                            View Feedback
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    const sessionColor = sessionRemaining <= 60 ? "text-red-400" : sessionRemaining <= 300 ? "text-yellow-400" : "text-purple-400";
    const lengthHint = avgWords === 0 ? "Answer to see your average" : avgWords < 40 ? "Add more detail and examples" : avgWords > 260 ? "Try to be more concise" : "Good answer length";

    return (
        <div className="flex h-[100dvh] overflow-hidden bg-[#0a0514]">
            {endingInterview && (
                <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0a0514]/95 backdrop-blur-sm">
                    <Loader2 className="w-10 h-10 text-purple-400 animate-spin mb-5" />
                    <p className="text-base font-bold text-white">Wrapping up…</p>
                    <p className="text-sm text-gray-400 mt-1">{endingNote}</p>
                </div>
            )}

            {/* ── LEFT — Insights panel (desktop) ── */}
            <aside className="hidden lg:flex w-64 flex-shrink-0 border-r border-white/5 flex-col py-5 px-4 overflow-y-auto"
                style={{ background: "linear-gradient(180deg, #0f0a1a 0%, #0a0a0f 100%)" }}>
                <div className="mb-5">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                        <span className="text-xs text-green-400 font-medium">Live Interview</span>
                    </div>
                    <p className="text-xs text-gray-600 capitalize">{interview?.type?.replace("-", " ")} · {interview?.difficulty}</p>
                </div>

                <div className="glass-card rounded-2xl p-5 mb-4 border border-purple-500/20">
                    <div className="flex flex-col items-center">
                        <div className="relative w-32 h-32 mb-2">
                            <svg className="transform -rotate-90" width="128" height="128">
                                <circle cx="64" cy="64" r="56" stroke="rgba(168,85,247,0.15)" strokeWidth="8" fill="none" />
                                <circle cx="64" cy="64" r="56"
                                    stroke={sessionRemaining <= 60 ? "#ef4444" : sessionRemaining <= 300 ? "#f59e0b" : "#a855f7"}
                                    strokeWidth="8" fill="none" strokeLinecap="round"
                                    strokeDasharray={2 * Math.PI * 56}
                                    strokeDashoffset={2 * Math.PI * 56 * (1 - Math.max(0, sessionRemaining) / sessionTotal)}
                                    className="transition-all duration-1000" />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className={`text-3xl font-bold font-mono ${sessionColor}`}>{fmtClock(sessionRemaining)}</span>
                                <span className="text-xs text-gray-600 mt-1">{timeUp ? "Wrapping up" : "Time left"}</span>
                            </div>
                        </div>
                        <p className="text-xs text-gray-500 text-center">{Math.round(sessionTotal / 60)}-minute interview · no per-question limit</p>
                    </div>
                </div>

                <div className="glass-card rounded-2xl p-4 mb-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="text-center">
                            <div className="text-2xl font-bold text-purple-400">{questionNumber}</div>
                            <div className="text-xs text-gray-600">Questions Asked</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-fuchsia-400">{answeredCount}</div>
                            <div className="text-xs text-gray-600">Answered</div>
                        </div>
                    </div>
                </div>

                <div className="glass-card rounded-2xl p-4 mb-4">
                    <div className="flex items-center gap-1.5 mb-2">
                        <AlignLeft className="w-3.5 h-3.5 text-purple-400" />
                        <span className="text-xs text-gray-400">Avg Answer Length</span>
                    </div>
                    <div className="text-2xl font-bold text-white">{avgWords}<span className="text-sm text-gray-500 font-normal"> words</span></div>
                    <p className="text-xs text-gray-600 mt-1">{lengthHint}</p>
                </div>

                <div className="glass-card rounded-2xl p-4 mb-4">
                    <div className="flex items-center gap-1.5 mb-2">
                        <Target className="w-3.5 h-3.5 text-pink-400" />
                        <span className="text-xs text-gray-400">Avg Score</span>
                    </div>
                    {avgScore > 0 ? (
                        <>
                            <div className="text-2xl font-bold grad-text">{avgScore}%</div>
                            <div className="h-1.5 rounded-full bg-white/5 mt-2 overflow-hidden">
                                <div className="h-full rounded-full bg-gradient-to-r from-pink-500 to-fuchsia-500 transition-all" style={{ width: `${avgScore}%` }} />
                            </div>
                        </>
                    ) : (
                        <div className="text-sm text-gray-600 mt-1">{scoringCount > 0 ? "Scoring…" : "No scores yet"}</div>
                    )}
                    {scored.length > 0 && (
                        <p className="text-xs text-gray-600 mt-2 flex items-center gap-1"><MessageSquare className="w-3 h-3" /> Last answer: {scored[scored.length - 1]}/10</p>
                    )}
                </div>

                <div className="space-y-2 mb-3">
                    <button onClick={toggleHandsFree} aria-pressed={handsFree}
                        className={`w-full py-2.5 rounded-xl border text-xs font-medium transition-all flex items-center justify-center gap-2 ${handsFree ? "border-green-500/30 bg-green-500/10 text-green-400" : "border-white/10 bg-white/5 text-gray-500"}`}>
                        <Hand className="w-3.5 h-3.5" /> {handsFree ? "Hands-free On" : "Hands-free Off"}
                    </button>
                    <button onClick={toggleVoice}
                        className={`w-full py-2.5 rounded-xl border text-xs font-medium transition-all flex items-center justify-center gap-2 ${voiceEnabled ? "border-purple-500/30 bg-purple-500/10 text-purple-400" : "border-white/10 bg-white/5 text-gray-500"}`}>
                        {voiceEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                        {voiceEnabled ? "AI Voice On" : "AI Voice Off"}
                    </button>
                </div>
                <div className="mt-auto">
                    <button onClick={handleEndInterview} disabled={endingInterview}
                        className="w-full py-2.5 rounded-xl border border-red-500/20 bg-red-500/8 text-red-400 text-xs font-medium hover:bg-red-500/15 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                        {endingInterview ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Ending...</> : "End Interview"}
                    </button>
                </div>
            </aside>

            {/* ── MAIN ── */}
            <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
                {/* Top bar */}
                <div className="border-b border-white/5 px-3 sm:px-6 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] flex items-center justify-between gap-2 flex-shrink-0">
                    <Link href="/dashboard" aria-label="Back to dashboard" className="flex-shrink-0 flex items-center gap-1.5 text-xs text-gray-400 hover:text-white p-2 sm:px-3 sm:py-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
                        <ArrowLeft className="w-4 h-4 sm:w-3.5 sm:h-3.5" /> <span className="hidden sm:inline">Dashboard</span>
                    </Link>
                    <div className="lg:hidden flex-1 min-w-0 flex flex-col items-center">
                        <span className="flex items-center gap-1.5 text-xs text-green-400 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> Live · <span className={`font-mono ${sessionRemaining <= 60 ? "text-red-400" : sessionRemaining <= 300 ? "text-yellow-400" : ""}`}>{fmtClock(sessionRemaining)}</span> left
                        </span>
                        <span className="text-[11px] text-gray-500 capitalize truncate max-w-full">
                            {interview?.type?.replace("-", " ")} · {interview?.difficulty}{interview?.company ? ` · ${interview.company}` : ""}
                        </span>
                    </div>
                    <div className="lg:hidden flex items-center gap-1.5 flex-shrink-0">
                        <button onClick={toggleHandsFree} aria-label={handsFree ? "Turn hands-free off" : "Turn hands-free on"} aria-pressed={handsFree}
                            className={`p-2 rounded-xl border transition-all ${handsFree ? "border-green-500/30 bg-green-500/10 text-green-400" : "border-white/10 bg-white/5 text-gray-500"}`}>
                            <Hand className="w-4 h-4" />
                        </button>
                        <button onClick={toggleVoice} aria-label={voiceEnabled ? "Turn AI voice off" : "Turn AI voice on"}
                            className={`p-2 rounded-xl border transition-all ${voiceEnabled ? "border-purple-500/30 bg-purple-500/10 text-purple-400" : "border-white/10 bg-white/5 text-gray-500"}`}>
                            {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                        </button>
                        <button onClick={handleEndInterview} disabled={endingInterview}
                            className="px-3 py-2 rounded-xl border border-red-500/25 bg-red-500/10 text-red-400 text-xs font-semibold disabled:opacity-60">
                            End
                        </button>
                    </div>
                    <div className="hidden lg:flex items-center gap-3 min-w-0">
                        {interview?.company && <span className="text-xs px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-gray-400">{interview.company}</span>}
                        {interview?.role && <span className="text-xs px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400">{interview.role}</span>}
                    </div>
                </div>

                {/* Video-call stage with the interviewer */}
                <div className="flex-shrink-0 px-3 sm:px-6 pt-3">
                    <InterviewStage
                        state={avatarState}
                        speechPulse={speechPulse}
                        nodSignal={nodSignal}
                        caption={voiceEnabled ? caption : ""}
                        captionIndex={captionIndex}
                        interviewerName={INTERVIEWER_NAME}
                        className={`mx-auto max-w-3xl transition-all duration-300 ${codeMode ? "h-24 sm:h-36" : "h-[26vh] min-h-[150px] max-h-[300px] sm:h-[30vh] sm:min-h-[200px]"}`}
                    />
                </div>

                {/* Transcript */}
                <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-3 sm:py-4">
                    <div className="space-y-3 max-w-2xl mx-auto">
                        {needsStart && (
                            <div className="flex items-center justify-center py-2">
                                <div className="w-full max-w-md rounded-3xl border border-purple-500/25 bg-gradient-to-b from-purple-500/10 to-transparent p-5 sm:p-7 text-center">
                                    <h2 className="text-xl font-bold text-white mb-1">
                                        {needsStart === "resume" ? "Continue your interview" : `Meet ${INTERVIEWER_NAME}, your interviewer`}
                                    </h2>
                                    <p className="text-sm text-gray-400 mb-4">
                                        {Math.round(sessionTotal / 60)} min · <span className="capitalize">{interview?.type?.replace("-", " ")} · {interview?.difficulty}</span>{interview?.company ? ` · ${interview.company}` : ""}
                                    </p>
                                    <ul className="text-left text-sm text-gray-300 space-y-2 mb-5">
                                        <li className="flex items-start gap-2"><Volume2 className="w-4 h-4 mt-0.5 text-purple-400 flex-shrink-0" /> Turn your volume up (and silent mode off on iPhone) to hear {INTERVIEWER_NAME}</li>
                                        <li className="flex items-start gap-2"><Mic className="w-4 h-4 mt-0.5 text-purple-400 flex-shrink-0" /> Allow microphone access to answer by voice — or just type</li>
                                        <li className="flex items-start gap-2"><Clock className="w-4 h-4 mt-0.5 text-purple-400 flex-shrink-0" /> {needsStart === "resume" ? "The clock kept running while you were away" : "The clock starts when you tap start"}</li>
                                    </ul>
                                    <button onClick={handleStart}
                                        className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white font-semibold text-base shadow-lg shadow-purple-500/30 active:scale-[0.98] transition-all">
                                        {needsStart === "resume" ? "Continue Interview" : "Start Interview"}
                                    </button>
                                </div>
                            </div>
                        )}

                        {messages.map((msg) => (
                            <div key={msg.id} className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                                <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-bold ${msg.role === "ai"
                                    ? "bg-gradient-to-br from-purple-600 to-pink-600 text-white"
                                    : "bg-white/10 text-gray-300"}`}>
                                    {msg.role === "ai" ? INTERVIEWER_NAME[0] : (userName?.[0] || "Y").toUpperCase()}
                                </div>
                                <div className={`min-w-0 max-w-[85%] sm:max-w-xl flex flex-col gap-1 ${msg.role === "user" ? "items-end" : "items-start"}`}>
                                    <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed break-words ${msg.role === "ai"
                                        ? "bg-purple-500/10 border border-purple-500/20 text-gray-200"
                                        : "bg-white/7 border border-white/10 text-gray-300"}`}>
                                        {msg.role === "user" ? <AnswerText text={msg.content} /> : msg.content}
                                    </div>
                                    {msg.role === "user" && msg.status === "scoring" && (
                                        <span className="text-xs px-2 py-0.5 rounded-full text-gray-400 bg-white/5 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Scoring…</span>
                                    )}
                                    {msg.role === "user" && msg.status === "scored" && (msg.score ?? 0) > 0 && (
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${(msg.score ?? 0) >= 7 ? "text-green-400 bg-green-500/10" : (msg.score ?? 0) >= 4 ? "text-yellow-400 bg-yellow-500/10" : "text-red-400 bg-red-500/10"}`}>{msg.score}/10</span>
                                    )}
                                    {msg.role === "user" && (msg.status === "unscored" || msg.status === "failed") && msg.question && (
                                        <button onClick={() => scoreAnswer(msg.id, msg.question!, msg.content, msg.status === "unscored" ? msg.answerId : undefined)}
                                            className="text-xs px-2 py-0.5 rounded-full text-orange-300 bg-orange-500/10 border border-orange-500/20 flex items-center gap-1 hover:bg-orange-500/20">
                                            <RotateCcw className="w-3 h-3" /> {msg.status === "failed" ? "Not saved · Retry" : "Not scored · Retry"}
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}

                        {generating && !needsStart && (
                            <div className="flex gap-2.5">
                                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-[11px] font-bold text-white">{INTERVIEWER_NAME[0]}</div>
                                <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl px-4 py-3 flex items-center gap-1.5">
                                    {[0, 1, 2].map((i) => <div key={i} className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
                                </div>
                            </div>
                        )}
                        {!generating && questionError && (
                            <div className="bg-red-500/10 border border-red-500/25 rounded-2xl px-4 py-3 flex flex-col gap-2">
                                <p className="text-red-300 text-sm font-medium">⚠️ Question generation failed</p>
                                <p className="text-red-400/80 text-xs">{questionError}</p>
                                <button onClick={() => { setQuestionError(""); generateQuestion(); }}
                                    className="self-start mt-1 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold">
                                    Retry
                                </button>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                </div>

                {/* Question + answer */}
                <div className="border-t border-white/5 flex-shrink-0 bg-[#0a0514]/80 backdrop-blur-xl">
                    {currentQuestion && (
                        <div className="px-3 sm:px-6 pt-3">
                            <div className="max-w-3xl mx-auto relative rounded-2xl border border-purple-500/25 bg-purple-500/5 overflow-hidden mb-2">
                                <div className="p-3 sm:p-4">
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-semibold">
                                            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                                            {kindLabel[currentKind] || `Question ${questionNumber}`}
                                        </span>
                                        {answerStartedAt && (
                                            <span title="Time spent on this answer — no limit"
                                                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${answerSeconds >= LONG_ANSWER_SECONDS ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-400" : "bg-white/5 border-white/10 text-gray-400"}`}>
                                                <Mic className="w-3 h-3" /> {fmtClock(answerSeconds)}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-white text-[15px] sm:text-base font-semibold leading-relaxed max-h-[18vh] overflow-y-auto">{currentQuestion}</p>
                                    {speechError && (
                                        <div className="mt-2 flex items-start gap-2 px-3 py-2 rounded-xl bg-red-500/8 border border-red-500/20">
                                            <MicOff className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                                            <span className="text-xs text-red-300 leading-relaxed">{speechError}</span>
                                        </div>
                                    )}
                                    {timeUp ? (
                                        <div className="mt-2 flex items-start gap-2 px-3 py-2 rounded-xl bg-orange-500/8 border border-orange-500/20">
                                            <Clock className="w-3.5 h-3.5 text-orange-400 flex-shrink-0 mt-0.5" />
                                            <span className="text-xs text-orange-300 leading-relaxed">Time&apos;s up — finish this answer and submit; we&apos;ll wrap up after it.</span>
                                        </div>
                                    ) : answerSeconds >= LONG_ANSWER_SECONDS ? (
                                        <div className="mt-2 flex items-start gap-2 px-3 py-2 rounded-xl bg-yellow-500/8 border border-yellow-500/20">
                                            <Clock className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0 mt-0.5" />
                                            <span className="text-xs text-yellow-300 leading-relaxed">You&apos;ve been answering for a while — in a real interview, try to land your main point and wrap up.</span>
                                        </div>
                                    ) : null}
                                    <div className="mt-3 h-1 rounded-full bg-white/5 overflow-hidden" title="Interview time used">
                                        <div className={`h-full rounded-full transition-all duration-1000 ${sessionRemaining <= 60 ? "bg-red-500" : sessionRemaining <= 300 ? "bg-yellow-500" : "bg-purple-500"}`}
                                            style={{ width: `${Math.min(100, (sessionElapsed / sessionTotal) * 100)}%` }} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="px-3 sm:px-6 py-2.5 sm:py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                        {needsStart ? null : currentQuestion ? (
                            <div className="max-w-3xl mx-auto">
                                {codeMode && (
                                    <div className="mb-2">
                                        <CodeAnswer code={code} onCodeChange={setCode} language={codeLang} onLanguageChange={setCodeLang} />
                                    </div>
                                )}
                                <form onSubmit={handleSubmitAnswer} className="flex flex-wrap sm:flex-nowrap gap-2 sm:gap-3 items-end">
                                    <button type="button" onClick={toggleMicrophone} aria-label={isListening ? "Stop recording" : "Start recording"}
                                        className={`flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center transition-all shadow-lg active:scale-90 ${isListening
                                            ? "bg-gradient-to-br from-red-500 to-pink-600 border-2 border-red-400/60 text-white scale-105 shadow-red-500/40"
                                            : "bg-gradient-to-br from-purple-600 to-fuchsia-600 border-2 border-purple-400/40 text-white hover:scale-105 shadow-purple-500/25"}`}>
                                        {isListening ? (
                                            <div className="relative flex items-center justify-center">
                                                <Mic className="w-6 h-6" />
                                                <div className="absolute -inset-1 rounded-full border-2 border-red-400/50 animate-ping" />
                                            </div>
                                        ) : <Mic className="w-6 h-6" />}
                                    </button>

                                    <div className="order-first sm:order-none basis-full sm:basis-auto flex-1 relative">
                                        <textarea
                                            value={answer}
                                            onChange={(e) => {
                                                setAnswer(e.target.value);
                                                voiceAnswerRef.current = false; // typing = manual submit
                                                if (e.target.value.length > 0) { synthRef.current?.cancel(); setIsSpeaking(false); }
                                                if (speechError) setSpeechError("");
                                            }}
                                            onKeyDown={(e) => {
                                                // Enter submits on desktop only (phones and code answers use the button)
                                                if (e.key === "Enter" && !e.shiftKey && !codeMode && !coarsePointerRef.current) {
                                                    e.preventDefault();
                                                    handleSubmitAnswer();
                                                }
                                            }}
                                            placeholder={codeMode ? "Explain your approach (optional) — or speak it" : isListening ? "🎤 Listening... speak your answer" : "Tap the mic to speak, or type your answer"}
                                            className={`w-full px-4 py-3 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none transition-all resize-none bg-white/5 ${isListening
                                                ? "border border-red-500/50 focus:border-red-400"
                                                : "border border-white/10 focus:border-purple-500/50"}`}
                                            rows={codeMode ? 1 : 2}
                                            disabled={!currentQuestion}
                                        />
                                        {answer.length > 0 && <div className="absolute top-2 right-2 text-xs text-gray-600">{wordCount(answer)}w</div>}
                                    </div>

                                    <button type="button" onClick={() => setCodeMode((v) => !v)} aria-pressed={codeMode} title="Answer with code"
                                        className={`flex-shrink-0 h-12 px-3 rounded-xl border text-sm font-medium transition-all flex items-center gap-1.5 ${codeMode ? "border-purple-400/40 bg-purple-500/15 text-purple-200" : "border-white/10 bg-white/5 text-gray-400 hover:text-white"}`}>
                                        <Code2 className="w-4 h-4" /><span className="hidden sm:inline">Code</span>
                                    </button>
                                    <button type="button" onClick={() => setShowSkipModal(true)}
                                        className="flex-1 sm:flex-none flex-shrink-0 px-4 h-12 rounded-xl bg-white/5 border border-white/10 text-gray-400 font-medium text-sm hover:bg-white/10 hover:text-white transition-all active:scale-95">
                                        Skip
                                    </button>
                                    <button type="submit" disabled={!finalAnswerText}
                                        className="flex-[2] sm:flex-none flex-shrink-0 px-6 h-12 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold text-sm flex items-center justify-center hover:from-green-500 hover:to-emerald-500 transition-all shadow-lg shadow-green-500/20 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed gap-2">
                                        <Send className="w-4 h-4" />Submit
                                    </button>
                                </form>

                                <div className="mt-2 flex items-center justify-between px-1 min-h-[18px]">
                                    {hfCountdown !== null ? (
                                        <p className="text-xs font-medium text-green-400 flex items-center gap-2">
                                            Auto-submitting in {hfCountdown}s…
                                            <button type="button" onClick={() => { hfPausedRef.current = true; setHfCountdown(null); }} className="underline text-green-300 hover:text-white">Not yet</button>
                                        </p>
                                    ) : (
                                        <p className={`text-xs font-medium ${isListening ? "text-red-400" : "text-gray-600"}`}>
                                            {isListening ? (handsFree ? "🔴 Listening — pause when you're done" : "🔴 Recording — tap mic to stop")
                                                : <><span className="hidden sm:inline">{codeMode ? "Write your code, then Submit" : "Enter to submit · Shift+Enter for new line"}</span><span className="sm:hidden">{codeMode ? "Write your code, then Submit" : "Type or speak your answer"}</span></>}
                                        </p>
                                    )}
                                    <p className="text-xs text-gray-700">{handsFree ? "Hands-free" : finalAnswerText ? `${wordCount(answer)} words` : ""}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-2">
                                <div className="flex items-center justify-center gap-2 text-gray-500 text-sm">
                                    {isSpeaking ? <><Volume2 className="w-4 h-4 animate-pulse" /><span>{INTERVIEWER_NAME} is speaking…</span></>
                                        : <><Loader2 className="w-4 h-4 animate-spin" /><span>{INTERVIEWER_NAME} is thinking…</span></>}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {showSkipModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowSkipModal(false)} />
                    <div className="relative z-10 w-full max-w-sm rounded-2xl border border-white/10 bg-[#13091f] shadow-2xl p-6">
                        <div className="w-12 h-12 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center mx-auto mb-4">
                            <span className="text-2xl">⏭️</span>
                        </div>
                        <h3 className="text-white font-semibold text-lg text-center mb-2">Skip this question?</h3>
                        <p className="text-gray-400 text-sm text-center mb-6 leading-relaxed">Skipped questions aren&apos;t scored, and you won&apos;t get feedback on them.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowSkipModal(false)}
                                className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm font-medium hover:bg-white/10">
                                Keep Answering
                            </button>
                            <button
                                onClick={() => {
                                    setShowSkipModal(false);
                                    setAnswer("");
                                    setCode("");
                                    setCodeMode(false);
                                    setAnswerStartedAt(null);
                                    stopListening();
                                    toast("Question skipped", { icon: "⏭️" });
                                    const skippedQ = currentQuestion;
                                    setMessages((prev) => [...prev, { id: uid(), role: "ai", content: skippedQ }, { id: uid(), role: "user", content: "(skipped)", status: "skipped", score: 0 }]);
                                    setCurrentQuestion("");
                                    const saved = saveSkippedQuestion(skippedQ);
                                    pendingScoresRef.current.add(saved);
                                    saved.finally(() => pendingScoresRef.current.delete(saved));
                                    proceedAfterAnswer({ lastQuestion: skippedQ, lastAnswer: SKIPPED });
                                }}
                                className="flex-1 py-2.5 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-sm font-medium hover:bg-yellow-500/20">
                                Skip Question
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
