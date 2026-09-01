from __future__ import annotations

import asyncio
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import httpx
from fastapi.testclient import TestClient

from backend.app.config import Settings
from backend.app.main import create_app


def settings(tmp_path: Path, *, api_key: str = "") -> Settings:
    return Settings(
        api_key=api_key,
        database_url=f"sqlite:///{tmp_path / 'marketplace.db'}",
        request_timeout_seconds=0.1,
        health_timeout_seconds=0.05,
        health_poll_seconds=3600,
    )


class FakeOllama:
    def __init__(self):
        self.calls: list[tuple[str, dict]] = []
        self.behavior: dict[str, str] = {}
        self.started = threading.Event()
        self.release = threading.Event()

    async def __call__(self, request: httpx.Request) -> httpx.Response:
        host = request.url.host or ""
        if request.method == "GET" and request.url.path == "/api/tags":
            if self.behavior.get(host) == "offline":
                raise httpx.ConnectError("offline", request=request)
            return httpx.Response(
                200,
                json={"models": [{"name": "tinyllama:latest"}]},
            )

        if request.method == "POST" and request.url.path == "/v1/chat/completions":
            payload = __import__("json").loads(request.content)
            self.calls.append((host, payload))
            behavior = self.behavior.get(host)
            if behavior == "block":
                self.started.set()
                await asyncio.to_thread(self.release.wait, 2)
            elif behavior == "timeout":
                raise httpx.ReadTimeout("slow", request=request)
            elif behavior == "disconnect":
                raise httpx.ConnectError("gone", request=request)
            return httpx.Response(
                200,
                json={
                    "id": "upstream-id",
                    "object": "chat.completion",
                    "model": "tinyllama",
                    "choices": [
                        {
                            "index": 0,
                            "message": {
                                "role": "assistant",
                                "content": f"answer from {host}",
                            },
                            "finish_reason": "stop",
                        }
                    ],
                },
            )
        return httpx.Response(404)


def register(client: TestClient, name: str, host: str):
    response = client.post(
        "/api/endpoints",
        json={
            "name": name,
            "base_url": f"http://{host}:11434",
            "model_name": "tinyllama",
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


def submit(client: TestClient, client_id: str, prompt: str = "hello"):
    return client.post(
        "/v1/chat/completions",
        headers={"X-Client-ID": client_id},
        json={
            "model": "local-marketplace",
            "messages": [{"role": "user", "content": prompt}],
            "stream": False,
        },
    )


def test_round_robin_affinity_and_model_translation(tmp_path: Path) -> None:
    ollama = FakeOllama()
    app = create_app(settings(tmp_path), transport=httpx.MockTransport(ollama))
    with TestClient(app) as client:
        first = register(client, "Node A", "node-a")
        second = register(client, "Node B", "node-b")

        response_a1 = submit(client, "client-a")
        response_b = submit(client, "client-b")
        response_a2 = submit(client, "client-a")

        assert [call[0] for call in ollama.calls] == ["node-a", "node-b", "node-a"]
        assert all(call[1]["model"] == "tinyllama" for call in ollama.calls)
        assert all(call[1]["stream"] is False for call in ollama.calls)
        assert response_a1.json()["model"] == "local-marketplace"
        assert response_b.json()["marketplace"]["endpoint_id"] == second["id"]
        assert response_a2.json()["marketplace"]["endpoint_id"] == first["id"]


def test_concurrency_protection_and_busy_state(tmp_path: Path) -> None:
    ollama = FakeOllama()
    ollama.behavior["node-a"] = "block"
    app = create_app(settings(tmp_path), transport=httpx.MockTransport(ollama))
    with TestClient(app) as client:
        register(client, "Node A", "node-a")
        with ThreadPoolExecutor() as executor:
            first = executor.submit(submit, client, "client-a", "first")
            assert ollama.started.wait(timeout=1)

            snapshot = client.get("/api/suppliers").json()["suppliers"]
            assert snapshot[0]["status"] == "busy"
            assert snapshot[0]["active_requests"] == 1

            same_client = submit(client, "client-a", "second")
            other_client = submit(client, "client-b", "second")
            assert same_client.status_code == 409
            assert other_client.status_code == 503

            ollama.release.set()
            assert first.result(timeout=2).status_code == 200


def test_new_client_uses_another_endpoint_while_first_is_busy(tmp_path: Path) -> None:
    ollama = FakeOllama()
    ollama.behavior["node-a"] = "block"
    app = create_app(settings(tmp_path), transport=httpx.MockTransport(ollama))
    with TestClient(app) as client:
        register(client, "Node A", "node-a")
        second_endpoint = register(client, "Node B", "node-b")
        with ThreadPoolExecutor() as executor:
            first = executor.submit(submit, client, "client-a", "first")
            assert ollama.started.wait(timeout=1)

            second = submit(client, "client-b", "second")
            assert second.status_code == 200
            assert second.json()["marketplace"]["endpoint_id"] == second_endpoint["id"]

            ollama.release.set()
            assert first.result(timeout=2).status_code == 200


def test_timeout_marks_endpoint_offline_and_keeps_affinity(tmp_path: Path) -> None:
    ollama = FakeOllama()
    app = create_app(settings(tmp_path), transport=httpx.MockTransport(ollama))
    with TestClient(app) as client:
        register(client, "Node A", "node-a")
        ollama.behavior["node-a"] = "timeout"

        response = submit(client, "client-a")
        assert response.status_code == 504
        assert "exceeded" in response.json()["detail"]
        assert client.get("/api/endpoints").json()["suppliers"][0]["status"] == "offline"

        pinned = submit(client, "client-a")
        assert pinned.status_code == 503
        assert "assigned endpoint" in pinned.json()["detail"]


def test_connection_failure_marks_endpoint_offline(tmp_path: Path) -> None:
    ollama = FakeOllama()
    app = create_app(settings(tmp_path), transport=httpx.MockTransport(ollama))
    with TestClient(app) as client:
        register(client, "Node A", "node-a")
        ollama.behavior["node-a"] = "disconnect"
        response = submit(client, "client-a")
        assert response.status_code == 502
        assert "could not reach" in response.json()["detail"]
        assert client.get("/api/endpoints").json()["suppliers"][0]["status"] == "offline"


def test_registry_persists_and_health_is_derived(tmp_path: Path) -> None:
    ollama = FakeOllama()
    configured = settings(tmp_path)
    with TestClient(
        create_app(configured, transport=httpx.MockTransport(ollama))
    ) as client:
        registered = register(client, "Node A", "node-a")

    ollama.behavior["node-a"] = "offline"
    with TestClient(
        create_app(configured, transport=httpx.MockTransport(ollama))
    ) as client:
        persisted = client.get("/api/endpoints").json()["suppliers"]
        assert persisted[0]["id"] == registered["id"]
        assert persisted[0]["base_url"] == "http://node-a:11434"
        assert persisted[0]["status"] == "offline"


def test_dashboard_receives_endpoint_and_request_events(tmp_path: Path) -> None:
    ollama = FakeOllama()
    app = create_app(settings(tmp_path), transport=httpx.MockTransport(ollama))
    with TestClient(app) as client:
        with client.websocket_connect("/ws/dashboard") as dashboard:
            assert dashboard.receive_json() == {"suppliers": []}
            registered = register(client, "Node A", "node-a")
            online = dashboard.receive_json()
            snapshot = dashboard.receive_json()
            assert online["event"] == "endpoint.online"
            assert online["endpoint_id"] == registered["id"]
            assert snapshot["suppliers"][0]["status"] == "online"

            assert submit(client, "client-a").status_code == 200
            events = [dashboard.receive_json() for _ in range(6)]
            event_names = [item.get("event") for item in events if "event" in item]
            assert "request.received" in event_names
            assert "request.assigned" in event_names
            assert "request.processing" in event_names
            assert "request.completed" in event_names


def test_registration_validation_auth_and_delete(tmp_path: Path) -> None:
    ollama = FakeOllama()
    app = create_app(
        settings(tmp_path, api_key="secret"),
        transport=httpx.MockTransport(ollama),
    )
    with TestClient(app) as client:
        assert client.get("/v1/models").status_code == 401
        headers = {"Authorization": "Bearer secret"}
        response = client.post(
            "/api/endpoints",
            headers=headers,
            json={
                "name": "Node A",
                "base_url": "http://node-a:11434",
                "model_name": "tinyllama",
            },
        )
        assert response.status_code == 200
        endpoint_id = response.json()["id"]
        deleted = client.delete(f"/api/endpoints/{endpoint_id}", headers=headers)
        assert deleted.json() == {"deleted": True}
        assert client.get("/api/endpoints").json() == {"suppliers": []}
