import { test, expect, request, APIRequestContext } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:3000';

let setupApi: APIRequestContext;
let userAToken: string;
let userAUsername: string;
let userBToken: string;
let articleSlug: string;

test.beforeAll(async () => {
  setupApi = await request.newContext({ baseURL: BASE_URL });
  const stamp = Date.now();

  const userA = await setupApi.post('/api/users', {
    data: {
      user: {
        username: `contract_a_${stamp}`,
        email: `contract_a_${stamp}@example.com`,
        password: 'password123',
      },
    },
  });
  const userAJson = await userA.json();
  userAToken = userAJson.user.token;
  userAUsername = userAJson.user.username;

  const userB = await setupApi.post('/api/users', {
    data: {
      user: {
        username: `contract_b_${stamp}`,
        email: `contract_b_${stamp}@example.com`,
        password: 'password123',
      },
    },
  });
  const userBJson = await userB.json();
  userBToken = userBJson.user.token;

  const article = await setupApi.post('/api/articles', {
    headers: { Authorization: `Token ${userAToken}` },
    data: {
      article: {
        title: `Contract test article ${stamp}`,
        description: 'A description for the contract test article',
        body: 'Body text for the contract test article',
        tagList: ['contract'],
      },
    },
  });
  const articleJson = await article.json();
  articleSlug = articleJson.article.slug;
});

test.afterAll(async () => {
  await setupApi.dispose();
});

test('GET /api/articles/:slug answers the Article shape from API.md', async ({ request }) => {
  const response = await request.get(`/api/articles/${articleSlug}`);
  expect(response.status()).toBe(200);

  const json = await response.json();

  expect(Object.keys(json).sort()).toEqual(['article']);
  expect(Object.keys(json.article).sort()).toEqual(
    [
      'slug',
      'title',
      'description',
      'body',
      'tagList',
      'createdAt',
      'updatedAt',
      'favorited',
      'favoritesCount',
      'author',
    ].sort(),
  );
  expect(Object.keys(json.article.author).sort()).toEqual(
    ['username', 'bio', 'image', 'following'].sort(),
  );

  expect(json).toMatchObject({
    article: {
      slug: expect.any(String),
      title: expect.any(String),
      description: expect.any(String),
      body: expect.any(String),
      tagList: expect.any(Array),
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
      favorited: expect.any(Boolean),
      favoritesCount: expect.any(Number),
      author: {
        username: expect.any(String),
        bio: null,
        image: null,
        following: expect.any(Boolean),
      },
    },
  });
});

test('GET /api/user answers the User shape from API.md', async ({ request }) => {
  const response = await request.get('/api/user', {
    headers: { Authorization: `Token ${userAToken}` },
  });
  expect(response.status()).toBe(200);

  const json = await response.json();

  expect(Object.keys(json).sort()).toEqual(['user']);
  expect(Object.keys(json.user).sort()).toEqual(
    ['email', 'token', 'username', 'bio', 'image'].sort(),
  );

  expect(json).toMatchObject({
    user: {
      email: expect.any(String),
      token: expect.any(String),
      username: userAUsername,
      bio: null,
      image: null,
    },
  });
});

test('GET /api/user with no token answers 401 "token is missing"', async ({ request }) => {
  const response = await request.get('/api/user');
  expect(response.status()).toBe(401);

  const json = await response.json();
  expect(Object.keys(json).sort()).toEqual(['errors']);
  expect(json).toMatchObject({ errors: { token: ['is missing'] } });
});

test('GET /api/user with a wrong token answers 401 "token is invalid"', async ({ request }) => {
  const response = await request.get('/api/user', {
    headers: { Authorization: 'Token this-is-not-a-real-token' },
  });
  expect(response.status()).toBe(401);

  const json = await response.json();
  expect(Object.keys(json).sort()).toEqual(['errors']);
  expect(json).toMatchObject({ errors: { token: ['is invalid'] } });
});

test('PUT /api/articles/:slug by someone else\'s account answers 403', async ({ request }) => {
  const response = await request.put(`/api/articles/${articleSlug}`, {
    headers: { Authorization: `Token ${userBToken}` },
    data: { article: { title: 'Hijacked title' } },
  });
  expect(response.status()).toBe(403);

  const json = await response.json();
  expect(Object.keys(json).sort()).toEqual(['errors']);
  expect(json).toMatchObject({ errors: { article: ['forbidden'] } });
});
