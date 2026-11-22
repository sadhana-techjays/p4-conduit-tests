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
