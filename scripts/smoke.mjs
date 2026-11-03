// End-to-end smoke test against a running server. Usage: node scripts/smoke.mjs [baseUrl]
import fs from "node:fs";
import path from "node:path";

const base = process.argv[2] ?? "http://localhost:3000";
const jar = new Map();
const cookieHeader = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
function store(res) {
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const [kv] = c.split(";");
    const i = kv.indexOf("=");
    jar.set(kv.slice(0, i), kv.slice(i + 1));
  }
}
async function req(p, init = {}) {
  const res = await fetch(base + p, { ...init, redirect: "manual", headers: { ...(init.headers ?? {}), cookie: cookieHeader() } });
  store(res);
  return res;
}
async function login(email) {
  jar.clear();
  const csrf = await (await req("/api/auth/csrf")).json();
  const body = new URLSearchParams({ csrfToken: csrf.csrfToken, email, password: "Demo1234!", json: "true" });
  const res = await req("/api/auth/callback/credentials", { method: "POST", body, headers: { "content-type": "application/x-www-form-urlencoded" } });
  return res.status;
}
const ok = (c, m) => { console.log(c ? "PASS" : "FAIL", m); if (!c) process.exitCode = 1; };
const json = async (r) => r.json();

ok((await login("recruiter@meridian.example")) < 400, "recruiter login");
const reqs = await (await req("/requisitions")).text();
ok(reqs.includes("Senior Java Developer"), "requisitions page lists seeded role");

const ext = await json(await req("/api/scorecard/extract", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jdText: "Senior Java Developer, 5-8 years, Spring Boot, Microservices, Noida, notice up to 60 days" }) }));
ok(ext.criteria?.length >= 5, `JD extraction returned ${ext.criteria?.length} criteria (${ext.source})`);

const clientsHtml = await (await req("/requisitions/new")).text();
const clientId = clientsHtml.match(/value=\\?"([a-z0-9]{25})\\?"[^>]*>Ashford Bank/)?.[1];
ok(!!clientId, "found Ashford client id in form");

const created = await json(await req("/api/requisitions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
  clientId, title: `Smoke Java ${Date.now()}`, jdText: "x", location: "Noida", minExpYears: 5, maxExpYears: 8, noticeMaxDays: 60, ctcMaxLpa: 28, criteria: ext.criteria }) }));
ok(!!created.id, "requisition created");

const dir = path.join(process.cwd(), "public", "samples");
const ids = [];
for (const f of ["ritika-bansal.pdf", "arjun-rawat.pdf", "pooja-nair.pdf", "kabir-anand-injection.pdf", "naina-gupta.docx"]) {
  const fd = new FormData();
  fd.append("consent", "true");
  fd.append("file", new Blob([fs.readFileSync(path.join(dir, f))]), f);
  const r = await json(await req(`/api/requisitions/${created.id}/applications`, { method: "POST", body: fd }));
  ok(r.status === "PENDING", `uploaded ${f}`);
  ids.push([f, r.applicationId]);
}
// duplicate upload
{
  const fd = new FormData();
  fd.append("consent", "true");
  fd.append("file", new Blob([fs.readFileSync(path.join(dir, "ritika-bansal-copy.pdf"))]), "copy.pdf");
  const r = await json(await req(`/api/requisitions/${created.id}/applications`, { method: "POST", body: fd }));
  ok(r.status === "DUPLICATE", "exact duplicate file is flagged");
}
// no consent
{
  const fd = new FormData();
  fd.append("file", new Blob([fs.readFileSync(path.join(dir, "ritika-bansal.pdf"))]), "x.pdf");
  const r = await req(`/api/requisitions/${created.id}/applications`, { method: "POST", body: fd });
  ok(r.status === 400, "upload without consent rejected");
}
// bad type
{
  const fd = new FormData();
  fd.append("consent", "true");
  fd.append("file", new Blob(["MZ not a pdf"]), "evil.pdf");
  const r = await req(`/api/requisitions/${created.id}/applications`, { method: "POST", body: fd });
  ok(r.status === 415, "non-PDF/DOCX bytes rejected by magic-byte check");
}

const results = {};
for (const [f, id] of ids) {
  const r = await json(await req(`/api/applications/${id}/process`, { method: "POST" }));
  results[f] = r;
  console.log("  ", f, r.status, r.overallScore ?? r.reasons?.join("; ") ?? r.message);
}
const scoreOf = (f) => results[f].overallScore ?? -1;
ok(scoreOf("ritika-bansal.pdf") > scoreOf("pooja-nair.pdf"), "Ritika (strong Java fit) outranks Pooja");
ok(scoreOf("ritika-bansal.pdf") > scoreOf("arjun-rawat.pdf"), "Ritika outranks KYC analyst for a Java role");
ok(scoreOf("kabir-anand-injection.pdf") < 40, "prompt-injection CV does not get a high score");

const ritika = ids.find(([f]) => f === "ritika-bansal.pdf")[1];
const submitEarly = await req(`/api/applications/${ritika}/submit`, { method: "POST" });
ok(submitEarly.status === 400, "submit before viewing is blocked server-side");
const detail = await json(await req(`/api/applications/${ritika}`));
ok(detail.scores.some((s) => s.evidenceQuote), "detail has grounded evidence quotes");
ok(!JSON.stringify(detail.scores).includes("Date of Birth"), "no protected data in evidence");
await req(`/api/applications/${ritika}/view`, { method: "POST" });
const submit = await req(`/api/applications/${ritika}/submit`, { method: "POST" });
ok(submit.status === 200, "submit succeeds after viewing");

const page = await (await req(`/requisitions/${created.id}`)).text();
ok(page.includes("Ritika"), "ranked list shows candidates");

// client isolation
await login("hiring@velaretail.example");
const asClient = await req(`/api/applications/${ritika}`);
ok(asClient.status === 404, "other client gets 404 for Ritika");
const rec = await req("/api/metrics");
ok(rec.status === 404, "client cannot read recruiter metrics (404)");
const files = await req(`/api/files/${ritika}`);
ok(files.status === 404, "other client cannot stream the CV (404)");
await login("hiring@ashfordbank.example");
const own = await json(await req(`/api/applications/${ritika}`));
ok(own.maskedEmail && !JSON.stringify(own).includes("@example.com"), `owning client sees masked contact only (${own.maskedEmail})`);
console.log(process.exitCode ? "\nSOME CHECKS FAILED" : "\nALL CHECKS PASSED");

// ---- Day 5-6: pipeline, portal, consent, deletion ----
await login("recruiter@meridian.example");
const R2 = await json(await req("/api/requisitions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
  clientId, title: `Smoke2 ${Date.now()}`, jdText: "x", location: "Noida", minExpYears: 5, maxExpYears: 8, noticeMaxDays: 60, ctcMaxLpa: 28, criteria: ext.criteria }) }));
const up = async (f) => {
  const fd = new FormData(); fd.append("consent", "true"); fd.append("file", new Blob([fs.readFileSync(path.join(dir, f))]), f);
  return (await json(await req(`/api/requisitions/${R2.id}/applications`, { method: "POST", body: fd }))).applicationId;
};
const [a1, a2, a3] = [await up("ritika-bansal.pdf"), await up("dev-malhotra.pdf"), await up("naina-gupta.docx")];
for (const id of [a1, a2, a3]) await req(`/api/applications/${id}/process`, { method: "POST" });

const mv = (id, stage) => req(`/api/applications/${id}/stage`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ stage }) });
ok((await mv(a1, "INTERVIEW")).status === 400, "cannot jump to Interview without opening the CV");
await req(`/api/applications/${a1}/view`, { method: "POST" });
await req(`/api/applications/${a2}/view`, { method: "POST" });
ok((await mv(a1, "SHORTLISTED")).status === 200, "move to Shortlisted after viewing");
ok((await mv(a1, "REJECTED")).status === 400, "rejecting via stage route is refused (needs a reason)");
ok((await req(`/api/applications/${a1}/submit`, { method: "POST" })).status === 200, "submit a1");
ok((await req(`/api/applications/${a2}/submit`, { method: "POST" })).status === 200, "submit a2");
const rj = await req(`/api/applications/${a3}/reject`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason: "Skills mismatch" }) });
ok(rj.status === 200, "recruiter reject with reason");

await req(`/api/applications/${a3}/view`, { method: "POST" });
const cand3 = (await json(await req(`/api/applications/${a3}`))).candidateId;
ok((await req(`/api/candidates/${cand3}/consent`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "WITHDRAWN" }) })).status === 400, "withdrawal needs a note");
ok((await req(`/api/candidates/${cand3}/consent`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "WITHDRAWN", note: "emailed" }) })).status === 200, "consent withdrawn");
ok((await req(`/api/applications/${a3}/submit`, { method: "POST" })).status === 400, "withdrawn candidate cannot be submitted");

await login("hiring@ashfordbank.example");
const home = await (await req("/portal")).text();
ok(home.includes("Smoke2"), "portal lists the shared requisition");
const rev = await (await req(`/portal/${R2.id}`)).text();
ok(rev.includes("Ritika") && !rev.includes("Naina"), "portal shows only submitted candidates");
ok(!/ritika\.bansal@example\.com/i.test(rev) && /r•••@e•••\.com/.test(rev), "portal HTML has masked contact only");
const dec = (id, b) => req(`/api/portal/applications/${id}/decision`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
ok((await dec(a3, { decision: "SHORTLIST" })).status === 404, "client cannot act on an unsubmitted candidate (404)");
ok((await dec(a1, { decision: "REJECT" })).status === 400, "reject requires a reason");
ok((await dec(a1, { decision: "SHORTLIST" })).status === 200, "client shortlists");
ok((await dec(a2, { decision: "PROPOSE_SLOT", slots: [{ date: "2026-12-01", time: "11:00", tz: "IST" }] })).status === 200, "client proposes a slot");
await login("hiring@velaretail.example");
ok((await req(`/portal/${R2.id}`)).status === 404, "other client gets 404 on the portal page");
ok((await dec(a1, { decision: "SHORTLIST" })).status === 404, "other client cannot decide (404)");

await login("recruiter@meridian.example");
const pipe = await (await req(`/requisitions/${R2.id}/pipeline`)).text();
ok(pipe.includes("Client shortlisted") && pipe.includes("Slot proposed"), "pipeline shows client decisions");
ok((await req(`/api/candidates/${cand3}/delete`, { method: "POST" })).status === 400, "delete needs a recorded request");
ok((await req(`/api/candidates/${cand3}/deletion-request`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })).status === 201, "deletion request recorded");
ok((await req(`/api/candidates/${cand3}/delete`, { method: "POST" })).status === 200, "deletion processed");
ok((await req(`/api/files/${a3}`)).status === 404, "deleted CV file is gone");
const fair = await (await req("/requisitions?tab=fairness")).text();
ok(fair.includes("Access log") && fair.includes("Consent and deletion queue"), "fairness & audit tab renders");
console.log(process.exitCode ? "\nSOME CHECKS FAILED (incl. day 5-6)" : "\nALL DAY 5-6 CHECKS PASSED");
