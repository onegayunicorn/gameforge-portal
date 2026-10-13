/* GameForge Portal - portal client. Renders entirely from portal/data/builds.json + runtime info. */
'use strict';

const $ = (sel, scope = document) => scope.querySelector(sel);
const $$ = (sel, scope = document) => Array.from(scope.querySelectorAll(sel));

// Surface client-side errors so the packaged shell (and the self test) can report them.
window.__portalErrors = [];
window.addEventListener('error', (e) => window.__portalErrors.push(String((e && e.message) || e)));
window.addEventListener('unhandledrejection', (e) =>
  window.__portalErrors.push('unhandled: ' + String((e && e.reason && e.reason.message) || (e && e.reason))));

const bridge = window.portalAPI || null;
const isDesktop = Boolean(bridge && bridge.isDesktop);

const state = {
  data: null,
  runtime: null,
  query: '',
  filter: 'all',
  openId: null,
  tab: 'overview',
};

/* ---------------- formatting ---------------- */
const fmtNum = (n) => (typeof n === 'number' ? n.toLocaleString('en-US') : '—');

function fmtBytes(bytes) {
  if (typeof bytes !== 'number') return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i += 1; }
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${units[i]}`;
}

const shortHash = (h, head = 12, tail = 6) =>
  typeof h === 'string' && h.length > head + tail ? `${h.slice(0, head)}…${h.slice(-tail)}` : (h || '—');

/* ---------------- toasts ---------------- */
function toast(message, detail, kind) {
  const stack = $('#toasts');
  const el = document.createElement('div');
  el.className = `toast${kind ? ' ' + kind : ''}`;
  el.innerHTML = `<div>${escapeHtml(message)}</div>${detail ? `<small>${escapeHtml(detail)}</small>` : ''}`;
  stack.appendChild(el);
  setTimeout(() => el.remove(), 5200);
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/* ---------------- actions ---------------- */
async function runAction(action, payload, okMessage) {
  if (!isDesktop) {
    toast('Desktop app required', 'This action runs through the packaged Windows shell. Open GameForge Portal.exe to use it.');
    return null;
  }
  try {
    const res = await bridge.invoke(action, payload || {});
    if (res && res.ok === false && res.error) {
      toast('Action failed', res.error, 'err');
      return null;
    }
    if (okMessage) toast(okMessage, res && res.detail ? res.detail : '');
    return res;
  } catch (err) {
    toast('Action failed', String(err && err.message ? err.message : err), 'err');
    return null;
  }
}

/* ---------------- data ---------------- */
// The index is required; the runtime probe is only enrichment. Both are time-boxed so a slow or
// unreachable endpoint can never leave the portal stuck on its loading placeholders.
const DATA_TIMEOUT_MS = 8000;
const RUNTIME_TIMEOUT_MS = 2500;

async function fetchWithTimeout(url, timeoutMs) {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    return await fetch(url, {
      cache: 'no-store',
      signal: controller ? controller.signal : undefined,
    });
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function loadData() {
  const res = await fetchWithTimeout('./data/builds.json', DATA_TIMEOUT_MS);
  if (!res.ok) throw new Error(`builds.json HTTP ${res.status}`);
  state.data = await res.json();
}

async function loadRuntime() {
  try {
    if (bridge && typeof bridge.info === 'function') {
      state.runtime = await bridge.info();
      return;
    }
    const res = await fetchWithTimeout('/api/runtime', RUNTIME_TIMEOUT_MS);
    state.runtime = res.ok ? await res.json() : { mode: 'browser' };
  } catch {
    // Offline, timed out, or a static host with no API: the portal stays fully usable.
    state.runtime = { mode: 'browser' };
  }
}

/* ---------------- header / hero ---------------- */
/** Available immediately: depends only on the preload bridge, never on the build index. */
function renderModePill() {
  const mode = isDesktop ? 'desktop' : 'browser';
  const pill = $('#modePill');
  if (!pill) return;
  pill.dataset.mode = mode;
  $('#modeText').textContent = isDesktop ? 'Desktop app' : 'Browser mode';
}

function renderHeader() {
  renderModePill();

  const rt = state.runtime || {};
  const pkgVersion = state.data.projects.find((p) => p.version && p.id === 'universal-game-platform');
  $('#appVersion').textContent = 'v' + ((rt.appVersion) || pkgVersion?.version || '1.0.0');

  $('#statGrid').innerHTML = [
    ['Projects', fmtNum(state.data.totals.projects), 'embedded builds'],
    ['Files', fmtNum(state.data.totals.files), 'indexed on disk'],
    ['Payload', fmtBytes(state.data.totals.bytes), 'uncompressed'],
    ['Documents', fmtNum(state.data.totals.docs), 'markdown files'],
    ['Web entry points', fmtNum(state.data.totals.html), 'html files'],
    ['Archives verified', `${state.data.sidecars.length}/${state.data.projects.length}`, 'sha256 sidecars'],
  ].map(([label, value, note]) => `
    <li>
      <span class="stat-label">${escapeHtml(label)}</span>
      <span class="stat-value">${escapeHtml(value)}</span>
      <span class="stat-note">${escapeHtml(note)}</span>
    </li>`).join('');

  $('#payloadBadge').textContent = `${state.data.projects.length} builds`;
  const when = new Date(state.data.generatedAt);
  $('#dataStamp').textContent =
    `Index generated ${when.toLocaleString('en-GB')} · ${fmtNum(state.data.totals.files)} files · ${fmtBytes(state.data.totals.bytes)}`;
  $('#footerStamp').textContent =
    `Index generated ${when.toISOString()} · digest snapshot ${shortHash(state.data.projects[0] && state.data.projects[0].digest)}`;
  $('#footerPaths').textContent = rt.payloadPath ? `payload: ${rt.payloadPath}` : 'payload embedded in application resources';
}

/* ---------------- overview ---------------- */
function renderOverview() {
  const perProject = state.data.projects.map((p) => ({ id: p.id, label: p.label, kind: p.kind, roots: p.roots, version: p.version, accent: p.accent, files: p.fileCount, subProducts: p.subProducts }));
  const totals = {
    apps: perProject.reduce((a, p) => a + p.roots.apps, 0),
    packages: perProject.reduce((a, p) => a + p.roots.packages, 0),
    tests: perProject.reduce((a, p) => a + p.roots.tests, 0),
    infra: perProject.reduce((a, p) => a + p.roots.infra, 0),
  };

  const cards = [
    {
      title: 'Payload composition',
      kind: 'Every indexed file in the three builds',
      accent: '#6ea8ff',
      rows: [
        ['Applications / apps', fmtNum(totals.apps)],
        ['Library packages', fmtNum(totals.packages)],
        ['Test trees', fmtNum(totals.tests)],
        ['Infrastructure', fmtNum(totals.infra)],
        ['Declared web entry points', fmtNum(state.data.totals.html)],
      ],
    },
    ...perProject.map((p) => ({
      title: p.label,
      kind: p.kind + (p.version ? ` · v${p.version}` : ' · version not declared'),
      accent: p.accent,
      rows: [
        ['Files', fmtNum(p.files)],
        ['Apps', fmtNum(p.roots.apps)],
        ['Packages', fmtNum(p.roots.packages)],
        ['Docs', fmtNum(p.roots.docs)],
        ['Sub-products', p.subProducts.length ? p.subProducts.map((s) => s.name).join(', ') : '—'],
      ],
    })),
  ];

  $('#overviewGrid').innerHTML = cards.map((c) => `
    <article class="overview-card" style="--card-accent:${c.accent}">
      <h3>${escapeHtml(c.title)}</h3>
      <p class="kind">${escapeHtml(c.kind)}</p>
      <ul>${c.rows.map(([k, v]) => `<li><span>${escapeHtml(k)}</span><b>${escapeHtml(v)}</b></li>`).join('')}</ul>
    </article>`).join('');
}

function renderStatusCallout() {
  const el = $('#statusCallout');
  const text = $('#statusCalloutText');
  const distFiles = state.data.projects.find((p) => p.id === 'universal-game-platform');
  const hasDist = distFiles && distFiles.modules && distFiles.modules.dist;
  if (!hasDist) return;
  el.hidden = false;
  text.textContent =
    'The embedded builds are TypeScript scaffolds. Compiled output is present but consists of small stub modules ' +
    '(the universal-game-platform dist/ tree averages a few hundred bytes per file), and no production web bundle ' +
    'is included in the sources. This portal therefore indexes and launches the builds as source trees — it does not ' +
    'pretend they are runnable games. Running any build requires installing its own toolchain (pnpm + turbo) and building it.';
}

/* ---------------- projects ---------------- */
function renderFilters() {
  const kinds = [...new Set(state.data.projects.map((p) => p.badge))];
  const opts = [{ key: 'all', label: `All (${state.data.projects.length})` }]
    .concat(kinds.map((k) => ({ key: k, label: `${k} (${state.data.projects.filter((p) => p.badge === k).length})` })));
  $('#filters').innerHTML = opts.map((o) => `
    <button class="chip" data-filter="${escapeHtml(o.key)}" aria-pressed="${state.filter === o.key}">${escapeHtml(o.label)}</button>`).join('');
  $$('#filters .chip').forEach((b) => b.addEventListener('click', () => {
    state.filter = b.dataset.filter;
    renderFilters();
    renderCards();
  }));
}

function matches(p, q) {
  if (!q) return true;
  const hay = [p.id, p.label, p.kind, p.badge, p.description, p.readmeTitle, p.packageName,
    ...p.docs, ...p.topLevel, ...p.tree.slice(0, 300)].join(' ').toLowerCase();
  return hay.includes(q);
}

function renderCards() {
  const q = state.query.trim().toLowerCase();
  const list = state.data.projects.filter((p) => (state.filter === 'all' || p.badge === state.filter) && matches(p, q));
  $('#projectEmpty').hidden = list.length > 0;

  const maxMod = Math.max(1, ...list.flatMap((p) => Object.values(p.modules)));

  $('#projectGrid').innerHTML = list.map((p) => {
    const bars = Object.entries(p.modules)
      .sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([name, count]) => `
        <div class="bar-row">
          <span>${escapeHtml(name)}</span>
          <span class="bar-track"><span class="bar-fill" style="width:${Math.max(3, Math.round((count / maxMod) * 100))}%"></span></span>
          <b>${fmtNum(count)}</b>
        </div>`).join('');

    return `
    <article class="card" style="--card-accent:${p.accent}" data-id="${escapeHtml(p.id)}">
      <div class="card-top">
        <div>
          <h3>${escapeHtml(p.label)}</h3>
          <p class="kind">${escapeHtml(p.kind)}</p>
        </div>
        <span class="tag">${escapeHtml(p.badge)}</span>
      </div>
      <p class="desc">${escapeHtml(p.description || 'No description found in package.json or README.')}</p>
      <div class="card-meta">
        ${p.version ? `<span class="meta-chip">version <b>${escapeHtml(p.version)}</b></span>` : '<span class="meta-chip">version <b>n/a</b></span>'}
        <span class="meta-chip">files <b>${fmtNum(p.fileCount)}</b></span>
        <span class="meta-chip">dirs <b>${fmtNum(p.dirCount)}</b></span>
        <span class="meta-chip">size <b>${fmtBytes(p.bytes)}</b></span>
        ${p.packageManager ? `<span class="meta-chip">pm <b>${escapeHtml(p.packageManager)}</b></span>` : ''}
        ${p.declaredTargets ? `<span class="meta-chip">targets <b>${p.declaredTargets}</b></span>` : ''}
        ${p.declaredAdapters ? `<span class="meta-chip">adapters <b>${p.declaredAdapters}</b></span>` : ''}
      </div>
      <div class="bars">${bars}</div>
      <div class="card-actions">
        <button class="btn small" data-act="detail">Inspect</button>
        <button class="btn small" data-act="readme">Open README</button>
        <button class="btn small" data-act="reveal" data-desktop-only>Reveal folder</button>
        <button class="btn small" data-act="copy">Copy path</button>
      </div>
    </article>`;
  }).join('');

  $$('#projectGrid .card').forEach((card) => {
    const p = state.data.projects.find((x) => x.id === card.dataset.id);
    $('[data-act="detail"]', card).addEventListener('click', () => openDrawer(p.id));
    $('[data-act="readme"]', card).addEventListener('click', () => openReadme(p));
    $('[data-act="reveal"]', card).addEventListener('click', () =>
      runAction('project:reveal', { id: p.id }, `Revealed ${p.label}`));
    $('[data-act="copy"]', card).addEventListener('click', async () => {
      const text = (state.runtime && state.runtime.payloadPath)
        ? `${state.runtime.payloadPath}\\${p.id}` : p.id;
      try { await navigator.clipboard.writeText(text); toast('Path copied', text, 'ok'); }
      catch { toast('Copy failed', text, 'err'); }
    });
  });
}

function openReadme(p) {
  if (!p.hasReadme) { toast('No README found', `${p.label} does not ship a README.md`); return; }
  const candidates = ['README.md', `${p.innerRoot}/README.md`, 'readme.md'];
  runAction('project:openFile', { id: p.id, rel: candidates[0], search: 'README.md' }, `Opened README for ${p.label}`);
}

/* ---------------- integrity ---------------- */
function renderIntegrity() {
  const rows = state.data.projects.map((p) => {
    const supplied = p.archive || '— not supplied —';
    const expected = p.archiveSha256
      ? `<span class="hash">${escapeHtml(shortHash(p.archiveSha256, 16, 8))}</span>`
      : '<span class="verdict none">no sidecar</span>';
    return `
      <tr>
        <td><strong>${escapeHtml(p.label)}</strong><br><span class="muted" style="font-size:11.5px">${escapeHtml(p.id)}</span></td>
        <td><span class="mono">${escapeHtml(supplied)}</span></td>
        <td>${expected}</td>
        <td><span class="hash dim">${escapeHtml(shortHash(p.digest, 16, 8))}</span></td>
        <td>${p.archiveSha256
          ? `<span class="verdict ok">● sidecar</span>`
          : `<span class="verdict warn">● missing</span>`}</td>
      </tr>`;
  }).join('');
  $('#integrityTable tbody').innerHTML = rows;

  const missing = state.data.projects.filter((p) => p.archive && !p.archiveSha256).length;
  const noArchive = state.data.projects.filter((p) => !p.archive).length;
  $('#integrityHint').textContent =
    `${state.data.sidecars.length} supplied .sha256 sidecar file(s) were read at build time. ` +
    (noArchive ? `${noArchive} build(s) were provided as a folder with no accompanying archive hash. ` : '') +
    (missing ? `${missing} archive is referenced without a matching sidecar. ` : '') +
    'The live tree digest is recomputed from the files embedded in this application using sorted path + size + file SHA-256, ' +
    'so it identifies the exact payload revision shipped in this EXE.';
}

/* ---------------- runtime ---------------- */
function renderRuntime() {
  const rt = state.runtime || {};
  const kv = (obj) => Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`).join('');

  $('#runtimeApp').innerHTML = kv({
    Product: rt.productName || 'GameForge Portal',
    'App version': rt.appVersion || $('#appVersion').textContent,
    Electron: rt.electron || (isDesktop ? '—' : 'n/a (browser)'),
    Chromium: rt.chrome || '—',
    'Node.js': rt.node || '—',
    'V8': rt.v8 || '—',
    Packaged: rt.isPackaged === undefined ? '—' : (rt.isPackaged ? 'yes (production build)' : 'no (development)'),
    'Started': rt.startedAt ? new Date(rt.startedAt).toLocaleString('en-GB') : '—',
  });

  $('#runtimeServer').innerHTML = kv({
    Mode: isDesktop ? 'desktop shell + embedded static server' : 'browser (standalone server)',
    Bind: rt.serverHost ? `${rt.serverHost}:${rt.serverPort}` : '—',
    Origin: rt.portalUrl || window.location.origin,
    Session: rt.sessionToken ? 'token enforced' : 'n/a',
    'Read-only API': '/api/runtime, /data/builds.json',
  });

  $('#runtimeHost').innerHTML = kv({
    Platform: rt.platform || navigator.platform,
    Architecture: rt.arch || '—',
    CPU: rt.cpus ? `${rt.cpus} logical cores` : '—',
    'System memory': rt.totalMem ? fmtBytes(rt.totalMem) : '—',
    'Locale / timezone': rt.locale || '—',
    'Payload root': rt.payloadPath || 'embedded',
  });
}

/* ---------------- docs ---------------- */
function renderDocs() {
  const q = $('#docSearch').value.trim().toLowerCase();
  const cols = state.data.projects.map((p) => {
    const docs = p.docs.filter((d) => !q || d.toLowerCase().includes(q));
    return { p, docs };
  });
  const any = cols.some((c) => c.docs.length);
  $('#docEmpty').hidden = any;

  $('#docColumns').innerHTML = cols.map(({ p, docs }) => `
    <section class="doc-col" style="--card-accent:${p.accent}">
      <h3><span class="swatch"></span>${escapeHtml(p.label)} <span class="muted" style="font-size:11.5px">(${docs.length})</span></h3>
      <ul class="doc-list">
        ${docs.length
          ? docs.map((d) => `<li><button data-id="${escapeHtml(p.id)}" data-doc="${escapeHtml(d)}" title="${escapeHtml(d)}">docs/${escapeHtml(d)}</button></li>`).join('')
          : '<li class="muted" style="padding:6px 9px;font-size:12.5px">No markdown documents in docs/.</li>'}
      </ul>
    </section>`).join('');

  $$('#docColumns button').forEach((b) => b.addEventListener('click', () => {
    runAction('project:openFile', { id: b.dataset.id, rel: `docs/${b.dataset.doc}` }, `Opened ${b.dataset.doc}`);
  }));
}

/* ---------------- drawer ---------------- */
function openDrawer(id) {
  state.openId = id;
  state.tab = 'overview';
  const p = state.data.projects.find((x) => x.id === id);
  if (!p) return;

  $('#drawerBadge').textContent = p.badge;
  $('#drawerTitle').textContent = p.label;
  $('#drawerSub').textContent = [p.kind, p.version ? `v${p.version}` : null, p.packageName].filter(Boolean).join(' · ');

  $('#drawerActions').innerHTML = `
    <button class="btn small" data-d="reveal" data-desktop-only>Reveal folder</button>
    <button class="btn small" data-d="readme">Open README</button>
    <button class="btn small" data-d="export" data-desktop-only>Export copy…</button>
    <button class="btn small" data-d="copy">Copy folder path</button>`;

  $('[data-d="reveal"]', $('#drawerActions')).addEventListener('click', () =>
    runAction('project:reveal', { id }, `Revealed ${p.label}`));
  $('[data-d="readme"]', $('#drawerActions')).addEventListener('click', () => openReadme(p));
  $('[data-d="export"]', $('#drawerActions')).addEventListener('click', async () => {
    const res = await runAction('project:export', { id },
      `Exported ${p.label}`, );
    if (res && res.detail) toast('Export complete', res.detail, 'ok');
  });
  $('[data-d="copy"]', $('#drawerActions')).addEventListener('click', async () => {
    const text = (state.runtime && state.runtime.payloadPath) ? `${state.runtime.payloadPath}\\${p.id}` : p.id;
    try { await navigator.clipboard.writeText(text); toast('Path copied', text, 'ok'); }
    catch { toast('Copy failed', text, 'err'); }
  });

  const tabs = ['overview', 'structure', 'docs', 'entries', 'integrity'];
  $('#drawerTabs').innerHTML = tabs.map((t) => `
    <button class="tab" role="tab" data-tab="${t}" aria-selected="${t === state.tab}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('');
  $$('#drawerTabs .tab').forEach((b) => b.addEventListener('click', () => {
    state.tab = b.dataset.tab;
    $$('#drawerTabs .tab').forEach((x) => x.setAttribute('aria-selected', String(x.dataset.tab === state.tab)));
    renderDrawerBody();
  }));

  renderDrawerBody();
  $('#drawer').hidden = false;
  $('#drawer').setAttribute('aria-hidden', 'false');
  $('#drawerScrim').hidden = false;
}

function closeDrawer() {
  $('#drawer').hidden = true;
  $('#drawer').setAttribute('aria-hidden', 'true');
  $('#drawerScrim').hidden = true;
  state.openId = null;
}

function renderDrawerBody() {
  const p = state.data.projects.find((x) => x.id === state.openId);
  if (!p) return;
  const body = $('#drawerBody');

  if (state.tab === 'overview') {
    body.innerHTML = `
      <h4>Description</h4>
      <p class="muted">${escapeHtml(p.description || 'Not declared.')}</p>
      <h4>Measured facts</h4>
      <dl class="kv">
        <dt>Detected kind</dt><dd>${escapeHtml(p.kind)}</dd>
        <dt>Package name</dt><dd>${escapeHtml(p.packageName || '—')}</dd>
        <dt>Version</dt><dd>${escapeHtml(p.version || 'not declared')}</dd>
        <dt>Package manager</dt><dd>${escapeHtml(p.packageManager || 'not declared')}</dd>
        <dt>Files / directories</dt><dd>${fmtNum(p.fileCount)} / ${fmtNum(p.dirCount)}</dd>
        <dt>Uncompressed size</dt><dd>${fmtBytes(p.bytes)}</dd>
        <dt>Inner content root</dt><dd class="mono">${escapeHtml(p.innerRoot)}</dd>
        <dt>Declared targets</dt><dd>${p.declaredTargets ?? '—'}</dd>
        <dt>Declared adapters</dt><dd>${p.declaredAdapters ?? '—'}</dd>
      </dl>
      <h4>Scripts declared in package.json</h4>
      ${p.scripts
        ? `<div class="pill-row">${Object.entries(p.scripts).map(([k]) => `<span class="meta-chip"><b>${escapeHtml(k)}</b></span>`).join('')}</div>`
        : '<p class="muted">No scripts field found.</p>'}
      ${p.subProducts.length ? `
        <h4>Sub-products</h4>
        <div class="pill-row">${p.subProducts.map((s) => `<span class="meta-chip"><b>${escapeHtml(s.name)}</b> ${fmtNum(s.files)} files</span>`).join('')}</div>` : ''}
    `;
  }

  if (state.tab === 'structure') {
    const top = p.topLevel;
    const tree = p.tree;
    body.innerHTML = `
      <h4>Top level (${top.length} entries)</h4>
      <ul class="tree-list">${top.map((t) => `<li class="${t.endsWith('/') ? 'is-dir' : ''}">${escapeHtml(t)}</li>`).join('')}</ul>
      <h4>Indexed paths (${fmtNum(tree.length)}${p.fileCount > tree.length ? ` of ${fmtNum(p.fileCount)}` : ''})</h4>
      <div class="code-block">${escapeHtml(tree.join('\n'))}</div>
    `;
  }

  if (state.tab === 'docs') {
    body.innerHTML = p.docs.length
      ? `<h4>Markdown documents (${p.docs.length})</h4><ul class="tree-list">${p.docs
          .map((d) => `<li><button class="doc-open" data-doc="${escapeHtml(d)}" style="background:none;border:0;color:#cfe0ff;font-family:var(--mono);font-size:12px;cursor:pointer;padding:0">docs/${escapeHtml(d)}</button></li>`)
          .join('')}</ul>`
      : '<p class="muted">No markdown documents found in a docs/ directory.</p>';
    $$('#drawerBody .doc-open').forEach((b) => b.addEventListener('click', () =>
      runAction('project:openFile', { id: p.id, rel: `docs/${b.dataset.doc}` }, `Opened ${b.dataset.doc}`)));
  }

  if (state.tab === 'entries') {
    const sec = (title, arr, prefix) => arr.length
      ? `<h4>${title} (${arr.length})</h4><ul class="tree-list">${arr.map((f) => `
          <li><button class="entry-open" data-rel="${escapeHtml(f)}" style="background:none;border:0;color:#cfe0ff;font-family:var(--mono);font-size:12px;cursor:pointer;padding:0">${escapeHtml(f)}</button></li>`).join('')}</ul>`
      : `<h4>${title}</h4><p class="muted">None detected.</p>`;
    body.innerHTML =
      sec('HTML entry points', p.entrypoints.html) +
      sec('Shell scripts', p.entrypoints.scripts) +
      sec('Build / config manifests', p.entrypoints.configs);
    $$('#drawerBody .entry-open').forEach((b) => b.addEventListener('click', () =>
      runAction('project:openFile', { id: p.id, rel: b.dataset.rel }, `Opened ${b.dataset.rel}`)));
  }

  if (state.tab === 'integrity') {
    body.innerHTML = `
      <h4>Live content digest</h4>
      <div class="code-block">sha256 ${escapeHtml(p.digest)}</div>
      <h4>Supplied archive hash</h4>
      ${p.archiveSha256
        ? `<p class="muted mono">${escapeHtml(p.archive)}</p><div class="code-block">sha256 ${escapeHtml(p.archiveSha256)}</div>
           <p class="hint">Source: supplied <code>.sha256</code> sidecar file. The sidecar covers the distributed ZIP, while the digest
           above covers the extracted tree embedded in this application — they are different measurements of the same release.</p>`
        : `<p class="muted">No <code>.sha256</code> sidecar was supplied with this build (${escapeHtml(p.archive || 'provided as a folder')}). Only the live tree digest is available.</p>`}
    `;
  }
}

/* ---------------- search wiring ---------------- */
function wireSearch() {
  let t = null;
  $('#globalSearch').addEventListener('input', (e) => {
    clearTimeout(t);
    const v = e.target.value;
    t = setTimeout(() => {
      state.query = v;
      renderCards();
    }, 120);
  });
  $('#docSearch').addEventListener('input', () => renderDocs());
}

function wireGlobals() {
  $('#drawerClose').addEventListener('click', closeDrawer);
  $('#drawerScrim').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.openId) closeDrawer();
  });
  $('#btnRecheck').addEventListener('click', async () => {
    toast('Recomputing digests…');
    const res = await (isDesktop ? runAction('payload:recheck', {}, null) : Promise.resolve(null));
    if (res && res.data) {
      state.data = res.data;
      const p = state.data.projects.find((x) => x.id === state.openId);
      if (p) renderDrawerBody();
      renderIntegrity();
      toast('Digests recomputed', `${state.data.projects.length} build digests verified against the payload on disk`, 'ok');
    } else if (!isDesktop) {
      toast('Desktop app required', 'Digest recomputation runs in the packaged application.');
    }
  });
  $('#btnOpenPayload').addEventListener('click', () =>
    runAction('payload:reveal', {}, 'Revealed payload folder'));
}

/* ---------------- boot ---------------- */
function markDesktopOnly() {
  $$('[data-desktop-only]').forEach((el) => {
    if (!isDesktop) { el.classList.add('is-locked'); el.title = 'Available in the packaged desktop app'; }
  });
}

function renderPortalData() {
  renderOverview();
  renderStatusCallout();
  renderFilters();
  renderCards();
  renderIntegrity();
  renderDocs();
}

(async function boot() {
  wireSearch();
  wireGlobals();

  renderModePill();   // shell chrome does not depend on the index or the runtime probe

  try {
    await loadData();
    renderHeader();
    renderPortalData();
    markDesktopOnly();
  } catch (err) {
    document.body.insertAdjacentHTML('afterbegin',
      `<div class="callout" style="margin:22px"><strong>Portal data unavailable</strong><p>${escapeHtml(String(err && err.message || err))}</p></div>`);
    markDesktopOnly();
    return;
  }

  // Enrichment only: failures and timeouts leave the already-rendered portal untouched.
  loadRuntime()
    .then(() => { renderHeader(); renderRuntime(); })
    .catch(() => {});
})();
