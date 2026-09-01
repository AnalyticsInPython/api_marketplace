from __future__ import annotations

import hmac
from contextlib import asynccontextmanager
from typing import Annotated, Any

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

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
        *, client_id: str, client_label: str, messages: list[dict[str, str]]
    ):
        total_characters = sum(len(message["content"]) for message in messages)
        if total_characters > resolved_settings.max_prompt_characters:
            raise HTTPException(status_code=413, detail="request body is too large")
        try:
            return await marketplace.infer(
                client_id=client_id,
                client_label=client_label,
                messages=messages,
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
    ) -> dict[str, Any]:
        fallback_id = request.client.host if request.client else "unknown-client"
        client_id = (x_client_id or fallback_id).strip()[:200]
        result = await execute(
            client_id=client_id,
            client_label=x_client_id or f"client-{fallback_id}",
            messages=[message.model_dump() for message in body.messages],
        )
        response = dict(result.response)
        response["marketplace"] = {
            "request_id": result.request_id,
            "endpoint_id": result.endpoint_id,
            "endpoint_name": result.endpoint_name,
        }
        return response

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
