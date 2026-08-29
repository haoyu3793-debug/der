-- Migration 001 — accounts, sessions, and one new column on sightings.
-- 迁移 001 —— 账号、会话，以及 sightings 上的一个新字段。
--
-- Run this against a database that ALREADY HAS ROWS IN IT:
--   wrangler d1 execute deer-tracker --remote --file=./migrate-001-accounts.sql
--
-- 对着一个【已经有数据】的数据库跑：
--   wrangler d1 execute deer-tracker --remote --file=./migrate-001-accounts.sql
--
-- ─────────────────────────────────────────────────────────────────────────
-- WHY THIS IS A SEPARATE FILE FROM schema.sql
-- 为什么它和 schema.sql 是两个文件
--
-- schema.sql starts with `drop table if exists sightings`. That is correct for
-- creating an empty database and catastrophic for an existing one: it would
-- delete every sighting anybody has ever posted, permanently, for everybody.
--
-- schema.sql 开头是 `drop table if exists sightings`。建一个空库时这是对的，
-- 对一个已经在用的库则是灾难：它会把所有人发过的每一条记录永久删除。
--
-- A migration only ADDS. It never drops a table that has rows in it. Every
-- statement below is safe to run twice — that matters, because you will run it
-- once locally to check it and once for real.
--
-- 迁移只做「加」。它绝不删一张有数据的表。下面每一条都可以安全地跑两遍 ——
-- 这很重要，因为你会先在本地跑一遍验证，再对着线上跑一遍。
-- ─────────────────────────────────────────────────────────────────────────


-- ── 1. Accounts ──────────────────────────────────────────────────────────
--
-- username_lc is the primary key, not username. `Harry` and `harry` must not
-- be two different people, so uniqueness lives on the lowercase form and the
-- typed form is kept separately, only for showing.
--
-- 主键是 username_lc，不是 username。`Harry` 和 `harry` 不能是两个人，所以
-- 唯一性建在小写形式上，用户敲的原样单独存一份，只用来显示。
create table if not exists users (
  username_lc  text    primary key,
  username     text    not null,
  password     text    not null,     -- pbkdf2$iterations$salt$hash. never plain.
  created_at   text    not null
) strict;


-- ── 2. Sessions ──────────────────────────────────────────────────────────
--
-- token_hash, never the token. A session token is a password that logs
-- somebody in without them typing anything; if this table held the real ones,
-- whoever read it would instantly be everybody. The server hashes the incoming
-- cookie and compares — the same reasoning as the password column above.
--
-- 存的是 token_hash，不是 token。session token 是一个「不用输任何东西就能
-- 登录」的密码；如果这张表存的是真 token，谁读到它谁就立刻变成了所有人。
-- 服务器把收到的 cookie 哈希一遍再比对 —— 和上面那个密码列同一个道理。
create table if not exists sessions (
  token_hash   text    primary key,
  username_lc  text    not null,
  created_at   text    not null,
  expires_at   text    not null
) strict;

create index if not exists sessions_username    on sessions (username_lc);
create index if not exists sessions_expires_at  on sessions (expires_at);


-- ── 3. One new column on sightings ───────────────────────────────────────
--
-- This single nullable column is the whole account design.
--
--   NOT NULL -> an account posted this. Only a request carrying that account's
--               session can ever write it, so it is proof. Deleting needs that
--               same account.
--   NULL     -> a guest posted this, or it predates accounts entirely. The
--               name on it is a label somebody typed and proves nothing.
--               Deleting needs the delete key, exactly as before.
--
-- Two rules, never both, and the column itself says which one applies.
--
-- 这一个可空字段就是整个账号设计。
--
--   不为 NULL -> 是某个账号发的。只有带着那个账号 session 的请求才写得进去，
--                所以它是证据。删除需要同一个账号。
--   为 NULL   -> 游客发的，或者早于账号系统。上面那个名字只是某人敲的标签，
--                不证明任何事。删除需要删除钥匙，跟以前一样。
--
-- 两条规则，永不同时生效，而且这个字段自己会说该用哪一条。
--
-- SQLite has no `add column if not exists`. Running this twice gives
-- "duplicate column name: author_user" — which is the migration telling you it
-- has already been applied, not a failure. Read the error before you panic.
--
-- SQLite 没有 `add column if not exists`。跑第二遍会报
-- "duplicate column name: author_user" —— 那是迁移在告诉你它已经执行过了，
-- 不是出错。慌之前先把报错读完。
alter table sightings add column author_user text;


-- ── 4. What happens to the rows that were already there ──────────────────
--
-- Nothing, and that is deliberate. Their author_user is NULL, so they are
-- guest rows: only the delete key opens them, and no account can ever claim
-- them. Somebody registering `velvetmeadow81` tomorrow gets the name and gets
-- nothing else.
--
-- Before accounts existed, nothing ever proved that the person typing
-- `velvetmeadow81` was the same person the next time. If registering a name
-- handed you every post that name had made, then registering would be a way to
-- take other people's posts. A real person loses their own history, which is a
-- genuine cost — but the alternative cost is that anybody can steal anybody's.
-- When two designs both cost something, pick the one whose failure is not an
-- attack.
--
-- 已经在库里的那些行会怎样：什么都不会，而且是故意的。它们的 author_user
-- 是 NULL，所以是游客行：只有删除钥匙能打开，任何账号都无法认领。明天有人
-- 注册 `velvetmeadow81`，他拿到名字，别的什么都拿不到。
--
-- 在账号出现之前，从来没有任何东西证明过「这次输 velvetmeadow81 的人」和
-- 「上次那个」是同一个人。如果注册一个名字就能拿到这个名字发过的所有帖子，
-- 那注册就成了夺取别人帖子的手段。一个真正的本人会失去自己的历史，这是真实
-- 的代价 —— 但另一种代价是任何人都能偷任何人的。两种设计都有代价时，选那个
-- 「出错时不会变成攻击」的。
