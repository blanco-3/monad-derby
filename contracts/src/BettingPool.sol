// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./AgentArena.sol";

/// @title BettingPool — AMM 기반 예측 시장 베팅 컨트랙트
/// @notice 라운드별로 네이티브 토큰 베팅을 관리하고, 종료 후 우승 에이전트 베터에게 분배한다.
contract BettingPool {
    struct BetInfo {
        uint256 roundId;
        uint256 agentIndex;
        uint256 amount;
        bool claimed;
    }

    struct RoundPool {
        uint256[] agentPools;
        uint256 totalPool;
        bool settled;
        uint256 winnerIndex;
        bool feeWithdrawn;
    }

    AgentArena public immutable arena;
    address public owner;

    uint256 public activeRoundId;
    uint256 public latestSettledRoundId;

    mapping(uint256 => RoundPool) private roundPools;
    mapping(address => BetInfo[]) private userBets;

    uint256 public constant FEE_BPS = 300;

    event BetPlaced(address indexed bettor, uint256 indexed roundId, uint256 indexed agentIndex, uint256 amount);
    event Settled(uint256 indexed roundId, uint256 indexed winnerIndex, uint256 totalPool);
    event WinningsClaimed(address indexed bettor, uint256 amount);
    event PoolReset(uint256 indexed roundId, uint256 agentCount);

    modifier onlyOwner() {
        require(msg.sender == owner, "BettingPool: not owner");
        _;
    }

    modifier onlyArena() {
        require(msg.sender == address(arena), "BettingPool: not arena");
        _;
    }

    constructor(address _arena) {
        arena = AgentArena(_arena);
        owner = msg.sender;
    }

    /// @notice 새 라운드 시작 전 풀 리셋. 다음 arena roundId를 기준으로 활성화한다.
    function resetPool() external onlyOwner {
        if (activeRoundId != 0) {
            require(roundPools[activeRoundId].settled, "BettingPool: previous round not settled");
        }

        uint256 agentCount = arena.getAgentCount();
        require(agentCount > 0, "BettingPool: no agents");

        activeRoundId = arena.getRoundCount() + 1;
        RoundPool storage roundPool = roundPools[activeRoundId];
        require(roundPool.agentPools.length == 0, "BettingPool: round already initialized");

        for (uint256 i = 0; i < agentCount; i++) {
            roundPool.agentPools.push(0);
        }

        emit PoolReset(activeRoundId, agentCount);
    }

    /// @notice 활성 라운드에 베팅. 네이티브 토큰(MON) 전송.
    function placeBet(uint256 agentIndex) external payable {
        require(activeRoundId != 0, "BettingPool: no active round");
        RoundPool storage roundPool = roundPools[activeRoundId];
        require(!roundPool.settled, "BettingPool: round settled");
        require(agentIndex < roundPool.agentPools.length, "BettingPool: invalid agent");
        require(msg.value > 0, "BettingPool: no value");

        roundPool.agentPools[agentIndex] += msg.value;
        roundPool.totalPool += msg.value;

        userBets[msg.sender].push(BetInfo({
            roundId: activeRoundId,
            agentIndex: agentIndex,
            amount: msg.value,
            claimed: false
        }));

        emit BetPlaced(msg.sender, activeRoundId, agentIndex, msg.value);
    }

    /// @notice 활성 라운드 배당률 = totalPool * 1e18 / agentPool
    function getOdds(uint256 agentIndex) external view returns (uint256 odds) {
        return _getOdds(activeRoundId, agentIndex);
    }

    function getAllOdds() external view returns (uint256[] memory odds) {
        RoundPool storage roundPool = roundPools[activeRoundId];
        odds = new uint256[](roundPool.agentPools.length);

        for (uint256 i = 0; i < roundPool.agentPools.length; i++) {
            if (roundPool.agentPools[i] > 0) {
                odds[i] = (roundPool.totalPool * 1e18) / roundPool.agentPools[i];
            }
        }
    }

    function getAgentShare(uint256 agentIndex) external view returns (uint256) {
        RoundPool storage roundPool = roundPools[activeRoundId];
        require(agentIndex < roundPool.agentPools.length, "BettingPool: invalid agent");
        if (roundPool.totalPool == 0) return 0;
        return (roundPool.agentPools[agentIndex] * 1e18) / roundPool.totalPool;
    }

    /// @notice arena가 라운드 종료 후 우승자 인덱스를 확정한다.
    function settle(uint256 _winnerIndex) external onlyArena {
        uint256 roundId = arena.getRoundCount();
        require(roundId == activeRoundId, "BettingPool: round mismatch");

        RoundPool storage roundPool = roundPools[roundId];
        require(!roundPool.settled, "BettingPool: already settled");
        require(_winnerIndex < roundPool.agentPools.length, "BettingPool: invalid winner");

        roundPool.settled = true;
        roundPool.winnerIndex = _winnerIndex;
        latestSettledRoundId = roundId;

        emit Settled(roundId, _winnerIndex, roundPool.totalPool);
    }

    /// @notice 모든 정산된 라운드에 대해 청구 가능한 금액을 인출한다.
    function claimWinnings() external returns (uint256 totalClaim) {
        BetInfo[] storage bets = userBets[msg.sender];

        for (uint256 i = 0; i < bets.length; i++) {
            BetInfo storage bet = bets[i];
            if (bet.claimed) continue;

            RoundPool storage roundPool = roundPools[bet.roundId];
            if (!roundPool.settled || bet.agentIndex != roundPool.winnerIndex) continue;

            uint256 winnerPool = roundPool.agentPools[roundPool.winnerIndex];
            if (winnerPool == 0) continue;

            uint256 distributable = roundPool.totalPool - _fee(roundPool.totalPool);
            totalClaim += (bet.amount * distributable) / winnerPool;
            bet.claimed = true;
        }

        require(totalClaim > 0, "BettingPool: nothing to claim");

        (bool ok,) = msg.sender.call{value: totalClaim}("");
        require(ok, "BettingPool: transfer failed");

        emit WinningsClaimed(msg.sender, totalClaim);
    }

    function getUserBets(address user) external view returns (BetInfo[] memory) {
        return userBets[user];
    }

    function getUserPendingClaim(address user) external view returns (uint256 totalClaim) {
        BetInfo[] storage bets = userBets[user];

        for (uint256 i = 0; i < bets.length; i++) {
            BetInfo storage bet = bets[i];
            if (bet.claimed) continue;

            RoundPool storage roundPool = roundPools[bet.roundId];
            if (!roundPool.settled || bet.agentIndex != roundPool.winnerIndex) continue;

            uint256 winnerPool = roundPool.agentPools[roundPool.winnerIndex];
            if (winnerPool == 0) continue;

            uint256 distributable = roundPool.totalPool - _fee(roundPool.totalPool);
            totalClaim += (bet.amount * distributable) / winnerPool;
        }
    }

    function getPoolInfo() external view returns (
        uint256 roundId,
        uint256[] memory pools,
        uint256 total,
        bool isSettled,
        uint256 winner
    ) {
        RoundPool storage roundPool = roundPools[activeRoundId];
        return (activeRoundId, roundPool.agentPools, roundPool.totalPool, roundPool.settled, roundPool.winnerIndex);
    }

    function agentPools(uint256 agentIndex) external view returns (uint256) {
        RoundPool storage roundPool = roundPools[activeRoundId];
        require(agentIndex < roundPool.agentPools.length, "BettingPool: invalid agent");
        return roundPool.agentPools[agentIndex];
    }

    function totalPool() external view returns (uint256) {
        return roundPools[activeRoundId].totalPool;
    }

    function settled() external view returns (bool) {
        return roundPools[activeRoundId].settled;
    }

    function winnerIndex() external view returns (uint256) {
        return roundPools[activeRoundId].winnerIndex;
    }

    function settledRoundId() external view returns (uint256) {
        return latestSettledRoundId;
    }

    /// @notice 정산되지 않은 수수료를 모두 수령한다.
    function withdrawFees() external onlyOwner {
        uint256 totalFees;

        for (uint256 roundId = 1; roundId <= latestSettledRoundId; roundId++) {
            RoundPool storage roundPool = roundPools[roundId];
            if (!roundPool.settled || roundPool.feeWithdrawn) continue;
            totalFees += _fee(roundPool.totalPool);
            roundPool.feeWithdrawn = true;
        }

        require(totalFees > 0, "BettingPool: no fees");

        (bool ok,) = owner.call{value: totalFees}("");
        require(ok, "BettingPool: transfer failed");
    }

    function _getOdds(uint256 roundId, uint256 agentIndex) internal view returns (uint256 odds) {
        RoundPool storage roundPool = roundPools[roundId];
        require(agentIndex < roundPool.agentPools.length, "BettingPool: invalid agent");
        if (roundPool.agentPools[agentIndex] == 0) return 0;
        odds = (roundPool.totalPool * 1e18) / roundPool.agentPools[agentIndex];
    }

    function _fee(uint256 amount) internal pure returns (uint256) {
        return (amount * FEE_BPS) / 10_000;
    }

    receive() external payable {}
}
