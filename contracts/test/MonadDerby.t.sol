// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/TestToken.sol";
import "../src/SimpleSwap.sol";
import "../src/AgentArena.sol";
import "../src/BettingPool.sol";

contract MonadDerbyTest is Test {
    receive() external payable {} // ETH 수신 (withdrawFees 테스트용)
    TestToken tMON;
    TestToken tUSDC;
    TestToken tWETH;
    SimpleSwap swap;
    AgentArena arena;
    BettingPool betting;

    address owner = address(this);
    address agent1 = makeAddr("agent1"); // Claude
    address agent2 = makeAddr("agent2"); // GPT
    address agent3 = makeAddr("agent3"); // Gemini
    address bettor1 = makeAddr("bettor1");
    address bettor2 = makeAddr("bettor2");

    uint256 constant INITIAL_SUPPLY = 1_000_000 ether;
    uint256 constant ROUND_DURATION = 120;

    function setUp() public {
        // 토큰 배포
        tMON  = new TestToken("Test MON",  "tMON");
        tUSDC = new TestToken("Test USDC", "tUSDC");
        tWETH = new TestToken("Test WETH", "tWETH");

        // DEX 배포
        swap = new SimpleSwap();

        // Arena 배포
        arena = new AgentArena(address(swap), AgentArena.SettlementMode.PORTFOLIO);

        // BettingPool 배포
        betting = new BettingPool(address(arena));
        arena.setBettingPool(address(betting));

        // 토큰 주소 세팅
        address[] memory tradeTokens = new address[](2);
        tradeTokens[0] = address(tMON);
        tradeTokens[1] = address(tWETH);
        arena.setTokens(address(tUSDC), tradeTokens);

        // 페어 생성
        swap.createPair(address(tMON),  address(tUSDC));
        swap.createPair(address(tWETH), address(tUSDC));
        swap.createPair(address(tMON),  address(tWETH));

        // 유동성 공급자 토큰 발행
        tMON.mint(owner,  INITIAL_SUPPLY);
        tUSDC.mint(owner, INITIAL_SUPPLY);
        tWETH.mint(owner, INITIAL_SUPPLY);

        // 각 페어에 유동성 공급
        tMON.approve(address(swap),  type(uint256).max);
        tUSDC.approve(address(swap), type(uint256).max);
        tWETH.approve(address(swap), type(uint256).max);

        swap.addLiquidity(address(tMON),  address(tUSDC), 100_000 ether, 100_000 ether);
        swap.addLiquidity(address(tWETH), address(tUSDC), 50_000 ether,  100_000 ether);
        swap.addLiquidity(address(tMON),  address(tWETH), 100_000 ether, 50_000 ether);

        // 에이전트 토큰 초기 지급
        tUSDC.mint(agent1, 10_000 ether);
        tUSDC.mint(agent2, 10_000 ether);
        tUSDC.mint(agent3, 10_000 ether);
        tMON.mint(agent1, 1_000 ether);
        tMON.mint(agent2, 1_000 ether);
        tMON.mint(agent3, 1_000 ether);

        // 에이전트 등록
        arena.registerAgent(agent1, "Claude");
        arena.registerAgent(agent2, "GPT");
        arena.registerAgent(agent3, "Gemini");

        // BettingPool 초기화
        betting.resetPool();

        // 베터에게 ETH 지급
        vm.deal(bettor1, 10 ether);
        vm.deal(bettor2, 10 ether);
    }

    // ─── TestToken 테스트 ───────────────────────────────────────
    function test_token_mint_transfer() public {
        TestToken t = new TestToken("Test", "TST");
        t.mint(address(this), 1000 ether);
        assertEq(t.balanceOf(address(this)), 1000 ether);

        t.transfer(bettor1, 100 ether);
        assertEq(t.balanceOf(address(this)), 900 ether);
        assertEq(t.balanceOf(bettor1), 100 ether);
    }

    // ─── SimpleSwap 테스트 ─────────────────────────────────────
    function test_swap_create_pair() public {
        TestToken tA = new TestToken("A", "A");
        TestToken tB = new TestToken("B", "B");
        uint256 pid = swap.createPair(address(tA), address(tB));
        assertGt(pid, 0);
        // 이미 있으면 같은 ID 반환
        assertEq(swap.createPair(address(tA), address(tB)), pid);
    }

    function test_swap_add_liquidity() public {
        (uint256 r0, uint256 r1) = swap.getReserves(address(tMON), address(tUSDC));
        assertGt(r0, 0);
        assertGt(r1, 0);
    }

    function test_swap_get_amount_out() public view {
        uint256 out = swap.getAmountOut(address(tMON), address(tUSDC), 1 ether);
        assertGt(out, 0);
        assertLt(out, 1.1 ether); // 0.3% 수수료로 약간 적어야 함
    }

    function test_swap_execute() public {
        vm.startPrank(agent1);
        tMON.approve(address(swap), type(uint256).max);

        uint256 balBefore = tUSDC.balanceOf(agent1);
        uint256 amountOut = swap.getAmountOut(address(tMON), address(tUSDC), 100 ether);
        swap.swap(address(tMON), address(tUSDC), 100 ether, 0, agent1);
        uint256 balAfter = tUSDC.balanceOf(agent1);

        assertEq(balAfter - balBefore, amountOut);
        vm.stopPrank();
    }

    function test_swap_price() public view {
        uint256 price = swap.getPrice(address(tMON), address(tUSDC));
        // 1:1 비율로 공급했으므로 1e18에 가깝게
        assertApproxEqRel(price, 1e18, 0.01e18); // 1% 오차 허용
    }

    function test_swap_remove_liquidity() public {
        uint256 shares = swap.getLpShares(address(tMON), address(tUSDC), owner);
        assertGt(shares, 0);

        uint256 halfShares = shares / 2;
        uint256 monBefore = tMON.balanceOf(owner);
        swap.removeLiquidity(address(tMON), address(tUSDC), halfShares);
        assertGt(tMON.balanceOf(owner), monBefore);
    }

    // ─── AgentArena 테스트 ─────────────────────────────────────
    function test_arena_register_agents() public view {
        assertEq(arena.getAgentCount(), 3);
        (address wallet,,) = arena.agents(0);
        assertEq(wallet, agent1);
    }

    function test_arena_start_round() public {
        arena.startRound(ROUND_DURATION);

        (uint256 id,,, bool active,,, ) = arena.getCurrentRound();
        assertEq(id, 1);
        assertTrue(active);
    }

    function test_arena_portfolio_value() public view {
        // 에이전트1: 10,000 USDC + 1,000 MON ≈ 11,000 USDC 가치
        uint256 val = arena.getPortfolioValue(agent1);
        assertGt(val, 10_000 ether);
    }

    function test_arena_get_current_pnl_by_address() public {
        arena.startRound(ROUND_DURATION);

        vm.startPrank(agent1);
        tMON.approve(address(swap), type(uint256).max);
        swap.swap(address(tMON), address(tUSDC), 100 ether, 0, agent1);
        vm.stopPrank();

        assertEq(arena.getCurrentPnL(agent1), arena.getCurrentPnL(1, 0));
    }

    function test_arena_end_round() public {
        arena.startRound(ROUND_DURATION);

        // 에이전트1이 MON을 USDC로 스왑 (PnL 변화 시뮬레이션)
        vm.startPrank(agent1);
        tMON.approve(address(swap), type(uint256).max);
        swap.swap(address(tMON), address(tUSDC), 500 ether, 0, agent1);
        vm.stopPrank();

        // 시간 앞감기
        vm.warp(block.timestamp + ROUND_DURATION);

        (address winner,) = arena.endRound();
        assertNotEq(winner, address(0));
        assertEq(betting.settledRoundId(), 1);

        (,,, bool active, bool ended,,) = arena.getCurrentRound();
        assertFalse(active);
        assertTrue(ended);
    }

    function test_arena_finalize_reported_round() public {
        AgentArena reportedArena = new AgentArena(address(swap), AgentArena.SettlementMode.REPORTED);
        BettingPool reportedBetting = new BettingPool(address(reportedArena));
        reportedArena.setBettingPool(address(reportedBetting));

        reportedArena.registerAgent(agent1, "Claude");
        reportedArena.registerAgent(agent2, "GPT");
        reportedArena.registerAgent(agent3, "Gemini");
        reportedBetting.resetPool();

        vm.prank(bettor1);
        reportedBetting.placeBet{value: 1 ether}(0);

        reportedArena.startRound(ROUND_DURATION);

        int256[] memory pnls = new int256[](3);
        pnls[0] = 425;
        pnls[1] = 110;
        pnls[2] = -95;

        (address winner, string memory winnerName) = reportedArena.finalizeReportedRound(
            pnls,
            0,
            keccak256("reported-proof")
        );

        assertEq(winner, agent1);
        assertEq(winnerName, "Claude");
        assertEq(reportedArena.getCurrentPnL(1, 0), 425);
        assertTrue(reportedBetting.settled());
        assertEq(reportedBetting.winnerIndex(), 0);
    }

    function test_arena_pnl_calculation() public {
        arena.startRound(ROUND_DURATION);

        // 에이전트1만 거래
        vm.startPrank(agent1);
        tMON.approve(address(swap), type(uint256).max);
        // MON → USDC → MON (약간의 수수료 손실)
        swap.swap(address(tMON), address(tUSDC), 100 ether, 0, agent1);
        vm.stopPrank();

        int256 pnl1 = arena.getCurrentPnL(1, 0);
        int256 pnl2 = arena.getCurrentPnL(1, 1);
        int256 pnl3 = arena.getCurrentPnL(1, 2);

        // 에이전트1이 스왑하면 리저브 변화로 MON 가격 하락 → 에이전트2,3(MON 보유)도 소폭 변동
        // 값이 정수 범위 내에 있는지만 확인
        assertTrue(pnl1 >= -10000 && pnl1 <= 10000);
        assertTrue(pnl2 >= -10000 && pnl2 <= 10000);
        assertTrue(pnl3 >= -10000 && pnl3 <= 10000);
        // pnl2 == pnl3 (동일 초기 포트폴리오, 동일 시장 변화)
        assertEq(pnl2, pnl3);
        emit log_int(pnl1);
    }

    // ─── BettingPool 테스트 ────────────────────────────────────
    function test_betting_place_bet() public {
        vm.prank(bettor1);
        betting.placeBet{value: 1 ether}(0); // Claude에 베팅

        assertEq(betting.totalPool(), 1 ether);
        assertEq(betting.agentPools(0), 1 ether);
    }

    function test_betting_odds() public {
        // bettor1: Claude에 1 ETH, bettor2: GPT에 2 ETH
        vm.prank(bettor1);
        betting.placeBet{value: 1 ether}(0);

        vm.prank(bettor2);
        betting.placeBet{value: 2 ether}(1);

        // Claude 배당률: 3 / 1 = 3x
        assertEq(betting.getOdds(0), 3 * 1e18);
        // GPT 배당률: 3 / 2 = 1.5x
        assertEq(betting.getOdds(1), 1.5 * 1e18);
    }

    function test_betting_settle_and_claim() public {
        // 베팅
        vm.prank(bettor1);
        betting.placeBet{value: 1 ether}(0); // Claude 1 ETH
        vm.prank(bettor2);
        betting.placeBet{value: 2 ether}(1); // GPT 2 ETH

        // 라운드 시작 후 종료
        arena.startRound(ROUND_DURATION);
        vm.warp(block.timestamp + ROUND_DURATION);
        arena.endRound();

        assertTrue(betting.settled());

        // bettor1 수익 청구
        uint256 balBefore = bettor1.balance;
        vm.prank(bettor1);
        uint256 claimed = betting.claimWinnings();

        // 3 ETH 풀에서 3% 수수료 제외 = 2.91 ETH, 베터1은 전부 가져감
        assertGt(claimed, 2.9 ether);
        assertGt(bettor1.balance, balBefore);
    }

    function test_betting_claim_fails_for_loser() public {
        vm.prank(bettor1);
        betting.placeBet{value: 1 ether}(1); // GPT

        arena.startRound(ROUND_DURATION);
        vm.warp(block.timestamp + ROUND_DURATION);
        arena.endRound();

        // Claude 베터는 청구 불가
        vm.expectRevert("BettingPool: nothing to claim");
        vm.prank(bettor1);
        betting.claimWinnings();
    }

    function test_betting_reset_pool() public {
        vm.prank(bettor1);
        betting.placeBet{value: 1 ether}(0);

        arena.startRound(ROUND_DURATION);
        vm.warp(block.timestamp + ROUND_DURATION);
        arena.endRound();

        // 수수료 인출 후 리셋
        betting.withdrawFees();
        betting.resetPool();

        assertEq(betting.totalPool(), 0);
        assertFalse(betting.settled());
    }

    function test_betting_claims_across_multiple_rounds() public {
        vm.prank(bettor1);
        betting.placeBet{value: 1 ether}(0);

        arena.startRound(ROUND_DURATION);
        vm.warp(block.timestamp + ROUND_DURATION);
        arena.endRound();

        betting.resetPool();

        vm.prank(bettor1);
        betting.placeBet{value: 2 ether}(0);
        vm.prank(bettor2);
        betting.placeBet{value: 1 ether}(1);

        arena.startRound(ROUND_DURATION);
        vm.warp(block.timestamp + ROUND_DURATION);
        arena.endRound();

        uint256 pending = betting.getUserPendingClaim(bettor1);
        assertGt(pending, 0);

        uint256 beforeBalance = bettor1.balance;
        vm.prank(bettor1);
        uint256 claimed = betting.claimWinnings();

        assertEq(claimed, pending);
        assertEq(bettor1.balance, beforeBalance + pending);

        vm.expectRevert("BettingPool: nothing to claim");
        vm.prank(bettor1);
        betting.claimWinnings();
    }
}
