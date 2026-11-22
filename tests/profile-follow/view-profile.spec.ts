// spec: specs/profile-follow.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Profile Page', () => {
  test('View author profile page content', async ({ page }) => {
    // 1. Navigate to http://127.0.0.1:3000/profile/practice-author without signing in
    await page.goto('http://127.0.0.1:3000/profile/practice-author');
    await expect(page.getByRole('heading', { name: 'practice-author' })).toBeVisible();

    // 2. Check the profile bio text below the username
    await expect(page.getByText('I write about testing and quality.', { exact: true })).toBeVisible();

    // 3. Check the 'My Articles' and 'Favorited Articles' tabs in the profile navigation
    const myArticlesTab = page.getByRole('link', { name: 'My Articles' });
    const favoritedArticlesTab = page.getByRole('link', { name: 'Favorited Articles' });
    await expect(myArticlesTab).toBeVisible();
    await expect(favoritedArticlesTab).toBeVisible();
    await expect(myArticlesTab).toHaveAttribute('href', '/profile/practice-author');
    await expect(favoritedArticlesTab).toHaveAttribute('href', '/profile/practice-author/favorites');

    // 4. Check the article list under 'My Articles'
    await expect(page.getByRole('link', { name: 'Your first end-to-end test' })).toBeVisible();
    await expect(page.getByText('practice-author · 7 February 2026 · ♥ 2')).toBeVisible();

    // 5. Confirm no Follow/Unfollow button is shown for this anonymous (signed-out) visitor
    await expect(page.getByRole('button', { name: 'Follow practice-author' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Unfollow practice-author' })).toHaveCount(0);
  });
});
