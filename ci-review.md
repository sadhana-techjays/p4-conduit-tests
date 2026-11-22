# My CI workflow and review (week 4, project P4)

Repository: the P4 folder · Workflow: `.github/workflows/playwright.yml` · Date: 2026-11-22

## 1. What my project needs
- **Node.js on my laptop (`node -v`):** v22.23.3
- **My whole suite on my laptop:** `npx playwright test` → 22 passed, 0 failed
- **What the GitHub computer needs (my words):**
  - Node.js v22.23.3. That's the version on which all 22 tests passed on my laptop.
  - Use npm ci to install the exact package versions from package-lock.json.
  - Chromium only (from the example)

## 2. My prompt to Claude
```text
Task: Write a GitHub Actions workflow that runs this Playwright suite on every push and keeps the HTML report. My GitHub repository is the P4 folder, so save it as P4/.github/workflows/playwright.yml. After the file, write one line for each step: what it does.
Material: @P4/package.json @P4/playwright.config.ts @P4/README.md
Rules: Use actions/checkout@v6, actions/setup-node@v6 and actions/upload-artifact@v6. Do not run anything. Do not commit or push. Use Node.js v22.23.3, install packages using npm ci, and install only Chromium, as used in my Playwright configuration.
```

## 3. What Claude's workflow got wrong for my project
- **Claude's workflow:** `node-version: 22.23.3` (lines 12–14). It matched my list, because my rule gave the version. In another run without a version rule, Claude wrote `node-version-file: package.json`, which installs the newest Node.js that fits `>=22.13`.
- **Claude said:** (no words about that line in my run)
- **My project needs:** Node.js v22.23.3. That's the version on which all 22 tests passed on my laptop.
- **My answer to the developer:** I wouldn't merge it yet. We should use the exact tested version to keep CI consistent with our local results. The project was tested on Node.js v22.23.3, not on newer versions.
- **My line to Claude:** In @P4/.github/workflows/playwright.yml, add a comment above the node-version: 22.23.3 line explaining that this is the exact Node.js version on which all 22 tests passed on my laptop. Do not change anything else. Do not run anything.

## 4. My reading of the workflow
- **When, where, the code and Node.js (lines 1–15):**
  - Lines 3–4: on: push means the workflow runs automatically whenever someone pushes code to GitHub.
  - Lines 6–8: jobs defines the job, and runs-on: ubuntu-latest means the tests run on a fresh Ubuntu machine hosted by GitHub.
  - Lines 9–10: steps lists the actions to perform. actions/checkout@v6 downloads the repository code so GitHub can access the project files.
  - Lines 12–15: actions/setup-node@v6 installs Node.js v22.23.3 on the GitHub computer so the tests run using the same version that worked on my laptop.
- **Packages, browser, tests and the report (lines 16–34):**
  - Lines 17–18: npm ci installs the exact package versions from package-lock.json.
  - Lines 20–21: Installs Playwright and only the Chromium browser, along with its required dependencies.
  - Lines 23–24: Runs the Playwright test suite.
  - Lines 25–26: Sets CI: true to let Playwright know the tests are running on a CI computer.
  - Lines 28–30: Uploads the HTML test report to GitHub, even if the tests fail (if: always()).
  - Lines 31–34: Names the report playwright-report, uploads the report folder, and keeps it for 30 days.

## 5. The first run on GitHub
- **Run:** Add the CI workflow · **Result:** Green tick · **Tests:** 22 tests passed
- **The report (artifact):** playwright-report is listed under Artifacts: Yes

## 6. A red run on purpose
- **The change:** `tests/example.spec.ts` line 6, `toBe(200)` → `toBe(201)`
- **My prediction:** The "Run Playwright tests" step will turn red. The test expects 201 on line 6, but GET /api/tags should return 200, not 201. Because the status check is wrong, that test will fail even if the API is working correctly.
- **What GitHub showed:** Expected: 201 · Received: 200

## 7. Fixed, and green again
- **The fix:** line 6 back to `toBe(200)` · **Run:** Fix the expected status · **Result:** green tick, 22 passed (3.4s)

## 8. Review notes for my other AI-written tests (written while CI ran)
The API checklist: status · body · shape · negative cases (a refused request changes nothing) · own test data.
Monday's and Tuesday's tests that I did not review in depth on those days. Each one: kept, changed or removed, and why.

### Monday: `tests/api.spec.ts`
- "creates an article with valid data and a token (positive)": **changed**, because it should make a GET request after creating the article to confirm that it was saved with the correct details.
- "rejects creating an article without a token (negative)": **changed**, because it checks 401, but doesn't verify that no article was created. Add a GET or another check to confirm nothing was saved.
- "reads an existing article by its slug (positive)": **kept**, because it creates its own article and checks the GET response for the correct details.
- "returns 404 for an article that does not exist (negative)": **kept**, because it checks that requesting a non-existing article returns 404 with the correct error message.
- "deletes an article as its author (positive)": **kept**, because it checks 204 and an empty response, then confirms the article is deleted by checking for 404.
- "rejects deleting an article without a token (negative)": **changed**, because it checks 401, but doesn't confirm the article still exists. Add a GET request to verify that the article was not deleted.

### Tuesday: `tests/contract.spec.ts`
- "GET /api/user answers the User shape from API.md": **kept**, because it checks the status, shape, field types, exact key list, and uses its own user. It covers the API checklist well.
- "GET /api/user with no token answers 401 "token is missing"": **kept**, because it checks the 401 status, error message, and response shape (errors). Good negative test.
- "GET /api/user with a wrong token answers 401 "token is invalid"": **kept**, because it checks the 401 status, correct error message, and response shape. Good coverage for an invalid token.
- "PUT /api/articles/:slug by someone else's account answers 403": **changed**, because it checks the 403 status, error message, and shape, but it doesn't prove the article stayed unchanged. Add a GET after the failed update and verify the title is still the original one.
