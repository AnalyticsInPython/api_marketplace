# Local LLM Marketplace — Console

Dark, dense Next.js **console** for the Local LLM Marketplace POC. The UI is
modeled on Mithril's product dashboard: a near-black app shell with a grouped
left sidebar, a top toolbar, a live activity chart, and dense data tables —
all sans-serif, with a crimson data accent, a white primary button, and
restrained status colors (sage / amber / gray).

## Live data only

The console connects to the central server's dashboard WebSocket and only shows
supplier, request, event, and telemetry data received from the real backend.
There is no mock engine or synthetic chart history.

If the router cannot be reached within about 2.5 seconds, the console clears its
transient state and shows the commands needed to check Ollama, start FastAPI,
and verify `/health`. It retries automatically every five seconds and also
provides a manual Retry connection action. The top bar reports `Live`,
`Connecting`, or `Router offline`.

The Endpoints view also includes the real supplier onboarding path:

- Download and run the one-time macOS helper on the supplier Mac.
- Paste its printed Wi-Fi URL into the dashboard.
- Run router-side checks for `/api/version`, `/api/tags`, model availability,
  and trusted-network address scope.
- Register only after those checks pass.
- Send `REMOTE_TEST_OK` through the normal marketplace route and see which
  supplier answered.

The UI cannot modify another Mac without code running there. The downloaded
helper is the explicit supplier-side action; all subsequent validation,
registration, health polling, routing, and testing are controlled in the UI.

## Quick start

```bash
npm install
cp .env.example .env.local   # auto mode follows the dashboard hostname
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
| `NEXT_PUBLIC_API_BASE_URL` | FastAPI base URL (`/api/endpoints`, `/api/prompts`); `auto` uses the dashboard hostname on port 8000 | `auto` |
| `NEXT_PUBLIC_WS_URL` | Dashboard events WebSocket; `auto` uses the dashboard hostname on port 8000 | `auto` |
| `NEXT_PUBLIC_API_KEY` | Shared bearer token, if the dashboard endpoints require it | _(empty)_ |

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
│   └── useDashboard.ts    # WS + API wiring, offline handling, chart series
└── .env.example
```

## Notes

- Fonts (Inter / JetBrains Mono) load from Google Fonts with system fallbacks,
  so the app still renders offline. Build-time font optimization is disabled
  (`optimizeFonts: false`) so `next build` never needs the network.
- Next.js 14 (App Router) + Tailwind CSS. No state persistence — the event feed
  and activity series are session-only, matching the POC scope.
