-- Phoenix Park Deer Tracker — the shared database
--
-- This runs on Cloudflare D1, which is SQLite. It is the same SQL you wrote in
-- Lesson 12 and ran on your own machine in Lesson 13 — the only difference is
-- that this copy lives on a server, so everybody sees the same rows.
--
-- ⚠ THIS FILE IS FOR AN EMPTY DATABASE ONLY.
-- ⚠ 这个文件只能用在【空】数据库上。
--
-- It begins with `drop table if exists sightings`. Run it against the live
-- database and every sighting anybody ever posted is gone, permanently.
-- To change a database that already has rows in it, write a migration:
-- see migrate-001-accounts.sql for what one looks like.
--
-- 它开头是 `drop table if exists sightings`。对着线上库跑一次，所有人发过的
-- 每一条记录都会永久消失。要改一个已经有数据的库，写迁移文件：
-- 看 migrate-001-accounts.sql 是什么样子。
--
-- Load it with (only on an empty database):
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

  -- Which ACCOUNT posted this, or null for a guest. Only a request carrying a
  -- valid session can ever write it, which is what makes it proof of identity
  -- rather than a label. sightings/[id].js compares this - never `author` - to
  -- decide who may delete the row.
  -- 是哪个【账号】发的；游客为 null。只有带着有效 session 的请求才写得进去，
  -- 这正是它能作为身份证据、而 author 只是标签的原因。
  author_user text,

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

-- ------------------------------------------------------------------
-- Accounts
--
-- Until now a "user" was a nickname the browser made up and kept in
-- localStorage. Anyone could type your handle into their own browser and post
-- as you, and clearing your site data lost you every badge you had earned.
-- These two tables turn that handle into something you own: a name nobody else
-- can take, proved by a password.
--
-- Note that these two, unlike the tables above, are NOT dropped and recreated.
-- Re-running this file must not delete everybody's account.
-- ------------------------------------------------------------------

create table if not exists users (
  -- The handle as the person typed it, including their choice of capitals:
  -- this is what gets shown next to their sightings.
  username     text    primary key,

  -- The same name folded to lower case. Uniqueness is checked against this so
  -- that "FurryGlen" and "furryglen" cannot both exist — two accounts one
  -- letter apart in case is an impersonation waiting to happen.
  username_lc  text    not null unique,

  -- 'pbkdf2$<iterations>$<salt base64>$<hash base64>'. The password itself is
  -- never stored and cannot be recovered from this — that is the whole point.
  -- Everything needed to check a password is in the string, including the
  -- iteration count, so the cost can be raised later without stranding the
  -- accounts created under the old one.
  password     text    not null,

  created_at   text    not null
) strict;

create table if not exists sessions (
  -- The SHA-256 of the token in the cookie, not the token. Someone who reads
  -- this table cannot log in as anybody: a hash will not open a session, and
  -- there is no way back from it to the cookie value.
  token_hash   text    primary key,

  username     text    not null,
  created_at   text    not null,
  expires_at   text    not null,

  -- Deleting an account should not leave live sessions behind.
  foreign key (username) references users (username) on delete cascade
) strict;

-- Logging out and expiring sweep by these.
create index if not exists sessions_username on sessions (username);
create index if not exists sessions_expires_at on sessions (expires_at);
