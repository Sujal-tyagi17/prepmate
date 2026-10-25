"use client";

import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { Extension } from "@codemirror/state";

// CodeMirror works on phones (unlike Monaco) and is only loaded when a coding question appears.
const CodeMirror = dynamic(() => import("@uiw/react-codemirror"), {
    ssr: false,
    loading: () => <div className="h-full min-h-[180px] rounded-xl bg-[#1e1e2e] animate-pulse" />,
});

export const CODE_LANGUAGES = [
    { id: "python", label: "Python" },
    { id: "javascript", label: "JavaScript" },
    { id: "java", label: "Java" },
    { id: "cpp", label: "C++" },
    { id: "sql", label: "SQL" },
] as const;
export type CodeLanguage = (typeof CODE_LANGUAGES)[number]["id"];

const LANG_KEY = "prepmate.codeLanguage";

export function loadPreferredLanguage(): CodeLanguage {
    try {
        const v = localStorage.getItem(LANG_KEY) as CodeLanguage | null;
        if (v && CODE_LANGUAGES.some((l) => l.id === v)) return v;
    } catch { /* storage unavailable */ }
    return "python";
}

async function languageExtension(lang: CodeLanguage): Promise<Extension> {
    switch (lang) {
        case "python": return (await import("@codemirror/lang-python")).python();
        case "javascript": return (await import("@codemirror/lang-javascript")).javascript({ typescript: true });
        case "java": return (await import("@codemirror/lang-java")).java();
        case "cpp": return (await import("@codemirror/lang-cpp")).cpp();
        case "sql": return (await import("@codemirror/lang-sql")).sql();
    }
}

interface Props {
    code: string;
    onCodeChange: (v: string) => void;
    language: CodeLanguage;
    onLanguageChange: (l: CodeLanguage) => void;
    disabled?: boolean;
}

export default function CodeAnswer({ code, onCodeChange, language, onLanguageChange, disabled }: Props) {
    const [ext, setExt] = useState<Extension[]>([]);
    const [theme, setTheme] = useState<Extension | undefined>(undefined);

    useEffect(() => {
        let alive = true;
        languageExtension(language).then((e) => alive && setExt([e]));
        return () => { alive = false; };
    }, [language]);
    const [wrap, setWrap] = useState<Extension[]>([]);
    useEffect(() => {
        import("@codemirror/theme-one-dark").then((m) => setTheme(m.oneDark));
        import("@codemirror/view").then((m) => setWrap([m.EditorView.lineWrapping])); // wrap long lines (phones)
    }, []);

    const placeholder = useMemo(() => (language === "sql" ? "-- write your query here" : language === "python" ? "# write your solution here" : "// write your solution here"), [language]);

    return (
        <div className="rounded-xl border border-white/10 overflow-hidden bg-[#282c34]" data-testid="code-editor">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/10 bg-black/30">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Code</span>
                <select
                    value={language}
                    disabled={disabled}
                    onChange={(e) => {
                        const l = e.target.value as CodeLanguage;
                        onLanguageChange(l);
                        try { localStorage.setItem(LANG_KEY, l); } catch { /* ignore */ }
                    }}
                    aria-label="Programming language"
                    className="bg-transparent text-xs text-purple-300 focus:outline-none cursor-pointer"
                >
                    {CODE_LANGUAGES.map((l) => <option key={l.id} value={l.id} className="bg-[#1a1025]">{l.label}</option>)}
                </select>
            </div>
            <CodeMirror
                value={code}
                onChange={onCodeChange}
                extensions={[...ext, ...wrap]}
                theme={theme}
                editable={!disabled}
                placeholder={placeholder}
                basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: true, autocompletion: true }}
                height="min(34vh, 320px)"
                style={{ fontSize: 13 }}
            />
        </div>
    );
}

/** Combine an optional spoken/written explanation with code into one answer string. */
export function combineAnswer(explanation: string, code: string, language: CodeLanguage): string {
    const parts: string[] = [];
    if (explanation.trim()) parts.push(explanation.trim());
    if (code.trim()) parts.push("```" + language + "\n" + code.replace(/\s+$/, "") + "\n```");
    return parts.join("\n\n");
}
