# Local LLM Marketplace — MVP Specification

## 1. Overview

- **Project type:** Educational proof of concept
- **Collaborators:** Omer Abraham, Alara Dinc, Austin Chandra, David Lee
- **Environment:** macOS computers on the same local Wi-Fi
- **Router:** Python with FastAPI
- **Dashboard:** Next.js
- **Endpoint runtime:** Ollama
- **Demo model:** `qwen2.5-coder:1.5b` (configurable)

The configured model name must identify an installed Ollama tag. An omitted tag
means Ollama's `:latest` alias; it does not match a different size such as
`:1.5b` or `:7b`.

### Current implementation status

The FastAPI router, SQLite endpoint registry, health polling, multi-endpoint
routing, client affinity, concurrency protection, timeout/connection handling,
dashboard APIs, and dashboard event WebSocket are implemented. The Next.js
dashboard can register Ollama endpoints, use the real prompt route, and show
setup instructions when the live backend is unavailable. It never substitutes
mock suppliers, requests, events, or telemetry for marketplace state.

Supplier onboarding is assisted, not agent-based. The dashboard provides a
downloadable one-time macOS helper, while the router diagnoses the resulting
Ollama URL over the network before registration. A browser cannot silently
change another Mac's firewall or processes, so a supplier operator must run the
helper and approve any macOS firewall prompt.

OpenCode compatibility is implemented through an OpenAI-compatible SSE adapter.
The router still holds each supplier reservation through a non-streaming Ollama
completion, then emits the completed text or tool call as SSE frames. OpenCode
tool definitions and tool-result messages are forwarded to the selected endpoint.
The compatibility adapter also promotes Qwen tool requests returned as plain or
Markdown-fenced JSON using either a `name` or `function` field, but only when
the named tool was explicitly advertised in the client request.

The manual two-Mac Wi-Fi milestone was completed on September 2, 2026, against
two real Ollama instances.

### Local router verification — September 2, 2026

The router was manually started with Python 3.12 and connected to a real local
Ollama 0.33.2 endpoint running `qwen2.5-coder:1.5b`. Health, API-key rejection,
model listing, endpoint diagnosis, endpoint registration, dashboard prompting,
non-streaming inference, and OpenAI-compatible SSE output were verified. This
check exposed and fixed ambiguous model-tag validation: registration now rejects
`qwen2.5-coder` when only `qwen2.5-coder:1.5b` is installed, preventing a later
Ollama 404 during inference.

### Multi-endpoint verification — September 2, 2026

Two real Ollama 0.33.2 HTTP servers were run locally on ports `11434` and
`11435` with `qwen2.5-coder:1.5b`. The router registered both endpoints and
verified round-robin assignment for new clients, session affinity for a repeat
client, visible busy state during a long inference, HTTP 409 for a concurrent
request from the same client, routing of a different client to the other free
endpoint, health-poll transition to offline after one server stopped, HTTP 503
for the client pinned to that offline endpoint, and successful routing of a new
client to the remaining online endpoint. SQLite registrations and derived
online/offline state also survived a router restart. Round-robin and affinity
were subsequently repeated with two physical Macs during final acceptance.

### OpenCode verification — September 2, 2026

OpenCode 1.18.25 loaded the checked-in `marketplace/local-marketplace` provider
and completed a normal chat request through FastAPI and a real local Ollama
endpoint. In a read-only tool test, Qwen returned a Markdown-fenced JSON request
using a `function` field. The compatibility adapter promoted it to an OpenAI
tool call, OpenCode executed `Read proposal.md` locally, and the tool-result
follow-up reached the router. The 1.5B model then emitted malformed JSON instead
of a clean final answer. Transport and tool execution are verified, but complete
agent-loop reliability remains model-dependent; a larger tool-capable model is
recommended when demonstrating multi-step OpenCode work.

### Dashboard integration verification — September 2, 2026

The Next.js dashboard served successfully and its production build completed.
Against the live router and real local Ollama endpoint, the dashboard contracts
for diagnosis, registration, endpoint snapshots, and prompt simulation were
verified; the prompt `What is 5 plus 7?` returned `12` through the registered
supplier. A real dashboard WebSocket connection received the initial supplier
snapshot followed by `request.received`, `endpoint.busy`, `request.assigned`,
`request.processing`, `request.completed`, and `endpoint.online` events with
matching request and endpoint identifiers. The rendered status changes and flow
animation were subsequently observed during the final browser walkthrough.

### Two-Mac acceptance walkthrough — September 2, 2026

The router/dashboard Mac and a supplier Mac were connected on the same Wi-Fi.
The dashboard diagnosed the remote Ollama 0.33.2 server, found both the 1.5B and
7B Qwen tags, and registered `qwen2.5-coder:1.5b` from the UI. A second endpoint
on the router Mac was also diagnosed and registered from the UI. The endpoint
table showed both computers online, routed prompts displayed the selected
supplier, and the request flow and busy/online transitions were observed.

Two new client IDs were assigned to different physical Macs; repeating the
first ID returned to the same supplier. A final OpenCode request completed
through the router while the dashboard displayed its events. The supplier
walkthrough also identified a macOS startup limitation: on that Mac, the Ollama
app did not inherit the `launchctl` value after restarting. The verified
fallback is to keep
`OLLAMA_HOST=0.0.0.0:11434 ollama serve` running in a supplier Terminal.

The system routes LLM requests from OpenCode or a web dashboard to available team computers running local models. The main project work is the central API/router and its visualization. Ollama provides model installation, inference, and the HTTP server on every endpoint computer.

## 2. MVP Goals

The MVP must demonstrate that:

1. Supplier computers can be registered as Ollama endpoints.
2. The router can detect whether each endpoint is online, offline, or busy.
3. OpenCode can call one OpenAI-compatible router API.
4. The router can select an available endpoint and forward the request.
5. Ollama can generate the response and return it through the router.
6. Requests from the same client can remain assigned to the same endpoint during the demo session.
7. The dashboard can visualize the complete request path in real time.

## 3. Architecture Decision

We will **not build a custom supplier agent or supplier WebSocket protocol**.

Each supplier installs Ollama, downloads the configured model, and exposes Ollama's HTTP API to the local Wi-Fi. The router communicates directly with that API.

The router uses OpenAI-compatible `/v1/chat/completions` on both sides. It changes the public virtual model name (`local-marketplace`) to the selected endpoint's exact configured model tag before forwarding the request.

## 4. System Diagram

```text
                                  Local Wi-Fi

 OpenCode                         FastAPI Router                    Ollama Endpoint
┌──────────┐  POST /v1/chat/     ┌─────────────────┐  POST /v1/chat/ ┌──────────────┐
│          │  completions        │                 │  completions    │ Supplier Mac │
│  User    ├────────────────────►│ Select endpoint ├────────────────►│ Qwen2.5 Code │
│          │◄────────────────────┤ Track requests  │◄────────────────┤              │
└──────────┘  SSE stream/JSON    └────────┬────────┘  completed JSON └──────────────┘
                                         │
                                         │ live events (WebSocket)
                                         ▼
                                ┌─────────────────┐
                                │ Next.js         │
                                │ Dashboard       │
                                └─────────────────┘
```

Simple flow:

```text
User/OpenCode → Router → Selected Ollama Endpoint → Router → User/OpenCode
```

## 5. Request Flow

1. OpenCode sends `POST /v1/chat/completions` to the FastAPI router.
2. The router validates the API key and request.
3. The router reuses the client's assigned endpoint or selects an available endpoint.
4. The router marks that endpoint as busy and publishes dashboard events.
5. The router copies compatible request fields and replaces `model: local-marketplace` with the selected endpoint's configured model.
6. The router forwards the request to the endpoint's Ollama `/v1/chat/completions` API with `stream: false`, including tools and supported generation options.
7. Ollama runs the model and returns an OpenAI-compatible response.
8. The router preserves structured tool calls and promotes Qwen's matching pure-JSON tool requests when necessary.
9. The router changes the returned model name back to `local-marketplace`, releases the endpoint, and updates the dashboard.
10. For `stream: true`, the router emits the completed response as OpenAI-compatible SSE frames; otherwise it returns JSON.

OpenCode normally includes conversation history in the `messages` array, so the router does not need to store prompts, responses, or conversation history.

## 6. Components

### 6.1 FastAPI Router

The router must:

- Expose `GET /v1/models` and `POST /v1/chat/completions` for OpenCode.
- Expose small internal APIs for endpoint registration and dashboard data.
- Save registered endpoints in SQLite.
- Poll Ollama endpoints to determine availability.
- Keep live busy states, request states, and client affinity in memory.
- Select an available endpoint.
- Enforce one active request per endpoint.
- Forward non-streaming requests to Ollama and adapt completed responses to SSE
  when the client requests streaming.
- Forward OpenAI-compatible tool definitions, tool calls, and tool results.
- Keep an endpoint busy until its Ollama response finishes or the request fails.
- Return clear timeout, connection, and availability errors.
- Publish live request and endpoint events to the dashboard through WebSocket.

### 6.2 Ollama Endpoints

Each supplier computer runs Ollama directly. No project-specific program runs on the supplier computer.

Ollama provides:

- Model installation and storage
- Local model inference
- OpenAI-compatible chat completions
- Streaming responses and tool calls
- Installed-model discovery through `GET /api/tags`
- A network HTTP server on port `11434`

The endpoint must be registered with the exact installed tag shown by
`ollama list`, except that `model-name` and `model-name:latest` are equivalent.

Supplier setup:

```bash
ollama pull qwen2.5-coder:1.5b
launchctl setenv OLLAMA_HOST "0.0.0.0:11434"
```

The supplier must restart the Ollama macOS application after setting `OLLAMA_HOST` and allow incoming connections if prompted by the macOS firewall.

Example endpoint URL:

```text
http://192.168.1.24:11434
```

### 6.3 Next.js Dashboard

The dashboard must:

- Register an endpoint using a display name and local-network URL.
- Provide a downloadable macOS helper that pulls Qwen, configures the permanent
  Ollama network bind, restarts Ollama, and prints the supplier URL.
- Diagnose a proposed endpoint from the router by checking `/api/version`,
  `/api/tags`, the requested model, and whether the address is safe for a
  trusted local network.
- Prevent public Ollama addresses from passing onboarding diagnostics.
- Send a real `REMOTE_TEST_OK` prompt through normal marketplace routing and
  report the supplier that answered.
- In automatic network mode, derive the API and WebSocket host from the
  dashboard page hostname so LAN clients do not resolve the router as their own
  localhost.
- Show registered endpoints and their model/status.
- Show `online`, `busy`, and `offline` states.
- Provide a prompt simulator that uses the real router path.
- Visualize user → router → endpoint → router → user.
- Show the selected endpoint, response, error, and session-only event feed.
- Receive live events from FastAPI through WebSocket.
- Display only live backend data. When the router is unavailable, clear
  transient marketplace state and show startup, configuration, and health-check
  instructions instead of mock data.

### 6.4 SQLite and In-Memory State

SQLite stores only endpoint registration data:

| Field | Purpose |
|---|---|
| `id` | Stable endpoint identifier |
| `name` | Display name, such as `Omer's Mac` |
| `base_url` | Ollama URL, such as `http://192.168.1.24:11434` |
| `model_name` | Configured model, normally `qwen2.5-coder:1.5b` |
| `created_at` | Registration time |
| `last_seen_at` | Latest successful health check |

The router keeps online/busy status, active requests, client affinity, and dashboard events in memory. This state resets when the router restarts.

## 7. Router API

### List virtual models

```http
GET /v1/models
```

The response lists one public model:

```json
{
  "object": "list",
  "data": [{"id": "local-marketplace", "object": "model"}]
}
```

### Chat completion

```http
POST /v1/chat/completions
Authorization: Bearer <shared-api-key>
```

```json
{
  "model": "local-marketplace",
  "messages": [
    {"role": "user", "content": "Why is the sky blue?"}
  ],
  "stream": true
}
```

The router forwards nearly the same JSON to the selected endpoint after changing
the model to the endpoint's exact configured tag and forcing the supplier-side request to
`stream: false`. If the client requested streaming, the router returns the
completed Ollama response as OpenAI-compatible SSE frames.

### Supporting endpoints

- `GET /api/endpoints` — registered endpoints and current status
- `POST /api/endpoints` — register and validate an Ollama endpoint
- `POST /api/endpoints/diagnose` — test reachability, Ollama version, model, and
  private-network safety without changing the registry
- `DELETE /api/endpoints/{id}` — remove an endpoint
- `POST /api/prompts` — dashboard prompt simulator using the normal routing service
- `WS /ws/dashboard` — live endpoint and request events
- `GET /health` — router health

## 8. OpenCode Configuration

Add an `opencode.json` file to the project using the router computer's local IP:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "marketplace/local-marketplace",
  "compaction": { "auto": false },
  "provider": {
    "marketplace": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Local LLM Marketplace",
      "options": {
        "baseURL": "http://192.168.1.10:8000/v1",
        "apiKey": "{env:MARKETPLACE_API_KEY}"
      },
      "models": {
        "local-marketplace": {
          "name": "Local Marketplace",
          "limit": {
            "context": 32768,
            "output": 4096
          }
        }
      }
    }
  }
}
```

Before starting OpenCode:

```bash
export MARKETPLACE_API_KEY="marketplace-demo-key"
opencode
```

OpenCode executes filesystem and terminal tools locally. The router and Ollama endpoint only relay the tool descriptions and generated tool calls.

## 9. Routing and Client Affinity

- Each endpoint accepts one routed request at a time.
- A new client is assigned to an available endpoint.
- If several endpoints are available, the router uses round-robin selection.
- Repeated requests from the same client use the same endpoint during the current router session.
- The implementation uses `X-Client-ID` when supplied and falls back to the
  client's IP address. The dashboard uses its stable `client_label`.
- If the assigned endpoint is busy, offline, or fails, the router returns an error.
- The MVP does not queue requests or retry them on another endpoint.

Tool-result follow-up requests from an OpenCode session must return to the same assigned endpoint.

## 10. Endpoint Health

The router periodically calls:

```http
GET <endpoint-base-url>/api/tags
```

A successful response confirms that Ollama is reachable and allows the router to verify the configured model. Failed checks mark the endpoint offline. An active routed request temporarily marks it busy.

Required dashboard events:

- `endpoint.online`
- `endpoint.busy`
- `endpoint.offline`
- `request.received`
- `request.assigned`
- `request.processing`
- `request.completed`
- `request.failed`

## 11. Errors

- No endpoint available: return HTTP `503`.
- Invalid request: return HTTP `400` or `422`.
- Endpoint connection failure: return HTTP `502`.
- Endpoint inference timeout: return HTTP `504`.
- Ollama/model error: return a sanitized upstream error.
- Broken or cancelled stream: close the client stream and release the endpoint's busy state.

The default inference timeout should be configurable and may start at 120 seconds for small models running on CPU.

## 12. Security and Scope

- The system runs only on a trusted local Wi-Fi network.
- OpenCode requests use one shared router API key.
- Ollama endpoints do not provide their own API-key authentication; they must not be exposed to the public internet.
- Secrets must not be committed to Git.
- Full prompts and responses are not persisted.
- Generated content must be rendered safely in the dashboard.

Credits, payments, user accounts, multiple selectable models, queues, retries, cloud deployment, and production security are outside the MVP.

## 13. Suggested Repository Structure

```text
api_marketplace/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── api/
│   │   ├── routing/
│   │   ├── models/
│   │   └── services/
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── app/
│   ├── components/
│   ├── package.json
│   └── .env.example
├── README.md
└── spec.md
```

## 14. Acceptance Criteria

The MVP is complete when the team can demonstrate:

1. Two Macs running Ollama can be registered in the router.
2. The dashboard correctly shows online, busy, and offline states.
3. OpenCode can call the router using the documented custom provider and `local-marketplace` model.
4. The router selects an endpoint and returns its completion to OpenCode as valid SSE.
5. The router preserves a basic tool call, OpenCode executes it locally, and the follow-up request returns to the same endpoint.
6. The dashboard visualizes the full request path.
7. Its prompt simulator uses the same routing logic with a non-streaming request.
8. Repeated requests from one client remain on the same endpoint during the demo.
9. A completed or failed supplier request releases the endpoint's busy state.
10. Busy, unavailable, disconnected, and timed-out endpoints produce clear errors.
