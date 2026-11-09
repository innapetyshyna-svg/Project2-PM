# Database

SQLite file at `/app/data/kanban.db` (host `./data`, so it survives container restarts). Exact definitions are in `schema.json`.

## Tables

- `users` - one row per username. No password column: the MVP checks hardcoded `user` / `password` in code.
- `boards` - one board per user, enforced by `UNIQUE(user_id)`.
- `columns` - the board's columns, ordered by `position`.
- `cards` - cards in a column, ordered by `position`. `details` defaults to an empty string.
- `chat_messages` - AI chat history per user, `role` is `user` or `assistant`. Read in `id` order; the AI prompt uses the last 20.

All ids are `INTEGER PRIMARY KEY` (SQLite rowid). The API returns them as numbers; the frontend prefixes them (`col-1`, `card-1`) because dnd-kit needs ids that are unique across columns and cards.

## Ordering

`position` is a 0-based index within the parent (board for columns, column for cards). The service keeps positions contiguous (0, 1, 2, ...):

- Create card: `position = number of cards in the column` (appended at the end).
- Delete card: cards after it in the same column shift down by 1.
- Move card: remove from the source column (shift later cards down), then insert into the target column at the requested position (shift cards at or after it up). Position is clamped to the end of the target column.

There is no unique constraint on `(column_id, position)`, because SQLite checks it row by row during these shifts. All changes for one operation run in one transaction.

## Deletes

Foreign keys use `ON DELETE CASCADE` (`PRAGMA foreign_keys = ON` is set on every connection): deleting a user removes their board, columns, cards and chat messages; deleting a column removes its cards. The MVP UI only deletes cards; columns are fixed.

## Creation and seeding

- On app startup, tables and indexes are created with `CREATE TABLE IF NOT EXISTS`, so a missing database file is created and an existing one is kept as is.
- On successful login, the user is looked up by `username`. If there is no row, one transaction creates the `users` row, its `boards` row and 5 empty columns: Backlog, Discovery, In Progress, Review, Done.
- The session stores the username; each request resolves it to the user's board, and every board, column and card query is scoped to that board, so ids from another user's board return 404.
