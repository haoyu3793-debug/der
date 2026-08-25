(function () {
  'use strict';

  // ===== Username (localStorage-based — no signup, no login) =====
  const ADJ = [
    'quiet','curious','wandering','misty','golden','dawn','velvet','furry',
    'wild','hidden','calm','silent','swift','little','antlered','forest',
    'dusty','bright','clever','patient','sleepy','noble','silver','autumn'
  ];
  const NOUN = [
    'walker','tracker','spotter','wanderer','ranger','watcher','ghost',
    'hoof','antler','stag','doe','fawn','glen','oak','fern','acorn',
    'dawn','dusk','bramble','heather','meadow','willow'
  ];

  function makeUsername() {
    const a = ADJ[Math.floor(Math.random() * ADJ.length)];
    const n = NOUN[Math.floor(Math.random() * NOUN.length)];
    const num = Math.floor(Math.random() * 90) + 10;
    return '@' + a + n + num;
  }

  function sanitize(raw) {
    let u = (raw || '').trim().replace(/^@+/, '');
    u = u.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 24);
    return u ? '@' + u : '';
  }

  function getStoredUsername() {
    try {
      const raw = localStorage.getItem('ppdt_username');
      // Defence in depth: validate stored value, regenerate if poisoned/empty
      const clean = sanitize(raw);
      if (clean) return clean;
      const fresh = makeUsername();
      localStorage.setItem('ppdt_username', fresh);
      return fresh;
    } catch (e) {
      return '@guest';
    }
  }

  function saveUsername(raw) {
    const u = sanitize(raw);
    if (!u) return window.PPDT_USER;
    try { localStorage.setItem('ppdt_username', u); } catch (e) {}
    window.PPDT_USER = u;
    document.dispatchEvent(new CustomEvent('ppdt:username', { detail: u }));
    return u;
  }

  window.PPDT_USER = getStoredUsername();
  window.PPDT_setUsername = saveUsername;

  function initial(handle) {
    return (handle || '@').replace('@', '').charAt(0).toUpperCase() || '?';
  }

  // ===== Pill markup =====
  const USER_PILL_HTML =
    '<button class="user-pill" id="userPill" title="Click to change your name" type="button">' +
      '<span class="user-dot" id="userDot">' + initial(window.PPDT_USER) + '</span>' +
      '<span class="user-handle" id="userHandle" data-ppdt-username>' + window.PPDT_USER + '</span>' +
      '<span class="user-edit" aria-hidden="true">✎</span>' +
    '</button>';

  const NAV_HTML =
    '<nav class="navbar">' +
      '<a class="logo" href="index.html">🦌 Deer Tracker</a>' +
      '<div class="nav-tabs">' +
        '<a data-page="home" href="index.html">🏠 Home</a>' +
        '<a data-page="encyclopedia" href="encyclopedia.html">📚 Encyclopedia</a>' +
        '<a data-page="info" href="info.html">ℹ️ Info</a>' +
        '<a data-page="achievements" href="achievements.html">🏆 Achievements</a>' +
        '<a data-page="donate" href="donate.html">💚 Donate</a>' +
      '</div>' +
      USER_PILL_HTML +
    '</nav>';

  const year = new Date().getFullYear();

  const FOOTER_HTML =
    '<footer class="site-footer">' +
      '<div class="footer-inner">' +
        '<div class="footer-brand">' +
          '<span class="footer-logo">🦌 Phoenix Park Deer Tracker</span>' +
          '<p>A student project logging fallow deer sightings in Phoenix Park, Dublin.</p>' +
        '</div>' +
        '<div class="footer-col">' +
          '<h5>Explore</h5>' +
          '<a href="index.html">Home</a>' +
          '<a href="encyclopedia.html">Encyclopedia</a>' +
          '<a href="info.html">Park info</a>' +
          '<a href="achievements.html">Achievements</a>' +
        '</div>' +
        '<div class="footer-col">' +
          '<h5>Support</h5>' +
          '<a href="donate.html">Donate</a>' +
          '<a href="info.html#rules">Watching rules</a>' +
          '<a href="https://www.phoenixpark.ie" target="_blank" rel="noopener noreferrer">phoenixpark.ie (official, not us) &#8599;</a>' +
          '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">Map data: OSM &#8599;</a>' +
        '</div>' +
      '</div>' +
      '<div class="footer-disclaimer">' +
        'An independent, non-commercial student project. <strong>Not affiliated with, ' +
        'endorsed by, or connected to the Office of Public Works (OPW)</strong> or the ' +
        'official management of Phoenix Park. Sightings are posted by visitors and are ' +
        'not verified.' +
      '</div>' +
      '<div class="footer-credit">' +
        '<span>&copy; ' + year + ' Phoenix Park Deer Tracker</span>' +
        '<span class="credit-names">Contributors: Harry &amp; Mark</span>' +
      '</div>' +
    '</footer>';

  // ===== Pill styles (inline so it works without per-page CSS edits) =====
  const STYLE_HTML =
    '<style>' +
      /* The non-affiliation notice. Deliberately NOT tiny grey text - a
         disclaimer nobody can read is not a disclaimer. */
      '.footer-disclaimer {' +
        ' max-width: 1200px; margin: 0 auto; padding: 18px 24px 0;' +
        ' font-size: 0.86rem; line-height: 1.6;' +
        ' color: rgba(255,255,255,0.78);' +
      '}' +
      '.footer-disclaimer strong { color: var(--gold-soft, #e8d9a8); }' +
      '.user-pill {' +
        ' display: inline-flex; align-items: center; gap: 8px;' +
        ' padding: 5px 14px 5px 5px; border-radius: 100px;' +
        ' background: #f7f3ea; border: 1px solid rgba(31,61,42,0.1);' +
        ' font-family: inherit; font-size: 0.86rem; color: #1f3d2a;' +
        ' cursor: pointer; transition: all 0.2s ease;' +
      '}' +
      '.user-pill:hover { background: #e8d9a8; border-color: #c9a961; }' +
      '.user-dot {' +
        ' width: 28px; height: 28px; border-radius: 50%;' +
        ' background: linear-gradient(135deg, #2d5a3d, #6b8e5a);' +
        ' display: inline-flex; align-items: center; justify-content: center;' +
        ' color: white; font-size: 0.82rem; font-weight: 700;' +
        ' font-family: "Playfair Display", Georgia, serif;' +
        ' flex-shrink: 0;' +
      '}' +
      '.user-handle { font-weight: 500; letter-spacing: 0.01em; }' +
      '.user-edit { opacity: 0.4; font-size: 0.78rem; transition: opacity 0.2s; }' +
      '.user-pill:hover .user-edit { opacity: 1; }' +
      '.user-input {' +
        ' width: 140px; padding: 4px 10px;' +
        ' border: 2px solid #2d5a3d; border-radius: 100px;' +
        ' font-size: 0.86rem; font-family: inherit;' +
        ' background: white; outline: none; color: #1f3d2a;' +
      '}' +
    '</style>';

  function inject(selector, html) {
    const el = document.querySelector(selector);
    if (el) el.innerHTML = html;
  }

  // Favicon (deer emoji as inline SVG — no extra HTTP request, kills 404)
  const FAVICON_HTML =
    '<link rel="icon" href="data:image/svg+xml,' +
    '%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E' +
    '%3Ctext y=%22.9em%22 font-size=%2290%22%3E%F0%9F%A6%8C%3C/text%3E%3C/svg%3E" />';

  document.head.insertAdjacentHTML('beforeend', FAVICON_HTML + STYLE_HTML);
  inject('#nav-slot', NAV_HTML);
  inject('#footer-slot', FOOTER_HTML);

  // Fill any [data-ppdt-username] element on the page with the handle
  function fillUsernameSpans(handle) {
    document.querySelectorAll('[data-ppdt-username]').forEach((el) => {
      el.textContent = handle;
    });
    const dot = document.getElementById('userDot');
    if (dot) dot.textContent = initial(handle);
  }
  fillUsernameSpans(window.PPDT_USER);
  document.addEventListener('ppdt:username', (e) => fillUsernameSpans(e.detail));

  // ===== Pill rename interaction =====
  const pill = document.getElementById('userPill');
  if (pill) {
    pill.addEventListener('click', () => {
      const handleEl = pill.querySelector('#userHandle');
      if (!handleEl || pill.querySelector('.user-input')) return;
      const current = handleEl.textContent.replace(/^@/, '');
      const input = document.createElement('input');
      input.type = 'text';
      input.value = current;
      input.maxLength = 24;
      input.spellcheck = false;
      input.className = 'user-input';
      handleEl.style.display = 'none';
      handleEl.parentNode.insertBefore(input, handleEl);
      input.focus();
      input.select();

      let done = false;
      function commit() {
        if (done) return;
        done = true;
        const newU = saveUsername(input.value);
        handleEl.textContent = newU;
        handleEl.style.display = '';
        input.remove();
      }
      function cancel() {
        if (done) return;
        done = true;
        handleEl.style.display = '';
        input.remove();
      }

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); commit(); }
        if (e.key === 'Escape') { e.preventDefault(); cancel(); }
      });
      input.addEventListener('blur', commit);
      input.addEventListener('click', (e) => e.stopPropagation());
    });
  }
})();
