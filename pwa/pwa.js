/* GameForge Portal — installable layer.
 * Adds: service-worker lifecycle, install prompts (Android/desktop + iOS instructions),
 * an offline/online dock, an update flow, and a mobile tab bar.
 * It builds its own UI and never rewrites the portal's own markup or logic.
 */
'use strict';

(function () {
  const state = {
    standalone: window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true,
    installEvent: null,
    installState: 'unavailable',
    swRegistered: false,
    swActive: false,
    controller: Boolean(navigator.serviceWorker && navigator.serviceWorker.controller),
    online: navigator.onLine,
  };
  window.__pwaState = state;

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent);

  const $ = (sel, scope = document) => scope.querySelector(sel);

  /* ------------------------------------------------------------------ icons */
  const SVG = {
    overview: '<path d="M2 2h5.5v5.5H2zM8.5 2H14v5.5H8.5zM2 8.5h5.5V14H2zM8.5 8.5H14V14H8.5z" fill="currentColor"/>',
    projects: '<path d="M1.5 3.5A1.5 1.5 0 0 1 3 2h3l1.4 1.6H13A1.5 1.5 0 0 1 14.5 5v7A2 2 0 0 1 12.5 14h-9A2 2 0 0 1 1.5 12z" fill="currentColor"/>',
    integrity: '<path d="M8 1.4 2.5 3.7v4.4c0 3.2 2.3 5.7 5.5 6.5 3.2-.8 5.5-3.3 5.5-6.5V3.7zm3.2 4.9-4 4-2.4-2.4 1-1 1.4 1.4 3-3z" fill="currentColor"/>',
    docs: '<path d="M3 1.5h6.5L13 5v9.5H3zM9 2.4V5h2.6z" fill="currentColor"/>',
    install: '<path d="M8 1.8v6.6l2.3-2.3 1 1L8 10.4 4.7 7.1l1-1L8 8.4V1.8zM2.5 11.5h11V14h-11z" fill="currentColor"/>',
    share: '<path d="M8 1.5 4.9 4.6 6 5.7l1.2-1.2V9h1.6V4.5L10 5.7l1.1-1.1zM3.5 8.5H5V12h6V8.5h1.5V14h-9z" fill="currentColor"/>',
  };

  const icon = (name, size = 20) =>
    `<svg viewBox="0 0 16 16" width="${size}" height="${size}" aria-hidden="true">${SVG[name]}</svg>`;

  /* ------------------------------------------------------------------ dock */
  const dock = document.createElement('div');
  dock.className = 'status-dock';
  document.body.appendChild(dock);

  function pill(kind, text, actionLabel, onAction, dismissible) {
    const el = document.createElement('div');
    el.className = 'status-pill';
    el.dataset.kind = kind;
    el.innerHTML = `<span class="dot"></span><span class="pill-text"></span>`;
    $('.pill-text', el).textContent = text;
    if (actionLabel) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = actionLabel;
      btn.addEventListener('click', () => onAction(el));
      el.appendChild(btn);
    }
    if (dismissible) {
      const x = document.createElement('button');
      x.type = 'button';
      x.className = 'close-x';
      x.setAttribute('aria-label', 'Dismiss');
      x.textContent = '\u00d7';
      x.addEventListener('click', () => el.remove());
      el.appendChild(x);
    }
    dock.appendChild(el);
    return el;
  }

  function showOffline() {
    if ($('.status-pill[data-kind="offline"]', dock)) return;
    pill('offline', 'Offline — showing the cached copy', 'Retry', () => location.reload(), false);
  }

  function showOnline() {
    const existing = $('.status-pill[data-kind="offline"]', dock);
    if (!existing) return;
    existing.remove();
    const ok = pill('online', 'Back online', 'Reload', () => location.reload(), true);
    setTimeout(() => ok.remove(), 5000);
  }

  window.addEventListener('offline', () => { state.online = false; showOffline(); });
  window.addEventListener('online', () => { state.online = true; showOnline(); });

  /* ------------------------------------------------------------------ install UI */
  function installSupported() {
    return Boolean(state.installEvent) || (isIOS && !state.standalone);
  }

  function buildInstallCard() {
    // Must return the existing card, not undefined: renderInstallUI() bails out on a falsy result,
    // which would silently drop every later install-state update (e.g. when the prompt arrives).
    const existing = $('.install-card');
    if (existing) return existing;
    const hero = $('.hero');
    if (!hero) return null;

    const card = document.createElement('section');
    card.className = 'install-card';
    card.id = 'installCard';
    card.setAttribute('aria-label', 'Install this app');
    card.innerHTML = `
      <div class="install-copy">
        <strong id="installTitle">Install on this device</strong>
        <p id="installHint"></p>
      </div>
      <div class="install-actions">
        <button class="btn btn-primary" id="btnInstall" type="button">${icon('install', 15)} Install app</button>
      </div>`;
    hero.insertAdjacentElement('afterend', card);
    return card;
  }

  function renderInstallUI() {
    const card = buildInstallCard();
    const title = $('#installTitle');
    const hint = $('#installHint');
    const btn = $('#btnInstall');

    if (!card) return;

    if (state.standalone) {
      card.dataset.state = 'installed';
      title.textContent = 'Installed — running as an app';
      hint.textContent = 'This portal is running in standalone mode, so it opens without browser chrome and works offline.';
      btn.hidden = true;
      state.installState = 'installed';
    } else if (state.installEvent) {
      card.dataset.state = 'available';
      title.textContent = 'Install on this device';
      hint.textContent = 'Adds GameForge to your home screen and keeps the build index available offline.';
      btn.hidden = false;
      state.installState = 'available';
    } else if (isIOS && isSafari) {
      card.dataset.state = 'ios';
      title.textContent = 'Install on iPhone or iPad';
      hint.textContent = 'iOS installs from the Share menu rather than a button. Two taps and it is on your home screen.';
      btn.hidden = false;
      btn.innerHTML = `${icon('share', 15)} Show me how`;
      state.installState = 'ios';
    } else {
      card.dataset.state = 'unavailable';
      title.textContent = 'Install on this device';
      hint.textContent = 'Open this page in Chrome, Edge or Safari on a phone to install it as an app. On a desktop browser, look for the install icon in the address bar.';
      btn.hidden = true;
      state.installState = 'unavailable';
    }
    updateTabbarInstall();
  }

  function openIOSSheet() {
    const scrim = document.createElement('div');
    scrim.className = 'sheet-scrim';
    const sheet = document.createElement('div');
    sheet.className = 'sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-label', 'Add to Home Screen instructions');
    sheet.innerHTML = `
      <h3>Add to Home Screen</h3>
      <p class="sheet-sub">Safari installs web apps from the Share menu.</p>
      <ol>
        <li>Tap the <b>Share</b> button ${icon('share', 14)} in the toolbar.</li>
        <li>Scroll the list and tap <b>Add to Home Screen</b>.</li>
        <li>Confirm the name, then tap <b>Add</b>.</li>
      </ol>
      <button class="btn btn-primary" type="button" id="sheetClose">Got it</button>`;
    document.body.appendChild(scrim);
    document.body.appendChild(sheet);
    const close = () => { scrim.remove(); sheet.remove(); };
    scrim.addEventListener('click', close);
    $('#sheetClose', sheet).addEventListener('click', close);
  }

  async function triggerInstall() {
    if (isIOS && !state.installEvent) { openIOSSheet(); return; }
    if (!state.installEvent) return;
    const event = state.installEvent;
    state.installEvent = null;
    event.prompt();
    const choice = await event.userChoice.catch(() => ({ outcome: 'dismissed' }));
    if (choice && choice.outcome === 'accepted') {
      pill('update', 'Installing GameForge…', null, null, false);
    } else {
      pill('update', 'Install dismissed — you can install any time from the card above.', null, null, true);
    }
    renderInstallUI();
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    state.installEvent = event;
    renderInstallUI();
  });

  window.addEventListener('appinstalled', () => {
    state.installEvent = null;
    state.standalone = true;
    document.documentElement.classList.add('is-standalone');
    const note = pill('update', 'GameForge installed — launch it from your home screen.', null, null, true);
    setTimeout(() => note.remove(), 7000);
    renderInstallUI();
  });

  /* ------------------------------------------------------------------ tab bar */
  const TABS = [
    { id: 'overview', label: 'Overview', icon: 'overview' },
    { id: 'projects', label: 'Projects', icon: 'projects' },
    { id: 'integrity', label: 'Verify', icon: 'integrity' },
    { id: 'docs', label: 'Docs', icon: 'docs' },
  ];

  let tabbar = null;

  function buildTabbar() {
    if (tabbar || !document.body) return;
    tabbar = document.createElement('nav');
    tabbar.className = 'tabbar';
    tabbar.id = 'pwaTabbar';
    tabbar.setAttribute('aria-label', 'Portal sections');
    tabbar.innerHTML =
      TABS.map((t) => `<a href="#${t.id}" data-tab="${t.id}">${icon(t.icon)}<span>${t.label}</span></a>`).join('') +
      `<button type="button" class="tabbar-install" id="tabInstall" hidden>${icon('install')}<span>Install</span></button>`;
    document.body.appendChild(tabbar);

    tabbar.addEventListener('click', (event) => {
      const link = event.target.closest('a[data-tab]');
      if (!link) return;
      event.preventDefault();
      const target = document.getElementById(link.dataset.tab);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    $('#tabInstall', tabbar).addEventListener('click', triggerInstall);
    watchSections();
  }

  function updateTabbarInstall() {
    const btn = $('#tabInstall');
    if (!btn) return;
    const show = !state.standalone && installSupported();
    btn.hidden = !show;
  }

  function watchSections() {
    if (!('IntersectionObserver' in window)) return;
    const links = Array.from(tabbar.querySelectorAll('a[data-tab]'));
    const sections = links
      .map((l) => document.getElementById(l.dataset.tab))
      .filter(Boolean);
    if (!sections.length) return;

    const setActive = (id) => {
      links.forEach((l) => {
        if (l.dataset.tab === id) l.setAttribute('aria-current', 'true');
        else l.removeAttribute('aria-current');
      });
    };

    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActive(visible.target.id);
    }, { rootMargin: '-45% 0px -45% 0px', threshold: [0, .25, .5] });

    sections.forEach((s) => observer.observe(s));
    setActive(sections[0].id);
  }

  /* ------------------------------------------------------------------ service worker */
  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      state.swError = 'service worker unsupported';
      return;
    }
    try {
      const registration = await navigator.serviceWorker.register('./sw.js', { scope: './' });
      state.swRegistered = true;
      state.swScope = registration.scope;

      if (registration.active) { state.swActive = true; }
      state.controller = Boolean(navigator.serviceWorker.controller);

      registration.addEventListener('updatefound', () => {
        const incoming = registration.installing;
        if (!incoming) return;
        incoming.addEventListener('statechange', () => {
          if (incoming.state === 'installed' && navigator.serviceWorker.controller) {
            const note = pill('update', 'A new version is ready', 'Reload', () => {
              incoming.postMessage('SKIP_WAITING');
              navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
              note.remove();
            }, true);
          }
        });
      });

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        state.controller = true;
      });

      const ready = await navigator.serviceWorker.ready;
      state.swActive = Boolean(ready.active);
      state.controller = Boolean(navigator.serviceWorker.controller);
    } catch (err) {
      state.swError = String((err && err.message) || err);
    }
  }

  /* ------------------------------------------------------------------ boot */
  function boot() {
    if (state.standalone) document.documentElement.classList.add('is-standalone');
    buildTabbar();
    renderInstallUI();
    if (!state.online) showOffline();
    registerServiceWorker();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
