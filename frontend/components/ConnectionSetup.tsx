"use client";

import { useEffect, useState } from "react";
import { resolveApiBaseUrl } from "@/lib/config";
import type { ConnectionMode } from "@/lib/types";

const START_COMMAND = "./start-marketplace.sh";

function CopyButton({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <button className="btn btn-ghost shrink-0" onClick={copy} type="button">
      {copied ? "Copied" : "Copy command"}
    </button>
  );
}

function SetupRow({
  title,
  detail,
  command,
}: {
  title: string;
  detail: string;
  command: string;
}) {
  return (
    <div className="grid gap-2 border-t border-line px-5 py-4 first:border-t-0 md:grid-cols-[160px_minmax(0,1fr)] md:gap-6">
      <div className="text-[13px] font-medium text-ink">{title}</div>
      <div className="min-w-0">
        <p className="text-[12.5px] leading-relaxed text-muted">{detail}</p>
        <pre className="scroll-thin mt-2 overflow-x-auto rounded-[8px] border border-line bg-bg px-3 py-2.5 font-mono text-[11.5px] leading-relaxed text-muted">
          {command}
        </pre>
      </div>
    </div>
  );
}

export function ConnectionSetup({
  mode,
  onRetry,
}: {
  mode: ConnectionMode;
  onRetry: () => void;
}) {
  const connecting = mode === "connecting";
  const [apiBaseUrl, setApiBaseUrl] = useState("http://localhost:8000");

  useEffect(() => {
    setApiBaseUrl(resolveApiBaseUrl());
  }, []);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 py-4 sm:py-8">
      <section className="panel overflow-hidden">
        <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <div className="eyebrow">Connection required</div>
            <h1 className="mt-2 text-[20px] font-semibold text-ink">
              {connecting ? "Connecting to the marketplace router" : "Marketplace router unavailable"}
            </h1>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              This console only displays live marketplace data. Start Ollama and the FastAPI router,
              then reconnect. The dashboard retries automatically every five seconds.
            </p>
          </div>
          <span className={`badge ${connecting ? "badge-busy" : "badge-offline"}`}>
            <span className={`dot ${connecting ? "pulse" : ""}`} />
            {connecting ? "Checking" : "Offline"}
          </span>
        </div>

        <div className="border-t border-line">
          <div className="grid gap-3 px-5 py-5 md:grid-cols-[160px_minmax(0,1fr)] md:gap-6">
            <div className="text-[13px] font-medium text-ink">Start everything</div>
            <div className="min-w-0">
              <p className="text-[12.5px] leading-relaxed text-muted">
                From the repository root, run one command. It creates missing configuration and environments, installs dependencies on the first run, and starts both the router and dashboard.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                <pre className="scroll-thin min-w-0 flex-1 overflow-x-auto rounded-[8px] border border-line bg-bg px-3 py-2.5 font-mono text-[11.5px] leading-relaxed text-ink">
                  {START_COMMAND}
                </pre>
                <CopyButton command={START_COMMAND} />
              </div>
              <p className="mt-2 text-[11.5px] text-dim">
                Leave that Terminal window open. Press Ctrl+C there to stop the services it started.
              </p>
            </div>
          </div>
        </div>

        <details className="border-t border-line">
          <summary className="cursor-pointer px-5 py-4 text-[12.5px] font-medium text-muted hover:text-ink">
            Manual troubleshooting steps
          </summary>
          <div className="border-t border-line">
          <SetupRow
            title="Check Ollama"
            detail="Only needed when this Mac will also supply a model. Open Ollama and confirm its local API responds."
            command="curl http://127.0.0.1:11434/api/version"
          />
          <SetupRow
            title="Install Qwen"
            detail="Only needed for a supplier Mac. The pull command is safe to repeat and downloads only missing layers."
            command={"ollama list\nollama pull qwen2.5-coder:1.5b"}
          />
          <SetupRow
            title="Start the router"
            detail="Run the marketplace API from the repository root. Registered Ollama endpoints load from SQLite."
            command=".venv/bin/uvicorn backend.app.main:create_app --factory --host 127.0.0.1 --port 8000 --env-file backend/.env"
          />
          <SetupRow
            title="Confirm health"
            detail={`The configured dashboard API is ${apiBaseUrl}. A healthy router returns {\"status\":\"ok\"}.`}
            command={`curl ${apiBaseUrl}/health`}
          />
          </div>
        </details>

        <div className="flex flex-col gap-3 border-t border-line bg-panel-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12px] text-dim">
            Auto mode uses this dashboard&apos;s hostname on port 8000. Set explicit URLs only when the dashboard and router use different hosts.
          </p>
          <button className="btn btn-primary shrink-0" onClick={onRetry} disabled={connecting}>
            {connecting ? "Checking..." : "Retry connection"}
          </button>
        </div>
      </section>
    </div>
  );
}
