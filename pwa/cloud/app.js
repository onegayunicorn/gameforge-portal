(() => {
  'use strict';
  const state = { games: [], filter: 'All', query: '', library: new Set(JSON.parse(localStorage.getItem('gameforge-library') || '[]')), launches: Number(localStorage.getItem('gameforge-launches') || 0) };
  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const colors = { cyan:['#9bf334','#1c421d'], violet:['#b5a4ff','#281d59'], amber:['#ffc56d','#513318'], rose:['#ff91b2','#561d3b'], green:['#a0efa8','#1f4930'], blue:['#87c8ff','#1b315c'], lime:['#d0fa73','#334d1a'], orange:['#ffb47f','#53301b'] };
  const saveLibrary = () => localStorage.setItem('gameforge-library', JSON.stringify([...state.library]));
  const saveLaunches = () => localStorage.setItem('gameforge-launches', String(state.launches));
  const openAccount = () => { $('#accountModal').hidden = false; document.body.style.overflow = 'hidden'; };
  const closeAccount = () => { $('#accountModal').hidden = true; document.body.style.overflow = ''; };
  const typeLabel = (game) => game.mode === 'cloud' ? 'INSTANT' : game.mode === 'itch' ? 'BROWSER' : 'DOWNLOAD';
  function actionFor(game) {
    const href = game.mode === 'cloud' ? game.playUrl : (game.playUrl || game.officialUrl);
    const label = game.mode === 'itch' ? 'Play on itch' : game.cta;
    return `<a class="play-link" href="${esc(href)}" target="_blank" rel="noopener noreferrer" data-launch="${esc(game.id)}">${esc(label)} ↗</a>`;
  }
  function card(game) {
    const [light, dark] = colors[game.accent] || colors.cyan;
    const saved = state.library.has(game.id);
    const initials = game.title.replace(/[^A-Za-z0-9 ]/g, '').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
    const source = game.source || (game.mode === 'cloud' ? 'GameForge Labs' : game.studio);
    return `<article class="game-card" data-source="${esc(game.mode)}"><div class="cover" style="--cover-light:${light};--cover-dark:${dark}"><span class="cover-top">${game.featured ? 'FEATURED' : esc(game.rating || 'FREE')}</span><span class="mode-chip">${typeLabel(game)}</span><div class="cover-art">${esc(initials)}</div><span class="cover-signal">${game.mode === 'download' ? 'OFFICIAL SITE' : 'READY NOW'}</span></div><div class="card-body"><div class="title-row"><h3>${esc(game.title)}</h3><span class="rating">${esc(game.rating || 'E')}</span></div><p class="studio">${esc(source)} · ${esc(game.genre)}</p><p class="card-desc">${esc(game.description)}</p><div class="tag-row">${(game.tags || []).slice(0, 3).map((tag) => `<span>#${esc(tag)}</span>`).join('')}</div><div class="card-foot"><span class="genre">${esc(game.players || '1 player')}</span><span>${actionFor(game)}</span></div><button class="text-button library-toggle" data-game="${esc(game.id)}">${saved ? '✓ Saved to library' : '+ Save to library'}</button></div></article>`;
  }
  function matches(game) {
    const haystack = `${game.title} ${game.studio} ${game.source || ''} ${game.genre} ${(game.tags || []).join(' ')}`.toLowerCase();
    if (state.query && !haystack.includes(state.query.toLowerCase())) return false;
    if (state.filter === 'All') return true;
    if (state.filter === 'Saved') return state.library.has(game.id);
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
    $('#savedCount').textContent = state.library.size;
    document.querySelectorAll('.library-toggle').forEach((button) => button.addEventListener('click', () => { const id = button.dataset.game; state.library.has(id) ? state.library.delete(id) : state.library.add(id); saveLibrary(); render(); }));
    document.querySelectorAll('[data-launch]').forEach((link) => link.addEventListener('click', () => { state.launches += 1; saveLaunches(); $('#launchCount').textContent = state.launches; }));
  }
  function renderFilters() {
    const filters = ['All', 'Saved', 'Browser', 'Instant play', ...new Set(state.games.map((game) => game.genre))];
    $('#filters').innerHTML = filters.map((filter) => `<button class="filter${filter === state.filter ? ' active' : ''}" data-filter="${esc(filter)}">${esc(filter)}</button>`).join('');
    document.querySelectorAll('.filter').forEach((button) => button.addEventListener('click', () => { state.filter = button.dataset.filter; renderFilters(); render(); }));
  }
  async function load() {
    const response = await fetch('./data/games.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Game catalog HTTP ${response.status}`);
    state.games = (await response.json()).catalog || [];
    renderFilters(); render();
  }
  $('#accountButton').addEventListener('click', openAccount);
  $('#modalClose').addEventListener('click', closeAccount);
  $('#accountModal').addEventListener('click', (event) => { if (event.target === $('#accountModal')) closeAccount(); });
  $('#guestButton').addEventListener('click', () => { localStorage.setItem('gameforge-guest', 'true'); $('#accountLabel').textContent = 'Guest player'; $('#authStatus').innerHTML = '<span class="status-dot"></span><span>Guest mode active — saved on this device.</span>'; });
  $('#searchToggle').addEventListener('click', () => { $('#searchInput').focus(); $('#library').scrollIntoView({ behavior: 'smooth' }); });
  $('#searchInput').addEventListener('input', (event) => { state.query = event.target.value; render(); });
  if (localStorage.getItem('gameforge-guest') === 'true') $('#accountLabel').textContent = 'Guest player';
  load().catch((error) => { $('#gameGrid').innerHTML = `<p class="empty-state">${esc(error.message)}</p>`; });
})();
