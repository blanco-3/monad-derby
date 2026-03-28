// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./TestToken.sol";

/// @title SimpleSwap — Uniswap V2 간소화 AMM
/// @notice x*y=k 공식 기반. 3개 페어 지원.
contract SimpleSwap {
    // ─── 페어 구조체 ───────────────────────────────────────────
    struct Pair {
        address token0;
        address token1;
        uint256 reserve0;
        uint256 reserve1;
        uint256 totalShares; // LP 지분
        mapping(address => uint256) shares;
    }

    // ─── 상태 변수 ─────────────────────────────────────────────
    mapping(bytes32 => uint256) public pairIndex; // pairKey → index (1-based)
    Pair[] private pairs; // pairs[0] = 더미 (1-based 인덱싱)

    uint256 private constant FEE_NUMERATOR = 997;
    uint256 private constant FEE_DENOMINATOR = 1000;

    // ─── 이벤트 ────────────────────────────────────────────────
    event PairCreated(address indexed token0, address indexed token1, uint256 pairId);
    event LiquidityAdded(address indexed provider, uint256 indexed pairId, uint256 amount0, uint256 amount1, uint256 shares);
    event LiquidityRemoved(address indexed provider, uint256 indexed pairId, uint256 amount0, uint256 amount1);
    event Swap(address indexed trader, uint256 indexed pairId, address tokenIn, uint256 amountIn, uint256 amountOut);

    constructor() {
        // 더미 페어 (인덱스 0 점유)
        pairs.push();
    }

    // ─── 페어 생성 ─────────────────────────────────────────────
    /// @notice 토큰 페어 생성. 이미 있으면 기존 ID 반환.
    function createPair(address tokenA, address tokenB) external returns (uint256 pairId) {
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        bytes32 key = keccak256(abi.encodePacked(token0, token1));
        if (pairIndex[key] != 0) return pairIndex[key];

        pairs.push();
        pairId = pairs.length - 1;
        Pair storage p = pairs[pairId];
        p.token0 = token0;
        p.token1 = token1;
        pairIndex[key] = pairId;

        emit PairCreated(token0, token1, pairId);
    }

    // ─── 유동성 공급 ───────────────────────────────────────────
    /// @notice 토큰 페어에 유동성 공급. 토큰 사전 approve 필요.
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountA,
        uint256 amountB
    ) external returns (uint256 shares) {
        uint256 pid = _getPairId(tokenA, tokenB);
        Pair storage p = pairs[pid];

        (uint256 amount0, uint256 amount1) = tokenA == p.token0
            ? (amountA, amountB)
            : (amountB, amountA);

        TestToken(p.token0).transferFrom(msg.sender, address(this), amount0);
        TestToken(p.token1).transferFrom(msg.sender, address(this), amount1);

        if (p.totalShares == 0) {
            shares = _sqrt(amount0 * amount1);
        } else {
            uint256 s0 = (amount0 * p.totalShares) / p.reserve0;
            uint256 s1 = (amount1 * p.totalShares) / p.reserve1;
            shares = s0 < s1 ? s0 : s1;
        }
        require(shares > 0, "SimpleSwap: insufficient liquidity minted");

        p.reserve0 += amount0;
        p.reserve1 += amount1;
        p.totalShares += shares;
        p.shares[msg.sender] += shares;

        emit LiquidityAdded(msg.sender, pid, amount0, amount1, shares);
    }

    // ─── 유동성 제거 ───────────────────────────────────────────
    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 shares
    ) external returns (uint256 amount0Out, uint256 amount1Out) {
        uint256 pid = _getPairId(tokenA, tokenB);
        Pair storage p = pairs[pid];

        require(p.shares[msg.sender] >= shares, "SimpleSwap: insufficient shares");

        amount0Out = (shares * p.reserve0) / p.totalShares;
        amount1Out = (shares * p.reserve1) / p.totalShares;

        p.shares[msg.sender] -= shares;
        p.totalShares -= shares;
        p.reserve0 -= amount0Out;
        p.reserve1 -= amount1Out;

        TestToken(p.token0).transfer(msg.sender, amount0Out);
        TestToken(p.token1).transfer(msg.sender, amount1Out);

        emit LiquidityRemoved(msg.sender, pid, amount0Out, amount1Out);
    }

    // ─── 스왑 ──────────────────────────────────────────────────
    /// @notice tokenIn → tokenOut 스왑. 0.3% 수수료 적용.
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address to
    ) external returns (uint256 amountOut) {
        uint256 pid = _getPairId(tokenIn, tokenOut);
        Pair storage p = pairs[pid];

        amountOut = getAmountOut(tokenIn, tokenOut, amountIn);
        require(amountOut >= minAmountOut, "SimpleSwap: slippage exceeded");

        TestToken(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        TestToken(tokenOut).transfer(to, amountOut);

        // 리저브 업데이트
        if (tokenIn == p.token0) {
            p.reserve0 += amountIn;
            p.reserve1 -= amountOut;
        } else {
            p.reserve1 += amountIn;
            p.reserve0 -= amountOut;
        }

        emit Swap(msg.sender, pid, tokenIn, amountIn, amountOut);
    }

    // ─── 뷰 함수 ───────────────────────────────────────────────
    /// @notice 스왑 예상 수량 계산 (0.3% 수수료 반영)
    function getAmountOut(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) public view returns (uint256 amountOut) {
        uint256 pid = _getPairId(tokenIn, tokenOut);
        Pair storage p = pairs[pid];

        (uint256 reserveIn, uint256 reserveOut) = tokenIn == p.token0
            ? (p.reserve0, p.reserve1)
            : (p.reserve1, p.reserve0);

        require(reserveIn > 0 && reserveOut > 0, "SimpleSwap: no liquidity");

        uint256 amountInWithFee = amountIn * FEE_NUMERATOR;
        amountOut = (amountInWithFee * reserveOut) / (reserveIn * FEE_DENOMINATOR + amountInWithFee);
    }

    /// @notice 페어 리저브 조회
    function getReserves(address tokenA, address tokenB)
        external
        view
        returns (uint256 reserveA, uint256 reserveB)
    {
        uint256 pid = _getPairId(tokenA, tokenB);
        Pair storage p = pairs[pid];
        (reserveA, reserveB) = tokenA == p.token0
            ? (p.reserve0, p.reserve1)
            : (p.reserve1, p.reserve0);
    }

    /// @notice 토큰 가격 (tokenB 기준 tokenA 1개 가격, 18 decimals)
    function getPrice(address tokenA, address tokenB) external view returns (uint256 price) {
        uint256 pid = _getPairId(tokenA, tokenB);
        Pair storage p = pairs[pid];
        if (p.reserve0 == 0 || p.reserve1 == 0) return 0;

        (uint256 rA, uint256 rB) = tokenA == p.token0
            ? (p.reserve0, p.reserve1)
            : (p.reserve1, p.reserve0);

        price = (rB * 1e18) / rA;
    }

    function getPairId(address tokenA, address tokenB) external view returns (uint256) {
        return _getPairId(tokenA, tokenB);
    }

    function getPairCount() external view returns (uint256) {
        return pairs.length - 1;
    }

    function getLpShares(address tokenA, address tokenB, address provider)
        external view returns (uint256)
    {
        uint256 pid = _getPairId(tokenA, tokenB);
        return pairs[pid].shares[provider];
    }

    // ─── 내부 헬퍼 ─────────────────────────────────────────────
    function _getPairId(address tokenA, address tokenB) internal view returns (uint256) {
        (address t0, address t1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        bytes32 key = keccak256(abi.encodePacked(t0, t1));
        uint256 pid = pairIndex[key];
        require(pid != 0, "SimpleSwap: pair does not exist");
        return pid;
    }

    function _sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}
