from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
Details = Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)]


class Credentials(BaseModel):
    username: str
    password: str


class CardOut(BaseModel):
    id: int
    title: str
    details: str


class ColumnOut(BaseModel):
    id: int
    title: str
    cards: list[CardOut]


class BoardOut(BaseModel):
    columns: list[ColumnOut]


class ColumnRename(BaseModel):
    title: Title


class CardCreate(BaseModel):
    column_id: int
    title: Title
    details: Details = ""


class CardUpdate(BaseModel):
    title: Title | None = None
    details: Details | None = None


class CardMove(BaseModel):
    column_id: int
    position: int = Field(ge=0)
