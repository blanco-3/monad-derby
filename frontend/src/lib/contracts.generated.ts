export const generatedContractAddresses = {
  "swap": "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
  "arena": "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
  "betting": "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
  "tokenMon": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  "tokenUsdc": "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  "tokenWeth": "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"
};

export const generatedAbis = {
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
  ]
};
