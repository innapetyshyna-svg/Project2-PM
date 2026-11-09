import { expect, test, type Page } from "@playwright/test";

const signIn = async (page: Page, password: string) => {
  await page.getByLabel("Username").fill("user");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
};

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("unauthenticated visit shows the login form", async ({ page }) => {
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(0);
});

test("wrong password shows an error", async ({ page }) => {
  await signIn(page, "wrong");
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Invalid username or password");
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(0);
});

test("correct login shows the board and survives reload", async ({ page }) => {
  await signIn(page, "password");
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
  await page.reload();
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
});

test("logout returns to the login form", async ({ page }) => {
  await signIn(page, "password");
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});
