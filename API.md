# Conduit API description

The Conduit practice app follows the RealWorld "Conduit" API spec:

- Endpoints: https://docs.realworld.show/specifications/backend/endpoints/
- Error handling: https://docs.realworld.show/specifications/backend/error-handling/
- The full spec (OpenAPI) and its test suite: https://github.com/realworld-apps/realworld (folder `specs/api`)

This page is a short version of that spec for this app. Where the app adds its own rules, the page says "this app".

## Basics

- Base URL: `http://127.0.0.1:3000/api`
- Requests and answers are JSON. Send `Content-Type: application/json` with a body.
- Signed-in requests send the header `Authorization: Token <token>`. You get the token when you sign up or sign in.
- Dates are ISO 8601 text, for example `2026-01-05T12:00:00.000Z`.

## Errors

Every error answer has this shape. The key names the field or the thing that is wrong:

```json
{ "errors": { "title": ["can't be blank"] } }
```

| Status | When | Example body |
|---|---|---|
| 401 | No token, or a wrong token, where a token is needed | `{"errors":{"token":["is missing"]}}` (this app says `"is invalid"` for a wrong token) |
| 401 | Sign in with a wrong email or password | `{"errors":{"credentials":["invalid"]}}` |
| 403 | You may not change this (for example, someone else's article) | `{"errors":{"article":["forbidden"]}}` |
| 404 | Not found | `{"errors":{"article":["not found"]}}`, `{"errors":{"profile":["not found"]}}`, `{"errors":{"comment":["not found"]}}` |
| 409 | Username or email already taken | `{"errors":{"username":["has already been taken"]}}` |
| 422 | A field is missing or not valid | `{"errors":{"body":["can't be blank"]}}` |

## Users and sign-in

| Request | Token | Body | Answer |
|---|---|---|---|
| `POST /api/users` (sign up) | no | `{"user":{"username","email","password"}}`, all required | **201** User |
| `POST /api/users/login` (sign in) | no | `{"user":{"email","password"}}`, both required | **200** User |
| `GET /api/user` (current user) | yes | none | **200** User |
| `PUT /api/user` (update) | yes | `{"user":{...}}`: any of `email`, `username`, `password`, `bio`, `image` | **200** User |

User: `{"user":{"email","token","username","bio","image"}}`. A new user has `bio` and `image` set to `null`.

This app's rules:
- Passwords need at least 8 characters: `{"errors":{"password":["is too short (minimum is 8 characters)"]}}`.
- An email must look like an email: `{"errors":{"email":["is invalid"]}}`.
- Emails are not case-sensitive.
- In `PUT /api/user`, an empty `bio` or `image` becomes `null`. An empty `email`, `username` or `password` gives 422.

## Profiles

| Request | Token | Answer |
|---|---|---|
| `GET /api/profiles/:username` | optional | **200** Profile |
| `POST /api/profiles/:username/follow` | yes | **200** Profile |
| `DELETE /api/profiles/:username/follow` | yes | **200** Profile |

Profile: `{"profile":{"username","bio","image","following"}}`. `following` is `true` when the signed-in user follows this user.

## Articles

| Request | Token | Body | Answer |
|---|---|---|---|
| `GET /api/articles` | optional | none | **200** Multiple articles |
| `GET /api/articles/feed` | yes | none | **200** Multiple articles by users you follow |
| `GET /api/articles/:slug` | optional | none | **200** Article |
| `POST /api/articles` | yes | `{"article":{"title","description","body","tagList"}}` | **201** Article |
| `PUT /api/articles/:slug` | yes, author only | `{"article":{...}}`: any of `title`, `description`, `body`, `tagList` | **200** Article |
| `DELETE /api/articles/:slug` | yes, author only | none | **204**, no body |
| `POST /api/articles/:slug/favorite` | yes | none | **200** Article |
| `DELETE /api/articles/:slug/favorite` | yes | none | **200** Article |

Article: `{"article":{"slug","title","description","body","tagList","createdAt","updatedAt","favorited","favoritesCount","author"}}`. `author` is a Profile (without the `profile` wrapper).

Multiple articles: `{"articles":[...],"articlesCount":12}`.
- The items have the same fields as an Article, **except `body`**.
- Newest first.
- `articlesCount` is the number of all matching articles, not only the ones on this page.

Query parameters for `GET /api/articles` (and `limit`, `offset` for the feed):

| Parameter | Meaning | Example |
|---|---|---|
| `tag` | only articles with this tag | `?tag=testing` |
| `author` | only articles by this username | `?author=practice-author` |
| `favorited` | only articles this username liked | `?favorited=practice-reader` |
| `limit` | how many to return, default **20** | `?limit=10` |
| `offset` | how many to skip, default **0** | `?offset=10` |

Rules:
- Creating: `title`, `description` and `body` are required. `tagList` is optional (a list of text values).
- Updating: every field is optional. A field you do not send stays as it was. `tagList: []` removes all tags. `tagList: null` gives 422.
- Two articles may have the same title. Each gets its own slug (this app: `my-title`, then `my-title-2`).
- This app: when the title changes, the slug changes too.
- This app: tags keep the order you sent them in; repeated tags are kept once.

## Comments

| Request | Token | Body | Answer |
|---|---|---|---|
| `GET /api/articles/:slug/comments` | optional | none | **200** `{"comments":[...]}` |
| `POST /api/articles/:slug/comments` | yes | `{"comment":{"body"}}`, body required | **201** `{"comment":{...}}` |
| `DELETE /api/articles/:slug/comments/:id` | yes, comment author only | none | **204**, no body |

Comment: `{"id","createdAt","updatedAt","body","author"}`. `author` is a Profile. This app lists comments oldest first.

## Tags

| Request | Token | Answer |
|---|---|---|
| `GET /api/tags` | no | **200** `{"tags":["testing","api",...]}` |

This app: every tag in use, the most used first.
