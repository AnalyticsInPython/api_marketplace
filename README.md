# Local LLM Marketplace

A local-network proof of concept that presents multiple Macs running Ollama as
one OpenAI-compatible model endpoint. FastAPI routes each client to an available
endpoint, keeps that affinity for the server session, and publishes the request
lifecycle to the Next.js dashboard.

Team members looking for a concise progress handoff should start with
[`IMPLEMENTATION_STATUS.md`](IMPLEMENTATION_STATUS.md).

## Implemented

- Persistent SQLite registration for multiple Ollama endpoints
- Periodic `/api/tags` health and model checks
- Derived online, busy, and offline state
- Atomic one-request-per-endpoint reservations
- Round-robin assignment for new clients and session affinity via `X-Client-ID`
- Clear busy, unavailable, connection, model, and timeout errors
- OpenAI-compatible `GET /v1/models` and `POST /v1/chat/completions`
- OpenCode-compatible SSE responses backed by non-streaming Ollama inference
- OpenAI tool definition/message forwarding, including a Qwen JSON tool-call shim
- Endpoint registration, prompt simulation, and live dashboard WebSocket APIs
- Live-only dashboard integration with offline setup instructions and reconnect
- Router-side Ollama network diagnostics and a real marketplace route test
- Downloadable macOS supplier setup helper for Qwen and trusted-LAN access

There is no supplier agent. Each supplier Mac exposes Ollama directly on the
trusted local network, as required by the current architecture in
[`spec.md`](spec.md#3-architecture-decision).

## Start the router

```bash
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements-dev.txt
cp backend/.env.example backend/.env
.venv/bin/uvicorn backend.app.main:create_app --factory \
  --host 0.0.0.0 --port 8000 --env-file backend/.env
```

The example enables authentication with the trusted-LAN demo value
`dev-marketplace-key`. Change `MARKETPLACE_API_KEY` in `backend/.env` for your
network, then use the same value for the dashboard and OpenCode. Set it to an
empty value only when you intentionally want to disable authentication. SQLite
stores endpoint registrations; busy state, affinity, active requests, and event
history remain in memory.

## Prepare each Ollama Mac

The dashboard Endpoints view now provides a downloadable setup helper. On the
supplier Mac, download it from the dashboard and run:

```bash
chmod +x ~/Downloads/configure-ollama-macos.sh
~/Downloads/configure-ollama-macos.sh
```

The helper pulls `qwen2.5-coder:1.5b`, sets the permanent `OLLAMA_HOST`, restarts
Ollama, checks port `11434`, and prints the Wi-Fi endpoint URL. macOS may still
require the operator to approve its firewall prompt. Restore localhost-only mode
with `~/Downloads/configure-ollama-macos.sh --restore-localhost`.

The equivalent manual setup remains:

```bash
ollama pull qwen2.5-coder
launchctl setenv OLLAMA_HOST "0.0.0.0:11434"
```

Restart the Ollama macOS application after changing `OLLAMA_HOST`, allow the
firewall prompt, and note the Mac's Wi-Fi address. Its endpoint URL will look
like `http://192.168.1.24:11434`. Do not expose Ollama to the public internet.

## Start the dashboard

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev -- --hostname 0.0.0.0
```

The default `auto` values derive the API and WebSocket host from the dashboard
URL. A teammate opening `http://192.168.1.10:3000` therefore connects to the
router at `192.168.1.10:8000`. Set explicit URLs only when the dashboard and
router use different hosts. `frontend/.env.example` uses the same trusted-LAN
demo key as the backend; if you change `MARKETPLACE_API_KEY`, set
`NEXT_PUBLIC_API_KEY` to the same value. Because `NEXT_PUBLIC_*` values are
visible in the browser, this shared key is appropriate only for the local POC.
The backend accepts dashboard origins from localhost, private IPv4 ranges, and
`.local` hostnames by default. Set `ALLOWED_ORIGIN_REGEX` to narrow that policy
for a specific network.
Open the Endpoints view to register each Ollama URL. Registration succeeds only
when the router can reach `/api/tags` and find the configured model. Use **Run
network checks** first to inspect the Ollama version, installed models, address
scope, and any actionable connection problem. Use **Send routed test** to verify
the complete dashboard to router to Ollama path with a real `REMOTE_TEST_OK`
prompt.

## API surface

```text
GET    /health
GET    /v1/models
POST   /v1/chat/completions
GET    /api/endpoints
POST   /api/endpoints
POST   /api/endpoints/diagnose
DELETE /api/endpoints/{id}
POST   /api/prompts
WS     /ws/dashboard
```

Compatibility aliases remain available at `GET /api/suppliers` and
`POST /api/simulate` for the earlier dashboard contract.

`POST /api/endpoints/diagnose` is router-side. A passing result proves the
router can reach the supplied Ollama URL over the network. It warns about
localhost-only URLs and rejects public IP addresses because Ollama has no API
authentication.

Example request:

```bash
curl http://localhost:8000/v1/chat/completions \
  -H 'Authorization: Bearer dev-marketplace-key' \
  -H 'Content-Type: application/json' \
  -H 'X-Client-ID: demo-client' \
  -d '{
    "model": "local-marketplace",
    "messages": [{"role": "user", "content": "Explain recursion simply."}],
    "stream": false
  }'
```

Reuse `X-Client-ID` to demonstrate affinity. Change it to demonstrate
round-robin assignment.

## OpenCode

Create `opencode.json` in the project OpenCode will operate on:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "marketplace/local-marketplace",
  "provider": {
    "marketplace": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Local LLM Marketplace",
      "options": {
        "baseURL": "http://<router-lan-ip>:8000/v1",
        "apiKey": "{env:MARKETPLACE_API_KEY}"
      },
      "models": {
        "local-marketplace": { "name": "Local Marketplace" }
      }
    }
  }
}
```

The checked-in `opencode.json` already points OpenCode Desktop at the local
router, reads its API key from `MARKETPLACE_API_KEY`, selects
`marketplace/local-marketplace`, and declares Qwen2.5-Coder's 32K context
window. Export the same value configured in `backend/.env` before launching
OpenCode:

```bash
export MARKETPLACE_API_KEY="dev-marketplace-key"
opencode
```

Open the repository as a project in OpenCode and choose `Local Marketplace` if
it is not selected automatically. A missing or mismatched key returns HTTP 401.

OpenCode requests streaming responses, while the router deliberately keeps the
supplier reservation until a non-streaming Ollama completion finishes. The
router then returns that completion as a short OpenAI-compatible SSE stream.
Tool definitions, assistant tool calls, and tool-result messages are forwarded.
Ollama's current Qwen2.5-Coder build sometimes returns a pure JSON tool request
as text; the router promotes it to `tool_calls` only when its function name
matches a tool OpenCode advertised.

## Verification

```bash
.venv/bin/python -m pytest
cd frontend && npm run typecheck && npm run build
```

The backend integration tests cover round-robin routing, affinity, atomic busy
state, concurrency rejection, timeouts, connection loss, persistence, endpoint
validation, API authentication, deletion, dashboard event delivery, SSE output,
tool forwarding, and Qwen tool-call promotion.
