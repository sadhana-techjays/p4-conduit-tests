# Profile Page and Follow Author

## Application Overview

Test plan for the Conduit (RealWorld clone) profile page at http://127.0.0.1:3000/profile/practice-author. Covers viewing an author's profile as a visitor and following/unfollowing the author as a signed-in, different user (practice-reader, password Practice123). All locators use accessible roles and names observed on the live page (e.g. heading "practice-author", button "Follow practice-author" / "Unfollow practice-author"), per project Playwright rules. Note: the profile's follow button toggles its accessible name between "Follow practice-author" and "Unfollow practice-author" depending on current state; scenario 2 reads the button's starting label and asserts it flips, so it is independent of whatever follow state the account starts in.

## Test Scenarios

### 1. Profile Page

**Seed:** `tests/seed.spec.ts`

#### 1.1. View author profile page content

**File:** `tests/profile/view-profile.spec.ts`

**Steps:**
  1. Navigate to http://127.0.0.1:3000/profile/practice-author without signing in
    - expect: Page loads and the title/heading displays the username 'practice-author'
  2. Check the profile bio text below the username
    - expect: The paragraph 'I write about testing and quality.' is visible
  3. Check the 'My Articles' and 'Favorited Articles' tabs in the profile navigation
    - expect: Both tabs are visible, with 'My Articles' link pointing to /profile/practice-author and 'Favorited Articles' link pointing to /profile/practice-author/favorites
  4. Check the article list under 'My Articles'
    - expect: At least one article authored by 'practice-author' is listed, each showing a title link, a date, and a favorites count (e.g. '♥ 2')
  5. Confirm no Follow/Unfollow button is shown for this anonymous (signed-out) visitor
    - expect: No button named 'Follow practice-author' or 'Unfollow practice-author' is present on the page

#### 1.2. Sign in as a different user and toggle following the author

**File:** `tests/profile/follow-author.spec.ts`

**Steps:**
  1. Navigate to http://127.0.0.1:3000/login, fill Email with practice-reader@example.com and Password with Practice123, then click the 'Sign in' button
    - expect: Sign-in succeeds and the user is redirected to the home page, with 'practice-reader' shown as a nav link
  2. Navigate to http://127.0.0.1:3000/profile/practice-author
    - expect: The profile heading shows 'practice-author' and a button named either 'Follow practice-author' or 'Unfollow practice-author' is visible
  3. Read the current accessible name of the follow/unfollow button, then click it
    - expect: The button's accessible name flips: if it read 'Follow practice-author' it now reads 'Unfollow practice-author', or vice versa
  4. Click the same button again (now showing the opposite label) to toggle the state back
    - expect: The button's accessible name flips back to its original value, confirming the follow action is reversible
