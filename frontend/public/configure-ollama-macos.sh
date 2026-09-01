#!/bin/bash

set -euo pipefail

MODEL_NAME="${OLLAMA_MODEL:-qwen2.5-coder:1.5b}"
OLLAMA_APP="/Applications/Ollama.app"

restart_ollama() {
  osascript -e 'tell application "Ollama" to quit' >/dev/null 2>&1 || true
  sleep 2
  open -a Ollama
}

wait_for_ollama() {
  local attempt
  for attempt in {1..20}; do
    if curl -fsS http://127.0.0.1:11434/api/version >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This setup helper only supports macOS."
  exit 1
fi

if [[ "${1:-}" == "--restore-localhost" ]]; then
  launchctl unsetenv OLLAMA_HOST
  restart_ollama
  echo "Ollama was restored to localhost-only mode."
  exit 0
fi

if [[ ! -d "$OLLAMA_APP" ]]; then
  echo "Ollama.app was not found in /Applications. Install and open Ollama first."
  exit 1
fi

if command -v ollama >/dev/null 2>&1; then
  OLLAMA_BIN="$(command -v ollama)"
elif [[ -x "$OLLAMA_APP/Contents/Resources/ollama" ]]; then
  OLLAMA_BIN="$OLLAMA_APP/Contents/Resources/ollama"
else
  echo "The Ollama command-line tool was not found. Reinstall Ollama and try again."
  exit 1
fi

echo "Preparing $MODEL_NAME for the local marketplace..."
open -a Ollama
if ! wait_for_ollama; then
  echo "Ollama did not start on localhost. Open the app manually and run this script again."
  exit 1
fi

"$OLLAMA_BIN" pull "$MODEL_NAME"

launchctl setenv OLLAMA_HOST "0.0.0.0:11434"
restart_ollama
if ! wait_for_ollama; then
  echo "Ollama did not restart. Open the app manually, allow the firewall prompt, and retry."
  exit 1
fi

WIFI_IP="$(ipconfig getifaddr en0 2>/dev/null || true)"
if [[ -z "$WIFI_IP" ]]; then
  WIFI_IP="$(ipconfig getifaddr en1 2>/dev/null || true)"
fi
if [[ -z "$WIFI_IP" ]]; then
  echo "Ollama is configured, but no Wi-Fi IP was found. Check System Settings > Wi-Fi > Details > TCP/IP."
  exit 1
fi

if ! lsof -nP -iTCP:11434 -sTCP:LISTEN | grep -Eq '(\*|0\.0\.0\.0):11434'; then
  echo "Ollama is running, but port 11434 is not exposed to the network yet."
  echo "Quit and reopen Ollama, allow the macOS firewall prompt, then run this script again."
  exit 1
fi

if ! curl -fsS "http://$WIFI_IP:11434/api/tags" >/dev/null; then
  echo "Ollama is listening, but its Wi-Fi address did not answer. Check the firewall or VPN."
  exit 1
fi

echo
echo "Supplier Mac is ready."
echo "Endpoint URL: http://$WIFI_IP:11434"
echo "Model: $MODEL_NAME"
echo
echo "Paste the endpoint URL into the marketplace dashboard and run network checks."
echo "To restore localhost-only mode later, run:"
echo "  $0 --restore-localhost"
