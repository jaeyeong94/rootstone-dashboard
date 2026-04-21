#!/usr/bin/env bash

set -euo pipefail

ROUTE="${1:?usage: run-cron-route.sh <route>}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

read_env_value() {
  local key="${1:?key is required}"
  local env_file="${ROOT_DIR}/.env"

  [[ -f "${env_file}" ]] || return 1

  python3 - "${env_file}" "${key}" <<'PY'
import pathlib
import sys

env_path = pathlib.Path(sys.argv[1])
target = sys.argv[2]

for raw_line in env_path.read_text().splitlines():
    line = raw_line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue

    key, value = line.split("=", 1)
    if key.strip() != target:
        continue

    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
        value = value[1:-1]

    print(value)
    raise SystemExit(0)

raise SystemExit(1)
PY
}

if [[ -z "${PORT:-}" ]] && port_value="$(read_env_value PORT 2>/dev/null)"; then
  PORT="${port_value}"
fi

if [[ -z "${CRON_SECRET:-}" ]] && cron_secret_value="$(read_env_value CRON_SECRET 2>/dev/null)"; then
  CRON_SECRET="${cron_secret_value}"
fi

PORT="${PORT:-3000}"
: "${CRON_SECRET:?CRON_SECRET is required}"

curl --fail --silent --show-error \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "http://127.0.0.1:${PORT}/api/cron/${ROUTE}"
