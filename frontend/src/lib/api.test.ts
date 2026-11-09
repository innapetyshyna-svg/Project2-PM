import { fetchBoard, moveCardTo, toBoardData } from "@/lib/api";
import { sampleBoard, stubBoardApi } from "@/test/fakeApi";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api", () => {
  it("converts the API board to prefixed ids", () => {
    const board = toBoardData(sampleBoard());
    expect(board.columns[0]).toEqual({
      id: "col-1",
      title: "Backlog",
      cardIds: ["card-1", "card-2"],
    });
    expect(board.cards["card-2"]).toEqual({
      id: "card-2",
      title: "Gather customer signals",
      details: "Review support tags.",
    });
  });

  it("moves a card using numeric ids", async () => {
    const { fetchMock } = stubBoardApi();
    const board = await moveCardTo("card-1", "col-4", 0);
    expect(fetchMock).toHaveBeenCalledWith("/api/cards/1/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ column_id: 4, position: 0 }),
    });
    expect(board.columns[3].cardIds).toEqual(["card-1"]);
  });

  it("throws when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 401 })));
    await expect(fetchBoard()).rejects.toThrow("GET /api/board failed with 401");
  });
});
