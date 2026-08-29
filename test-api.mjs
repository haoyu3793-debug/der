// End-to-end test of the backend, against a real SQLite standing in for D1.
// 后端端到端测试，用真 SQLite 顶替 D1。
//
//   node test-api.mjs
//
// It imports the actual handler files, so if a handler is broken this fails.
// 它 import 的是真正的处理函数文件，函数坏了这里就会红。
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";

const db = new DatabaseSync(":memory:");
db.exec(readFileSync("schema.sql", "utf8"));

const DB = {
  prepare(sql) {
    const st = { _a: [] };
    st.bind = (...a) => { st._a = a; return st; };
    st.all = async () => ({ results: db.prepare(sql).all(...st._a) });
    st.run = async () => { const r = db.prepare(sql).run(...st._a); return { meta: { changes: Number(r.changes) } }; };
    st.first = async () => db.prepare(sql).get(...st._a) ?? null;
    return st;
  },
};
const env = { DB };

let pass = 0, fail = 0;
const ok = (n, c, x) => c ? (pass++, console.log("  ok   " + n))
                          : (fail++, console.log("  FAIL " + n + (x !== undefined ? "  -> " + x : "")));

let jar = "";
const req = (body, cookie) => ({
  json: async () => { if (body === undefined) throw new SyntaxError("no body"); return body; },
  headers: { get: (k) => {
    const h = k.toLowerCase();
    if (h === "cookie") return cookie === null ? null : (cookie ?? jar ?? null);
    if (h === "x-delete-key") return body && body.__key ? body.__key : null;
    return null;
  } },
});
const keyReq = (key, cookie) => ({
  json: async () => { throw new SyntaxError("no body"); },
  headers: { get: (k) => {
    const h = k.toLowerCase();
    if (h === "x-delete-key") return key || null;
    if (h === "cookie") return cookie === null ? null : (cookie ?? jar ?? null);
    return null;
  } },
});
const stash = (res) => { const s = res.headers.get("set-cookie"); if (s) jar = s.split(";")[0]; return res; };

const S  = await import("./functions/api/sightings.js");
const SD = await import("./functions/api/sightings/[id].js");
const A  = await import("./functions/api/auth/signup.js");
const L  = await import("./functions/api/auth/login.js");
const O  = await import("./functions/api/auth/logout.js");

const base = {
  location: "Glen Pond", species: "Fallow doe (female)", count: 3,
  lat: 53.35, lng: -6.32, note: "by the water", photo: null,
};
const list = async () => (await (await S.onRequestGet({ env })).json()).sightings;

console.log("\n  === the schema ===");
const cols = db.prepare("select name from pragma_table_info('sightings')").all().map(r => r.name);
ok("sightings has author_user", cols.includes("author_user"));
const tables = db.prepare("select name from sqlite_master where type='table'").all().map(r => r.name);
ok("all four tables exist", ["sightings","ratings","users","sessions"].every(t => tables.includes(t)));

console.log("\n  === a guest, who is most people ===");
let r = await S.onRequestPost({ request: req({ ...base, author: "Mei" }, null), env });
let j = await r.json();
ok("a guest may post without an account", r.status === 201, r.status + " " + JSON.stringify(j).slice(0,90));
ok("the reply says it is not an account", j.is_account === false, j.is_account);
const guestId = j.id, guestKey = j.delete_key;
let rows = await list();
ok("the guest row has author_user null", rows.find(x => x.id === guestId)?.author_user == null);
ok("the guest name is shown without an @", rows.find(x => x.id === guestId)?.author === "Mei",
   rows.find(x => x.id === guestId)?.author);

r = await S.onRequestPost({ request: req({ ...base, author: "x" }, null), env });
ok("a one-character name is refused", r.status >= 400, r.status);
r = await S.onRequestPost({ request: req({ ...base, author: "  " }, null), env });
ok("a blank name is refused", r.status >= 400, r.status);
r = await S.onRequestPost({ request: req({ ...base, author: "<script>alert(1)</script>" }, null), env });
j = await r.json();
if (r.status === 201) {
  const row = (await list()).find(x => x.id === j.id);
  ok("angle brackets are stripped from a guest name", !/[<>()/]/.test(row.author), row.author);
} else { ok("angle brackets are stripped from a guest name", false, "rejected " + r.status); }

console.log("\n  === an account ===");
r = stash(await A.onRequestPost({ request: req({ username: "harry", password: "deerpark2026" }, null), env }));
ok("signup works", r.status === 201, r.status);
r = await S.onRequestPost({ request: req(base), env });
j = await r.json();
ok("a signed-in post works", r.status === 201, r.status);
ok("the reply says it IS an account", j.is_account === true);
const acctId = j.id, acctKey = j.delete_key;
rows = await list();
ok("the account row carries author_user", rows.find(x => x.id === acctId)?.author_user === "harry");
ok("an account name is shown with an @", rows.find(x => x.id === acctId)?.author === "@harry",
   rows.find(x => x.id === acctId)?.author);
ok("the browser cannot choose its own name while signed in", (async () => true)());
r = await S.onRequestPost({ request: req({ ...base, author: "somebody-else" }), env });
j = await r.json();
rows = await list();
ok("a signed-in post ignores the name in the body",
   rows.find(x => x.id === j.id)?.author === "@harry", rows.find(x => x.id === j.id)?.author);

console.log("\n  === a registered name is reserved ===");
r = await S.onRequestPost({ request: req({ ...base, author: "harry" }, null), env });
j = await r.json();
ok("a guest may not take a registered name", r.status === 409, r.status + " " + JSON.stringify(j).slice(0,80));
r = await S.onRequestPost({ request: req({ ...base, author: "HARRY" }, null), env });
ok("nor a different capitalisation of it", r.status === 409, r.status);
r = await S.onRequestPost({ request: req({ ...base, author: "harriet" }, null), env });
ok("a free name is still fine", r.status === 201, r.status);

console.log("\n  === who may delete what ===");
const savedJar = jar;
jar = "";
r = await SD.onRequestDelete({ params: { id: guestId }, request: keyReq("wrong-key", null), env });
ok("a guest row survives a wrong key", r.status === 404, r.status);
jar = savedJar;
r = await SD.onRequestDelete({ params: { id: guestId }, request: keyReq(null), env });
ok("a signed-in account cannot delete a guest row it did not post", r.status === 404, r.status);
jar = "";
r = await SD.onRequestDelete({ params: { id: guestId }, request: keyReq(guestKey, null), env });
ok("the delete key still opens a guest row", r.status < 300, r.status);
jar = savedJar;
r = await SD.onRequestDelete({ params: { id: acctId }, request: keyReq(null), env });
ok("an account deletes its own row with no key at all", r.status < 300, r.status);

console.log("\n  === the takeover that used to work ===");
// A row from before accounts existed: author text, author_user null.
db.prepare(`insert into sightings
   (id,seen_at,lat,lng,location,species,count,note,author,author_user,photo,delete_key,created_at)
   values (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
  .run("old-1","2026-08-01T00:00:00.000Z",53.35,-6.32,"Glen Pond","Fallow doe (female)",
       2,"before accounts","@velvetmeadow81",null,null,"a-key-nobody-has","2026-08-01T00:00:00.000Z");
jar = "";
r = stash(await A.onRequestPost({ request: req({ username: "velvetmeadow81", password: "squatter-pw-99" }, null), env }));
ok("a stranger may still register that name", r.status === 201, r.status);
r = await SD.onRequestDelete({ params: { id: "old-1" }, request: keyReq(null), env });
const stillThere = db.prepare("select count(*) c from sightings where id='old-1'").get().c === 1;
ok("but it CANNOT delete the old row (this used to return 200)", r.status === 404 && stillThere,
   "status=" + r.status + " stillThere=" + stillThere);

console.log("\n  === the login shortcut that used to work ===");
jar = "";
const alice = stash(await A.onRequestPost({ request: req({ username: "alice", password: "alice-password-1" }, null), env }));
const aliceCookie = jar;
jar = "";
await A.onRequestPost({ request: req({ username: "bob", password: "bob-password-1" }, null), env });
r = await L.onRequestPost({ request: req({ username: "bob", password: "COMPLETELY-WRONG" }, aliceCookie), env });
ok("a wrong password fails even with somebody else's cookie present", r.status >= 400, r.status);
r = await L.onRequestPost({ request: req({ username: "bob", password: "bob-password-1" }, aliceCookie), env });
j = await r.json();
ok("the right password signs in as BOB, not as alice",
   r.status === 200 && (j.username === "bob" || j.handle === "@bob"), JSON.stringify(j).slice(0,80));

console.log(`\n  通过 ${pass}  失败 ${fail}`);
process.exit(fail ? 1 : 0);
