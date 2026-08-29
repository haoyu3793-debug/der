// Shared account plumbing: password hashing, sessions, cookies.
//
// Nothing here answers a URL. Cloudflare Pages only turns a file under
// functions/ into a route if it exports onRequest / onRequestGet / …; this file
// exports helpers, so it is a module the four files in auth/ import, not an
// endpoint anybody can call. The leading underscore is the usual sign for that.

// ===== Rules for a name and a password =====
export const USERNAME_RE = /^[a-zA-Z0-9._-]{3,20}$/;
export const MIN_PASSWORD = 8;
export const MAX_PASSWORD = 200;     // bcrypt-style truncation bugs start here

// How long a login lasts before you have to type the password again.
export const SESSION_DAYS = 30;

// PBKDF2 turns a password into a hash slowly on purpose: the slower it is, the
// fewer guesses per second someone gets if this database ever leaks.
//
// The number is a trade, and the ceiling is not security, it is Cloudflare's
// free plan: 10ms of CPU per request, and this is real CPU rather than time
// spent waiting. Measured, 100k iterations costs about 9.4ms — which is not
// "close to the limit", it IS the limit, with nothing left for the database
// call that has to follow. 50k costs about half that and leaves room.
//
// On a paid plan (30s of CPU) this should be far higher; OWASP asks for 600k.
// Raising it is safe to do at any time: the count is written into every stored
// hash, so old accounts keep verifying against the number they were made with.
const PBKDF2_ITERATIONS = 50000;
const KEY_BITS = 256;
const SALT_BYTES = 16;

const enc = new TextEncoder();

// ===== Small helpers =====
export function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: Object.assign(
      {
        "content-type": "application/json; charset=utf-8",
        // Never let a proxy or the browser keep a reply that says who you are.
        "cache-control": "no-store",
      },
      headers || {}
    ),
  });
}

function b64(bytes) {
  let s = "";
  const arr = new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s);
}

function unb64(str) {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Compare two byte arrays without letting the time taken reveal how much of
// them matched. A plain === on a hash leaks that, one byte at a time.
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// ===== Passwords =====
async function pbkdf2(password, salt, iterations) {
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]
  );
  return new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt: salt, iterations: iterations },
      key,
      KEY_BITS
    )
  );
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return "pbkdf2$" + PBKDF2_ITERATIONS + "$" + b64(salt) + "$" + b64(hash);
}

// A syntactically valid hash of nothing in particular, at the current cost.
// login.js runs a real verification against this when the username does not
// exist: answering instantly for names that are free and slowly for names that
// are taken hands anyone with a stopwatch a list of every account on the site.
export const DUMMY_HASH =
  "pbkdf2$" + PBKDF2_ITERATIONS + "$" +
  "AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

export async function verifyPassword(password, stored) {
  try {
    const parts = String(stored || "").split("$");
    if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
    const iterations = parseInt(parts[1], 10);
    if (!Number.isInteger(iterations) || iterations < 1000) return false;
    const salt = unb64(parts[2]);
    const expected = unb64(parts[3]);
    const actual = await pbkdf2(password, salt, iterations);
    return timingSafeEqual(actual, expected);
  } catch (err) {
    // A malformed row must read as "wrong password", never as "correct".
    return false;
  }
}

// ===== Sessions =====
export const COOKIE_NAME = "ppdt_session";

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(text));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function readCookie(request, name) {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

function cookieHeader(value, maxAgeSeconds) {
  return (
    COOKIE_NAME + "=" + value +
    "; Path=/" +
    // HttpOnly: script on the page cannot read it, so an XSS hole cannot walk
    // off with somebody's login.
    "; HttpOnly" +
    // Secure: never sent over plain http. (Browsers treat localhost as secure,
    // so `wrangler pages dev` still works.)
    "; Secure" +
    // Lax: sent when you follow a link to the site, not when another site
    // quietly POSTs to it — which is what stops cross-site request forgery.
    "; SameSite=Lax" +
    "; Max-Age=" + maxAgeSeconds
  );
}

// Mint a session, store only its hash, and return the Set-Cookie header value.
export async function startSession(env, username) {
  const token = b64(crypto.getRandomValues(new Uint8Array(32)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const tokenHash = await sha256Hex(token);
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 86400000);

  await env.DB.prepare(
    `insert into sessions (token_hash, username, created_at, expires_at)
     values (?, ?, ?, ?)`
  ).bind(tokenHash, username, now.toISOString(), expires.toISOString()).run();

  return cookieHeader(token, SESSION_DAYS * 86400);
}

// An immediately-expiring cookie is how you delete one.
export function clearSessionCookie() {
  return cookieHeader("", 0);
}

// Who is asking? Returns the username, or null. Every endpoint that cares about
// identity goes through this and nothing else — the browser never gets to say
// who it is, it can only present the cookie.
export async function currentUser(request, env) {
  const token = readCookie(request, COOKIE_NAME);
  if (!token) return null;
  try {
    const tokenHash = await sha256Hex(token);
    const row = await env.DB.prepare(
      "select username, expires_at from sessions where token_hash = ?"
    ).bind(tokenHash).first();
    if (!row) return null;

    // An expired row is as good as no row. Bin it while we are here, so the
    // table does not fill up with dead sessions nobody ever looks at again.
    if (new Date(row.expires_at) <= new Date()) {
      await env.DB.prepare("delete from sessions where token_hash = ?")
        .bind(tokenHash).run();
      return null;
    }
    return row.username;
  } catch (err) {
    return null;
  }
}

export async function endSession(request, env) {
  const token = readCookie(request, COOKIE_NAME);
  if (!token) return;
  try {
    const tokenHash = await sha256Hex(token);
    await env.DB.prepare("delete from sessions where token_hash = ?")
      .bind(tokenHash).run();
  } catch (err) {
    // Logging out must succeed for the browser even if the delete fails; the
    // cookie is cleared either way and the row expires on its own.
  }
}

// The handle shown next to a sighting. Accounts are stored with '@' left off.
export function display(username) {
  return "@" + username;
}
