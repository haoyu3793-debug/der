# Phoenix Park Deer Tracker

**<https://deer-tracker-983.pages.dev>**

A website for logging fallow deer sightings in Phoenix Park, Dublin. Visitors
drop a pin on the map, say what they saw and how many, and it appears in the
feed. Built by a secondary-school student learning front-end development.

**This is an independent student project.** It is not affiliated with, endorsed
by, or connected to the Office of Public Works (OPW) or the official management
of Phoenix Park. Sightings are posted by visitors and are not verified.

---

## Running it on your own machine

No build step, no npm, no framework. It is HTML, CSS and JavaScript files that a
browser can open directly.

```powershell
.\serve.ps1
# then open http://localhost:8080
```

To let someone else reach it over the internet (temporary URL, dies when you
press Ctrl+C):

```powershell
.\share.ps1
```

You can open `index.html` by double-clicking it, but the map and the shared
nav/footer behave better over `http://` than over `file://`.

---

## What each file is for

| File | What it does |
|---|---|
| `index.html` | The whole homepage — map, sighting form, feed, ratings. Nearly all the code lives here. |
| `partials.js` | Builds the nav bar, the footer and the sign-in dialog and injects them into every page, so there is one copy instead of four. Also asks the server who you are and exposes it as `window.PPDT_USER`. |
| `achievements.html` | 31 badges. Which ones are unlocked is worked out from your own logged sightings. |
| `encyclopedia.html` | Reference pages about fallow deer. Static content. |
| `info.html` | Visitor information — how to get there, when to go, how to behave around the deer. |
| `serve.ps1` | A tiny static file server in PowerShell. Zero dependencies. |
| `share.ps1` | Wraps `serve.ps1` in a Cloudflare Quick Tunnel to get a public URL. |
| `vendor/` | Leaflet and the web fonts, served from this site rather than someone else's. |
| `assets/` | The hero photograph. |
| `functions/api/sightings.js` | The backend: list every sighting (GET) and add one (POST). Cloudflare Pages turns any file under `functions/` into a URL. |
| `functions/api/sightings/[id].js` | Delete one sighting. The brackets mean that part of the URL is a variable. |
| `functions/api/_auth.js` | Password hashing, sessions and cookies. Not a URL — the leading underscore marks it as a module the endpoints import. |
| `functions/api/auth/signup.js` | Claim a username and set its password. |
| `functions/api/auth/login.js` | Prove you own one. |
| `functions/api/auth/logout.js` | End the session. |
| `functions/api/auth/me.js` | "Who am I?" — every page asks this on load. |
| `schema.sql` | The database table. Same SQL as Lesson 12, running on Cloudflare D1 — which is SQLite. |
| `wrangler.toml` | Tells Cloudflare which database to hand the functions as `env.DB`. |
| `DEPLOY.md` | How to publish this. |

---

## Where the data lives

**Sightings live in a database on the server.** Everybody who opens the site
sees the same list — that is the whole point, and it took a backend to get
there.

| Where | What |
|---|---|
| D1 (Cloudflare's SQLite), table `sightings` | Every sighting: who, what, where, when, and the photo |
| D1, table `ratings` | Every review: stars, name, text |
| D1, table `users` | One row per account: the username and a PBKDF2 hash of the password |
| D1, table `sessions` | Live logins: a SHA-256 of the cookie token, the username, and when it expires |
| Cookie `ppdt_session` | The session token. `HttpOnly`, so no script on the page can read it |
| `localStorage` → `ppdt_delete_keys` | The secrets that prove *this* browser posted a given sighting |
| `localStorage` → `ppdt_rating_keys` | The secrets proving *this* browser left a given review |

`ppdt_username` in `localStorage` is gone. Nothing reads it any more — if you
have one from an older visit it is dead weight and can be deleted.

### How deleting works

There are two separate proofs that a row is yours, and either one is enough.

**The delete key.** When you post a sighting the server generates a random
`delete_key`, stores it beside the row, and returns it **once** — to the browser
that posted it. That browser keeps it in `localStorage`. To delete, it sends the
key back; the server compares and refuses if it does not match. The key is never
included in the list everybody reads. This is how it worked before there were
accounts, and it is still what covers reviews and anything posted while signed
out.

**The session cookie.** A sighting is signed with the account that posted it, so
if the cookie says you are the author, you may delete it. This is what makes
your own sightings yours on a device that never held the key — before it, signing
in on your phone left you unable to remove something you had posted from your
laptop.

The remaining trade: **a review, or a sighting posted while signed out, is only
deletable from the browser that left it.** Clear that browser's data and it
stays up.

## Traps — the things that will bite the next person

These cost real time to work out. Read them before changing anything.

**A sighting lives in four places at once.** Adding one touches the map layer,
the `allSightings` array, the rendered HTML, and the server. Deleting one has to
undo all four — and the server is the only one that matters to anybody else. The
test for any change here is one sentence: *delete it, reload, it must still be
gone — and it must be gone in a different browser too.*

**The page waits for the server before showing anything.** `postSighting()` only
calls `addSighting()` inside the `.then()`. Doing it the other way round — draw
first, send second — leaves a rejected sighting sitting on your screen looking
saved while nobody else can see it, which is the exact illusion this project
spent a lesson removing.

**Ids come from the server, never from the browser.** Two browsers inventing
their own ids will collide eventually, and there is no way to tell which row was
meant. `addSighting()` refuses a sighting with no id rather than making one up.

**Validation is duplicated on purpose.** The form checks things so the person
filling it in gets a fast answer. `functions/api/sightings.js` checks the same
things again because anything on the internet can POST to the endpoint without
ever loading the page. The second set is the real one. Deleting it because it
"looks redundant" is how a site ends up with a count of nine thousand deer.

**Delete keys still live in `localStorage`, but they are no longer the only way
back to your own rows.** Clear your browser data and anything you posted *while
signed in* is still yours — the author check covers it. Anything posted while
signed out is stranded up there forever, because nothing else ties it to you.

**Never use `toISOString()` to get *today's date*.** It converts to UTC first,
so after about 1am Irish summer time it returns tomorrow. Use the local-time
`todayISO()` helper in `index.html`. (Sending an *instant* to the server as
`toISOString()` is correct and is what `seen_at` does — the trap is only about
deriving a calendar date.)

**Numbers are recomputed, never incremented.** `refreshStats()` recalculates
every counter from `allSightings`. Incrementing works until something is
removed, and then the numbers drift with nothing on screen to say they are
wrong.

**One click listener on the feed, not one per card.** `renderFeed()` destroys
and rebuilds every card whenever anything changes, and a listener attached to a
card dies with it. The listener sits on `#feedList`, which survives.

**Change a behaviour, then search for the words that describe it.** This has now
happened twice in this project. The ratings carousel said "Hover to pause" after
the phone behaviour became tap-to-start. The homepage said "nobody else can see
them yet" for the first hour after the backend went in. Nothing breaks and
nothing errors — the code and the words quietly stop agreeing, and only a reader
ever notices.

## Accounts

A visitor used to be a random handle like `@quietwalker42`, invented by the
browser and kept in `localStorage`. It was not a user. Anyone could type your
handle into their own browser and post as you, and clearing your site data lost
you the name and every badge earned under it.

A username is now something you own:

- **Sign up** with a name (3–20 characters of `a-z A-Z 0-9 . - _`) and a
  password of at least 8 characters. There is no email address, because there is
  nothing the site would ever need to send you.
- **The password is stored as a PBKDF2-SHA256 hash** with a random salt per
  account — never the password itself. There is therefore **no password reset**:
  nobody, including whoever runs the site, can read it back.
- **Logging in sets an `HttpOnly` cookie** holding a random session token. Only
  the SHA-256 of that token is stored, so reading the `sessions` table gets you
  into nobody's account. Sessions last 30 days.
- **Logging a sighting requires an account.** The author is taken from the
  cookie and `author` in the request body is ignored entirely — before this,
  posting as somebody else was a matter of editing one line of JSON.
- **Reviews do not require an account.** A sighting is data other people
  navigate by and has to be attributable; a review is an opinion, and requiring
  signup would mostly collect reviews of the signup form. If you *are* signed
  in, your review is signed with your handle and nobody else can type it.
- **Your own sightings are yours on any device.** Deleting used to need the
  `delete_key` in one browser's `localStorage`, so signing in on your phone left
  you unable to remove something you had posted from your laptop. The author
  check is a second, equal way in; the key still works for anything posted
  while signed out.
- **Achievements follow the account**, not the browser, which is what they were
  always supposed to do.

`PBKDF2_ITERATIONS` in `functions/api/_auth.js` is set to 50,000, which is low.
That is not a security judgement, it is Cloudflare's free plan: 10ms of CPU per
request, and hashing is real CPU. 100k measured at ~9.4ms, leaving nothing for
the database call after it. On a paid plan raise it — the count is written into
every stored hash, so old accounts keep working.

## Known problems — read this before sharing the address widely

**Nothing rate-limits the login endpoint.** Someone can guess passwords as fast
as they can send requests. PBKDF2 makes each guess cost the server about 5ms of
CPU, which is a speed bump, not a lock. The fix is a KV or Durable Object
counter keyed on the username and the IP, refusing after a handful of failures.

**There is no password reset and no email address on file.** A forgotten
password means a lost account and every badge with it. This is a deliberate
trade — asking children for email addresses is its own problem — but it is a
trade, and anyone signing up should be told, which the dialog does say.

**There is no moderation.** Anything anybody posts appears immediately, to
everybody. The server checks the *shape* of a sighting — a count between 1 and
200, a location and species from fixed lists, coordinates inside the park — but
it cannot check intent, and the note field is free text. For a site nobody has
heard of this is fine. The day it gets shared widely it stops being fine, and
the fix is a `status` column defaulting to `pending` plus a page to approve rows.

**There is no privacy policy.** The site now stores what people type on a
server, which is a much bigger deal than it was when everything stayed in the
browser. Anyone in the EU can ask what is held about them and ask for it to be
deleted, and there is currently no page saying who to ask.

**Map tiles come from openstreetmap.org.** Every visitor's IP reaches OSM's
servers whenever the map draws. Unavoidable without self-hosting tiles, so it
needs disclosing rather than fixing. OSM's tile policy also forbids heavy
traffic — a busy site needs its own tile source.

**The hero photograph is not a fallow deer.** It is a white-tailed deer: white
throat bib, white band around a black nose. Every page's `og:image:alt` calls it
a fallow deer. On a site about telling deer apart, that is worth fixing.

**Two achievement badges can never unlock.** "Weather Worn" needs weather data
and "50 Metre Champion" needs a pledge; the site records neither. They are left
locked rather than given an invented condition.

## Credits

- Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors
- Maps rendered with [Leaflet](https://leafletjs.com/) 1.9.4 (BSD-2-Clause)
- Fonts: [Inter](https://rsms.me/inter/) and Playfair Display, both SIL Open Font License
- Hero photograph from [Unsplash](https://unsplash.com/), used under the Unsplash License
