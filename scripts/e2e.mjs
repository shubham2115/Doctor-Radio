// End-to-end smoke test against a running server. Usage: node e2e.mjs http://localhost:3100
import sharp from "sharp";
import fs from "node:fs";
import { execSync } from "node:child_process";
import { zipSync, strToU8 } from "fflate";

const B = process.argv[2];
const R = Math.random().toString(36).slice(2, 7);
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"}  ${m}`); if (!c) process.exitCode = 1; };

function cookieJar() {
  const jar = new Map();
  return {
    add(res) { for (const c of res.headers.getSetCookie?.() ?? []) { const [kv] = c.split(";"); const i = kv.indexOf("="); jar.set(kv.slice(0, i), kv.slice(i + 1)); } },
    header() { return [...jar].map(([k, v]) => `${k}=${v}`).join("; "); },
  };
}
async function client(email, name) {
  const jar = cookieJar();
  const f = async (path, init = {}) => {
    const res = await fetch(B + path, { redirect: "manual", ...init, headers: { cookie: jar.header(), origin: B, ...(init.body && typeof init.body === "string" ? { "content-type": "application/json" } : {}), ...init.headers } });
    jar.add(res); return res;
  };
  const json = async (path, method, body) => { const r = await f(path, { method, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, data: await r.json().catch(() => ({})) }; };
  await json("/api/auth/register", "POST", { name, email, password: "Str0ngPassw0rd" });
  const csrf = (await (await f("/api/auth/csrf")).json()).csrfToken;
  await f("/api/auth/callback/credentials", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ csrfToken: csrf, email, password: "Str0ngPassw0rd" }).toString() });
  const prof = await json("/api/profile", "PUT", { username: "u" + email.split("@")[0].replace(/\W/g, "_").slice(0, 20), displayName: name, designation: "PG2", interests: ["Neuroradiology"] });
  return { f, json, prof, email };
}

// ---- synthetic DICOM (explicit VR LE) containing PHI --------------------------------------
function dicom(instance) {
  const parts = [];
  const pad = (s, ch = " ") => (s.length % 2 ? s + ch : s);
  const el = (g, e, vr, val, long = false) => {
    const v = Buffer.isBuffer(val) ? val : Buffer.from(val, "latin1");
    const h = Buffer.alloc(long ? 12 : 8);
    h.writeUInt16LE(g, 0); h.writeUInt16LE(e, 2); h.write(vr, 4, "latin1");
    if (long) h.writeUInt32LE(v.length, 8); else h.writeUInt16LE(v.length, 6);
    parts.push(h, v);
  };
  const us = (n) => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; };
  parts.push(Buffer.alloc(128), Buffer.from("DICM"));
  el(0x0002, 0x0010, "UI", pad("1.2.840.10008.1.2.1", "\0"));
  el(0x0008, 0x0016, "UI", pad("1.2.840.10008.5.1.4.1.1.2", "\0"));
  el(0x0008, 0x0018, "UI", pad(`1.2.3.4.5.6.7.8.${instance}`, "\0"));
  el(0x0008, 0x0020, "DA", "20240101");
  el(0x0008, 0x0050, "SH", "ACC12345");
  el(0x0008, 0x0060, "CS", "CT");
  el(0x0008, 0x0080, "LO", "SECRET HOSPITAL ");
  el(0x0010, 0x0010, "PN", "DOE^JOHN");
  el(0x0010, 0x0020, "LO", pad("MRN998877"));
  el(0x0010, 0x0030, "DA", "19800101");
  el(0x0020, 0x000d, "UI", pad("1.2.826.0.1.3680043.2.1.1", "\0"));
  el(0x0020, 0x000e, "UI", pad("1.2.826.0.1.3680043.2.1.2", "\0"));
  el(0x0020, 0x0013, "IS", pad(String(instance)));
  el(0x0028, 0x0002, "US", us(1));
  el(0x0028, 0x0004, "CS", pad("MONOCHROME2"));
  el(0x0028, 0x0010, "US", us(64)); el(0x0028, 0x0011, "US", us(64));
  el(0x0028, 0x0100, "US", us(16)); el(0x0028, 0x0101, "US", us(16)); el(0x0028, 0x0102, "US", us(15)); el(0x0028, 0x0103, "US", us(0));
  const px = Buffer.alloc(64 * 64 * 2);
  for (let i = 0; i < 4096; i++) px.writeUInt16LE((i % 64) * 40 + instance * 100, i * 2);
  const h = Buffer.alloc(12); h.writeUInt16LE(0x7fe0, 0); h.writeUInt16LE(0x0010, 2); h.write("OW", 4, "latin1"); h.writeUInt32LE(px.length, 8);
  parts.push(h, px);
  return Buffer.concat(parts);
}

const png = await sharp({ create: { width: 200, height: 150, channels: 3, background: { r: 20, g: 90, b: 140 } } }).png().toBuffer();
const zip = Buffer.from(zipSync({ "scan1.png": png, "notes.txt": strToU8("hello"), "series/slice1.dcm": dicom(1) }));
const evilZip = Buffer.from(zipSync({ "../../evil.png": png, "scan1.png": png }));
const nestedZip = Buffer.from(zipSync({ "inner.zip": zip }));
const bomb = Buffer.from(zipSync({ "zeros.png": new Uint8Array(200 * 1024 * 1024) }, { level: 9 }));
const meta = { title: `Ring-enhancing lesion ${R}`, modality: "CT", bodyRegion: "Brain", difficulty: "INTERMEDIATE", category: "Neoplasm", patientAgeRange: "45-60 y", clinicalHistory: "Headache and left-sided weakness for two weeks.", tags: ["ring-enhancing", "brain"] };

async function upload(c, files, m = meta) {
  const fd = new FormData(); fd.set("meta", JSON.stringify(m));
  for (const [name, buf] of files) fd.append("files", new Blob([buf]), name);
  const r = await c.f("/api/cases", { method: "POST", body: fd });
  return { status: r.status, data: await r.json() };
}

// ---- run -----------------------------------------------------------------------------------
const a = await client(`a${R}@t.org`, "Dr Alpha Tester");
const b = await client(`b${R}@t.org`, "Dr Beta Tester");
const mod = await client(`m${R}@t.org`, "Dr Mod Tester");
ok(a.prof.status === 200 && b.prof.status === 200, "3 users registered + onboarded");
execSync(`node scripts/make-admin.mjs m${R}@t.org MODERATOR`, { cwd: process.cwd() });

let r = await upload(a, [["x.png", png]]);
ok(r.status === 403, `unverified member cannot upload (${r.status})`);
execSync(`node -e "import('@prisma/client').then(async({PrismaClient})=>{const d=new PrismaClient();await d.userProfile.updateMany({where:{user:{email:'a${R}@t.org'}},data:{verificationStatus:'VERIFIED'}});await d.$disconnect()})"`, { cwd: process.cwd() });

r = await upload(a, [["fake.png", Buffer.from("MZ this is an exe pretending to be png")]]);
ok(r.status === 422, `fake PNG (bad signature) rejected (${r.status}: ${r.data.error})`);
r = await upload(a, [["bad.rar", Buffer.concat([Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x00]), Buffer.from("garbage garbage")])]]);
ok(r.status === 422, `corrupt RAR handled gracefully (${r.data.error})`);
r = await upload(a, [["x.png", png]], { ...meta, clinicalHistory: "Patient name: John Doe, phone 9876543210, DOB 01/01/1980" });
ok(r.status === 422 && /identifiers/.test(r.data.error), `PHI in text blocked (${r.data.error})`);

r = await upload(a, [["evil.zip", evilZip]]);
ok(r.status === 422 && /unsafe/.test(r.data.error), `path-traversal ZIP rejected (${r.data.error})`);
r = await upload(a, [["bomb.zip", bomb]]);
ok(r.status === 422 && /ratio|limits|no supported/.test(r.data.error), `decompression bomb rejected (${r.data.error})`);
r = await upload(a, [["nested.zip", nestedZip]]);
ok(r.status === 422, `nested archive not expanded (${r.data.error})`);

r = await upload(a, [["case.zip", zip], ["two.dcm", dicom(2)], ["photo.png", png]]);
ok(r.status === 201, `ZIP + DICOM + PNG upload accepted (${r.status})`);
const caseId = r.data.caseId;
console.log("   warnings:", r.data.warnings);

// de-identification verified on stored bytes
const dcmFiles = execSync(`node -e "import('@prisma/client').then(async({PrismaClient})=>{const d=new PrismaClient();const f=await d.caseFile.findMany({where:{caseId:'${caseId}'},orderBy:{position:'asc'}});console.log(JSON.stringify(f.map(x=>({id:x.id,kind:x.kind,key:x.storageKey,name:x.originalName,meta:x.dicomMeta}))));await d.$disconnect()})"`, { cwd: process.cwd() }).toString();
const files = JSON.parse(dcmFiles);
console.log("   stored files:", files.map((f) => `${f.kind}:${f.name}`));
ok(files.filter((f) => f.kind === "IMAGE").length === 2, "ZIP: notes.txt ignored, scan1.png + photo.png kept");
const dicomKeys = files.filter((f) => f.kind === "DICOM");
ok(dicomKeys.length === 2, "2 DICOM files stored");
for (const d of dicomKeys) {
  const raw = process.env.S3_ENDPOINT ? Buffer.from(await (await fetch(`${process.env.S3_ENDPOINT}/${process.env.S3_BUCKET}/${d.key}`)).arrayBuffer()).toString("latin1") : fs.readFileSync(`.storage/${d.key}`).toString("latin1");
  ok(!/DOE|MRN998877|19800101|ACC12345|SECRET HOSPITAL/.test(raw), `DICOM ${d.name}: no PHI bytes remain`);
}
ok(dicomKeys[0].meta.instanceNumber <= dicomKeys[1].meta.instanceNumber, "DICOM slices ordered by instance number");

// review page + submit
let page = await a.f(`/cases/${caseId}/review`);
ok(page.status === 200, "review page renders for author");
r = await a.json(`/api/cases/${caseId}/submit`, "POST", { deidentified: true, authorized: true, noBurnedInText: false, selectedFileIds: files.map((f) => f.id) });
ok(r.status === 422, "submit blocked without all attestations");
r = await a.json(`/api/cases/${caseId}/submit`, "POST", { deidentified: true, authorized: true, noBurnedInText: true, selectedFileIds: files.map((f) => f.id) });
ok(r.status === 200, "submit with attestations -> PENDING_REVIEW");

// not visible before approval
page = await b.f(`/cases/${caseId}`);
ok(!(await page.text()).includes(meta.title), `pending case content not served to other members (HTTP ${page.status})`);
let feed = await (await b.f("/api/cases/feed")).json();
ok(!feed.items.some((i) => i.id === caseId), "pending case not in feed");
r = await b.json(`/api/admin/cases/${caseId}/review`, "POST", { decision: "approve" });
ok(r.status === 403, "regular member cannot approve");
r = await mod.json(`/api/admin/cases/${caseId}/review`, "POST", { decision: "approve" });
ok(r.status === 200, `moderator approves (${r.data.error ?? "ok"})`);

feed = await (await b.f("/api/cases/feed?q=ring-enhancing+brain+CT")).json();
ok(feed.items.some((i) => i.id === caseId), "natural-language search finds the case");
ok(feed.items[0]?.thumbUrl?.startsWith("/api/files/"), "feed item has signed thumbnail URL");
feed = await (await b.f("/api/cases/feed?modality=MRI")).json();
ok(!feed.items.some((i) => i.id === caseId), "modality filter excludes it");

// signed file access
const detail = await b.f(`/cases/${caseId}`);
ok(detail.status === 200, "published case page renders");
const thumb = (await (await b.f("/api/cases/feed")).json()).items.find((i) => i.id === caseId).thumbUrl;
ok((await b.f(thumb)).status === 200, "signed thumbnail readable by member");
ok((await fetch(B + thumb)).status === 401, "signed URL alone (no session) is refused");
ok((await b.f(thumb.replace(/sig=.{6}/, "sig=AAAAAA"))).status === 403, "tampered signature refused");

// engagement: like, bookmark, reveal mode
ok((await b.json(`/api/cases/${caseId}/like`, "POST")).status === 200, "like");
await b.json(`/api/cases/${caseId}/like`, "POST");
ok((await b.json(`/api/cases/${caseId}/bookmark`, "POST")).status === 200, "bookmark");

const obsBody = { findings: "Ring-enhancing lesion in the right frontal lobe with surrounding vasogenic edema.", impression: "Likely abscess vs necrotic tumour.", imagingSigns: ["dual rim sign"], confidence: "MODERATE", differentials: [{ diagnosis: "Brain abscess", rationale: "restricted diffusion centrally" }, { diagnosis: "Glioblastoma" }] };
r = await b.json(`/api/cases/${caseId}/reveal`, "POST", { skip: false });
ok(r.status === 409, "cannot reveal before submitting own observation");
r = await b.json(`/api/cases/${caseId}/observation`, "PUT", obsBody);
ok(r.status === 200, "B submits structured observation");
r = await b.json(`/api/cases/${caseId}/observation`, "PUT", { ...obsBody, impression: "Edited impression" });
ok(r.status === 200, "B edits own observation (no duplicate)");
r = await a.json(`/api/cases/${caseId}/observation`, "PUT", { findings: "Different read: enhancing mass with central necrosis, mass effect.", differentials: [{ diagnosis: "Metastasis" }] });
ok(r.status === 200, "A (author) submits a separate observation");
const cnt = await a.f(`/cases/${caseId}`).then((x) => x.text());
ok(cnt.includes("Edited impression") && cnt.includes("Different read"), "author sees both observations, each attributed (no overwrite)");

// locked state for a fresh member c
const c2 = await client(`c${R}@t.org`, "Dr Gamma Tester");
const lockedHtml = await (await c2.f(`/cases/${caseId}`)).text();
ok(!lockedHtml.includes("Edited impression") && !lockedHtml.includes("Different read"), "other observations NOT in HTML for member who hasn't revealed (server-side gating)");
r = await c2.json(`/api/cases/${caseId}/ai`, "POST", { task: "compare" });
ok(r.status === 503 || r.status === 403, `AI compare locked/unconfigured (${r.status}: ${r.data.error})`);
r = await c2.json(`/api/cases/${caseId}/reveal`, "POST", { skip: true });
ok(r.status === 200, "C skips & reveals");
const unlockedHtml = await (await c2.f(`/cases/${caseId}`)).text();
ok(unlockedHtml.includes("Edited impression"), "after reveal C sees observations");

// helpful, comments, replies, mentions, report
const obsId = (await (await import("node:child_process")).execSync(`node -e "import('@prisma/client').then(async({PrismaClient})=>{const d=new PrismaClient();const o=await d.observation.findFirst({where:{caseId:'${caseId}',author:{email:'b${R}@t.org'}}});console.log(o.id);await d.$disconnect()})"`, { cwd: process.cwd() })).toString().trim();
r = await c2.json(`/api/observations/${obsId}/helpful`, "POST");
ok(r.status === 200, "C marks B's observation helpful");
r = await b.json(`/api/observations/${obsId}/helpful`, "POST");
ok(r.status === 400, "cannot mark own observation helpful");
r = await c2.json(`/api/cases/${caseId}/comments`, "POST", { body: `Nice read @ub${R}! **Check DWI.** <script>alert(1)</script>`, observationId: obsId });
ok(r.status === 201, "C comments on B's observation (with mention)");
const cid = r.data.id;
r = await b.json(`/api/cases/${caseId}/comments`, "POST", { body: "Agreed, thanks.", parentId: cid });
ok(r.status === 201, "B replies in thread");
r = await c2.json(`/api/comments/${cid}/like`, "POST");
ok(r.status === 200, "like comment");
r = await c2.json("/api/reports", "POST", { targetType: "COMMENT", targetId: cid, reason: "Spam" });
ok(r.status === 201, "report comment");
const notifs = await (await b.f("/notifications")).text();
ok(/mentioned you/.test(notifs), "B got a mention notification");
const html = await (await c2.f(`/cases/${caseId}`)).text();
ok(!/<script>alert/.test(html), "raw <script> from markdown is not rendered");

// AI unconfigured behaviour + origin check
r = await b.json(`/api/cases/${caseId}/ai`, "POST", { task: "summarize" });
ok([200, 503].includes(r.status), `AI summarise: ${r.status === 200 ? "works (provider configured)" : "reports not-configured cleanly"}`);
const noOrigin = await fetch(B + `/api/cases/${caseId}/like`, { method: "POST", headers: { cookie: "" } });
ok([401, 403].includes(noOrigin.status), "cross-site style request refused");

// pages
for (const p of ["/home", "/explore", "/explore?q=ring", "/discussions", "/discussions?view=mine", "/learning", "/leaderboard", "/leaderboard?tab=all", "/leaderboard?tab=helpful", "/leaderboard?tab=cases", "/cases/mine", "/cases/new", "/notifications"]) {
  const res = await b.f(p); ok(res.status === 200, `GET ${p} -> ${res.status}`);
}
ok((await mod.f("/admin")).status === 200, "moderator sees /admin");
ok(!(await (await b.f("/admin")).text()).includes("Cases awaiting review"), "member gets no /admin content");
const lb = await (await b.f("/leaderboard?tab=all")).text();
ok(/Dr Beta Tester|Dr Alpha Tester/.test(lb), "leaderboard lists contributors with points");
console.log("done", R);
