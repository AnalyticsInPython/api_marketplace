# Local LLM Marketplace — Product and Technical Specification

## 1. Document Status

- **Status:** Initial implementation specification
- **Project type:** Educational proof of concept (POC)
- **Target environment:** Multiple macOS computers connected to the same local Wi-Fi network
- **Primary language:** Python
- **Frontend:** Next.js
- **LLM runtime:** Ollama
- **Default model:** TinyLlama

## 2. Product Summary

The Local LLM Marketplace connects users who want to run LLM prompts with suppliers who make a locally running open-source model available to the network.

A user sends a prompt through OpenCode or the web dashboard. A central API server selects an available supplier, forwards the request to that supplier's local agent, and returns the generated response to the user. The dashboard visualizes this complete request lifecycle in real time.

The project is a local-network POC. It demonstrates distributed request routing, persistent supplier connections, local LLM inference, an OpenAI-compatible API, and live system visualization. It is not intended to be a production marketplace.

## 3. Goals

The MVP must demonstrate the following:

1. Multiple supplier computers can connect to one central server over local Wi-Fi.
2. Each supplier can advertise a locally running Ollama model.
3. OpenCode can send a prompt to the central server through a minimal OpenAI-compatible API.
4. The server can select an available supplier and forward the prompt to it.
5. The supplier can run the prompt using its local model and return the result.
6. The server can return the result to OpenCode or the dashboard.
7. A Next.js dashboard can display suppliers and visualize the request lifecycle in real time.
8. Repeated requests from the same client can remain assigned to the same supplier during a working session.

## 4. Non-Goals

The following are outside the MVP scope:

- Real money, payments, withdrawals, or billing
- A required virtual-credit system
- Production-grade security or internet deployment
- User registration, login, password reset, or role-management pages
- Streaming tokens
- Multiple model selection by users
- Supplier bidding or supplier-defined pricing
- Request queues
- Automatic retry on another supplier
- Automatic Ollama or model installation
- Detailed hardware benchmarking
- Long-term prompt, response, or request-history storage
- Multiple central-server instances
- High availability or recovery after server restart
- End-to-end encryption
- Content moderation
- Automated test-suite requirements
- Embeddings, image generation, audio, tool calls, or structured-output APIs

Virtual credits may be explored later, but they must not complicate the MVP architecture.

## 5. Terminology

- **User/client:** A person or program sending an LLM request. OpenCode and the dashboard simulator are clients.
- **Central server:** The FastAPI application responsible for connections, routing, state, and API responses.
- **Supplier:** A participant providing local compute.
- **Supplier agent:** The Python program running on a supplier's Mac.
- **Supplier node:** A supplier computer connected to the server.
- **Ollama:** The local service used by a supplier agent to execute model requests.
- **Client affinity:** The rule that keeps requests from the same client assigned to the same supplier.
- **Dashboard:** The Next.js web interface for system visualization and prompt simulation.

## 6. Primary Demo Scenario

1. The central-server operator starts FastAPI and Next.js on one Mac.
2. The operator shares the server Mac's local Wi-Fi IP address with the team.
3. Each supplier installs Ollama and pulls TinyLlama in advance.
4. Each supplier starts the Python supplier agent with the server address, supplier name, and token.
5. Supplier nodes appear as online and available in the dashboard.
6. A user configures OpenCode to use the central server's OpenAI-compatible base URL and shared API key.
7. The user submits a prompt.
8. The server assigns an available supplier.
9. The dashboard shows the request moving from client to server to supplier.
10. The supplier agent sends the prompt to Ollama and returns the completed answer.
11. The server sends the answer to OpenCode.
12. The dashboard shows the return path and completed state.

The dashboard must also provide its own prompt form so the same flow can be demonstrated without OpenCode.

## 7. High-Level Architecture

```text
                         Local Wi-Fi Network

 OpenCode ───── HTTP ─────┐
                          │
 Dashboard ──── HTTP ───> FastAPI Central Server
     ^                    │  - OpenAI-compatible API
     │                    │  - supplier connection manager
     └── live WebSocket ──┤  - request router
                          │  - dashboard event broadcaster
                          │  - SQLite access
                          │
                          ├── supplier WebSocket ──> Supplier Agent A ── HTTP ──> Ollama
                          └── supplier WebSocket ──> Supplier Agent B ── HTTP ──> Ollama
```

Supplier agents initiate outbound WebSocket connections to the central server. Suppliers do not expose their own HTTP ports to other computers. This avoids inbound-address, firewall, and port-management problems and lets the central server push jobs over an already established connection.

## 8. Components

### 8.1 FastAPI Central Server

The central server is the system coordinator. It must:

- Expose the minimal OpenAI-compatible user API.
- Authenticate user requests with one shared API key.
- Accept and maintain supplier WebSocket connections.
- Authenticate suppliers with individual supplier tokens.
- Track live supplier status in memory.
- Select a supplier for each new client.
- Maintain client-to-supplier affinity for the current server session.
- Forward requests and correlate responses using unique request IDs.
- Enforce one active request per supplier.
- Return clear errors for unavailable, failed, or timed-out suppliers.
- Broadcast supplier and request events to dashboard clients.
- Persist only supplier registry information in SQLite.
- Provide dashboard-supporting read endpoints.

### 8.2 Supplier Agent

The supplier agent is a Python CLI application. It must:

- Accept configuration for server URL, supplier name, supplier token, and Ollama model.
- Verify that the local Ollama service is reachable.
- Verify that the configured model is installed.
- Open an authenticated WebSocket connection to the central server.
- Register its node name and model name.
- Send periodic heartbeats or otherwise maintain connection liveness.
- Receive one prompt request at a time.
- Mark itself busy while processing.
- Call the local Ollama chat API without streaming.
- Return either a completed response or a structured error.
- Reconnect automatically after an unexpected connection loss.
- Shut down cleanly when interrupted.

The agent does not install Ollama, download models, expose a public server, or accept requests directly from users.

### 8.3 Next.js Dashboard

The dashboard must:

- Display all registered suppliers.
- Show each supplier's node name, model, connection status, and current load.
- Distinguish `online`, `busy`, and `offline` states.
- Provide a text form for simulating a user request.
- Render a simple system-flow diagram.
- Animate or highlight the active request path.
- Display a session-only event feed.
- Display the generated response or a readable error.
- Update live through a dashboard WebSocket connection.

The main flow shown by the UI is:

```text
User/OpenCode → Central Server → Selected Supplier → Central Server → User/OpenCode
```

The dashboard does not require login for the local-network POC.

### 8.4 Ollama and TinyLlama

Each supplier Mac must have Ollama installed and running. The default model is `tinyllama` because it is small and simple to install:

```bash
ollama pull tinyllama
```

The model name must remain configurable rather than hard-coded. All suppliers should use the same model during the primary demo.

### 8.5 SQLite

SQLite persists the supplier registry across central-server restarts. It does not store live socket objects or act as the source of truth for connection status.

The actual WebSocket connections, busy state, client affinity mappings, active requests, and dashboard event history live in FastAPI process memory.

## 9. Functional Requirements

### 9.1 Supplier Registration and Presence

1. A supplier connects using a unique name and token.
2. On the supplier's first valid connection, the server creates its SQLite registry record.
3. A later connection with the same token updates/reuses that record.
4. An invalid or missing token is rejected.
5. A connected, idle supplier has status `online`.
6. A supplier processing a request has status `busy`.
7. A disconnected supplier has status `offline` and remains visible in the dashboard.
8. A disconnected agent should attempt to reconnect automatically.

For the POC, supplier tokens may be configured through server environment variables or a small local configuration file. No administration UI is required.

### 9.2 User Request Flow

1. The client sends an OpenAI-style chat-completion request.
2. The server validates the shared API key and request body.
3. The server identifies the client using a simple, stable POC identifier.
4. If the client already has an assigned connected supplier, the server uses that supplier.
5. Otherwise, the server selects an eligible supplier.
6. If no supplier is eligible, the server immediately returns an availability error.
7. The selected supplier becomes busy.
8. The server sends a request message over the supplier WebSocket.
9. The agent calls Ollama and returns a completed result.
10. The server marks the supplier online again.
11. The server converts the result into an OpenAI-compatible response.
12. The server broadcasts lifecycle events to the dashboard throughout the process.

### 9.3 Client Affinity

The system must demonstrate that repeated requests from the same user/client are routed to the same supplier during the active server session.

The exact client identity mechanism is intentionally left as a small implementation choice. Suitable POC options include a client IP address, API-key-derived identifier, or lightweight custom client ID. It must not require a full session-management subsystem.

If an assigned supplier is busy with that client's existing request, another simultaneous request from the client is rejected. If the assigned supplier disconnects, the request fails. The system does not silently move an established client to a different supplier while handling a request.

### 9.4 Routing

For a client without an existing supplier assignment:

1. Filter to connected suppliers with status `online`.
2. Select the least-busy supplier.
3. Use round-robin ordering as the tie-breaker.
4. Save the client-to-supplier mapping in memory.

Because each supplier supports only one active request, all eligible suppliers normally have a load of zero. Round-robin therefore provides fair distribution between newly observed clients.

### 9.5 Failure Handling

- **No connected supplier:** return an immediate service-unavailable error.
- **All suppliers busy:** return an immediate service-unavailable error; do not queue.
- **Supplier disconnects during processing:** fail the request; do not retry another supplier.
- **Ollama unavailable:** agent returns an error and remains connected if possible.
- **Model unavailable:** agent returns a clear configuration error.
- **Inference timeout:** server fails the request and releases the supplier's busy state.
- **Malformed supplier response:** fail the matching request and record a dashboard error event.
- **Central server restart:** live connections, affinities, and request history are lost; agents reconnect automatically.

A configurable request timeout should default to 120 seconds because CPU-based local inference may be slow.

## 10. API Requirements

### 10.1 Authentication

User-facing `/v1` requests use a shared bearer token:

```http
Authorization: Bearer <API_KEY>
```

The API key is configured through an environment variable. Authentication is intentionally simple and is not a production security design.

### 10.2 List Models

```http
GET /v1/models
```

The endpoint returns one virtual model regardless of the underlying supplier node:

```json
{
  "object": "list",
  "data": [
    {
      "id": "local-marketplace",
      "object": "model",
      "owned_by": "local-marketplace"
    }
  ]
}
```

### 10.3 Create Chat Completion

```http
POST /v1/chat/completions
```

Minimal supported request:

```json
{
  "model": "local-marketplace",
  "messages": [
    {"role": "user", "content": "Explain recursion simply."}
  ],
  "stream": false
}
```

Requirements:

- `messages` must be a non-empty array.
- Text `system`, `user`, and `assistant` messages may be forwarded to Ollama.
- The server only supports `stream: false` or an omitted `stream` field.
- The public model name is always `local-marketplace`.
- Unsupported advanced fields may be ignored when safe or rejected with a clear validation error.

Minimal response shape:

```json
{
  "id": "chatcmpl-<request-id>",
  "object": "chat.completion",
  "created": 0,
  "model": "local-marketplace",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Recursion is..."
      },
      "finish_reason": "stop"
    }
  ]
}
```

Token-usage values are optional for the POC because the supplier/model integration may not provide consistent accounting.

### 10.4 Dashboard Support API

The backend should provide small internal endpoints such as:

- `GET /api/suppliers` — current supplier registry and live states
- `POST /api/simulate` — submit a prompt from the dashboard through the normal routing service
- `WS /ws/dashboard` — live supplier and request events
- `WS /ws/supplier` — authenticated supplier-agent connection
- `GET /health` — simple server health response

The simulator must call the same application service used by `/v1/chat/completions`; it must not implement a separate fake routing path.

## 11. Supplier WebSocket Protocol

All messages are JSON and contain a `type` field.

### 11.1 Registration

Agent to server:

```json
{
  "type": "register",
  "supplier_name": "team-mac-1",
  "token": "<supplier-token>",
  "model": "tinyllama"
}
```

Server to agent:

```json
{
  "type": "registered",
  "supplier_id": "<supplier-id>"
}
```

### 11.2 Inference Request

Server to agent:

```json
{
  "type": "inference_request",
  "request_id": "<request-id>",
  "messages": [
    {"role": "user", "content": "Hello"}
  ]
}
```

### 11.3 Inference Result

Agent to server:

```json
{
  "type": "inference_result",
  "request_id": "<request-id>",
  "content": "Hello! How can I help?"
}
```

### 11.4 Inference Error

Agent to server:

```json
{
  "type": "inference_error",
  "request_id": "<request-id>",
  "error": "Ollama is unavailable"
}
```

### 11.5 Liveness

The implementation may use WebSocket ping/pong support or explicit heartbeat messages. A connection closed by either side must cause the supplier to become offline and generate a dashboard event.

## 12. Dashboard Event Model

Example event:

```json
{
  "event": "request.assigned",
  "timestamp": "2026-01-01T12:00:00Z",
  "request_id": "<request-id>",
  "client_label": "OpenCode client",
  "supplier_id": "<supplier-id>",
  "supplier_name": "team-mac-1",
  "status": "assigned"
}
```

Required event categories:

- `supplier.online`
- `supplier.busy`
- `supplier.offline`
- `request.received`
- `request.assigned`
- `request.processing`
- `request.completed`
- `request.failed`

Events are session-only. The server may keep a small bounded in-memory list so a newly opened dashboard can display recent events from the current run.

## 13. Data Model

Only the supplier registry must be persisted.

### Supplier

| Field | Type | Purpose |
|---|---|---|
| `id` | UUID or integer | Internal stable identifier |
| `name` | string | Human-readable node name |
| `token_hash` | string | Supplier authentication value stored as a hash |
| `model_name` | string | Last reported Ollama model |
| `created_at` | timestamp | First registration time |
| `last_seen_at` | timestamp | Most recent connection/activity time |

The following must not be persisted as authoritative database state:

- WebSocket connection objects
- Current busy/online state
- Active requests
- Client affinity mappings
- Full prompts and responses
- Dashboard event history

Offline status is derived from the absence of a live connection. `last_seen_at` may be shown for informational purposes.

## 14. Configuration

### Central Server

Suggested environment variables:

```text
MARKETPLACE_API_KEY=<shared-user-api-key>
SUPPLIER_TOKENS=<POC supplier-token configuration>
DATABASE_URL=sqlite:///./marketplace.db
REQUEST_TIMEOUT_SECONDS=120
ALLOWED_ORIGINS=http://localhost:3000,http://<server-lan-ip>:3000
```

### Supplier Agent

Suggested CLI:

```bash
python supplier_agent.py \
  --server ws://<server-lan-ip>:8000/ws/supplier \
  --name team-mac-1 \
  --token <supplier-token> \
  --model tinyllama
```

The local Ollama base URL defaults to `http://localhost:11434` and may be configurable.

### OpenCode

OpenCode must be configured with:

- Base URL: `http://<server-lan-ip>:8000/v1`
- API key: the shared marketplace API key
- Model: `local-marketplace`

The exact OpenCode configuration syntax should be verified during implementation against the installed OpenCode version.

## 15. UI Requirements

The dashboard should favor clarity over feature count.

### Supplier Panel

For every registered supplier, display:

- Node name
- Model name
- Status badge: online, busy, or offline
- Current active-request count: zero or one

### Flow Visualization

Display nodes representing the user, central server, and supplier nodes. Highlight the relevant links and nodes as events arrive. A simple CSS-based diagram is sufficient; a graph library is not required.

### Request Simulator

Provide:

- Prompt text area
- Submit button
- Current request status
- Selected supplier name
- Completed response or error

Disable duplicate submission while the simulator's current request is processing.

### Event Feed

Show a timestamped list of recent events for the current server session. The feed should help observers understand what the system is doing without inspecting terminal logs.

## 16. Security Boundaries

The system is limited to a trusted classroom/local-team network. Even so:

- User requests require a shared bearer token.
- Supplier connections require individual tokens.
- Supplier tokens should be stored as hashes in SQLite.
- Secrets must not be committed to Git.
- API keys and tokens must not appear in dashboard events or normal logs.
- Request bodies should have a reasonable size limit.
- Supplier messages must be validated before use.
- LLM output shown in the dashboard must be rendered as text or safely sanitized.

Users must understand that prompts are sent to another participant's computer. Production privacy guarantees are not claimed.

## 17. Suggested Repository Structure

```text
api_marketplace/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── api/
│   │   ├── websocket/
│   │   ├── routing/
│   │   ├── models/
│   │   ├── schemas/
│   │   └── services/
│   ├── requirements.txt
│   └── .env.example
├── supplier/
│   ├── supplier_agent.py
│   ├── requirements.txt
│   └── README.md
├── frontend/
│   ├── app/
│   ├── components/
│   ├── package.json
│   └── .env.example
├── README.md
└── spec.md
```

The exact number of Python modules should stay proportional to the POC. Small, cohesive modules are preferred, but unnecessary abstraction should be avoided.

## 18. Manual Acceptance Criteria

The MVP is complete when the team can demonstrate all of the following on local Wi-Fi:

1. The FastAPI server and Next.js dashboard start successfully on the host Mac.
2. Two supplier Macs can connect using their Python agents.
3. Both suppliers appear online in the dashboard.
4. OpenCode can list/use the virtual `local-marketplace` model.
5. An OpenCode prompt reaches one supplier's Ollama instance.
6. The generated answer returns to OpenCode.
7. The dashboard displays the request's major lifecycle stages.
8. A prompt submitted through the dashboard uses the same real routing flow.
9. A busy supplier does not receive a second concurrent request.
10. A new client is assigned to another available supplier when appropriate.
11. Repeated requests from the same client remain associated with the same supplier during the demo session.
12. Disconnecting an idle supplier changes its dashboard status to offline.
13. Disconnecting a supplier during inference produces a visible request failure without retrying another supplier.
14. Restarting a supplier agent reconnects the same registered node.
15. When no supplier is available, the API and dashboard show a clear error.

## 19. Implementation Priorities

Implementation should proceed in thin end-to-end increments:

1. Run TinyLlama through Ollama locally.
2. Build a supplier agent that accepts a hard-coded test job and returns a result.
3. Connect one agent to FastAPI by WebSocket.
4. Add request IDs and request/response correlation.
5. Add the non-streaming `/v1/chat/completions` endpoint.
6. Connect OpenCode and verify a complete prompt flow.
7. Add multiple suppliers and routing.
8. Add client affinity.
9. Add SQLite supplier persistence.
10. Add dashboard WebSocket events and supplier list.
11. Build the request-flow visualization and simulator.
12. Exercise the manual failure scenarios.

## 20. Future Extensions

Only after the POC works, possible extensions include:

- Virtual credits and a transaction ledger
- Supplier pricing
- User accounts and individual API keys
- Multiple models and capability-based routing
- Token streaming
- Request queues
- Reliability scoring and retries
- Historical analytics
- PostgreSQL
- Docker-based deployment
- Internet deployment with HTTPS/WSS
- Stronger privacy and security controls
- Production monitoring and automated tests

