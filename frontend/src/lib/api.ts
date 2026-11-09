import type { BoardData } from "@/lib/kanban";

type ApiCard = { id: number; title: string; details: string };
type ApiColumn = { id: number; title: string; cards: ApiCard[] };
export type ApiBoard = { columns: ApiColumn[] };

// dnd-kit needs ids unique across columns and cards, so API ids get a prefix
const toNumber = (key: string) => Number(key.slice(key.indexOf("-") + 1));

export const toBoardData = (board: ApiBoard): BoardData => ({
  columns: board.columns.map((column) => ({
    id: `col-${column.id}`,
    title: column.title,
    cardIds: column.cards.map((card) => `card-${card.id}`),
  })),
  cards: Object.fromEntries(
    board.columns.flatMap((column) =>
      column.cards.map((card) => [`card-${card.id}`, { ...card, id: `card-${card.id}` }])
    )
  ),
});

const request = async (url: string, method = "GET", body?: object) => {
  const response = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    throw new Error(`${method} ${url} failed with ${response.status}`);
  }
  return toBoardData(await response.json());
};

export const fetchBoard = () => request("/api/board");

export const renameColumn = (columnId: string, title: string) =>
  request(`/api/columns/${toNumber(columnId)}`, "PATCH", { title });

export const createCard = (columnId: string, title: string, details: string) =>
  request("/api/cards", "POST", { column_id: toNumber(columnId), title, details });

export const updateCard = (cardId: string, title: string, details: string) =>
  request(`/api/cards/${toNumber(cardId)}`, "PATCH", { title, details });

export const moveCardTo = (cardId: string, columnId: string, position: number) =>
  request(`/api/cards/${toNumber(cardId)}/move`, "POST", {
    column_id: toNumber(columnId),
    position,
  });

export const deleteCard = (cardId: string) =>
  request(`/api/cards/${toNumber(cardId)}`, "DELETE");
