# Rootstone Dashboard - Technical Architecture

## 1. Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 15 (App Router) |
| **Styling** | Tailwind CSS 4 + CSS Variables |
| **UI Components** | shadcn/ui (다크 테마 커스텀) |
| **Charts** | Lightweight Charts (TradingView) or Recharts |
| **State** | Zustand (client state) + SWR (server state) |
| **Auth** | NextAuth.js + Credentials Provider (ID/PW) |
| **DB** | SQLite (better-sqlite3) → 추후 PostgreSQL 전환 가능 |
| **ORM** | Drizzle ORM |
| **WebSocket** | Bybit WebSocket API (서버 프록시) |
| **Deploy** | Vercel |
| **Language** | TypeScript |

### 왜 이 선택인가

- **NextAuth.js + Credentials**: ID/PW 로그인에 가장 간단. JWT 세션으로 Vercel 서버리스 호환.
- **SQLite**: 소수 사용자(~10명 이하) 관리엔 충분. Vercel에서도 Turso/LibSQL 등으로 서버리스 SQLite 사용 가능. PostgreSQL 없이 빠르게 시작.
- **Drizzle ORM**: 가볍고 타입 세이프. SQLite/PostgreSQL 양쪽 지원.
- **Zustand**: WebSocket 실시간 데이터의 글로벌 스토어로 적합. Redux 대비 보일러플레이트 최소.
- **shadcn/ui**: Tailwind 기반, 다크 테마 커스터마이징 자유도 높음.

---

## 2. Project Structure

```
rootstone-dashboard/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── (auth)/               # Auth group
│   │   │   └── login/
│   │   │       └── page.tsx
│   │   ├── (dashboard)/          # Protected dashboard group
│   │   │   ├── layout.tsx        # Sidebar + Header layout
│   │   │   ├── page.tsx          # Overview (메인)
│   │   │   ├── positions/
│   │   │   │   └── page.tsx
│   │   │   ├── history/
│   │   │   │   └── page.tsx
│   │   │   ├── strategy/
│   │   │   │   └── page.tsx
│   │   │   └── settings/
│   │   │       └── page.tsx
│   │   ├── api/                  # API Routes
│   │   │   ├── auth/
│   │   │   │   └── [...nextauth]/
│   │   │   │       └── route.ts
│   │   │   ├── bybit/
│   │   │   │   ├── balance/
│   │   │   │   │   └── route.ts
│   │   │   │   ├── positions/
│   │   │   │   │   └── route.ts
│   │   │   │   ├── executions/
│   │   │   │   │   └── route.ts
│   │   │   │   ├── pnl/
│   │   │   │   │   └── route.ts
│   │   │   │   └── equity-curve/
│   │   │   │       └── route.ts
│   │   │   ├── ws/
│   │   │   │   └── route.ts      # WebSocket proxy endpoint
│   │   │   └── admin/
│   │   │       └── users/
│   │   │           └── route.ts
│   │   ├── layout.tsx            # Root layout
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                   # shadcn/ui components
│   │   ├── dashboard/
│   │   │   ├── BalanceCard.tsx
│   │   │   ├── PositionCard.tsx
│   │   │   ├── EquityCurve.tsx
│   │   │   ├── MetricsGrid.tsx
│   │   │   ├── LiveIndicator.tsx
│   │   │   └── TradeTable.tsx
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   └── MobileNav.tsx
│   │   └── auth/
│   │       └── LoginForm.tsx
│   ├── lib/
│   │   ├── bybit/
│   │   │   ├── client.ts         # Bybit REST API client
│   │   │   ├── websocket.ts      # Bybit WebSocket manager
│   │   │   ├── types.ts          # Bybit API types
│   │   │   └── signing.ts        # HMAC signing for private endpoints
│   │   ├── db/
│   │   │   ├── schema.ts         # Drizzle schema
│   │   │   ├── index.ts          # DB connection
│   │   │   └── seed.ts           # Initial admin user seed
│   │   ├── auth.ts               # NextAuth config
│   │   └── utils.ts              # Shared utilities
│   ├── stores/
│   │   ├── useTickerStore.ts     # 실시간 가격 데이터
│   │   ├── usePositionStore.ts   # 실시간 포지션 데이터
│   │   └── useConnectionStore.ts # WebSocket 연결 상태
│   ├── hooks/
│   │   ├── useBybitWebSocket.ts  # WebSocket 연결 hook
│   │   ├── useBalanceChange.ts   # 밸런스 증감률 계산
│   │   └── useEquityCurve.ts     # 에쿼티 커브 데이터
│   └── types/
│       └── index.ts
├── drizzle/
│   └── migrations/               # DB migrations
├── docs/
│   ├── PRD.md
│   └── ARCHITECTURE.md
├── ref/
│   └── Rebeta_Strategy_Introduction_260215.pdf
├── public/
│   └── rootstone-logo.svg
├── .env.local                    # API keys (git-ignored)
├── drizzle.config.ts
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 3. Data Flow Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        Client (Browser)                  │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ Zustand   │  │ SWR      │  │ Recharts/│              │
│  │ Stores    │  │ Cache    │  │ LW Charts│              │
│  │ (realtime)│  │ (REST)   │  │          │              │
│  └─────┬────┘  └─────┬────┘  └──────────┘              │
│        │              │                                  │
│  ┌─────┴──────────────┴─────┐                           │
│  │     WebSocket Client      │                           │
│  │     (reconnect logic)     │                           │
│  └─────────────┬────────────┘                           │
└────────────────┼────────────────────────────────────────┘
                 │
    ┌────────────┼────────────────────┐
    │        Next.js Server           │
    │                                 │
    │  ┌──────────────────────────┐   │
    │  │   API Routes             │   │
    │  │   /api/bybit/*           │   │
    │  │   /api/auth/*            │   │
    │  │   /api/admin/*           │   │
    │  └──────────┬───────────────┘   │
    │             │                   │
    │  ┌──────────┴───────────────┐   │
    │  │  Bybit Client (server)   │   │
    │  │  - REST API calls        │   │
    │  │  - HMAC signing          │   │
    │  │  - WebSocket relay       │   │
    │  └──────────┬───────────────┘   │
    │             │                   │
    │  ┌──────────┴───────────────┐   │
    │  │  SQLite (Drizzle ORM)    │   │
    │  │  - Users                 │   │
    │  │  - Sessions              │   │
    │  │  - Cached PnL history    │   │
    │  └──────────────────────────┘   │
    └─────────────────────────────────┘
                 │
    ┌────────────┴────────────────────┐
    │         Bybit API               │
    │  REST: api.bybit.com            │
    │  WS:   stream.bybit.com        │
    └─────────────────────────────────┘
```

---

## 4. Authentication Flow

```
1. User → POST /api/auth/signin (credentials)
2. NextAuth validates against DB (bcrypt hash)
3. JWT token issued (HttpOnly cookie)
4. Middleware checks JWT on all (dashboard) routes
5. Unauthorized → redirect to /login
```

### DB Schema (Users)

```typescript
// drizzle schema
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),         // nanoid
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['admin', 'viewer'] }).default('viewer'),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});
```

---

## 5. WebSocket Architecture

### 문제
Vercel은 서버리스 환경이라 persistent WebSocket 서버를 직접 운영할 수 없음.

### 해결 방안

**Option A: Client-Direct WebSocket (Recommended for MVP)**
- 클라이언트에서 Bybit Public WebSocket에 직접 연결 (가격 데이터)
- Private 데이터(포지션/체결)는 REST API polling (5초 간격)
- API Key 노출 없이 실시간 가격 틱 가능

```
Client ──── WS ────→ stream.bybit.com (public: tickers)
Client ──── REST ──→ /api/bybit/* (private: positions, balance)
                         │
                         └──→ Bybit REST API (server-side, signed)
```

**Option B: External WebSocket Server (Phase 2)**
- 별도 Node.js WebSocket 서버 (AWS EC2 or Railway)
- Bybit Private WebSocket 연결 유지
- 클라이언트에 릴레이

### MVP 구현 (Option A)

```typescript
// Client: Bybit Public WebSocket
const ws = new WebSocket('wss://stream.bybit.com/v5/public/linear');
ws.send(JSON.stringify({
  op: 'subscribe',
  args: ['tickers.BTCUSDT', 'tickers.ETHUSDT', 'tickers.XRPUSDT', 'tickers.LTCUSDT']
}));

// Server: REST API polling for private data
// /api/bybit/positions → polled every 5s by SWR
```

---

## 6. Bybit API Integration

### API Signing (HMAC-SHA256)

```typescript
// lib/bybit/signing.ts
function createSignature(
  timestamp: string,
  apiKey: string,
  recvWindow: string,
  queryString: string,
  secretKey: string
): string {
  const paramStr = timestamp + apiKey + recvWindow + queryString;
  return crypto.createHmac('sha256', secretKey).update(paramStr).digest('hex');
}
```

### Rate Limits
- REST: 120 requests/min per endpoint
- WebSocket: 500 subscriptions per connection

### Error Handling
- Bybit retCode !== 0 → 에러 핸들링
- API key 만료/무효 → 관리자 알림
- Rate limit 도달 → exponential backoff

---

## 7. Design System

> rootstone.io 웹사이트 + PDF 브로셔 하이브리드.
> 웹사이트 톤을 베이스로, 데이터 하이라이트에 PDF의 골드 액센트 활용.

### Color Tokens

```css
:root {
  /* ROOTSTONE Brand - Website Base */
  --bg-primary: #0F0F0F;      /* 메인 배경 (순수 블랙) */
  --bg-card: #161616;          /* 카드/서피스 배경 */
  --bg-elevated: #1C1C1C;      /* 호버/활성 서피스 */
  --border: #333333;           /* 기본 보더 */
  --border-subtle: #222222;    /* 미세한 구분선 */

  /* Accent Colors - Hybrid */
  --bronze: #997B66;           /* 주 액센트 (웹사이트 기준) */
  --bronze-light: #B09580;     /* 호버 상태 */
  --gold: #C5A049;             /* 데이터 하이라이트 (PDF 기준) */
  --gold-light: #D4B86A;       /* 골드 호버 */

  /* Semantic - Data */
  --pnl-positive: #C5A049;     /* 수익 = 골드 */
  --pnl-negative: #EF4444;     /* 손실 = 레드 */
  --status-live: #10B981;      /* 연결됨 = 그린 */
  --status-warn: #F59E0B;      /* 재연결 중 = 옐로 */
  --status-error: #EF4444;     /* 끊김 = 레드 */

  /* Text */
  --text-primary: #FFFFFF;
  --text-secondary: #888888;
  --text-muted: rgba(255, 255, 255, 0.4);
  --text-dim: #333333;
}
```

### Typography (rootstone.io 기준)

| 용도 | 폰트 | 사이즈 | 굵기 | 비고 |
|------|-------|--------|------|------|
| 대형 헤딩 | **Manrope** | 48-80px | 400 | 히어로, 큰 숫자 |
| 소형 헤딩 | **Manrope** | 20-32px | 500 | 섹션 타이틀 |
| 본문 | **Inter** | 14-16px | 400 | 일반 텍스트 |
| 네비게이션 | **Inter** | 13px | 400 | UPPERCASE + letter-spacing: 1px |
| 카테고리 라벨 | **Inter** | 11-12px | 500 | UPPERCASE + bronze 컬러 |
| 숫자/데이터 | **JetBrains Mono** | 14-48px | 500 | PnL, 가격, 지표 |

### Component Patterns

**카드**
```
bg-[#161616] border border-[#333333] rounded-none (or rounded-sm)
```
- 웹사이트는 둥근 모서리 거의 없음 (sharp, minimal)

**버튼 (Corner Bracket Style)**
```
/* rootstone.io의 CTA 스타일 - 코너만 보이는 bracket */
상단좌 + 하단우 모서리에만 border, 나머지는 투명
```

**네비게이션**
```
UPPERCASE + letter-spacing: 1px + font-size: 13px
활성 메뉴: --bronze 컬러 적용
```

**데이터 표시**
- 수익: `--gold` (#C5A049) 컬러
- 손실: `--pnl-negative` (#EF4444) 컬러
- 숫자 변화: CSS transition (200ms ease)
- Live pulse: `--status-live` 그린 dot + animate-pulse

**전반적 톤**
- Ultra-minimal, 장식 최소화
- 정보 밀도보다 여백 우선
- 큰 숫자 + 작은 라벨 패턴 (웹사이트 stats 섹션 참고)

---

## 8. Key Technical Decisions

| 결정 | 이유 |
|------|------|
| SQLite over PostgreSQL | 소수 사용자, 외부 DB 의존 제거, Vercel 호환 (Turso) |
| Client WS + Server REST | Vercel 서버리스 제약, Public WS는 key 불필요 |
| NextAuth Credentials | 소셜 로그인 불필요, ID/PW만 필요 |
| Zustand over Context | WebSocket 고빈도 업데이트에 적합 (렌더링 최적화) |
| shadcn/ui | 디자인 토큰 커스텀 자유도, Tailwind 네이티브 |

---

## 9. Environment Variables

```env
# .env.local
NEXTAUTH_SECRET=<random-secret>
NEXTAUTH_URL=http://localhost:3000

# Bybit API (Read-only)
BYBIT_API_KEY=<your-api-key>
BYBIT_API_SECRET=<your-api-secret>

# Database
DATABASE_URL=file:./db.sqlite
```

---

## 10. Deployment (Vercel)

### 제약사항
- 서버리스 함수 실행 시간 제한 (10초, Pro: 60초)
- Persistent WebSocket 서버 불가 → Client-direct 방식 채택
- SQLite → Turso (LibSQL) 사용으로 서버리스 호환

### Build & Deploy
```bash
# Local development
pnpm dev

# Build
pnpm build

# Vercel deployment
vercel --prod
```

### Vercel 설정
- Framework: Next.js (자동 감지)
- Node.js: 20.x
- Environment Variables: Vercel Dashboard에서 설정
- Edge Functions: 미사용 (Node.js runtime)
