# Backend

FastAPI app run with uvicorn, Python 3.14, managed with uv.

## Structure

- `app/main.py` - FastAPI app. `GET /api/health` returns `{"status": "ok"}`. Static files from `static/` are mounted at `/` (after API routes).
- `static/` - site served at `/`. Currently a placeholder `index.html` that calls `/api/health`.
- `tests/` - pytest tests using FastAPI `TestClient`.

## Commands

- `uv sync` - install dependencies
- `uv run pytest` - run tests with coverage (fails below 80%)
- `uv run uvicorn app.main:app --reload` - run locally on port 8000
