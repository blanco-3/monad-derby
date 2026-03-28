// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./SimpleSwap.sol";
import "./TestToken.sol";

interface IBettingPool {
    function settle(uint256 winnerIndex) external;
}

/// @title AgentArena — 라운드 관리 + PnL 계산
/// @notice AI 에이전트들의 트레이딩 대결 라운드를 관리한다.
contract AgentArena {
    enum SettlementMode {
        PORTFOLIO,
        REPORTED
    }

    // ─── 구조체 ────────────────────────────────────────────────
    struct Agent {
        address wallet;
        string name;
        bool registered;
    }

    struct Round {
        uint256 id;
        uint256 startTime;
        uint256 endTime;
        uint256 duration;
        SettlementMode settlementMode;
        bool active;
        bool ended;
        address winner;
        string winnerName;
        int256[] finalPnLs; // basis points (1% = 100)
        bytes32 proofHash;
    }

    // ─── 상태 변수 ─────────────────────────────────────────────
    SimpleSwap public immutable swap;
    address public owner;
    address public bettingPool;
    SettlementMode public settlementMode;

    Agent[] public agents;
    Round[] public rounds;
    uint256 public currentRoundId;

    // 에이전트 초기 자산 스냅샷 (라운드 시작 시 기록)
    // roundId => agentIndex => initialValueUSDC (6 decimals 기준 USDC)
    mapping(uint256 => mapping(uint256 => uint256)) public initialValues;

    // 기준 토큰 (USDC 역할)
    address public baseToken;
    // 거래 토큰들
    address[] public tradeTokens;

    // ─── 이벤트 ────────────────────────────────────────────────
    event AgentRegistered(address indexed wallet, string name, uint256 agentIndex);
    event BettingPoolUpdated(address indexed bettingPoolAddress);
    event SettlementModeUpdated(SettlementMode indexed mode);
    event RoundStarted(uint256 indexed roundId, uint256 duration, uint256 startTime);
    event RoundResultReported(uint256 indexed roundId, uint256 indexed winnerIndex, bytes32 proofHash);
    event TradeExecuted(uint256 indexed roundId, address indexed agent, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut);
    event RoundEnded(uint256 indexed roundId, address indexed winner, string winnerName, int256[] finalPnLs);

    // ─── 모디파이어 ────────────────────────────────────────────
    modifier onlyOwner() {
        require(msg.sender == owner, "AgentArena: not owner");
        _;
    }

    modifier roundActive() {
        require(currentRoundId > 0, "AgentArena: no round");
        require(rounds[currentRoundId - 1].active, "AgentArena: round not active");
        _;
    }

    // ─── 생성자 ────────────────────────────────────────────────
    constructor(address _swap, SettlementMode _settlementMode) {
        swap = SimpleSwap(_swap);
        owner = msg.sender;
        settlementMode = _settlementMode;
    }

    // ─── 설정 ──────────────────────────────────────────────────
    /// @notice 기준 토큰(USDC)과 거래 토큰 목록 세팅
    function setTokens(address _baseToken, address[] calldata _tradeTokens) external onlyOwner {
        baseToken = _baseToken;
        delete tradeTokens;
        for (uint256 i = 0; i < _tradeTokens.length; i++) {
            tradeTokens.push(_tradeTokens[i]);
        }
    }

    /// @notice 베팅 풀 컨트랙트 연결. 라운드 진행 중에는 변경 불가.
    function setBettingPool(address _bettingPool) external onlyOwner {
        if (currentRoundId > 0) {
            require(!rounds[currentRoundId - 1].active, "AgentArena: round still active");
        }
        bettingPool = _bettingPool;
        emit BettingPoolUpdated(_bettingPool);
    }

    /// @notice 신규 라운드 기본 정산 모드 변경. 라운드 진행 중에는 변경 불가.
    function setSettlementMode(SettlementMode _settlementMode) external onlyOwner {
        if (currentRoundId > 0) {
            require(!rounds[currentRoundId - 1].active, "AgentArena: round still active");
        }
        settlementMode = _settlementMode;
        emit SettlementModeUpdated(_settlementMode);
    }

    // ─── 에이전트 등록 ─────────────────────────────────────────
    /// @notice 에이전트 지갑 주소와 이름 등록
    function registerAgent(address wallet, string calldata name) external onlyOwner returns (uint256) {
        for (uint256 i = 0; i < agents.length; i++) {
            require(agents[i].wallet != wallet, "AgentArena: already registered");
        }
        uint256 idx = agents.length;
        agents.push(Agent({wallet: wallet, name: name, registered: true}));
        emit AgentRegistered(wallet, name, idx);
        return idx;
    }

    // ─── 라운드 시작 ───────────────────────────────────────────
    /// @notice 새 라운드 시작. 이전 라운드가 종료된 상태여야 함.
    /// @param durationSeconds 라운드 지속 시간 (기본 120초)
    function startRound(uint256 durationSeconds) external onlyOwner returns (uint256 roundId) {
        require(agents.length > 0, "AgentArena: no agents");
        if (currentRoundId > 0) {
            require(!rounds[currentRoundId - 1].active, "AgentArena: round still active");
        }

        roundId = rounds.length + 1;
        currentRoundId = roundId;

        rounds.push(Round({
            id: roundId,
            startTime: block.timestamp,
            endTime: block.timestamp + durationSeconds,
            duration: durationSeconds,
            settlementMode: settlementMode,
            active: true,
            ended: false,
            winner: address(0),
            winnerName: "",
            finalPnLs: new int256[](agents.length),
            proofHash: bytes32(0)
        }));

        // 에이전트별 초기 자산 스냅샷
        if (settlementMode == SettlementMode.PORTFOLIO) {
            for (uint256 i = 0; i < agents.length; i++) {
                initialValues[roundId][i] = _getPortfolioValue(agents[i].wallet);
            }
        }

        emit RoundStarted(roundId, durationSeconds, block.timestamp);
    }

    // ─── 라운드 종료 ───────────────────────────────────────────
    /// @notice 라운드 종료. 타이머 만료 후 호출 가능.
    function endRound() external returns (address winner, string memory winnerName) {
        require(currentRoundId > 0, "AgentArena: no round");
        Round storage r = rounds[currentRoundId - 1];
        require(r.active, "AgentArena: not active");
        require(r.settlementMode == SettlementMode.PORTFOLIO, "AgentArena: use reported settlement");
        require(block.timestamp >= r.endTime || msg.sender == owner, "AgentArena: too early");

        r.active = false;
        r.ended = true;

        int256 bestPnL = type(int256).min;
        uint256 winnerIdx = 0;

        for (uint256 i = 0; i < agents.length; i++) {
            int256 pnl = getCurrentPnL(currentRoundId, i);
            r.finalPnLs[i] = pnl;
            if (pnl > bestPnL) {
                bestPnL = pnl;
                winnerIdx = i;
            }
        }

        r.winner = agents[winnerIdx].wallet;
        r.winnerName = agents[winnerIdx].name;

        if (bettingPool != address(0)) {
            IBettingPool(bettingPool).settle(winnerIdx);
        }

        emit RoundEnded(currentRoundId, r.winner, r.winnerName, r.finalPnLs);
        return (r.winner, r.winnerName);
    }

    /// @notice 오프체인 레이스 결과를 owner가 제출해 라운드를 종료한다.
    function finalizeReportedRound(
        int256[] calldata finalPnLsBps,
        uint256 winnerIdx,
        bytes32 proofHash
    ) external onlyOwner returns (address winner, string memory winnerName) {
        require(currentRoundId > 0, "AgentArena: no round");
        Round storage r = rounds[currentRoundId - 1];
        require(r.active, "AgentArena: not active");
        require(r.settlementMode == SettlementMode.REPORTED, "AgentArena: portfolio settlement round");
        require(finalPnLsBps.length == agents.length, "AgentArena: invalid pnl length");
        require(winnerIdx < agents.length, "AgentArena: invalid winner");

        r.active = false;
        r.ended = true;
        r.winner = agents[winnerIdx].wallet;
        r.winnerName = agents[winnerIdx].name;
        r.proofHash = proofHash;

        for (uint256 i = 0; i < agents.length; i++) {
            r.finalPnLs[i] = finalPnLsBps[i];
        }

        if (bettingPool != address(0)) {
            IBettingPool(bettingPool).settle(winnerIdx);
        }

        emit RoundResultReported(currentRoundId, winnerIdx, proofHash);
        emit RoundEnded(currentRoundId, r.winner, r.winnerName, r.finalPnLs);
        return (r.winner, r.winnerName);
    }

    // ─── PnL 조회 ──────────────────────────────────────────────
    /// @notice 특정 라운드에서 에이전트의 현재 PnL (basis points, 100 = 1%)
    function getCurrentPnL(uint256 roundId, uint256 agentIndex) public view returns (int256) {
        Round storage round = rounds[roundId - 1];
        if (round.settlementMode == SettlementMode.REPORTED) {
            if (!round.ended) return 0;
            return round.finalPnLs[agentIndex];
        }

        uint256 initialValue = initialValues[roundId][agentIndex];
        if (initialValue == 0) return 0;

        uint256 currentValue = _getPortfolioValue(agents[agentIndex].wallet);
        int256 diff = int256(currentValue) - int256(initialValue);
        return (diff * 10000) / int256(initialValue);
    }

    /// @notice 현재 라운드 기준 에이전트 주소의 PnL 조회
    function getCurrentPnL(address agentWallet) external view returns (int256) {
        if (currentRoundId == 0) return 0;
        uint256 agentIndex = _getAgentIndex(agentWallet);
        return getCurrentPnL(currentRoundId, agentIndex);
    }

    /// @notice 현재 라운드 모든 에이전트 PnL 조회
    function getAllCurrentPnLs() external view returns (int256[] memory pnls) {
        pnls = new int256[](agents.length);
        if (currentRoundId == 0) return pnls;
        for (uint256 i = 0; i < agents.length; i++) {
            pnls[i] = getCurrentPnL(currentRoundId, i);
        }
    }

    /// @notice 에이전트 포트폴리오 총 가치 (baseToken 단위)
    function getPortfolioValue(address agentWallet) external view returns (uint256) {
        return _getPortfolioValue(agentWallet);
    }

    // ─── 뷰 헬퍼 ───────────────────────────────────────────────
    function getAgentCount() external view returns (uint256) {
        return agents.length;
    }

    function getRoundCount() external view returns (uint256) {
        return rounds.length;
    }

    function getCurrentRound() external view returns (
        uint256 id,
        uint256 startTime,
        uint256 endTime,
        bool active,
        bool ended,
        address winner,
        string memory winnerName
    ) {
        if (currentRoundId == 0) return (0, 0, 0, false, false, address(0), "");
        Round storage r = rounds[currentRoundId - 1];
        return (r.id, r.startTime, r.endTime, r.active, r.ended, r.winner, r.winnerName);
    }

    function getFinalPnLs(uint256 roundId) external view returns (int256[] memory) {
        return rounds[roundId - 1].finalPnLs;
    }

    // ─── 내부 함수 ─────────────────────────────────────────────
    /// @notice 에이전트 지갑의 총 자산 가치를 baseToken 환산으로 계산
    function _getPortfolioValue(address wallet) internal view returns (uint256 total) {
        // 기준 토큰 잔고
        if (baseToken != address(0)) {
            total += TestToken(baseToken).balanceOf(wallet);
        }

        // 각 거래 토큰을 기준 토큰으로 환산
        for (uint256 i = 0; i < tradeTokens.length; i++) {
            address t = tradeTokens[i];
            uint256 bal = TestToken(t).balanceOf(wallet);
            if (bal == 0) continue;
            try swap.getAmountOut(t, baseToken, bal) returns (uint256 value) {
                total += value;
            } catch {
                // 페어 없거나 유동성 없는 경우 스킵
            }
        }
    }

    function _getAgentIndex(address agentWallet) internal view returns (uint256 agentIndex) {
        for (uint256 i = 0; i < agents.length; i++) {
            if (agents[i].wallet == agentWallet) {
                return i;
            }
        }
        revert("AgentArena: agent not found");
    }
}
