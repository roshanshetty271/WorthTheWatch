import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Homepage', () => {
  test('renders with correct title and hero heading', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/Worth the Watch/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText('another bad movie')).toBeVisible();
  });

  test('displays movie sections with real data', async ({ page }) => {
    await page.goto('/');

    const sectionHeadings = page.getByRole('heading', { level: 2 });
    await expect(sectionHeadings.first()).toBeVisible({ timeout: 15_000 });

    const count = await sectionHeadings.count();
    expect(count).toBeGreaterThanOrEqual(1);

    const movieCards = page.locator('a[href^="/movie/"]');
    await expect(movieCards.first()).toBeVisible();
  });

  test('search bar is visible and accepts input', async ({ page }) => {
    await page.goto('/');

    const searchInput = page.getByPlaceholder(/search any movie/i);
    await expect(searchInput).toBeVisible();

    await searchInput.fill('Inception');
    await expect(searchInput).toHaveValue('Inception');
  });

  test('search submission navigates to search results page', async ({ page }) => {
    await page.goto('/');

    const searchInput = page.getByPlaceholder(/search any movie/i);
    await searchInput.fill('Interstellar');
    await searchInput.press('Enter');

    await expect(page).toHaveURL(/\/search\?q=Interstellar/);
  });

  test('navbar has correct navigation links', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');

    await expect(page.getByRole('link', { name: /Discover/i }).first()).toBeVisible();
    await expect(page.getByText('Movie Battle').first()).toBeVisible();
    await expect(page.getByText(/My List/i).first()).toBeVisible();
  });

  test('clicking a movie card navigates to its review page', async ({ page }) => {
    await page.goto('/');

    const firstCard = page.locator('a[href^="/movie/"]').first();
    await expect(firstCard).toBeVisible();

    const href = await firstCard.getAttribute('href');
    await firstCard.click();

    await expect(page).toHaveURL(new RegExp(href!.replace(/[?]/g, '\\?')));
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('passes critical accessibility checks', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(['color-contrast'])
      .analyze();

    const critical = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );

    if (critical.length > 0) {
      const summary = critical
        .map((v) => `[${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} nodes)`)
        .join('\n');
      expect(critical, `Accessibility violations:\n${summary}`).toHaveLength(0);
    }
  });
});
