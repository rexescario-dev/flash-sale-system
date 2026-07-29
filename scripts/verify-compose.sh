#!/usr/bin/env bash
# Local DX helper: verify the full Docker Compose application stack contract.
# Not used by CI. Run from the repository root:
#   bash scripts/verify-compose.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

test -f .env || cp .env.example .env

echo "== Fresh full stack =="
docker compose down -v
docker compose up --build -d

echo "== Wait for api healthy =="
for i in $(seq 1 60); do
  if docker compose ps --format json 2>/dev/null | grep -q '"Health":"healthy"' \
    || docker inspect --format '{{.State.Health.Status}}' flash-sale-api 2>/dev/null | grep -qx healthy; then
    break
  fi
  sleep 2
done

echo "== Status =="
docker compose ps -a

echo "== Migrate logs (tail) =="
docker compose logs migrate --no-color | tail -40

MIGRATE_RC="$(docker inspect --format '{{.State.ExitCode}}' flash-sale-migrate)"
test "$MIGRATE_RC" = "0"

echo "== API health + GraphQL =="
curl -sf http://localhost:3000/health
echo
curl -sf http://localhost:3000/graphql -H 'content-type: application/json' \
  -d '{"query":"{ __typename }"}'
echo

echo "== Web =="
curl -sf -o /dev/null -w 'web_http=%{http_code}\n' http://localhost:5173/

echo "== Baked VITE_API_URL (built assets only) =="
docker compose exec -T web sh -c "grep -R 'localhost:3000' /app/apps/web/dist 2>/dev/null | head -5"
BAD="$(docker compose exec -T web sh -c "grep -RE 'http://api:|http://flash-sale-api' /app/apps/web/dist 2>/dev/null | head -5" || true)"
if [ -n "${BAD}" ]; then
  echo "FAIL: found Docker-DNS API URL in web dist:" >&2
  echo "${BAD}" >&2
  exit 1
fi

echo "== Naming =="
docker ps --format '{{.Names}}' | sort

echo "== Postgres/redis alone =="
docker compose down
docker compose up -d postgres redis
docker compose ps

echo "== Migrate failure gate =="
cat > /tmp/docker-compose.migrate-fail.yml <<'EOF'
services:
  migrate:
    environment:
      DATABASE_URL: postgresql://flash_sale:flash_sale_dev@invalid-host:5432/flash_sale
EOF
set +e
docker compose -f docker-compose.yml -f /tmp/docker-compose.migrate-fail.yml up --build migrate api
docker compose -f docker-compose.yml -f /tmp/docker-compose.migrate-fail.yml ps -a
set -e
docker compose -f docker-compose.yml -f /tmp/docker-compose.migrate-fail.yml down
rm -f /tmp/docker-compose.migrate-fail.yml

echo "OK: Compose verification completed (confirm migrate-fail gate output above)."
