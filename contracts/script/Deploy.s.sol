// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/TestToken.sol";
import "../src/SimpleSwap.sol";
import "../src/AgentArena.sol";
import "../src/BettingPool.sol";

/// @notice MonadDerby 전체 배포 스크립트
contract Deploy is Script {
    uint256 constant DEFAULT_AGENT_1_PRIVATE_KEY = 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d;
    uint256 constant DEFAULT_AGENT_2_PRIVATE_KEY = 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a;
    uint256 constant DEFAULT_AGENT_3_PRIVATE_KEY = 0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6;

    // 초기 유동성 설정
    uint256 constant LIQUIDITY_MON_USDC_MON   = 500_000 ether;
    uint256 constant LIQUIDITY_MON_USDC_USDC  = 500_000 ether;
    uint256 constant LIQUIDITY_WETH_USDC_WETH = 200_000 ether;
    uint256 constant LIQUIDITY_WETH_USDC_USDC = 600_000 ether;
    uint256 constant LIQUIDITY_MON_WETH_MON   = 300_000 ether;
    uint256 constant LIQUIDITY_MON_WETH_WETH  = 100_000 ether;

    // 에이전트 초기 지급량
    uint256 constant AGENT_USDC_AMOUNT = 10_000 ether;
    uint256 constant AGENT_MON_AMOUNT  = 5_000 ether;
    uint256 constant AGENT_WETH_AMOUNT = 2_000 ether;

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        uint256 agent1Key = vm.envOr("AGENT_1_PRIVATE_KEY", DEFAULT_AGENT_1_PRIVATE_KEY);
        uint256 agent2Key = vm.envOr("AGENT_2_PRIVATE_KEY", DEFAULT_AGENT_2_PRIVATE_KEY);
        uint256 agent3Key = vm.envOr("AGENT_3_PRIVATE_KEY", DEFAULT_AGENT_3_PRIVATE_KEY);

        address agent1Addr = vm.envOr("AGENT_1_ADDRESS", vm.addr(agent1Key));
        address agent2Addr = vm.envOr("AGENT_2_ADDRESS", vm.addr(agent2Key));
        address agent3Addr = vm.envOr("AGENT_3_ADDRESS", vm.addr(agent3Key));

        vm.startBroadcast(deployerKey);

        // ─── 1. 토큰 배포 ──────────────────────────────────────
        console.log("Deploying tokens...");
        TestToken tMON  = new TestToken("Test MON",  "tMON");
        TestToken tUSDC = new TestToken("Test USDC", "tUSDC");
        TestToken tWETH = new TestToken("Test WETH", "tWETH");

        console.log("tMON  :", address(tMON));
        console.log("tUSDC :", address(tUSDC));
        console.log("tWETH :", address(tWETH));

        // ─── 2. DEX 배포 ───────────────────────────────────────
        console.log("Deploying SimpleSwap...");
        SimpleSwap swap = new SimpleSwap();
        console.log("SimpleSwap:", address(swap));

        // ─── 3. Arena 배포 ─────────────────────────────────────
        console.log("Deploying AgentArena...");
        AgentArena arena = new AgentArena(address(swap), AgentArena.SettlementMode.REPORTED);
        console.log("AgentArena:", address(arena));

        // ─── 4. BettingPool 배포 ───────────────────────────────
        console.log("Deploying BettingPool...");
        BettingPool betting = new BettingPool(address(arena));
        console.log("BettingPool:", address(betting));
        arena.setBettingPool(address(betting));

        // ─── 5. 토큰 설정 ──────────────────────────────────────
        address[] memory tradeTokens = new address[](2);
        tradeTokens[0] = address(tMON);
        tradeTokens[1] = address(tWETH);
        arena.setTokens(address(tUSDC), tradeTokens);

        // ─── 6. 페어 생성 ──────────────────────────────────────
        console.log("Creating pairs...");
        uint256 pid1 = swap.createPair(address(tMON),  address(tUSDC));
        uint256 pid2 = swap.createPair(address(tWETH), address(tUSDC));
        uint256 pid3 = swap.createPair(address(tMON),  address(tWETH));
        console.log("Pair tMON/tUSDC  id:", pid1);
        console.log("Pair tWETH/tUSDC id:", pid2);
        console.log("Pair tMON/tWETH  id:", pid3);

        // ─── 7. 유동성 공급 ────────────────────────────────────
        console.log("Adding liquidity...");
        tMON.mint(deployer,  LIQUIDITY_MON_USDC_MON + LIQUIDITY_MON_WETH_MON);
        tUSDC.mint(deployer, LIQUIDITY_MON_USDC_USDC + LIQUIDITY_WETH_USDC_USDC);
        tWETH.mint(deployer, LIQUIDITY_WETH_USDC_WETH + LIQUIDITY_MON_WETH_WETH);

        tMON.approve(address(swap),  type(uint256).max);
        tUSDC.approve(address(swap), type(uint256).max);
        tWETH.approve(address(swap), type(uint256).max);

        swap.addLiquidity(address(tMON),  address(tUSDC), LIQUIDITY_MON_USDC_MON,   LIQUIDITY_MON_USDC_USDC);
        swap.addLiquidity(address(tWETH), address(tUSDC), LIQUIDITY_WETH_USDC_WETH, LIQUIDITY_WETH_USDC_USDC);
        swap.addLiquidity(address(tMON),  address(tWETH), LIQUIDITY_MON_WETH_MON,   LIQUIDITY_MON_WETH_WETH);
        console.log("Liquidity added successfully");

        // ─── 8. 에이전트 등록 + 초기 토큰 지급 ────────────────
        console.log("Registering agents...");
        arena.registerAgent(agent1Addr, "Claude");
        arena.registerAgent(agent2Addr, "GPT");
        arena.registerAgent(agent3Addr, "Gemini");

        // 에이전트 초기 자산 지급
        tUSDC.mint(agent1Addr, AGENT_USDC_AMOUNT);
        tUSDC.mint(agent2Addr, AGENT_USDC_AMOUNT);
        tUSDC.mint(agent3Addr, AGENT_USDC_AMOUNT);

        tMON.mint(agent1Addr,  AGENT_MON_AMOUNT);
        tMON.mint(agent2Addr,  AGENT_MON_AMOUNT);
        tMON.mint(agent3Addr,  AGENT_MON_AMOUNT);

        tWETH.mint(agent1Addr, AGENT_WETH_AMOUNT);
        tWETH.mint(agent2Addr, AGENT_WETH_AMOUNT);
        tWETH.mint(agent3Addr, AGENT_WETH_AMOUNT);

        console.log("Agent1 (Claude):", agent1Addr);
        console.log("Agent2 (GPT):", agent2Addr);
        console.log("Agent3 (Gemini):", agent3Addr);

        // ─── 9. BettingPool 초기화 ─────────────────────────────
        betting.resetPool();

        vm.stopBroadcast();

        // ─── 배포 요약 출력 ────────────────────────────────────
        console.log("\n=== DEPLOYMENT COMPLETE ===");
        console.log("SWAP_CONTRACT=", address(swap));
        console.log("ARENA_CONTRACT=", address(arena));
        console.log("BETTING_CONTRACT=", address(betting));
        console.log("TOKEN_MON=", address(tMON));
        console.log("TOKEN_USDC=", address(tUSDC));
        console.log("TOKEN_WETH=", address(tWETH));
        console.log("===========================\n");

        // 배포 주소를 파일로 저장
        string memory deploymentKey = "deployment";
        vm.serializeAddress(deploymentKey, "SWAP_CONTRACT", address(swap));
        vm.serializeAddress(deploymentKey, "ARENA_CONTRACT", address(arena));
        vm.serializeAddress(deploymentKey, "BETTING_CONTRACT", address(betting));
        vm.serializeAddress(deploymentKey, "TOKEN_MON", address(tMON));
        vm.serializeAddress(deploymentKey, "TOKEN_USDC", address(tUSDC));
        string memory json = vm.serializeAddress(deploymentKey, "TOKEN_WETH", address(tWETH));
        string memory outputPath = string.concat(vm.projectRoot(), "/deployments.json");
        vm.writeJson(json, outputPath);
        console.log("Deployment addresses saved to deployments.json");
    }
}
