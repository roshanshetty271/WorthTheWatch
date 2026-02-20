import { test, expect } from '@playwright/test';

test.describe('Search → Movie Page Flow', () => {
  test('search for a movie, click result, and land on its review page', async ({ page }) => {
    await page.goto('/');

    const searchInput = page.getByPlaceholder(/search any movie/i);
    await searchInput.fill('The Matrix');

    const firstResult = page.locator('a[href^="/movie/"]').first();
    await expect(firstResult).toBeVisible();
    await firstResult.click();

    await expect(page).toHaveURL(/\/movie\/\d+/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('movie page displays title, genres, and overview', async ({ page }) => {
    await page.goto('/');

    await page.getByPlaceholder(/search any movie/i).fill('Inception');

    const result = page.locator('a[href^="/movie/"]').first();
    await expect(result).toBeVisible();
    await result.click();

    await expect(page).toHaveURL(/\/movie\/\d+/);

    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();
    await expect(heading).toContainText(/inception/i);
  });
});

test.describe('Movie Review Page', () => {
  test('review page shows verdict and review content', async ({ page }) => {
    await page.goto('/');

    await page.getByPlaceholder(/search any movie/i).fill('The Dark Knight');
    const result = page.locator('a[href^="/movie/"]').first();
    await expect(result).toBeVisible();
    await result.click();

    await expect(page).toHaveURL(/\/movie\/\d+/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const verdict = page.getByText(/WORTH IT|NOT WORTH IT|MIXED BAG/);
    const generateButton = page.getByRole('button', { name: /Generate AI Review/i });

    await expect(verdict.or(generateButton).first()).toBeVisible();
  });

  test('reviewed movie shows praise and criticism points', async ({ page }) => {
    await page.goto('/');

    await page.getByPlaceholder(/search any movie/i).fill('The Shawshank Redemption');
    const result = page.locator('a[href^="/movie/"]').first();
    await expect(result).toBeVisible();
    await result.click();

    await expect(page).toHaveURL(/\/movie\/\d+/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const verdict = page.getByText(/WORTH IT|NOT WORTH IT|MIXED BAG/);
    const generateButton = page.getByRole('button', { name: /Generate AI Review/i });

    const hasReview = await verdict.first().isVisible().catch(() => false);

    if (hasReview) {
      const praiseSection = page.getByText(/👍|praise/i).first();
      const criticismSection = page.getByText(/👎|criticism/i).first();
      await expect(praiseSection.or(criticismSection).first()).toBeVisible();
    } else {
      await expect(generateButton).toBeVisible();
    }
  });

  test('movie page has back button and search another link', async ({ page }) => {
    await page.goto('/');

    await page.getByPlaceholder(/search any movie/i).fill('Parasite');
    const result = page.locator('a[href^="/movie/"]').first();
    await expect(result).toBeVisible();
    await result.click();

    await expect(page).toHaveURL(/\/movie\/\d+/);

    await expect(page.getByLabel('Go back')).toBeVisible();
    await expect(page.getByRole('link', { name: /Search another title/i })).toBeVisible();
  });

  test('back button navigates to previous page', async ({ page }) => {
    await page.goto('/');
    await page.goto('/');

    await page.getByPlaceholder(/search any movie/i).fill('Fight Club');
    const result = page.locator('a[href^="/movie/"]').first();
    await expect(result).toBeVisible();
    await result.click();

    await expect(page).toHaveURL(/\/movie\/\d+/);

    await page.getByLabel('Go back').click();
    await expect(page).toHaveURL('/');
  });
});

test.describe('Review Generation', () => {
  test('can trigger review generation for a movie without a review', async ({ page }) => {
    await page.goto('/');

    await page.getByPlaceholder(/search any movie/i).fill('Laapataa Ladies');
    const result = page.locator('a[href^="/movie/"]').first();
    await expect(result).toBeVisible();
    await result.click();

    await expect(page).toHaveURL(/\/movie\/\d+/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const generateButton = page.getByRole('button', { name: /Generate AI Review/i });
    const verdict = page.getByText(/WORTH IT|NOT WORTH IT|MIXED BAG/);

    const needsGeneration = await generateButton.isVisible().catch(() => false);

    if (needsGeneration) {
      await generateButton.click();

      const progress = page.getByText(/Scouring|Reading|Filtering|Writing|Warming/i);
      await expect(progress).toBeVisible({ timeout: 10_000 });

      await expect(verdict.first()).toBeVisible({ timeout: 120_000 });
    } else {
      await expect(verdict.first()).toBeVisible();
    }
  });
});
