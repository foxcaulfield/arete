#!/usr/bin/env bash
# scripts/launch-prod-sqlite.sh
# Launch a production build against local SQLite (no Docker).
# Restores Postgres on exit (Ctrl+C included).

set -euo pipefail

ORIGINAL_PROVIDER=$(grep -E '^DB_PROVIDER=' .env | cut -d= -f2 | tr -d '[:space:]' || echo "postgres")
ORIGINAL_PROVIDER=${ORIGINAL_PROVIDER:-postgres}

restore() {
    echo ""
    echo "▶ Restoring ${ORIGINAL_PROVIDER} schema…"
    if npm run "db:use:${ORIGINAL_PROVIDER}"; then
        echo "✅ Restored to ${ORIGINAL_PROVIDER}."
    else
        echo "❌ FAILED to restore. Run manually:"
        echo "   npm run db:use:${ORIGINAL_PROVIDER}"
    fi
}
trap restore EXIT INT TERM

# 1. Switch to SQLite (regenerates client + db push, creates prisma/dev.db if missing)
echo "▶ Switching to SQLite…"
npm run db:use:sqlite

# 2. Verify DB file
if [ ! -f prisma/dev.db ]; then
    echo "❌ prisma/dev.db not found after db:use:sqlite"
    exit 1
fi
SIZE=$(du -h prisma/dev.db | cut -f1)
echo "✅ SQLite ready: prisma/dev.db (${SIZE})"

# 3. Build
echo "▶ Building…"
rm -rf dist tsconfig.build.tsbuildinfo
npm run build

# 4. Start with production env (inline override wins over .env; dotenv/ConfigModule don't override existing vars)
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Prod build against SQLite:"
echo "    http://localhost:3000/app"
echo ""
echo "  NODE_ENV=production for this process only."
echo "  Ctrl+C to stop and restore ${ORIGINAL_PROVIDER}."
echo "═══════════════════════════════════════════════════════════════"
echo ""

NODE_ENV=production npm run start:prod