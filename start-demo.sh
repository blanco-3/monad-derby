#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEMO_DIR="$ROOT_DIR/.demo"
mkdir -p "$DEMO_DIR"

if [ -f "$DEMO_DIR/agent-engine.pid" ] || [ -f "$DEMO_DIR/frontend.pid" ] || [ -f "$DEMO_DIR/anvil.pid" ]; then
  echo "Demo appears to be running already. Use ./stop-demo.sh first."
  exit 1
fi

MODE="${1:-mock}"
DEFAULT_ANVIL_DEPLOYER_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
DEFAULT_LOCAL_RPC_URL="http://127.0.0.1:8545"
RPC_URL="${MONAD_RPC_URL:-$DEFAULT_LOCAL_RPC_URL}"
CHAIN_AUTO_BOOTSTRAP="${CHAIN_AUTO_BOOTSTRAP:-1}"

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

rpc_ready() {
  local rpc_url="$1"
  curl -fsS "$rpc_url" \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' >/dev/null 2>&1
}

wait_for_rpc() {
  local rpc_url="$1"
  for _ in $(seq 1 30); do
    if rpc_ready "$rpc_url"; then
      echo "RPC ready: $rpc_url"
      return 0
    fi
    sleep 1
  done
  echo "RPC failed to start: $rpc_url"
  return 1
}

bootstrap_chain_if_needed() {
  if [ "$MODE" != "chain" ] || [ "$CHAIN_AUTO_BOOTSTRAP" != "1" ]; then
    return 0
  fi

  if [ "$RPC_URL" = "$DEFAULT_LOCAL_RPC_URL" ]; then
    if ! rpc_ready "$RPC_URL"; then
      if ! command -v anvil >/dev/null 2>&1; then
        echo "anvil is required for local chain mode."
        exit 1
      fi
      echo "Starting local Anvil..."
      launch_background "$DEMO_DIR/anvil.log" "$DEMO_DIR/anvil.pid" anvil --host 127.0.0.1 --port 8545
      wait_for_rpc "$RPC_URL"
    fi
  fi

  if ! command -v forge >/dev/null 2>&1; then
    echo "forge is required for chain mode."
    exit 1
  fi

  local deployer_key="${DEPLOYER_PRIVATE_KEY:-$DEFAULT_ANVIL_DEPLOYER_KEY}"
  echo "Deploying contracts for chain demo..."
  (
    cd "$ROOT_DIR/contracts"
    DEPLOYER_PRIVATE_KEY="$deployer_key" \
      forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --broadcast \
      >"$DEMO_DIR/contracts.deploy.log" 2>&1
  )
  node "$ROOT_DIR/scripts/sync-contracts.mjs" >"$DEMO_DIR/contracts.sync.log" 2>&1
}

cd "$ROOT_DIR"
if [ "$MODE" = "chain" ]; then
  bootstrap_chain_if_needed
else
  node ./scripts/sync-contracts.mjs >/dev/null 2>&1 || true
fi

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
    MONAD_RPC_URL="$RPC_URL" \
    DEPLOYER_PRIVATE_KEY="$ENGINE_DEPLOYER_KEY" \
    node dist/index.js
)

(
  cd "$ROOT_DIR/frontend"
  if [ "$MODE" = "chain" ]; then
    export VITE_MONAD_CHAIN_ID="${VITE_MONAD_CHAIN_ID:-31337}"
    export VITE_MONAD_CHAIN_NAME="${VITE_MONAD_CHAIN_NAME:-Anvil Local}"
    export VITE_MONAD_RPC_URL="${VITE_MONAD_RPC_URL:-$RPC_URL}"
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
if [ -f "$DEMO_DIR/anvil.pid" ]; then
  echo "Anvil log: $DEMO_DIR/anvil.log"
fi
echo "Demo started in $MODE mode (BTC/USD, ${RACE_RANDOMNESS_MODE:-seeded}, AI ${AI_EXECUTION_MODE:-disabled})."
