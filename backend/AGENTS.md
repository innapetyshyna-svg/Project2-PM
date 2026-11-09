# Backend

FastAPI app run with uvicorn, Python 3.14, managed with uv.

## Structure

- `app/main.py` - FastAPI app. `GET /api/health` returns `{"status": "ok"}`. Auth: `POST /api/login` (JSON `username`, `password`, hardcoded `user` / `password`) stores the username in a signed session cookie (`SessionMiddleware`, secret from `SESSION_SECRET`, local default); `POST /api/logout` clears it; `GET /api/me` returns `{"username"}` or 401. Static files from `STATIC_DIR` (default `static/`) are mounted at `/` after API routes.
- `static/` - Next.js static export, copied in by the Dockerfile (gitignored).
- `tests/` - pytest tests using FastAPI `TestClient`.

## Commands

- `uv sync` - install dependencies
- `uv run pytest` - run tests with coverage (fails below 80%)
- `uv run uvicorn app.main:app --reload` - run locally on port 8000
