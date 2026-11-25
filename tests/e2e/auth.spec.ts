import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("unauthenticated users are redirected to login", async ({ page }) => {
  await page.goto("/inventory");
  await expect(page).toHaveURL(/\/login(\?|$)/);
});

test("admin can open user management", async ({ page }) => {
  await signIn(page, /Admin/);
  await expect(page.getByText("Admin User")).toBeVisible();

  await page.goto("/settings/users");
  await expect(page.getByRole("heading", { name: "Users & roles" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create user" })).toBeVisible();
});

test("viewer cannot open user management", async ({ page }) => {
  await signIn(page, /Viewer/);

  await page.goto("/settings/users");
  await expect(page.getByRole("heading", { name: "Not authorised" })).toBeVisible();
  await expect(page.getByText("manageUsers")).toBeVisible();
});
