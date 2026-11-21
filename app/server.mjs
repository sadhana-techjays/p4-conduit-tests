// Conduit practice app: a small blogging app for test practice.
// The API follows the RealWorld "Conduit" API spec (https://docs.realworld.show, MIT, Thinkster).
// Node 22.13 or later. No npm packages: only Node's own modules.
//
//   npm start                 start the app on http://127.0.0.1:3000 with fresh data
//   PORT=3001                 use another port
//   KEEP_DATA=1               keep the data from the last run
//   CONDUIT_FAULT=<id>        switch on one fault from faults/practice.json (see README.md)
//   CONDUIT_FAULTS=<file>     read the faults from another file
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT) || 3000;
const HERE = import.meta.dirname;
const PUBLIC = path.join(HERE, 'public');
const DB_FILE = path.join(HERE, 'conduit.db');
const SECRET = process.env.JWT_SECRET || 'conduit-practice-app-not-a-real-secret';
const PAGE_LIMIT = 20;
const MAX_BODY = 100_000;

// ---------- faults (for fault-injection practice) ----------
// A fault is data: { id, title, method?, path (regex), status?, delayMs?, body?, remove?: ["a.b"], set?: {"a.b": value} }.
// "body" answers without running the real handler. "remove" and "set" change the real answer. "status" changes the code.
function loadFault() {
  const id = process.env.CONDUIT_FAULT;
  if (!id) return null;
  const file = process.env.CONDUIT_FAULTS || path.join(HERE, '..', 'faults', 'practice.json');
  let list;
  try {
    list = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
  } catch (e) {
    console.error(`Cannot read the fault file ${file}: ${e.message}`);
    process.exit(1);
  }
  const fault = (Array.isArray(list) ? list : list.faults || []).find((f) => f.id === id);
  if (!fault) {
    console.error(`Fault "${id}" is not in ${file}. To switch faults off, clear CONDUIT_FAULT.`);
    process.exit(1);
  }
  return { ...fault, re: new RegExp(fault.path) };
}
const FAULT = loadFault();

const pathParts = (p) => p.split('.');
function removeAt(obj, parts) {
  if (obj === null || typeof obj !== 'object') return;
  const [head, ...rest] = parts;
  if (head === '*') { if (Array.isArray(obj)) obj.forEach((o) => (rest.length ? removeAt(o, rest) : null)); return; }
  if (!rest.length) delete obj[head]; else removeAt(obj[head], rest);
}
function setAt(obj, parts, value) {
  if (obj === null || typeof obj !== 'object') return;
  const [head, ...rest] = parts;
  if (head === '*') { if (Array.isArray(obj)) obj.forEach((o, i) => (rest.length ? setAt(o, rest, value) : (obj[i] = value))); return; }
  if (!rest.length) obj[head] = structuredClone(value); else setAt(obj[head], rest, value);
}

// ---------- database: fresh on every start ----------
if (!process.env.KEEP_DATA) {
  try {
    fs.rmSync(DB_FILE, { force: true });
  } catch {
    console.error('Cannot reset the data. Is the app already running in another window? Close it, then try again.');
    process.exit(1);
  }
}
const db = new DatabaseSync(DB_FILE);
db.exec(`
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL, bio TEXT, image TEXT);
CREATE TABLE IF NOT EXISTS articles (id INTEGER PRIMARY KEY, slug TEXT UNIQUE NOT NULL, title TEXT NOT NULL,
  description TEXT NOT NULL, body TEXT NOT NULL, author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS tags (article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE, name TEXT NOT NULL, position INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS comments (id INTEGER PRIMARY KEY, article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, body TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS favorites (user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE, PRIMARY KEY (user_id, article_id));
CREATE TABLE IF NOT EXISTS follows (follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followed_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, PRIMARY KEY (follower_id, followed_id));`);
const all = (sql, ...a) => db.prepare(sql).all(...a);
const one = (sql, ...a) => db.prepare(sql).get(...a);
const run = (sql, ...a) => db.prepare(sql).run(...a);

// ---------- helpers ----------
class HttpError extends Error {
  constructor(status, errors) { super(`HTTP ${status}`); this.status = status; this.body = { errors }; }
}
const fail = (status, field, message) => new HttpError(status, { [field]: [message] });
const invalid = (errors) => new HttpError(422, errors);
let lastTime = '';
const now = () => {
  let t = new Date().toISOString();
  if (t <= lastTime) t = new Date(Date.parse(lastTime) + 1).toISOString();
  return (lastTime = t);
};
const text = (v) => (typeof v === 'string' ? v.trim() : '');
const isEmail = (v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);

const hashPassword = (p) => { const salt = crypto.randomBytes(16).toString('hex'); return `${salt}:${crypto.scryptSync(p, salt, 32).toString('hex')}`; };
const checkPassword = (p, stored) => { const [salt, h] = stored.split(':'); return crypto.timingSafeEqual(Buffer.from(h, 'hex'), crypto.scryptSync(p, salt, 32)); };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function signToken(id) {
  const iat = Math.floor(Date.now() / 1000);
  const data = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ user: { id }, iat, exp: iat + 60 * 24 * 3600 })}`;
  return `${data}.${crypto.createHmac('sha256', SECRET).update(data).digest('base64url')}`;
}
function readToken(token) {
  try {
    const [h, p, s] = token.split('.');
    if (s !== crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url')) return null;
    const payload = JSON.parse(Buffer.from(p, 'base64url'));
    return payload.exp > Date.now() / 1000 ? payload.user?.id : null;
  } catch { return null; }
}
// Returns the signed-in user's id, or null. A missing token is fine when "required" is false; a wrong token never is.
function auth(req, required) {
  const header = req.headers.authorization;
  if (!header) { if (required) throw fail(401, 'token', 'is missing'); return null; }
  const [scheme, token] = header.split(' ');
  const id = scheme === 'Token' && token ? readToken(token) : null;
  if (!id || !one('SELECT id FROM users WHERE id = ?', id)) throw fail(401, 'token', 'is invalid');
  return id;
}

const userById = (id) => one('SELECT * FROM users WHERE id = ?', id);
const userJson = (u) => ({ email: u.email, token: signToken(u.id), username: u.username, bio: u.bio, image: u.image });
const following = (me, id) => !!(me && one('SELECT 1 FROM follows WHERE follower_id = ? AND followed_id = ?', me, id));
const profileJson = (u, me) => ({ username: u.username, bio: u.bio, image: u.image, following: following(me, u.id) });
const tagsOf = (articleId) => all('SELECT name FROM tags WHERE article_id = ? ORDER BY position', articleId).map((t) => t.name);
function articleJson(a, me, withBody = true) {
  const out = { slug: a.slug, title: a.title, description: a.description };
  if (withBody) out.body = a.body;
  return Object.assign(out, {
    tagList: tagsOf(a.id),
    createdAt: a.created_at,
    updatedAt: a.updated_at,
    favorited: !!(me && one('SELECT 1 FROM favorites WHERE user_id = ? AND article_id = ?', me, a.id)),
    favoritesCount: one('SELECT COUNT(*) AS n FROM favorites WHERE article_id = ?', a.id).n,
    author: profileJson(userById(a.author_id), me),
  });
}
const commentJson = (c, me) => ({ id: c.id, createdAt: c.created_at, updatedAt: c.updated_at, body: c.body, author: profileJson(userById(c.author_id), me) });
function findArticle(slug) {
  const a = one('SELECT * FROM articles WHERE slug = ?', slug);
  if (!a) throw fail(404, 'article', 'not found');
  return a;
}
function findUser(username) {
  const u = one('SELECT * FROM users WHERE username = ?', username);
  if (!u) throw fail(404, 'profile', 'not found');
  return u;
}
function uniqueSlug(title, exceptId = 0) {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'article';
  let slug = base;
  for (let i = 2; one('SELECT 1 FROM articles WHERE slug = ? AND id != ?', slug, exceptId); i++) slug = `${base}-${i}`;
  return slug;
}
function cleanTags(list) {
  if (!Array.isArray(list) || list.some((t) => typeof t !== 'string')) throw invalid({ tagList: ['must be a list of text values'] });
  return [...new Set(list.map((t) => t.trim()).filter(Boolean))];
}
function saveTags(articleId, tags) {
  run('DELETE FROM tags WHERE article_id = ?', articleId);
  tags.forEach((t, i) => run('INSERT INTO tags (article_id, name, position) VALUES (?, ?, ?)', articleId, t, i));
}
function paging(s) {
  const errors = {};
  const limit = s.has('limit') ? Number(s.get('limit')) : PAGE_LIMIT;
  const offset = s.has('offset') ? Number(s.get('offset')) : 0;
  if (!Number.isInteger(limit) || limit < 1) errors.limit = ['must be a whole number of 1 or more'];
  if (!Number.isInteger(offset) || offset < 0) errors.offset = ['must be a whole number of 0 or more'];
  if (Object.keys(errors).length) throw invalid(errors);
  return { limit, offset };
}
function articleList(me, where, args, s) {
  const { limit, offset } = paging(s);
  const from = `FROM articles a JOIN users u ON u.id = a.author_id${where.length ? ` WHERE ${where.join(' AND ')}` : ''}`;
  const rows = all(`SELECT a.* ${from} ORDER BY a.created_at DESC, a.id DESC LIMIT ? OFFSET ?`, ...args, limit, offset);
  return { articles: rows.map((a) => articleJson(a, me, false)), articlesCount: one(`SELECT COUNT(*) AS n ${from}`, ...args).n };
}

// ---------- routes ----------
const routes = [];
const route = (method, pattern, fn) => routes.push({ method, re: new RegExp(`^${pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)')}$`), fn });

route('POST', '/api/users', ({ body }) => {
  const u = body.user || {};
  const username = text(u.username), email = text(u.email).toLowerCase(), password = typeof u.password === 'string' ? u.password : '';
  const errors = {};
  if (!username) errors.username = ["can't be blank"];
  if (!email) errors.email = ["can't be blank"]; else if (!isEmail(email)) errors.email = ['is invalid'];
  if (!password) errors.password = ["can't be blank"]; else if (password.length < 8) errors.password = ['is too short (minimum is 8 characters)'];
  if (Object.keys(errors).length) throw invalid(errors);
  const taken = {};
  if (one('SELECT 1 FROM users WHERE username = ?', username)) taken.username = ['has already been taken'];
  if (one('SELECT 1 FROM users WHERE email = ?', email)) taken.email = ['has already been taken'];
  if (Object.keys(taken).length) throw new HttpError(409, taken);
  const { lastInsertRowid } = run('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', username, email, hashPassword(password));
  return [201, { user: userJson(userById(lastInsertRowid)) }];
});

route('POST', '/api/users/login', ({ body }) => {
  const u = body.user || {};
  const email = text(u.email).toLowerCase(), password = typeof u.password === 'string' ? u.password : '';
  const errors = {};
  if (!email) errors.email = ["can't be blank"];
  if (!password) errors.password = ["can't be blank"];
  if (Object.keys(errors).length) throw invalid(errors);
  const user = one('SELECT * FROM users WHERE email = ?', email);
  if (!user || !checkPassword(password, user.password)) throw fail(401, 'credentials', 'invalid');
  return [200, { user: userJson(user) }];
});

route('GET', '/api/user', ({ req }) => [200, { user: userJson(userById(auth(req, true))) }]);

route('PUT', '/api/user', ({ req, body }) => {
  const me = auth(req, true), u = body.user && typeof body.user === 'object' ? body.user : {};
  const errors = {}, taken = {}, changes = {};
  for (const f of ['username', 'email']) {
    if (!(f in u)) continue;
    const v = f === 'email' ? text(u[f]).toLowerCase() : text(u[f]);
    if (!v) errors[f] = ["can't be blank"];
    else if (f === 'email' && !isEmail(v)) errors[f] = ['is invalid'];
    else if (one(`SELECT 1 FROM users WHERE ${f} = ? AND id != ?`, v, me)) taken[f] = ['has already been taken'];
    else changes[f] = v;
  }
  if ('password' in u) {
    if (typeof u.password !== 'string' || !u.password) errors.password = ["can't be blank"];
    else if (u.password.length < 8) errors.password = ['is too short (minimum is 8 characters)'];
    else changes.password = hashPassword(u.password);
  }
  for (const f of ['bio', 'image']) if (f in u) changes[f] = text(u[f]) || null;
  if (!Object.keys(u).length) errors.user = ['must have at least one field'];
  if (Object.keys(errors).length) throw invalid(errors);
  if (Object.keys(taken).length) throw new HttpError(409, taken);
  for (const [f, v] of Object.entries(changes)) run(`UPDATE users SET ${f} = ? WHERE id = ?`, v, me);
  return [200, { user: userJson(userById(me)) }];
});

route('GET', '/api/profiles/:username', ({ req, p }) => {
  const me = auth(req, false), u = findUser(p.username);
  return [200, { profile: { ...profileJson(u, me), email: u.email } }];
});
route('POST', '/api/profiles/:username/follow', ({ req, p }) => {
  const me = auth(req, true), u = findUser(p.username);
  if (u.id !== me) run('INSERT OR IGNORE INTO follows (follower_id, followed_id) VALUES (?, ?)', me, u.id);
  return [200, { profile: profileJson(u, me) }];
});
route('DELETE', '/api/profiles/:username/follow', ({ req, p }) => {
  const me = auth(req, true), u = findUser(p.username);
  run('DELETE FROM follows WHERE follower_id = ? AND followed_id = ?', me, u.id);
  return [200, { profile: profileJson(u, me) }];
});

route('GET', '/api/articles', ({ req, url }) => {
  const me = auth(req, false), s = url.searchParams, where = [], args = [];
  if (s.has('tag')) { where.push('a.id IN (SELECT article_id FROM tags WHERE name = ?)'); args.push(s.get('tag')); }
  if (s.has('author')) { where.push('u.username = ?'); args.push(s.get('author')); }
  if (s.has('favorited')) {
    where.push('a.id IN (SELECT f.article_id FROM favorites f JOIN users fu ON fu.id = f.user_id WHERE fu.username = ?)');
    args.push(s.get('favorited'));
  }
  return [200, articleList(me, where, args, s)];
});
route('GET', '/api/articles/feed', ({ req, url }) => {
  const me = auth(req, true);
  return [200, articleList(me, ['a.author_id IN (SELECT followed_id FROM follows WHERE follower_id = ?)'], [me], url.searchParams)];
});
route('POST', '/api/articles', ({ req, body }) => {
  const me = auth(req, true), a = body.article && typeof body.article === 'object' ? body.article : {};
  const errors = {};
  for (const f of ['title', 'description', 'body']) if (!text(a[f])) errors[f] = ["can't be blank"];
  if (Object.keys(errors).length) throw invalid(errors);
  const tags = 'tagList' in a ? cleanTags(a.tagList) : [];
  const t = now();
  const { lastInsertRowid } = run('INSERT INTO articles (slug, title, description, body, author_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    uniqueSlug(text(a.title)), text(a.title), text(a.description), a.body, me, t, t);
  saveTags(lastInsertRowid, tags);
  return [201, { article: articleJson(one('SELECT * FROM articles WHERE id = ?', lastInsertRowid), me) }];
});
route('GET', '/api/articles/:slug', ({ req, p }) => [200, { article: articleJson(findArticle(p.slug), auth(req, false)) }]);
route('PUT', '/api/articles/:slug', ({ req, p, body }) => {
  const me = auth(req, true), a = findArticle(p.slug), c = body.article && typeof body.article === 'object' ? body.article : {};
  if (a.author_id !== me) throw fail(403, 'article', 'forbidden');
  const errors = {};
  for (const f of ['title', 'description', 'body']) if (f in c && !text(c[f])) errors[f] = ["can't be blank"];
  if (Object.keys(errors).length) throw invalid(errors);
  const tags = cleanTags('tagList' in c ? c.tagList : []);
  const title = 'title' in c ? text(c.title) : a.title;
  const slug = title === a.title ? a.slug : uniqueSlug(title, a.id);
  run('UPDATE articles SET slug = ?, title = ?, description = ?, body = ?, updated_at = ? WHERE id = ?',
    slug, title, 'description' in c ? text(c.description) : a.description, 'body' in c ? c.body : a.body, now(), a.id);
  saveTags(a.id, tags);
  return [200, { article: articleJson(one('SELECT * FROM articles WHERE id = ?', a.id), me) }];
});
route('DELETE', '/api/articles/:slug', ({ req, p }) => {
  const me = auth(req, true), a = findArticle(p.slug);
  if (a.author_id !== me) throw fail(403, 'article', 'forbidden');
  run('DELETE FROM articles WHERE id = ?', a.id);
  return [204, null];
});
route('POST', '/api/articles/:slug/favorite', ({ req, p }) => {
  const me = auth(req, true), a = findArticle(p.slug);
  run('INSERT OR IGNORE INTO favorites (user_id, article_id) VALUES (?, ?)', me, a.id);
  return [200, { article: articleJson(a, me) }];
});
route('DELETE', '/api/articles/:slug/favorite', ({ req, p }) => {
  const me = auth(req, true), a = findArticle(p.slug);
  run('DELETE FROM favorites WHERE user_id = ? AND article_id = ?', me, a.id);
  return [200, { article: articleJson(a, me) }];
});

route('GET', '/api/articles/:slug/comments', ({ req, p }) => {
  const me = auth(req, false), a = findArticle(p.slug);
  return [200, { comments: all('SELECT * FROM comments WHERE article_id = ? ORDER BY id', a.id).map((c) => commentJson(c, me)) }];
});
route('POST', '/api/articles/:slug/comments', ({ req, p, body }) => {
  const me = auth(req, true), a = findArticle(p.slug), c = body.comment && typeof body.comment === 'object' ? body.comment : {};
  if (c.body === undefined || c.body === null) throw invalid({ body: ["can't be blank"] });
  const t = now();
  const { lastInsertRowid } = run('INSERT INTO comments (article_id, author_id, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', a.id, me, String(c.body), t, t);
  return [201, { comment: commentJson(one('SELECT * FROM comments WHERE id = ?', lastInsertRowid), me) }];
});
route('DELETE', '/api/articles/:slug/comments/:id', ({ req, p }) => {
  const me = auth(req, true), a = findArticle(p.slug);
  const c = one('SELECT * FROM comments WHERE id = ? AND article_id = ?', Number(p.id), a.id);
  if (!c) throw fail(404, 'comment', 'not found');
  if (c.author_id !== me) throw fail(403, 'comment', 'forbidden');
  run('DELETE FROM comments WHERE id = ?', c.id);
  return [204, null];
});

route('GET', '/api/tags', () => [200, {
  tags: all('SELECT name, COUNT(*) AS n FROM tags GROUP BY name ORDER BY n DESC, name').map((t) => t.name),
}]);

// ---------- seed data (made up; the same on every fresh start) ----------
function seed() {
  const users = [
    ['practice-author', 'practice-author@example.com', 'I write about testing and quality.'],
    ['practice-reader', 'practice-reader@example.com', null],
    ['practice-editor', 'practice-editor@example.com', 'Editor. I like short, clear articles.'],
  ];
  for (const [username, email, bio] of users) run('INSERT INTO users (username, email, password, bio) VALUES (?, ?, ?, ?)', username, email, hashPassword('Practice123'), bio);
  const articles = [
    [1, 'How to write a good bug report', 'Steps, expected result, actual result', 'A good bug report lets someone else see the bug without asking you.\n\nWrite the steps, what you expected and what happened. Add the version and the data you used.', ['testing', 'bugs']],
    [1, 'Five checks before a release', 'A short list for the last day', 'Check the main journeys, the payments, the emails, the logs and the rollback plan.', ['testing', 'quality']],
    [3, 'What an API test should check', 'Status, body, shape and errors', 'An API test checks the status code, the important values in the body, the shape of the answer and what happens with bad input.', ['api', 'testing']],
    [1, 'Why tests become flaky', 'Timing, shared data and order', 'Most flaky tests wait for a fixed time, share data with other tests, or depend on the order they run in.', ['automation', 'playwright']],
    [3, 'Reading a failed CI run', 'Start from the first red step', 'Open the failed job, find the first red step and read the error message before you change any code.', ['ci', 'automation']],
    [1, 'Exploratory testing in 30 minutes', 'A charter, a timer and notes', 'Write one charter, set a timer for 30 minutes and take notes as you go. Report what you found and what you did not test.', ['testing']],
    [3, 'Test data that cleans up after itself', 'Create it, use it, delete it', 'Each test creates the data it needs and deletes it at the end, so tests do not depend on each other.', ['automation', 'api']],
    [1, 'Accessible names and locators', 'Find elements the way users do', 'A button with a clear name is easier to use and easier to test. Prefer role and label locators.', ['playwright', 'accessibility']],
    [3, 'When to automate a test', 'Repeat, risk and cost', 'Automate checks you repeat often, checks on high-risk areas and checks that are slow by hand.', ['automation', 'quality']],
    [1, 'Boundary values in practice', 'Test at the edges', 'If a field accepts 1 to 100, test 0, 1, 100 and 101. Bugs like to live at the edges.', ['testing', 'quality']],
    [3, 'Contract tests in plain words', 'Does the answer still have the agreed shape?', 'A contract test fails when an answer no longer has the fields and types that were agreed.', ['api', 'ci']],
    [1, 'Your first end-to-end test', 'Set up by API, check in the browser', 'Create the data through the API, run the journey in the browser and check the result through the API.', ['playwright', 'api']],
  ];
  articles.forEach(([author, title, description, body, tags], i) => {
    const t = new Date(Date.UTC(2026, 0, 5 + i * 3, 12)).toISOString();
    const { lastInsertRowid } = run('INSERT INTO articles (slug, title, description, body, author_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      uniqueSlug(title), title, description, body, author, t, t);
    saveTags(lastInsertRowid, tags);
  });
  const comment = (article, author, body, day) => {
    const t = new Date(Date.UTC(2026, 1, day, 12)).toISOString();
    run('INSERT INTO comments (article_id, author_id, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', article, author, body, t, t);
  };
  comment(12, 2, 'Clear steps. I will try this on my project.', 10);
  comment(12, 3, 'Nice and short.', 11);
  comment(11, 2, 'Can you give an example of a changed answer?', 12);
  comment(1, 3, 'Please add the browser version too.', 13);
  for (const [user, article] of [[2, 12], [2, 11], [2, 1], [3, 12], [3, 10]]) run('INSERT INTO favorites (user_id, article_id) VALUES (?, ?)', user, article);
  run('INSERT INTO follows (follower_id, followed_id) VALUES (2, 1)');
}
if (!one('SELECT 1 FROM users')) seed();

// ---------- server ----------
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function readBody(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > MAX_BODY) throw fail(413, 'body', 'is too large');
  }
  if (!raw.trim()) return {};
  try {
    const body = JSON.parse(raw);
    return body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  } catch {
    throw fail(422, 'body', 'is not valid JSON');
  }
}

async function handleApi(req, url) {
  try {
    const body = await readBody(req);
    const pathname = url.pathname.length > 1 ? url.pathname.replace(/\/$/, '') : url.pathname;
    for (const r of routes) {
      const m = r.method === req.method && pathname.match(r.re);
      if (m) {
        const params = Object.fromEntries(Object.entries(m.groups || {}).map(([k, v]) => [k, decodeURIComponent(v)]));
        return r.fn({ req, url, body, p: params });
      }
    }
    return [404, { errors: { path: ['not found'] } }];
  } catch (e) {
    if (e instanceof HttpError) return [e.status, e.body];
    console.error(e);
    return [500, { errors: { server: ['unexpected error'] } }];
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}`);
  if (url.pathname.startsWith('/api/')) {
    const fault = FAULT && (!FAULT.method || FAULT.method === req.method) && FAULT.re.test(url.pathname) ? FAULT : null;
    let status, out;
    if (fault && 'body' in fault) {
      for await (const _ of req); // read and ignore the request body
      [status, out] = [fault.status ?? 200, fault.body];
    } else {
      [status, out] = await handleApi(req, url);
      if (fault) {
        if (out && typeof out === 'object') {
          out = structuredClone(out);
          for (const p of fault.remove || []) removeAt(out, pathParts(p));
          for (const [p, v] of Object.entries(fault.set || {})) setAt(out, pathParts(p), v);
        }
        if (fault.status) status = fault.status;
      }
    }
    if (fault?.delayMs) await wait(fault.delayMs);
    const empty = out === null || out === undefined;
    res.writeHead(status, empty ? {} : { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(empty ? '' : JSON.stringify(out));
  }
  const file = path.join(PUBLIC, path.normalize(decodeURIComponent(url.pathname)).replace(/^[/\\]+/, ''));
  const target = file.startsWith(PUBLIC + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile() ? file : path.join(PUBLIC, 'index.html');
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(target).pipe(res);
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') console.error(`Port ${PORT} is busy. Is the app already running in another window? Close it, or set another PORT.`);
  else console.error(e.message);
  process.exit(1);
});
server.listen(PORT, HOST, () => {
  console.log(`Conduit practice app: http://${HOST}:${PORT}  (${process.env.KEEP_DATA ? 'kept data' : 'fresh data'})`);
  if (FAULT) console.log(`Fault switched on: ${FAULT.id} - ${FAULT.title}`);
  console.log('To stop the app, close this terminal.');
});
const stop = () => { server.close(); db.close(); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
