# My end-to-end tests and review (week 4, project P4)

App: Conduit practice app · Test file: `P4/tests/e2e.spec.ts` · Date: 2026-11-22

## 1. My first look
- **After I published an article by hand, I would check:** I would check that the newly published article appears in the Global Feed with the correct title, description, and article content.
- **Where the page keeps my sign-in:** jwtToken

## 2. Practice
- **Worked example (the like test):** it signs in through the form as a practice user, so other tests can change its data.
- **Does its check at the end prove the journey?** No. Line 19 only checks that the article heading is visible. It doesn't prove that the article was liked or that the Favorite button changed after clicking it.

## 3. My prompt
```text
Task: Write 2 end-to-end tests in P4/tests/e2e.spec.ts. Test 1: a signed-in user publishes a new article in the editor. Test 2: a signed-in user posts a comment on an article. Make a new user with the API, give the page its token, do the journey in the page, and check the result with the API at the end. After the file, write one line per test: what it checks.
Material: @P4/API.md @P4/app/public/app.js app.js is the page's code: take the labels and button names from it. The page keeps the sign-in token in localStorage, key jwtToken.
Rules: Use app.js only for the labels and button names. Do not change the app. Do not run the tests. At the end of each test, verify the result using the API: check that the published article or posted comment exists and contains the correct content.
```

## 4. The run
- **Claude's 2 tests:** `npx playwright test tests/e2e.spec.ts`: 2 passed, 0 failed.

## 5. The teammate's question
- **Claude said:** "Makes a fresh practice user through the API and returns it (with its sign-in token)." (line 3 of the file)
- **My answer:** No. Each test creates its own user and unique data, but that doesn't mean the app is clean after the run. The articles and comments may still remain in the database. We need cleanup or deletion if we want to leave the app clean.

## 6. What I saw on the home page
- My practice article 1795287372572

## 7. My change
- **My line to Claude:** In `@P4/tests/e2e.spec.ts`, the tests create new users, publish articles, and post comments, but they leave this test data in the application after running. Add cleanup using `test.afterEach` to delete the data created by each test, including the user, article, and comment where applicable. Make sure cleanup runs even if a test fails. Do not change the test scenarios or assertions. Do not run the tests.
- **My follow-up:** That's acceptable for now. Keep the cleanup for comments and articles in `test.afterEach`. Add a clear comment explaining that test users are not deleted because the API does not provide a delete-user endpoint. Treat this as a known limitation. Do not run the tests.
- **The clean-up Claude added:** `test.afterEach` deletes the comment and the article each test made. The test users stay (API.md has no delete-user endpoint).
- **A red test after the change:** with `--repeat-each=2`: 2 passed, 2 failed. "a signed-in user publishes a new article in the editor": Expected 200, Received 404.
- **Who was wrong:** the test. It reads the page address immediately after clicking Publish, before waiting for the article page to load. So the slug could be undefined or an incomplete value.
- **My fix line:** In `@P4/tests/e2e.spec.ts`, fix the publish test. It reads the page URL and extracts the article slug before waiting for the article page to load. Move the slug extraction to after the heading visibility check so the correct slug is captured. Keep the existing `test.afterEach` cleanup unchanged. Do not change the test scenario or assertions. Do not run the tests.

## 8. Proof
- **Each test twice, on an app that keeps its data:** `npx playwright test tests/e2e.spec.ts --repeat-each=2` → 4 passed, 0 failed
- **The newest article on the home page after the run:** 'Your first end-to-end test'
