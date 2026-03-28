# MonadDerby — Monad Blitz Seoul 4th Hackathon Project

## 프로젝트 한줄 요약
AI 모델(Claude/GPT/Gemini)이 Monad 온체인 DEX에서 실시간 트레이딩 대결을 벌이고, 관객이 승자를 예측하며 베팅하는 온체인 경마장.

## 왜 이 프로젝트인가 — Monad 특징과의 연결
1. **Parallel Execution** → 3개 AI 에이전트 + N명 베터의 트랜잭션이 서로 다른 상태를 건드려 같은 블록에서 병렬 처리됨. 이게 없으면 순차 병목 발생.
2. **400ms Block / 800ms Finality** → 에이전트가 매 블록마다 거래 판단, 2분 라운드에 300블록·900+tx. 실시간 배당률 갱신이 핵심 UX.
3. **Full EVM Compatibility** → Uniswap V2 fork + ethers.js + Hardhat/Foundry 그대로 사용. 해커톤 5.5시간 안에 구현 가능한 이유.

## 핵심 스펙

### 에이전트
- 기본 3마리: Claude, GPT, Gemini
- 각 에이전트는 AgentConfig 인터페이스를 구현 → 추가 시 config만 등록
- **데모 모드**: 사전 정의 모의 전략 (momentum / mean-reversion / arbitrage)
- **프로덕션 모드**: 실제 AI API 호출 (시장 데이터 전달 → 매매 판단 JSON 응답)

### 레이스
- 단판 승부, 2분(120초) 라운드
- 라운드 시작 → 에이전트 자동 거래 → 라운드 종료 → PnL 기준 순위 → 베팅 정산
- 향후 확장: 단거리(1분)/장거리(5분), 토너먼트 모드

### 베팅
- **실시간 베팅**: 경기 중 언제든 가능
- **AMM 기반 배당률**: x·y=k 공식, 베팅 몰리면 배당률 하락
- 라운드 종료 시 자동 정산 (승리 에이전트 베터에게 비례 분배)

## 기술 스택
- **Smart Contracts**: Solidity, Foundry (compile/test/deploy)
- **Chain**: Monad Testnet (EVM compatible, 400ms blocks)
- **Agent Engine**: TypeScript, Node.js, ethers.js v6
- **Frontend**: React 18 + Vite + TailwindCSS
- **Charts**: Recharts (실시간 PnL 라인 차트)
- **WebSocket**: Monad RPC WebSocket으로 블록/이벤트 구독

## 디렉토리 구조 (목표)
```
monad-derby/
├── contracts/           # Solidity 스마트 컨트랙트
│   ├── src/
│   │   ├── SimpleSwap.sol        # Uniswap V2 fork AMM
│   │   ├── AgentArena.sol        # 라운드 관리, PnL 계산
│   │   └── BettingPool.sol       # AMM 예측 시장, 자동 정산
│   ├── test/
│   ├── script/                   # 배포 스크립트
│   └── foundry.toml
├── agent-engine/        # AI 에이전트 런타임
│   ├── src/
│   │   ├── agents/
│   │   │   ├── AgentConfig.ts    # 에이전트 인터페이스
│   │   │   ├── MockMomentum.ts   # 모의: 모멘텀 전략
│   │   │   ├── MockMeanRev.ts    # 모의: 평균회귀 전략
│   │   │   ├── MockArbitrage.ts  # 모의: 차익거래 전략
│   │   │   └── AIAgent.ts        # 프로덕션: 실제 API 호출
│   │   ├── engine/
│   │   │   ├── RoundManager.ts   # 라운드 시작/종료 관리
│   │   │   ├── MarketDataFeed.ts # 온체인 가격 데이터 수집
│   │   │   └── TxExecutor.ts     # 트랜잭션 전송/관리
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
├── frontend/            # React 대시보드
│   ├── src/
│   │   ├── components/
│   │   │   ├── BattleView.tsx    # 메인 배틀 화면
│   │   │   ├── PnLChart.tsx      # 실시간 PnL 라인 차트
│   │   │   ├── TxFeed.tsx        # 트랜잭션 스트림 피드
│   │   │   ├── BetPanel.tsx      # 베팅 UI + 배당률 표시
│   │   │   ├── AgentCard.tsx     # 에이전트 상태 카드
│   │   │   ├── Countdown.tsx     # 라운드 타이머
│   │   │   └── RaceControl.tsx   # Start/Stop 버튼
│   │   ├── hooks/
│   │   │   ├── useMonadWs.ts     # WebSocket 블록 구독
│   │   │   ├── useAgentPnL.ts    # 에이전트 PnL 추적
│   │   │   └── useBettingOdds.ts # 실시간 배당률
│   │   ├── lib/
│   │   │   └── contracts.ts      # 컨트랙트 ABI/주소
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
└── README.md
```

## 스마트 컨트랙트 상세

### SimpleSwap.sol
- Uniswap V2 core의 간소화 버전
- createPair(), addLiquidity(), swap() 핵심 함수만 구현
- 3개 테스트 토큰: tMON, tUSDC, tWETH
- 3개 페어: tMON/tUSDC, tWETH/tUSDC, tMON/tWETH
- 초기 유동성은 배포 스크립트에서 자동 공급

### AgentArena.sol
- startRound(uint256 duration) → 라운드 시작, 타이머 설정
- 에이전트 등록: registerAgent(address agentWallet, string name)
- endRound() → 각 에이전트 지갑의 총 자산 가치 계산 → PnL 순위
- 이벤트: RoundStarted, TradeExecuted, RoundEnded(winner)

### BettingPool.sol
- AMM 기반 예측 시장 (각 에이전트별 outcome 토큰)
- placeBet(uint256 agentIndex) payable → outcome 토큰 발행, 배당률 자동 조정
- getOdds(uint256 agentIndex) view → 현재 배당률 반환
- settle(uint256 winnerIndex) → 승리 토큰 홀더에게 풀 비례 분배
- 배당률 공식: odds_i = totalPool / pool_i (단순화된 AMM)

## 에이전트 전략 상세

### 모의 전략 (데모용)
1. **MockMomentum (Claude 역할)**: 최근 5블록 가격 변화율 > 0이면 매수, < 0이면 매도. 공격적.
2. **MockMeanRev (GPT 역할)**: 20블록 이동평균 대비 2% 이상 괴리 시 역방향 거래. 보수적.
3. **MockArbitrage (Gemini 역할)**: 3개 페어 간 삼각 차익 탐지 → 수익 기회 시 연쇄 스왑. 정밀.

### AI API 인터페이스 (프로덕션용)
```typescript
interface AgentConfig {
  name: string;           // "Claude" | "GPT" | "Gemini"
  walletKey: string;      // 에이전트 전용 지갑 private key
  strategy: "mock" | "ai";
  aiConfig?: {
    provider: "anthropic" | "openai" | "google";
    model: string;
    apiKey: string;
  };
  tradeInterval: number;  // ms, 기본 400 (매 블록)
}
```

## 프론트엔드 UX 핵심

### 레이아웃
- 상단: 라운드 타이머 카운트다운 + Start Race 버튼
- 중앙 좌측(60%): PnL 실시간 라인 차트 (3개 라인, 에이전트별 색상)
- 중앙 우측(40%): 에이전트 카드 3장 (이름, 현재 PnL, 최근 거래, 전략 설명)
- 하단 좌측: TX 피드 (스크롤되는 트랜잭션 로그, 초당 수십 건)
- 하단 우측: 베팅 패널 (에이전트 선택 → 금액 입력 → Bet 버튼 + 실시간 배당률)

### 색상 테마
- Claude: 보라 (#7F77DD)
- GPT: 녹색 (#1D9E75)
- Gemini: 앰버 (#EF9F27)
- 배경: 다크 테마 기반 (경마장/아레나 분위기)

## 데모 시나리오 (발표 5분)
1. [0:00-0:30] 프로젝트 소개 — "AI 모델들의 온체인 트레이딩 경마장"
2. [0:30-1:00] 아키텍처 설명 — 모나드 3대 특징이 왜 필수인지
3. [1:00-3:00] 라이브 데모 — Start Race → 2분 라운드 실행
   - 에이전트 3마리가 동시에 거래 시작
   - TX 피드에서 병렬 처리 확인
   - 관객/심사위원이 직접 베팅 참여 (QR코드 또는 URL 공유)
   - 배당률 실시간 변동 확인
4. [3:00-3:30] 라운드 종료 → 승자 발표 → 베팅 자동 정산
5. [3:30-5:00] 기술 깊이 — AI API 아키텍처, 확장 계획 (토너먼트, 단거리/장거리)

## 코딩 컨벤션
- Solidity: 0.8.20+, MIT license, NatSpec 주석
- TypeScript: strict mode, ESM, async/await
- React: 함수형 컴포넌트, hooks, TailwindCSS utility classes
- 에러 처리: try/catch 필수, 사용자에게 의미 있는 에러 메시지
- 가스 최적화: 해커톤이므로 가독성 우선, 극단적 최적화 불필요
