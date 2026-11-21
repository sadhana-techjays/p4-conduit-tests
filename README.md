# Week 4 project: tests for the Conduit practice app

This folder is your week 4 project (P4). It holds:

- `app/`: Conduit, a small blogging app. People sign up, write articles, add tags, comment, like articles and follow authors. It runs on your own laptop.
- `API.md`: the API description. Claude writes API tests from it.
- `tests/`: your tests. There is one small example test.
- `playwright.config.ts`: the Playwright settings.
- `faults/practice.json`: practice faults, for Thursday.

## First time only

In the TESTS terminal, in this folder:

```powershell
npm install
```

If Playwright later says that the browser is missing, type `npx playwright install chromium`.

## Start the app

```powershell
npm start
```

Open http://127.0.0.1:3000 in your browser. To stop the app, close the terminal it runs in: in VS Code, right-click the terminal's name in the terminal list and choose **Kill Terminal**.

Every start gives fresh data: the practice users and articles below, and nothing else. To keep your data from the last run, start it like this:

```powershell
$env:KEEP_DATA = "1"; npm start
```

Practice users (password `Practice123` for all three):

| Username | Email |
|---|---|
| practice-author | practice-author@example.com |
| practice-reader | practice-reader@example.com |
| practice-editor | practice-editor@example.com |

You can also sign up your own users. Any made-up email works, for example `me1@example.com`.

## Run the tests

```powershell
npx playwright test
```

Playwright starts the app before the tests and stops it after them. If the app is already running in another terminal, Playwright uses that one.

To see the report, type `npx playwright show-report`.

## The API

- The API is at http://127.0.0.1:3000/api, for example http://127.0.0.1:3000/api/tags.
- The API description is in `API.md`.
- The API follows the RealWorld "Conduit" API spec: https://docs.realworld.show/specifications/backend/endpoints/

## Practice faults (Thursday)

A fault changes some of the app's answers, so you can check whether your tests notice. First stop the app if it is running (close its terminal: **Kill Terminal**). Then, for example:

```powershell
$env:CONDUIT_FAULT = "F3"; npx playwright test
```

To switch the fault off again:

```powershell
$env:CONDUIT_FAULT = ""
```

The faults are listed in `faults/practice.json`.

## If something goes wrong

- "Port 3000 is busy": the app is already running in another terminal. Close that terminal (**Kill Terminal**), or use that one.
- "Cannot reset the data": the app is already running. Close it first.
- The app needs Node.js 22.13 or later. Type `node -v` to check.

## Credits

The API follows the RealWorld spec (MIT, Thinkster): https://github.com/realworld-apps/realworld. The app's code was written for this course.
