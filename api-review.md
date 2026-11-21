# API review: Claude's first API tests (week 4, project P4)

- **App:** Conduit, the practice app on your own laptop (`http://127.0.0.1:3000`)
- **API description:** `P4/API.md`
- **Test file:** `P4/tests/api.spec.ts`, written by Claude
- **Prompt file:** `P4/prompts/api.md`

## 1. My first look, by hand
The request my comment sent in the app, and the status that came back.
- Request Method - POST, Status - 201 Created.

## 2. My predictions and the real answers
One line per request: what I predicted, and what the app really answered.
- **A** (a comment, with the token): I predicted 201. The app answered 201, with the comment "Clear and useful." and the author practice-reader.
- **B** (the same comment, with no token): I predicted 401, token is missing. The app answered 401, `{"errors":{"token":["is missing"]}}`.
- **C** (a comment on an article that does not exist): I predicted 404, not found. The app answered 404, `{"errors":{"article":["not found"]}}`.
- **The answer that surprised me most:** B surprised me the most. I expected a 401, but it was interesting to see the exact error message: "token is missing". The app checks for a token before allowing comments, so without it the request is rejected straight away.

## 3. My prompt to Claude
```text
Task: Write at least 6 Playwright API tests for articles in the Conduit API: create, read, change and delete an article. At least 3 positive and at least 3 negative tests. Save them in P4/tests/api.spec.ts. After the file, write one line per test: what it checks.
Material: @P4/API.md @P4/tests/example.spec.ts Send requests with the request fixture, like this example.
Rules: Write the tests from API.md only. Do not read the app's code in P4/app. Do not run the tests. Check both the status code and the response body. Don't only verify that the request succeeds or fails, make sure the response contains the expected article data or error message from API.md.
```

## 4. The run
- **Result:** `npx playwright test tests/api.spec.ts`: 9 passed, 0 failed.
- **A red test, and who is wrong:** No test failed.

## 5. The developer's question
The test I looked at, and my answer to: "So the app saved nothing, right?"
- **Test:** "rejects creating an article with a missing required field (negative)" (lines 65–81)
- **My answer:** Not really. The test proves that the API returned a 422 and the right error message. It doesn't prove that nothing was saved. We'd need an extra check to confirm the article wasn't created after the request failed.

## 6. Tests I reviewed with the API checklist
The API checklist: status · body · shape · negative cases (a refused request changes nothing) · own test data.

### "updates an article as its author (positive)" (lines 121–151)
- **My decision:** I'd change this test. It checks the status, the response body, and the slug change, but it changes data and never reads it back with a GET. To follow the checklist, I'd add a GET after the update.

### "rejects updating another user's article (negative)" (lines 153–181)
- **My decision:** I'd change this test. It's a negative test, so it should also do a GET afterwards to prove the article was not changed. Right now, it only proves the request was refused.

## 7. My API rules
The rules I added to my `playwright-quality` skill, under `## API rules`:
1. Check the exact status code and response body, not just whether the request passed or failed.
2. After a request creates, updates, or rejects data, do a GET and check that the data is in the expected state.
3. Make each test create and use its own data, so it doesn't depend on data from another test.
