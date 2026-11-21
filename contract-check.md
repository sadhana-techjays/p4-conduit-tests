# My schema, auth and contract checks (week 4, project P4)

App: Conduit practice app on my laptop · Date: 2026-11-21

## 1. My first look
How I would check that an article answer has the right shape: I'd check that the response contains all the fields listed in API.md. That way, if a field is removed or renamed in a future version, the test will fail.

## 2. Practice: the key list check
File: `P4/materials/contract-example.spec.ts` (the sign-up answer).
Three changes: `bio` is missing · a new field `password` is added · `token` becomes a number.
- **The toMatchObject check (worked example):** missing: passes · new field: passes · number: fails
- **The key list check (my answer):** missing (bio removed) → fails · new field (password added) → fails · number (token becomes a number) → passes

## 3. My prompt for Claude
```text
Task: Write Playwright API tests in P4/tests/contract.spec.ts. Schema checks: the answers of GET /api/articles/:slug and GET /api/user have the shape that API.md gives, checked with toMatchObject and expect.any. Auth tests: no token, a wrong token, and changing someone else's article. After the file, write one line per test: what it checks.
Material: @P4/API.md @P4/tests/example.spec.ts Send requests with the request fixture, like this example.
Rules: Write the tests from API.md only. Do not read the app's code in P4/app. Do not run the tests. Check both the response shape and the exact field types from API.md. Use toMatchObject with expect.any, and also check the key list so missing or extra fields are caught.
```

## 4. Claude's tests and my run
- **Run:** `npx playwright test tests/contract.spec.ts` · **Result:** 5 passed, 0 failed
- **A red test, and who was wrong:** No test failed.

## 5. The teammate's question
My own article test already had exact key lists, from my rule. So I answered about a test from another run.
- **Claude's test:** "GET /api/articles/:slug answers with the Article shape"
- **Claude said:** "an anonymous reader gets 200 and the full Article shape."
- **My answer:** No. This test would still pass. It uses toMatchObject, which only checks the fields it lists. If a new field like password is added, the test won't notice it. We'd need an exact key list check to catch extra fields like that.

## 6. My change
My own file needed no change (my article test already had an exact key list). The line I would send Claude for the other test:
- **What I asked Claude:** "In @P4/tests/contract.spec.ts, the test GET /api/articles/:slug answers with the Article shape only checks part of the schema with toMatchObject. Add an exact key list check using the fields from API.md so the test fails if extra fields are added or expected fields are missing. Do not run the tests."
- **The run after it:** no change was made; my run stayed 5 passed, 0 failed

## 7. Proof: the contract test fails when the answer changes
- **My prediction before the run:** "GET /api/articles/:slug answers the Article shape from API.md". F2 removes a field from the article response. This test checks the article shape against API.md, so it should fail when a required field is missing.
- **Run with the practice fault F2 on:** `$env:CONDUIT_FAULT = "F2"`, then `npx playwright test tests/contract.spec.ts` · **Result:** 1 failed, 4 passed. Failed: "GET /api/articles/:slug answers the Article shape from API.md"
- **What Playwright showed:** the key list (line 66): `- Expected - 1`, `+ Received + 0`, `-   "body",`
- **My answer about a red test:** The fault removed the body field. I can see that because body is in the Expected list, but it's missing from the Received list. That's why the key list check failed.
- **Run with the fault off again:** `$env:CONDUIT_FAULT = ""`, then the same run · **Result:** 5 passed, 0 failed
