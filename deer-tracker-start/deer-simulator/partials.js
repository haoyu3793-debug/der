(function () {
  'use strict';

  // ===== Accounts =====
  //
  // This used to invent a random handle, keep it in localStorage and call it a
  // user. It was not one. Anyone could type your handle into their own browser
  // and post as you, and clearing your site data lost you the name and every
  // badge earned under it.
  //
  // Now the name lives in a database, is yours alone, and is proved by a
  // password. The browser holds nothing but a session cookie it cannot even
  // read (it is HttpOnly), so the only way to find out who you are is to ask
  // the server — which is what PPDT_ready below is waiting on.

  var API = {
    me: '/api/auth/me',
    login: '/api/auth/login',
    signup: '/api/auth/signup',
    logout: '/api/auth/logout'
  };

  // Same rules the server enforces. These are here to give a useful message
  // before the round trip, not to decide anything — the server decides.
  var USERNAME_RE = /^[a-zA-Z0-9._-]{3,20}$/;
  var MIN_PASSWORD = 8;

  // null means "signed out". Until PPDT_ready settles it also means "not asked
  // yet", which is why anything that depends on identity should await it
  // rather than read this on the first line of a script.
  window.PPDT_USER = null;

  function setUser(handle) {
    window.PPDT_USER = handle || null;
    render();
    document.dispatchEvent(new CustomEvent('ppdt:username', { detail: window.PPDT_USER }));
  }

  function api(url, options) {
    var opts = options || {};
    // same-origin is already fetch's default, but the cookie is the entire
    // mechanism here and a default worth relying on is worth writing down.
    opts.credentials = 'same-origin';
    return fetch(url, opts).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) {
          var err = new Error(data.error || ('server said ' + res.status));
          err.status = res.status;
          throw err;
        }
        return data;
      });
    });
  }

  // Ask the server who we are. A failure here (offline, function not deployed)
  // must read as "signed out" and not as an exception that stops the rest of
  // the page building.
  window.PPDT_ready = api(API.me)
    .then(function (data) { return data.handle || null; })
    .catch(function () { return null; })
    .then(function (handle) {
      setUser(handle);
      return handle;
    });

  function initial(handle) {
    return (handle || '@').replace('@', '').charAt(0).toUpperCase() || '?';
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ===== Nav and footer =====
  var NAV_HTML =
    '<nav class="navbar">' +
      '<a class="logo" href="index.html">🦌 Deer Tracker</a>' +
      '<div class="nav-tabs">' +
        '<a data-page="home" href="index.html">🏠 Home</a>' +
        '<a data-page="encyclopedia" href="encyclopedia.html">📚 Encyclopedia</a>' +
        '<a data-page="info" href="info.html">ℹ️ Info</a>' +
        '<a data-page="achievements" href="achievements.html">🏆 Achievements</a>' +
      '</div>' +
      '<div class="user-slot" id="userSlot"></div>' +
    '</nav>';

  var year = new Date().getFullYear();

  var FOOTER_HTML =
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
          '<h5>More</h5>' +
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

  // ===== The sign-in dialog =====
  //
  // One dialog on every page, built here rather than pasted into five HTML
  // files. It starts hidden and is only ever shown by a click.
  var AUTH_HTML =
    '<div class="auth-mask" id="authMask" hidden>' +
      '<div class="auth-card" role="dialog" aria-modal="true" aria-labelledby="authTitle">' +
        '<button type="button" class="auth-x" id="authClose" aria-label="Close">×</button>' +
        '<h3 id="authTitle">Sign in</h3>' +
        '<p class="auth-sub" id="authSub">Your sightings are posted under your name.</p>' +
        '<div class="auth-switch" role="tablist">' +
          '<button type="button" class="on" id="tabLogin" role="tab" aria-selected="true">Sign in</button>' +
          '<button type="button" id="tabSignup" role="tab" aria-selected="false">Create account</button>' +
        '</div>' +
        '<form id="authForm" novalidate>' +
          '<label class="auth-lbl" for="authUser">Username</label>' +
          '<input type="text" id="authUser" name="username" autocomplete="username" ' +
            'autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="20" ' +
            'placeholder="furryglen" required />' +
          '<label class="auth-lbl" for="authPass">Password</label>' +
          '<input type="password" id="authPass" name="password" autocomplete="current-password" ' +
            'maxlength="200" placeholder="At least 8 characters" required />' +
          '<p class="auth-hint" id="authHint">3–20 characters: letters, numbers, dot, dash, underscore.</p>' +
          '<p class="auth-error" id="authError" role="alert" hidden></p>' +
          '<button type="submit" class="auth-go" id="authGo">Sign in</button>' +
        '</form>' +
        '<p class="auth-note">Only your username is ever shown to anyone. Your password ' +
        'is stored as a hash — it cannot be read back, and there is no password reset, ' +
        'so keep it somewhere safe.</p>' +
      '</div>' +
    '</div>';

  var STYLE_HTML =
    '<style>' +
      /* The non-affiliation notice. Deliberately NOT tiny grey text - a
         disclaimer nobody can read is not a disclaimer. */
      '.footer-disclaimer {' +
        ' max-width: 1200px; margin: 0 auto; padding: 18px 24px 0;' +
        ' font-size: 0.86rem; line-height: 1.6;' +
        ' color: rgba(255,255,255,0.78);' +
      '}' +
      '.footer-disclaimer strong { color: var(--gold-soft, #e8d9a8); }' +

      '.user-slot { position: relative; display: inline-flex; }' +

      '.user-pill {' +
        ' display: inline-flex; align-items: center; gap: 8px;' +
        ' padding: 5px 14px 5px 5px; border-radius: 100px;' +
        ' background: #f7f3ea; border: 1px solid rgba(31,61,42,0.1);' +
        ' font-family: inherit; font-size: 0.86rem; color: #1f3d2a;' +
        ' cursor: pointer; transition: background 0.2s ease, border-color 0.2s ease;' +
      '}' +
      '.user-pill:hover { background: #e8d9a8; border-color: #c9a961; }' +
      '.user-pill.signed-out { padding: 8px 18px; font-weight: 600; }' +
      '.user-dot {' +
        ' width: 28px; height: 28px; border-radius: 50%;' +
        ' background: linear-gradient(135deg, #2d5a3d, #6b8e5a);' +
        ' display: inline-flex; align-items: center; justify-content: center;' +
        ' color: white; font-size: 0.82rem; font-weight: 700;' +
        ' font-family: "Playfair Display", Georgia, serif;' +
        ' flex-shrink: 0;' +
      '}' +
      '.user-handle { font-weight: 500; letter-spacing: 0.01em; }' +
      '.user-caret { opacity: 0.45; font-size: 0.62rem; }' +

      /* The little menu under the pill. */
      '.user-menu {' +
        ' position: absolute; top: calc(100% + 8px); right: 0; z-index: 400;' +
        ' min-width: 176px; padding: 6px;' +
        ' background: #fff; border: 1px solid rgba(31,61,42,0.12);' +
        ' border-radius: 12px; box-shadow: 0 16px 40px rgba(31,61,42,0.18);' +
      '}' +
      '.user-menu[hidden] { display: none; }' +
      '.user-menu .who {' +
        ' padding: 8px 10px 10px; font-size: 0.76rem; color: #6b8e5a;' +
        ' border-bottom: 1px solid rgba(31,61,42,0.08); margin-bottom: 6px;' +
        ' word-break: break-all;' +
      '}' +
      '.user-menu button {' +
        ' display: block; width: 100%; text-align: left;' +
        ' padding: 9px 10px; border: 0; border-radius: 8px;' +
        ' background: none; font-family: inherit; font-size: 0.86rem;' +
        ' color: #1f3d2a; cursor: pointer;' +
      '}' +
      '.user-menu button:hover { background: #f2efe6; }' +

      /* Dialog. Same scrolling treatment as the sighting form: a phone in
         landscape is shorter than this card, and a button you cannot reach is
         the same as no button. */
      '.auth-mask {' +
        ' position: fixed; inset: 0; z-index: 500;' +
        ' display: flex; align-items: center; justify-content: center;' +
        ' padding: 20px; background: rgba(26,26,26,0.55);' +
        ' backdrop-filter: blur(6px);' +
        ' overflow-y: auto; overscroll-behavior: contain;' +
      '}' +
      '.auth-mask[hidden] { display: none; }' +
      '.auth-card {' +
        ' position: relative; flex-shrink: 0;' +
        ' width: 100%; max-width: 400px; padding: 30px 28px 24px;' +
        ' background: #faf7f0; border-radius: 18px;' +
        ' box-shadow: 0 24px 60px rgba(31,61,42,0.28);' +
        ' font-family: inherit; color: #1f3d2a;' +
        ' max-height: calc(100vh - 40px); max-height: calc(100dvh - 40px);' +
        ' overflow-y: auto; overscroll-behavior: contain;' +
      '}' +
      '.auth-card h3 {' +
        ' margin: 0 0 4px; font-size: 1.45rem;' +
        ' font-family: "Playfair Display", Georgia, serif; font-weight: 600;' +
      '}' +
      '.auth-sub { margin: 0 0 18px; font-size: 0.86rem; color: #6b8e5a; }' +
      '.auth-x {' +
        ' position: absolute; top: 10px; right: 12px;' +
        ' background: none; border: 0; font-size: 1.8rem; line-height: 1;' +
        ' color: #6b8e5a; cursor: pointer; padding: 2px 8px;' +
      '}' +
      '.auth-x:hover { color: #1f3d2a; }' +
      '.auth-switch {' +
        ' display: grid; grid-template-columns: 1fr 1fr; gap: 4px;' +
        ' padding: 4px; margin-bottom: 18px;' +
        ' background: rgba(31,61,42,0.06); border-radius: 100px;' +
      '}' +
      '.auth-switch button {' +
        ' padding: 9px 8px; border: 0; border-radius: 100px;' +
        ' background: none; font-family: inherit; font-size: 0.86rem;' +
        ' font-weight: 600; color: #6b8e5a; cursor: pointer;' +
        ' transition: background 0.18s ease, color 0.18s ease;' +
      '}' +
      '.auth-switch button.on { background: #fff; color: #1f3d2a; box-shadow: 0 2px 8px rgba(31,61,42,0.1); }' +
      '#authForm { display: flex; flex-direction: column; }' +
      '.auth-lbl { font-size: 0.78rem; font-weight: 600; margin-bottom: 5px; color: #3f5c48; }' +
      '#authForm input {' +
        ' width: 100%; padding: 12px 14px; margin-bottom: 14px;' +
        ' border: 1px solid rgba(31,61,42,0.15); border-radius: 10px;' +
        ' font-family: inherit; font-size: 16px; background: #fffdf8;' +
        ' color: #1f3d2a; transition: border-color 0.2s ease, box-shadow 0.2s ease;' +
      '}' +
      '#authForm input:focus {' +
        ' outline: none; border-color: #2d5a3d;' +
        ' box-shadow: 0 0 0 3px rgba(45,90,61,0.12);' +
      '}' +
      '.auth-hint { margin: -6px 0 14px; font-size: 0.74rem; color: #8a9a84; }' +
      '.auth-hint[hidden] { display: none; }' +
      '.auth-error {' +
        ' margin: 0 0 14px; padding: 10px 12px; border-radius: 8px;' +
        ' background: #fdecec; color: #8f2f2f; font-size: 0.82rem; line-height: 1.45;' +
      '}' +
      '.auth-error[hidden] { display: none; }' +
      '.auth-go {' +
        ' padding: 14px; border: 0; border-radius: 10px;' +
        ' background: #2d5a3d; color: #faf7f0;' +
        ' font-family: inherit; font-size: 1rem; font-weight: 600; cursor: pointer;' +
        ' transition: background 0.2s ease;' +
      '}' +
      '.auth-go:hover { background: #1f3d2a; }' +
      '.auth-go:disabled { opacity: 0.65; cursor: wait; }' +
      '.auth-note {' +
        ' margin: 16px 0 0; font-size: 0.74rem; line-height: 1.55; color: #8a9a84;' +
      '}' +
      '@media (max-width: 720px) {' +
        ' .auth-mask { align-items: flex-start; padding: 12px; }' +
        ' .auth-card { padding: 24px 20px 20px; max-height: calc(100dvh - 24px); }' +
      '}' +
    '</style>';

  function inject(selector, html) {
    var el = document.querySelector(selector);
    if (el) el.innerHTML = html;
  }

  // Favicon (deer emoji as inline SVG — no extra HTTP request, kills 404)
  var FAVICON_HTML =
    '<link rel="icon" href="data:image/svg+xml,' +
    '%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E' +
    '%3Ctext y=%22.9em%22 font-size=%2290%22%3E%F0%9F%A6%8C%3C/text%3E%3C/svg%3E" />';

  document.head.insertAdjacentHTML('beforeend', FAVICON_HTML + STYLE_HTML);
  inject('#nav-slot', NAV_HTML);
  inject('#footer-slot', FOOTER_HTML);
  document.body.insertAdjacentHTML('beforeend', AUTH_HTML);

  // ===== Painting the current state =====
  function render() {
    var slot = document.getElementById('userSlot');
    var handle = window.PPDT_USER;

    if (slot) {
      if (handle) {
        slot.innerHTML =
          '<button class="user-pill" id="userPill" type="button" ' +
              'aria-haspopup="true" aria-expanded="false" title="Your account">' +
            '<span class="user-dot">' + esc(initial(handle)) + '</span>' +
            '<span class="user-handle">' + esc(handle) + '</span>' +
            '<span class="user-caret" aria-hidden="true">▼</span>' +
          '</button>' +
          '<div class="user-menu" id="userMenu" hidden>' +
            '<div class="who">Signed in as<br /><strong>' + esc(handle) + '</strong></div>' +
            '<button type="button" id="menuBadges">🏆 My achievements</button>' +
            '<button type="button" id="menuLogout">Log out</button>' +
          '</div>';
      } else {
        slot.innerHTML =
          '<button class="user-pill signed-out" id="userPill" type="button">Sign in</button>';
      }
    }

    // Any [data-ppdt-username] on the page shows the handle, or a prompt.
    document.querySelectorAll('[data-ppdt-username]').forEach(function (el) {
      el.textContent = handle || 'not signed in';
    });
  }

  // ===== Pill and menu =====
  function closeMenu() {
    var menu = document.getElementById('userMenu');
    var pill = document.getElementById('userPill');
    if (menu) menu.hidden = true;
    if (pill) pill.setAttribute('aria-expanded', 'false');
  }

  document.addEventListener('click', function (e) {
    var pill = e.target.closest && e.target.closest('#userPill');

    if (pill) {
      if (!window.PPDT_USER) { openAuth('login'); return; }
      var menu = document.getElementById('userMenu');
      if (menu) {
        menu.hidden = !menu.hidden;
        pill.setAttribute('aria-expanded', String(!menu.hidden));
      }
      return;
    }

    if (e.target.closest && e.target.closest('#menuBadges')) {
      window.location.href = 'achievements.html';
      return;
    }
    if (e.target.closest && e.target.closest('#menuLogout')) {
      closeMenu();
      logout();
      return;
    }

    // A click anywhere else closes the menu.
    if (!(e.target.closest && e.target.closest('#userMenu'))) closeMenu();
  });

  function logout() {
    api(API.logout, { method: 'POST' })
      .catch(function () { /* the cookie is cleared server-side either way */ })
      .then(function () { setUser(null); });
  }

  // ===== The dialog =====
  var mask, form, userInput, passInput, errorBox, hintBox, goBtn,
      titleEl, subEl, tabLogin, tabSignup;
  var mode = 'login';
  var waiting = [];        // everyone who called requireLogin() and is still waiting
  var lastFocus = null;

  function grab() {
    mask = document.getElementById('authMask');
    form = document.getElementById('authForm');
    userInput = document.getElementById('authUser');
    passInput = document.getElementById('authPass');
    errorBox = document.getElementById('authError');
    hintBox = document.getElementById('authHint');
    goBtn = document.getElementById('authGo');
    titleEl = document.getElementById('authTitle');
    subEl = document.getElementById('authSub');
    tabLogin = document.getElementById('tabLogin');
    tabSignup = document.getElementById('tabSignup');
  }
  grab();

  function showError(message) {
    if (!errorBox) return;
    errorBox.textContent = message;
    errorBox.hidden = !message;
  }

  function setMode(next) {
    mode = next === 'signup' ? 'signup' : 'login';
    var signingUp = mode === 'signup';
    tabLogin.classList.toggle('on', !signingUp);
    tabSignup.classList.toggle('on', signingUp);
    tabLogin.setAttribute('aria-selected', String(!signingUp));
    tabSignup.setAttribute('aria-selected', String(signingUp));
    titleEl.textContent = signingUp ? 'Create your account' : 'Sign in';
    subEl.textContent = signingUp
      ? 'Pick a name nobody else can post under.'
      : 'Your sightings are posted under your name.';
    goBtn.textContent = signingUp ? 'Create account' : 'Sign in';
    hintBox.hidden = !signingUp;
    // Telling the password manager which of the two this is stops it offering
    // to save a new password every time somebody merely signs in.
    passInput.setAttribute('autocomplete', signingUp ? 'new-password' : 'current-password');
    passInput.placeholder = signingUp ? 'At least 8 characters' : 'Your password';
    showError('');
  }

  function openAuth(which) {
    lastFocus = document.activeElement;
    setMode(which || 'login');
    passInput.value = '';
    mask.hidden = false;
    // A phone keyboard opening under a dialog that has not painted yet leaves
    // the field off screen, so wait a frame before asking for focus.
    requestAnimationFrame(function () { userInput.focus(); });
  }

  function closeAuth(reason) {
    if (!mask || mask.hidden) return;
    mask.hidden = true;
    passInput.value = '';
    showError('');
    if (lastFocus && lastFocus.focus) lastFocus.focus();

    // Closing without signing in is an answer, not a failure: callers get null
    // and decide what to do, rather than an unhandled rejection. Take the list
    // before resolving — a resolve handler is free to ask again.
    var pending = waiting;
    waiting = [];
    var answer = reason === 'success' ? window.PPDT_USER : null;
    pending.forEach(function (resolve) { resolve(answer); });
  }

  document.getElementById('authClose').addEventListener('click', function () { closeAuth(); });
  mask.addEventListener('click', function (e) { if (e.target === mask) closeAuth(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && mask && !mask.hidden) closeAuth();
  });
  tabLogin.addEventListener('click', function () { setMode('login'); userInput.focus(); });
  tabSignup.addEventListener('click', function () { setMode('signup'); userInput.focus(); });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var username = userInput.value.trim().replace(/^@+/, '');
    var password = passInput.value;

    // Checked again on the server. This is only so the answer is instant.
    if (!USERNAME_RE.test(username)) {
      showError('A username is 3 to 20 characters, using letters, numbers, dot, dash or underscore.');
      userInput.focus();
      return;
    }
    if (mode === 'signup' && password.length < MIN_PASSWORD) {
      showError('The password needs at least ' + MIN_PASSWORD + ' characters.');
      passInput.focus();
      return;
    }
    if (!password) {
      showError('Enter your password.');
      passInput.focus();
      return;
    }

    showError('');
    goBtn.disabled = true;
    var wasLabel = goBtn.textContent;
    goBtn.textContent = mode === 'signup' ? 'Creating…' : 'Signing in…';

    api(mode === 'signup' ? API.signup : API.login, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: username, password: password })
    })
      .then(function (data) {
        setUser(data.handle || ('@' + data.username));
        closeAuth('success');
      })
      .catch(function (err) {
        // A taken name is the one error with an obvious next step, so say it.
        if (err.status === 409 && mode === 'signup') {
          showError('That username is taken. Try another.');
        } else {
          showError(err.message);
        }
        passInput.focus();
        passInput.select();
      })
      .then(function () {
        goBtn.disabled = false;
        goBtn.textContent = wasLabel;
      });
  });

  // ===== What the pages use =====
  //
  // PPDT_requireLogin() resolves to the handle once signed in, or to null if
  // the dialog is closed without signing in. A page calls it, waits, and only
  // does the thing if it got a name back.
  window.PPDT_openAuth = openAuth;
  window.PPDT_logout = logout;
  window.PPDT_requireLogin = function (which) {
    if (window.PPDT_USER) return Promise.resolve(window.PPDT_USER);
    return window.PPDT_ready.then(function (handle) {
      if (handle) return handle;
      return new Promise(function (resolve) {
        waiting.push(resolve);
        // Already open because somebody else asked first: do not reset the
        // fields under their fingers, just join the queue.
        if (mask.hidden) openAuth(which || 'login');
      });
    });
  };

  render();
})();
