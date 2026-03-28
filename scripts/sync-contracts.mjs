#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const contractsDir = resolve(root, "contracts");
const frontendOutput = resolve(root, "frontend/src/lib/contracts.generated.ts");
const engineOutput = resolve(root, "agent-engine/src/generated/contracts.ts");

const deploymentsPath = resolve(contractsDir, "deployments.json");
const deployments = existsSync(deploymentsPath) ? JSON.parse(readFileSync(deploymentsPath, "utf8")) : {};

const artifacts = {
  simpleSwap: loadAbi("SimpleSwap.sol", "SimpleSwap"),
  agentArena: loadAbi("AgentArena.sol", "AgentArena"),
  bettingPool: loadAbi("BettingPool.sol", "BettingPool"),
  testToken: loadAbi("TestToken.sol", "TestToken"),
};

const addressExport = {
  swap: deployments.SWAP_CONTRACT ?? "",
  arena: deployments.ARENA_CONTRACT ?? "",
  betting: deployments.BETTING_CONTRACT ?? "",
  tokenMon: deployments.TOKEN_MON ?? "",
  tokenUsdc: deployments.TOKEN_USDC ?? "",
  tokenWeth: deployments.TOKEN_WETH ?? "",
};

writeGenerated(
  frontendOutput,
  `export const generatedContractAddresses = ${JSON.stringify(addressExport, null, 2)};\n\nexport const generatedAbis = ${JSON.stringify(
    {
      bettingPool: artifacts.bettingPool,
    },
    null,
    2,
  )};\n`,
);

writeGenerated(
  engineOutput,
  `export const generatedContractAddresses = ${JSON.stringify(addressExport, null, 2)};\n\nexport const generatedAbis = ${JSON.stringify(
    artifacts,
    null,
    2,
  )};\n`,
);

console.log("Synced contract artifacts to frontend and agent-engine.");

function loadAbi(sourceFile, contractName) {
  const path = resolve(contractsDir, `out/${sourceFile}/${contractName}.json`);
  if (!existsSync(path)) return [];
  const file = JSON.parse(readFileSync(path, "utf8"));
  return file.abi ?? [];
}

function writeGenerated(path, content) {
  mkdirSync(resolve(path, ".."), { recursive: true });
  writeFileSync(path, content);
}
