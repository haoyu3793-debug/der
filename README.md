# Phoenix Park Deer Tracker

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

---

## Where the data lives

**Everything is in the visitor's own browser**, in `localStorage`. There is no
server and no database.

| Key | Holds |
|---|---|
| `ppdt_sightings` | Every sighting, including photos as base64 strings |
| `ppdt_ratings_v1` | Submitted reviews |
| `ppdt_username` | The `@handle` generated on first visit |

The consequence is the single most important thing to understand about this
site: **two people who open it see completely different content.** Nothing you
post is visible to anyone else, on any other device. It is not a bug — there is
simply nothing in the middle to share it through.

Fixing that means writing a backend. There is a 57-line Node server in the
Lesson 15 courseware that does it with `node:http` and `node:sqlite`.

---

## Traps — the things that will bite the next person

These are the ones that cost real time to work out. Read them before changing
anything.

**A sighting lives in four places at once.** Adding one touches the map layer,
the `allSightings` array, the rendered HTML, and `localStorage`. Deleting one
has to undo all four. Miss `saveSightings()` and the delete looks perfect until
someone reloads the page and the row comes back. The test for any change here is
one sentence: *delete it, reload, it must still be gone.*

**`_marker` cannot go into `localStorage`.** Each sighting carries a `_marker`
property pointing at its Leaflet marker, and that object refers back to the map,
which refers back to every marker. `JSON.stringify` follows that loop forever
and throws. `saveSightings()` copies out the plain fields only — do not
"simplify" it into `JSON.stringify(allSightings)`.

**Dates come back from storage as strings.** `JSON.parse` does not know what a
`Date` is. `loadSightings()` revives each one with `new Date(s.when)`. Skip that
and every call to `.getTime()` blows up.

**Never use `toISOString()` to get today's date.** It converts to UTC first, so
after about 1am Irish summer time it returns tomorrow. Use the local-time
`todayISO()` helper that is already in `index.html`.

**Photos are base64, so they are 33% bigger than the file.** `localStorage`
holds roughly 5 MB, so a handful of uncompressed phone photos fills it and the
next save throws `QuotaExceededError`. Images are shrunk through a canvas before
being stored.

**Numbers are recomputed, never incremented.** `refreshStats()` recalculates
every counter from `allSightings`. Incrementing works fine until something is
removed, and then the numbers drift with nothing on screen to say they are
wrong.

**One click listener on the feed, not one per card.** `renderFeed()` destroys
and rebuilds every card whenever anything changes, and any listener attached to
a card dies with it. The listener sits on `#feedList`, which survives.

**The five sightings on the map are samples, and they must stay labelled.** They
carry `demo: true`, render with a "Sample" tag and no timestamp, and are excluded
from every statistic. `saveSightings()` deliberately copies the flag through to
storage — drop it and they quietly become real entries on the next page load.
They used to be signed with five invented handles and dated "6 minutes ago"
relative to whenever you loaded the page, so the site permanently looked as if
other people had just been using it.

**Change a behaviour, then search for the words that describe it.** The ratings
carousel used to say "Hover to pause". Then the phone behaviour changed to
tap-to-start and the sentence stayed. Nothing broke, nothing errored — the code
and the words just quietly stopped agreeing, and only a reader would ever notice.

---

## Known problems — read this before putting it on the internet

**The donate page collects a name and an email address and there is no payment
system behind it.** The site is aimed at people in Dublin, so GDPR applies to
anyone who fills it in. There is currently no privacy policy anywhere on the
site explaining what is collected, why, where it is kept, or how to have it
deleted. Either remove the form or do the work properly before this goes live.

**There is no privacy policy or cookie notice.** The site sets `localStorage`
keys and loads map tiles from a third party (see below).

**Map tiles come from openstreetmap.org.** Every visitor's IP address reaches
OpenStreetMap's servers whenever the map is displayed. This is unavoidable
without self-hosting tiles, so it needs to be disclosed rather than fixed. OSM's
tile usage policy also forbids heavy traffic — a busy site needs its own tile
source.

**No `robots.txt`, no `sitemap.xml`.**

**Two achievement badges can never be unlocked.** "Weather Worn" needs weather
data and "50 Metre Champion" needs a pledge, and the site records neither. They
are deliberately left locked rather than given an invented condition.

---

## Credits

- Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors
- Maps rendered with [Leaflet](https://leafletjs.com/) 1.9.4 (BSD-2-Clause)
- Fonts: [Inter](https://rsms.me/inter/) and Playfair Display, both SIL Open Font License
- Hero photograph from [Unsplash](https://unsplash.com/), used under the Unsplash License
