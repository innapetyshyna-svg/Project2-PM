import os
import sqlite3
from pathlib import Path

DB_PATH = Path(os.environ.get("DB_PATH", "data/kanban.db"))

DEFAULT_COLUMNS = ["Backlog", "Discovery", "In Progress", "Review", "Done"]

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS boards (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS columns (
    id INTEGER PRIMARY KEY,
    board_id INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    position INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_columns_board ON columns(board_id, position);
CREATE TABLE IF NOT EXISTS cards (
    id INTEGER PRIMARY KEY,
    column_id INTEGER NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    details TEXT NOT NULL DEFAULT '',
    position INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cards_column ON cards(column_id, position);
CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON chat_messages(user_id, id);
"""


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = connect()
    with conn:
        conn.executescript(SCHEMA)
    conn.close()


def get_or_create_board(conn: sqlite3.Connection, username: str) -> int:
    row = conn.execute(
        "SELECT boards.id FROM boards JOIN users ON users.id = boards.user_id WHERE users.username = ?",
        (username,),
    ).fetchone()
    if row:
        return row["id"]
    user_id = conn.execute("INSERT INTO users (username) VALUES (?)", (username,)).lastrowid
    board_id = conn.execute("INSERT INTO boards (user_id) VALUES (?)", (user_id,)).lastrowid
    conn.executemany(
        "INSERT INTO columns (board_id, title, position) VALUES (?, ?, ?)",
        [(board_id, title, position) for position, title in enumerate(DEFAULT_COLUMNS)],
    )
    return board_id
