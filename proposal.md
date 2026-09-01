# Project Proposal: Local LLM Marketplace

## Team

Omer Abraham, Alara Dinc, Austin Chandra, and David Lee

## Project Summary

We propose building a local-network marketplace for sharing computing resources that run open-source large language models (LLMs). A user will send a prompt from OpenCode or a web interface to one central API server. The server will choose an available teammate's computer, forward the prompt to its locally running Ollama model, and return the response to the user.

This is an educational proof of concept. All computers will be macOS devices connected to the same Wi-Fi network. The project will not process payments, use real credits, or expose the models to the public internet.

## Problem and Motivation

Running an LLM locally requires memory and computing power that may not always be available on the user's own computer. Meanwhile, another computer on the same network may have an idle local model. Our project explores how one service can discover these available computers and route LLM requests between them through a single, consistent API.

The main technical focus is the central router: endpoint registration, availability tracking, request selection, client-to-endpoint affinity, error handling, and real-time visualization.

## Proposed System

Each supplier computer will run Ollama and expose its HTTP API to the trusted local network. Suppliers will not need to install a custom program. The central server will be written in Python using FastAPI and will present an OpenAI-compatible API to clients such as OpenCode.

```text
                                  Local Wi-Fi

 OpenCode / User                 FastAPI Router                  Supplier Mac
┌────────────────┐  request    ┌──────────────────┐  request   ┌──────────────┐
│ Prompt or code ├────────────►│ Select endpoint ├───────────►│ Ollama + LLM │
│ question       │◄────────────┤ Track request   │◄───────────┤              │
└────────────────┘  response   └────────┬─────────┘  response  └──────────────┘
                                       │ live events
                                       ▼
                              ┌──────────────────┐
                              │ Next.js dashboard│
                              └──────────────────┘
```

The router will register Ollama endpoints, check whether they are online or busy, select one available endpoint, and forward chat-completion requests to it. Requests from the same client will remain assigned to the same endpoint during the current server session. If that endpoint is unavailable, the router will return a clear error rather than retrying another endpoint.

A Next.js dashboard will display registered endpoints and their status. It will also include a prompt simulator and visualize the request moving from the user to the router, to the selected model, and back to the user. SQLite will store only the endpoint information required by the dashboard; temporary request state and events will remain in memory.

## Technology

- Python and FastAPI for the central API/router
- Next.js for the dashboard
- SQLite for endpoint registration
- Ollama for installing, serving, and running local open-source models
- OpenCode as the terminal-based demonstration client
- WebSockets for live dashboard events

## MVP Scope and Demonstration

The final demonstration will use at least two Macs on the same Wi-Fi. We will show that:

1. Ollama computers can be registered with the router.
2. The dashboard reports whether each endpoint is online, busy, or offline.
3. OpenCode or the dashboard can send a prompt to one router address.
4. The router automatically selects an available Ollama endpoint.
5. The generated answer travels back through the router to the user.
6. Repeated requests from one client stay on the same endpoint for the session.
7. The dashboard visualizes the complete request lifecycle in real time.

## Out of Scope

To keep the proof of concept achievable, we will not include payments, real credit accounting, public-cloud deployment, internet-facing endpoints, user accounts, request queues, automatic retries, or production security. The local models may have limited support for OpenCode's advanced tool-calling features, so the required demo focuses on routed prompting and responses.

## Expected Outcome

The completed project will demonstrate that multiple local Ollama installations can be presented as one shared LLM service. It will provide a working Python routing server, a live dashboard, and a clear foundation for discussing how authentication, accounting, stronger scheduling, and broader networking could be added in a future version.
