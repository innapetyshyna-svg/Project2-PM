import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthGate } from "@/components/AuthGate";
import { sampleBoard } from "@/test/fakeApi";

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status });

const mockFetch = (signedIn: boolean) => {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === "/api/me") {
      return signedIn ? jsonResponse(200, { username: "user" }) : jsonResponse(401, {});
    }
    if (url === "/api/login") {
      const { password } = JSON.parse(init?.body as string);
      return password === "password"
        ? jsonResponse(200, { username: "user" })
        : jsonResponse(401, {});
    }
    if (url === "/api/board") {
      return jsonResponse(200, sampleBoard());
    }
    return jsonResponse(200, { status: "ok" });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

const signIn = async (password: string) => {
  await userEvent.type(await screen.findByLabelText("Username"), "user");
  await userEvent.type(screen.getByLabelText("Password"), password);
  await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AuthGate", () => {
  it("shows the login form when not signed in", async () => {
    mockFetch(false);
    render(<AuthGate />);
    expect(await screen.findByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByText("Kanban Studio", { selector: "h1" })).toBeInTheDocument();
    expect(screen.queryAllByTestId(/column-/)).toHaveLength(0);
  });

  it("shows the board when the session is active", async () => {
    mockFetch(true);
    render(<AuthGate />);
    expect(await screen.findAllByTestId(/column-/)).toHaveLength(5);
  });

  it("shows an error on wrong credentials", async () => {
    mockFetch(false);
    render(<AuthGate />);
    await signIn("wrong");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid username or password"
    );
    expect(screen.queryAllByTestId(/column-/)).toHaveLength(0);
  });

  it("shows the board after a correct login", async () => {
    const fetchMock = mockFetch(false);
    render(<AuthGate />);
    await signIn("password");
    expect(await screen.findAllByTestId(/column-/)).toHaveLength(5);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/login",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ username: "user", password: "password" }),
      })
    );
  });

  it("returns to the login form after logout", async () => {
    const fetchMock = mockFetch(true);
    render(<AuthGate />);
    await userEvent.click(await screen.findByRole("button", { name: "Log out" }));
    expect(await screen.findByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/logout", { method: "POST" });
  });
});
