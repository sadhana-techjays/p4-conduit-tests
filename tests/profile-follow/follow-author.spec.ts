// spec: specs/profile-follow.md
// seed: tests/seed.spec.ts

import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

// Makes a fresh practice user through the API and returns it (with its sign-in token).
async function newUser(request: APIRequestContext) {
  const id = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const response = await request.post('http://127.0.0.1:3000/api/users', {
    data: { user: { username: `user-${id}`, email: `user-${id}@example.com`, password: 'Practice123' } },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).user;
}

// Puts the sign-in token where the page looks for it, before the page's own script runs.
async function signIn(page: Page, token: string) {
  await page.addInitScript((t) => window.localStorage.setItem('jwtToken', t), token);
}

// What this test made, so afterEach can undo it even if the test itself fails.
let made: { token?: string } = {};
test.beforeEach(() => { made = {}; });
test.afterEach(async ({ request }) => {
  if (made.token) {
    await request.delete('http://127.0.0.1:3000/api/profiles/practice-author/follow', {
      headers: { Authorization: `Token ${made.token}` },
    });
  }
  // Known limitation: the user this test creates is NOT deleted here. API.md has no delete-user
  // endpoint (only articles and comments can be deleted), so there is no API call this cleanup can make for it.
});

test.describe('Profile Page', () => {
  test('Sign in as a different user and toggle following the author, and the follow state persists after a reload', async ({ page, request }) => {
    // 1. Create a fresh practice user through the API and sign in as them (no shared practice-reader account)
    const user = await newUser(request);
    made.token = user.token;
    await signIn(page, user.token);

    // 2. Navigate to http://127.0.0.1:3000/profile/practice-author
    await page.goto('http://127.0.0.1:3000/profile/practice-author');
    await expect(page.getByRole('heading', { name: 'practice-author' })).toBeVisible();
    const followButton = page.getByRole('button', { name: /^(Follow|Unfollow) practice-author$/ });
    await expect(followButton).toBeVisible();

    // 3. Read the current accessible name of the follow/unfollow button, then click it
    const initialName = (await followButton.textContent())!.trim();
    const flippedName = initialName === 'Follow practice-author'
      ? 'Unfollow practice-author'
      : 'Follow practice-author';
    await followButton.click();
    await expect(page.getByRole('button', { name: flippedName })).toBeVisible();

    // 4. Reload the page and confirm the follow state persisted (not just held in page state)
    await page.reload();
    await expect(page.getByRole('button', { name: flippedName })).toBeVisible();

    // Also confirm the persisted state through the API, matching the flipped button label
    const response = await request.get('http://127.0.0.1:3000/api/profiles/practice-author', {
      headers: { Authorization: `Token ${user.token}` },
    });
    expect(response.status()).toBe(200);
    const { profile } = await response.json();
    expect(profile.following).toBe(flippedName === 'Unfollow practice-author');
  });
});
