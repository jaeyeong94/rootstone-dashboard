# Rootstone Dashboard

Rebeta v3.1 크립토 퀀트 전략의 실시간 운용 대시보드.

## Tech Stack
- Next.js 15 (App Router) + TypeScript
- Tailwind CSS 4 + shadcn/ui
- NextAuth.js (Credentials / ID/PW)
- Drizzle ORM + SQLite (Turso for prod)
- Zustand (realtime state) + SWR (server state)
- Bybit API (REST, 서버사이드 프록시)
- Vercel deploy

## Design (rootstone.io + PDF Hybrid)
- 배경: #0F0F0F (순수 블랙, 웹사이트 기준)
- 주 액센트: #997B66 (브론즈, 웹사이트 기준)
- 데이터 하이라이트: #C5A049 (골드, PDF 기준) - 수익 표시에 사용
- 헤딩: Manrope 400 / 본문: Inter / 숫자: JetBrains Mono
- 네비: UPPERCASE + letter-spacing: 1px
- 버튼: Corner bracket 스타일 (모서리만 border)
- 밸런스 절대 금액 비노출, 증감률(%)만 표시
- 울트라 미니멀, 여백 우선, sharp corners

## Key Rules
- Bybit API Key는 서버 사이드에서만 사용 (클라이언트 노출 금지)
- Read-only API 권한만 사용
- 한국어 커밋 메시지 (Conventional Commits)

## Commands
```bash
pnpm dev       # 개발 서버
pnpm build     # 프로덕션 빌드
pnpm lint      # ESLint
pnpm db:push   # DB 스키마 적용
```

## Docs
- `docs/PRD.md` - 기획 문서
- `docs/ARCHITECTURE.md` - 기술 설계 문서
- `ref/Rebeta_Strategy_Introduction_260215.pdf` - 전략 소개 PDF
