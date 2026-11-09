# Frontend

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4. Built as a static export (`output: "export"`) and served by the backend. The board is loaded from and saved to the backend API.

## Structure

- `src/app/layout.tsx` - root layout, loads Space Grotesk (`--font-display`) and Manrope (`--font-body`) via `next/font/google`.
- `src/app/page.tsx` - renders `AuthGate` at `/`.
- `src/components/AuthGate.tsx` - checks `/api/me` on load; shows `LoginForm` when signed out, `KanbanBoard` (with logout) when signed in.
- `src/components/LoginForm.tsx` - username/password form, shows an error on failed login.
- `src/lib/auth.ts` - `fetchMe`, `login`, `logout` fetch helpers.
- `src/app/globals.css` - Tailwind import and CSS variables for the color scheme (`--accent-yellow`, `--primary-blue`, `--secondary-purple`, `--navy-dark`, `--gray-text`, plus surface/stroke/shadow).
- `src/lib/kanban.ts` - types (`Card`, `Column`, `BoardData`) and `moveCard` (pure reorder/move logic for drag and drop).
- `src/lib/api.ts` - board API helpers (`fetchBoard`, `renameColumn`, `createCard`, `updateCard`, `moveCardTo`, `deleteCard`). Each returns the full board converted by `toBoardData`: API ids are numbers, the frontend uses `col-<id>` / `card-<id>` so dnd-kit ids are unique.
- `src/components/KanbanBoard.tsx` - client component holding board state, loaded from `/api/board` on mount. Changes are applied locally first, then replaced by the board the API returns; on an API error the board is reloaded from the server. Card creation waits for the API (it assigns the id). It handles drag start/end (dnd-kit `DndContext`, `PointerSensor` with 6px activation, `closestCorners`), column rename, add/edit/delete card. Renders header (with Log out button) and a `DragOverlay`.
- `src/components/KanbanColumn.tsx` - droppable column, inline title input (`aria-label="Column title"`, commits on blur/Enter, Escape reverts), sortable card list, empty-state placeholder, `NewCardForm`.
- `src/components/KanbanCard.tsx` - sortable card with title, details, Edit (inline form, save/cancel) and Remove buttons.
- `src/components/KanbanCardPreview.tsx` - static card shown in the drag overlay.
- `src/components/NewCardForm.tsx` - toggleable form to add a card (title required, details optional).

## Data model

`BoardData = { columns: Column[]; cards: Record<string, Card> }`. Columns hold ordered `cardIds`; cards are looked up by id.

## Testing

- Unit (Vitest + Testing Library, jsdom): `src/**/*.test.ts(x)`, `fetch` stubbed with `vi.stubGlobal`; `src/test/fakeApi.ts` is an in-memory board API (`stubBoardApi`, `sampleBoard`). Run `npm run test:unit`, coverage with `npx vitest run --coverage` (fails below 80% lines).
- E2E (Playwright, Chromium): `tests/*.spec.ts`, run against the container at 127.0.0.1:8000 (start it with `scripts/start.*` first). Run `npm run test:e2e`. They use the real database: cards they create are titled `e2e ...` and deleted after each test, renamed columns are restored. One test runs `docker restart pm-app`.
- Test ids: `column-col-<id>`, `card-card-<id>`.
