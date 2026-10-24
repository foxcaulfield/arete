#!/usr/bin/env bash
# scripts/launch-prod-pg.sh
# Full Docker prod launch with Postgres.
#   ./scripts/launch-prod-pg.sh               incremental build, detached, waits for boot
#   ./scripts/launch-prod-pg.sh --fresh       --no-cache build (slow, ~90s)
#   ./scripts/launch-prod-pg.sh --foreground  stream logs (Ctrl+C stops containers)

set -euo pipefail

FRESH=0
FOREGROUND=0
for arg in "$@"; do
    case "$arg" in
        --fresh)      FRESH=1 ;;
        --foreground) FOREGROUND=1 ;;
    esac
done

# 1. Ensure Postgres schema is on disk
if ! head -20 prisma/schema.prisma | grep -q 'provider   = "postgresql"'; then
    echo "▶ Schema is not Postgres-flavored — switching…"
    npm run db:use:postgres
fi

# 2. Stop existing containers
echo "▶ Stopping existing containers…"
docker compose down --remove-orphans || true

# 3. Fresh build if requested
if [ "$FRESH" -eq 1 ]; then
    echo "▶ Building image (--no-cache)…"
    docker compose build --no-cache
else
    echo "▶ Building image (incremental)…"
    docker compose build
fi

# 4. Foreground mode — stream logs, Ctrl+C stops everything
if [ "$FOREGROUND" -eq 1 ]; then
    echo "▶ Starting containers (foreground, Ctrl+C to stop)…"
    docker compose up
    exit 0
fi

# 5. Detached mode
echo "▶ Starting containers (detached)…"
docker compose up -d

# 6. Wait for backend readiness
echo "▶ Waiting for backend to become ready…"
READY=0
for i in $(seq 1 30); do
    if docker compose logs backend 2>/dev/null | grep -q "Nest application successfully started"; then
        READY=1
        break
    fi
    sleep 1
done

PORT=$(grep -E '^APPLICATION_PORT=' .env | cut -d= -f2 | tr -d '[:space:]')
PORT=${PORT:-3000}

if [ "$READY" -eq 1 ]; then
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo "  Prod stack running:"
    echo "    SPA:     http://localhost:${PORT}/app"
    echo "    Health:  http://localhost:${PORT}/health"
    echo ""
    echo "  Logs:    npm run dev:logs"
    echo "  Stop:    docker compose down"
    echo "═══════════════════════════════════════════════════════════════"
else
    echo "❌ Backend did not become ready in 30s"
    docker compose logs backend --tail=50
    exit 1
fi