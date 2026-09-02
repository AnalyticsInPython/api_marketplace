# Local LLM Marketplace

This project lets several Macs share their Ollama models through one local API.
A user submits a prompt in the browser or OpenCode, the router chooses an
available supplier Mac, and the dashboard shows what happened in real time.

```text
User or OpenCode -> Router Mac -> Supplier Mac running Ollama -> response
                         |
                         +-> live dashboard updates
```

> **Important:** the normal demo needs **at least two Macs on the same trusted
> Wi-Fi network**. One Mac runs the router and dashboard. A different Mac runs
> Ollama. The router deliberately does not send requests to its own Ollama
> instance.

## The short version

If you only need to run the demo, follow these sections in order:

1. [Understand the two roles](#1-understand-the-two-roles)
2. [Start the router and dashboard](#2-start-the-router-and-dashboard-router-mac)
3. [Prepare a supplier](#3-prepare-ollama-supplier-mac)
4. [Register and test the supplier](#4-register-and-test-the-supplier-router-mac)
5. [Send a real prompt](#5-send-a-real-prompt)
6. [Shut everything down safely](#6-shut-everything-down-safely)

The first setup downloads dependencies and the Qwen model, so it takes longer
than later launches.

## 1. Understand the two roles

| Computer | What it does | What it needs |
| --- | --- | --- |
| **Router Mac** | Runs the FastAPI router and web dashboard | Git, Python 3.10+, Node.js 18.17+ |
| **Supplier Mac** | Runs prompts with Ollama | Ollama and `qwen2.5-coder:1.5b` |

The Macs must be on the same trusted Wi-Fi. Do not use a guest network that
prevents devices from communicating with one another.

You may add more supplier Macs later. Each supplier handles one marketplace
request at a time.

## 2. Start the router and dashboard (router Mac)

Do all steps in this section on the **router Mac**.

### 2.1 Install the required software

Open Terminal and check what is already installed:

```bash
git --version
python3 --version
node --version
```

You need Python 3.10 or newer and Node.js 18.17 or newer. If a command is
missing or too old, install [Homebrew](https://brew.sh/) and then run:

```bash
brew install git python@3.12 node
```

### 2.2 Download the project

Skip the `git clone` command if you already have this project folder.

```bash
git clone https://github.com/AnalyticsInPython/api_marketplace.git
cd api_marketplace
```

Every later router command assumes Terminal is in the `api_marketplace` folder.

### 2.3 Run the launcher

```bash
./start-marketplace.sh
```

On its first run, the launcher automatically:

- creates the Python environment;
- installs the backend and frontend dependencies;
- creates the local configuration files;
- starts the API router on port `8000`; and
- starts the dashboard on port `3000`.

Wait for this message:

```text
[marketplace] Marketplace is ready.
Dashboard: http://127.0.0.1:3000
Router:    http://127.0.0.1:8000
```

Leave this Terminal window open. If macOS asks whether Python, Node, or Terminal
may accept incoming connections, choose **Allow**.

### 2.4 Open the dashboard

On the router Mac, open [http://127.0.0.1:3000](http://127.0.0.1:3000).

The top of the page should show that the router is live. It is normal to see no
online endpoints yet.

## 3. Prepare Ollama (supplier Mac)

Do all steps in this section on a **different Mac** connected to the same
trusted Wi-Fi.

### 3.1 Install Ollama

Download [Ollama for macOS](https://ollama.com/download/mac), move it to the
Applications folder, and open it once. Leave Ollama running.

### 3.2 Open the marketplace dashboard

The supplier Mac needs the router Mac's Wi-Fi address. On the router Mac, run:

```bash
ipconfig getifaddr en0
```

If that prints nothing, find the address under **System Settings -> Wi-Fi ->
Details -> TCP/IP**. It normally looks like `192.168.1.10` or `10.0.0.10`.

On the supplier Mac, open this address in a browser, replacing the example IP:

```text
http://192.168.1.10:3000
```

If the page does not open, see [Dashboard does not open from the supplier
Mac](#dashboard-does-not-open-from-the-supplier-mac).

### 3.3 Download and run the supplier helper

In the dashboard, select **Endpoints**, then select **Download setup helper**.

On the supplier Mac, open Terminal and run these two lines:

```bash
chmod +x ~/Downloads/configure-ollama-macos.sh
~/Downloads/configure-ollama-macos.sh
```

If the file was saved somewhere other than Downloads, use that folder instead.
The helper downloads `qwen2.5-coder:1.5b`, exposes Ollama to the local network,
restarts Ollama, and checks the connection.

If macOS asks whether Ollama may accept incoming connections, choose **Allow**.
Wait until Terminal prints something like:

```text
Supplier Mac is ready.
Endpoint URL: http://192.168.1.24:11434
Model: qwen2.5-coder:1.5b
```

Copy the exact **Endpoint URL**. Keep Ollama open.

## 4. Register and test the supplier (router Mac)

Return to the dashboard and select **Endpoints**.

In the registration form, enter:

```text
Name:         Any recognizable name, such as Alara's Mac
Endpoint URL: The exact URL printed by the supplier helper
Model:        qwen2.5-coder:1.5b
```

Then:

1. Select **Run network checks**.
2. Do not continue until the Ollama and model checks pass.
3. Select **Submit endpoint**.
4. Wait for the new endpoint to show **online**.
5. Select **Send routed test**.

The routed test should report which supplier answered. The marketplace is now
ready.

Repeat sections 3 and 4 for every additional supplier Mac.

## 5. Send a real prompt

### Easiest option: browser Playground

1. Select **Playground** in the dashboard.
2. Type a prompt.
3. Select **Run prompt**.
4. Read the response and check the routing diagram to see which Mac handled it.

No extra software is required for this option.

### Optional: OpenCode on the router Mac

Install OpenCode if needed:

```bash
brew install anomalyco/tap/opencode
```

From the project folder, run:

```bash
export MARKETPLACE_API_KEY="dev-marketplace-key"
opencode
```

The included `opencode.json` already points to the local marketplace. Choose
**Local Marketplace** if OpenCode does not select it automatically.

The small 1.5B model is appropriate for the routing demo, but it can struggle
with multi-step tool use. A supplier with enough memory may use
`qwen2.5-coder:7b` for a more ambitious OpenCode demonstration; use the same
exact model tag when registering that supplier.

### Optional: OpenCode on another computer

Copy `opencode.json` into the project you will open with OpenCode. Change its
`baseURL` from `127.0.0.1` to the router Mac's Wi-Fi address:

```json
"baseURL": "http://192.168.1.10:8000/v1"
```

Then set the key and launch OpenCode on that computer:

```bash
export MARKETPLACE_API_KEY="dev-marketplace-key"
opencode
```

## 6. Shut everything down safely

On the router Mac, press **Control-C** in the Terminal running
`start-marketplace.sh`.

On every supplier Mac, restore Ollama to localhost-only mode:

```bash
~/Downloads/configure-ollama-macos.sh --restore-localhost
```

Then quit Ollama if you no longer need it.

> **Security warning:** Ollama does not authenticate its API. While the helper's
> network setting is active, other devices on the same network can call that
> supplier's Ollama server, including its model-management routes. Only use this
> on a trusted private network, never forward port `11434` from a router, and
> restore localhost-only mode after the demo.

## Troubleshooting

### `./start-marketplace.sh` says Python is missing or too old

Install a supported version, then rerun the launcher:

```bash
brew install python@3.12
./start-marketplace.sh
```

### `./start-marketplace.sh` says Node.js is required

```bash
brew install node
./start-marketplace.sh
```

### The launcher does not become ready

Read the service logs from the project folder:

```bash
tail -n 100 .run/router.log
tail -n 100 .run/dashboard.log
```

Also check whether another application is already using either port:

```bash
lsof -nP -iTCP:8000 -sTCP:LISTEN
lsof -nP -iTCP:3000 -sTCP:LISTEN
```

### Dashboard does not open from the supplier Mac

Check all of the following:

- both Macs are on the same non-guest Wi-Fi;
- the URL uses the router Mac's Wi-Fi IP, not `127.0.0.1`;
- `start-marketplace.sh` is still running on the router Mac; and
- macOS Firewall allows incoming connections for the router services.

On the router Mac, confirm the dashboard works locally at
[http://127.0.0.1:3000](http://127.0.0.1:3000). Then retry
`http://<router-wifi-ip>:3000` from the supplier Mac.

### Supplier helper says port `11434` is not exposed

Some Ollama app versions do not inherit the network setting. On the supplier
Mac, quit the Ollama app and run:

```bash
OLLAMA_HOST=0.0.0.0:11434 ollama serve
```

Leave that Terminal open during the demo. In another Terminal, confirm the
listener is not limited to `127.0.0.1`:

```bash
lsof -nP -iTCP:11434 -sTCP:LISTEN
```

The output must contain `*:11434` or `0.0.0.0:11434`.

### Network checks cannot reach Ollama

- Use the supplier Mac's Wi-Fi IP, not `localhost` or `127.0.0.1`.
- Confirm Ollama and the supplier Terminal are still running.
- Disable or reconfigure a VPN that separates the Macs.
- Check the supplier Mac's firewall permission for Ollama.
- Confirm the URL works from the router Mac:

```bash
curl http://<supplier-wifi-ip>:11434/api/version
curl http://<supplier-wifi-ip>:11434/api/tags
```

### The model check fails

On the supplier Mac, run:

```bash
ollama list
ollama pull qwen2.5-coder:1.5b
```

The model entered in the dashboard must exactly match a tag shown by
`ollama list`. For example, `qwen2.5-coder` and
`qwen2.5-coder:1.5b` are not treated as the same tag.

### An endpoint is online but no request can run

The router ignores endpoints hosted on the router Mac. At least one **different
Mac** must be registered and online. An endpoint also accepts only one request
at a time; wait for its status to return to **online** before retrying.

### OpenCode returns HTTP 401

The value exported as `MARKETPLACE_API_KEY` must match the value in
`backend/.env`. The default for this local proof of concept is:

```bash
export MARKETPLACE_API_KEY="dev-marketplace-key"
```

If the dashboard itself reports HTTP 401, also make sure
`NEXT_PUBLIC_API_KEY` in `frontend/.env.local` has the same value, then restart
`start-marketplace.sh`.

## Advanced operation

You do not need this section for the normal demo.

### Manual router startup

Use three Terminal windows and run these commands from the project folder.

Terminal 1, one-time setup:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements-dev.txt
test -f backend/.env || cp backend/.env.example backend/.env
cd frontend
npm install
test -f .env.local || cp .env.example .env.local
cd ..
```

Terminal 1, router:

```bash
.venv/bin/uvicorn backend.app.main:create_app --factory \
  --host 0.0.0.0 --port 8000 --env-file backend/.env
```

Terminal 2, dashboard:

```bash
cd frontend
npm run dev -- --hostname 0.0.0.0
```

Terminal 3 is optional and can be used for OpenCode.

### Change the demo API key

The same value must appear in both files:

```text
backend/.env:          MARKETPLACE_API_KEY=your-new-key
frontend/.env.local:  NEXT_PUBLIC_API_KEY=your-new-key
```

Restart the launcher after changing the files. `NEXT_PUBLIC_*` settings are
visible in the browser, so this shared key is suitable only for this local proof
of concept.

### Direct API test

```bash
curl http://127.0.0.1:8000/v1/chat/completions \
  -H 'Authorization: Bearer dev-marketplace-key' \
  -H 'Content-Type: application/json' \
  -H 'X-Client-ID: demo-client' \
  -d '{
    "model": "local-marketplace",
    "messages": [{"role": "user", "content": "Explain recursion simply."}],
    "stream": false
  }'
```

Reuse the same `X-Client-ID` to demonstrate client affinity. Use a new ID to
demonstrate round-robin assignment between multiple available suppliers.

### API routes

```text
GET    /health
GET    /v1/models
POST   /v1/chat/completions
GET    /api/endpoints
POST   /api/endpoints
POST   /api/endpoints/diagnose
DELETE /api/endpoints/{id}
POST   /api/prompts
WS     /ws/dashboard
```

Compatibility aliases remain at `GET /api/suppliers` and
`POST /api/simulate`.

### Run the project checks

```bash
.venv/bin/python -m pytest
cd frontend
npm run typecheck
npm run build
```

## How routing behaves

- New clients are assigned to online supplier Macs in round-robin order.
- The same `X-Client-ID` stays assigned to the same healthy supplier for the
  current router session.
- If that supplier is offline, the stale assignment is cleared for the next
  request.
- A supplier handles one marketplace request at a time.
- Requests are not queued or automatically retried on another supplier.
- Endpoint registrations persist in SQLite.
- Busy state, client affinity, active requests, and dashboard event history
  reset when the router restarts.
- Ollama inference is non-streaming. OpenCode receives the completed result as a
  short OpenAI-compatible SSE response.

For implementation details and team handoff notes, see
[`IMPLEMENTATION_STATUS.md`](IMPLEMENTATION_STATUS.md). For the product and
architecture contract, see [`spec.md`](spec.md).
