# Tests from Playwright's agents, and my review (week 4, project P4)

App: Conduit practice app on my laptop · Date: 2026-11-22

## 1. How I set up the agents
- **Command:** `npx playwright init-agents --loop=claude` (TESTS terminal, in `P4`)
- **What it made:** `.claude/agents/playwright-test-planner.md`, `.claude/agents/playwright-test-generator.md`, `.claude/agents/playwright-test-healer.md`, `.mcp.json`, `specs/README.md`, `tests/seed.spec.ts`
- **Browser hidden:** `"--headless"` added to `P4/.mcp.json`: yes
- **Where I started Claude for the agents:** in `P4`, because Claude finds the agents and their browser only there

## 2. What I asked the agents
- **Area:** the profile page and following an author
- **My prompt** (`P4/prompts/agents.md`):
  - Task: First use the playwright-test-planner agent to plan tests for the profile page and following an author. Save the plan as specs/profile-follow.md. Then use the playwright-test-generator agent to write one test for each scenario in the plan, in the folder tests/profile-follow/.
  - Material: Start on the page /profile/practice-author. For steps that need a signed-in user, use a practice user from README.md.
  - Rules: Plan at most 2 short scenarios, with at most 5 steps each. Do not change any other test file. Do not run the test suite. Each test must verify the actual result, not just that a success message appears on the screen.
- **The plan the planner saved:** `specs/profile-follow.md`
- **The test files the generator wrote:** `tests/profile-follow/view-profile.spec.ts`, `tests/profile-follow/follow-author.spec.ts`
- `tests/seed.spec.ts` is the agents' start file. It checks nothing about the app, so it is not reviewed here.

## 3. My review of every generated test
- **The teammate's question:** "Claude says it actually verifies the follow button's state flip. So we can keep this test in our suite as it is, right?"
- **My answer:** Not yet. It verifies that the button label changes, but it doesn't confirm that the follow action is actually saved. We should verify the following state persists after a page reload before keeping it in the suite.
- "Sign in as a different user and toggle following the author" (`follow-author.spec.ts`) · **changed**, because the test checks the follow/unfollow button state, but it uses a shared practice user. It should create its own user through the API and verify that the follow state persists after a reload
- "View author profile page content" (`view-profile.spec.ts`) · **kept**, because it checks useful profile details, article information, navigation links, and that anonymous visitors cannot follow the author. It doesn't modify shared data or depend on another test.

## 4. What I asked Claude to change, and the result
- **My change** (the Changes line of `P4/prompts/stronger.md`): In @P4/tests/profile-follow/follow-author.spec.ts: The test checks the follow/unfollow button state, but it uses a shared practice user. It should create its own user through the API and verify that the follow state persists after a reload.
- **Result:** No fault: 22 passed, 0 failed (my second fault run)
