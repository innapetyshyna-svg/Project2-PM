# Project Plan

## Decisions

- Single Docker image (Linux): multi-stage build. Node stage runs `next build` with `output: "export"`; Python stage (uv) runs FastAPI with uvicorn and serves the exported site at `/`. Port 8000.
- SQLite file in `/app/data/kanban.db`, mounted from `./data` on the host so it survives restarts. Tables are created on startup if missing; a user's default board (5 columns) is seeded on their first login.
- Auth: `POST /api/login` checks hardcoded `user` / `password` and sets a session cookie (Starlette `SessionMiddleware`, HttpOnly). `POST /api/logout` clears it. All other `/api/*` routes return 401 without a valid session.
- Database: normalized tables `users`, `boards`, `columns`, `cards`, with integer `position` for ordering, plus `chat_messages` for AI chat history.
- AI: OpenRouter via the `openai` Python SDK (`base_url=https://openrouter.ai/api/v1`), model `openai/gpt-oss-120b`, Structured Outputs (`response_format` JSON schema from Pydantic), provider routing with `require_parameters: true` so only providers supporting structured outputs are used.
- AI returns a list of operations, not a full board. Operations are validated and applied in one transaction; if any is invalid, none are applied.
- Chat history is stored in the database per user and survives reloads and logout. The backend reads it from the DB when calling the AI (last 20 messages); the browser sends only the new message.
- Scripts: `scripts/start.sh`, `scripts/stop.sh` (Mac/Linux), `scripts/start.ps1`, `scripts/stop.ps1` (Windows). They build the image and run/stop the container with `--env-file .env`.
- Testing: minimum 80% line coverage for backend (pytest + pytest-cov) and frontend (Vitest coverage thresholds), enforced so the run fails below 80%. Integration: FastAPI `TestClient` tests against a temp SQLite file; Playwright e2e tests against the running container at `http://127.0.0.1:8000`. Live OpenRouter calls are only in tests marked `live`, skipped when `OPENROUTER_API_KEY` is not set; all other AI tests mock the client.

## Part 1: Plan

- [x] Enrich this document with substeps, tests and success criteria
- [x] Create `frontend/AGENTS.md` describing the existing code
- [x] User reviews and approves the plan

Success: user approval.

## Part 2: Scaffolding

- [x] `backend/pyproject.toml` (uv, Python 3.14) with fastapi, uvicorn; dev deps pytest, pytest-cov, httpx2
- [x] `backend/app/main.py`: `GET /api/health` returns `{"status": "ok"}`; static files mounted at `/` from `backend/static`
- [x] Placeholder `backend/static/index.html` (hello world) that calls `/api/health` and shows the result
- [x] `Dockerfile` at project root (uv-based Python image), `.dockerignore`
- [x] Start/stop scripts for Mac, Linux, Windows in `scripts/`
- [x] Add `data/`, `frontend/test-results/` to `.gitignore` (`frontend/out/` is already in `frontend/.gitignore`)
- [x] Update `backend/AGENTS.md` and `scripts/AGENTS.md`

Tests:
- [x] pytest: health endpoint returns 200 and expected JSON; `/` returns the HTML page
- [ ] Manual: `scripts/start.ps1` brings up the container; browser at `http://127.0.0.1:8000` shows hello world and the API result; `scripts/stop.ps1` stops it

Success: container starts with one command, page and API call work, stop script cleans up.

## Part 3: Add in Frontend

- [x] Update frontend dependencies to latest versions (next, react, vitest, @vitest/coverage-v8, @vitejs/plugin-react, jsdom, eslint, typescript, @types/node, etc.); fix any breakage; existing unit tests, lint and build pass
- [x] `next.config.ts`: `output: "export"`
- [x] Dockerfile Node stage builds the frontend and copies `out/` into the Python stage as static files
- [x] Remove the placeholder HTML; add `backend/static/` (build output) to `.gitignore`
- [x] Add card editing (title and details, inline edit with save/cancel) to `KanbanCard`
- [x] Column rename commits on blur/Enter (Escape reverts) instead of on each keystroke, so Part 7 can save it with one API call
- [x] Vitest coverage thresholds at 80% in `vitest.config.mts`
- [x] Playwright config points at `http://127.0.0.1:8000` (container) instead of `next dev`

Tests:
- [x] Unit: `moveCard` edge cases (same position, unknown ids, empty column), column rename (commit on blur/Enter, revert on Escape), add/edit/delete card, `NewCardForm` validation and cancel, `KanbanCardPreview` rendering
- [x] E2E against container: board loads with 5 columns, add card, edit card, delete card, rename column, drag card between columns and within a column

Success: Kanban demo is served by FastAPI at `/` from the container; unit coverage >= 80%; all e2e tests pass.

## Part 4: Fake user sign in

- [x] Backend: `POST /api/login` (JSON `username`, `password`), `POST /api/logout`, `GET /api/me`; session cookie via `SessionMiddleware` with secret from env (default for local dev)
- [x] Frontend: on load call `/api/me`; show login form if 401, board if signed in; logout button in header; error message on wrong credentials
- [x] Login form styled with the project color scheme

Tests:
- [x] pytest: login success sets cookie, wrong credentials return 401, `/api/me` with and without session, logout clears session
- [x] Unit: login form submit, error display, logout returns to login screen (fetch mocked)
- [x] E2E: unauthenticated visit shows login; wrong password shows error; correct login shows board; logout returns to login; reload keeps session

Success: board only visible after login with `user` / `password`; logout works; coverage >= 80% on both sides.

## Part 5: Database modeling

- [ ] Write schema as `docs/schema.json` (tables, columns, types, keys, constraints)
- [ ] Write `docs/DATABASE.md`: tables, ordering via `position`, cascade deletes, one board per user (unique `boards.user_id`), creation and seeding on startup, how login maps to a `users` row
- [ ] User reviews and approves the schema

Proposed tables:
- `users`: `id` PK, `username` unique
- `boards`: `id` PK, `user_id` FK unique
- `columns`: `id` PK, `board_id` FK, `title`, `position`
- `cards`: `id` PK, `column_id` FK, `title`, `details`, `position`
- `chat_messages`: `id` PK, `user_id` FK, `role` (`user` / `assistant`), `content`, `created_at`

Success: user sign-off on schema and approach.

## Part 6: Backend

- [ ] `backend/app/db.py`: sqlite3 connection, schema creation if db missing, seed user's board with 5 default columns on first login
- [ ] Routes (all require session, all scoped to the signed-in user's board):
  - `GET /api/board` - full board (columns with ordered cards)
  - `PATCH /api/columns/{id}` - rename
  - `POST /api/cards` - create in column (appended at end)
  - `PATCH /api/cards/{id}` - edit title/details
  - `POST /api/cards/{id}/move` - `column_id`, `position`; reindexes positions in source and target columns
  - `DELETE /api/cards/{id}`
- [ ] Pydantic request/response models
- [ ] Shared board service functions (used later by AI operations)

Tests:
- [ ] DB created from scratch in a temp dir; reopening an existing DB keeps data
- [ ] Each route: success, 401 without session, 404 for ids of another user's board or missing ids, 422 for invalid input
- [ ] Move: within column up/down, across columns, to empty column, to end; positions stay contiguous
- [ ] Coverage >= 80%

Success: all backend tests pass; board state persists across container restarts.

## Part 7: Frontend + Backend

- [ ] `src/lib/api.ts`: typed fetch helpers for the board routes
- [ ] `KanbanBoard` loads board from API, applies changes optimistically and calls the API; on API error reloads board from server
- [ ] Column rename (committed on blur/Enter since Part 3) calls `PATCH /api/columns/{id}`
- [ ] Remove `initialData` from frontend (seed lives in backend)

Tests:
- [ ] Unit: API helpers (fetch mocked), board loads data, each action calls the right endpoint, error triggers reload
- [ ] E2E: every action persists after page reload; data persists after container restart (stop/start scripts); two logins see the same board
- [ ] Coverage >= 80%

Success: fully persistent Kanban board through the UI.

## Part 8: AI connectivity

- [ ] Add `openai` dependency; `backend/app/ai.py` with OpenRouter client from `OPENROUTER_API_KEY`
- [ ] `POST /api/ai/test` (session required) sends "What is 2+2?" and returns the reply

Tests:
- [ ] Unit: client configured with OpenRouter base URL and model; route returns mocked reply
- [ ] Live (`-m live`): real call returns an answer containing "4"

Success: live test passes inside the container with the real key.

## Part 9: AI with board context and Structured Outputs

- [ ] `POST /api/chat`: request `message`; backend loads the last 20 messages from `chat_messages` and builds prompt with system instructions, current board JSON (with ids), history, message
- [ ] Save the user message and the AI reply to `chat_messages`
- [ ] `GET /api/chat/history`: the signed-in user's messages in order
- [ ] Response schema (Pydantic, sent as JSON schema): `reply: str`, `operations: list[Operation]`
- [ ] Operations: `create_card {column_id, title, details}`, `update_card {card_id, title?, details?}`, `move_card {card_id, column_id, position}`, `delete_card {card_id}`, `rename_column {column_id, title}`
- [ ] Apply operations in one transaction via the Part 6 service functions; on invalid operation roll back and return the reply with an error note
- [ ] Route returns `reply`, applied `operations`, and the updated `board`

Tests:
- [ ] Unit: prompt contains board JSON and history from DB (limited to last 20); both messages saved after a chat call; history route returns only the signed-in user's messages; each operation type applies correctly; mixed batch applies in order; invalid id rolls back all; malformed model output handled
- [ ] Live: "Add a card called X to Backlog" results in that card in the DB; plain question returns no operations

Success: AI can create, edit, move and delete cards and rename columns reliably; no partial updates.

## Part 10: AI chat sidebar

- [ ] Collapsible sidebar on the board page: message list, input, send button (purple), loading state
- [ ] On load, fetch history from `GET /api/chat/history`; new messages appended to state, only the new message is sent
- [ ] When response includes operations, replace board state with returned `board`
- [ ] Error message in chat on failure

Tests:
- [ ] Unit: history loaded on mount, send message, render reply, loading state, board updates from response, error display (fetch mocked)
- [ ] E2E (API mocked via Playwright route): chat shows reply and board updates without reload; history still shown after reload
- [ ] E2E live (skipped without key): ask AI to add a card, card appears
- [ ] Coverage >= 80%

Success: user can chat with AI in the sidebar and see board changes immediately.
