# Implementation Status — September 1, 2026

This document is the short handoff for the team. The detailed product contract
is in [`spec.md`](spec.md), and complete setup commands are in
[`README.md`](README.md).

## What now works

### Router and marketplace behavior

- FastAPI exposes one public model, `local-marketplace`.
- Ollama Macs are registered by display name, base URL, and installed model.
- Registrations persist in SQLite across router restarts.
- The router polls each endpoint's `/api/tags` route and derives
  `online`, `busy`, or `offline` state.
- New clients are distributed between online endpoints with round-robin routing.
- A client's `X-Client-ID` remains pinned to the same endpoint for the current
  router session.
- Selection and busy-state reservation are atomic, so two requests cannot be
  assigned to the same endpoint simultaneously.
- An endpoint handles one marketplace request at a time. There is no queue and
  no automatic retry on another endpoint.
- Timeouts and connection failures return clear HTTP errors and mark the affected
  endpoint offline until a later health check succeeds.

### API and dashboard

- `GET /v1/models`
- `POST /v1/chat/completions`
- `GET`, `POST /api/endpoints`
- `DELETE /api/endpoints/{id}`
- `POST /api/prompts`
- `WS /ws/dashboard`
- Backward-compatible aliases: `GET /api/suppliers` and `POST /api/simulate`
- The dashboard can register and validate an Ollama endpoint.
- Supplier tables now show the actual Ollama base URL.
- Endpoint and request events update status, charts, routing visualization, and
  the event log live.
- OpenCode Desktop loads the checked-in `opencode.json`, uses the virtual
  `local-marketplace` model, and receives OpenAI-compatible SSE responses.
- OpenCode tool definitions and tool-result messages pass through the router.
  Qwen2.5-Coder plain-JSON tool requests are promoted to structured tool calls
  when they match a tool advertised by OpenCode.
- If the router is unavailable, the dashboard clears transient data, shows
  startup and health-check instructions, and retries every five seconds.

## Architecture decision to know

There is no custom supplier agent. Each supplier Mac runs Ollama directly and
exposes port `11434` only to the trusted local Wi-Fi. The FastAPI router calls:

```text
GET  http://<supplier-ip>:11434/api/tags
POST http://<supplier-ip>:11434/v1/chat/completions
```

The request path is:

```text
OpenCode or Dashboard → FastAPI Router → Selected Ollama Mac → Router → Client
```

## Verification completed

- Ten backend integration tests pass.
- Tests cover round-robin routing, affinity, simultaneous requests, busy-state
  protection, second-endpoint selection, timeouts, connection loss, persistence,
  API authentication, deletion, registration validation, and dashboard events.
- The Next.js TypeScript check passes.
- The optimized Next.js production build passes.
- The FastAPI application starts in Uvicorn and serves `/health` and
  `/api/endpoints` successfully.
- A real local request completed through FastAPI → Ollama/Qwen2.5-Coder.
- A real OpenCode turn selected and executed its `read` tool through the router.

Run the same checks with:

```bash
.venv/bin/python -m pytest
cd frontend
npm run typecheck
npm run build
```

## What the team should do next

1. Put the router Mac and at least two supplier Macs on the same Wi-Fi.
2. On each supplier, pull `qwen2.5-coder`, expose Ollama on `0.0.0.0:11434`, and
   restart Ollama.
3. Confirm the router can call each supplier's `/api/tags` URL.
4. Start the router and dashboard using the root README.
5. Register both Ollama URLs from the dashboard Endpoints view.
6. Send requests with two different `X-Client-ID` values and confirm round-robin
   assignment; repeat one ID and confirm affinity.
7. Exercise offline, busy, disconnect, and timeout scenarios from the acceptance
   criteria in `spec.md`.

## Known MVP limitations

- Supplier inference is non-streaming; OpenCode receives the finished response
  as a short SSE stream rather than token-by-token output.
- Qwen2.5-Coder 7B can use OpenCode tools, but tool selection and final-answer
  quality are model-dependent and less reliable than larger coding models.
- One shared router API key
- No user accounts, payments, queues, retries, or request-history persistence
- Ollama endpoints have no API authentication and must stay off the public internet
- Live busy state, affinity, active requests, and event history reset when the
  router restarts
