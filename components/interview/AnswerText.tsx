import React from "react";

/** Renders answer text, showing ```fenced``` code blocks as monospace blocks. */
export default function AnswerText({ text, className = "" }: { text: string; className?: string }) {
    const parts = (text || "").split(/```(\w+)?\n?([\s\S]*?)```/g);
    // split() with 2 capture groups yields: [text, lang, code, text, lang, code, ..., text]
    const out: React.ReactNode[] = [];
    for (let i = 0; i < parts.length; i += 3) {
        const t = parts[i];
        if (t && t.trim()) out.push(<span key={`t${i}`} className="whitespace-pre-wrap">{t.trim()}</span>);
        const code = parts[i + 2];
        if (code !== undefined) {
            out.push(
                <pre key={`c${i}`} className="mt-2 mb-1 p-3 rounded-lg bg-black/40 border border-white/10 text-[12px] leading-relaxed font-mono text-gray-200 overflow-x-auto not-italic">
                    {parts[i + 1] && <span className="block text-[10px] uppercase tracking-wider text-purple-300/70 mb-1">{parts[i + 1]}</span>}
                    <code>{code.replace(/\s+$/, "")}</code>
                </pre>
            );
        }
    }
    return <div className={className}>{out}</div>;
}
