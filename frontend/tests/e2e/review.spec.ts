import { test, expect } from '@playwright/test';

test.describe('Movie Review Page', () => {
  test('movie page displays title and metadata', async ({ page }) => {
    await page.goto('/movie/603');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/matrix/i);
  });

  test('review page shows verdict or generate button', async ({ page }) => {
    await page.goto('/movie/155');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 });

    const verdict = page.getByText(/WORTH IT|NOT WORTH IT|MIXED BAG/);
    const generateButton = page.getByRole('button', { name: /Generate/i });

    await expect(verdict.or(generateButton).first()).toBeVisible({ timeout: 15_000 });
  });

  test('reviewed movie shows review content', async ({ page }) => {
    await page.goto('/movie/278');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 });

    const verdict = page.getByText(/WORTH IT|NOT WORTH IT|MIXED BAG/);
    const generateButton = page.getByRole('button', { name: /Generate/i });

    const hasReview = await verdict.first().isVisible().catch(() => false);

    if (hasReview) {
      await expect(page.getByText(/The Internet.*Verdict/i)).toBeVisible();
    } else {
      await expect(generateButton).toBeVisible();
    }
  });

  test('movie page has navigation elements', async ({ page }) => {
    await page.goto('/movie/496243');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 });

    await expect(page.getByLabel('Go back').first()).toBeVisible();
    await expect(page.getByText(/Search another title/i)).toBeVisible();
  });

  test('back button navigates to previous page', async ({ page }) => {
    await page.goto('/');
    await page.goto('/movie/155');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 });

    await page.getByLabel('Go back').first().click();
    await expect(page).toHaveURL('/');
  });
});
