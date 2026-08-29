# Putting this site on the internet

The site is static — HTML, CSS, JavaScript, and files. There is no build step
and no server to run. That makes hosting it free and permanent.

Everything below takes about 40 minutes the first time. After that, publishing
a change is `git push` and nothing else.

---

## Before you start

**The account has to belong to an adult.** GitHub and Cloudflare both require
you to accept terms of service, and a minor cannot. Register both accounts in a
parent's or teacher's name. Worth saying out loud in the lesson: *shipping
something publicly is a responsibility, not just a button.*

You need two free accounts:

- **github.com** — stores the code
- **dash.cloudflare.com** — serves the site

---

## Step 1 · Put the code on GitHub (10 min)

The repository already exists locally, with three commits, on the `main` branch.
It has no remote yet — that is what we are adding.

**1.1** On github.com, click **New repository**.

- Name: `deer-tracker`
- Public or Private — both work with Cloudflare Pages
- **Do not tick "Add a README file"**, and do not add a `.gitignore` or licence

> Ticking any of those creates a commit on GitHub that your local repository
> does not have, and the first `push` is then rejected. It is fixable, but it
> is a confusing ten minutes for no reason.

**1.2** In a terminal, in `deer-simulator`:

```bash
git remote add origin https://github.com/YOUR-USERNAME/deer-tracker.git
git push -u origin main
```

The first push opens a browser window asking you to sign in to GitHub. That is
Git Credential Manager, which ships with Git for Windows — it remembers the
login, so this happens once.

**1.3** Refresh the GitHub page. You should see 27 files.

---

## Step 2 · Connect Cloudflare Pages (15 min)

**2.1** In the Cloudflare dashboard: **Workers & Pages → Create → Pages →
Connect to Git**.

**2.2** Authorise Cloudflare to read your GitHub account, and pick
`deer-tracker`.

**2.3** The build settings page is the only place this can go wrong:

| Field | What to put | Why |
|---|---|---|
| Framework preset | **None** | There is no framework |
| Build command | **leave empty** | There is nothing to build |
| Build output directory | **`/`** | The repository root *is* the website |

> The temptation is to type something into "Build command" because the box is
> there. Don't. This project's whole point is that a browser can open the files
> directly — that is the payoff for not using a framework or a bundler.
>
> And do **not** put `deer-simulator` in the output directory. That folder is
> the repository root; there is no folder of that name inside it.

> **Important:** If the deployment log says `wrangler deploy`, the Cloudflare
> **Build command** still contains the wrong command. Delete it completely and
> leave the field empty. `wrangler deploy` expects a standalone Worker script;
> this project is deployed as Pages.

**2.4** **Save and Deploy.** About a minute later you get a URL like
`deer-tracker-a1b.pages.dev`, with HTTPS already working.

### Deploying from the command line instead

Run this from the directory containing `wrangler.toml`:

```bash
wrangler pages deploy .
```

This is a **Pages** deployment. Do not run `wrangler deploy`: that command is
for a standalone Worker and expects a Worker entry-point such as `src/index.js`.
This project has Pages Functions under `functions/` instead.

---

## Step 3 · Things that are only possible once you have the address (15 min)

**3.1 · Make the share-preview image absolute.**
Four pages (`index`, `achievements`, `encyclopedia`, `info`) have:

```html
<meta property="og:image" content="assets/hero-1600.jpg" />
```

A relative path works in some link-preview scrapers and not others. Now that
the domain exists, make it absolute in all four:

```html
<meta property="og:image" content="https://YOUR-SITE.pages.dev/assets/hero-1600.jpg" />
```

**3.2 · Test the preview for real.** Paste the link into WhatsApp on an actual
phone. A title, a description and a photo should appear. If the photo does not,
3.1 is why.

**3.3 · Put the address at the top of `README.md`,** replacing nothing — just
add a line. The README currently explains how to run it locally and says
nothing about where it lives.

**3.4 · Commit and push.**

```bash
git add -A
git commit -m "Point the share-preview image at the real domain"
git push
```

Cloudflare rebuilds automatically. Watch the Deployments tab — it takes under a
minute. **This is the moment worth pausing on in the lesson:** from here on,
publishing is just `git push`.

---

## After that: how you publish a change

```bash
git add -A
git commit -m "what you changed and why"
git push
```

That is the whole thing. Cloudflare notices the push and redeploys.

If the site does not change after a push, check the Deployments tab in
Cloudflare before touching the code — nine times out of ten the deploy failed
or is still running, and the code is fine.

---

## A custom domain (optional, costs money)

`.com` is roughly €10–15/year, `.ie` roughly €20–30/year. Buy it wherever you
like; Cloudflare Registrar sells at cost.

In Pages: **Custom domains → Set up a domain**. If the domain is registered
with Cloudflare it takes one click. If not, you add two DNS records at your
registrar and wait — usually minutes, occasionally a few hours.

Do this *after* everything else works on the `.pages.dev` address. Debugging
DNS and debugging a website at the same time is miserable.

---

## What can actually go wrong

| Symptom | Cause |
|---|---|
| First `git push` is rejected | You ticked "Add a README" when creating the GitHub repo. Fix: `git pull --rebase origin main`, then push again |
| Deploy succeeds, site is a 404 | Build output directory is not `/` |
| Deploy fails immediately | Something is typed in "Build command" |
| Site does not update after a push | The change was committed but not pushed, or the deploy failed. Check the Deployments tab |
| Map is blank on the live site | Not a deploy problem. Map tiles come from openstreetmap.org and need a working internet connection at the *visitor's* end |
| Fonts look wrong | `vendor/fonts/` did not get committed. `git ls-files vendor` should list 12 files |

---

## Step 2b · Create the database (10 min)

The site now has a backend, so there is one extra step. Everything here is a
command; none of it is clicking around a dashboard.

```bash
npm install -g wrangler      # once, on the machine you deploy from
wrangler login               # opens a browser

wrangler d1 create deer-tracker
```

That last command prints a `database_id`. Paste it into `wrangler.toml`,
replacing `PASTE-THE-ID-FROM-wrangler-d1-create-HERE`.

Then create the tables on the real database:

```bash
wrangler d1 execute deer-tracker --remote --file=./schema.sql
```

`schema.sql` creates four tables: `sightings`, `ratings`, `users` and
`sessions`. The last two hold accounts, so read this before running it a second
time:

> **Re-running `schema.sql` deletes every sighting and every review.** The top
> of the file says `drop table if exists` for those two, on purpose — it is how
> you reset the demo data. `users` and `sessions` use `create table if not
> exists` instead and survive, because dropping everybody's account to reset
> some test rows would be a different kind of mistake.

If you are adding accounts to a site that is already live and already has
sightings in it, run only the accounts half rather than the whole file:

```bash
wrangler d1 execute deer-tracker --remote --command \
  "$(sed -n '/^-- Accounts/,$p' schema.sql)"
```

Commit `wrangler.toml` and push. Cloudflare reads it on the next deploy and
wires `env.DB` up to the database.

> The `database_id` is not a secret — it identifies the database, it does not
> grant access to it. Access comes from the binding in `wrangler.toml`, which
> only works from inside your own Cloudflare account.

**Check it worked:** open `https://your-site.pages.dev/api/sightings`. You
should see `{"sightings":[]}`. If you see an error mentioning `env.DB`, the
binding did not take — check the id and redeploy.

---

## What this does *not* fix

Hosting makes the site reachable. The backend makes sightings shared. Neither
touches the ratings: those are still written to `localStorage`, so a review is
visible only to the person who left it. The homepage says so.

There is also no moderation. Anything anybody posts appears immediately, to
everybody. For a site nobody has heard of that is fine; the day it gets shared
widely, it stops being fine. The server validates *shape* (a count between 1
and 200, a real location, a real species, coordinates inside the park) but it
cannot validate *intent* — somebody can still type something unpleasant into
the note field. If that matters, the next thing to build is a `status` column
that defaults to `pending` and a page where you approve rows.
