import sqlite3


class NotFoundError(Exception):
    pass


def get_board(conn: sqlite3.Connection, board_id: int) -> dict:
    columns = conn.execute(
        "SELECT id, title FROM columns WHERE board_id = ? ORDER BY position", (board_id,)
    ).fetchall()
    cards = conn.execute(
        "SELECT cards.id, cards.column_id, cards.title, cards.details FROM cards"
        " JOIN columns ON columns.id = cards.column_id"
        " WHERE columns.board_id = ? ORDER BY cards.position",
        (board_id,),
    ).fetchall()
    return {
        "columns": [
            {
                "id": column["id"],
                "title": column["title"],
                "cards": [
                    {"id": card["id"], "title": card["title"], "details": card["details"]}
                    for card in cards
                    if card["column_id"] == column["id"]
                ],
            }
            for column in columns
        ]
    }


def _check_column(conn: sqlite3.Connection, board_id: int, column_id: int):
    row = conn.execute(
        "SELECT id FROM columns WHERE id = ? AND board_id = ?", (column_id, board_id)
    ).fetchone()
    if not row:
        raise NotFoundError(f"Column {column_id} not found")


def _get_card(conn: sqlite3.Connection, board_id: int, card_id: int) -> sqlite3.Row:
    row = conn.execute(
        "SELECT cards.id, cards.column_id, cards.position FROM cards"
        " JOIN columns ON columns.id = cards.column_id"
        " WHERE cards.id = ? AND columns.board_id = ?",
        (card_id, board_id),
    ).fetchone()
    if not row:
        raise NotFoundError(f"Card {card_id} not found")
    return row


def rename_column(conn: sqlite3.Connection, board_id: int, column_id: int, title: str):
    _check_column(conn, board_id, column_id)
    conn.execute("UPDATE columns SET title = ? WHERE id = ?", (title, column_id))


def create_card(conn: sqlite3.Connection, board_id: int, column_id: int, title: str, details: str) -> int:
    _check_column(conn, board_id, column_id)
    return conn.execute(
        "INSERT INTO cards (column_id, title, details, position)"
        " VALUES (?, ?, ?, (SELECT COUNT(*) FROM cards WHERE column_id = ?))",
        (column_id, title, details, column_id),
    ).lastrowid


def update_card(
    conn: sqlite3.Connection,
    board_id: int,
    card_id: int,
    title: str | None = None,
    details: str | None = None,
):
    _get_card(conn, board_id, card_id)
    conn.execute(
        "UPDATE cards SET title = COALESCE(?, title), details = COALESCE(?, details) WHERE id = ?",
        (title, details, card_id),
    )


def move_card(conn: sqlite3.Connection, board_id: int, card_id: int, column_id: int, position: int):
    card = _get_card(conn, board_id, card_id)
    _check_column(conn, board_id, column_id)
    conn.execute(
        "UPDATE cards SET position = position - 1 WHERE column_id = ? AND position > ?",
        (card["column_id"], card["position"]),
    )
    count = conn.execute(
        "SELECT COUNT(*) FROM cards WHERE column_id = ? AND id != ?", (column_id, card_id)
    ).fetchone()[0]
    position = min(position, count)
    conn.execute(
        "UPDATE cards SET position = position + 1 WHERE column_id = ? AND position >= ? AND id != ?",
        (column_id, position, card_id),
    )
    conn.execute(
        "UPDATE cards SET column_id = ?, position = ? WHERE id = ?", (column_id, position, card_id)
    )


def delete_card(conn: sqlite3.Connection, board_id: int, card_id: int):
    card = _get_card(conn, board_id, card_id)
    conn.execute("DELETE FROM cards WHERE id = ?", (card_id,))
    conn.execute(
        "UPDATE cards SET position = position - 1 WHERE column_id = ? AND position > ?",
        (card["column_id"], card["position"]),
    )
