"use client";

function Code({ children }: { children: string }) {
  return (
    <pre className="scroll-thin mt-2 overflow-x-auto rounded-[10px] border border-line bg-bg px-4 py-3 font-mono text-[12px] leading-relaxed text-muted">
      {children}
    </pre>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel px-5 py-5">
      <h2 className="text-[14px] font-semibold text-ink">{title}</h2>
      <div className="mt-2 text-[13px] leading-relaxed text-muted">{children}</div>
    </section>
  );
}

export function DocsView() {
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-[19px] font-semibold text-ink">Documentation</h1>
        <p className="mt-1 text-[13px] text-muted">
          How this console talks to the FastAPI central server. It runs standalone on mock data until a
          backend is reachable, then switches to live automatically.
        </p>
      </div>

      <Section title="REST endpoints">
        The console reads the endpoint registry and submits prompts through the same routing
        service as the OpenAI-compatible API.
        <Code>{`GET    /api/endpoints       # registry + live states
POST   /api/endpoints       # validate and register Ollama
DELETE /api/endpoints/{id}  # remove an endpoint
POST   /api/prompts         # { prompt, client_label } -> completion
GET    /health              # router health
POST /v1/chat/completions  # OpenAI-compatible (used by OpenCode)`}</Code>
      </Section>

      <Section title="Routing behavior">
        New clients are assigned across online, idle Ollama endpoints with round-robin selection. A client
        stays pinned to its endpoint for the router session. Reservations are atomic, each endpoint handles
        one request, and failed health checks mark it offline until polling succeeds again.
      </Section>

      <Section title="Dashboard WebSocket">
        Live endpoint and request events stream over a single socket. The console also accepts an optional
        <span className="font-mono text-[12px]"> {"{ suppliers: [...] }"} </span> snapshot message.
        <Code>{`WS /ws/dashboard

{
  "event": "request.assigned",
  "timestamp": "2026-09-01T12:00:00Z",
  "request_id": "chatcmpl-…",
  "client_label": "OpenCode client",
  "endpoint_id": "…",
  "endpoint_name": "Omer's Mac"
}`}</Code>
      </Section>

      <Section title="Event categories">
        Each event drives the activity chart, the routing diagram, and the event log.
        <Code>{`endpoint.online   endpoint.busy   endpoint.offline
request.received  request.assigned
request.processing  request.completed  request.failed`}</Code>
      </Section>

      <Section title="Field normalization">
        Payload field names are read permissively — <span className="font-mono text-[12px]">snake_case</span> and
        <span className="font-mono text-[12px]"> camelCase</span> both work — so minor backend differences won&apos;t
        break the UI. Endpoints include
        <span className="font-mono text-[12px]"> id, name, base_url, model_name, status, active_requests, last_seen_at</span>.
      </Section>
    </div>
  );
}
