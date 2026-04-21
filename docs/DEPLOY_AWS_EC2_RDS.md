# AWS EC2 + RDS Deployment

이 문서는 `rootstone-dashboard`를 `Vercel + Neon` 대신 `AWS EC2 + AWS RDS(PostgreSQL)`에 올리기 위한 현재 기준 배포 문서다.

## 변경 원칙

- 제품 로직과 API contract는 유지한다.
- Next.js 앱은 EC2에서 `standalone` 산출물로 실행한다.
- DB는 `DATABASE_URL` 기반 PostgreSQL 연결로 통일한다.
- 기존 Vercel cron 스케줄은 EC2 `systemd timer`로 대체한다.

## 1. 필수 환경변수

배포 서버의 `/home/ubuntu/rootstone-dashboard/.env` 파일에 아래 값을 채운다.

```bash
cp .env.example .env
```

필수 값:

- `BYBIT_API_KEY`
- `BYBIT_API_SECRET`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `DATABASE_URL`
- `CRON_SECRET`

예시:

```env
NODE_ENV=production
PORT=3000
NEXTAUTH_URL=https://dashboard.example.com
DATABASE_URL=postgresql://rootstone:change-me@rootstone-db.ap-northeast-2.rds.amazonaws.com:5432/rootstone?sslmode=verify-full&sslrootcert=/home/ubuntu/rootstone-dashboard/certs/global-bundle.pem
```

## 2. RDS 준비

- RDS 엔진은 PostgreSQL로 생성한다.
- EC2와 같은 VPC 또는 허용된 보안 그룹에 둔다.
- RDS 보안 그룹 inbound 에서 EC2 보안 그룹의 `5432` 접근을 허용한다.
- 운영에서는 퍼블릭 오픈 대신 EC2만 허용한다.

## 3. EC2 배포 절차

이 문서와 배포 유닛은 `/home/ubuntu/rootstone-dashboard` 기준이다.

```bash
pnpm install --frozen-lockfile
pnpm db:push
pnpm build:standalone
```

실행 파일:

- 앱 서버: `.next/standalone/server.js`
- 정적 파일 포함 위치: `.next/standalone/public`, `.next/standalone/.next/static`

## 4. systemd 앱 서비스

기본 유닛 파일:

- `deploy/systemd/rootstone-dashboard.service`

설치 전 아래 값을 환경에 맞게 수정한다.

- `User`
- `WorkingDirectory`
- `EnvironmentFile`
- Node 경로는 `/home/ubuntu/.nvm/nvm.sh` 기준이다.

설치:

```bash
sudo cp deploy/systemd/rootstone-dashboard.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now rootstone-dashboard
sudo systemctl status rootstone-dashboard
```

## 5. cron 대체

기존 Vercel cron 스케줄은 아래 systemd timer 로 옮겼다.

- `snapshot` -> `00:00 UTC`
- `daily-nav` -> `00:05 UTC`
- `margin-util` -> `00:15 UTC`
- `update-benchmarks` -> `00:30 UTC`

관련 파일:

- `deploy/scripts/run-cron-route.sh`
- `deploy/systemd/rootstone-dashboard-snapshot.service`
- `deploy/systemd/rootstone-dashboard-snapshot.timer`
- `deploy/systemd/rootstone-dashboard-daily-nav.service`
- `deploy/systemd/rootstone-dashboard-daily-nav.timer`
- `deploy/systemd/rootstone-dashboard-margin-util.service`
- `deploy/systemd/rootstone-dashboard-margin-util.timer`
- `deploy/systemd/rootstone-dashboard-update-benchmarks.service`
- `deploy/systemd/rootstone-dashboard-update-benchmarks.timer`

설치:

```bash
sudo cp deploy/systemd/rootstone-dashboard-*.service /etc/systemd/system/
sudo cp deploy/systemd/rootstone-dashboard-*.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now rootstone-dashboard-snapshot.timer
sudo systemctl enable --now rootstone-dashboard-daily-nav.timer
sudo systemctl enable --now rootstone-dashboard-margin-util.timer
sudo systemctl enable --now rootstone-dashboard-update-benchmarks.timer
sudo systemctl list-timers | grep rootstone-dashboard
```

## 6. Nginx 리버스 프록시

예시 설정:

- `deploy/nginx/rootstone-dashboard.conf`

적용 후 `dashboard.example.com` 과 TLS 설정은 실제 도메인에 맞게 붙인다.

## 7. GitHub Actions CI/CD

워크플로우 파일:

- `.github/workflows/ci-cd.yml`

동작:

- `pull_request -> main`: `lint`, `test:run`, `build:standalone`
- `push -> main`: 위 검증 후 `lp` 서버에 자동 배포

필수 GitHub Secrets:

- `LP_HOST`
- `LP_USER`
- `LP_SSH_KEY`
- `LP_KNOWN_HOSTS`
- `LP_ENV_FILE`

배포 단계:

- 서버에 저장소가 없으면 `git@github.com:<owner>/<repo>.git` 으로 최초 clone
- `/tmp/rootstone-dashboard.env` 를 `/home/ubuntu/rootstone-dashboard/.env` 로 설치
- `certs/global-bundle.pem` 를 AWS truststore 에서 다시 내려받기
- `pnpm install --frozen-lockfile`
- `pnpm db:push`
- `pnpm build:standalone`
- `systemd` 서비스와 타이머 재설치
- `/login`, `/dashboard`, `/api/cron/snapshot` smoke check

## 8. 운영 체크리스트

- `.env` 가 배포 경로에 존재하는지
- `DATABASE_URL` 이 RDS 를 가리키는지
- `pnpm db:push` 가 성공했는지
- `systemctl status rootstone-dashboard` 가 `active (running)` 인지
- `/api/cron/*` 엔드포인트가 `CRON_SECRET` 없이 호출되지 않는지
- 타이머 3개가 모두 등록됐는지
