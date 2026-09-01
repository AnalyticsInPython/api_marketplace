# Local LLM Marketplace — MVP Specification

## 1. Overview

- **Project type:** Educational proof of concept
- **Collaborators:** Omer Abraham, Alara Dinc, Austin Chandra, David Lee
- **Environment:** macOS computers on the same local Wi-Fi
- **Router:** Python with FastAPI
- **Dashboard:** Next.js
- **Endpoint runtime:** Ollama
- **Demo model:** `tinyllama` (configurable)

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

The router uses OpenAI-compatible `/v1/chat/completions` on both sides. It changes the public virtual model name (`local-marketplace`) to the real endpoint model (`tinyllama`) before forwarding the request.

## 4. System Diagram

```text
                                  Local Wi-Fi

 OpenCode                         FastAPI Router                    Ollama Endpoint
┌──────────┐  POST /v1/chat/     ┌─────────────────┐  POST /v1/chat/ ┌──────────────┐
│          │  completions        │                 │  completions    │ Supplier Mac │
│  User    ├────────────────────►│ Select endpoint ├────────────────►│  TinyLlama   │
│          │◄────────────────────┤ Track requests  │◄────────────────┤              │
└──────────┘  OpenAI response    └────────┬────────┘  OpenAI response└──────────────┘
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
5. The router replaces `model: local-marketplace` with `model: tinyllama`.
6. The router forwards the request to the endpoint's Ollama `/v1/chat/completions` API with `stream: false`.
7. Ollama runs the model and returns an OpenAI-compatible response.
8. The router optionally changes the returned model name back to `local-marketplace`.
9. The router marks the endpoint as available, updates the dashboard, and returns the response.

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
- Forward non-streaming requests to Ollama.
- Return clear timeout, connection, and availability errors.
- Publish live request and endpoint events to the dashboard through WebSocket.

### 6.2 Ollama Endpoints

Each supplier computer runs Ollama directly. No project-specific program runs on the supplier computer.

Ollama provides:

- Model installation and storage
- Local model inference
- OpenAI-compatible chat completions
- Installed-model discovery through `GET /api/tags`
- A network HTTP server on port `11434`

Supplier setup:

```bash
ollama pull tinyllama
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
- Show registered endpoints and their model/status.
- Show `online`, `busy`, and `offline` states.
- Provide a prompt simulator that uses the real router path.
- Visualize user → router → endpoint → router → user.
- Show the selected endpoint, response, error, and session-only event feed.
- Receive live events from FastAPI through WebSocket.

### 6.4 SQLite and In-Memory State

SQLite stores only endpoint registration data:

| Field | Purpose |
|---|---|
| `id` | Stable endpoint identifier |
| `name` | Display name, such as `Omer's Mac` |
| `base_url` | Ollama URL, such as `http://192.168.1.24:11434` |
| `model_name` | Configured model, normally `tinyllama` |
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
  "stream": false
}
```

The router forwards nearly the same JSON to the selected endpoint after changing the model to `tinyllama`.

### Supporting endpoints

- `GET /api/endpoints` — registered endpoints and current status
- `POST /api/endpoints` — register and validate an Ollama endpoint
- `DELETE /api/endpoints/{id}` — remove an endpoint
- `POST /api/prompts` — dashboard prompt simulator using the normal routing service
- `WS /ws/dashboard` — live endpoint and request events
- `GET /health` — router health

## 8. Routing and Client Affinity

- Each endpoint accepts one routed request at a time.
- A new client is assigned to an available endpoint.
- If several endpoints are available, the router uses round-robin selection.
- Repeated requests from the same client use the same endpoint during the current router session.
- The exact lightweight client identifier may be chosen during implementation.
- If the assigned endpoint is busy, offline, or fails, the router returns an error.
- The MVP does not queue requests or retry them on another endpoint.

## 9. Endpoint Health

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

## 10. Errors

- No endpoint available: return HTTP `503`.
- Invalid request or unsupported streaming: return HTTP `400` or `422`.
- Endpoint connection failure: return HTTP `502`.
- Endpoint inference timeout: return HTTP `504`.
- Ollama/model error: return a sanitized upstream error.

The default inference timeout should be configurable and may start at 120 seconds for small models running on CPU.

## 11. Security and Scope

- The system runs only on a trusted local Wi-Fi network.
- OpenCode requests use one shared router API key.
- Ollama endpoints do not provide their own API-key authentication; they must not be exposed to the public internet.
- Secrets must not be committed to Git.
- Full prompts and responses are not persisted.
- Generated content must be rendered safely in the dashboard.

Credits, payments, user accounts, streaming, multiple selectable models, queues, retries, cloud deployment, and production security are outside the MVP.

## 12. Suggested Repository Structure

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

## 13. Acceptance Criteria

The MVP is complete when the team can demonstrate:

1. Two Macs running Ollama can be registered in the router.
2. The dashboard correctly shows online, busy, and offline states.
3. OpenCode can call the router using `local-marketplace`.
4. The router selects an endpoint and returns its Ollama response.
5. The dashboard visualizes the full request path.
6. Its prompt simulator uses the same routing logic as OpenCode.
7. Repeated requests from one client remain on the same endpoint during the demo.
8. Busy, unavailable, disconnected, and timed-out endpoints produce clear errors.

