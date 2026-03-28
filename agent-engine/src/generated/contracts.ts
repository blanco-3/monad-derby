export const generatedContractAddresses = {
  "swap": "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
  "arena": "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
  "betting": "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
  "tokenMon": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  "tokenUsdc": "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  "tokenWeth": "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"
};

export const generatedAbis = {
  "simpleSwap": [
    {
      "type": "constructor",
      "inputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "addLiquidity",
      "inputs": [
        {
          "name": "tokenA",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "tokenB",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "amountA",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "amountB",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "shares",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "createPair",
      "inputs": [
        {
          "name": "tokenA",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "tokenB",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "pairId",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "getAmountOut",
      "inputs": [
        {
          "name": "tokenIn",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "tokenOut",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "amountIn",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "amountOut",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "getLpShares",
      "inputs": [
        {
          "name": "tokenA",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "tokenB",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "provider",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "getPairCount",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "getPairId",
      "inputs": [
        {
          "name": "tokenA",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "tokenB",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "getPrice",
      "inputs": [
        {
          "name": "tokenA",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "tokenB",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "price",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "getReserves",
      "inputs": [
        {
          "name": "tokenA",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "tokenB",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "reserveA",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "reserveB",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "pairIndex",
      "inputs": [
        {
          "name": "",
          "type": "bytes32",
          "internalType": "bytes32"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "removeLiquidity",
      "inputs": [
        {
          "name": "tokenA",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "tokenB",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "shares",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "amount0Out",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "amount1Out",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "swap",
      "inputs": [
        {
          "name": "tokenIn",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "tokenOut",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "amountIn",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "minAmountOut",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "to",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "amountOut",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "event",
      "name": "LiquidityAdded",
      "inputs": [
        {
          "name": "provider",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "pairId",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "amount0",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "amount1",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "shares",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "LiquidityRemoved",
      "inputs": [
        {
          "name": "provider",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "pairId",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "amount0",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "amount1",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "PairCreated",
      "inputs": [
        {
          "name": "token0",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "token1",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "pairId",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "Swap",
      "inputs": [
        {
          "name": "trader",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "pairId",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "tokenIn",
          "type": "address",
          "indexed": false,
          "internalType": "address"
        },
        {
          "name": "amountIn",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "amountOut",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    }
  ],
  "agentArena": [
    {
      "type": "constructor",
      "inputs": [
        {
          "name": "_swap",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "_settlementMode",
          "type": "uint8",
          "internalType": "enum AgentArena.SettlementMode"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "agents",
      "inputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "wallet",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "name",
          "type": "string",
          "internalType": "string"
        },
        {
          "name": "registered",
          "type": "bool",
          "internalType": "bool"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "baseToken",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "bettingPool",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "currentRoundId",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "endRound",
      "inputs": [],
      "outputs": [
        {
          "name": "winner",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "winnerName",
          "type": "string",
          "internalType": "string"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "finalizeReportedRound",
      "inputs": [
        {
          "name": "finalPnLsBps",
          "type": "int256[]",
          "internalType": "int256[]"
        },
        {
          "name": "winnerIdx",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "proofHash",
          "type": "bytes32",
          "internalType": "bytes32"
        }
      ],
      "outputs": [
        {
          "name": "winner",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "winnerName",
          "type": "string",
          "internalType": "string"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "getAgentCount",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "getAllCurrentPnLs",
      "inputs": [],
      "outputs": [
        {
          "name": "pnls",
          "type": "int256[]",
          "internalType": "int256[]"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "getCurrentPnL",
      "inputs": [
        {
          "name": "agentWallet",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "int256",
          "internalType": "int256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "getCurrentPnL",
      "inputs": [
        {
          "name": "roundId",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "agentIndex",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "int256",
          "internalType": "int256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "getCurrentRound",
      "inputs": [],
      "outputs": [
        {
          "name": "id",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "startTime",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "endTime",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "active",
          "type": "bool",
          "internalType": "bool"
        },
        {
          "name": "ended",
          "type": "bool",
          "internalType": "bool"
        },
        {
          "name": "winner",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "winnerName",
          "type": "string",
          "internalType": "string"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "getFinalPnLs",
      "inputs": [
        {
          "name": "roundId",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "int256[]",
          "internalType": "int256[]"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "getPortfolioValue",
      "inputs": [
        {
          "name": "agentWallet",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "getRoundCount",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "initialValues",
      "inputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "owner",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "registerAgent",
      "inputs": [
        {
          "name": "wallet",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "name",
          "type": "string",
          "internalType": "string"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "rounds",
      "inputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "id",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "startTime",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "endTime",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "duration",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "settlementMode",
          "type": "uint8",
          "internalType": "enum AgentArena.SettlementMode"
        },
        {
          "name": "active",
          "type": "bool",
          "internalType": "bool"
        },
        {
          "name": "ended",
          "type": "bool",
          "internalType": "bool"
        },
        {
          "name": "winner",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "winnerName",
          "type": "string",
          "internalType": "string"
        },
        {
          "name": "proofHash",
          "type": "bytes32",
          "internalType": "bytes32"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "setBettingPool",
      "inputs": [
        {
          "name": "_bettingPool",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "setSettlementMode",
      "inputs": [
        {
          "name": "_settlementMode",
          "type": "uint8",
          "internalType": "enum AgentArena.SettlementMode"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "setTokens",
      "inputs": [
        {
          "name": "_baseToken",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "_tradeTokens",
          "type": "address[]",
          "internalType": "address[]"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "settlementMode",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint8",
          "internalType": "enum AgentArena.SettlementMode"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "startRound",
      "inputs": [
        {
          "name": "durationSeconds",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "roundId",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "swap",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "contract SimpleSwap"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "tradeTokens",
      "inputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "event",
      "name": "AgentRegistered",
      "inputs": [
        {
          "name": "wallet",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "name",
          "type": "string",
          "indexed": false,
          "internalType": "string"
        },
        {
          "name": "agentIndex",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "BettingPoolUpdated",
      "inputs": [
        {
          "name": "bettingPoolAddress",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "RoundEnded",
      "inputs": [
        {
          "name": "roundId",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "winner",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "winnerName",
          "type": "string",
          "indexed": false,
          "internalType": "string"
        },
        {
          "name": "finalPnLs",
          "type": "int256[]",
          "indexed": false,
          "internalType": "int256[]"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "RoundResultReported",
      "inputs": [
        {
          "name": "roundId",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "winnerIndex",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "proofHash",
          "type": "bytes32",
          "indexed": false,
          "internalType": "bytes32"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "RoundStarted",
      "inputs": [
        {
          "name": "roundId",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "duration",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "startTime",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "SettlementModeUpdated",
      "inputs": [
        {
          "name": "mode",
          "type": "uint8",
          "indexed": true,
          "internalType": "enum AgentArena.SettlementMode"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "TradeExecuted",
      "inputs": [
        {
          "name": "roundId",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "agent",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "tokenIn",
          "type": "address",
          "indexed": false,
          "internalType": "address"
        },
        {
          "name": "tokenOut",
          "type": "address",
          "indexed": false,
          "internalType": "address"
        },
        {
          "name": "amountIn",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "amountOut",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    }
  ],
  "bettingPool": [
    {
      "type": "constructor",
      "inputs": [
        {
          "name": "_arena",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "receive",
      "stateMutability": "payable"
    },
    {
      "type": "function",
      "name": "FEE_BPS",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "activeRoundId",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "agentPools",
      "inputs": [
        {
          "name": "agentIndex",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "arena",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "contract AgentArena"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "claimWinnings",
      "inputs": [],
      "outputs": [
        {
          "name": "totalClaim",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "getAgentShare",
      "inputs": [
        {
          "name": "agentIndex",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "getAllOdds",
      "inputs": [],
      "outputs": [
        {
          "name": "odds",
          "type": "uint256[]",
          "internalType": "uint256[]"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "getOdds",
      "inputs": [
        {
          "name": "agentIndex",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "odds",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "getPoolInfo",
      "inputs": [],
      "outputs": [
        {
          "name": "roundId",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "pools",
          "type": "uint256[]",
          "internalType": "uint256[]"
        },
        {
          "name": "total",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "isSettled",
          "type": "bool",
          "internalType": "bool"
        },
        {
          "name": "winner",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "getUserBets",
      "inputs": [
        {
          "name": "user",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "tuple[]",
          "internalType": "struct BettingPool.BetInfo[]",
          "components": [
            {
              "name": "roundId",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "agentIndex",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "amount",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "claimed",
              "type": "bool",
              "internalType": "bool"
            }
          ]
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "getUserPendingClaim",
      "inputs": [
        {
          "name": "user",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "totalClaim",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "latestSettledRoundId",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "owner",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "placeBet",
      "inputs": [
        {
          "name": "agentIndex",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [],
      "stateMutability": "payable"
    },
    {
      "type": "function",
      "name": "resetPool",
      "inputs": [],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "settle",
      "inputs": [
        {
          "name": "_winnerIndex",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "settled",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "bool",
          "internalType": "bool"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "settledRoundId",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "totalPool",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "winnerIndex",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "withdrawFees",
      "inputs": [],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "event",
      "name": "BetPlaced",
      "inputs": [
        {
          "name": "bettor",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "roundId",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "agentIndex",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "amount",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "PoolReset",
      "inputs": [
        {
          "name": "roundId",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "agentCount",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "Settled",
      "inputs": [
        {
          "name": "roundId",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "winnerIndex",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "totalPool",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "WinningsClaimed",
      "inputs": [
        {
          "name": "bettor",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "amount",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    }
  ],
  "testToken": [
    {
      "type": "constructor",
      "inputs": [
        {
          "name": "_name",
          "type": "string",
          "internalType": "string"
        },
        {
          "name": "_symbol",
          "type": "string",
          "internalType": "string"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "allowance",
      "inputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "approve",
      "inputs": [
        {
          "name": "spender",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "amount",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "bool",
          "internalType": "bool"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "balanceOf",
      "inputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "decimals",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint8",
          "internalType": "uint8"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "mint",
      "inputs": [
        {
          "name": "to",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "amount",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "name",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "string",
          "internalType": "string"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "symbol",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "string",
          "internalType": "string"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "totalSupply",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "transfer",
      "inputs": [
        {
          "name": "to",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "amount",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "bool",
          "internalType": "bool"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "transferFrom",
      "inputs": [
        {
          "name": "from",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "to",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "amount",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "bool",
          "internalType": "bool"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "event",
      "name": "Approval",
      "inputs": [
        {
          "name": "owner",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "spender",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "value",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "Transfer",
      "inputs": [
        {
          "name": "from",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "to",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "value",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    }
  ]
};
