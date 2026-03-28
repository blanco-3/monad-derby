#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEMO_DIR="$ROOT_DIR/.demo"
mkdir -p "$DEMO_DIR"

if [ -f "$DEMO_DIR/agent-engine.pid" ] || [ -f "$DEMO_DIR/frontend.pid" ]; then
  echo "Demo appears to be running already. Use ./stop-demo.sh first."
  exit 1
fi

MODE="${1:-mock}"
DEFAULT_ANVIL_DEPLOYER_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

launch_background() {
  local log_file="$1"
  local pid_file="$2"
  shift 2

  python3 - "$log_file" "$pid_file" "$@" <<'PY'
import subprocess
import sys

log_file, pid_file, *cmd = sys.argv[1:]
with open(log_file, "ab", buffering=0) as log:
    proc = subprocess.Popen(
        cmd,
        stdin=subprocess.DEVNULL,
        stdout=log,
        stderr=log,
        start_new_session=True,
    )
with open(pid_file, "w", encoding="utf-8") as handle:
    handle.write(str(proc.pid))
PY
}

wait_for_url() {
  local url="$1"
  local name="$2"
  for _ in $(seq 1 30); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      echo "$name ready: $url"
      return 0
    fi
    sleep 1
  done
  echo "$name failed to start: $url"
  return 1
}

cd "$ROOT_DIR"
node ./scripts/sync-contracts.mjs >/dev/null 2>&1 || true

(
  cd "$ROOT_DIR/agent-engine"
  npm run build >"$DEMO_DIR/agent-engine.build.log" 2>&1
  ENGINE_DEPLOYER_KEY="${DEPLOYER_PRIVATE_KEY:-}"
  if [ "$MODE" = "chain" ] && [ -z "$ENGINE_DEPLOYER_KEY" ]; then
    ENGINE_DEPLOYER_KEY="$DEFAULT_ANVIL_DEPLOYER_KEY"
  fi
  launch_background "$DEMO_DIR/agent-engine.log" "$DEMO_DIR/agent-engine.pid" env \
    DEMO_MODE="$MODE" \
    PRICE_FEED_MODE="${PRICE_FEED_MODE:-synthetic}" \
    RACE_RANDOMNESS_MODE="${RACE_RANDOMNESS_MODE:-seeded}" \
    AI_EXECUTION_MODE="${AI_EXECUTION_MODE:-disabled}" \
    MONAD_RPC_URL="${MONAD_RPC_URL:-http://127.0.0.1:8545}" \
    DEPLOYER_PRIVATE_KEY="$ENGINE_DEPLOYER_KEY" \
    node dist/index.js
)

(
  cd "$ROOT_DIR/frontend"
  if [ "$MODE" = "chain" ]; then
    export VITE_MONAD_CHAIN_ID="${VITE_MONAD_CHAIN_ID:-31337}"
    export VITE_MONAD_CHAIN_NAME="${VITE_MONAD_CHAIN_NAME:-Anvil Local}"
    export VITE_MONAD_RPC_URL="${VITE_MONAD_RPC_URL:-http://127.0.0.1:8545}"
  fi
  export VITE_AGENT_HTTP_URL="${VITE_AGENT_HTTP_URL:-http://127.0.0.1:8787}"
  export VITE_AGENT_WS_URL="${VITE_AGENT_WS_URL:-ws://127.0.0.1:8787/ws}"
  npm run build >"$DEMO_DIR/frontend.build.log" 2>&1
  launch_background "$DEMO_DIR/frontend.log" "$DEMO_DIR/frontend.pid" ./node_modules/.bin/vite preview --host 127.0.0.1 --port 5173
)

wait_for_url "http://127.0.0.1:8787/api/status" "Agent engine"
wait_for_url "http://127.0.0.1:5173/" "Frontend"

if command -v open >/dev/null 2>&1; then
  open "http://localhost:5173"
fi

echo "Agent engine log: $DEMO_DIR/agent-engine.log"
echo "Frontend log: $DEMO_DIR/frontend.log"
echo "Demo started in $MODE mode (BTC/USD, ${RACE_RANDOMNESS_MODE:-seeded}, AI ${AI_EXECUTION_MODE:-disabled})."
