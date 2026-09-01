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

Set `MARKETPLACE_API_KEY=` in `backend/.env` to disable user API authentication
for a trusted local demo. SQLite stores endpoint registrations; busy state,
affinity, active requests, and event history remain in memory.

## Prepare each Ollama Mac

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

If the router is on another Mac, update `NEXT_PUBLIC_API_BASE_URL`,
`NEXT_PUBLIC_WS_URL`, and `NEXT_PUBLIC_API_KEY` in `frontend/.env.local`.
Open the Endpoints view to register each Ollama URL. Registration succeeds only
when the router can reach `/api/tags` and find the configured model.

## API surface

```text
GET    /health
GET    /v1/models
POST   /v1/chat/completions
GET    /api/endpoints
POST   /api/endpoints
DELETE /api/endpoints/{id}
POST   /api/prompts
WS     /ws/dashboard
```

Compatibility aliases remain available at `GET /api/suppliers` and
`POST /api/simulate` for the earlier dashboard contract.

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
router, selects `marketplace/local-marketplace`, and declares Qwen2.5-Coder's
32K context window. Open the repository as a project in OpenCode and choose
`Local Marketplace` if it is not selected automatically.

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
