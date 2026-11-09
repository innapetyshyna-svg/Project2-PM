import { execSync } from "node:child_process";
import { expect, test, type Locator, type Page } from "@playwright/test";

// Tests run against the real database, so every card they create starts with
// this prefix and is deleted afterwards, leaving the user's own cards alone.
const PREFIX = "e2e";

type ApiBoard = {
  columns: { id: number; title: string; cards: { id: number; title: string }[] }[];
};

const uniqueTitle = (name: string) =>
  `${PREFIX} ${name} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const columns = (page: Page) => page.locator('[data-testid^="column-"]');

const cardByTitle = (scope: Page | Locator, title: string) => {
  const page = "page" in scope ? scope.page() : scope;
  return scope
    .locator('[data-testid^="card-"]')
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
};

const signIn = async (page: Page) => {
  await page.goto("/");
  await page.getByLabel("Username").fill("user");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(columns(page)).toHaveCount(5);
};

const addCard = async (page: Page, columnIndex: number, title: string, details = "") => {
  const column = columns(page).nth(columnIndex);
  await column.getByRole("button", { name: /add a card/i }).click();
  await column.getByPlaceholder("Card title").fill(title);
  await column.getByPlaceholder("Details").fill(details);
  await column.getByRole("button", { name: /add card/i }).click();
  await expect(cardByTitle(column, title)).toBeVisible();
};

const drag = async (page: Page, source: Locator, target: Locator, offsetY?: number) => {
  await source.scrollIntoViewIfNeeded();
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) {
    throw new Error("Unable to resolve drag coordinates.");
  }
  await page.mouse.move(
    sourceBox.x + sourceBox.width / 2,
    sourceBox.y + sourceBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + (offsetY ?? targetBox.height / 2), {
    steps: 12,
  });
  await page.mouse.up();
};

const getBoard = async (page: Page): Promise<ApiBoard> =>
  (await page.request.get("/api/board")).json();

const waitForSave = (page: Page, method: string) =>
  page.waitForResponse(
    (response) => response.url().includes("/api/") && response.request().method() === method
  );

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test.afterEach(async ({ page }) => {
  const board = await getBoard(page);
  for (const column of board.columns) {
    for (const card of column.cards) {
      if (card.title.startsWith(PREFIX)) {
        await page.request.delete(`/api/cards/${card.id}`);
      }
    }
  }
});

test("loads the kanban board", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
  await expect(columns(page)).toHaveCount(5);
});

test("added card persists after reload", async ({ page }) => {
  const title = uniqueTitle("add");
  await addCard(page, 0, title, "Added via e2e.");
  await page.reload();
  const card = cardByTitle(columns(page).nth(0), title);
  await expect(card).toBeVisible();
  await expect(card).toContainText("Added via e2e.");
});

test("edited card persists after reload", async ({ page }) => {
  const title = uniqueTitle("edit");
  const edited = uniqueTitle("edited");
  await addCard(page, 0, title);
  const card = cardByTitle(page, title);
  await card.getByRole("button", { name: `Edit ${title}`, exact: true }).click();
  const form = page.getByTestId(/^card-/).filter({ has: page.getByLabel("Card title") });
  await form.getByLabel("Card title").fill(edited);
  await form.getByLabel("Card details").fill("Edited details");
  const saved = waitForSave(page, "PATCH");
  await form.getByRole("button", { name: "Save" }).click();
  await saved;
  await page.reload();
  await expect(cardByTitle(page, edited)).toContainText("Edited details");
  await expect(cardByTitle(page, title)).toHaveCount(0);
});

test("deleted card stays deleted after reload", async ({ page }) => {
  const title = uniqueTitle("delete");
  await addCard(page, 0, title);
  const saved = waitForSave(page, "DELETE");
  await page.getByRole("button", { name: `Delete ${title}`, exact: true }).click();
  await saved;
  await expect(cardByTitle(page, title)).toHaveCount(0);
  await page.reload();
  await expect(columns(page)).toHaveCount(5);
  await expect(cardByTitle(page, title)).toHaveCount(0);
});

test("renamed column persists after reload", async ({ page }) => {
  const input = columns(page).nth(1).getByLabel("Column title");
  const original = await input.inputValue();
  const renamed = uniqueTitle("column");
  try {
    await input.fill(renamed);
    const saved = waitForSave(page, "PATCH");
    await input.press("Enter");
    await saved;
    await page.reload();
    await expect(columns(page).nth(1).getByLabel("Column title")).toHaveValue(renamed);
    await expect(page.locator("header")).toContainText(renamed);
  } finally {
    const board = await getBoard(page);
    await page.request.patch(`/api/columns/${board.columns[1].id}`, { data: { title: original } });
  }
});

test("card moved between columns persists after reload", async ({ page }) => {
  const title = uniqueTitle("move");
  await addCard(page, 0, title);
  const saved = waitForSave(page, "POST");
  await drag(page, cardByTitle(page, title), columns(page).nth(3), 120);
  await saved;
  await page.reload();
  await expect(cardByTitle(columns(page).nth(3), title)).toBeVisible();
  await expect(cardByTitle(columns(page).nth(0), title)).toHaveCount(0);
});

test("card reordered within a column persists after reload", async ({ page }) => {
  const first = uniqueTitle("first");
  const second = uniqueTitle("second");
  await addCard(page, 2, first);
  await addCard(page, 2, second);
  const saved = waitForSave(page, "POST");
  await drag(page, cardByTitle(page, second), cardByTitle(page, first));
  await saved;
  await page.reload();
  await expect(cardByTitle(page, first)).toBeVisible();
  const titles = await columns(page).nth(2).getByRole("heading", { level: 4 }).allTextContents();
  expect(titles.filter((title) => title === first || title === second)).toEqual([second, first]);
});

test("another login sees the same board", async ({ page, browser }) => {
  const title = uniqueTitle("shared");
  await addCard(page, 0, title);
  const otherContext = await browser.newContext();
  const otherPage = await otherContext.newPage();
  await signIn(otherPage);
  await expect(cardByTitle(otherPage, title)).toBeVisible();
  await otherContext.close();
});

test("data persists after container restart", async ({ page }) => {
  test.setTimeout(120_000);
  const title = uniqueTitle("restart");
  await addCard(page, 0, title);
  execSync("docker restart pm-app", { stdio: "ignore" });
  await expect(async () => {
    expect((await page.request.get("/api/health")).ok()).toBe(true);
  }).toPass({ timeout: 60_000 });
  await page.reload();
  await expect(cardByTitle(page, title)).toBeVisible();
});
