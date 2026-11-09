import sqlite3

from fastapi.testclient import TestClient

from app import db
from app.main import app


def test_db_created_from_scratch(db_path):
    assert not db_path.exists()
    db.init_db()
    conn = sqlite3.connect(db_path)
    tables = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
    conn.close()
    assert {"users", "boards", "columns", "cards", "chat_messages"} <= tables


def test_login_seeds_board_once(auth_client):
    auth_client.post("/api/login", json={"username": "user", "password": "password"})
    board = auth_client.get("/api/board").json()
    assert [column["title"] for column in board["columns"]] == db.DEFAULT_COLUMNS
    assert all(column["cards"] == [] for column in board["columns"])
    conn = db.connect()
    assert conn.execute("SELECT COUNT(*) FROM boards").fetchone()[0] == 1
    conn.close()


def test_data_survives_reopen(auth_client):
    column_id = auth_client.get("/api/board").json()["columns"][0]["id"]
    auth_client.post("/api/cards", json={"column_id": column_id, "title": "Persist me"})
    auth_client.close()
    with TestClient(app) as client:
        client.post("/api/login", json={"username": "user", "password": "password"})
        cards = client.get("/api/board").json()["columns"][0]["cards"]
    assert [card["title"] for card in cards] == ["Persist me"]


def test_users_get_separate_boards():
    db.init_db()
    conn = db.connect()
    with conn:
        first = db.get_or_create_board(conn, "user")
        second = db.get_or_create_board(conn, "other")
    conn.close()
    assert first != second


def test_deleting_user_cascades(auth_client):
    column_id = auth_client.get("/api/board").json()["columns"][0]["id"]
    auth_client.post("/api/cards", json={"column_id": column_id, "title": "Card"})
    conn = db.connect()
    with conn:
        conn.execute("DELETE FROM users")
    counts = [conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0] for table in ("boards", "columns", "cards")]
    conn.close()
    assert counts == [0, 0, 0]
