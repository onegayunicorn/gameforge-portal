(() => {
  'use strict';
  const state = { games: [], filter: 'All', query: '', library: new Set(JSON.parse(localStorage.getItem('gameforge-library') || '[]')) };
  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const colors = { cyan:['#64f6d0','#123f48'], violet:['#b29eff','#241a57'], amber:['#ffd18a','#513318'], rose:['#ff91b2','#561d3b'], green:['#a0efa8','#1f4930'], blue:['#87b8ff','#1b315c'], lime:['#d0fa73','#334d1a'], orange:['#ffb47f','#53301b'] };
  function saveLibrary() { localStorage.setItem('gameforge-library', JSON.stringify([...state.library])); }
  function openAccount() { $('#accountModal').hidden = false; document.body.style.overflow = 'hidden'; }
  function closeAccount() { $('#accountModal').hidden = true; document.body.style.overflow = ''; }
  function notifyAuth(message, configured = false) {
    const status = $('#authStatus');
    status.innerHTML = `<span class="status-dot" style="background:${configured ? 'var(--cyan)' : 'var(--amber)'}"></span><span>${esc(message)}</span>`;
  }
  function xboxSignIn() {
    const clientId = window.GAMEFORGE_XBOX_CLIENT_ID;
    const redirectUri = window.GAMEFORGE_XBOX_REDIRECT_URI || `${window.location.origin}/cloud/`;
    if (!clientId) {
      notifyAuth('Xbox sign-in is ready for configuration; add a client ID and redirect URI to enable OAuth.');
      return;
    }
    const params = new URLSearchParams({ client_id: clientId, response_type: 'code', redirect_uri: redirectUri, scope: 'openid profile offline_access', state: crypto.randomUUID?.() || String(Date.now()) });
    window.location.assign(`https://login.live.com/oauth20_authorize.srf?${params}`);
  }
  function card(game) {
    const [light, dark] = colors[game.accent] || colors.cyan;
    const saved = state.library.has(game.id);
    const action = game.mode === 'cloud' ? `<a class="play-link" href="${esc(game.playUrl)}" target="_blank" rel="noopener">${esc(game.cta)} ↗</a>` : `<a class="play-link" href="${esc(game.officialUrl)}" target="_blank" rel="noopener">${esc(game.cta)} ↗</a>`;
    return `<article class="game-card"><div class="cover" style="--cover-light:${light};--cover-dark:${dark}"><span class="cover-top">${game.featured ? 'FEATURED' : esc(game.rating)}</span><span class="mode-chip">${game.mode === 'cloud' ? 'INSTANT' : 'FREE'}</span><div class="cover-art">${esc(game.title.slice(0,2).toUpperCase())}</div></div><div class="card-body"><h3>${esc(game.title)}</h3><p class="studio">${esc(game.studio)}</p><p class="card-desc">${esc(game.description)}</p><div class="card-foot"><span class="genre">${esc(game.genre)} · ${esc(game.players)}</span><span>${action}</span></div><button class="text-button library-toggle" data-game="${esc(game.id)}">${saved ? '✓ In your library' : '+ Add to library'}</button></div></article>`;
  }
  function render() {
    const filtered = state.games.filter((game) => (state.filter === 'All' || game.genre === state.filter || (state.filter === 'Instant play' && game.mode === 'cloud')) && (`${game.title} ${game.studio} ${game.genre} ${game.tags.join(' ')}`).toLowerCase().includes(state.query.toLowerCase()));
    $('#gameGrid').innerHTML = filtered.map(card).join('');
    $('#emptyState').hidden = filtered.length > 0;
    $('#gameCount').textContent = state.games.length;
    document.querySelectorAll('.library-toggle').forEach((button) => button.addEventListener('click', () => { const id = button.dataset.game; state.library.has(id) ? state.library.delete(id) : state.library.add(id); saveLibrary(); render(); }));
  }
  function renderFilters() {
    const filters = ['All', 'Instant play', ...new Set(state.games.map((g) => g.genre))];
    $('#filters').innerHTML = filters.map((filter) => `<button class="filter${filter === state.filter ? ' active' : ''}" data-filter="${esc(filter)}">${esc(filter)}</button>`).join('');
    document.querySelectorAll('.filter').forEach((button) => button.addEventListener('click', () => { state.filter = button.dataset.filter; renderFilters(); render(); }));
  }
  async function load() {
    const response = await fetch('./data/games.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Game catalog HTTP ${response.status}`);
    state.games = (await response.json()).catalog || [];
    renderFilters(); render();
  }
  $('#accountButton').addEventListener('click', openAccount); $('#heroAccount').addEventListener('click', openAccount); $('#modalClose').addEventListener('click', closeAccount); $('#accountModal').addEventListener('click', (event) => { if (event.target === $('#accountModal')) closeAccount(); }); $('#xboxButton').addEventListener('click', xboxSignIn); $('#guestButton').addEventListener('click', () => { localStorage.setItem('gameforge-guest', 'true'); $('#accountLabel').textContent = 'Guest player'; notifyAuth('Guest mode active — your library is saved on this device.', true); }); $('#searchToggle').addEventListener('click', () => { $('#searchInput').focus(); document.querySelector('#library').scrollIntoView({ behavior:'smooth' }); }); $('#searchInput').addEventListener('input', (event) => { state.query = event.target.value; render(); });
  load().catch((error) => { $('#gameGrid').innerHTML = `<p class="empty-state">${esc(error.message)}</p>`; });
})();
