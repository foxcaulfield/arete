# Arete 🏛️

A flashcard-style learning app for mastering vocabulary through spaced repetition.

**🔗 Live Demo:** https://arete-gtbb.onrender.com/ui

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your database credentials

# Run migrations
npx prisma migrate dev

# Start development server
npm run start:dev
```

## Docker

```bash
# Start with Docker Compose
docker-compose up --build

# Stop
docker-compose down
```

> ⚠️ For Docker, ensure `.env` has `DATABASE_URL` using `db` as host (not `localhost`).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run start:dev` | Development with hot reload |
| `npm run build` | Build for production |
| `npm run start:prod` | Run production build |
| `npm run release` | Interactive release helper |
| `npm run lint` | Lint and fix code |
| `npm run test` | Run tests |

## Release Workflow

This project uses [semantic-release](https://semantic-release.gitbook.io/) with GitHub Actions.

```bash
npm run release
```

| Branch | Release Type | Example Version |
|--------|--------------|-----------------|
| `develop` | Beta | `1.5.0-beta.1` |
| `release/*` | RC | `1.5.0-rc.1` |
| `main` | Stable | `1.5.0` |

**Commit format matters!** Use [Conventional Commits](https://www.conventionalcommits.org/):
- `feat: add new feature` → minor bump
- `fix: resolve bug` → patch bump
- `feat!: breaking change` → major bump

## Tech Stack

- **Backend:** NestJS, Prisma, PostgreSQL
- **Frontend:** Nunjucks, HTMX, Alpine.js, Pico CSS
- **Auth:** Better Auth

## License

**Proprietary** - Commercial use requires a paid license. See [LICENSE](LICENSE) for details.