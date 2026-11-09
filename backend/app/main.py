import os
import sqlite3
from collections.abc import Iterator
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware

from app import board, db
from app.models import BoardOut, CardCreate, CardMove, CardUpdate, ColumnRename, Credentials

STATIC_DIR = Path(os.environ.get("STATIC_DIR", Path(__file__).resolve().parent.parent / "static"))
SESSION_SECRET = os.environ.get("SESSION_SECRET", "local-dev-secret")

USERNAME = "user"
PASSWORD = "password"


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    yield


app = FastAPI(lifespan=lifespan)
app.add_middleware(SessionMiddleware, secret_key=SESSION_SECRET)


@app.exception_handler(board.NotFoundError)
def not_found(request: Request, exc: board.NotFoundError):
    return JSONResponse(status_code=404, content={"detail": str(exc)})


def get_conn() -> Iterator[sqlite3.Connection]:
    conn = db.connect()
    try:
        with conn:
            yield conn
    finally:
        conn.close()


Conn = Annotated[sqlite3.Connection, Depends(get_conn)]


def get_username(request: Request) -> str:
    username = request.session.get("username")
    if not username:
        raise HTTPException(status_code=401, detail="Not signed in")
    return username


def get_board_id(conn: Conn, username: Annotated[str, Depends(get_username)]) -> int:
    return db.get_or_create_board(conn, username)


BoardId = Annotated[int, Depends(get_board_id)]


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/login")
def login(credentials: Credentials, request: Request, conn: Conn):
    if credentials.username != USERNAME or credentials.password != PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    db.get_or_create_board(conn, credentials.username)
    request.session["username"] = credentials.username
    return {"username": credentials.username}


@app.post("/api/logout")
def logout(request: Request):
    request.session.clear()
    return {"status": "ok"}


@app.get("/api/me")
def me(username: Annotated[str, Depends(get_username)]):
    return {"username": username}


@app.get("/api/board", response_model=BoardOut)
def read_board(conn: Conn, board_id: BoardId):
    return board.get_board(conn, board_id)


@app.patch("/api/columns/{column_id}", response_model=BoardOut)
def rename_column(column_id: int, body: ColumnRename, conn: Conn, board_id: BoardId):
    board.rename_column(conn, board_id, column_id, body.title)
    return board.get_board(conn, board_id)


@app.post("/api/cards", response_model=BoardOut, status_code=201)
def create_card(body: CardCreate, conn: Conn, board_id: BoardId):
    board.create_card(conn, board_id, body.column_id, body.title, body.details)
    return board.get_board(conn, board_id)


@app.patch("/api/cards/{card_id}", response_model=BoardOut)
def update_card(card_id: int, body: CardUpdate, conn: Conn, board_id: BoardId):
    board.update_card(conn, board_id, card_id, body.title, body.details)
    return board.get_board(conn, board_id)


@app.post("/api/cards/{card_id}/move", response_model=BoardOut)
def move_card(card_id: int, body: CardMove, conn: Conn, board_id: BoardId):
    board.move_card(conn, board_id, card_id, body.column_id, body.position)
    return board.get_board(conn, board_id)


@app.delete("/api/cards/{card_id}", response_model=BoardOut)
def delete_card(card_id: int, conn: Conn, board_id: BoardId):
    board.delete_card(conn, board_id, card_id)
    return board.get_board(conn, board_id)


app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
