# Phoenix Park Deer Tracker

<!-- Once it is deployed, put the address here. -->

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
| `partials.js` | Builds the nav bar and footer and injects them into every page, so there is one copy instead of five. Also generates and remembers the visitor's `@handle`. |
| `achievements.html` | 31 badges. Which ones are unlocked is worked out from your own logged sightings. |
| `encyclopedia.html` | Reference pages about fallow deer. Static content. |
| `info.html` | Visitor information — how to get there, when to go, how to behave around the deer. |
| `donate.html` | Support page. **See "Known problems" below before putting this online.** |
| `serve.ps1` | A tiny static file server in PowerShell. Zero dependencies. |
| `share.ps1` | Wraps `serve.ps1` in a Cloudflare Quick Tunnel to get a public URL. |
| `vendor/` | Leaflet and the web fonts, served from this site rather than someone else's. |
| `assets/` | The hero photograph. |
| `functions/api/sightings.js` | The backend: list every sighting (GET) and add one (POST). Cloudflare Pages turns any file under `functions/` into a URL. |
| `functions/api/sightings/[id].js` | Delete one sighting. The brackets mean that part of the URL is a variable. |
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
| `localStorage` → `ppdt_delete_keys` | The secrets that prove *this* browser posted a given sighting |
| `localStorage` → `ppdt_username` | The `@handle` generated on first visit |
| `localStorage` → `ppdt_ratings_v1` | **Ratings are still local only.** Not migrated yet — see below |

### How deleting works without accounts

There are no accounts, no passwords and no email addresses anywhere in this
project, and there is still no way for a stranger to delete your sightings.

When you post one, the server generates a random `delete_key`, stores it beside
the row, and returns it **once** — to the browser that posted it. That browser
keeps it in `localStorage`. To delete, it sends the key back; the server
compares and refuses if it does not match. The key is never included in the
list everybody reads.

The trade is real and worth saying out loud: **clear your browser data and you
can no longer delete the sightings you posted.** They stay up. That is the
price of not asking anybody for an email address.

### Still unfinished

Ratings were never migrated. They are written to `localStorage` exactly as they
always were, so a review you leave is visible only to you — while a sighting
you post is visible to everyone. The site now behaves two different ways in two
places, and the hero text says so rather than pretending otherwise. Migrating
them is the same job as the sightings: a table, two endpoints, and replacing
`loadRatings`/`saveRatings` with `fetch`.

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

**Delete keys are the only thing left in `localStorage`, and losing them is
permanent.** Clear your browser data and the sightings you posted stay up
forever, because nothing else ties them to you. That is the deliberate price of
having no accounts and asking nobody for an email address.

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

## Known problems — read this before sharing the address widely

**There is no moderation.** Anything anybody posts appears immediately, to
everybody. The server checks the *shape* of a sighting — a count between 1 and
200, a location and species from fixed lists, coordinates inside the park — but
it cannot check intent, and the note field is free text. For a site nobody has
heard of this is fine. The day it gets shared widely it stops being fine, and
the fix is a `status` column defaulting to `pending` plus a page to approve rows.

**Ratings are still device-local.** Sightings are shared; reviews are not. The
homepage says so, but it is an inconsistency, not a design.

**There is no privacy policy.** The site now stores what people type on a
server, which is a much bigger deal than it was when everything stayed in the
browser. Anyone in the EU can ask what is held about them and ask for it to be
deleted, and there is currently no page saying who to ask.

**Map tiles come from openstreetmap.org.** Every visitor's IP reaches OSM's
servers whenever the map draws. Unavoidable without self-hosting tiles, so it
needs disclosing rather than fixing. OSM's tile policy also forbids heavy
traffic — a busy site needs its own tile source.

**The donate page is a demo and says so, but only inside the form.** The top of
the page still reads as a real fundraising appeal, describing programmes that do
not exist. Nothing is collected — the form never submits, never stores and never
transmits — so this is a credibility problem, not a legal one.

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
