"use client";

import { config } from "@/lib/config";

function Row({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-line px-5 py-3.5 first:border-t-0">
      <div>
        <div className="text-[13px] text-ink">{label}</div>
        {note ? <div className="mt-0.5 text-[11.5px] text-dim">{note}</div> : null}
      </div>
      <code className="max-w-[55%] truncate rounded-md border border-line bg-bg px-2.5 py-1.5 font-mono text-[12px] text-muted">
        {value}
      </code>
    </div>
  );
}

export function ApiKeysView() {
  const maskedKey = config.apiKey
    ? `${"•".repeat(Math.max(0, config.apiKey.length - 4))}${config.apiKey.slice(-4)}`
    : "— not set (NEXT_PUBLIC_API_KEY)";

  const snippet = `{
  "$schema": "https://opencode.ai/config.json",
  "model": "marketplace/local-marketplace",
  "provider": {
    "marketplace": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Local LLM Marketplace",
      "options": {
        "baseURL": "${config.apiBaseUrl}/v1",
        "apiKey": "{env:MARKETPLACE_API_KEY}"
      },
      "models": {
        "local-marketplace": { "name": "Local Marketplace" }
      }
    }
  }
}`;

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-[19px] font-semibold text-ink">API keys</h1>
        <p className="mt-1 text-[13px] text-muted">
          One shared bearer token authenticates all user requests (spec §10.1). This is a local-network POC —
          not a production security design.
        </p>
      </div>

      <div className="panel overflow-hidden">
        <Row label="Base URL" value={`${config.apiBaseUrl}/v1`} note="OpenAI-compatible endpoint" />
        <Row label="Dashboard WebSocket" value={config.wsUrl} note="Live endpoint & request events" />
        <Row label="Public model" value="local-marketplace" note="Virtual model — routes to an Ollama endpoint" />
        <Row label="Shared API key" value={maskedKey} note="Sent as Authorization: Bearer <key>" />
      </div>

      <div className="panel px-5 py-4">
        <div className="eyebrow mb-2">opencode.json</div>
        <pre className="scroll-thin overflow-x-auto rounded-[10px] border border-line bg-bg px-4 py-3 font-mono text-[12px] leading-relaxed text-muted">
{snippet}
        </pre>
      </div>
    </div>
  );
}
