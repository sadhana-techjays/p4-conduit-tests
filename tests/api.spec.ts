import { test, expect, APIRequestContext } from '@playwright/test';

// Registers a brand-new user and returns their auth token and username,
// so each test works with its own user and does not clash with other runs.
async function registerUser(request: APIRequestContext) {
  const unique = `user_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  const response = await request.post('/api/users', {
    data: {
      user: {
        username: unique,
        email: `${unique}@example.com`,
        password: 'password123',
      },
    },
  });
  const json = await response.json();
  return { token: json.user.token as string, username: unique };
}

test.describe('Articles - create (POST /api/articles)', () => {
  test('creates an article with valid data and a token (positive)', async ({ request }) => {
    const { token, username } = await registerUser(request);

    const response = await request.post('/api/articles', {
      headers: { Authorization: `Token ${token}` },
      data: {
        article: {
          title: 'My First Article',
          description: 'A short description',
          body: 'The body text',
          tagList: ['testing', 'api'],
        },
      },
    });

    expect(response.status()).toBe(201);
    const json = await response.json();
    expect(json.article.title).toBe('My First Article');
    expect(json.article.description).toBe('A short description');
    expect(json.article.body).toBe('The body text');
    expect(json.article.tagList).toEqual(['testing', 'api']);
    expect(typeof json.article.slug).toBe('string');
    expect(json.article.slug.length).toBeGreaterThan(0);
    expect(json.article.favorited).toBe(false);
    expect(json.article.favoritesCount).toBe(0);
    expect(json.article.author.username).toBe(username);
  });

  test('rejects creating an article without a token (negative)', async ({ request }) => {
    const response = await request.post('/api/articles', {
      data: {
        article: {
          title: 'No Token Article',
          description: 'A short description',
          body: 'The body text',
        },
      },
    });

    expect(response.status()).toBe(401);
    const json = await response.json();
    expect(json.errors.token).toEqual(['is missing']);
  });

  test('rejects creating an article with a missing required field (negative)', async ({ request }) => {
    const { token } = await registerUser(request);

    const response = await request.post('/api/articles', {
      headers: { Authorization: `Token ${token}` },
      data: {
        article: {
          description: 'A short description',
          body: 'The body text',
        },
      },
    });

    expect(response.status()).toBe(422);
    const json = await response.json();
    expect(json.errors.title).toEqual(["can't be blank"]);
  });
});

test.describe('Articles - read (GET /api/articles/:slug)', () => {
  test('reads an existing article by its slug (positive)', async ({ request }) => {
    const { token, username } = await registerUser(request);
    const createResponse = await request.post('/api/articles', {
      headers: { Authorization: `Token ${token}` },
      data: {
        article: {
          title: 'Readable Article',
          description: 'Read me',
          body: 'Content to read',
          tagList: ['reading'],
        },
      },
    });
    const created = await createResponse.json();

    const response = await request.get(`/api/articles/${created.article.slug}`);

    expect(response.status()).toBe(200);
    const json = await response.json();
    expect(json.article.slug).toBe(created.article.slug);
    expect(json.article.title).toBe('Readable Article');
    expect(json.article.description).toBe('Read me');
    expect(json.article.body).toBe('Content to read');
    expect(json.article.author.username).toBe(username);
  });

  test('returns 404 for an article that does not exist (negative)', async ({ request }) => {
    const response = await request.get('/api/articles/this-slug-does-not-exist-xyz');

    expect(response.status()).toBe(404);
    const json = await response.json();
    expect(json.errors.article).toEqual(['not found']);
  });
});

test.describe('Articles - update (PUT /api/articles/:slug)', () => {
  test('updates an article as its author (positive)', async ({ request }) => {
    const { token } = await registerUser(request);
    const createResponse = await request.post('/api/articles', {
      headers: { Authorization: `Token ${token}` },
      data: {
        article: {
          title: 'Original Title',
          description: 'Original description',
          body: 'Original body',
        },
      },
    });
    const created = await createResponse.json();

    const response = await request.put(`/api/articles/${created.article.slug}`, {
      headers: { Authorization: `Token ${token}` },
      data: {
        article: {
          title: 'Updated Title',
          body: 'Updated body',
        },
      },
    });

    expect(response.status()).toBe(200);
    const json = await response.json();
    expect(json.article.title).toBe('Updated Title');
    expect(json.article.body).toBe('Updated body');
    expect(json.article.description).toBe('Original description');
    expect(json.article.slug).not.toBe(created.article.slug);
  });

  test('rejects updating another user\'s article (negative)', async ({ request }) => {
    const author = await registerUser(request);
    const otherUser = await registerUser(request);

    const createResponse = await request.post('/api/articles', {
      headers: { Authorization: `Token ${author.token}` },
      data: {
        article: {
          title: 'Not Yours',
          description: 'Owned by someone else',
          body: 'Original body',
        },
      },
    });
    const created = await createResponse.json();

    const response = await request.put(`/api/articles/${created.article.slug}`, {
      headers: { Authorization: `Token ${otherUser.token}` },
      data: {
        article: {
          title: 'Hijacked Title',
        },
      },
    });

    expect(response.status()).toBe(403);
    const json = await response.json();
    expect(json.errors.article).toEqual(['forbidden']);
  });
});

test.describe('Articles - delete (DELETE /api/articles/:slug)', () => {
  test('deletes an article as its author (positive)', async ({ request }) => {
    const { token } = await registerUser(request);
    const createResponse = await request.post('/api/articles', {
      headers: { Authorization: `Token ${token}` },
      data: {
        article: {
          title: 'Article To Delete',
          description: 'Will be deleted',
          body: 'Temporary body',
        },
      },
    });
    const created = await createResponse.json();

    const response = await request.delete(`/api/articles/${created.article.slug}`, {
      headers: { Authorization: `Token ${token}` },
    });

    expect(response.status()).toBe(204);
    const bodyText = await response.text();
    expect(bodyText).toBe('');

    const getResponse = await request.get(`/api/articles/${created.article.slug}`);
    expect(getResponse.status()).toBe(404);
  });

  test('rejects deleting an article without a token (negative)', async ({ request }) => {
    const { token } = await registerUser(request);
    const createResponse = await request.post('/api/articles', {
      headers: { Authorization: `Token ${token}` },
      data: {
        article: {
          title: 'Protected Article',
          description: 'Should not be deletable without a token',
          body: 'Body text',
        },
      },
    });
    const created = await createResponse.json();

    const response = await request.delete(`/api/articles/${created.article.slug}`);

    expect(response.status()).toBe(401);
    const json = await response.json();
    expect(json.errors.token).toEqual(['is missing']);
  });
});
