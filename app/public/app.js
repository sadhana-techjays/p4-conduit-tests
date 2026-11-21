// Conduit practice app: the pages. Plain JavaScript, no framework, no build step.
// The pages use the same API as the tests (/api/...). The sign-in token is kept in localStorage under "jwtToken".
const app = document.getElementById('app');
const PAGE_SIZE = 10;
let me = null;
let renderSeq = 0; // a newer page replaces an older one that is still loading
const stale = (seq) => seq !== renderSeq;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const enc = encodeURIComponent;
const day = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

async function api(method, path, body) {
  const headers = { Accept: 'application/json' };
  if (body) headers['Content-Type'] = 'application/json';
  if (localStorage.jwtToken) headers.Authorization = `Token ${localStorage.jwtToken}`;
  const res = await fetch(`/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = res.status === 204 ? {} : await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status, data });
  return data;
}

function errorList(err) {
  const errors = err.data?.errors || { error: ['something went wrong'] };
  const items = Object.entries(errors).flatMap(([field, messages]) =>
    (Array.isArray(messages) ? messages : [String(messages)]).map((m) => (field === 'credentials' ? 'email or password is invalid' : `${field} ${m}`)));
  return `<ul class="errors" role="alert">${items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`;
}
const showErrors = (err) => { document.getElementById('errors').innerHTML = errorList(err); };

const go = (url) => { history.pushState({}, '', url); render(); };
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="/"]');
  if (a && !e.ctrlKey && !e.metaKey && !e.shiftKey) { e.preventDefault(); go(a.getAttribute('href')); }
});
addEventListener('popstate', render);

function setTitle(t) { document.title = t ? `${t} | Conduit` : 'Conduit'; }

function nav() {
  const items = me
    ? [['/', 'Home'], ['/editor', 'New Article'], ['/settings', 'Settings'], [`/profile/${enc(me.username)}`, me.username]]
    : [['/', 'Home'], ['/login', 'Sign in'], ['/register', 'Sign up']];
  document.getElementById('nav').innerHTML = items
    .map(([href, label]) => `<li><a href="${href}"${location.pathname === href ? ' aria-current="page"' : ''}>${esc(label)}</a></li>`).join('');
}

const tagList = (tags) => `<ul class="tags" aria-label="Tags">${tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`;
const preview = (a) => `<article class="preview">
  <p class="meta"><a href="/profile/${enc(a.author.username)}">${esc(a.author.username)}</a> · ${day(a.createdAt)} · ♥ ${a.favoritesCount}</p>
  <h2><a href="/article/${enc(a.slug)}">${esc(a.title)}</a></h2>
  <p>${esc(a.description)}</p>
  ${tagList(a.tagList)}
</article>`;

function pager(count, page, makeHref) {
  const pages = Math.ceil(count / PAGE_SIZE);
  if (pages < 2) return '';
  const links = Array.from({ length: pages }, (_, i) => i + 1)
    .map((n) => `<li><a href="${makeHref(n)}"${n === page ? ' aria-current="page"' : ''}>${n}</a></li>`).join('');
  return `<nav class="pages" aria-label="Pages"><ul>${links}</ul></nav>`;
}

async function articleFeed(query, page, makeHref, feed = false) {
  const q = `limit=${PAGE_SIZE}&offset=${(page - 1) * PAGE_SIZE}${query}`;
  const { articles, articlesCount } = await api('GET', feed ? `/articles/feed?${q}` : `/articles?${q}`);
  const list = articles.length ? articles.map(preview).join('') : '<p>No articles are here... yet.</p>';
  return `${list}${pager(articlesCount, page, makeHref)}`;
}

const pages = {
  async home(seq) {
    const s = new URLSearchParams(location.search);
    const tag = s.get('tag');
    const yours = s.get('feed') === 'yours' && me;
    const page = Math.max(1, Number(s.get('page')) || 1);
    setTitle('Home');
    const tabs = [];
    if (me) tabs.push(['/?feed=yours', 'Your Feed', yours]);
    tabs.push(['/', 'Global Feed', !yours && !tag]);
    if (tag) tabs.push([`/?tag=${enc(tag)}`, `# ${tag}`, true]);
    const base = yours ? '/?feed=yours&' : tag ? `/?tag=${enc(tag)}&` : '/?';
    app.innerHTML = `<section class="banner"><h1>conduit</h1><p>A place to share your knowledge.</p></section>
      <div class="cols"><section aria-label="Articles">
        <nav class="tabs" aria-label="Feeds"><ul>${tabs.map(([href, label, on]) => `<li><a href="${href}"${on ? ' aria-current="page"' : ''}>${esc(label)}</a></li>`).join('')}</ul></nav>
        <div id="feed"><p>Loading articles...</p></div></section>
      <aside aria-labelledby="tags-h"><h2 id="tags-h">Popular Tags</h2><div id="tags"><p>Loading tags...</p></div></aside></div>`;
    const [feedHtml, { tags }] = await Promise.all([
      articleFeed(tag ? `&tag=${enc(tag)}` : '', page, (n) => `${base}page=${n}`, yours),
      api('GET', '/tags'),
    ]);
    if (stale(seq)) return;
    document.getElementById('feed').innerHTML = feedHtml;
    document.getElementById('tags').innerHTML = `<ul class="tags">${tags.map((t) => `<li><a href="/?tag=${enc(t)}">${esc(t)}</a></li>`).join('')}</ul>`;
  },

  auth(isRegister) {
    setTitle(isRegister ? 'Sign up' : 'Sign in');
    app.innerHTML = `<h1>${isRegister ? 'Sign up' : 'Sign in'}</h1>
      <p><a href="${isRegister ? '/login' : '/register'}">${isRegister ? 'Have an account?' : 'Need an account?'}</a></p>
      <div id="errors"></div>
      <form id="form" novalidate>
        ${isRegister ? '<label for="username">Username</label><input id="username" name="username" autocomplete="username">' : ''}
        <label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email">
        <label for="password">Password</label><input id="password" name="password" type="password" autocomplete="${isRegister ? 'new-password' : 'current-password'}">
        <button type="submit">${isRegister ? 'Sign up' : 'Sign in'}</button>
      </form>`;
    document.getElementById('form').onsubmit = async (e) => {
      e.preventDefault();
      const user = Object.fromEntries(new FormData(e.target));
      try {
        const r = await api('POST', isRegister ? '/users' : '/users/login', { user });
        localStorage.jwtToken = r.user.token;
        me = r.user;
        go('/');
      } catch (err) { showErrors(err); }
    };
  },

  async editor(seq, slug) {
    if (!me) return go('/login');
    const a = slug ? (await api('GET', `/articles/${enc(slug)}`)).article : { title: '', description: '', body: '', tagList: [] };
    if (stale(seq)) return;
    setTitle(slug ? 'Edit Article' : 'New Article');
    app.innerHTML = `<h1>${slug ? 'Edit Article' : 'New Article'}</h1><div id="errors"></div>
      <form id="form" novalidate>
        <label for="title">Title</label><input id="title" name="title" value="${esc(a.title)}">
        <label for="description">What's this article about?</label><input id="description" name="description" value="${esc(a.description)}">
        <label for="body">Write your article</label><textarea id="body" name="body" rows="8">${esc(a.body)}</textarea>
        <label for="tags">Tags</label><input id="tags" name="tags" value="${esc(a.tagList.join(', '))}" aria-describedby="tags-hint">
        <p id="tags-hint" class="hint">Separate tags with commas.</p>
        <button type="submit">Publish Article</button>
      </form>`;
    document.getElementById('form').onsubmit = async (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      const article = { title: f.title, description: f.description, body: f.body, tagList: f.tags.split(',').map((t) => t.trim()).filter(Boolean) };
      try {
        const r = await api(slug ? 'PUT' : 'POST', slug ? `/articles/${enc(slug)}` : '/articles', { article });
        go(`/article/${enc(r.article.slug)}`);
      } catch (err) { showErrors(err); }
    };
  },

  async article(seq, slug) {
    const [{ article: a }, { comments }] = await Promise.all([api('GET', `/articles/${enc(slug)}`), api('GET', `/articles/${enc(slug)}/comments`)]);
    if (stale(seq)) return;
    setTitle(a.title);
    const mine = me && me.username === a.author.username;
    const author = a.author;
    // The same buttons show twice: in the banner and under the article.
    const actions = mine
      ? `<a href="/editor/${enc(a.slug)}">Edit Article</a> <button type="button" data-action="delete">Delete Article</button>`
      : me
        ? `<button type="button" data-action="follow">${author.following ? 'Unfollow' : 'Follow'} ${esc(author.username)}</button>
           <button type="button" data-action="favorite" aria-pressed="${a.favorited}">${a.favorited ? 'Unfavorite' : 'Favorite'} Article (${a.favoritesCount})</button>`
        : '';
    const meta = `<div class="actions"><p class="meta">By <a href="/profile/${enc(author.username)}">${esc(author.username)}</a> · ${day(a.createdAt)}</p>${actions}</div>`;
    const paragraphs = String(a.body).split(/\n\s*\n/).map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
    app.innerHTML = `<section class="banner dark"><h1>${esc(a.title)}</h1>${meta}</section>
      <article><div class="article-body">${paragraphs}</div>${tagList(a.tagList)}</article>
      <hr>${meta}
      <section aria-labelledby="comments-h"><h2 id="comments-h">Comments</h2><div id="errors"></div>
      ${me ? `<form id="comment-form"><label for="comment">Write a comment</label><textarea id="comment" name="comment" rows="3"></textarea><button type="submit">Post Comment</button></form>`
        : '<p><a href="/login">Sign in</a> or <a href="/register">sign up</a> to add comments on this article.</p>'}
      <ul class="comments">${comments.map((c) => `<li><p>${esc(c.body)}</p>
        <p class="meta"><a href="/profile/${enc(c.author.username)}">${esc(c.author.username)}</a> · ${day(c.createdAt)}
        ${me && c.author.username === me.username ? ` <button type="button" data-comment="${c.id}" aria-label="Delete comment">Delete</button>` : ''}</p></li>`).join('')}</ul></section>`;
    const act = async (fn) => { try { await fn(); } catch (err) { showErrors(err); } };
    app.querySelectorAll('[data-action="delete"]').forEach((b) => b.addEventListener('click', () => act(async () => { await api('DELETE', `/articles/${enc(slug)}`); go('/'); })));
    app.querySelectorAll('[data-action="follow"]').forEach((b) => b.addEventListener('click', () => act(async () => {
      await api(author.following ? 'DELETE' : 'POST', `/profiles/${enc(author.username)}/follow`); render();
    })));
    app.querySelectorAll('[data-action="favorite"]').forEach((b) => b.addEventListener('click', () => act(async () => {
      await api(a.favorited ? 'DELETE' : 'POST', `/articles/${enc(slug)}/favorite`); render();
    })));
    app.querySelectorAll('[data-comment]').forEach((b) => b.addEventListener('click', () => act(async () => {
      await api('DELETE', `/articles/${enc(slug)}/comments/${b.dataset.comment}`); render();
    })));
    const form = document.getElementById('comment-form');
    if (form) form.onsubmit = (e) => { e.preventDefault(); act(async () => { await api('POST', `/articles/${enc(slug)}/comments`, { comment: { body: new FormData(form).get('comment') } }); render(); }); };
  },

  async profile(seq, username, tab) {
    const favorites = tab === 'favorites';
    const page = Math.max(1, Number(new URLSearchParams(location.search).get('page')) || 1);
    const { profile: p } = await api('GET', `/profiles/${enc(username)}`);
    if (stale(seq)) return;
    setTitle(p.username);
    const mine = me && me.username === p.username;
    const base = `/profile/${enc(p.username)}${favorites ? '/favorites' : ''}`;
    app.innerHTML = `<section class="banner dark"><h1>${esc(p.username)}</h1>${p.bio ? `<p>${esc(p.bio)}</p>` : ''}
      ${mine ? '<a href="/settings">Edit Profile Settings</a>' : me ? `<button type="button" id="follow">${p.following ? 'Unfollow' : 'Follow'} ${esc(p.username)}</button>` : ''}</section>
      <nav class="tabs" aria-label="Profile articles"><ul>
        <li><a href="/profile/${enc(p.username)}"${favorites ? '' : ' aria-current="page"'}>My Articles</a></li>
        <li><a href="/profile/${enc(p.username)}/favorites"${favorites ? ' aria-current="page"' : ''}>Favorited Articles</a></li></ul></nav>
      <div id="errors"></div><div id="feed"><p>Loading articles...</p></div>`;
    document.getElementById('follow')?.addEventListener('click', async () => {
      try { await api(p.following ? 'DELETE' : 'POST', `/profiles/${enc(p.username)}/follow`); render(); } catch (err) { showErrors(err); }
    });
    const feedHtml = await articleFeed(`&${favorites ? 'favorited' : 'author'}=${enc(p.username)}`, page, (n) => `${base}?page=${n}`);
    if (!stale(seq)) document.getElementById('feed').innerHTML = feedHtml;
  },

  settings() {
    if (!me) return go('/login');
    setTitle('Settings');
    app.innerHTML = `<h1>Your Settings</h1><div id="errors"></div>
      <form id="form" novalidate>
        <label for="image">URL of profile picture</label><input id="image" name="image" value="${esc(me.image || '')}">
        <label for="username">Username</label><input id="username" name="username" value="${esc(me.username)}">
        <label for="bio">Short bio about you</label><textarea id="bio" name="bio" rows="4">${esc(me.bio || '')}</textarea>
        <label for="email">Email</label><input id="email" name="email" type="email" value="${esc(me.email)}">
        <label for="password">New Password</label><input id="password" name="password" type="password" autocomplete="new-password">
        <button type="submit">Update Settings</button>
      </form><hr><button type="button" id="logout">Or click here to logout.</button>`;
    document.getElementById('form').onsubmit = async (e) => {
      e.preventDefault();
      const user = Object.fromEntries(new FormData(e.target));
      if (!user.password) delete user.password;
      try {
        me = (await api('PUT', '/user', { user })).user;
        localStorage.jwtToken = me.token;
        go(`/profile/${enc(me.username)}`);
      } catch (err) { showErrors(err); }
    };
    document.getElementById('logout').onclick = () => { localStorage.removeItem('jwtToken'); me = null; go('/'); };
  },
};

async function render() {
  const seq = ++renderSeq;
  const [, first, second, third] = location.pathname.split('/').map((s) => decodeURIComponent(s || ''));
  if (localStorage.jwtToken && !me) {
    try { me = (await api('GET', '/user')).user; } catch { localStorage.removeItem('jwtToken'); }
    if (stale(seq)) return;
  }
  nav();
  app.innerHTML = '<p>Loading...</p>';
  try {
    if (!first) await pages.home(seq);
    else if (first === 'login' || first === 'register') pages.auth(first === 'register');
    else if (first === 'editor') await pages.editor(seq, second);
    else if (first === 'article' && second) await pages.article(seq, second);
    else if (first === 'profile' && second) await pages.profile(seq, second, third);
    else if (first === 'settings') pages.settings();
    else { setTitle('Page not found'); app.innerHTML = '<h1>Page not found</h1><p><a href="/">Go to the home page</a></p>'; }
  } catch (err) {
    if (stale(seq)) return;
    setTitle('Error');
    app.innerHTML = `<h1>${err.status === 404 ? 'Not found' : 'Something went wrong'}</h1>${errorList(err)}<p><a href="/">Go to the home page</a></p>`;
  }
}
render();
