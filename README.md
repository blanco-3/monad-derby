# MonadDerby

MonadDerby is a BTC/USD AI race built for Monad Blitz Seoul. Claude, GPT, and Gemini take long/short positions against the same live or synthetic BTC tape while spectators bet on the winner and settle that outcome on-chain.

## Architecture

```text
Frontend (React + Vite)
  ├─ WebSocket dashboard for live race state, PnL, odds, and trade feed
  └─ Betting UI (mock API or on-chain wallet flow)

Agent Engine (Node + TypeScript)
  ├─ RoundManager
  ├─ Synthetic BTC market driver with seeded scenarios
  ├─ Coinbase BTC-USD feed fallback path
  ├─ Mock runtime for stable demos
  ├─ Chain runtime for on-chain betting settlement
  ├─ Mock / AI strategies with shadow/live fallback
  └─ Express + WebSocket server for race state, odds, and proof logs

Contracts (Foundry + Solidity)
  ├─ TestToken
  ├─ SimpleSwap
  ├─ AgentArena (reported settlement supported)
  └─ BettingPool
```

## Why Monad

- Parallel execution supports multiple agent trades plus live bettor activity without serial UX bottlenecks.
- Fast block times and low finality target make rapid autonomous trading and live odds updates viable.
- Full EVM compatibility keeps the stack simple enough for hackathon delivery with Foundry, ethers, and React.

## Local Run

1. Install dependencies:
   `cd agent-engine && npm install`
   `cd ../frontend && npm install`
2. Run contract tests:
   `cd ../contracts && forge test`
3. Run engine tests:
   `cd ../agent-engine && npm test`
4. Start the default demo:
   `cd .. && ./start-demo.sh`
5. Open `http://localhost:5173`
6. Stop everything with:
   `./stop-demo.sh`

## Contract Flow

1. `BettingPool.resetPool()` opens a fresh round market.
2. `AgentArena.startRound()` opens the on-chain betting round.
3. The off-chain engine runs the BTC long/short race and records proof logs.
4. `AgentArena.finalizeReportedRound()` stores final PnL, winner, and proof hash.
5. `AgentArena` triggers `BettingPool.settle()` for the winning agent outcome.

## Chain / Anvil Smoke Path

1. Start Anvil:
   `anvil`
2. Deploy contracts:
   `cd contracts && forge script script/Deploy.s.sol:Deploy --rpc-url http://127.0.0.1:8545 --broadcast --private-key $DEPLOYER_PRIVATE_KEY`
3. Sync artifacts:
   `cd .. && node scripts/sync-contracts.mjs`
4. Start the local chain demo:
   `./start-demo.sh chain`

## Tech Stack

- Solidity 0.8.20+, Foundry
- TypeScript, Node.js, Express, ws, ethers v6
- React 18, Vite, TailwindCSS, Recharts
- Reown AppKit for wallet connection
- Coinbase Exchange WebSocket for optional public BTC-USD feed

## Roadmap

- Tournament brackets and multi-race ladders
- Short / long race presets
- Higher-confidence AI proof transcripts and replay viewer
- Deeper real AI provider integration
- Monad testnet and mainnet deployment polish

## Screenshots

- `docs/screenshots/dashboard.png`
- `docs/screenshots/race-end.png`
