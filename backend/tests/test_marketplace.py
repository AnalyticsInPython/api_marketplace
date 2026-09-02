from __future__ import annotations

import asyncio
import json
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
        if request.method == "GET" and request.url.path == "/api/version":
            if self.behavior.get(host) == "offline":
                raise httpx.ConnectError("offline", request=request)
            return httpx.Response(200, json={"version": "0.33.2"})
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
            content = f"answer from {host}"
            if behavior == "text_tool":
                content = '{"name":"read","arguments":{"filePath":"README.md"}}'
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
                                "content": content,
                            },
                            "finish_reason": "stop",
                        }
                    ],
                    **(
                        {}
                        if behavior == "no_usage"
                        else {
                            "usage": {
                                "prompt_tokens": 7,
                                "completion_tokens": 11,
                                "total_tokens": 18,
                            }
                        }
                    ),
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


def test_streaming_request_returns_openai_compatible_sse(tmp_path: Path) -> None:
    ollama = FakeOllama()
    app = create_app(settings(tmp_path), transport=httpx.MockTransport(ollama))
    with TestClient(app) as client:
        endpoint = register(client, "Node A", "node-a")
        response = client.post(
            "/v1/chat/completions",
            headers={"X-Client-ID": "opencode-client"},
            json={
                "model": "local-marketplace",
                "messages": [
                    {"role": "user", "content": "hello"},
                    {
                        "role": "tool",
                        "content": "README heading",
                        "tool_call_id": "call_readme",
                    },
                ],
                "stream": True,
                "tools": [
                    {
                        "type": "function",
                        "function": {
                            "name": "read",
                            "parameters": {"type": "object"},
                        },
                    }
                ],
            },
        )

        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/event-stream")
        frames = [line.removeprefix("data: ") for line in response.text.splitlines() if line]
        assert frames[-1] == "[DONE]"
        content = json.loads(frames[0])
        finished = json.loads(frames[1])
        assert content["object"] == "chat.completion.chunk"
        assert content["choices"][0]["delta"]["content"] == "answer from node-a"
        assert content["marketplace"]["endpoint_id"] == endpoint["id"]
        assert finished["choices"][0]["finish_reason"] == "stop"
        assert ollama.calls[0][1]["stream"] is False
        assert ollama.calls[0][1]["tools"][0]["function"]["name"] == "read"
        assert ollama.calls[0][1]["messages"][1]["role"] == "tool"
        assert ollama.calls[0][1]["messages"][1]["tool_call_id"] == "call_readme"


def test_qwen_text_tool_call_is_promoted_for_opencode(tmp_path: Path) -> None:
    ollama = FakeOllama()
    ollama.behavior["node-a"] = "text_tool"
    app = create_app(settings(tmp_path), transport=httpx.MockTransport(ollama))
    with TestClient(app) as client:
        register(client, "Node A", "node-a")
        response = client.post(
            "/v1/chat/completions",
            json={
                "model": "local-marketplace",
                "messages": [{"role": "user", "content": "read README"}],
                "stream": True,
                "tools": [
                    {
                        "type": "function",
                        "function": {
                            "name": "read",
                            "parameters": {"type": "object"},
                        },
                    }
                ],
            },
        )

        frames = [line.removeprefix("data: ") for line in response.text.splitlines() if line]
        content = json.loads(frames[0])
        finished = json.loads(frames[1])
        tool_call = content["choices"][0]["delta"]["tool_calls"][0]
        assert tool_call["function"]["name"] == "read"
        assert json.loads(tool_call["function"]["arguments"]) == {
            "filePath": "README.md"
        }
        assert finished["choices"][0]["finish_reason"] == "tool_calls"


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


def test_timeout_marks_endpoint_offline_and_clears_stale_affinity(tmp_path: Path) -> None:
    ollama = FakeOllama()
    app = create_app(settings(tmp_path), transport=httpx.MockTransport(ollama))
    with TestClient(app) as client:
        register(client, "Node A", "node-a")
        second_endpoint = register(client, "Node B", "node-b")
        ollama.behavior["node-a"] = "timeout"

        response = submit(client, "client-a")
        assert response.status_code == 504
        assert "exceeded" in response.json()["detail"]
        assert client.get("/api/endpoints").json()["suppliers"][0]["status"] == "offline"

        rerouted = submit(client, "client-a")
        assert rerouted.status_code == 200
        assert rerouted.json()["marketplace"]["endpoint_id"] == second_endpoint["id"]


def test_router_local_ollama_is_skipped_with_notice(tmp_path: Path) -> None:
    ollama = FakeOllama()
    app = create_app(settings(tmp_path), transport=httpx.MockTransport(ollama))
    with TestClient(app) as client:
        register(client, "Router Mac", "127.0.0.1")
        remote = register(client, "Remote Mac", "node-b")

        response = submit(client, "client-a")

        assert response.status_code == 200
        assert [call[0] for call in ollama.calls] == ["node-b"]
        marketplace = response.json()["marketplace"]
        assert marketplace["endpoint_id"] == remote["id"]
        assert "Local Ollama" in marketplace["routing_notice"]


def test_router_local_ollama_is_never_used_as_last_resort(tmp_path: Path) -> None:
    ollama = FakeOllama()
    app = create_app(settings(tmp_path), transport=httpx.MockTransport(ollama))
    with TestClient(app) as client:
        register(client, "Router Mac", "127.0.0.1")

        response = submit(client, "client-a")

        assert response.status_code == 503
        assert "local routing is disabled" in response.json()["detail"]
        assert ollama.calls == []


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


def test_endpoint_diagnostic_reports_network_and_model_readiness(tmp_path: Path) -> None:
    ollama = FakeOllama()
    app = create_app(settings(tmp_path), transport=httpx.MockTransport(ollama))
    with TestClient(app) as client:
        ready = client.post(
            "/api/endpoints/diagnose",
            json={
                "base_url": "http://192.168.1.24:11434",
                "model_name": "tinyllama",
            },
        )
        assert ready.status_code == 200
        assert ready.json() == {
            "base_url": "http://192.168.1.24:11434",
            "network_scope": "private",
            "safe_for_lan": True,
            "reachable": True,
            "version": "0.33.2",
            "models": ["tinyllama:latest"],
            "requested_model": "tinyllama",
            "model_available": True,
            "ready": True,
            "issues": [],
        }

        missing = client.post(
            "/api/endpoints/diagnose",
            json={
                "base_url": "http://192.168.1.24:11434",
                "model_name": "qwen2.5-coder",
            },
        ).json()
        assert missing["reachable"] is True
        assert missing["model_available"] is False
        assert missing["ready"] is False
        assert missing["issues"][0]["code"] == "model_missing"


def test_endpoint_diagnostic_explains_offline_loopback_and_public_urls(
    tmp_path: Path,
) -> None:
    ollama = FakeOllama()
    ollama.behavior["127.0.0.1"] = "offline"
    app = create_app(settings(tmp_path), transport=httpx.MockTransport(ollama))
    with TestClient(app) as client:
        offline = client.post(
            "/api/endpoints/diagnose",
            json={
                "base_url": "http://127.0.0.1:11434",
                "model_name": "tinyllama",
            },
        ).json()
        assert offline["network_scope"] == "loopback"
        assert offline["reachable"] is False
        assert offline["ready"] is False
        assert {issue["code"] for issue in offline["issues"]} == {
            "loopback_address",
            "version_unavailable",
            "endpoint_unreachable",
        }

        public = client.post(
            "/api/endpoints/diagnose",
            json={
                "base_url": "http://8.8.8.8:11434",
                "model_name": "tinyllama",
            },
        ).json()
        assert public["reachable"] is False
        assert public["safe_for_lan"] is False
        assert public["ready"] is False
        assert public["issues"][0]["code"] == "public_address"

        hostname = client.post(
            "/api/endpoints/diagnose",
            json={
                "base_url": "https://unverified.example.com:11434",
                "model_name": "tinyllama",
            },
        ).json()
        assert hostname["network_scope"] == "hostname"
        assert hostname["reachable"] is False
        assert hostname["issues"][0]["code"] == "unverified_hostname"


def test_dashboard_cors_accepts_private_lan_origins_only(tmp_path: Path) -> None:
    app = create_app(settings(tmp_path), transport=httpx.MockTransport(FakeOllama()))
    with TestClient(app) as client:
        private = client.get(
            "/health", headers={"Origin": "http://192.168.1.10:3000"}
        )
        assert private.headers["access-control-allow-origin"] == (
            "http://192.168.1.10:3000"
        )

        public = client.get(
            "/health", headers={"Origin": "https://untrusted.example.com"}
        )
        assert "access-control-allow-origin" not in public.headers


def test_endpoint_accumulates_tokens_used(tmp_path: Path) -> None:
    ollama = FakeOllama()
    app = create_app(settings(tmp_path), transport=httpx.MockTransport(ollama))
    with TestClient(app) as client:
        endpoint = register(client, "Node A", "node-a")

        def tokens_for(endpoint_id: str) -> int:
            suppliers = client.get("/api/endpoints").json()["suppliers"]
            return next(s["tokens_used"] for s in suppliers if s["id"] == endpoint_id)

        assert tokens_for(endpoint["id"]) == 0

        submit(client, "client-a")
        assert tokens_for(endpoint["id"]) == 18

        submit(client, "client-a")
        assert tokens_for(endpoint["id"]) == 36

        # An upstream response without a usage block must not break the tally.
        ollama.behavior["node-a"] = "no_usage"
        submit(client, "client-a")
        assert tokens_for(endpoint["id"]) == 36


def test_tokens_used_is_tracked_per_endpoint(tmp_path: Path) -> None:
    ollama = FakeOllama()
    app = create_app(settings(tmp_path), transport=httpx.MockTransport(ollama))
    with TestClient(app) as client:
        first = register(client, "Node A", "node-a")
        second = register(client, "Node B", "node-b")

        submit(client, "client-a")  # round-robin -> node-a
        submit(client, "client-b")  # round-robin -> node-b
        submit(client, "client-a")  # affinity -> node-a

        suppliers = {s["id"]: s["tokens_used"] for s in client.get("/api/endpoints").json()["suppliers"]}
        assert suppliers[first["id"]] == 36
        assert suppliers[second["id"]] == 18
