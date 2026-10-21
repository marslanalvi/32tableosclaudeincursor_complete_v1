// Builds the TableOS test plan from docs/testing/test-cases.mjs:
//   TableOS-Test-Plan.md        readable plan with checkboxes
//   TableOS-Test-Plan.pdf       printable plan (via a print HTML and headless Chrome)
//   TableOS-Test-Workbook.html  interactive workbook: status, notes, screenshots, export for the developer
// Run from the repo root: node docs/testing/build-test-docs.mjs
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { ACCOUNTS, APP_VERSION, DATA, MODULES, PLAN_VERSION } from "./test-cases.mjs";

const dir = path.resolve("docs/testing");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const cases = MODULES.flatMap((m) =>
  m.cases.map(([title, steps, expected, priority, kind], i) => ({
    id: `${m.id}-${String(i + 1).padStart(2, "0")}`,
    module: m.id,
    title,
    steps,
    expected,
    priority,
    kind,
  })),
);
const byPriority = (p) => cases.filter((c) => c.priority === p).length;
const today = new Date().toISOString().slice(0, 10);

const HOW_TO = [
  "Work module by module (M00 first). Each module is independent once M00 is done.",
  "For every case: follow the steps, compare with Expected, then mark Pass, Fail, Blocked (can’t run it because something else is broken) or N/A (feature not used).",
  "For a failure: pick a severity, write what actually happened (and what you expected), and attach screenshots (paste with Ctrl+V, drag in, or choose files).",
  "Priority: P1 must work (blocker if broken), P2 important, P3 polish.",
  "Use the interactive workbook (TableOS-Test-Workbook.html): it saves automatically in your browser. When done (or at any point), click “Export for developer” and send that one file; it contains every result, note and screenshot.",
  "Found a problem no case covers? Add it under “Other findings” at the end of the workbook.",
];
const SEVERITY = [
  ["Critical", "Data loss, security hole, or nobody can work."],
  ["High", "A main feature is broken with no workaround."],
  ["Medium", "Broken but there is a workaround, or a secondary feature fails."],
  ["Low", "Cosmetic, wording, small inconvenience."],
];

/* ---------------------------------------------------------------- Markdown */
function markdown() {
  const out = [];
  out.push(`# TableOS — Complete Test Plan`, ``, `Plan ${PLAN_VERSION} · for TableOS ${APP_VERSION} · generated ${today} · ${MODULES.length} modules · ${cases.length} test cases (P1 ${byPriority("P1")}, P2 ${byPriority("P2")}, P3 ${byPriority("P3")})`, ``);
  out.push(`Use **TableOS-Test-Workbook.html** to record results and screenshots, then **Export for developer**. This file and the PDF are the same plan for reading or printing.`, ``);
  out.push(`## How to test`, ``, ...HOW_TO.map((h, i) => `${i + 1}. ${h}`), ``);
  out.push(`## Severity`, ``, `| Severity | Meaning |`, `|---|---|`, ...SEVERITY.map(([a, b]) => `| ${a} | ${b} |`), ``);
  out.push(`## Test accounts`, ``, `| Name | Account | How to set it up |`, `|---|---|---|`, ...ACCOUNTS.map((a) => `| ${a[0]} | ${a[1]} | ${a[2]} |`), ``);
  out.push(`## Test data`, ``, `| Name | What |`, `|---|---|`, ...DATA.map((d) => `| ${d[0]} | ${d[1]} |`), ``);
  out.push(`## Modules`, ``, `| Module | Cases | P1 |`, `|---|---|---|`, ...MODULES.map((m) => `| ${m.id} ${m.title} | ${m.cases.length} | ${m.cases.filter((c) => c[3] === "P1").length} |`), ``);
  for (const m of MODULES) {
    out.push(`---`, ``, `## ${m.id} — ${m.title}`, ``, `**Goal:** ${m.goal}`, ``);
    if (m.setup.length) out.push(`**Before you start:**`, ``, ...m.setup.map((s) => `- ${s}`), ``);
    for (const c of cases.filter((x) => x.module === m.id)) {
      out.push(`### ${c.id} · ${c.title}  \`${c.priority}\` \`${c.kind}\``, ``);
      out.push(`**Steps**`, ``, ...c.steps.map((s, i) => `${i + 1}. ${s}`), ``);
      out.push(`**Expected:** ${c.expected}`, ``);
      out.push(`**Result:** ☐ Pass ☐ Fail ☐ Blocked ☐ N/A · **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low`, ``);
      out.push(`**What happened / notes:**`, ``, `> `, ``, `**Screenshots:** (paste or attach in the workbook)`, ``);
    }
  }
  out.push(`---`, ``, `## Other findings`, ``, `Anything not covered above: what, where, steps, expected, actual, severity, screenshots.`, ``);
  return out.join("\n");
}

/* ---------------------------------------------------------------- Print HTML (PDF) */
function printHtml() {
  const rows = (arr) => arr.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("");
  const mods = MODULES.map((m) => {
    const list = cases.filter((x) => x.module === m.id);
    return `<section class="mod"><h2>${m.id} — ${esc(m.title)}</h2><p class="goal"><b>Goal:</b> ${esc(m.goal)}</p>
      ${m.setup.length ? `<div class="setup"><b>Before you start</b><ul>${m.setup.map((s) => `<li>${esc(s)}</li>`).join("")}</ul></div>` : ""}
      ${list.map((c) => `<div class="case"><div class="ch"><span class="cid">${c.id}</span> <b>${esc(c.title)}</b><span class="tag p${c.priority.slice(1)}">${c.priority}</span><span class="tag">${c.kind}</span></div>
        <ol>${c.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
        <div class="exp"><b>Expected:</b> ${esc(c.expected)}</div>
        <div class="res">☐ Pass &nbsp; ☐ Fail &nbsp; ☐ Blocked &nbsp; ☐ N/A &nbsp;&nbsp;|&nbsp;&nbsp; Severity: ☐ Critical ☐ High ☐ Medium ☐ Low</div>
        <div class="notes">Notes / what happened / screenshot file names:</div></div>`).join("")}</section>`;
  }).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>TableOS — Complete Test Plan</title><style>
  *{box-sizing:border-box} body{font-family:"Segoe UI",Inter,Arial,sans-serif;color:#1d2330;font-size:9.6pt;line-height:1.4;margin:0}
  h1{font-size:24pt;margin:0 0 6px} h2{font-size:14pt;margin:18px 0 6px;padding-bottom:3px;border-bottom:2px solid #1d2330;page-break-after:avoid}
  table{width:100%;border-collapse:collapse;margin:6px 0 12px;font-size:8.8pt} td,th{border:1px solid #d9dde4;padding:4px 6px;text-align:left;vertical-align:top} th{background:#eef1f5}
  .cover{page-break-after:always;padding-top:60mm} .sub{font-size:12pt;color:#4a5263} .meta{margin-top:30mm;color:#4a5263}
  .mod{page-break-before:always} .goal{margin:4px 0 8px} .setup{background:#f3f7ff;border:1px solid #c9dafb;border-radius:6px;padding:6px 10px;margin-bottom:8px} .setup ul{margin:4px 0 0 16px;padding:0}
  .case{border:1px solid #d9dde4;border-radius:6px;padding:7px 10px;margin:7px 0;page-break-inside:avoid}
  .ch{margin-bottom:3px} .cid{font-family:Consolas,monospace;color:#4a5263} .tag{display:inline-block;margin-left:6px;font-size:7.6pt;padding:0 6px;border-radius:8px;background:#eef1f5;color:#3d4555}
  .tag.p1{background:#b42318;color:#fff} .tag.p2{background:#d9480f;color:#fff} .tag.p3{background:#5b6472;color:#fff}
  ol{margin:3px 0 3px 18px;padding:0} .exp{margin:3px 0;background:#f2faf4;border-left:3px solid #0f7b3f;padding:3px 7px}
  .res{margin-top:5px;font-size:8.8pt} .notes{margin-top:4px;height:30px;border-bottom:1px dotted #9aa1ad;color:#8a919c;font-size:8pt}
  </style></head><body>
  <div class="cover"><h1>TableOS — Complete Test Plan</h1><div class="sub">Every feature, role, limit and API, in ${MODULES.length} modules you can test one by one</div>
  <div class="meta">Plan ${PLAN_VERSION} · for TableOS ${APP_VERSION} · generated ${today}<br/>${cases.length} test cases: P1 ${byPriority("P1")} · P2 ${byPriority("P2")} · P3 ${byPriority("P3")}<br/><br/>Record results and screenshots in <b>TableOS-Test-Workbook.html</b>, then use <b>Export for developer</b>.</div></div>
  <h2>How to test</h2><ol>${HOW_TO.map((h) => `<li>${esc(h)}</li>`).join("")}</ol>
  <h2>Severity</h2><table><tr><th>Severity</th><th>Meaning</th></tr>${rows(SEVERITY)}</table>
  <h2>Test accounts</h2><table><tr><th>Name</th><th>Account</th><th>How to set it up</th></tr>${rows(ACCOUNTS)}</table>
  <h2>Test data</h2><table><tr><th>Name</th><th>What</th></tr>${rows(DATA)}</table>
  <h2>Modules</h2><table><tr><th>Module</th><th>Goal</th><th>Cases</th><th>P1</th></tr>${MODULES.map((m) => `<tr><td>${m.id} ${esc(m.title)}</td><td>${esc(m.goal)}</td><td>${m.cases.length}</td><td>${m.cases.filter((c) => c[3] === "P1").length}</td></tr>`).join("")}</table>
  ${mods}
  <section class="mod"><h2>Other findings</h2><p>Anything not covered above: what, where, steps, expected, actual, severity, screenshots.</p>${'<div class="notes" style="height:60px"></div>'.repeat(8)}</section>
  </body></html>`;
}

/* ---------------------------------------------------------------- Interactive workbook */
function workbook() {
  const payload = JSON.stringify({ planVersion: PLAN_VERSION, appVersion: APP_VERSION, generated: today, accounts: ACCOUNTS, data: DATA, howTo: HOW_TO, severity: SEVERITY, modules: MODULES.map((m) => ({ id: m.id, title: m.title, goal: m.goal, setup: m.setup })), cases });
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>TableOS Test Workbook</title>
<style>
:root{--b:#d9dde4;--mut:#5b6472;--pass:#0f7b3f;--fail:#b42318;--block:#b7791f;--na:#6b7280}
*{box-sizing:border-box} body{margin:0;font-family:"Segoe UI",Inter,Arial,sans-serif;color:#1d2330;font-size:14px;background:#f6f7f9}
header{position:sticky;top:0;z-index:5;background:#fff;border-bottom:1px solid var(--b);padding:10px 16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
header h1{font-size:17px;margin:0 12px 0 0} header input{border:1px solid var(--b);border-radius:6px;padding:5px 8px;font:inherit;width:140px}
button{font:inherit;cursor:pointer;border:1px solid var(--b);background:#fff;border-radius:6px;padding:5px 10px} button.primary{background:#1d2330;color:#fff;border-color:#1d2330}
.layout{display:grid;grid-template-columns:270px 1fr;min-height:calc(100vh - var(--hh,60px))}
nav{border-right:1px solid var(--b);background:#fff;padding:10px;position:sticky;top:var(--hh,60px);height:calc(100vh - var(--hh,60px));overflow:auto} .mod,.case{scroll-margin-top:calc(var(--hh,60px) + 10px)}
nav a{display:flex;justify-content:space-between;gap:6px;padding:6px 8px;border-radius:6px;color:inherit;text-decoration:none;font-size:13px} nav a:hover,nav a.on{background:#eef1f5}
nav .cnt{color:var(--mut);font-size:12px;white-space:nowrap} nav .bad{color:var(--fail);font-weight:600}
main{padding:16px 22px;max-width:1100px}
.summary{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px} .pill{background:#fff;border:1px solid var(--b);border-radius:8px;padding:8px 12px;min-width:110px} .pill b{display:block;font-size:20px}
.filters{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:8px 0 14px} .filters select,.filters input{font:inherit;padding:5px 8px;border:1px solid var(--b);border-radius:6px}
.mod{margin-bottom:22px} .mod h2{font-size:18px;margin:10px 0 2px} .goal{color:var(--mut);margin:0 0 6px}
.setup{background:#f3f7ff;border:1px solid #c9dafb;border-radius:8px;padding:6px 12px;margin:6px 0 10px;font-size:13px}
.case{background:#fff;border:1px solid var(--b);border-radius:10px;padding:10px 14px;margin:8px 0}
.case[data-status=pass]{border-left:5px solid var(--pass)} .case[data-status=fail]{border-left:5px solid var(--fail)} .case[data-status=blocked]{border-left:5px solid var(--block)} .case[data-status=na]{border-left:5px solid var(--na);opacity:.85}
.ch{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap} .cid{font-family:Consolas,monospace;color:var(--mut)} .tag{font-size:11px;padding:1px 7px;border-radius:9px;background:#eef1f5}
.tag.P1{background:#b42318;color:#fff} .tag.P2{background:#d9480f;color:#fff} .tag.P3{background:#5b6472;color:#fff}
.case ol{margin:6px 0 6px 20px;padding:0} .exp{background:#f2faf4;border-left:3px solid var(--pass);padding:5px 9px;margin:6px 0;font-size:13px}
.st{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0} .st button.on[data-v=pass]{background:var(--pass);color:#fff} .st button.on[data-v=fail]{background:var(--fail);color:#fff} .st button.on[data-v=blocked]{background:var(--block);color:#fff} .st button.on[data-v=na]{background:var(--na);color:#fff} .st button.on[data-v=""]{background:#eef1f5}
.st select{font:inherit;padding:4px 6px;border:1px solid var(--b);border-radius:6px}
textarea{width:100%;min-height:58px;font:inherit;border:1px solid var(--b);border-radius:6px;padding:6px 8px;resize:vertical}
.drop{margin-top:6px;border:1.5px dashed #aab1bd;border-radius:8px;padding:8px;color:var(--mut);font-size:12.5px;outline:none} .drop:focus,.drop.over{border-color:#1d2330;background:#f6f7f9}
.thumbs{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px} .thumbs figure{margin:0;position:relative} .thumbs img{height:90px;border:1px solid var(--b);border-radius:6px;cursor:zoom-in;display:block}
.thumbs button{position:absolute;top:2px;right:2px;padding:0 6px;font-size:12px}
.saved{color:var(--mut);font-size:12px} dialog{border:none;border-radius:10px;padding:0;max-width:92vw} dialog img{max-width:92vw;max-height:88vh;display:block}
details.intro{background:#fff;border:1px solid var(--b);border-radius:10px;padding:8px 14px;margin-bottom:12px} details.intro table{border-collapse:collapse;margin:6px 0;font-size:13px} details.intro td,details.intro th{border:1px solid var(--b);padding:3px 7px;text-align:left}
.hidden{display:none}
</style></head><body>
<header>
  <h1>TableOS Test Workbook</h1>
  <input id="m-tester" placeholder="Tester name">
  <input id="m-env" placeholder="Environment URL">
  <input id="m-version" placeholder="TableOS version">
  <input id="m-browser" placeholder="Browser / device">
  <span style="flex:1"></span>
  <span class="saved" id="saved">Saved in this browser</span>
  <button class="primary" id="export-json" title="One file with every result, note and screenshot, for the developer">Export for developer</button>
  <button id="export-html" title="A readable report to share">Export report</button>
  <button id="import" title="Load an exported file (e.g. on another computer)">Import</button>
  <input type="file" id="import-file" accept=".json,application/json" class="hidden">
</header>
<div class="layout"><nav id="nav"></nav><main id="main"></main></div>
<dialog id="zoom"><img id="zoom-img" alt=""></dialog>
<script id="plan" type="application/json">${payload.replace(/</g, "\\u003c")}</script>
<script>
const PLAN = JSON.parse(document.getElementById("plan").textContent);
const STATUSES = [["", "Not run"], ["pass", "Pass"], ["fail", "Fail"], ["blocked", "Blocked"], ["na", "N/A"]];
const SEVS = ["", "Critical", "High", "Medium", "Low"];
const OTHER_PREFIX = "OTHER-";
let state = { meta: {}, results: {}, others: [] };

/* ---- storage: IndexedDB (screenshots are too big for localStorage) ---- */
const DB = "tableos-test-workbook", STORE = "kv";
function idb() { return new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function load() { const db = await idb(); return new Promise((res) => { const t = db.transaction(STORE).objectStore(STORE).get("state"); t.onsuccess = () => res(t.result || null); t.onerror = () => res(null); }); }
let saveTimer = null;
function save() { clearTimeout(saveTimer); document.getElementById("saved").textContent = "Saving…"; saveTimer = setTimeout(async () => { const db = await idb(); const tx = db.transaction(STORE, "readwrite"); tx.objectStore(STORE).put(state, "state"); tx.oncomplete = () => { document.getElementById("saved").textContent = "Saved " + new Date().toLocaleTimeString(); renderNav(); renderSummary(); }; }, 300); }

/* ---- images: downscale to keep the export small ---- */
function readImage(file) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => { const img = new Image(); img.onload = () => { const max = 1600; const k = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); res({ name: file.name || "screenshot.png", data: c.toDataURL("image/jpeg", 0.85), at: new Date().toISOString() }); }; img.onerror = rej; img.src = fr.result; };
    fr.onerror = rej; fr.readAsDataURL(file);
  });
}
function result(id) { return (state.results[id] ||= { status: "", severity: "", notes: "", images: [] }); }

/* ---- rendering ---- */
const el = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k === "class") e.className = v; else if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else if (v !== undefined && v !== null) e.setAttribute(k, v); } for (const k of kids.flat()) e.append(k?.nodeType ? k : document.createTextNode(k ?? "")); return e; };
function counts(list) { const c = { total: list.length, pass: 0, fail: 0, blocked: 0, na: 0, run: 0, p1fail: 0 }; for (const x of list) { const r = state.results[x.id]; const s = r?.status || ""; if (s) { c[s]++; c.run++; } if (s === "fail" && x.priority === "P1") c.p1fail++; } return c; }
function renderNav() {
  const nav = document.getElementById("nav"); nav.innerHTML = "";
  nav.append(el("a", { href: "#intro" }, "How to test", ""));
  for (const m of PLAN.modules) { const c = counts(PLAN.cases.filter((x) => x.module === m.id)); nav.append(el("a", { href: "#" + m.id }, el("span", {}, m.id + " " + m.title), el("span", { class: "cnt" + (c.fail ? " bad" : "") }, c.run + "/" + c.total + (c.fail ? " · " + c.fail + "✗" : "")))); }
  nav.append(el("a", { href: "#other" }, "Other findings", el("span", { class: "cnt" }, String(state.others.length))));
}
function renderSummary() {
  const c = counts(PLAN.cases); const box = document.getElementById("summary"); if (!box) return; box.innerHTML = "";
  for (const [label, n] of [["Run", c.run + " / " + c.total], ["Pass", c.pass], ["Fail", c.fail], ["P1 failures", c.p1fail], ["Blocked", c.blocked], ["N/A", c.na], ["Other findings", state.others.length]]) box.append(el("div", { class: "pill" }, el("b", {}, String(n)), label));
}
function caseCard(c, isOther = false) {
  const r = isOther ? c : result(c.id);
  const card = el("div", { class: "case", id: c.id, "data-status": r.status || "" });
  const head = isOther
    ? el("div", { class: "ch" }, el("span", { class: "cid" }, c.id), el("input", { value: c.title || "", placeholder: "Short title of the problem", style: "flex:1;font:inherit;border:1px solid #d9dde4;border-radius:6px;padding:4px 8px", oninput: (e) => { c.title = e.target.value; save(); } }), el("button", { onclick: () => { if (confirm("Remove this finding?")) { state.others = state.others.filter((o) => o !== c); save(); render(); } } }, "Remove"))
    : el("div", { class: "ch" }, el("span", { class: "cid" }, c.id), el("b", {}, c.title), el("span", { class: "tag " + c.priority }, c.priority), el("span", { class: "tag" }, c.kind));
  card.append(head);
  if (!isOther) { card.append(el("ol", {}, c.steps.map((s) => el("li", {}, s)))); card.append(el("div", { class: "exp" }, el("b", {}, "Expected: "), c.expected)); }
  const st = el("div", { class: "st" });
  for (const [v, label] of STATUSES) { if (isOther && v === "na") continue; const b = el("button", { "data-v": v, class: (r.status || "") === v ? "on" : "", onclick: () => { r.status = v; card.dataset.status = v; st.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x.dataset.v === v)); sev.style.display = v === "fail" || isOther ? "" : "none"; save(); } }, label); st.append(b); }
  const sev = el("select", { title: "Severity", onchange: (e) => { r.severity = e.target.value; save(); } }, SEVS.map((s) => { const o = el("option", { value: s }, s || "Severity…"); if (s === (r.severity || "")) o.selected = true; return o; }));
  sev.style.display = r.status === "fail" || isOther ? "" : "none"; st.append(sev);
  card.append(st);
  const ta = el("textarea", { placeholder: isOther ? "Where, steps to reproduce, what you expected, what happened" : "What happened (for a failure: what you saw vs. what you expected, any error message)", oninput: (e) => { r.notes = e.target.value; save(); } }); ta.value = r.notes || ""; card.append(ta);
  const thumbs = el("div", { class: "thumbs" });
  const drawThumbs = () => { thumbs.innerHTML = ""; (r.images || []).forEach((im, i) => thumbs.append(el("figure", {}, el("img", { src: im.data, alt: im.name, title: im.name, onclick: () => { document.getElementById("zoom-img").src = im.data; document.getElementById("zoom").showModal(); } }), el("button", { title: "Remove", onclick: () => { r.images.splice(i, 1); drawThumbs(); save(); } }, "×")))); };
  const addFiles = async (files) => { for (const f of files) if (f.type.startsWith("image/")) { (r.images ||= []).push(await readImage(f)); } drawThumbs(); save(); };
  const picker = el("input", { type: "file", accept: "image/*", multiple: "", class: "hidden", onchange: (e) => addFiles(e.target.files) });
  const drop = el("div", { class: "drop", tabindex: "0", title: "Click here, then Ctrl+V to paste a screenshot",
    onpaste: (e) => { const files = [...e.clipboardData.items].filter((i) => i.type.startsWith("image/")).map((i) => i.getAsFile()); if (files.length) { e.preventDefault(); addFiles(files); } },
    ondragover: (e) => { e.preventDefault(); drop.classList.add("over"); }, ondragleave: () => drop.classList.remove("over"),
    ondrop: (e) => { e.preventDefault(); drop.classList.remove("over"); addFiles(e.dataTransfer.files); } },
    "📷 Screenshots: click here and press Ctrl+V to paste, drag images here, or ", el("a", { href: "#", onclick: (e) => { e.preventDefault(); picker.click(); } }, "choose files"), picker);
  card.append(drop, thumbs); drawThumbs();
  return card;
}
let filters = { status: "all", priority: "all", q: "" };
function visible(c) { const s = state.results[c.id]?.status || ""; if (filters.status !== "all" && (filters.status === "todo" ? s !== "" : s !== filters.status)) return false; if (filters.priority !== "all" && c.priority !== filters.priority) return false; if (filters.q && !(c.id + " " + c.title + " " + c.steps.join(" ") + " " + c.expected).toLowerCase().includes(filters.q)) return false; return true; }
function render() {
  const main = document.getElementById("main"); main.innerHTML = "";
  const intro = el("details", { class: "intro", id: "intro", open: Object.keys(state.results).length ? null : "" }, el("summary", {}, el("b", {}, "How to test, accounts and test data")),
    el("ol", {}, PLAN.howTo.map((h) => el("li", {}, h))),
    el("table", {}, el("tr", {}, el("th", {}, "Severity"), el("th", {}, "Meaning")), PLAN.severity.map((s) => el("tr", {}, el("td", {}, s[0]), el("td", {}, s[1])))),
    el("table", {}, el("tr", {}, el("th", {}, "Account"), el("th", {}, "Type"), el("th", {}, "Set up")), PLAN.accounts.map((a) => el("tr", {}, a.map((x) => el("td", {}, x))))),
    el("table", {}, el("tr", {}, el("th", {}, "Data"), el("th", {}, "What")), PLAN.data.map((a) => el("tr", {}, a.map((x) => el("td", {}, x))))));
  main.append(el("div", { class: "summary", id: "summary" }), intro);
  const statusSel = el("select", { onchange: (e) => { filters.status = e.target.value; render(); } }, [["all", "All cases"], ["todo", "Not run yet"], ["pass", "Passed"], ["fail", "Failed"], ["blocked", "Blocked"], ["na", "N/A"]].map(([v, l]) => { const o = el("option", { value: v }, l); if (filters.status === v) o.selected = true; return o; }));
  const prSel = el("select", { onchange: (e) => { filters.priority = e.target.value; render(); } }, [["all", "All priorities"], ["P1", "P1 only"], ["P2", "P2 only"], ["P3", "P3 only"]].map(([v, l]) => { const o = el("option", { value: v }, l); if (filters.priority === v) o.selected = true; return o; }));
  const q = el("input", { placeholder: "Search cases…", value: filters.q, oninput: (e) => { filters.q = e.target.value.toLowerCase(); clearTimeout(q.t); q.t = setTimeout(render, 250); } });
  main.append(el("div", { class: "filters" }, statusSel, prSel, q, el("span", { class: "saved" }, PLAN.cases.length + " cases · plan " + PLAN.planVersion + " for TableOS " + PLAN.appVersion)));
  for (const m of PLAN.modules) {
    const list = PLAN.cases.filter((c) => c.module === m.id && visible(c)); if (!list.length) continue;
    const sec = el("section", { class: "mod", id: m.id }, el("h2", {}, m.id + " — " + m.title), el("p", { class: "goal" }, m.goal));
    if (m.setup.length) sec.append(el("div", { class: "setup" }, el("b", {}, "Before you start"), el("ul", {}, m.setup.map((s) => el("li", {}, s)))));
    list.forEach((c) => sec.append(caseCard(c))); main.append(sec);
  }
  const other = el("section", { class: "mod", id: "other" }, el("h2", {}, "Other findings"), el("p", { class: "goal" }, "Problems no case covers: add one per problem."));
  state.others.forEach((o) => other.append(caseCard(o, true)));
  other.append(el("button", { onclick: () => { state.others.push({ id: OTHER_PREFIX + String(state.others.length + 1).padStart(2, "0"), title: "", status: "fail", severity: "", notes: "", images: [] }); save(); render(); location.hash = "#other"; } }, "+ Add a finding"));
  main.append(other); renderNav(); renderSummary();
}

/* ---- export / import ---- */
function download(name, text, type) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
function stamp() { return new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-"); }
function exportJson() {
  const c = counts(PLAN.cases);
  const out = { kind: "tableos-test-results", planVersion: PLAN.planVersion, appVersionPlanned: PLAN.appVersion, exportedAt: new Date().toISOString(), meta: state.meta,
    summary: { total: c.total, run: c.run, pass: c.pass, fail: c.fail, blocked: c.blocked, na: c.na, p1Failures: c.p1fail, otherFindings: state.others.length },
    results: PLAN.cases.map((x) => ({ id: x.id, module: x.module, title: x.title, priority: x.priority, kind: x.kind, steps: x.steps, expected: x.expected, ...(state.results[x.id] || { status: "", severity: "", notes: "", images: [] }) })),
    otherFindings: state.others };
  download("tableos-test-results-" + stamp() + ".json", JSON.stringify(out, null, 1), "application/json");
}
function exportHtml() {
  const c = counts(PLAN.cases); const e = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const rowsOf = (list) => list.map((x) => { const r = state.results[x.id] || x; return '<div class="c ' + (r.status || "") + '"><h3>' + e(x.id) + " · " + e(x.title) + " <small>" + e(x.priority || "") + " · " + e((STATUSES.find((s) => s[0] === (r.status || "")) || [])[1]) + (r.severity ? " · " + e(r.severity) : "") + "</small></h3>" + (x.expected ? "<p><b>Expected:</b> " + e(x.expected) + "</p>" : "") + (r.notes ? "<p><b>What happened:</b> " + e(r.notes).replace(/\\n/g, "<br>") + "</p>" : "") + (r.images || []).map((im) => '<img src="' + im.data + '">').join("") + "</div>"; }).join("");
  const problems = PLAN.cases.filter((x) => ["fail", "blocked"].includes(state.results[x.id]?.status));
  const html = '<!doctype html><meta charset="utf-8"><title>TableOS test report</title><style>body{font-family:Segoe UI,Arial;max-width:1000px;margin:20px auto;color:#1d2330} .c{border:1px solid #d9dde4;border-radius:8px;padding:8px 12px;margin:10px 0} .c.fail{border-left:5px solid #b42318} .c.blocked{border-left:5px solid #b7791f} img{max-width:100%;border:1px solid #d9dde4;border-radius:6px;margin:6px 0} td,th{border:1px solid #d9dde4;padding:4px 8px} table{border-collapse:collapse}</style>' +
    "<h1>TableOS test report</h1><p>" + e(state.meta.tester) + " · " + e(state.meta.env) + " · version " + e(state.meta.version) + " · " + e(state.meta.browser) + " · " + new Date().toLocaleString() + "</p>" +
    "<table><tr><th>Run</th><th>Pass</th><th>Fail</th><th>P1 failures</th><th>Blocked</th><th>N/A</th><th>Other findings</th></tr><tr><td>" + c.run + "/" + c.total + "</td><td>" + c.pass + "</td><td>" + c.fail + "</td><td>" + c.p1fail + "</td><td>" + c.blocked + "</td><td>" + c.na + "</td><td>" + state.others.length + "</td></tr></table>" +
    "<h2>Failed and blocked</h2>" + (rowsOf(problems) || "<p>None.</p>") + "<h2>Other findings</h2>" + (rowsOf(state.others) || "<p>None.</p>");
  download("tableos-test-report-" + stamp() + ".html", html, "text/html");
}
async function importJson(file) {
  const data = JSON.parse(await file.text());
  if (data.kind !== "tableos-test-results") { alert("That isn't an exported TableOS test file."); return; }
  if (!confirm("Replace the results in this browser with the ones in the file?")) return;
  state = { meta: data.meta || {}, results: {}, others: data.otherFindings || [] };
  for (const r of data.results || []) if (r.status || r.notes || (r.images || []).length) state.results[r.id] = { status: r.status || "", severity: r.severity || "", notes: r.notes || "", images: r.images || [] };
  save(); fillMeta(); render();
}
function fillMeta() { for (const k of ["tester", "env", "version", "browser"]) { const i = document.getElementById("m-" + k); i.value = state.meta[k] || ""; i.oninput = () => { state.meta[k] = i.value; save(); }; } }

document.getElementById("export-json").onclick = exportJson;
document.getElementById("export-html").onclick = exportHtml;
document.getElementById("import").onclick = () => document.getElementById("import-file").click();
document.getElementById("import-file").onchange = (e) => e.target.files[0] && importJson(e.target.files[0]);
document.getElementById("zoom").onclick = () => document.getElementById("zoom").close();
const fitHeader = () => document.documentElement.style.setProperty("--hh", document.querySelector("header").offsetHeight + "px");
addEventListener("resize", fitHeader); fitHeader();
load().then((s) => { if (s) state = { meta: s.meta || {}, results: s.results || {}, others: s.others || [] }; fillMeta(); render(); });
</script></body></html>`;
}

fs.writeFileSync(path.join(dir, "TableOS-Test-Plan.md"), markdown());
fs.writeFileSync(path.join(dir, "TableOS-Test-Workbook.html"), workbook());
const printFile = path.join(dir, ".print.html");
fs.writeFileSync(printFile, printHtml());

const require = createRequire(path.resolve("apps/web/package.json"));
const { chromium } = require(path.resolve("node_modules/.pnpm/playwright-core@1.63.0/node_modules/playwright-core"));
const browser = await chromium.launch({ executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", headless: true });
const page = await browser.newPage();
await page.goto(pathToFileURL(printFile).href, { waitUntil: "load" });
await page.pdf({
  path: path.join(dir, "TableOS-Test-Plan.pdf"),
  format: "A4",
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: "<div></div>",
  footerTemplate: '<div style="font-size:8px;width:100%;text-align:center;color:#888;font-family:Segoe UI,Arial">TableOS — Complete Test Plan · page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
  margin: { top: "14mm", bottom: "14mm", left: "12mm", right: "12mm" },
});
await browser.close();
fs.unlinkSync(printFile);
console.log(`${MODULES.length} modules, ${cases.length} cases (P1 ${byPriority("P1")}, P2 ${byPriority("P2")}, P3 ${byPriority("P3")}) → TableOS-Test-Plan.md, .pdf, TableOS-Test-Workbook.html`);
