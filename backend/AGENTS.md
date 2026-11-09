# Backend

FastAPI app run with uvicorn, Python 3.14, managed with uv.

## Structure

- `app/main.py` - FastAPI app, routes and dependencies. Creates tables on startup (lifespan). Each request gets one SQLite connection in one transaction (`get_conn`: commit on success, rollback on error). `board.NotFoundError` maps to 404.
  - `GET /api/health` returns `{"status": "ok"}`.
  - Auth: `POST /api/login` (JSON `username`, `password`, hardcoded `user` / `password`) creates the user's board on first login and stores the username in a signed session cookie (`SessionMiddleware`, secret from `SESSION_SECRET`, local default); `POST /api/logout` clears it; `GET /api/me` returns `{"username"}` or 401.
  - Board (session required, scoped to the user's board, all return the full board): `GET /api/board`, `PATCH /api/columns/{id}` (`title`), `POST /api/cards` (`column_id`, `title`, `details`; 201), `PATCH /api/cards/{id}` (`title?`, `details?`), `POST /api/cards/{id}/move` (`column_id`, `position`), `DELETE /api/cards/{id}`.
  - Static files from `STATIC_DIR` (default `static/`) are mounted at `/` after API routes.
- `app/db.py` - SQLite path from `DB_PATH` (default `data/kanban.db`, `/app/data/kanban.db` in the container), `connect()` (foreign keys on), `init_db()`, `get_or_create_board()` (seeds 5 empty columns). Schema matches `docs/schema.json`, see `docs/DATABASE.md`.
- `app/board.py` - board service functions (`get_board`, `rename_column`, `create_card`, `update_card`, `move_card`, `delete_card`). They keep card positions contiguous and raise `NotFoundError` for ids outside the board. Used by routes and later by AI operations.
- `app/models.py` - Pydantic request/response models. Titles are stripped and must be non-empty.
- `static/` - Next.js static export, copied in by the Dockerfile (gitignored).
- `tests/` - pytest tests using FastAPI `TestClient`. `conftest.py` gives every test a fresh temp database and `client` / `auth_client` fixtures.

## Commands

- `uv sync` - install dependencies
- `uv run pytest` - run tests with coverage (fails below 80%)
- `uv run uvicorn app.main:app --reload` - run locally on port 8000
