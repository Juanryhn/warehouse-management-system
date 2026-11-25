import { expect, type Page } from "@playwright/test";

export const signIn = async (page: Page, label: RegExp): Promise<void> => {
  await page.goto("/login");
  await page.getByRole("button", { name: label }).click();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);
};
