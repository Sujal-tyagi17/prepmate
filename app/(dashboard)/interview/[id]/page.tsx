"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Brain, Send, Loader2, CheckCircle, Mic, MicOff, Clock, Zap, Target, MessageSquare, ArrowLeft, Volume2, VolumeX } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { plannedSessionSeconds } from "@/lib/interview-session";

/** After the session clock hits zero, the candidate gets this long to finish their current answer. */
const GRACE_SECONDS = 120;
/** After this long on one answer, show a gentle (non-blocking) nudge to wrap up. */
const LONG_ANSWER_SECONDS = 180;

const fmtClock = (secs: number) => {
    const s = Math.max(0, Math.floor(secs));
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
};

interface Message {
    role: "ai" | "user";
    content: string;
    score?: number;
}

export default function InterviewPage({ params }: { params: { id: string } }) {
    const router = useRouter();
    const [interview, setInterview] = useState<any>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [currentQuestion, setCurrentQuestion] = useState("");
    const [answer, setAnswer] = useState("");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [showSkipModal, setShowSkipModal] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [questionError, setQuestionError] = useState("");
    const [completed, setCompleted] = useState(false);
    const [micActive, setMicActive] = useState(false);
    const [speechError, setSpeechError] = useState("");
    const [endingInterview, setEndingInterview] = useState(false);
    const [now, setNow] = useState(Date.now());
    const [userName, setUserName] = useState("");
    const [voiceEnabled, setVoiceEnabled] = useState(true);
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    // Open-ended answers: we only track how long the current answer has been going (no cutoff)
    const [answerStartedAt, setAnswerStartedAt] = useState<number | null>(null);
    const [currentKind, setCurrentKind] = useState<string>("");
    const lastKindRef = useRef<string>("");
    const [timeUp, setTimeUp] = useState(false);
    const timeUpRef = useRef(false);
    const warnedRef = useRef<{ five?: boolean; one?: boolean; grace?: boolean }>({});
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const synthRef = useRef<SpeechSynthesis | null>(null);
    const recognitionRef = useRef<any>(null);
    const [needsStart, setNeedsStart] = useState<"" | "fresh" | "resume">("");
    const startClickedRef = useRef(false);
    const voiceEnabledRef = useRef(true);
    useEffect(() => { voiceEnabledRef.current = voiceEnabled; }, [voiceEnabled]);
    const questionInFlightRef = useRef(false); // prevents duplicate question requests (speech events can fire twice)
    // Speech callbacks can fire after the page unmounts (e.g. cancel() triggers onerror) — ignore them then
    const aliveRef = useRef(true);
    useEffect(() => {
        aliveRef.current = true;
        return () => { aliveRef.current = false; };
    }, []);
    const [questionNumber, setQuestionNumber] = useState(0);
    const questionNumberRef = useRef(0); // always-fresh copy for closures

    // Initialize speech synthesis and recognition
    useEffect(() => {
        if (typeof window !== 'undefined') {
            if ('speechSynthesis' in window) {
                synthRef.current = window.speechSynthesis;
            }
            
            // Initialize speech recognition
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (SpeechRecognition) {
                recognitionRef.current = new SpeechRecognition();
                recognitionRef.current.continuous = true;
                recognitionRef.current.interimResults = true;
                recognitionRef.current.lang = 'en-US';
                
                recognitionRef.current.onresult = (event: any) => {
                    const transcript = Array.from(event.results)
                        .map((result: any) => result[0])
                        .map((result: any) => result.transcript)
                        .join('');
                    setAnswer(transcript);
                };
                
                recognitionRef.current.onerror = (event: any) => {
                    console.error('Speech recognition error:', event.error);
                    setIsListening(false);
                    if (event.error === 'no-speech') {
                        setSpeechError('No speech detected. Check your microphone or type your answer below.');
                        setTimeout(() => setSpeechError(""), 5000);
                    }
                };
                
                recognitionRef.current.onend = () => {
                    setIsListening(false);
                };
            }
        }
    }, []);

    // Toggle microphone
    const toggleMicrophone = () => {
        if (!recognitionRef.current) {
            toast.error('Speech recognition not supported in this browser');
            return;
        }
        
        if (isListening) {
            recognitionRef.current.stop();
            setIsListening(false);
        } else {
            try {
                recognitionRef.current.start();
                setIsListening(true);
                // Stop AI voice when user starts speaking
                if (synthRef.current) {
                    synthRef.current.cancel();
                    setIsSpeaking(false);
                }
            } catch (error) {
                console.error('Error starting recognition:', error);
                toast.error('Could not start microphone');
            }
        }
    };

    // Derived stats — messages hold transitions + completed Q+A pairs (current question is separate)
    const answeredCount = messages.filter(m => m.role === "user").length;
    const questionCount = answeredCount; // answered questions
    const scores = messages.filter(m => m.role === "user" && m.score !== undefined).map(m => m.score as number);
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) : 0;
    const confidence = Math.min(100, Math.max(0, avgScore + (Math.random() * 10 - 5)));

    // Session clock — counts down from the length chosen at setup (stored on the interview)
    const sessionTotal = plannedSessionSeconds(interview ?? {});
    const sessionStart = interview ? new Date(interview.started_at || interview.created_at).getTime() : now;
    // The clock doesn't run until a fresh interview is actually started
    const sessionElapsed = needsStart === "fresh" ? 0 : Math.max(0, Math.floor((now - sessionStart) / 1000));
    const sessionRemaining = sessionTotal - sessionElapsed;
    const answerSeconds = answerStartedAt ? Math.floor((now - answerStartedAt) / 1000) : 0;
    const kindLabel: Record<string, string> = { intro: "Introduction", "follow-up": "Follow-up", "new-topic": "", closing: "Wrap-up" };

    // Session time management: heads-ups, then a graceful finish instead of a hard cutoff
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
            if (currentQuestion && !submitting) {
                // Don't cut the candidate off mid-answer — let them finish, then wrap up.
                toast("Time's up — finish this answer and we'll wrap up.", { icon: "⏰", duration: 5000 });
            } else if (!submitting && !generating) {
                handleEndInterview();
            }
        }

        // Grace period exhausted: submit whatever they have (or end) so the session can't run forever.
        if (timeUpRef.current && sessionRemaining <= -GRACE_SECONDS && !warnedRef.current.grace && !submitting) {
            warnedRef.current.grace = true;
            if (currentQuestion && answer.trim()) {
                handleSubmitAnswer({ preventDefault: () => {} } as any);
            } else {
                handleEndInterview();
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [now]);

    useEffect(() => {
        fetchInterview();
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => {
            clearInterval(timer);
            // Cancel any ongoing speech when leaving the page
            if (synthRef.current) {
                synthRef.current.cancel();
            }
            // Stop recognition when leaving
            if (recognitionRef.current && isListening) {
                recognitionRef.current.stop();
            }
        };
    }, [params.id]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    /**
     * Speak text and resolve when done. Never blocks the interview: resolves on end, error,
     * if the browser silently ignores speak() (iOS without a user gesture), or after a max duration.
     */
    const speakAsync = (text: string): Promise<void> => new Promise((resolve) => {
        const synth = synthRef.current;
        if (!text || !voiceEnabledRef.current || !synth) return resolve();
        let done = false, started = false;
        const finish = () => {
            if (done) return;
            done = true;
            clearTimeout(probe); clearTimeout(hard);
            setIsSpeaking(false);
            resolve();
        };
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "en-US"; u.rate = 0.95; u.pitch = 1.0; u.volume = 1.0;
        const voices = synth.getVoices();
        const preferred = voices.find(v => v.lang.startsWith("en") && /female|samantha|google us/i.test(v.name)) || voices.find(v => v.lang.startsWith("en"));
        if (preferred) u.voice = preferred;
        u.onstart = () => { started = true; };
        u.onend = finish;
        u.onerror = finish;
        const probe = setTimeout(() => { if (!started && !synth.speaking) finish(); }, 2000);
        const hard = setTimeout(finish, Math.min(60000, 3000 + text.length * 85));
        setIsSpeaking(true);
        synth.speak(u);
    });

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
        } catch (_) {}

        if (mode === "resume") {
            generateQuestion();
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
        const position = interview.role ? `the ${interview.role} position` : "this interview";
        const greeting = `Hello ${firstName}! Welcome to your AI-powered interview.`;
        const intro = `I'm your AI interviewer for ${position}${interview.company ? ` at ${interview.company}` : ""}. This is a ${minutes}-minute, ${interview.difficulty} difficulty ${interview.type.replace("-", " ")} interview. There's no timer on individual questions — answer at your own pace, and I may ask follow-ups just like a real interviewer. Let's start with a quick introduction.`;
        setMessages([{ role: "ai", content: greeting }, { role: "ai", content: intro }]);

        // Fetch the first question while the intro is being spoken; show it once speech ends
        const introSpoken = speakAsync(greeting).then(() => speakAsync(intro));
        generateQuestion(introSpoken);
    };

    const fetchInterview = async () => {
        try {
            const response = await fetch(`/api/interview/${params.id}`);
            const data = await response.json();
            if (data.success) {
                setInterview(data.interview);
                setUserName(data.interview.user?.name || "there");
                
                const loadedMessages: Message[] = [];
                
                const orderedAnswers = [...(data.interview.answers || [])].sort(
                    (a: any, b: any) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
                );
                orderedAnswers.forEach((a: any) => {
                    loadedMessages.push({ role: "ai", content: a.question_text ?? a.questionText });
                    const ans = a.user_answer ?? a.userAnswer;
                    loadedMessages.push({ role: "user", content: ans === "[No answer provided]" ? "(skipped)" : ans, score: a.score });
                });
                
                setMessages(loadedMessages);
                // Track answered count for resumed interviews
                setQuestionNumber(data.interview.answers.length);
                questionNumberRef.current = data.interview.answers.length;
                
                if (data.interview.status === "completed") {
                    setCompleted(true);
                } else {
                    // Wait for a tap before starting: mobile browsers (iOS especially) only allow
                    // speech audio that starts from a user gesture, and the clock should start then too.
                    setNeedsStart(data.interview.answers.length > 0 ? "resume" : "fresh");
                }
            } else {
                toast.error(data.error || "Failed to load interview");
                router.push("/dashboard");
            }
        } catch (error) {
            console.error("Error fetching interview:", error);
            router.push("/dashboard");
        } finally { setLoading(false); }
    };

    const generateQuestion = async (waitFor?: Promise<void>) => {
        if (!aliveRef.current) return;
        // The session ends on time, not after a fixed number of questions
        if (timeUpRef.current) {
            await handleEndInterview();
            return;
        }
        if (!aliveRef.current || questionInFlightRef.current) return;
        questionInFlightRef.current = true;
        setGenerating(true);
        setQuestionError("");
        setSpeechError("");
        // Stop mic before new question
        if (recognitionRef.current) {
            try { recognitionRef.current.stop(); } catch (_) {}
        }
        setIsListening(false);
        try {
            const response = await fetch(`/api/interview/${params.id}/question`, { method: "POST" });
            const data = await response.json();
            if (data.success && data.done) {
                // Session time is up — wrap up instead of asking another question
                timeUpRef.current = true;
                setTimeUp(true);
                await handleEndInterview();
                return;
            }
            if (data.success) {
                if (waitFor) await waitFor; // e.g. let the spoken intro finish first
                if (!aliveRef.current) return;
                // The interviewer's short reaction to the previous answer goes into the conversation
                if (data.transition) {
                    setMessages(prev => [...prev, { role: "ai", content: data.transition }]);
                }
                setCurrentKind(data.kind || "");
                lastKindRef.current = data.kind || "";
                setAnswerStartedAt(null);
                setCurrentQuestion(data.question);
                setQuestionNumber(prev => {
                    const next = prev + 1;
                    questionNumberRef.current = next;
                    return next;
                });
                // Question added to messages together with the answer in handleSubmitAnswer.
                // Answer clock + mic start after the AI finishes reading (or immediately if voice is off/blocked).
                const startMicAndTimer = () => {
                    if (!aliveRef.current) return;
                    setAnswerStartedAt(Date.now());
                    if (recognitionRef.current) {
                        try {
                            recognitionRef.current.start();
                            setIsListening(true);
                        } catch (e) { console.log('Mic auto-start failed', e); }
                    }
                };
                synthRef.current?.cancel();
                speakAsync(data.transition ? `${data.transition} ${data.question}` : data.question).then(startMicAndTimer);
            } else {
                const msg = data.error || "Failed to generate question";
                const isQuota = msg.toLowerCase().includes("quota");
                const displayMsg = isQuota
                    ? "AI quota exceeded. Please add a GROQ_API_KEY in Vercel Environment Variables."
                    : `Failed to generate question: ${msg}`;
                setQuestionError(displayMsg);
                toast.error(displayMsg, { duration: 8000 });
            }
        } catch (error) {
            console.error("Error generating question:", error);
            const msg = "Failed to reach the server. Check your connection and AI API keys in Vercel.";
            setQuestionError(msg);
            toast.error(msg, { duration: 5000 });
        }
        finally { setGenerating(false); questionInFlightRef.current = false; }
    };

    // Save a skipped question to DB so it appears in feedback with the actual question text
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

    const handleSubmitAnswer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentQuestion) return;
        
        // Check if answer is empty - skip evaluation if no answer provided
        const userAnswer = answer.trim();
        if (!userAnswer) {
            setSpeechError("Please provide an answer before submitting.");
            setTimeout(() => setSpeechError(""), 4000);
            return;
        }
        setSpeechError("");
        
        // Stop listening if active
        if (isListening && recognitionRef.current) {
            recognitionRef.current.stop();
            setIsListening(false);
        }
        
        setSubmitting(true);
        setAnswer("");
        // Add the completed Q+A pair to conversation history
        setMessages(prev => [
            ...prev,
            { role: "ai", content: currentQuestion },
            { role: "user", content: userAnswer },
        ]);
        try {
            const response = await fetch(`/api/interview/${params.id}/evaluate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ question: currentQuestion, answer: userAnswer }),
            });
            const data = await response.json();
            if (data.success) {
                setMessages(prev => {
                    const updated = [...prev];
                    updated[updated.length - 1].score = data.evaluation.score;
                    return updated;
                });
                setCurrentQuestion("");
                setAnswerStartedAt(null);
                proceedAfterAnswer();
            } else {
                throw new Error(data.error || "Failed to save answer");
            }
        } catch (error) {
            console.error("Error submitting answer:", error);
            // Put the answer back so nothing is lost, and let the candidate retry
            setMessages(prev => prev.slice(0, -2));
            setAnswer(userAnswer);
            toast.error("Couldn't submit your answer. Please try again.");
        }
        finally { setSubmitting(false); }
    };

    /** After an answer (or skip): wrap up if time is up or this was the closing question, else continue. */
    const proceedAfterAnswer = () => {
        if (timeUpRef.current || lastKindRef.current === "closing") {
            toast.success("🎉 That's time! Generating your feedback...");
            setTimeout(() => handleEndInterview(), 1500);
        } else {
            setTimeout(() => generateQuestion(), 900);
        }
    };

    const endingRef = useRef(false);
    const handleEndInterview = async () => {
        if (endingRef.current) return; // time-up, closing answer and End button can race
        endingRef.current = true;
        // Show overlay immediately — stop everything
        setEndingInterview(true);
        if (isListening && recognitionRef.current) {
            recognitionRef.current.stop();
            setIsListening(false);
        }
        if (synthRef.current) {
            synthRef.current.cancel();
            setIsSpeaking(false);
        }
        try {
            const response = await fetch(`/api/interview/${params.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "completed" }),
            });
            const data = await response.json();
            if (data.success) {
                router.push(`/interview/${params.id}/feedback`);
            } else {
                throw new Error(data.error || "Failed to end interview");
            }
        } catch (error) {
            console.error("Error ending interview:", error);
            toast.error("Couldn't finish the interview. Please try again.");
            endingRef.current = false;
            setEndingInterview(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[100dvh] bg-[#0a0514]">
                <div className="flex flex-col items-center">
                    <div className="relative w-16 h-16 mb-5">
                        <div className="absolute inset-0 rounded-full border-2 border-purple-500/20" />
                        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-purple-400 animate-spin" />
                        <div className="absolute inset-2 rounded-full border-2 border-transparent border-t-fuchsia-400 animate-spin [animation-duration:0.6s] [animation-direction:reverse]" />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-2 h-2 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
                        </div>
                    </div>
                    <p className="text-base font-bold text-white">Loading...</p>
                    <p className="text-sm text-gray-400 mt-1">Please wait</p>
                </div>
            </div>
        );
    }

    if (completed) {
        const finalScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) : 0;
        return (
            <div className="flex items-center justify-center h-[100dvh] bg-[#0a0514] p-8">
                <div className="text-center max-w-md">
                    {/* Big score circle */}
                    <div className="relative w-32 h-32 mx-auto mb-6">
                        <svg width="128" height="128" viewBox="0 0 128 128">
                            <circle cx="64" cy="64" r="54" fill="none" stroke="rgba(168,85,247,0.15)" strokeWidth="10" />
                            <circle cx="64" cy="64" r="54" fill="none"
                                stroke="url(#finGrad)" strokeWidth="10" strokeLinecap="round"
                                strokeDasharray={2 * Math.PI * 54}
                                strokeDashoffset={2 * Math.PI * 54 - (finalScore / 100) * 2 * Math.PI * 54}
                                transform="rotate(-90 64 64)" />
                            <defs>
                                <linearGradient id="finGrad" x1="0" y1="0" x2="1" y2="0">
                                    <stop offset="0%" stopColor="#a855f7" />
                                    <stop offset="100%" stopColor="#ec4899" />
                                </linearGradient>
                            </defs>
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-3xl font-bold text-white">{finalScore}%</span>
                            <span className="text-xs text-gray-500">Score</span>
                        </div>
                    </div>

                    <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-white mb-2">Interview Complete!</h2>
                    <p className="text-gray-400 mb-2">You answered {interview?.answers?.length || 0} questions</p>
                    <p className="text-gray-600 text-sm mb-8">
                        {finalScore >= 80 ? "Outstanding performance! 🎉" : finalScore >= 60 ? "Good effort! Keep practicing 💪" : "Keep going — progress takes time 🌱"}
                    </p>

                    <div className="flex gap-3 justify-center">
                        <Link href="/dashboard"
                            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm hover:bg-white/10 transition-all">
                            <ArrowLeft className="w-4 h-4" /> Dashboard
                        </Link>
                        <Link href="/analytics"
                            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white text-sm font-semibold hover:scale-[1.02] transition-all shadow-lg shadow-purple-500/25">
                            View Analytics
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-[100dvh] overflow-hidden bg-[#0a0514]">

            {/* End interview loading overlay */}
            {endingInterview && (
                <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0a0514]/95 backdrop-blur-sm">
                    <div className="relative w-16 h-16 mb-5">
                        <div className="absolute inset-0 rounded-full border-2 border-purple-500/20" />
                        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-purple-400 animate-spin" />
                        <div className="absolute inset-2 rounded-full border-2 border-transparent border-t-fuchsia-400 animate-spin [animation-duration:0.6s] [animation-direction:reverse]" />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-2 h-2 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
                        </div>
                    </div>
                    <p className="text-base font-bold text-white">Loading...</p>
                    <p className="text-sm text-gray-400 mt-1">Generating your feedback report</p>
                </div>
            )}

            {/* ── LEFT — Insights Panel ── */}
            <aside className="hidden lg:flex w-64 flex-shrink-0 border-r border-white/5 flex-col py-5 px-4 overflow-y-auto"
                style={{ background: "linear-gradient(180deg, #0f0a1a 0%, #0a0a0f 100%)" }}>

                <div className="mb-6">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                        <span className="text-xs text-green-400 font-medium">Live Interview</span>
                    </div>
                    <p className="text-xs text-gray-600 capitalize">{interview?.type} · {interview?.difficulty}</p>
                </div>

                {/* Session clock — time left in the whole interview */}
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
                                <span className={`text-3xl font-bold font-mono ${sessionRemaining <= 60 ? "text-red-400" : sessionRemaining <= 300 ? "text-yellow-400" : "text-purple-400"}`}>
                                    {fmtClock(sessionRemaining)}
                                </span>
                                <span className="text-xs text-gray-600 mt-1">{timeUp ? "Wrapping up" : "Time left"}</span>
                            </div>
                        </div>
                        <p className="text-xs text-gray-500 text-center">
                            {Math.round(sessionTotal / 60)}-minute interview · no per-question limit
                        </p>
                    </div>
                </div>

                {/* Interview Stats */}
                <div className="glass-card rounded-2xl p-4 mb-4">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs text-gray-500">Interview Status</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="text-center">
                            <div className="text-2xl font-bold text-purple-400">{questionNumber}</div>
                            <div className="text-xs text-gray-600">Questions Asked</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-fuchsia-400">{questionCount}</div>
                            <div className="text-xs text-gray-600">Answered</div>
                        </div>
                    </div>
                </div>

                {/* Timer */}
                <div className="glass-card rounded-2xl p-4 mb-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-3.5 h-3.5 text-gray-500" />
                        <span className="text-xs text-gray-500">Elapsed</span>
                    </div>
                    <div className="text-2xl font-bold text-white font-mono">{fmtClock(Math.min(sessionElapsed, sessionTotal + GRACE_SECONDS))}<span className="text-sm text-gray-600"> / {fmtClock(sessionTotal)}</span></div>
                </div>

                {/* Confidence meter */}
                <div className="glass-card rounded-2xl p-4 mb-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1.5">
                            <Zap className="w-3.5 h-3.5 text-purple-400" />
                            <span className="text-xs text-gray-400">Confidence</span>
                        </div>
                        <span className="text-sm font-bold text-white">{Math.round(confidence)}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-fuchsia-600 transition-all duration-700"
                            style={{ width: `${Math.round(confidence)}%` }} />
                    </div>
                    <p className="text-xs text-gray-600 mt-2">
                        {Math.round(confidence) >= 80 ? "High confidence" : Math.round(confidence) >= 50 ? "Good pace" : scores.length === 0 ? "Answer questions to build" : "Keep elaborating on examples"}
                    </p>
                </div>

                {/* Score */}
                <div className="glass-card rounded-2xl p-4 mb-4">
                    <div className="flex items-center gap-1.5 mb-2">
                        <Target className="w-3.5 h-3.5 text-pink-400" />
                        <span className="text-xs text-gray-400">Avg Score</span>
                    </div>
                    {avgScore > 0 ? (
                        <>
                            <div className="text-2xl font-bold grad-text">{avgScore}%</div>
                            <div className="h-1.5 rounded-full bg-white/5 mt-2 overflow-hidden">
                                <div className="h-full rounded-full bg-gradient-to-r from-pink-500 to-fuchsia-500 transition-all"
                                    style={{ width: `${avgScore}%` }} />
                            </div>
                        </>
                    ) : (
                        <div className="text-sm text-gray-600 mt-1">Calculating...</div>
                    )}
                    <p className="text-xs text-gray-600 mt-1">{questionCount} Q{questionCount !== 1 ? "s" : ""} answered</p>
                </div>

                {/* Live feedback */}
                {scores.length > 0 && (
                    <div className="glass-card rounded-2xl p-4 mb-4">
                        <div className="flex items-center gap-1.5 mb-3">
                            <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
                            <span className="text-xs text-gray-400">Last Score</span>
                        </div>
                        <div className="text-xl font-bold text-white">{scores[scores.length - 1]}/10</div>
                        <div className="h-1.5 rounded-full bg-white/5 mt-2 overflow-hidden">
                            <div className="h-full rounded-full bg-cyan-500 transition-all"
                                style={{ width: `${(scores[scores.length - 1] / 10) * 100}%` }} />
                        </div>
                    </div>
                )}

                {/* Voice Toggle */}
                <div className="mb-3">
                    <button onClick={() => {
                        setVoiceEnabled(!voiceEnabled);
                        if (voiceEnabled && synthRef.current) {
                            synthRef.current.cancel();
                            setIsSpeaking(false);
                        }
                    }}
                        className={`w-full py-2.5 rounded-xl border text-xs font-medium transition-all duration-200 hover:bg-white/10 active:scale-95 flex items-center justify-center gap-2 ${
                            voiceEnabled 
                                ? "border-purple-500/30 bg-purple-500/10 text-purple-400" 
                                : "border-white/10 bg-white/5 text-gray-500"
                        }`}>
                        {voiceEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                        {voiceEnabled ? "AI Voice On" : "AI Voice Off"}
                    </button>
                </div>
                
                {/* End Interview */}
                <div className="mt-auto">
                    <button onClick={handleEndInterview} disabled={endingInterview}
                        className="w-full py-2.5 rounded-xl border border-red-500/20 bg-red-500/8 text-red-400 text-xs font-medium hover:bg-red-500/15 transition-all duration-200 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                        {endingInterview ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Ending...</> : "End Interview"}
                    </button>
                </div>
            </aside>

            {/* ── CENTER — Chat Area ── */}
            <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

                {/* Top bar */}
                <div className="border-b border-white/5 px-3 sm:px-6 py-2.5 sm:py-3 pt-[max(0.625rem,env(safe-area-inset-top))] flex items-center justify-between gap-2 flex-shrink-0">
                    <Link href="/dashboard" aria-label="Back to dashboard" className="flex-shrink-0 flex items-center gap-1.5 text-xs text-gray-400 hover:text-white p-2 sm:px-3 sm:py-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-200">
                        <ArrowLeft className="w-4 h-4 sm:w-3.5 sm:h-3.5" /> <span className="hidden sm:inline">Dashboard</span>
                    </Link>

                    {/* Mobile: live status + type (sidebar is hidden below lg) */}
                    <div className="lg:hidden flex-1 min-w-0 flex flex-col items-center">
                        <span className="flex items-center gap-1.5 text-xs text-green-400 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> Live · <span className={`font-mono ${sessionRemaining <= 60 ? "text-red-400" : sessionRemaining <= 300 ? "text-yellow-400" : ""}`}>{fmtClock(sessionRemaining)}</span> left
                        </span>
                        <span className="text-[11px] text-gray-500 capitalize truncate max-w-full">
                            {interview?.type?.replace("-", " ")} · {interview?.difficulty}{interview?.company ? ` · ${interview.company}` : ""}
                        </span>
                    </div>

                    {/* Mobile: voice toggle + end */}
                    <div className="lg:hidden flex items-center gap-1.5 flex-shrink-0">
                        <button
                            onClick={() => {
                                setVoiceEnabled(!voiceEnabled);
                                if (voiceEnabled && synthRef.current) { synthRef.current.cancel(); setIsSpeaking(false); }
                            }}
                            aria-label={voiceEnabled ? "Turn AI voice off" : "Turn AI voice on"}
                            className={`p-2 rounded-xl border transition-all ${voiceEnabled ? "border-purple-500/30 bg-purple-500/10 text-purple-400" : "border-white/10 bg-white/5 text-gray-500"}`}>
                            {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                        </button>
                        <button onClick={handleEndInterview} disabled={endingInterview}
                            className="px-3 py-2 rounded-xl border border-red-500/25 bg-red-500/10 text-red-400 text-xs font-semibold disabled:opacity-60 flex items-center gap-1.5">
                            {endingInterview ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "End"}
                        </button>
                    </div>

                    <div className="hidden lg:flex items-center gap-3 min-w-0">
                        {interview?.company && (
                            <span className="text-xs px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-gray-400">
                                {interview.company}
                            </span>
                        )}
                        {interview?.role && (
                            <span className="text-xs px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400">
                                {interview.role}
                            </span>
                        )}
                    </div>
                </div>

                {/* Messages — scrollable conversation history */}
                <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 sm:py-6">
                    <div className="space-y-4 max-w-2xl mx-auto">
                        {needsStart && (
                            <div className="min-h-[60vh] flex items-center justify-center">
                                <div className="w-full max-w-md rounded-3xl border border-purple-500/25 bg-gradient-to-b from-purple-500/10 to-transparent p-6 sm:p-8 text-center">
                                    <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
                                        <Mic className="w-7 h-7 text-white" />
                                    </div>
                                    <h2 className="text-xl font-bold text-white mb-1">
                                        {needsStart === "resume" ? "Continue your interview" : "Ready when you are"}
                                    </h2>
                                    <p className="text-sm text-gray-400 mb-5">
                                        {Math.round(sessionTotal / 60)} min · <span className="capitalize">{interview?.type?.replace("-", " ")} · {interview?.difficulty}</span>{interview?.company ? ` · ${interview.company}` : ""}
                                    </p>
                                    <ul className="text-left text-sm text-gray-300 space-y-2 mb-6">
                                        <li className="flex items-start gap-2"><Volume2 className="w-4 h-4 mt-0.5 text-purple-400 flex-shrink-0" /> Turn your volume up (and silent mode off on iPhone) to hear the interviewer</li>
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
                        {messages.length === 0 && !generating && !currentQuestion && !needsStart && (
                            <div className="text-center py-16">
                                <div className="flex flex-col items-center gap-3">
                                    <div className="relative w-12 h-12">
                                        <div className="absolute inset-0 rounded-full border-2 border-purple-500/20" />
                                        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-purple-400 animate-spin" />
                                        <div className="absolute inset-2 rounded-full border-2 border-transparent border-t-fuchsia-400 animate-spin [animation-duration:0.6s] [animation-direction:reverse]" />
                                    </div>
                                    <p className="text-gray-500 text-sm">Preparing your interview...</p>
                                </div>
                            </div>
                        )}
                        {messages.map((msg, i) => (
                            <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                                <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${msg.role === "ai"
                                    ? "bg-gradient-to-br from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/20"
                                    : "bg-white/10 text-gray-300"}`}>
                                    {msg.role === "ai" ? <Volume2 className="w-4 h-4" /> : "U"}
                                </div>
                                <div className={`min-w-0 max-w-[85%] sm:max-w-xl flex flex-col gap-1 ${msg.role === "user" ? "items-end" : "items-start"}`}>
                                    <div className={`rounded-2xl px-3.5 sm:px-4 py-2.5 sm:py-3 text-sm leading-relaxed break-words ${msg.role === "ai"
                                        ? "bg-purple-500/10 border border-purple-500/20 text-gray-200"
                                        : "bg-white/7 border border-white/10 text-gray-300"}`}>
                                        {msg.content}
                                    </div>
                                    {msg.role === "user" && msg.score !== undefined && (
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                            msg.score >= 7 ? "text-green-400 bg-green-500/10" : msg.score >= 4 ? "text-yellow-400 bg-yellow-500/10" : "text-red-400 bg-red-500/10"
                                        }`}>{msg.score}/10</span>
                                    )}
                                </div>
                            </div>
                        ))}
                        {generating && (
                            <div className="flex gap-3">
                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                                </div>
                                <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl px-4 py-3 flex items-center gap-2">
                                    {[0, 1, 2].map((i) => (
                                        <div key={i} className="w-2 h-2 rounded-full bg-purple-400 animate-bounce"
                                            style={{ animationDelay: `${i * 0.15}s` }} />
                                    ))}
                                    <span className="text-xs text-purple-400 ml-1">Generating question...</span>
                                </div>
                            </div>
                        )}
                        {!generating && questionError && (
                            <div className="flex gap-3">
                                <div className="w-9 h-9 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center flex-shrink-0">
                                    <span className="text-red-400 text-sm font-bold">!</span>
                                </div>
                                <div className="bg-red-500/10 border border-red-500/25 rounded-2xl px-4 py-3 flex flex-col gap-2 max-w-xl">
                                    <p className="text-red-300 text-sm font-medium">⚠️ Question generation failed</p>
                                    <p className="text-red-400/80 text-xs">{questionError}</p>
                                    <button
                                        onClick={() => { setQuestionError(""); generateQuestion(); }}
                                        className="self-start mt-1 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-colors"
                                    >
                                        Retry
                                    </button>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                </div>

                {/* Input bar */}
                <div className="border-t border-white/5 flex-shrink-0 bg-[#0a0514]/80 backdrop-blur-xl">
                    {/* Current Question Card — pinned above input */}
                    {currentQuestion && (
                        <div className="px-3 sm:px-6 pt-3 sm:pt-4">
                            <div className="relative rounded-2xl border border-purple-500/25 bg-purple-500/5 backdrop-blur-sm overflow-hidden mb-3">
                                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/60 to-transparent" />
                                <div className="p-3.5 sm:p-4">
                                    <div className="flex items-center justify-between gap-2 mb-2 sm:mb-3">
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-semibold">
                                            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                                            {kindLabel[currentKind] || `Question ${questionNumber}`}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            {isSpeaking && (
                                                <span className="inline-flex items-center gap-1.5 text-xs text-purple-300 animate-pulse">
                                                    <Volume2 className="w-3.5 h-3.5" /> Reading aloud...
                                                </span>
                                            )}
                                            {answerStartedAt && (
                                                <span title="Time spent on this answer — no limit"
                                                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
                                                    answerSeconds >= LONG_ANSWER_SECONDS ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' : 'bg-white/5 border-white/10 text-gray-400'
                                                }`}>
                                                    <Mic className="w-3 h-3" />
                                                    {fmtClock(answerSeconds)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <p className="text-white text-[15px] sm:text-base font-semibold leading-relaxed mb-3 max-h-[28vh] overflow-y-auto">{currentQuestion}</p>
                                    <div className="flex items-center gap-2 pt-2 border-t border-white/8">
                                        {isSpeaking ? (
                                            <><Volume2 className="w-3.5 h-3.5 text-purple-400 animate-pulse" /><span className="text-xs text-purple-400">Mic will activate automatically when AI finishes reading</span></>
                                        ) : isListening ? (
                                            <><Mic className="w-3.5 h-3.5 text-red-400" /><span className="text-xs text-red-300">🔴 Recording — speak your answer</span></>
                                        ) : (
                                            <><Mic className="w-3.5 h-3.5 text-purple-400" /><span className="text-xs text-purple-300">🎤 Mic ready — speak or type below</span></>
                                        )}
                                    </div>
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

                    <div className="px-3 sm:px-6 py-3 sm:py-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                    {/* Only show input during actual questions */}
                    {needsStart ? null : currentQuestion ? (
                        <>
                            <form onSubmit={handleSubmitAnswer} className="flex flex-wrap sm:flex-nowrap gap-2 sm:gap-3 items-end">
                                {/* Mic button */}
                                <button
                                    type="button"
                                    onClick={toggleMicrophone}
                                    className={`flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center transition-all duration-200 shadow-lg active:scale-90 ${
                                        isListening
                                            ? "bg-gradient-to-br from-red-500 to-pink-600 border-2 border-red-400/60 text-white scale-105 shadow-red-500/40"
                                            : "bg-gradient-to-br from-purple-600 to-fuchsia-600 border-2 border-purple-400/40 text-white hover:scale-105 shadow-purple-500/25"
                                    }`}
                                    disabled={submitting || generating || !currentQuestion}
                                >
                                    {isListening ? (
                                        <div className="relative flex items-center justify-center">
                                            <Mic className="w-6 h-6" />
                                            <div className="absolute -inset-1 rounded-full border-2 border-red-400/50 animate-ping" />
                                        </div>
                                    ) : (
                                        <Mic className="w-6 h-6" />
                                    )}
                                </button>

                                {/* Textarea + char count */}
                                <div className="order-first sm:order-none basis-full sm:basis-auto flex-1 relative">
                                    <textarea
                                        value={answer}
                                        onChange={(e) => {
                                            setAnswer(e.target.value);
                                            if (synthRef.current && e.target.value.length > 0) {
                                                synthRef.current.cancel();
                                                setIsSpeaking(false);
                                            }
                                            if (speechError) setSpeechError("");
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && !e.shiftKey && !submitting) {
                                                e.preventDefault();
                                                if (isListening && recognitionRef.current) recognitionRef.current.stop();
                                                handleSubmitAnswer(e as any);
                                            }
                                        }}
                                        placeholder={
                                            isListening
                                                ? "🎤 Listening... speak your answer"
                                                : "Tap the mic to speak, or type your answer"
                                        }
                                        className={`w-full px-4 py-3 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none transition-all resize-none bg-white/5 ${
                                            isListening
                                                ? "border border-red-500/50 focus:border-red-400 focus:ring-2 focus:ring-red-500/15"
                                                : "border border-white/10 focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/10"
                                        }`}
                                        rows={2}
                                        disabled={submitting || generating || !currentQuestion}
                                    />
                                    {/* Recording waveform */}
                                    {isListening && (
                                        <div className="absolute bottom-3 right-3 flex items-end gap-0.5">
                                            {[6, 12, 8, 14, 6].map((h, i) => (
                                                <div key={i} className="w-1 bg-red-400 rounded-full animate-pulse"
                                                    style={{ height: `${h}px`, animationDelay: `${i * 0.1}s` }} />
                                            ))}
                                        </div>
                                    )}
                                    {/* Char count */}
                                    {answer.length > 0 && (
                                        <div className="absolute top-2 right-2 text-xs text-gray-600">
                                            {answer.split(/\s+/).filter(Boolean).length}w
                                        </div>
                                    )}
                                </div>

                                {/* Skip */}
                                <button
                                    type="button"
                                    onClick={() => setShowSkipModal(true)}
                                    disabled={submitting || generating || !currentQuestion}
                                    className="flex-1 sm:flex-none flex-shrink-0 px-4 h-12 rounded-xl bg-white/5 border border-white/10 text-gray-400 font-medium text-sm hover:bg-white/10 hover:text-white transition-all duration-200 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    Skip
                                </button>

                                {/* Submit */}
                                <button type="submit"
                                    disabled={submitting || generating || !currentQuestion || !answer.trim()}
                                    className="flex-[2] sm:flex-none flex-shrink-0 px-6 h-12 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold text-sm flex items-center justify-center hover:from-green-500 hover:to-emerald-500 transition-all duration-200 shadow-lg shadow-green-500/20 hover:shadow-green-500/35 hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 gap-2">
                                    {submitting ? (
                                        <><Loader2 className="w-4 h-4 animate-spin" />Analyzing...</>
                                    ) : (
                                        <><Send className="w-4 h-4" />Submit</>
                                    )}
                                </button>
                            </form>

                            {/* Status hint */}
                            <div className="mt-2.5 flex items-center justify-between px-1">
                                <p className={`text-xs font-medium ${isListening ? "text-red-400" : "text-gray-600"}`}>
                                    {isListening ? "🔴 Recording — tap mic to stop" : <><span className="hidden sm:inline">Enter to submit · Shift+Enter for new line</span><span className="sm:hidden">Type or speak your answer</span></>}
                                </p>
                                <p className="text-xs text-gray-700">
                                    {answer.trim() ? `${answer.split(/\s+/).filter(Boolean).length} words` : "No answer yet"}
                                </p>
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-2">
                            <div className="flex items-center justify-center gap-2 text-gray-500 text-sm">
                                {isSpeaking ? (
                                    <>
                                        <Volume2 className="w-4 h-4 animate-pulse" />
                                        <span>AI is reading the question...</span>
                                    </>
                                ) : generating ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Generating question...</span>
                                    </>
                                ) : (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Preparing interview...</span>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                    </div>
                </div>
            </div>

            {/* Skip Confirmation Modal */}
            {showSkipModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div 
                        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                        onClick={() => setShowSkipModal(false)}
                    />
                    {/* Card */}
                    <div className="relative z-10 w-full max-w-sm rounded-2xl border border-white/10 bg-[#13091f] shadow-2xl shadow-purple-500/10 p-6 animate-in fade-in zoom-in-95 duration-200">
                        {/* Icon */}
                        <div className="w-12 h-12 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center mx-auto mb-4">
                            <span className="text-2xl">⏭️</span>
                        </div>
                        <h3 className="text-white font-semibold text-lg text-center mb-2">Skip this question?</h3>
                        <p className="text-gray-400 text-sm text-center mb-6 leading-relaxed">
                            You won't receive feedback for skipped questions. Your score may be affected.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowSkipModal(false)}
                                className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm font-medium hover:bg-white/10 hover:text-white transition-all"
                            >
                                Keep Answering
                            </button>
                            <button
                                onClick={() => {
                                    setShowSkipModal(false);
                                    setAnswer("");
                                    setAnswerStartedAt(null);
                                    if (isListening && recognitionRef.current) {
                                        recognitionRef.current.stop();
                                        setIsListening(false);
                                    }
                                    toast('Question skipped', { icon: '⏭️' });
                                    // Save skipped question text to DB before moving on
                                    const skippedQ = currentQuestion;
                                    setMessages(prev => [...prev, { role: "ai", content: skippedQ }, { role: "user", content: "(skipped)", score: 0 }]);
                                    setCurrentQuestion("");
                                    setTimeout(async () => {
                                        await saveSkippedQuestion(skippedQ);
                                        proceedAfterAnswer();
                                    }, 600);
                                }}
                                className="flex-1 py-2.5 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-sm font-medium hover:bg-yellow-500/20 hover:border-yellow-500/50 transition-all"
                            >
                                Skip Question
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
