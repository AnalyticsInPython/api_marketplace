#!/bin/bash

set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
RUN_DIR="$ROOT_DIR/.run"
ROUTER_HOST="${ROUTER_HOST:-0.0.0.0}"
DASHBOARD_HOST="${DASHBOARD_HOST:-0.0.0.0}"
ROUTER_URL="http://127.0.0.1:8000"
DASHBOARD_URL="http://127.0.0.1:3000"
ROUTER_PID=""
DASHBOARD_PID=""

log() {
  printf '\n[%s] %s\n' "marketplace" "$1"
}

fail() {
  printf '\n[marketplace] Error: %s\n' "$1" >&2
  exit 1
}

is_router_ready() {
  curl -fsS --max-time 2 "$ROUTER_URL/health" >/dev/null 2>&1
}

is_dashboard_ready() {
  curl -fsS --max-time 2 "$DASHBOARD_URL" 2>/dev/null | grep -q "Local LLM Marketplace"
}

wait_for_url() {
  local name="$1"
  local check="$2"
  local attempts=0

  while [[ "$attempts" -lt 60 ]]; do
    if "$check"; then
      return 0
    fi
    attempts=$((attempts + 1))
    sleep 1
  done

  fail "$name did not become ready. Check the logs in $RUN_DIR."
}

register_local_ollama_if_available() {
  local tags_json
  local model_name
  local endpoints_json
  local already_registered
  local api_key
  local auth_args=()

  if ! tags_json="$(curl -fsS --max-time 3 http://127.0.0.1:11434/api/tags 2>/dev/null)"; then
    return 0
  fi
  if [[ "${AUTO_REGISTER_LOCAL_OLLAMA:-false}" != "true" ]]; then
    log "Local Ollama is running, but local routing is disabled. Requests will use another registered laptop."
    return 0
  fi

  model_name="$(printf '%s' "$tags_json" | "$ROOT_DIR/.venv/bin/python" -c '
import json, sys
names = [item.get("name", "") for item in json.load(sys.stdin).get("models", [])]
preferred = ("qwen2.5-coder:7b", "qwen2.5-coder:1.5b", "qwen2.5-coder")
print(next((name for name in preferred if name in names), next((name for name in names if name.startswith("qwen2.5-coder:")), "")))
')"
  if [[ -z "$model_name" ]]; then
    log "Ollama is running, but Qwen2.5-Coder is not installed. Add a supplier from the Endpoints page when ready."
    return 0
  fi

  endpoints_json="$(curl -fsS --max-time 3 "$ROUTER_URL/api/endpoints")"
  already_registered="$(printf '%s' "$endpoints_json" | "$ROOT_DIR/.venv/bin/python" -c '
import json, sys
items = json.load(sys.stdin).get("suppliers", [])
print("yes" if any(item.get("base_url") == "http://127.0.0.1:11434" for item in items) else "no")
')"
  if [[ "$already_registered" == "yes" ]]; then
    return 0
  fi

  api_key="$(sed -n 's/^MARKETPLACE_API_KEY=//p' "$BACKEND_DIR/.env" | tail -n 1)"
  if [[ -n "$api_key" ]]; then
    auth_args=(-H "Authorization: Bearer $api_key")
  fi

  if curl -fsS --max-time 10 -X POST "$ROUTER_URL/api/endpoints" \
    "${auth_args[@]}" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"Local Router Mac\",\"base_url\":\"http://127.0.0.1:11434\",\"model_name\":\"$model_name\"}" \
    >/dev/null; then
    log "Registered this Mac's Ollama ($model_name) as the first marketplace endpoint."
  else
    log "The router is live, but local Ollama registration needs attention on the Endpoints page."
  fi
}

cleanup() {
  local status=$?
  trap - EXIT INT TERM
  if [[ -n "$DASHBOARD_PID" ]]; then
    kill "$DASHBOARD_PID" 2>/dev/null || true
  fi
  if [[ -n "$ROUTER_PID" ]]; then
    kill "$ROUTER_PID" 2>/dev/null || true
  fi
  exit "$status"
}

trap cleanup EXIT INT TERM
mkdir -p "$RUN_DIR"

command -v curl >/dev/null 2>&1 || fail "curl is required."

PYTHON_BIN="${PYTHON_BIN:-}"
if [[ -n "$PYTHON_BIN" ]]; then
  [[ -x "$PYTHON_BIN" ]] || fail "PYTHON_BIN does not point to an executable Python."
else
  for candidate in python3.13 python3.12 python3.11 python3.10 python3; do
    if command -v "$candidate" >/dev/null 2>&1 && \
      "$candidate" -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)' >/dev/null 2>&1; then
      PYTHON_BIN="$(command -v "$candidate")"
      break
    fi
  done
fi

[[ -n "$PYTHON_BIN" ]] || fail "Python 3.10 or newer is required. Install it, then run this command again."

if [[ ! -f "$BACKEND_DIR/.env" ]]; then
  cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
  log "Created backend/.env from the safe local-network example."
fi

if [[ ! -f "$FRONTEND_DIR/.env.local" ]]; then
  cp "$FRONTEND_DIR/.env.example" "$FRONTEND_DIR/.env.local"
  log "Created frontend/.env.local with automatic router discovery."
fi

VENV_READY=false
if [[ -x "$ROOT_DIR/.venv/bin/python" ]] && \
  "$ROOT_DIR/.venv/bin/python" -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)' >/dev/null 2>&1 && \
  [[ -x "$ROOT_DIR/.venv/bin/uvicorn" ]]; then
  VENV_READY=true
fi

if [[ "$VENV_READY" != "true" ]]; then
  log "Preparing the Python router (first run only)..."
  "$PYTHON_BIN" -m venv --clear "$ROOT_DIR/.venv"
  "$ROOT_DIR/.venv/bin/python" -m pip install -r "$BACKEND_DIR/requirements-dev.txt"
fi

if command -v npm >/dev/null 2>&1; then
  PACKAGE_MANAGER="npm"
elif command -v pnpm >/dev/null 2>&1; then
  PACKAGE_MANAGER="pnpm"
else
  fail "Node.js with npm or pnpm is required for the dashboard."
fi

if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
  log "Preparing the dashboard (first run only)..."
  if [[ "$PACKAGE_MANAGER" == "npm" ]]; then
    (cd "$FRONTEND_DIR" && npm install)
  else
    (cd "$FRONTEND_DIR" && pnpm install --lockfile=false)
  fi
fi

if is_router_ready; then
  log "Router is already running."
else
  log "Starting the FastAPI marketplace router..."
  (
    cd "$ROOT_DIR"
    exec "$ROOT_DIR/.venv/bin/uvicorn" backend.app.main:create_app \
      --factory --host "$ROUTER_HOST" --port 8000 --env-file "$BACKEND_DIR/.env"
  ) >>"$RUN_DIR/router.log" 2>&1 &
  ROUTER_PID=$!
  wait_for_url "Router" is_router_ready
fi

register_local_ollama_if_available

if is_dashboard_ready; then
  log "Dashboard is already running."
else
  log "Starting the marketplace dashboard..."
  if [[ "$PACKAGE_MANAGER" == "npm" ]]; then
    (cd "$FRONTEND_DIR" && exec npm run dev -- --hostname "$DASHBOARD_HOST") \
      >>"$RUN_DIR/dashboard.log" 2>&1 &
  else
    (cd "$FRONTEND_DIR" && exec pnpm dev --hostname "$DASHBOARD_HOST") \
      >>"$RUN_DIR/dashboard.log" 2>&1 &
  fi
  DASHBOARD_PID=$!
  wait_for_url "Dashboard" is_dashboard_ready
fi

log "Marketplace is ready."
printf 'Dashboard: %s\n' "$DASHBOARD_URL"
printf 'Router:    %s\n' "$ROUTER_URL"
printf 'Logs:      %s\n' "$RUN_DIR"

if command -v ollama >/dev/null 2>&1 && curl -fsS --max-time 2 http://127.0.0.1:11434/api/version >/dev/null 2>&1; then
  printf 'Ollama:    running locally\n'
else
  printf 'Ollama:    not running locally (optional until this Mac is added as an endpoint)\n'
fi

if [[ -n "$ROUTER_PID" || -n "$DASHBOARD_PID" ]]; then
  printf '\nLeave this Terminal window open. Press Ctrl+C to stop the services started here.\n'
  wait
fi
