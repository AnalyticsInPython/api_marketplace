# Local LLM Marketplace

A local-network proof of concept that presents multiple Macs running Ollama as
one OpenAI-compatible model endpoint. FastAPI routes each client to an available
endpoint, keeps that affinity for the server session, and publishes the request
lifecycle to the Next.js dashboard.

Team members looking for a concise progress handoff should start with
[`IMPLEMENTATION_STATUS.md`](IMPLEMENTATION_STATUS.md).

## Quick start: run everything on one Mac

In this mode, one computer runs every component:

```text
OpenCode or Dashboard → FastAPI router → Ollama → qwen2.5-coder:1.5b
                              │
                            SQLite
```

Ollama does not need to be exposed to Wi-Fi for this setup.

### 1. Install the prerequisites

This project requires macOS, Git, `uv`, Node.js, Ollama, and optionally
OpenCode. With [Homebrew](https://brew.sh/) installed:

```bash
brew install uv node
curl -fsSL https://ollama.com/install.sh | sh
brew install anomalyco/tap/opencode
```

OpenCode is optional if you only want to use the web dashboard. Ollama's macOS
download requires macOS 14 or newer.

### 2. Download and prepare the project

```bash
git clone https://github.com/AnalyticsInPython/api_marketplace.git
cd api_marketplace

uv python install 3.12
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python -r backend/requirements-dev.txt
cp backend/.env.example backend/.env

cd frontend
npm install
cp .env.example .env.local
cd ..

ollama pull qwen2.5-coder:1.5b
```

Open the Ollama application and confirm it is ready:

```bash
curl http://127.0.0.1:11434/api/version
```

### 3. Start the router

In Terminal 1, from the repository root:

```bash
.venv/bin/uvicorn backend.app.main:create_app --factory \
  --host 127.0.0.1 --port 8000 --env-file backend/.env
```

Leave it running. Confirm it responds at
[`http://127.0.0.1:8000/health`](http://127.0.0.1:8000/health).

### 4. Start the dashboard

In Terminal 2:

```bash
cd frontend
npm run dev -- --hostname 127.0.0.1
```

Open [`http://127.0.0.1:3000`](http://127.0.0.1:3000).

### 5. Register the local model

In the dashboard, open **Endpoints** and enter:

```text
Name: My Mac
Endpoint URL: http://127.0.0.1:11434
Model: qwen2.5-coder:1.5b
```

Select **Run network checks**, then **Submit endpoint**. A localhost warning is
expected because all components are on the same computer. The Ollama and model
checks must pass, and `My Mac` should appear as `online`.

### 6. Use the system

For the web interface, open **Playground**, enter a prompt, and select **Run
prompt**. The page shows the selected endpoint, response, request flow, and live
events.

For OpenCode, use Terminal 3 from the repository root:

```bash
export MARKETPLACE_API_KEY="dev-marketplace-key"
opencode
```

The checked-in `opencode.json` selects `marketplace/local-marketplace`. Enter a
question normally; OpenCode sends it to FastAPI, which routes it to the local
Ollama model. The 1.5B model works well for the routing demo but may be
unreliable for multi-step tool use.

To stop the project, press **Control-C** in the router and dashboard terminals
and quit the Ollama application.

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

## Requirements

- **Python 3.10 or newer** for the router. macOS ships Python 3.9, which cannot
  run the backend: FastAPI resolves `str | None` type annotations at startup and
  that syntax requires 3.10+. Check yours with `python3 --version`. The `uv`
  commands below install a suitable Python without replacing the system one.
- **Node.js 18.17 or newer** for the dashboard, as required by Next.js 14.
  Check with `node --version`.
- **Ollama** on every supplier Mac, plus the `qwen2.5-coder:1.5b` model.

## Start the router

Python 3.10 or newer is required. On macOS, `uv` can install a suitable Python
without replacing the system Python:

```bash
uv python install 3.12
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python -r backend/requirements-dev.txt
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

## Optional: add supplier Macs over Wi-Fi

### Prepare each Ollama Mac

The dashboard Endpoints view now provides a downloadable setup helper. On the
supplier Mac, download it from the dashboard and run:

```bash
chmod +x ~/Downloads/configure-ollama-macos.sh
~/Downloads/configure-ollama-macos.sh
```

The helper pulls `qwen2.5-coder:1.5b`, sets `OLLAMA_HOST` for the current login
session, restarts Ollama, checks port `11434`, and prints the Wi-Fi endpoint URL.
macOS may still require the operator to approve its firewall prompt.

**After the demo, every supplier must undo this.** While `OLLAMA_HOST` is set,
Ollama accepts unauthenticated requests from any device on any network the Mac
joins, and Ollama's API includes model management (`/api/pull`, `/api/delete`),
not just inference. The setting is cleared by restarting the Mac, or by running:

```bash
~/Downloads/configure-ollama-macos.sh --restore-localhost
```

The MVP uses `qwen2.5-coder:1.5b` as its default and verified demo model, but it
does not block other models. An endpoint may register any exact model tag shown
by its `ollama list` output, provided the model works with Ollama's
`/v1/chat/completions` API. Basic prompt routing is model-independent. Advanced
OpenCode tool behavior depends on the selected model and should be checked when
adding a new one.

### Register an endpoint

1. The supplier starts Ollama, installs the demo model, and exposes port `11434`
   to the trusted local Wi-Fi.
2. In the dashboard's Endpoints view, a team member enters a display name, the
   supplier URL, and the exact model tag shown by `ollama list`.
3. **Run network checks** asks the router—not the browser—to call the supplier's
   `/api/version` and `/api/tags` endpoints. It reports reachability, the Ollama
   version, private-network safety, and whether the requested model is installed.
4. **Submit endpoint** repeats the model check and stores the name, URL, model,
   and timestamps in SQLite. The endpoint then appears as `online` in the
   dashboard. Registration does not copy the model or start Ollama remotely.

After registration, the router periodically checks `/api/tags`. When a user
sends a prompt, the router selects an online endpoint, marks it busy, replaces
the public `local-marketplace` model with that endpoint's configured model, and
calls its `/v1/chat/completions` API. The response returns through the router to
the user, the endpoint becomes online again, and WebSocket events update the
dashboard. During the router session, the same client remains assigned to the
same endpoint. If that endpoint is busy or offline, the MVP returns an error;
it does not queue the request or silently move the client to another endpoint.

The equivalent manual setup remains:

```bash
ollama pull qwen2.5-coder:1.5b
launchctl setenv OLLAMA_HOST "0.0.0.0:11434"
```

Restart the Ollama macOS application after changing `OLLAMA_HOST`, allow the
firewall prompt, and note the Mac's Wi-Fi address. Its endpoint URL will look
like `http://192.168.1.24:11434`. Do not expose Ollama to the public internet.

On some macOS installations, the reopened Ollama app may continue listening on
`127.0.0.1` even though `launchctl getenv OLLAMA_HOST` is correct. For the demo,
quit the app, stop that localhost-only Ollama process, and run Ollama directly:

```bash
OLLAMA_HOST=0.0.0.0:11434 ollama serve
```

Keep that Terminal open while the endpoint is registered. Verify the listener
with `lsof -nP -iTCP:11434 -sTCP:LISTEN`; it must show `*:11434` or
`0.0.0.0:11434`.

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
