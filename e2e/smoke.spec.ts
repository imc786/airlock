import { expect, test } from "@playwright/test";

// Smoke test against the deployed preview (or a local server when PLAYWRIGHT_BASE_URL is unset).
test("home page renders and links back to the repo", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);

  await expect(page.getByRole("heading", { level: 1, name: "Airlock" })).toBeVisible();
  await expect(page.getByText(/you are looking at airlock@v\d+/)).toBeVisible();

  const repoLink = page.getByRole("link", { name: "View the repo" });
  await expect(repoLink).toHaveAttribute("href", "https://github.com/imc786/airlock");
});
