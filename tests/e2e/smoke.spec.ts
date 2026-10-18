import { expect, test } from "@playwright/test";

test.describe("i18n / RTL", () => {
  test("Arabic is the default and renders RTL", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/ar\/?$/);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("كل غرام");
  });

  test("English renders LTR and the switcher keeps the page", async ({ page }) => {
    await page.goto("/ar/shop");
    await page.getByRole("button", { name: "English" }).click();
    await expect(page).toHaveURL(/\/en\/shop/);
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  });
});

test.describe("shop", () => {
  test("guest can add a product to the cart", async ({ page }) => {
    await page.goto("/en/shop");
    await page.locator('a[href*="/en/shop/demo-"]').first().click();
    await page.getByRole("button", { name: /add to cart/i }).click();
    await expect(page.locator("#cart-icon")).toContainText("1");
    await page.goto("/en/cart");
    await expect(page.getByRole("link", { name: /checkout/i })).toBeVisible();
  });
});

test.describe("test accounts + mocked membership checkout", () => {
  test("test member subscribes through the simulator and becomes active", async ({ page }) => {
    await page.goto("/en/signin");
    await page.getByTestId("test-member-login").click();
    await expect(page).toHaveURL(/\/en\/account/);

    await page.goto("/en/packages");
    await page.getByRole("button", { name: /join pro/i }).first().click();
    await expect(page).toHaveURL(/checkout\/simulate/);
    await page.getByRole("button", { name: /simulated/i }).click();

    await expect(page).toHaveURL(/account\/membership/);
    await expect(page.getByText("Active").first()).toBeVisible({ timeout: 20_000 });
  });

  test("test admin sees the subscriptions dashboard with days left", async ({ page }) => {
    await page.goto("/en/signin");
    await page.getByTestId("test-admin-login").click();
    await expect(page).toHaveURL(/\/en\/admin/);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await page.goto("/en/admin/subscriptions");
    await expect(page.getByRole("columnheader", { name: "Days left" })).toBeVisible();
  });
});
