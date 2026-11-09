import pytest
from fastapi.testclient import TestClient

from app import db
from app.main import app


def column_ids(client):
    return [column["id"] for column in client.get("/api/board").json()["columns"]]


def add_cards(client, column_id, *titles):
    for title in titles:
        client.post("/api/cards", json={"column_id": column_id, "title": title})


def titles(board, index):
    return [card["title"] for card in board["columns"][index]["cards"]]


def positions_are_contiguous():
    conn = db.connect()
    rows = conn.execute("SELECT column_id, position FROM cards ORDER BY column_id, position").fetchall()
    conn.close()
    by_column = {}
    for row in rows:
        by_column.setdefault(row["column_id"], []).append(row["position"])
    return all(positions == list(range(len(positions))) for positions in by_column.values())


@pytest.fixture
def other_card_id(db_path):
    """A card on another user's board."""
    conn = db.connect()
    with conn:
        board_id = db.get_or_create_board(conn, "other")
        column_id = conn.execute("SELECT id FROM columns WHERE board_id = ?", (board_id,)).fetchone()[0]
        card_id = conn.execute(
            "INSERT INTO cards (column_id, title, position) VALUES (?, 'Secret', 0)", (column_id,)
        ).lastrowid
    conn.close()
    return column_id, card_id


@pytest.mark.parametrize(
    ("method", "url", "body"),
    [
        ("get", "/api/board", None),
        ("patch", "/api/columns/1", {"title": "X"}),
        ("post", "/api/cards", {"column_id": 1, "title": "X"}),
        ("patch", "/api/cards/1", {"title": "X"}),
        ("post", "/api/cards/1/move", {"column_id": 1, "position": 0}),
        ("delete", "/api/cards/1", None),
    ],
)
def test_routes_require_session(client, method, url, body):
    kwargs = {"json": body} if body else {}
    assert client.request(method, url, **kwargs).status_code == 401


def test_get_board(auth_client):
    board = auth_client.get("/api/board").json()
    assert len(board["columns"]) == 5
    assert set(board["columns"][0]) == {"id", "title", "cards"}


def test_rename_column(auth_client):
    column_id = column_ids(auth_client)[0]
    response = auth_client.patch(f"/api/columns/{column_id}", json={"title": "  Ideas  "})
    assert response.status_code == 200
    assert response.json()["columns"][0]["title"] == "Ideas"


def test_create_card_appends(auth_client):
    column_id = column_ids(auth_client)[1]
    add_cards(auth_client, column_id, "First")
    response = auth_client.post(
        "/api/cards", json={"column_id": column_id, "title": "Second", "details": "More"}
    )
    assert response.status_code == 201
    cards = response.json()["columns"][1]["cards"]
    assert [card["title"] for card in cards] == ["First", "Second"]
    assert cards[0]["details"] == ""
    assert cards[1]["details"] == "More"


def test_update_card(auth_client):
    column_id = column_ids(auth_client)[0]
    add_cards(auth_client, column_id, "Old")
    card = auth_client.get("/api/board").json()["columns"][0]["cards"][0]
    board = auth_client.patch(f"/api/cards/{card['id']}", json={"details": "New details"}).json()
    assert board["columns"][0]["cards"][0] == {"id": card["id"], "title": "Old", "details": "New details"}
    board = auth_client.patch(f"/api/cards/{card['id']}", json={"title": "New"}).json()
    assert board["columns"][0]["cards"][0]["title"] == "New"
    assert board["columns"][0]["cards"][0]["details"] == "New details"


def test_delete_card_keeps_positions_contiguous(auth_client):
    column_id = column_ids(auth_client)[0]
    add_cards(auth_client, column_id, "A", "B", "C")
    card_b = auth_client.get("/api/board").json()["columns"][0]["cards"][1]
    board = auth_client.delete(f"/api/cards/{card_b['id']}").json()
    assert titles(board, 0) == ["A", "C"]
    assert positions_are_contiguous()


@pytest.mark.parametrize(
    ("method", "url", "body"),
    [
        ("patch", "/api/columns/9999", {"title": "X"}),
        ("post", "/api/cards", {"column_id": 9999, "title": "X"}),
        ("patch", "/api/cards/9999", {"title": "X"}),
        ("post", "/api/cards/9999/move", {"column_id": 1, "position": 0}),
        ("delete", "/api/cards/9999", None),
    ],
)
def test_missing_ids_return_404(auth_client, method, url, body):
    kwargs = {"json": body} if body else {}
    assert auth_client.request(method, url, **kwargs).status_code == 404


def test_other_users_ids_return_404(auth_client, other_card_id):
    other_column, other_card = other_card_id
    own_column = column_ids(auth_client)[0]
    add_cards(auth_client, own_column, "Mine")
    own_card = auth_client.get("/api/board").json()["columns"][0]["cards"][0]["id"]
    requests = [
        ("patch", f"/api/columns/{other_column}", {"title": "X"}),
        ("post", "/api/cards", {"column_id": other_column, "title": "X"}),
        ("patch", f"/api/cards/{other_card}", {"title": "X"}),
        ("post", f"/api/cards/{other_card}/move", {"column_id": own_column, "position": 0}),
        ("post", f"/api/cards/{own_card}/move", {"column_id": other_column, "position": 0}),
        ("delete", f"/api/cards/{other_card}", None),
    ]
    for method, url, body in requests:
        kwargs = {"json": body} if body else {}
        assert auth_client.request(method, url, **kwargs).status_code == 404, url
    conn = db.connect()
    assert conn.execute("SELECT title FROM cards WHERE id = ?", (other_card,)).fetchone()[0] == "Secret"
    conn.close()


@pytest.mark.parametrize(
    ("method", "url", "body"),
    [
        ("patch", "/api/columns/1", {"title": "   "}),
        ("patch", "/api/columns/1", {}),
        ("post", "/api/cards", {"column_id": 1, "title": ""}),
        ("post", "/api/cards", {"title": "No column"}),
        ("patch", "/api/cards/1", {"title": ""}),
        ("post", "/api/cards/1/move", {"column_id": 1, "position": -1}),
        ("post", "/api/cards/1/move", {"column_id": "abc", "position": 0}),
        ("patch", "/api/cards/abc", {"title": "X"}),
    ],
)
def test_invalid_input_returns_422(auth_client, method, url, body):
    assert auth_client.request(method, url, json=body).status_code == 422


def test_error_after_write_rolls_back(auth_client, monkeypatch):
    column_id = column_ids(auth_client)[0]

    def fail(*args):
        raise RuntimeError("boom")

    monkeypatch.setattr("app.board.get_board", fail)
    with TestClient(app, raise_server_exceptions=False) as client:
        client.cookies = auth_client.cookies
        response = client.post("/api/cards", json={"column_id": column_id, "title": "Lost"})
    assert response.status_code == 500
    conn = db.connect()
    assert conn.execute("SELECT COUNT(*) FROM cards").fetchone()[0] == 0
    conn.close()


@pytest.fixture
def board_with_cards(auth_client):
    columns = column_ids(auth_client)
    add_cards(auth_client, columns[0], "A", "B", "C")
    add_cards(auth_client, columns[1], "D")
    cards = {
        card["title"]: card["id"]
        for column in auth_client.get("/api/board").json()["columns"]
        for card in column["cards"]
    }
    return auth_client, columns, cards


def move(client, card_id, column_id, position):
    response = client.post(f"/api/cards/{card_id}/move", json={"column_id": column_id, "position": position})
    assert response.status_code == 200
    return response.json()


@pytest.mark.parametrize(
    ("card", "column", "position", "expected_first", "expected_second"),
    [
        ("C", 0, 0, ["C", "A", "B"], ["D"]),  # within column, up
        ("A", 0, 2, ["B", "C", "A"], ["D"]),  # within column, down
        ("B", 0, 1, ["A", "B", "C"], ["D"]),  # same position
        ("B", 1, 0, ["A", "C"], ["B", "D"]),  # across columns, to the top
        ("A", 1, 1, ["B", "C"], ["D", "A"]),  # across columns, to the end
        ("A", 1, 99, ["B", "C"], ["D", "A"]),  # past the end is clamped
        ("A", 0, 99, ["B", "C", "A"], ["D"]),  # within column, past the end
    ],
)
def test_move_card(board_with_cards, card, column, position, expected_first, expected_second):
    client, columns, cards = board_with_cards
    board = move(client, cards[card], columns[column], position)
    assert titles(board, 0) == expected_first
    assert titles(board, 1) == expected_second
    assert positions_are_contiguous()


def test_move_card_to_empty_column(board_with_cards):
    client, columns, cards = board_with_cards
    board = move(client, cards["B"], columns[4], 0)
    assert titles(board, 0) == ["A", "C"]
    assert titles(board, 4) == ["B"]
    assert positions_are_contiguous()
