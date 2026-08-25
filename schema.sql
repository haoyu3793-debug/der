-- Phoenix Park Deer Tracker — the shared database
--
-- This runs on Cloudflare D1, which is SQLite. It is the same SQL you wrote in
-- Lesson 12 and ran on your own machine in Lesson 13 — the only difference is
-- that this copy lives on a server, so everybody sees the same rows.
--
-- Load it with:
--   wrangler d1 execute deer-tracker --remote --file=./schema.sql

drop table if exists sightings;

create table sightings (
  -- A real primary key. We used to identify a sighting by its timestamp, and
  -- two people logging a sighting in the same second collided.
  id          text    primary key,

  seen_at     text    not null,          -- 'YYYY-MM-DDTHH:MM:SS.sssZ'
  lat         real    not null,
  lng         real    not null,
  location    text    not null,
  species     text    not null,
  count       integer not null check (count > 0 and count <= 200),
  note        text,
  author      text    not null,

  -- A compressed photo as a data: URI, or null. The browser shrinks these to
  -- 550px before upload, so they are tens of kilobytes rather than megabytes.
  photo       text,

  -- The secret the browser gets back when it posts a sighting, and must send
  -- back to delete it. This is what stops a stranger deleting your entries.
  -- It is not a password: it never identifies a person, it only proves that
  -- whoever is asking is the same browser that created the row.
  delete_key  text    not null,

  created_at  text    not null           -- when the server received it
) strict;

-- The feed asks for the newest sightings, over and over. Without this index
-- SQLite reads and sorts the whole table every time.
create index sightings_seen_at on sightings (seen_at desc);

-- ------------------------------------------------------------------
-- Ratings
--
-- These were the last thing still living in localStorage: you could leave a
-- review and nobody else could ever read it, on a site whose whole point is
-- that people can see each other's contributions.
-- ------------------------------------------------------------------

drop table if exists ratings;

create table ratings (
  id          text    primary key,
  stars       real    not null check (stars >= 1 and stars <= 5),
  name        text    not null,
  text        text    not null,
  delete_key  text    not null,      -- same idea as sightings
  created_at  text    not null
) strict;

create index ratings_created_at on ratings (created_at desc);
