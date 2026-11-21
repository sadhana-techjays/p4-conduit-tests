import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

// Makes a fresh practice user through the API and returns it (with its sign-in token).
async function newUser(request: APIRequestContext) {
  const id = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const response = await request.post('/api/users', {
    data: { user: { username: `user-${id}`, email: `user-${id}@example.com`, password: 'Practice123' } },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).user;
}

// Puts the sign-in token where the page looks for it, before the page's own script runs.
async function signIn(page: Page, token: string) {
  await page.addInitScript((t) => window.localStorage.setItem('jwtToken', t), token);
}

// What each test made, so afterEach can clean it up even if the test itself fails.
// createdArticleSlug: an article the test itself published (deleted after the test).
// slug + commentId: a comment the test posted (deleted after the test; the article it is on is left alone
// when the test did not create that article, as in the comment test below, which comments on a seeded article).
let made: { token?: string; createdArticleSlug?: string; slug?: string; commentId?: number } = {};
test.beforeEach(() => { made = {}; });
test.afterEach(async ({ request }) => {
  if (made.commentId !== undefined && made.slug && made.token) {
    await request.delete(`/api/articles/${made.slug}/comments/${made.commentId}`, { headers: { Authorization: `Token ${made.token}` } });
  }
  if (made.createdArticleSlug && made.token) {
    await request.delete(`/api/articles/${made.createdArticleSlug}`, { headers: { Authorization: `Token ${made.token}` } });
  }
  // Known limitation: the user each test creates is NOT deleted here. API.md has no delete-user
  // endpoint (only articles and comments can be deleted), so there is no API call this cleanup can make for it.
});

test('a signed-in user publishes a new article in the editor', async ({ page, request }) => {
  const user = await newUser(request);
  made.token = user.token;
  await signIn(page, user.token);

  const title = `My practice article ${Date.now()}`;
  await page.goto('/editor');
  await page.getByRole('textbox', { name: 'Title' }).fill(title);
  await page.getByRole('textbox', { name: "What's this article about?" }).fill('A short description.');
  await page.getByRole('textbox', { name: 'Write your article' }).fill('The body of the article.');
  await page.getByRole('textbox', { name: 'Tags' }).fill('testing, playwright');
  await page.getByRole('button', { name: 'Publish Article' }).click();

  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
  const slug = page.url().split('/article/')[1];
  made.createdArticleSlug = slug;

  const response = await request.get(`/api/articles/${slug}`);
  expect(response.status()).toBe(200);
  const { article } = await response.json();
  expect(article.title).toBe(title);
  expect(article.description).toBe('A short description.');
  expect(article.body).toBe('The body of the article.');
  expect(article.tagList).toEqual(['testing', 'playwright']);
  expect(article.author.username).toBe(user.username);
});

test('a signed-in user posts a comment on an article', async ({ page, request }) => {
  const user = await newUser(request);
  made.token = user.token;
  await signIn(page, user.token);

  const slug = 'your-first-end-to-end-test';
  made.slug = slug;
  const commentBody = `A helpful comment ${Date.now()}`;
  await page.goto(`/article/${slug}`);
  await page.getByRole('textbox', { name: 'Write a comment' }).fill(commentBody);
  await page.getByRole('button', { name: 'Post Comment' }).click();

  // Found early (before the checks below) so afterEach can still delete the comment if a check fails.
  const forCleanup = await request.get(`/api/articles/${slug}/comments`);
  const postedForCleanup = (await forCleanup.json()).comments.find((c: { body: string; id: number }) => c.body === commentBody);
  made.commentId = postedForCleanup?.id;

  await expect(page.getByText(commentBody)).toBeVisible();

  const response = await request.get(`/api/articles/${slug}/comments`);
  expect(response.status()).toBe(200);
  const { comments } = await response.json();
  const posted = comments.find((c: { body: string }) => c.body === commentBody);
  expect(posted).toBeTruthy();
  expect(posted.author.username).toBe(user.username);
});
