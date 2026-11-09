import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KanbanBoard } from "@/components/KanbanBoard";

const getFirstColumn = () => screen.getAllByTestId(/column-/i)[0];

describe("KanbanBoard", () => {
  it("renders five columns", () => {
    render(<KanbanBoard />);
    expect(screen.getAllByTestId(/column-/i)).toHaveLength(5);
  });

  it("renames a column on Enter", async () => {
    render(<KanbanBoard />);
    const input = within(getFirstColumn()).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "New Name{Enter}");
    expect(within(getFirstColumn()).getByLabelText("Column title")).toHaveValue(
      "New Name"
    );
    expect(screen.getByRole("banner")).toHaveTextContent("New Name");
  });

  it("renames a column on blur", async () => {
    render(<KanbanBoard />);
    const input = within(getFirstColumn()).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "Blurred");
    await userEvent.tab();
    expect(screen.getByRole("banner")).toHaveTextContent("Blurred");
  });

  it("does not commit the column title while typing", async () => {
    render(<KanbanBoard />);
    const input = within(getFirstColumn()).getByLabelText("Column title");
    await userEvent.type(input, " draft");
    expect(screen.getByRole("banner")).not.toHaveTextContent("Backlog draft");
  });

  it("reverts the column title on Escape", async () => {
    render(<KanbanBoard />);
    const input = within(getFirstColumn()).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "Discarded{Escape}");
    expect(input).toHaveValue("Backlog");
    expect(screen.getByRole("banner")).not.toHaveTextContent("Discarded");
  });

  it("reverts an empty column title", async () => {
    render(<KanbanBoard />);
    const input = within(getFirstColumn()).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.tab();
    expect(input).toHaveValue("Backlog");
  });

  it("adds and removes a card", async () => {
    render(<KanbanBoard />);
    const column = getFirstColumn();
    const addButton = within(column).getByRole("button", {
      name: /add a card/i,
    });
    await userEvent.click(addButton);

    const titleInput = within(column).getByPlaceholderText(/card title/i);
    await userEvent.type(titleInput, "New card");
    const detailsInput = within(column).getByPlaceholderText(/details/i);
    await userEvent.type(detailsInput, "Notes");

    await userEvent.click(within(column).getByRole("button", { name: /add card/i }));

    expect(within(column).getByText("New card")).toBeInTheDocument();

    const deleteButton = within(column).getByRole("button", {
      name: /delete new card/i,
    });
    await userEvent.click(deleteButton);

    expect(within(column).queryByText("New card")).not.toBeInTheDocument();
  });

  it("adds a card with default details", async () => {
    render(<KanbanBoard />);
    const column = getFirstColumn();
    await userEvent.click(within(column).getByRole("button", { name: /add a card/i }));
    await userEvent.type(within(column).getByPlaceholderText(/card title/i), "Bare");
    await userEvent.click(within(column).getByRole("button", { name: /add card/i }));
    expect(within(column).getByText("No details yet.")).toBeInTheDocument();
  });

  it("does not add a card with a blank title", async () => {
    render(<KanbanBoard />);
    const column = getFirstColumn();
    await userEvent.click(within(column).getByRole("button", { name: /add a card/i }));
    await userEvent.type(within(column).getByPlaceholderText(/card title/i), "   ");
    await userEvent.click(within(column).getByRole("button", { name: /add card/i }));
    expect(within(column).getAllByTestId(/card-/)).toHaveLength(2);
  });

  it("cancels adding a card and clears the form", async () => {
    render(<KanbanBoard />);
    const column = getFirstColumn();
    await userEvent.click(within(column).getByRole("button", { name: /add a card/i }));
    await userEvent.type(within(column).getByPlaceholderText(/card title/i), "Draft");
    await userEvent.click(within(column).getByRole("button", { name: /cancel/i }));
    expect(within(column).queryByPlaceholderText(/card title/i)).not.toBeInTheDocument();

    await userEvent.click(within(column).getByRole("button", { name: /add a card/i }));
    expect(within(column).getByPlaceholderText(/card title/i)).toHaveValue("");
  });

  it("edits a card", async () => {
    render(<KanbanBoard />);
    await userEvent.click(
      screen.getByRole("button", { name: "Edit Align roadmap themes" })
    );
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
  });

  it("cancels editing a card", async () => {
    render(<KanbanBoard />);
    await userEvent.click(
      screen.getByRole("button", { name: "Edit Align roadmap themes" })
    );
    const card = screen.getByTestId("card-card-1");
    await userEvent.type(within(card).getByLabelText("Card title"), " changed");
    await userEvent.click(within(card).getByRole("button", { name: /cancel/i }));
    expect(within(card).getByText("Align roadmap themes")).toBeInTheDocument();
  });

  it("does not save a card with a blank title", async () => {
    render(<KanbanBoard />);
    await userEvent.click(
      screen.getByRole("button", { name: "Edit Align roadmap themes" })
    );
    const card = screen.getByTestId("card-card-1");
    const title = within(card).getByLabelText("Card title");
    await userEvent.clear(title);
    await userEvent.type(title, "   ");
    await userEvent.click(within(card).getByRole("button", { name: /save/i }));
    expect(within(card).getByLabelText("Card title")).toBeInTheDocument();
  });
});
