import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

const ADMIN_ROUTES: [string, RegExp][] = [
  ["/", /Dashboard/],
  ["/inventory", /Inventory/],
  ["/inbound", /Inbound/],
  ["/outbound", /Outbound/],
  ["/counts", /Cycle counts/],
  ["/products", /Products/],
  ["/locations", /Locations/],
  ["/reports", /Reports/],
  ["/settings", /Settings/],
  ["/settings/reference", /Reference data/],
  ["/settings/audit", /Audit log/],
];

test("admin can open every core screen", async ({ page }) => {
  await signIn(page, /Admin/);

  for (const [path, heading] of ADMIN_ROUTES) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }
});

test("admin can export CSV", async ({ page }) => {
  await signIn(page, /Admin/);
  const response = await page.request.get("/api/exports/stock");

  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("text/csv");
  expect(await response.text()).toContain("SKU");
});

test("operator cannot export CSV", async ({ page }) => {
  await signIn(page, /Operator/);
  expect((await page.request.get("/api/exports/stock")).status()).toBe(403);
});
