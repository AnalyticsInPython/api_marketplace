"use client";

import { useState } from "react";
import type { ActiveRequest } from "@/lib/types";
import { IconPlay } from "./icons";

const EXAMPLES = [
  "Explain recursion simply.",
  "Say hello.",
  "What is a compute marketplace?",
  "Write a haiku about GPUs.",
];

export function RequestSimulator({
  request,
  busy,
  onSubmit,
}: {
  request: ActiveRequest;
  busy: boolean;
  onSubmit: (prompt: string) => void;
}) {
  const [prompt, setPrompt] = useState("Explain recursion simply.");

  const submit = () => {
    if (busy || !prompt.trim()) return;
    onSubmit(prompt);
  };

  const showResponse =
    (request.status === "completed" && request.response) ||
    request.status === "processing" ||
    request.status === "assigned" ||
    request.status === "failed";

  return (
    <section className="panel px-6 py-6">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <div className="eyebrow">Simulate</div>
          <h2 className="mt-1.5 text-[16px] font-semibold text-ink">Send a prompt</h2>
          <p className="mt-1 text-[12.5px] text-muted">
            Routes through the same live service as{" "}
            <span className="font-mono text-[11.5px] text-dim">POST /v1/chat/completions</span>.
          </p>
        </div>
        <span className="hidden text-[11.5px] text-dim sm:inline">
          <kbd>⌘</kbd> / <kbd>Ctrl</kbd> + <kbd>Enter</kbd>
        </span>
      </div>

      <label className="sr-only" htmlFor="marketplace-prompt">Prompt</label>
      <textarea
        id="marketplace-prompt"
        className="field scroll-thin"
        rows={5}
        value={prompt}
        placeholder="Ask the marketplace something…"
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
        }}
      />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setPrompt(ex)}
              className="rounded-full border border-line px-2.5 py-1 text-[11.5px] text-muted transition-colors hover:border-line-strong hover:text-ink"
            >
              {ex}
            </button>
          ))}
        </div>
        <button className="btn btn-primary" onClick={submit} disabled={busy || !prompt.trim()}>
          <IconPlay size={14} />
          {busy ? "Running…" : "Run prompt"}
        </button>
      </div>

      {showResponse ? (
        <div className="mt-5 border-t border-line pt-5" aria-live="polite">
          {request.status === "failed" ? (
            <div className="rounded-[10px] border px-4 py-3" style={{ borderColor: "rgba(215,106,99,0.3)", background: "var(--error-bg)" }}>
              <div className="eyebrow" style={{ color: "var(--error)" }}>Error</div>
              <p className="mt-1.5 text-[13px] text-ink">{request.error}</p>
            </div>
          ) : (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="eyebrow">Response</span>
                {request.supplierName ? (
                  <span className="text-[11.5px] text-dim">
                    via <span className="text-muted">{request.supplierName}</span>
                  </span>
                ) : null}
              </div>
              {request.response ? (
                <div className="scroll-thin max-h-60 overflow-y-auto whitespace-pre-wrap rounded-[10px] border border-line bg-bg px-4 py-3.5 text-[14px] leading-relaxed text-ink">
                  {request.response}
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-[10px] border border-line bg-bg px-4 py-3.5 text-[13px] text-muted">
                  <span className="h-1.5 w-1.5 rounded-full bg-busy pulse" />
                  Generating{request.supplierName ? ` on ${request.supplierName}` : ""}…
                </div>
              )}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
