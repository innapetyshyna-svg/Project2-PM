# Kanban Studio

Project management MVP: sign in, one Kanban board per user, stored in SQLite. Next.js frontend served by a FastAPI backend in one Docker container.

## Run

Requires Docker. Create `.env` in the project root:

```
OPENROUTER_API_KEY=
```

Start and stop:

- Windows: `scripts\start.ps1`, `scripts\stop.ps1`
- Mac/Linux: `scripts/start.sh`, `scripts/stop.sh`

Open http://127.0.0.1:8000 and sign in with `user` / `password`. Data is kept in `data/kanban.db`.

## Test

- Backend: `cd backend && uv run pytest`
- Frontend unit: `cd frontend && npm run test:unit`
- Frontend e2e (container must be running): `cd frontend && npm run test:e2e`

## Docs

- `docs/PLAN.md` - project plan
- `docs/DATABASE.md`, `docs/schema.json` - database
