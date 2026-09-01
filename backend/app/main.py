from __future__ import annotations

import hmac
import json
from contextlib import asynccontextmanager
from typing import Annotated, Any

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .config import Settings
from .database import EndpointRegistry
from .marketplace import Marketplace, MarketplaceError
from .schemas import ChatCompletionRequest, EndpointCreate, SimulationRequest


def create_app(
    settings: Settings | None = None,
    *,
    transport: httpx.AsyncBaseTransport | None = None,
) -> FastAPI:
    resolved_settings = settings or Settings.from_env()
    registry = EndpointRegistry(resolved_settings.database_path)
    marketplace = Marketplace(resolved_settings, registry, transport=transport)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        await marketplace.start()
        yield
        await marketplace.stop()
        registry.close()

    app = FastAPI(
        title="Local LLM Marketplace",
        version="0.1.0",
        lifespan=lifespan,
    )
    app.state.settings = resolved_settings
    app.state.registry = registry
    app.state.marketplace = marketplace
    app.add_middleware(
        CORSMiddleware,
        allow_origins=resolved_settings.allowed_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Client-ID"],
    )

    async def require_api_key(
        authorization: Annotated[str | None, Header()] = None,
    ) -> None:
        expected = resolved_settings.api_key
        if not expected:
            return
        scheme, _, supplied = (authorization or "").partition(" ")
        if scheme.lower() != "bearer" or not supplied:
            raise HTTPException(status_code=401, detail="missing bearer token")
        if not hmac.compare_digest(supplied, expected):
            raise HTTPException(status_code=401, detail="invalid API key")

    async def execute(
        *,
        client_id: str,
        client_label: str,
        messages: list[dict[str, Any]],
        upstream_options: dict[str, Any] | None = None,
    ):
        total_characters = sum(
            len(json.dumps(message.get("content"), ensure_ascii=False))
            for message in messages
        )
        if total_characters > resolved_settings.max_prompt_characters:
            raise HTTPException(status_code=413, detail="request body is too large")
        try:
            return await marketplace.infer(
                client_id=client_id,
                client_label=client_label,
                messages=messages,
                upstream_options=upstream_options or {},
            )
        except MarketplaceError as error:
            raise HTTPException(status_code=error.status_code, detail=str(error)) from error

    async def snapshots() -> dict[str, Any]:
        return {"suppliers": await marketplace.endpoint_snapshot()}

    async def prompt(body: SimulationRequest) -> dict[str, Any]:
        result = await execute(
            client_id=f"dashboard:{body.client_label}",
            client_label=body.client_label,
            messages=[{"role": "user", "content": body.prompt}],
        )
        return {
            "request_id": result.request_id,
            "content": result.content,
            "supplier_id": result.endpoint_id,
            "supplier_name": result.endpoint_name,
            "endpoint_id": result.endpoint_id,
            "endpoint_name": result.endpoint_name,
        }

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/v1/models", dependencies=[Depends(require_api_key)])
    async def models() -> dict[str, Any]:
        return {
            "object": "list",
            "data": [
                {
                    "id": "local-marketplace",
                    "object": "model",
                    "owned_by": "local-marketplace",
                }
            ],
        }

    @app.post("/v1/chat/completions", dependencies=[Depends(require_api_key)])
    async def chat_completions(
        body: ChatCompletionRequest,
        request: Request,
        x_client_id: Annotated[str | None, Header(alias="X-Client-ID")] = None,
    ) -> Any:
        fallback_id = request.client.host if request.client else "unknown-client"
        client_id = (x_client_id or fallback_id).strip()[:200]
        request_payload = body.model_dump(exclude_none=True)
        upstream_options = {
            key: value
            for key, value in request_payload.items()
            if key not in {"model", "messages", "stream"}
        }
        result = await execute(
            client_id=client_id,
            client_label=x_client_id or f"client-{fallback_id}",
            messages=[message.model_dump(exclude_none=True) for message in body.messages],
            upstream_options=upstream_options,
        )
        response = dict(result.response)
        response["marketplace"] = {
            "request_id": result.request_id,
            "endpoint_id": result.endpoint_id,
            "endpoint_name": result.endpoint_name,
        }
        if not body.stream:
            return response

        async def event_stream():
            choice = response["choices"][0]
            message = choice["message"]
            base_chunk = {
                "id": response["id"],
                "object": "chat.completion.chunk",
                "created": response.get("created"),
                "model": response["model"],
                "marketplace": response["marketplace"],
            }
            delta = {"role": message.get("role", "assistant")}
            if message.get("content"):
                delta["content"] = message["content"]
            if message.get("tool_calls"):
                tool_calls = []
                for index, raw_tool_call in enumerate(message["tool_calls"]):
                    tool_call = dict(raw_tool_call)
                    tool_call["index"] = index
                    function = dict(tool_call.get("function", {}))
                    arguments = function.get("arguments", "")
                    if not isinstance(arguments, str):
                        function["arguments"] = json.dumps(
                            arguments, separators=(",", ":")
                        )
                    tool_call["function"] = function
                    tool_calls.append(tool_call)
                delta["tool_calls"] = tool_calls
            content_chunk = {
                **base_chunk,
                "choices": [
                    {
                        "index": choice.get("index", 0),
                        "delta": delta,
                        "finish_reason": None,
                    }
                ],
            }
            finish_chunk = {
                **base_chunk,
                "choices": [
                    {
                        "index": choice.get("index", 0),
                        "delta": {},
                        "finish_reason": choice.get("finish_reason", "stop"),
                    }
                ],
                "usage": response.get("usage"),
            }
            yield f"data: {json.dumps(content_chunk, separators=(',', ':'))}\n\n"
            yield f"data: {json.dumps(finish_chunk, separators=(',', ':'))}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(event_stream(), media_type="text/event-stream")

    @app.get("/api/endpoints")
    async def endpoints() -> dict[str, Any]:
        return await snapshots()

    @app.get("/api/suppliers")
    async def suppliers_alias() -> dict[str, Any]:
        return await snapshots()

    @app.post("/api/endpoints", dependencies=[Depends(require_api_key)])
    async def register_endpoint(body: EndpointCreate) -> dict[str, Any]:
        try:
            record = await marketplace.register_endpoint(
                body.name, body.base_url, body.model_name
            )
        except MarketplaceError as error:
            raise HTTPException(status_code=error.status_code, detail=str(error)) from error
        return {
            "id": record.id,
            "name": record.name,
            "base_url": record.base_url,
            "model_name": record.model_name,
            "status": "online",
            "active_requests": 0,
            "last_seen_at": record.last_seen_at,
        }

    @app.delete("/api/endpoints/{endpoint_id}", dependencies=[Depends(require_api_key)])
    async def delete_endpoint(endpoint_id: str) -> dict[str, bool]:
        try:
            deleted = await marketplace.remove_endpoint(endpoint_id)
        except MarketplaceError as error:
            raise HTTPException(status_code=error.status_code, detail=str(error)) from error
        if not deleted:
            raise HTTPException(status_code=404, detail="endpoint not found")
        return {"deleted": True}

    @app.post("/api/prompts", dependencies=[Depends(require_api_key)])
    async def prompts(body: SimulationRequest) -> dict[str, Any]:
        return await prompt(body)

    @app.post("/api/simulate", dependencies=[Depends(require_api_key)])
    async def simulate_alias(body: SimulationRequest) -> dict[str, Any]:
        return await prompt(body)

    @app.websocket("/ws/dashboard")
    async def dashboard_websocket(websocket: WebSocket) -> None:
        await websocket.accept()
        await marketplace.add_dashboard(websocket)
        try:
            while True:
                await websocket.receive_text()
        except WebSocketDisconnect:
            pass
        finally:
            await marketplace.remove_dashboard(websocket)

    return app
