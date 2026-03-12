# Rootstone Dashboard - PRD (Product Requirements Document)

## 1. Overview

Rootstone의 Rebeta v3.1 크립토 퀀트 전략의 실시간 운용 현황을 투자자에게 보여주는 대시보드.
Bybit API를 통해 실제 계정 데이터를 실시간으로 시각화하여, 전략이 "살아서 움직이고 있다"는 느낌을 전달하는 것이 핵심 목표.

### 핵심 가치
- **신뢰감**: 실시간 데이터로 전략 운용의 투명성 제공
- **라이브 연출**: WebSocket 기반 실시간 포지션/가격 업데이트
- **프로페셔널**: ROOTSTONE 브랜딩 톤 유지 (다크 네이비 + 골드)
- **보안**: 민감 정보(절대 금액) 노출 최소화, 증감률 중심 표기

---

## 2. Target Users

| 유저 타입 | 설명 |
|-----------|------|
| **투자자 (고객)** | Rebeta 전략에 투자한 Qualified SMA Client. 운용 현황 모니터링 |
| **관리자** | Rootstone 내부 팀. 사용자 관리, API 설정 등 |

---

## 3. Pages & Features

### 3.1 Login Page
- ID/PW 기반 로그인
- JWT 토큰 인증
- 세션 만료 시 자동 리다이렉트
- "Powered by Rootstone" 브랜딩

### 3.2 Overview (메인 대시보드)
> 전략이 살아서 움직이고 있다는 느낌의 핵심 페이지

**밸런스 섹션**
- 현재 총 밸런스 → **절대 금액 비노출**, 이전 시간대 대비 증감률(%)만 표시
- 24h / 7d / 30d 증감률 토글
- 증감률에 따른 색상 변화 (+ 골드/그린, - 레드)

**실시간 포지션 요약**
- 현재 오픈 포지션 카드 (BTC, ETH, XRP, LTC)
- 각 포지션: 방향(Long/Short), 사이즈(%), 미실현 PnL(%), 진입가 대비 현재가 변동
- WebSocket으로 실시간 가격 틱 애니메이션
- 포지션 없을 때: "Waiting for signal..." 상태 표시

**에쿼티 커브 차트**
- Bybit 일별 PnL 데이터로 누적 수익률 차트 생성
- 기간 선택: 1M / 3M / 6M / 1Y / All
- 차트 라이브러리: Recharts 또는 Lightweight Charts
- BTC 벤치마크 오버레이 (선택적)

**핵심 지표 카드**
- 오늘 실현 PnL (%)
- 이번 주 실현 PnL (%)
- 현재 오픈 포지션 수
- 마지막 리밸런싱 시각 (1시간 주기이므로 자주 갱신)

**라이브 인디케이터**
- 마지막 데이터 수신 시각 + "Live" 펄스 애니메이션
- WebSocket 연결 상태 표시 (connected/reconnecting)

### 3.3 Positions (포지션 상세)
- 현재 오픈 포지션 상세 테이블
  - Symbol, Side, Size, Entry Price, Mark Price, Unrealized PnL(%), Leverage
- 실시간 업데이트 (WebSocket)
- 포지션별 상세 확장 (진입 시각, 홀딩 시간 등)

### 3.4 Trade History (거래 내역)
- 최근 체결 내역 테이블 (페이지네이션)
  - 일시, Symbol, Side, Size, Price, Fee, Realized PnL
- 필터: 기간 / 심볼 / 방향
- CSV 다운로드 (선택적)

### 3.5 Strategy Info (전략 소개)
- Rebeta v3.1 전략 개요 (PDF 내용 기반 정적 페이지)
- 핵심 지표: CAGR, Sharpe, Sortino, MDD
- 마켓 레짐 설명 (Core / Crisis / Challenging)
- 블랙 스완 서바이벌 이력
- 팀 소개

### 3.6 Settings (관리자)
- **사용자 관리**: 계정 생성/삭제, 비밀번호 리셋
- **API 설정**: Bybit API Key 관리 (암호화 저장)
- **대시보드 설정**: 데이터 갱신 주기, 표시 통화 등

---

## 4. 비기능 요구사항

### 보안
- API Key는 서버 사이드에서만 사용 (클라이언트 노출 금지)
- Bybit API는 Read-only 권한만 사용
- 밸런스 절대 금액 비노출 (증감률만)
- JWT + HttpOnly Cookie
- Rate limiting on API routes

### 성능
- WebSocket 재연결 자동화 (exponential backoff)
- 초기 로딩 < 2초 (SSR 활용)
- 차트 데이터 캐싱 (ISR or SWR)

### 접근성
- 반응형 (데스크톱 우선, 태블릿 지원)
- 모바일은 기본 레이아웃만 (추후 개선)

---

## 5. Bybit API Endpoints (Unified Account)

| 용도 | Endpoint | Method |
|------|----------|--------|
| 계좌 잔고 | `/v5/account/wallet-balance` | GET |
| 오픈 포지션 | `/v5/position/list` | GET |
| 거래 내역 | `/v5/execution/list` | GET |
| 손익 내역 | `/v5/position/closed-pnl` | GET |
| 일별 PnL | `/v5/account/transaction-log` | GET |
| 실시간 가격 | WebSocket `tickers.{symbol}` | WS |
| 실시간 포지션 | WebSocket `position` (Private) | WS |
| 실시간 체결 | WebSocket `execution` (Private) | WS |

---

## 6. 우선순위

### Phase 1 (MVP)
1. 로그인/인증
2. Overview 대시보드 (밸런스 증감, 포지션 요약, 핵심 지표)
3. WebSocket 실시간 가격 업데이트
4. 기본 Positions 페이지

### Phase 2
5. 에쿼티 커브 차트
6. Trade History 페이지
7. 라이브 인디케이터 + 애니메이션 폴리시

### Phase 3
8. Strategy Info 페이지
9. Settings/Admin 페이지
10. 반응형 개선
