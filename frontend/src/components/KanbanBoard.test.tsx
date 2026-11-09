import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KanbanBoard } from "@/components/KanbanBoard";
import { stubBoardApi } from "@/test/fakeApi";

const getFirstColumn = () => screen.getAllByTestId(/column-/i)[0];

const renderBoard = async () => {
  const api = stubBoardApi();
  render(<KanbanBoard onLogout={() => {}} />);
  await screen.findAllByTestId(/column-/i);
  return api;
};

const lastCall = (fetchMock: ReturnType<typeof stubBoardApi>["fetchMock"]) => {
  const [url, init] = fetchMock.mock.calls.at(-1)!;
  return { url, method: init?.method, body: init?.body && JSON.parse(init.body as string) };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("KanbanBoard", () => {
  it("loads the board from the API", async () => {
    const { fetchMock } = await renderBoard();
    expect(fetchMock).toHaveBeenCalledWith("/api/board", expect.objectContaining({ method: "GET" }));
    expect(screen.getAllByTestId(/column-/i)).toHaveLength(5);
    expect(within(getFirstColumn()).getByText("Align roadmap themes")).toBeInTheDocument();
  });

  it("renames a column on Enter", async () => {
    const { fetchMock } = await renderBoard();
    const input = within(getFirstColumn()).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "New Name{Enter}");
    expect(screen.getByRole("banner")).toHaveTextContent("New Name");
    expect(lastCall(fetchMock)).toEqual({
      url: "/api/columns/1",
      method: "PATCH",
      body: { title: "New Name" },
    });
  });

  it("renames a column on blur", async () => {
    const { fetchMock } = await renderBoard();
    const input = within(getFirstColumn()).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "Blurred");
    await userEvent.tab();
    expect(screen.getByRole("banner")).toHaveTextContent("Blurred");
    expect(lastCall(fetchMock).url).toBe("/api/columns/1");
  });

  it("does not commit the column title while typing", async () => {
    const { fetchMock } = await renderBoard();
    const input = within(getFirstColumn()).getByLabelText("Column title");
    await userEvent.type(input, " draft");
    expect(screen.getByRole("banner")).not.toHaveTextContent("Backlog draft");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reverts the column title on Escape", async () => {
    const { fetchMock } = await renderBoard();
    const input = within(getFirstColumn()).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "Discarded{Escape}");
    expect(input).toHaveValue("Backlog");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reverts an empty column title", async () => {
    const { fetchMock } = await renderBoard();
    const input = within(getFirstColumn()).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.tab();
    expect(input).toHaveValue("Backlog");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("adds a card through the API", async () => {
    const { fetchMock } = await renderBoard();
    const column = getFirstColumn();
    await userEvent.click(within(column).getByRole("button", { name: /add a card/i }));
    await userEvent.type(within(column).getByPlaceholderText(/card title/i), "New card");
    await userEvent.type(within(column).getByPlaceholderText(/details/i), "Notes");
    await userEvent.click(within(column).getByRole("button", { name: /add card/i }));

    expect(await within(column).findByText("New card")).toBeInTheDocument();
    expect(lastCall(fetchMock)).toEqual({
      url: "/api/cards",
      method: "POST",
      body: { column_id: 1, title: "New card", details: "Notes" },
    });
  });

  it("deletes a card", async () => {
    const { fetchMock } = await renderBoard();
    await userEvent.click(screen.getByRole("button", { name: "Delete Align roadmap themes" }));
    expect(screen.queryByText("Align roadmap themes")).not.toBeInTheDocument();
    expect(lastCall(fetchMock)).toEqual({ url: "/api/cards/1", method: "DELETE", body: undefined });
  });

  it("does not add a card with a blank title", async () => {
    const { fetchMock } = await renderBoard();
    const column = getFirstColumn();
    await userEvent.click(within(column).getByRole("button", { name: /add a card/i }));
    await userEvent.type(within(column).getByPlaceholderText(/card title/i), "   ");
    await userEvent.click(within(column).getByRole("button", { name: /add card/i }));
    expect(within(column).getAllByTestId(/card-/)).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("cancels adding a card and clears the form", async () => {
    await renderBoard();
    const column = getFirstColumn();
    await userEvent.click(within(column).getByRole("button", { name: /add a card/i }));
    await userEvent.type(within(column).getByPlaceholderText(/card title/i), "Draft");
    await userEvent.click(within(column).getByRole("button", { name: /cancel/i }));
    expect(within(column).queryByPlaceholderText(/card title/i)).not.toBeInTheDocument();

    await userEvent.click(within(column).getByRole("button", { name: /add a card/i }));
    expect(within(column).getByPlaceholderText(/card title/i)).toHaveValue("");
  });

  it("edits a card", async () => {
    const { fetchMock } = await renderBoard();
    await userEvent.click(screen.getByRole("button", { name: "Edit Align roadmap themes" }));
    const card = screen.getByTestId("card-card-1");
    const title = within(card).getByLabelText("Card title");
    const details = within(card).getByLabelText("Card details");
    expect(title).toHaveValue("Align roadmap themes");
    await userEvent.clear(title);
    await userEvent.type(title, "Updated title");
    await userEvent.clear(details);
    await userEvent.type(details, "Updated details");
    await userEvent.click(within(card).getByRole("button", { name: /save/i }));

    expect(within(card).getByText("Updated title")).toBeInTheDocument();
    expect(within(card).getByText("Updated details")).toBeInTheDocument();
    expect(lastCall(fetchMock)).toEqual({
      url: "/api/cards/1",
      method: "PATCH",
      body: { title: "Updated title", details: "Updated details" },
    });
  });

  it("cancels editing a card", async () => {
    await renderBoard();
    await userEvent.click(screen.getByRole("button", { name: "Edit Align roadmap themes" }));
    const card = screen.getByTestId("card-card-1");
    await userEvent.type(within(card).getByLabelText("Card title"), " changed");
    await userEvent.click(within(card).getByRole("button", { name: /cancel/i }));
    expect(within(card).getByText("Align roadmap themes")).toBeInTheDocument();
  });

  it("does not save a card with a blank title", async () => {
    await renderBoard();
    await userEvent.click(screen.getByRole("button", { name: "Edit Align roadmap themes" }));
    const card = screen.getByTestId("card-card-1");
    const title = within(card).getByLabelText("Card title");
    await userEvent.clear(title);
    await userEvent.type(title, "   ");
    await userEvent.click(within(card).getByRole("button", { name: /save/i }));
    expect(within(card).getByLabelText("Card title")).toBeInTheDocument();
  });

  it("reloads the board from the server when a call fails", async () => {
    const { fetchMock } = await renderBoard();
    fetchMock.mockImplementationOnce(async () => new Response("{}", { status: 500 }));
    await userEvent.click(screen.getByRole("button", { name: "Delete Align roadmap themes" }));

    expect(await screen.findByText("Align roadmap themes")).toBeInTheDocument();
    await waitFor(() => expect(lastCall(fetchMock).url).toBe("/api/board"));
  });
});
