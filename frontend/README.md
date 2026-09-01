# Local LLM Marketplace — Console

Dark, dense Next.js **console** for the Local LLM Marketplace POC. The UI is
modeled on Mithril's product dashboard: a near-black app shell with a grouped
left sidebar, a top toolbar, a live activity chart, and dense data tables —
all sans-serif, with a crimson data accent, a white primary button, and
restrained status colors (sage / amber / gray).

## Runs standalone (no backend required)

On load the console tries to connect to the central server's dashboard
WebSocket. If none is reachable within ~2.5s it **transparently falls back to a
built-in mock engine** that simulates the whole lifecycle — endpoint selection
(round-robin), client affinity, one-request-per-endpoint, and
availability errors — and seeds the activity chart with synthetic history so it
looks alive immediately. So you can `npm run dev` and click through a fully live
console today, before the backend exists.

When your FastAPI server is running, point the env vars at it and the console
switches to real data automatically. The pill in the top bar shows **Live** vs
**Demo · mock data**.

## Quick start

```bash
npm install
cp .env.example .env.local   # optional — defaults target localhost:8000
npm run dev
```

Open http://localhost:3000.

## The pages (left sidebar)

- **Overview** — stat tiles, the live **Network activity** chart (active-request
  load as a stepped crimson line + request latency, with `Active / Latency / Both`
  and `5m / 15m / 1h` toggles and a hover callout), and the suppliers table.
- **Endpoints** — Ollama registration form plus the full node table (node, URL,
  model, status, load, last seen) with search + status filtering.
- **Playground** — a **full-width Send-a-prompt** bar that routes through the same
  service as `/v1/chat/completions`, plus the full-width **Live routing** diagram
  (`Client → Central Server → Ollama endpoint → back`, active hop animated) and a live
  event tail. (§6, §10.4, §15)
- **Event log** — session-only, timestamped event table with filters. (§12, §15)
- **API keys** — base URL, WebSocket, model, shared key, and an OpenCode snippet. (§10.1)
- **Settings** — read-only view of the env-driven configuration.
- **Documentation** — the endpoints, WebSocket protocol, and event model.

## Configuration

All settings are env vars (see `.env.example`):

| Variable | Purpose | Default |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | FastAPI base URL (`/api/endpoints`, `/api/prompts`) | `http://localhost:8000` |
| `NEXT_PUBLIC_WS_URL` | Dashboard events WebSocket (`WS /ws/dashboard`) | `ws://localhost:8000/ws/dashboard` |
| `NEXT_PUBLIC_API_KEY` | Shared bearer token, if the dashboard endpoints require it | _(empty)_ |
| `NEXT_PUBLIC_USE_MOCK` | Force the mock engine even when a backend is reachable | `false` |

### Expected backend payloads

- `GET /api/endpoints` → `{ suppliers: [...] }` containing
  `{ id, name, base_url, model_name, status, active_requests, last_seen_at }`.
- `POST /api/endpoints` → validates and persists `{ name, base_url, model_name }`.
- `WS /ws/dashboard` → JSON events per spec §12
  (`{ event, timestamp, request_id, client_label, endpoint_id, endpoint_name }`),
  and optionally a `{ suppliers: [...] }` snapshot message.
- `POST /api/prompts` → `{ prompt, client_label }`, returning the completion
  (`content` / `response` / OpenAI-style `choices[0].message.content`).

Field names are normalized permissively (snake_case and camelCase both work).

## Project structure

```
frontend/
├── app/
│   ├── globals.css        # console design tokens + component classes
│   ├── layout.tsx         # fonts (Inter + JetBrains Mono), root layout
│   └── page.tsx           # app shell: sidebar + view switching
├── components/
│   ├── Sidebar.tsx  Banner.tsx  Topbar.tsx        # shell chrome
│   ├── ActivityChart.tsx                          # live SVG chart
│   ├── SuppliersTable.tsx  EventLogTable.tsx      # data tables
│   ├── MetricsRow.tsx  StatusBadge.tsx            # stat tiles + badges
│   ├── FlowDiagram.tsx  RequestSimulator.tsx      # routing + prompt
│   ├── EventFeed.tsx  Logo.tsx  icons.tsx
│   └── views/            # Overview, Suppliers, Playground, Events,
│                         # ApiKeys, Settings, Docs
├── lib/
│   ├── types.ts  config.ts  format.ts
│   ├── mockEngine.ts      # standalone lifecycle simulator
│   └── useDashboard.ts    # WS + API wiring, mock fallback, chart series
└── .env.example
```

## Notes

- Fonts (Inter / JetBrains Mono) load from Google Fonts with system fallbacks,
  so the app still renders offline. Build-time font optimization is disabled
  (`optimizeFonts: false`) so `next build` never needs the network.
- Next.js 14 (App Router) + Tailwind CSS. No state persistence — the event feed
  and activity series are session-only, matching the POC scope.
