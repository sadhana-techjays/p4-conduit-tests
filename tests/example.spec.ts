import { test, expect } from '@playwright/test';

test('the API lists the popular tags', async ({ request }) => {
  const response = await request.get('/api/tags');

  expect(response.status()).toBe(200);
  const json = await response.json();
  expect(json.tags).toContain('testing');
});
