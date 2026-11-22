// spec: API.md
// seed: tests/seed.spec.ts

import { test, expect, type APIRequestContext } from '@playwright/test';

// Makes a fresh practice user through the API and returns it (with its sign-in token).
async function newUser(request: APIRequestContext) {
  const id = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const response = await request.post('http://127.0.0.1:3000/api/users', {
    data: { user: { username: `user-${id}`, email: `user-${id}@example.com`, password: 'Practice123' } },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).user;
}

// A seeded article this app ships with (see tests/e2e.spec.ts), used only to read/post comments on.
const slug = 'your-first-end-to-end-test';

// What each test made, so afterEach can clean it up even if the test itself fails.
let made: { token?: string; commentId?: number } = {};
test.beforeEach(() => { made = {}; });
test.afterEach(async ({ request }) => {
  if (made.commentId !== undefined && made.token) {
    await request.delete(`http://127.0.0.1:3000/api/articles/${slug}/comments/${made.commentId}`, {
      headers: { Authorization: `Token ${made.token}` },
    });
  }
  // Known limitation: the user each test creates is NOT deleted here. API.md has no delete-user
  // endpoint (only articles and comments can be deleted), so there is no API call this cleanup can make for it.
});

test.describe('Comments API', () => {
  test('a posted comment is saved and appears in the comments list with the correct content and author', async ({ request }) => {
    const user = await newUser(request);
    made.token = user.token;

    const commentBody = `A helpful comment ${Date.now()}`;
    const postResponse = await request.post(`http://127.0.0.1:3000/api/articles/${slug}/comments`, {
      data: { comment: { body: commentBody } },
      headers: { Authorization: `Token ${user.token}` },
    });
    expect(postResponse.status()).toBe(201);
    const { comment } = await postResponse.json();
    made.commentId = comment.id;
    expect(comment.body).toBe(commentBody);
    expect(comment.author.username).toBe(user.username);

    const listResponse = await request.get(`http://127.0.0.1:3000/api/articles/${slug}/comments`);
    expect(listResponse.status()).toBe(200);
    const { comments } = await listResponse.json();
    const posted = comments.find((c: { id: number }) => c.id === comment.id);
    expect(posted).toBeTruthy();
    expect(posted.body).toBe(commentBody);
    expect(posted.author.username).toBe(user.username);
  });

  test('posting a comment with no body is rejected and nothing is added to the list', async ({ request }) => {
    const user = await newUser(request);
    made.token = user.token;

    const before = await request.get(`http://127.0.0.1:3000/api/articles/${slug}/comments`);
    const { comments: beforeComments } = await before.json();

    const postResponse = await request.post(`http://127.0.0.1:3000/api/articles/${slug}/comments`, {
      data: { comment: {} },
      headers: { Authorization: `Token ${user.token}` },
    });
    expect(postResponse.status()).toBe(422);
    const { errors } = await postResponse.json();
    expect(Array.isArray(errors.body)).toBe(true);
    expect(errors.body.length).toBeGreaterThan(0);

    const after = await request.get(`http://127.0.0.1:3000/api/articles/${slug}/comments`);
    const { comments: afterComments } = await after.json();
    expect(afterComments.length).toBe(beforeComments.length);
  });
});
