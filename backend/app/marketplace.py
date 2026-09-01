from __future__ import annotations

import asyncio
import uuid
from collections import deque
from dataclasses import dataclass
from typing import Any

import httpx
from fastapi import WebSocket

from .config import Settings
from .database import EndpointRecord, EndpointRegistry, utc_now


class MarketplaceError(Exception):
    status_code = 500


class NoEndpointAvailable(MarketplaceError):
    status_code = 503


class ClientRequestInFlight(MarketplaceError):
    status_code = 409


class EndpointUnavailable(MarketplaceError):
    status_code = 503


class EndpointConnectionError(MarketplaceError):
    status_code = 502


class EndpointInferenceError(MarketplaceError):
    status_code = 502


class EndpointTimedOut(MarketplaceError):
    status_code = 504


class EndpointBusy(MarketplaceError):
    status_code = 409


@dataclass(slots=True)
class EndpointState:
    record: EndpointRecord
    online: bool = False
    active_request_id: str | None = None

    @property
    def status(self) -> str:
        if not self.online:
            return "offline"
        if self.active_request_id:
            return "busy"
        return "online"


@dataclass(frozen=True, slots=True)
class InferenceResult:
    request_id: str
    endpoint_id: str
    endpoint_name: str
    content: str
    response: dict[str, Any]


class Marketplace:
    def __init__(
        self,
        settings: Settings,
        registry: EndpointRegistry,
        transport: httpx.AsyncBaseTransport | None = None,
    ):
        self.settings = settings
        self.registry = registry
        self._states = {
            record.id: EndpointState(record=record)
            for record in registry.list_all()
        }
        self._dashboard_clients: set[WebSocket] = set()
        self._affinity: dict[str, str] = {}
        self._inflight_clients: set[str] = set()
        self._round_robin_cursor = 0
        self._lock = asyncio.Lock()
        self._events: deque[dict[str, Any]] = deque(
            maxlen=settings.event_history_limit
        )
        self._client = httpx.AsyncClient(transport=transport)
        self._poll_task: asyncio.Task[None] | None = None

    async def start(self) -> None:
        await self.poll_health()
        self._poll_task = asyncio.create_task(self._health_loop())

    async def stop(self) -> None:
        if self._poll_task:
            self._poll_task.cancel()
            try:
                await self._poll_task
            except asyncio.CancelledError:
                pass
        await self._client.aclose()

    async def register_endpoint(
        self, name: str, base_url: str, model_name: str
    ) -> EndpointRecord:
        async with self._lock:
            matching = next(
                (
                    state
                    for state in self._states.values()
                    if state.record.name == name or state.record.base_url == base_url
                ),
                None,
            )
            if matching and matching.active_request_id:
                raise EndpointBusy("cannot update an endpoint while it is busy")
        await self._probe(base_url, model_name)
        try:
            record = self.registry.register(name, base_url, model_name)
        except Exception as error:
            raise EndpointInferenceError(
                "an endpoint with that name or URL already exists"
            ) from error

        async with self._lock:
            self._states[record.id] = EndpointState(record=record, online=True)
        await self.emit(
            "endpoint.online",
            endpoint_id=record.id,
            endpoint_name=record.name,
            message=f"{record.name} · {record.model_name}",
        )
        await self.broadcast_snapshot()
        return record

    async def remove_endpoint(self, endpoint_id: str) -> bool:
        async with self._lock:
            state = self._states.get(endpoint_id)
            if state and state.active_request_id:
                raise EndpointBusy("cannot remove an endpoint while it is busy")
            self._states.pop(endpoint_id, None)
            self._affinity = {
                client_id: assigned_id
                for client_id, assigned_id in self._affinity.items()
                if assigned_id != endpoint_id
            }
        deleted = self.registry.delete(endpoint_id)
        if deleted:
            await self.emit(
                "endpoint.offline",
                endpoint_id=endpoint_id,
                endpoint_name=state.record.name if state else None,
                message="Endpoint removed",
            )
            await self.broadcast_snapshot()
        return deleted

    async def infer(
        self, *, client_id: str, client_label: str, messages: list[dict[str, str]]
    ) -> InferenceResult:
        request_id = str(uuid.uuid4())
        await self.emit(
            "request.received",
            request_id=request_id,
            client_label=client_label,
        )

        state: EndpointState | None = None
        try:
            state = await self._reserve(client_id, request_id)
            await self.emit(
                "endpoint.busy",
                request_id=request_id,
                endpoint_id=state.record.id,
                endpoint_name=state.record.name,
            )
            await self.emit(
                "request.assigned",
                request_id=request_id,
                client_label=client_label,
                endpoint_id=state.record.id,
                endpoint_name=state.record.name,
            )
            await self.broadcast_snapshot()
            await self.emit(
                "request.processing",
                request_id=request_id,
                client_label=client_label,
                endpoint_id=state.record.id,
                endpoint_name=state.record.name,
            )

            try:
                response = await self._client.post(
                    f"{state.record.base_url}/v1/chat/completions",
                    json={
                        "model": state.record.model_name,
                        "messages": messages,
                        "stream": False,
                    },
                    timeout=self.settings.request_timeout_seconds,
                )
            except httpx.TimeoutException as error:
                await self._set_online(state.record.id, False)
                raise EndpointTimedOut(
                    f"endpoint {state.record.name} exceeded the "
                    f"{self.settings.request_timeout_seconds:g}s timeout"
                ) from error
            except httpx.RequestError as error:
                await self._set_online(state.record.id, False)
                raise EndpointConnectionError(
                    f"could not reach endpoint {state.record.name}"
                ) from error

            if response.is_error:
                raise EndpointInferenceError(
                    f"endpoint {state.record.name} returned HTTP {response.status_code}"
                )
            try:
                payload = response.json()
                content = payload["choices"][0]["message"]["content"]
            except (ValueError, KeyError, IndexError, TypeError) as error:
                raise EndpointInferenceError(
                    f"endpoint {state.record.name} returned a malformed completion"
                ) from error
            if not isinstance(content, str):
                raise EndpointInferenceError(
                    f"endpoint {state.record.name} returned non-text content"
                )

            payload["id"] = f"chatcmpl-{request_id}"
            payload["model"] = "local-marketplace"
            result = InferenceResult(
                request_id=request_id,
                endpoint_id=state.record.id,
                endpoint_name=state.record.name,
                content=content,
                response=payload,
            )
            await self.emit(
                "request.completed",
                request_id=request_id,
                client_label=client_label,
                endpoint_id=result.endpoint_id,
                endpoint_name=result.endpoint_name,
            )
            return result
        except MarketplaceError as error:
            await self.emit(
                "request.failed",
                request_id=request_id,
                client_label=client_label,
                endpoint_id=state.record.id if state else None,
                endpoint_name=state.record.name if state else None,
                message=str(error),
            )
            raise
        finally:
            if state is not None:
                released_online = await self._release(client_id, request_id, state)
                if released_online:
                    await self.emit(
                        "endpoint.online",
                        endpoint_id=state.record.id,
                        endpoint_name=state.record.name,
                    )
                await self.broadcast_snapshot()

    async def _reserve(self, client_id: str, request_id: str) -> EndpointState:
        async with self._lock:
            if client_id in self._inflight_clients:
                raise ClientRequestInFlight(
                    "this client already has a request in flight"
                )

            state: EndpointState | None = None
            affinity_id = self._affinity.get(client_id)
            if affinity_id:
                pinned = self._states.get(affinity_id)
                if pinned is None:
                    self._affinity.pop(client_id, None)
                elif not pinned.online:
                    raise EndpointUnavailable(
                        f"the client's assigned endpoint {pinned.record.name} is offline"
                    )
                elif pinned.active_request_id:
                    raise ClientRequestInFlight(
                        f"the client's assigned endpoint {pinned.record.name} is busy"
                    )
                else:
                    state = pinned

            if state is None:
                available = sorted(
                    (
                        item
                        for item in self._states.values()
                        if item.online and item.active_request_id is None
                    ),
                    key=lambda item: (item.record.created_at, item.record.name),
                )
                if not available:
                    raise NoEndpointAvailable("no online endpoint is available")
                index = self._round_robin_cursor % len(available)
                state = available[index]
                self._round_robin_cursor = (index + 1) % len(available)
                self._affinity[client_id] = state.record.id

            state.active_request_id = request_id
            self._inflight_clients.add(client_id)
            return state

    async def _release(
        self, client_id: str, request_id: str, state: EndpointState
    ) -> bool:
        async with self._lock:
            self._inflight_clients.discard(client_id)
            current = self._states.get(state.record.id)
            if current is not state or current.active_request_id != request_id:
                return False
            current.active_request_id = None
            return current.online

    async def poll_health(self) -> None:
        records = self.registry.list_all()
        async with self._lock:
            busy_ids = {
                endpoint_id
                for endpoint_id, state in self._states.items()
                if state.active_request_id
            }
        records = [record for record in records if record.id not in busy_ids]
        results = await asyncio.gather(
            *(self._check_record(record) for record in records),
            return_exceptions=True,
        )
        for record, result in zip(records, results, strict=True):
            await self._set_online(record.id, result is True)

    async def _check_record(self, record: EndpointRecord) -> bool:
        try:
            await self._probe(record.base_url, record.model_name)
        except MarketplaceError:
            return False
        self.registry.touch(record.id)
        return True

    async def _probe(self, base_url: str, model_name: str) -> None:
        try:
            response = await self._client.get(
                f"{base_url}/api/tags",
                timeout=self.settings.health_timeout_seconds,
            )
            response.raise_for_status()
            payload = response.json()
        except (httpx.HTTPError, ValueError) as error:
            raise EndpointConnectionError(
                "could not validate the Ollama endpoint"
            ) from error
        installed = {
            str(model.get("name", ""))
            for model in payload.get("models", [])
            if isinstance(model, dict)
        }
        requested_base = model_name.split(":", 1)[0]
        if model_name not in installed and not any(
            item.split(":", 1)[0] == requested_base for item in installed
        ):
            raise EndpointInferenceError(
                f"model {model_name!r} is not installed on that endpoint"
            )

    async def _set_online(self, endpoint_id: str, online: bool) -> None:
        async with self._lock:
            state = self._states.get(endpoint_id)
            if state is None or state.online == online:
                return
            state.online = online
            record = state.record
        await self.emit(
            "endpoint.online" if online else "endpoint.offline",
            endpoint_id=record.id,
            endpoint_name=record.name,
        )
        await self.broadcast_snapshot()

    async def _health_loop(self) -> None:
        while True:
            await asyncio.sleep(self.settings.health_poll_seconds)
            await self.poll_health()

    async def endpoint_snapshot(self) -> list[dict[str, Any]]:
        records = self.registry.list_all()
        async with self._lock:
            states = dict(self._states)
        return [
            {
                "id": record.id,
                "name": record.name,
                "base_url": record.base_url,
                "model_name": record.model_name,
                "status": states[record.id].status if record.id in states else "offline",
                "active_requests": (
                    1
                    if record.id in states and states[record.id].active_request_id
                    else 0
                ),
                "last_seen_at": record.last_seen_at,
            }
            for record in records
        ]

    async def add_dashboard(self, websocket: WebSocket) -> None:
        async with self._lock:
            self._dashboard_clients.add(websocket)
            history = list(self._events)
        await websocket.send_json({"suppliers": await self.endpoint_snapshot()})
        for event in history:
            await websocket.send_json(event)

    async def remove_dashboard(self, websocket: WebSocket) -> None:
        async with self._lock:
            self._dashboard_clients.discard(websocket)

    async def emit(self, event: str, **values: Any) -> None:
        payload = {
            "event": event,
            "timestamp": utc_now(),
            **{key: value for key, value in values.items() if value is not None},
        }
        async with self._lock:
            self._events.append(payload)
        await self._broadcast(payload)

    async def broadcast_snapshot(self) -> None:
        await self._broadcast({"suppliers": await self.endpoint_snapshot()})

    async def _broadcast(self, payload: dict[str, Any]) -> None:
        async with self._lock:
            clients = list(self._dashboard_clients)
        stale: list[WebSocket] = []
        for client in clients:
            try:
                await client.send_json(payload)
            except Exception:
                stale.append(client)
        if stale:
            async with self._lock:
                for client in stale:
                    self._dashboard_clients.discard(client)
