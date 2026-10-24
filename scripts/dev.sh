#!/usr/bin/env bash
# scripts/dev.sh
# Start full local dev stack: Postgres in Docker + backend --watch + Vite.
# All output in one terminal (interleaved). Ctrl+C stops backend + frontend.

set -euo pipefail

kill_port() {
    local port=$1
    if command -v lsof >/dev/null 2>&1; then
        lsof -ti ":${port}" 2>/dev/null | xargs -r kill 2>/dev/null || true
    elif command -v fuser >/dev/null 2>&1; then
        fuser -k "${port}/tcp" 2>/dev/null || true
    fi
}

cleanup() {
    echo ""
    echo "▶ Stopping dev processes…"
    # Kill parents first — otherwise nest --watch respawns its child after the
    # child dies, then the trap finds a fresh node on :3000 and can't kill it.
    pkill -f "nest start --watch"              2>/dev/null || true
    pkill -f "vite --config front-end/vite.config" 2>/dev/null || true
    # Give processes a moment to actually exit
    sleep 0.3
    # Belt + suspenders: kill anything still bound to our ports
    kill_port 3000
    kill_port 5173
    echo "✅ Backend + frontend stopped. Postgres container still running."
    echo "   Stop it with: docker compose down"
}
trap cleanup EXIT INT TERM

if [ ! -f .env ]; then
    echo "❌ .env not found at repo root"
    exit 1
fi

echo "▶ Starting Postgres…"
docker compose up -d db

echo "▶ Waiting for Postgres to become healthy…"
for i in $(seq 1 30); do
    if docker compose ps db 2>/dev/null | grep -q "healthy"; then
        echo "✅ Postgres ready."
        break
    fi
    sleep 1
    if [ "$i" -eq 30 ]; then
        echo "❌ Postgres did not become healthy in 30s"
        docker compose logs db --tail=20
        exit 1
    fi
done

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Dev stack:"
echo "    Frontend: http://localhost:5173   ← work here (HMR)"
echo "    Backend:  http://localhost:3000"
echo "    DB:       localhost:5432 (docker)"
echo "  Ctrl+C to stop backend + frontend."
echo "═══════════════════════════════════════════════════════════════"
echo ""

npm run start:dev:db &
npm run start:dev:backend &
npm run start:dev:front &

wait