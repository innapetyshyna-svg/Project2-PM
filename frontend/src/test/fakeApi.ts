import type { ApiBoard } from "@/lib/api";

export const sampleBoard = (): ApiBoard => ({
  columns: [
    {
      id: 1,
      title: "Backlog",
      cards: [
        { id: 1, title: "Align roadmap themes", details: "Draft quarterly themes." },
        { id: 2, title: "Gather customer signals", details: "Review support tags." },
      ],
    },
    { id: 2, title: "Discovery", cards: [] },
    { id: 3, title: "In Progress", cards: [] },
    { id: 4, title: "Review", cards: [] },
    { id: 5, title: "Done", cards: [] },
  ],
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status });

// In-memory stand-in for the board API, stubbed as the global fetch.
export const stubBoardApi = (board: ApiBoard = sampleBoard()) => {
  let nextId = 100;
  const findCard = (id: number) => {
    const column = board.columns.find((item) => item.cards.some((card) => card.id === id))!;
    return { column, index: column.cards.findIndex((card) => card.id === id) };
  };
  const findColumn = (id: number) => board.columns.find((column) => column.id === id)!;

  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? "GET";
    const body = init.body ? JSON.parse(init.body as string) : {};
    const [, , resource, rawId, action] = url.split("/");
    const id = Number(rawId);

    if (resource === "columns") {
      findColumn(id).title = body.title;
    } else if (resource === "cards" && !rawId) {
      findColumn(body.column_id).cards.push({
        id: nextId++,
        title: body.title,
        details: body.details,
      });
    } else if (action === "move") {
      const { column, index } = findCard(id);
      const [card] = column.cards.splice(index, 1);
      findColumn(body.column_id).cards.splice(body.position, 0, card);
    } else if (method === "PATCH") {
      const { column, index } = findCard(id);
      column.cards[index] = { id, title: body.title, details: body.details };
    } else if (method === "DELETE") {
      const { column, index } = findCard(id);
      column.cards.splice(index, 1);
    }
    return json(200, board);
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, board };
};
