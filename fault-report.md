# My practice fault report (week 4, project P4)

App: Conduit practice app on my laptop · Practice faults: `P4/faults/practice.json` (F1 to F6) · Date: 2026-11-22
**How to read it:** a "detect" fault is **caught** when at least one test that passed with no fault fails with it, and **missed** when every test still passes. A "robust" fault (the app is only slower) should **stay green**; if tests fail, it **went red**.

## 1. My guess this morning
- **The developer asked:** "Your suite is green. How many real problems would it catch?"
- **My answer:** A passing test suite doesn't necessarily mean it catches all issues. I would introduce some intentional bugs and measure how many the existing tests detect to evaluate the suite's effectiveness.

## 2. Before: my suite against the practice faults
- **Command:** `node materials/faults-run.mjs` (TESTS terminal, in `P4`, with no app running)
- **My test files:** `api.spec.ts`, `contract.spec.ts`, `e2e.spec.ts`, `example.spec.ts`, `profile-follow/follow-author.spec.ts`, `profile-follow/view-profile.spec.ts`, `seed.spec.ts`
- **No fault:** 20 passed, 0 failed
- **F1** Opening an article gives a server error (500): caught (6 tests failed)
- **F2** The article answer has no body text: caught (3 tests failed)
- **F3** The article answer has a different title: caught (2 tests failed)
- **F4** The comments list is always empty: caught (1 test failed: e2e comment test)
- **F5** The article answer comes 3 seconds late: stayed green
- **F6** Posting a comment is refused (422) and nothing is saved: caught (1 test failed: e2e comment test)

## 3. The weak spot I chose, and why
F4 is a weak spot. Only one test catches it. We should add more checks to ensure the comments list correctly displays saved comments.

## 4. How I made the suite stronger
- **My request for Claude** (the New tests line of `P4/prompts/stronger.md`): Add more tests for the comments section in P4/tests/comments.spec.ts. Only one test currently checks comments. Add API tests to verify that a posted comment is saved and appears in the comments list with the correct content and author. Follow API.md and do not change existing tests. Keep the existing follow test changes, and apply "do not change existing tests" only to the other tests.
- **New or changed test file:** `tests/comments.spec.ts` (new), `tests/profile-follow/follow-author.spec.ts` (changed)

## 5. After: the run again
- **Command:** `node materials/faults-run.mjs F4`
- **No fault:** 22 passed, 0 failed
- **The fault I chose:** F4 The comments list is always empty: caught (2 tests failed: comments.spec.ts › a posted comment is saved and appears in the comments list with the correct content and author; e2e.spec.ts › a signed-in user posts a comment on an article)

## 6. What changed
The new test has made the suite stronger. F4 is now caught by two tests instead of one. We have better coverage and more confidence that comment-related issues will be detected.
