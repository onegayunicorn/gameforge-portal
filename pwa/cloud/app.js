(() => {
  'use strict';
  const state = {
    games: [],
    filter: 'All',
    query: '',
    library: new Set(JSON.parse(localStorage.getItem('gameforge-library') || '[]')),
    launches: Number(localStorage.getItem('gameforge-launches') || 0),
  };
  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const colors = { cyan:['#64f6d0','#123f48'], violet:['#b29eff','#241a57'], amber:['#ffd18a','#513318'], rose:['#ff91b2','#561d3b'], green:['#a0efa8','#1f4930'], blue:['#87b8ff','#1b315c'], lime:['#d0fa73','#334d1a'], orange:['#ffb47f','#53301b'] };
  function saveLibrary() { localStorage.setItem('gameforge-library', JSON.stringify([...state.library])); }
  function saveLaunches() { localStorage.setItem('gameforge-launches', String(state.launches)); }
  function openAccount() { $('#accountModal').hidden = false; document.body.style.overflow = 'hidden'; }
  function closeAccount() { $('#accountModal').hidden = true; document.body.style.overflow = ''; }
  function notifyAuth(message, configured = false) {
    $('#authStatus').innerHTML = `<span class="status-dot" style="background:${configured ? 'var(--cyan)' : 'var(--amber)'}"></span><span>${esc(message)}</span>`;
  }
  function xboxSignIn() {
    const clientId = window.GAMEFORGE_XBOX_CLIENT_ID;
    const redirectUri = window.GAMEFORGE_XBOX_REDIRECT_URI || `${window.location.origin}/cloud/`;
    if (!clientId) { notifyAuth('Xbox sign-in is ready for configuration; add a client ID and redirect URI to enable OAuth.'); return; }
    const params = new URLSearchParams({ client_id: clientId, response_type: 'code', redirect_uri: redirectUri, scope: 'openid profile offline_access', state: crypto.randomUUID?.() || String(Date.now()) });
    window.location.assign(`https://login.live.com/oauth20_authorize.srf?${params}`);
  }
  function typeLabel(game) { return game.mode === 'cloud' ? 'GAMEFORGE' : game.mode === 'itch' ? 'ITCH.IO' : 'DOWNLOAD'; }
  function actionFor(game) {
    const href = game.mode === 'cloud' ? game.playUrl : (game.playUrl || game.officialUrl);
    const label = game.mode === 'itch' ? 'Play on itch' : game.cta;
    return `<a class="play-link" href="${esc(href)}" target="_blank" rel="noopener noreferrer" data-launch="${esc(game.id)}">${esc(label)} ↗</a>`;
  }
  function card(game) {
    const [light, dark] = colors[game.accent] || colors.cyan;
    const saved = state.library.has(game.id);
    const initials = game.title.replace(/[^A-Za-z0-9 ]/g, '').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
    const source = game.source || (game.mode === 'cloud' ? 'GameForge Labs' : 'External catalog');
    return `<article class="game-card${game.featured ? ' is-featured' : ''}" data-source="${esc(game.mode)}">
      <div class="cover" style="--cover-light:${light};--cover-dark:${dark}">
        <span class="cover-top">${game.featured ? 'FEATURED DROP' : esc(game.rating || 'FREE')}</span><span class="mode-chip">${esc(typeLabel(game))}</span>
        <div class="cover-art">${esc(initials)}</div><span class="cover-signal">${game.mode === 'itch' ? 'BROWSER READY' : 'NO QUEUE'}</span>
      </div>
      <div class="card-body"><div class="title-row"><h3>${esc(game.title)}</h3><span class="rating">${esc(game.rating || 'E')}</span></div>
        <p class="studio">${esc(source)} · ${esc(game.genre)}</p><p class="card-desc">${esc(game.description)}</p>
        <div class="tag-row">${(game.tags || []).slice(0, 3).map((tag) => `<span>#${esc(tag)}</span>`).join('')}</div>
        <div class="card-foot"><span class="genre">${esc(game.players || '1 player')}</span><span>${actionFor(game)}</span></div>
        <button class="text-button library-toggle" data-game="${esc(game.id)}">${saved ? '✓ In your library' : '+ Add to library'}</button>
      </div></article>`;
  }
  function matches(game) {
    const haystack = `${game.title} ${game.studio} ${game.source || ''} ${game.genre} ${(game.tags || []).join(' ')}`.toLowerCase();
    if (state.query && !haystack.includes(state.query.toLowerCase())) return false;
    if (state.filter === 'All') return true;
    if (state.filter === 'Instant play') return game.mode === 'cloud';
    if (state.filter === 'Browser') return game.mode === 'cloud' || game.mode === 'itch';
    return game.genre === state.filter;
  }
  function render() {
    const filtered = state.games.filter(matches);
    $('#gameGrid').innerHTML = filtered.map(card).join('');
    $('#emptyState').hidden = filtered.length > 0;
    $('#gameCount').textContent = state.games.length;
    $('#browserCount').textContent = state.games.filter((game) => game.mode === 'cloud' || game.mode === 'itch').length;
    $('#launchCount').textContent = state.launches;
    document.querySelectorAll('.library-toggle').forEach((button) => button.addEventListener('click', () => { const id = button.dataset.game; state.library.has(id) ? state.library.delete(id) : state.library.add(id); saveLibrary(); render(); }));
    document.querySelectorAll('[data-launch]').forEach((link) => link.addEventListener('click', () => { state.launches += 1; saveLaunches(); $('#launchCount').textContent = state.launches; }));
  }
  function renderFilters() {
    const filters = ['All', 'Browser', 'Instant play', ...new Set(state.games.map((game) => game.genre))];
    $('#filters').innerHTML = filters.map((filter) => `<button class="filter${filter === state.filter ? ' active' : ''}" data-filter="${esc(filter)}">${esc(filter)}</button>`).join('');
    document.querySelectorAll('.filter').forEach((button) => button.addEventListener('click', () => { state.filter = button.dataset.filter; renderFilters(); render(); }));
  }
  async function load() {
    const response = await fetch('./data/games.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Game catalog HTTP ${response.status}`);
    state.games = (await response.json()).catalog || [];
    renderFilters(); render();
  }
  $('#accountButton').addEventListener('click', openAccount); $('#heroAccount').addEventListener('click', openAccount); $('#modalClose').addEventListener('click', closeAccount); $('#accountModal').addEventListener('click', (event) => { if (event.target === $('#accountModal')) closeAccount(); }); $('#xboxButton').addEventListener('click', xboxSignIn);
  $('#guestButton').addEventListener('click', () => { localStorage.setItem('gameforge-guest', 'true'); $('#accountLabel').textContent = 'Guest player'; notifyAuth('Guest mode active — your library is saved on this device.', true); });
  $('#searchToggle').addEventListener('click', () => { $('#searchInput').focus(); document.querySelector('#library').scrollIntoView({ behavior:'smooth' }); });
  $('#searchInput').addEventListener('input', (event) => { state.query = event.target.value; render(); });
  load().catch((error) => { $('#gameGrid').innerHTML = `<p class="empty-state">${esc(error.message)}</p>`; });
})();
