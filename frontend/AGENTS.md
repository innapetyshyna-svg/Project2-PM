# Frontend

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4. Currently a frontend-only demo: board state lives in React memory and resets on reload.

## Structure

- `src/app/layout.tsx` - root layout, loads Space Grotesk (`--font-display`) and Manrope (`--font-body`) via `next/font/google`.
- `src/app/page.tsx` - renders `KanbanBoard` at `/`.
- `src/app/globals.css` - Tailwind import and CSS variables for the color scheme (`--accent-yellow`, `--primary-blue`, `--secondary-purple`, `--navy-dark`, `--gray-text`, plus surface/stroke/shadow).
- `src/lib/kanban.ts` - types (`Card`, `Column`, `BoardData`), `initialData` (5 columns, 8 cards), `moveCard` (pure reorder/move logic for drag and drop), `createId`.
- `src/components/KanbanBoard.tsx` - client component holding board state; handles drag start/end (dnd-kit `DndContext`, `PointerSensor` with 6px activation, `closestCorners`), column rename, add card, delete card. Renders header and a `DragOverlay`.
- `src/components/KanbanColumn.tsx` - droppable column, inline title input (`aria-label="Column title"`), sortable card list, empty-state placeholder, `NewCardForm`.
- `src/components/KanbanCard.tsx` - sortable card with title, details and a Remove button.
- `src/components/KanbanCardPreview.tsx` - static card shown in the drag overlay.
- `src/components/NewCardForm.tsx` - toggleable form to add a card (title required, details optional).

## Data model

`BoardData = { columns: Column[]; cards: Record<string, Card> }`. Columns hold ordered `cardIds`; cards are looked up by id.

## Testing

- Unit (Vitest + Testing Library, jsdom): `src/**/*.test.ts(x)`. Run `npm run test:unit`, coverage with `npx vitest run --coverage`.
- E2E (Playwright, Chromium): `tests/*.spec.ts`. Starts `next dev` on 127.0.0.1:3000. Run `npm run test:e2e`.
- Test ids: `column-<columnId>`, `card-<cardId>`.

## Known gaps

- Cards cannot be edited yet (only added, deleted, moved).
- No persistence, auth or API calls.
- `next.config.ts` is default; static export is not configured.
