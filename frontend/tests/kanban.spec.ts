import { expect, test, type Locator, type Page } from "@playwright/test";

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

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("loads the kanban board", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
});

test("adds a card to a column", async ({ page }) => {
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill("Playwright card");
  await firstColumn.getByPlaceholder("Details").fill("Added via e2e.");
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await expect(firstColumn.getByText("Playwright card")).toBeVisible();
});

test("edits a card", async ({ page }) => {
  await page.getByRole("button", { name: "Edit Align roadmap themes", exact: true }).click();
  const card = page.getByTestId("card-card-1");
  await card.getByLabel("Card title").fill("Edited title");
  await card.getByLabel("Card details").fill("Edited details");
  await card.getByRole("button", { name: "Save" }).click();
  await expect(card.getByText("Edited title")).toBeVisible();
  await expect(card.getByText("Edited details")).toBeVisible();
});

test("deletes a card", async ({ page }) => {
  await page.getByRole("button", { name: "Delete Align roadmap themes", exact: true }).click();
  await expect(page.getByTestId("card-card-1")).toHaveCount(0);
});

test("renames a column", async ({ page }) => {
  const input = page.getByTestId("column-col-backlog").getByLabel("Column title");
  await input.fill("Ideas");
  await input.press("Enter");
  await expect(page.locator("header")).toContainText("Ideas");
});

test("moves a card between columns", async ({ page }) => {
  const targetColumn = page.getByTestId("column-col-review");
  await drag(page, page.getByTestId("card-card-1"), targetColumn, 120);
  await expect(targetColumn.getByTestId("card-card-1")).toBeVisible();
});

test("reorders cards within a column", async ({ page }) => {
  const column = page.getByTestId("column-col-backlog");
  await drag(page, page.getByTestId("card-card-2"), page.getByTestId("card-card-1"));
  await expect(column.locator('[data-testid^="card-"]').first()).toHaveAttribute(
    "data-testid",
    "card-card-2"
  );
});
