"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowLeft, Loader2, Check, Upload, FileText, X, Clock } from "lucide-react";

const TYPES = [
    { value: "technical", label: "Technical", desc: "Algorithms, DSA, coding challenges", icon: "⚙️", color: "purple" },
    { value: "behavioral", label: "Behavioral", desc: "STAR method, leadership, culture fit", icon: "🗣️", color: "pink" },
    { value: "system-design", label: "System Design", desc: "Architecture, scalability, trade-offs", icon: "🏗️", color: "cyan" },
    { value: "mixed", label: "Mixed", desc: "Blend of all interview types", icon: "🔀", color: "orange" },
];

const COMPANIES = ["Google", "Meta", "Amazon", "Microsoft", "Apple", "Netflix", "Stripe", "Uber"];

const DIFFICULTIES = [
    { value: "easy", label: "Easy", desc: "Entry Level", icon: "🌱" },
    { value: "medium", label: "Medium", desc: "Mid Level", icon: "⚡" },
    { value: "hard", label: "Hard", desc: "Senior Level", icon: "🔥" },
];

// Interview length options (minutes). Max is 30.
const DURATIONS = [10, 15, 20, 30];
const MAX_DURATION = 30;

const colorMap: Record<string, string> = {
    purple: "border-purple-500/50 bg-purple-500/10 text-purple-300",
    pink: "border-pink-500/50 bg-pink-500/10 text-pink-300",
    cyan: "border-cyan-500/50 bg-cyan-500/10 text-cyan-300",
    orange: "border-orange-500/50 bg-orange-500/10 text-orange-300",
};

export default function NewInterviewPage() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [uploadingResume, setUploadingResume] = useState(false);
    const [error, setError] = useState("");
    const [formData, setFormData] = useState({
        type: "technical",
        difficulty: "medium",
        role: "",
        company: "",
        jobDescription: "",
        resumeUrl: "",
        resumeText: "",
        resumeFileName: "",
        durationMinutes: 15,
    });

    // Pre-select the user's preferred session length from Settings (capped at 30 min)
    useEffect(() => {
        fetch("/api/user/profile")
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
                const pref = Number(data?.user?.defaultDuration);
                if (pref > 0) {
                    const capped = Math.min(MAX_DURATION, pref);
                    // snap to the nearest available option
                    const nearest = DURATIONS.reduce((a, b) => (Math.abs(b - capped) < Math.abs(a - capped) ? b : a));
                    setFormData((f) => ({ ...f, durationMinutes: nearest }));
                }
            })
            .catch(() => {});
    }, []);

    const steps = ["Interview Type", "Upload Resume", "Company & Role", "Start"];
    const totalSteps = 4;

    const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type !== "application/pdf") {
            setError("Please upload a PDF file");
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            setError("File size must be less than 5MB");
            return;
        }

        // Instant feedback - show file selected
        setFormData({
            ...formData,
            resumeFileName: file.name,
        });

        setUploadingResume(true);
        setError("");

        try {
            // Upload resume
            const uploadFormData = new FormData();
            uploadFormData.append("file", file);

            const uploadRes = await fetch("/api/resume/upload", {
                method: "POST",
                body: uploadFormData,
            });

            if (!uploadRes.ok) throw new Error("Failed to upload resume");

            const { url } = await uploadRes.json();

            // Extract text
            const extractRes = await fetch("/api/resume/extract", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ resumeUrl: url }),
            });

            if (!extractRes.ok) throw new Error("Failed to extract resume text");

            const { text } = await extractRes.json();

            setFormData({
                ...formData,
                resumeUrl: url,
                resumeText: text,
                resumeFileName: file.name,
            });
        } catch (err) {
            setError("Failed to upload resume. Please try again.");
            setFormData({ ...formData, resumeFileName: "" }); // Reset on error
            console.error(err);
        } finally {
            setUploadingResume(false);
        }
    };

    const handleRemoveResume = () => {
        setFormData({
            ...formData,
            resumeUrl: "",
            resumeText: "",
            resumeFileName: "",
        });
    };

    const handleSubmit = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch("/api/interview/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });
            const data = await res.json();
            if (data.success) router.push(`/interview/${data.interview.id}`);
            else setError(data.error || "Failed to create interview");
        } catch { setError("Something went wrong"); }
        finally { setLoading(false); }
    };

    const selectedType = TYPES.find(t => t.value === formData.type)!;

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-8">

            {/* Full-screen loading overlay — appears instantly on Start Interview click */}
            {loading && (
                <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0a0514]/80 backdrop-blur-sm">
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
            )}

            {/* Background glow */}
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-purple-600/8 blur-[160px] pointer-events-none" />

            <div className="w-full max-w-2xl relative z-10">
                {/* Title */}
                <div className="text-center mb-10">
                    <p className="text-xs font-semibold text-purple-400 tracking-widest uppercase mb-2">AI Interview Coach</p>
                    <h1 className="text-3xl font-bold text-white">Configure Your <span className="grad-text">Interview</span></h1>
                    <p className="text-gray-500 mt-2 text-sm">Set up a personalized AI-powered mock interview in seconds</p>
                </div>

                {/* Step progress */}
                <div className="flex items-center justify-center gap-2 mb-10">
                    {steps.map((label, i) => {
                        const n = i + 1;
                        const done = n < step;
                        const active = n === step;
                        return (
                            <React.Fragment key={n}>
                                <div className="flex flex-col items-center gap-1.5">
                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm transition-all ${done ? "bg-purple-500 text-white" : active ? "bg-gradient-to-br from-purple-600 to-fuchsia-600 text-white shadow-lg shadow-purple-500/30" : "bg-white/5 border border-white/10 text-gray-500"}`}>
                                        {done ? <Check className="w-4 h-4" /> : n}
                                    </div>
                                    <span className={`text-xs ${active ? "text-purple-400" : "text-gray-600"}`}>{label}</span>
                                </div>
                                {i < steps.length - 1 && (
                                    <div className={`flex-1 h-px transition-all mb-4 ${done ? "bg-purple-500/60" : "bg-white/8"}`} />
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>

                {/* Card */}
                <div className="rounded-3xl border border-white/8 bg-white/3 backdrop-blur-sm p-8">

                    {/* STEP 1: Interview Type */}
                    {step === 1 && (
                        <div>
                            <h2 className="text-xl font-semibold text-white mb-1">Choose Interview Type</h2>
                            <p className="text-sm text-gray-500 mb-6">What kind of interview do you want to practice?</p>
                            <div className="grid grid-cols-2 gap-3">
                                {TYPES.map((t) => (
                                    <button type="button" key={t.value}
                                        onClick={() => setFormData({ ...formData, type: t.value })}
                                        className={`p-5 rounded-2xl border text-left transition-all duration-200 hover:-translate-y-0.5 active:scale-95 ${formData.type === t.value ? colorMap[t.color] : "border-white/8 bg-white/3 hover:border-white/15 hover:bg-white/5"}`}>
                                        <div className="text-2xl mb-3">{t.icon}</div>
                                        <div className="font-semibold text-white mb-1">{t.label}</div>
                                        <div className="text-xs text-gray-500">{t.desc}</div>
                                        {formData.type === t.value && (
                                            <div className="mt-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-current inline-block" />
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>

                            {/* Difficulty subselect */}
                            <div className="mt-6">
                                <p className="text-sm font-medium text-gray-300 mb-3">Difficulty Level</p>
                                <div className="flex gap-2 sm:gap-3">
                                    {DIFFICULTIES.map((d) => (
                                        <button type="button" key={d.value}
                                            onClick={() => setFormData({ ...formData, difficulty: d.value })}
                                            className={`flex-1 min-w-0 px-2 py-3 rounded-xl border text-sm font-medium transition-all duration-200 active:scale-95 flex items-center justify-center gap-1.5 sm:gap-2 ${formData.difficulty === d.value
                                                ? "border-purple-500/40 bg-purple-500/10 text-purple-300"
                                                : "border-white/8 bg-white/3 text-gray-400 hover:border-white/15"}`}>
                                            <span>{d.icon}</span>{d.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Interview length */}
                            <div className="mt-6">
                                <p className="text-sm font-medium text-gray-300 mb-1">Interview Length</p>
                                <p className="text-xs text-gray-500 mb-3">The interviewer paces the conversation to fit this time — no per-question timer.</p>
                                <div className="grid grid-cols-4 gap-2 sm:gap-3">
                                    {DURATIONS.map((m) => (
                                        <button type="button" key={m}
                                            onClick={() => setFormData({ ...formData, durationMinutes: m })}
                                            className={`py-3 rounded-xl border text-sm font-medium transition-all duration-200 active:scale-95 flex flex-col items-center justify-center ${formData.durationMinutes === m
                                                ? "border-purple-500/40 bg-purple-500/10 text-purple-300"
                                                : "border-white/8 bg-white/3 text-gray-400 hover:border-white/15"}`}>
                                            <span className="text-base font-semibold">{m}</span>
                                            <span className="text-[11px] opacity-70">min</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: Resume Upload (Optional) */}
                    {step === 2 && (
                        <div>
                            <h2 className="text-xl font-semibold text-white mb-1">Upload Your Resume</h2>
                            <p className="text-sm text-gray-500 mb-6">Get personalized questions based on your experience <span className="text-gray-600">(optional, skip if you prefer)</span></p>

                            {!formData.resumeUrl ? (
                                <div>
                                    <label className="block cursor-pointer">
                                        <div className="border-2 border-dashed border-white/10 rounded-2xl p-8 hover:border-purple-500/50 transition-all bg-white/3 hover:bg-white/5">
                                            <div className="flex flex-col items-center text-center">
                                                <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-4">
                                                    <Upload className="w-8 h-8 text-purple-400" />
                                                </div>
                                                <p className="text-white font-medium mb-1">
                                                    {uploadingResume ? "Uploading..." : "Drop your resume here"}
                                                </p>
                                                <p className="text-xs text-gray-500 mb-4">
                                                    or click to browse (PDF only, max 5MB)
                                                </p>
                                                {uploadingResume && (
                                                    <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                                                )}
                                            </div>
                                        </div>
                                        <input
                                            type="file"
                                            accept=".pdf"
                                            onChange={handleResumeUpload}
                                            disabled={uploadingResume}
                                            className="hidden"
                                        />
                                    </label>

                                    <div className="mt-6 rounded-xl bg-blue-500/5 border border-blue-500/20 p-4">
                                        <p className="text-xs text-blue-300 font-medium mb-2">💡 Why upload your resume?</p>
                                        <ul className="text-xs text-gray-400 space-y-1.5 ml-4">
                                            <li>• AI asks about YOUR specific projects and experience</li>
                                            <li>• Questions tailored to YOUR skills and tech stack</li>
                                            <li>• More realistic interview simulation</li>
                                        </ul>
                                    </div>
                                </div>
                            ) : (
                                <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-5">
                                    <div className="flex items-start gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center flex-shrink-0">
                                            <FileText className="w-6 h-6 text-green-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-white mb-1">Resume Uploaded</p>
                                            <p className="text-xs text-gray-400 truncate">{formData.resumeFileName}</p>
                                            <p className="text-xs text-green-400 mt-2">✓ Text extracted successfully</p>
                                        </div>
                                        <button
                                            onClick={handleRemoveResume}
                                            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/30 flex items-center justify-center transition-all flex-shrink-0"
                                        >
                                            <X className="w-4 h-4 text-gray-400 hover:text-red-400" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 3: Company & Role */}
                    {step === 3 && (
                        <div>
                            <h2 className="text-xl font-semibold text-white mb-1">Target Job</h2>
                            <p className="text-sm text-gray-500 mb-6">Tailor the AI&apos;s questions to your goals <span className="text-gray-600">(optional)</span></p>

                            {/* Company quick-select */}
                            <div className="mb-5">
                                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Quick Select Company</p>
                                <div className="flex flex-wrap gap-2">
                                    {COMPANIES.map((co) => (
                                        <button type="button" key={co}
                                            onClick={() => setFormData({ ...formData, company: formData.company === co ? "" : co })}
                                            className={`px-4 py-2 rounded-full border text-sm font-medium transition-all ${formData.company === co
                                                ? "border-purple-500/50 bg-purple-500/15 text-purple-300"
                                                : "border-white/10 bg-white/3 text-gray-400 hover:border-white/20 hover:text-white"}`}>
                                            {co}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Divider */}
                            <div className="flex items-center gap-4 mb-5">
                                <div className="flex-1 h-px bg-white/10"></div>
                                <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Or Enter Any Company</span>
                                <div className="flex-1 h-px bg-white/10"></div>
                            </div>

                            {/* Custom input */}
                            <div className="grid grid-cols-2 gap-4 mb-5">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Company Name <span className="text-gray-600 text-xs">Optional</span></label>
                                    <input type="text" value={formData.company} onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                                        placeholder="Type any company (e.g., YourStartup, LocalCorp...)"
                                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Role <span className="text-gray-600 text-xs">Optional</span></label>
                                    <input type="text" value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                        placeholder="e.g. Software Engineer..."
                                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all" />
                                </div>
                            </div>

                            {/* Job Description */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Job Description <span className="text-gray-600 text-xs">Optional</span>
                                </label>
                                <textarea
                                    value={formData.jobDescription}
                                    onChange={(e) => setFormData({ ...formData, jobDescription: e.target.value })}
                                    placeholder="Paste the job description here..."
                                    rows={4}
                                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all resize-none"
                                />
                            </div>


                        </div>
                    )}

                    {/* STEP 4: Confirm & Start */}
                    {step === 4 && (
                        <div className="text-center">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-fuchsia-600 flex items-center justify-center mx-auto mb-5 shadow-xl shadow-purple-500/30">
                                <Check className="w-8 h-8 text-white" />
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2">Ready to Begin?</h2>
                            <p className="text-gray-400 text-sm mb-8">Your personalized AI interview is configured and waiting</p>

                            {/* Summary */}
                            <div className="rounded-2xl border border-white/8 bg-white/3 p-5 text-left mb-8 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-gray-500">Type</span>
                                    <span className="text-sm font-medium text-white capitalize">{formData.type.replace("-", " ")}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-gray-500">Difficulty</span>
                                    <span className="text-sm font-medium text-white capitalize">{formData.difficulty}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-gray-500">Length</span>
                                    <span className="text-sm font-medium text-white flex items-center gap-1.5">
                                        <Clock className="w-3.5 h-3.5 text-purple-400" />
                                        {formData.durationMinutes} min
                                    </span>
                                </div>
                                {formData.resumeUrl && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-gray-500">Resume</span>
                                        <span className="text-sm font-medium text-green-400 flex items-center gap-1.5">
                                            <FileText className="w-3.5 h-3.5" />
                                            Uploaded
                                        </span>
                                    </div>
                                )}
                                {formData.company && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-gray-500">Company</span>
                                        <span className="text-sm font-medium text-white">{formData.company}</span>
                                    </div>
                                )}
                                {formData.role && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-gray-500">Role</span>
                                        <span className="text-sm font-medium text-white">{formData.role}</span>
                                    </div>
                                )}
                                {formData.jobDescription && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-gray-500">Job Description</span>
                                        <span className="text-sm font-medium text-purple-400 flex items-center gap-1.5">
                                            <FileText className="w-3.5 h-3.5" />
                                            Provided
                                        </span>
                                    </div>
                                )}

                            </div>

                            {error && <div className="mb-5 rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">{error}</div>}

                            <button onClick={handleSubmit} disabled={loading}
                                className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white font-semibold text-base transition-all duration-200 shadow-xl shadow-purple-500/30 hover:shadow-purple-500/50 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2">
                                {loading ? <><Loader2 className="w-5 h-5 animate-spin" />Starting interview...</> : <>Start Interview<ArrowRight className="w-5 h-5" /></>}
                            </button>
                        </div>
                    )}

                    {/* Navigation */}
                    {step < 4 && (
                        <div className="flex gap-3 mt-8">
                            {step > 1 && (
                                <button onClick={() => setStep(step - 1)}
                                    className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm hover:bg-white/10 transition-all duration-200 active:scale-95">
                                    <ArrowLeft className="w-4 h-4" /> Back
                                </button>
                            )}
                            <button onClick={() => setStep(step + 1)}
                                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white text-sm font-semibold transition-all duration-200 shadow-lg shadow-purple-500/25 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2">
                                {step === 2 ? (formData.resumeUrl ? "Continue with Resume" : "Skip for Now") : step === 3 ? "Review & Start" : "Continue"} <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                    {step === 4 && (
                        <button onClick={() => setStep(3)}
                            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-300 transition-colors mt-4 mx-auto">
                            <ArrowLeft className="w-3.5 h-3.5" /> Back to settings
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
