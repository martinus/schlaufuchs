#!/usr/bin/env node
//
// shoot.mjs — drive a real Chrome and look at the page.
//
// Every visual bug this project has had was invisible in the diff and obvious
// in the pixels: a floating mountain, a clipped gear button, art standing in
// the sea, a feedback card whose foot fell off the stage. `node --test` never
// saw any of them. This is the tool for looking, so that it stops being
// retyped from scratch every session and thrown away.
//
// No dependencies: Chrome is driven over the DevTools protocol through Node's
// built-in WebSocket (Node 22+).
//
// Usage:
//   node tools/shoot.mjs <url> [options]
//
//   --size WxH         viewport, default 390x844 (iPhone 14). Repeatable:
//                      each size gets its own screenshot and probe run.
//   --out FILE.png     screenshot path. With several --size, the size is
//                      appended: shot.png → shot-390x844.png
//   --cookie K=V       set before the first navigation. Repeatable.
//   --probe SELECTOR   report this element's rect, text and clipping.
//                      Repeatable.
//   --clip SELECTOR    clip probes against this element instead of the
//                      viewport (e.g. --clip .stage).
//   --do 'VERB ARG'    an action, in order. Repeatable. Verbs:
//                        click SEL     press and release over its centre
//                        key NAME      Enter, Backspace, Escape, 0-9, a-z
//                        type TEXT     one key per character
//                        until SEL     wait until SEL exists and is visible
//                        wait MS       sleep
//                        back          the browser's own back, the way the
//                                      hardware button and the Android edge
//                                      swipe send it — not `eval history.back()`
//                        eval JS       run in the page, await a promise.
//                                      'eval @file.js' reads it from a file,
//                                      which keeps the shell out of your JS.
//   --json FILE        write the probe report here (default: stdout)
//   --full             capture the whole scrolling page, not one screenful
//   --reduced-motion   emulate `prefers-reduced-motion: reduce`. This project
//                      treats that as non-negotiable, so it must be testable.
//   --allow-errors     do not fail when the page logs an error
//   --allow-hscroll    do not fail when the page scrolls sideways
//   --keep             leave the browser open (debugging this script)
//
// A run fails (exit 1) when the page does not load — a dead host, a 404 — and
// when the page logs an uncaught exception or a console.error. The second is
// the shape of this project's worst bug: a stale index.html paired with a fresh
// map.js throws, and the page still renders, just without its chips and
// buttons. The first is subtler: Chrome renders its *own* error page for a
// dead server and fires `load` on it, so every page once "passed" while
// nothing was serving them. A screenshot alone calls both a success.
//
// A run also fails when the page is **wider than the viewport it was asked
// for**. This site never scrolls sideways (§5.1), and when it did, the symptom
// showed up somewhere else entirely: a `<button>` in a `repeat(4, 1fr)` grid
// floors its track at the longest unbreakable word, "Rechenschieber" pushed the
// Pokalraum's shelf to 406px inside a 360px phone, and the *modal overlay* — a
// `position: fixed` box, which inherits the widened layout viewport — opened
// 46px off to one side. A session went into finding that.
//
// The check cannot be `scrollWidth > innerWidth`: under mobile emulation Chrome
// *widens `innerWidth` itself* to fit the overflowing content, so in the broken
// case above both were 406 and the naive check passes. It is measured against
// the width `--size` asked for. The report names the outermost elements whose
// own parent still fits — those are where the width is born, not where it is
// merely passed along.
//
// Example — is the wrong-answer aid clipped by the stage on a short phone?
//
//   node tools/shoot.mjs http://localhost:8000/games/einmaleins/ \
//     --size 360x640 --do 'click .tile' --do 'until #feedback:not([hidden])' \
//     --clip .stage --probe '#feedback' --out aid.png
//
// A probe's clippedAbove/Below/Left/Right are pixels of overflow past that
// edge of the clip box: positive means cut off. Check all four — a card can
// hang off the top while its bottom sits happily inside.

import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const CHROMES = [
  process.env.CHROME,
  "google-chrome", "google-chrome-stable", "chromium", "chromium-browser",
].filter(Boolean);

// ── argument parsing ────────────────────────────────────────────────────────

// Bad input throws rather than exiting, so the parsing can be unit-tested and
// so a caller sees one error instead of a dead process.
const die = (msg) => { throw new Error(msg); };

export function parseArgs(argv) {
  const opt = { sizes: [], cookies: [], probes: [], actions: [], out: null, json: null, clip: null, keep: false, help: false, allowErrors: false, allowHscroll: false, full: false, reducedMotion: false };
  let url = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) die(`${a} needs a value`);
      return argv[++i];
    };
    if (a === "--size") opt.sizes.push(parseSize(next()));
    else if (a === "--cookie") opt.cookies.push(parseCookie(next()));
    else if (a === "--probe") opt.probes.push(next());
    else if (a === "--do") opt.actions.push(parseAction(next()));
    else if (a === "--out") opt.out = next();
    else if (a === "--json") opt.json = next();
    else if (a === "--clip") opt.clip = next();
    else if (a === "--full") opt.full = true;
    else if (a === "--reduced-motion") opt.reducedMotion = true;
    else if (a === "--allow-errors") opt.allowErrors = true;
    else if (a === "--allow-hscroll") opt.allowHscroll = true;
    else if (a === "--keep") opt.keep = true;
    else if (a === "-h" || a === "--help") return { ...opt, help: true };
    else if (a.startsWith("-")) die(`unknown option ${a}`);
    else if (url) die(`two urls: ${url} and ${a}`);
    else url = a;
  }
  if (!url) die("needs a url — try --help");
  if (opt.sizes.length === 0) opt.sizes.push({ w: 390, h: 844 });
  return { url, ...opt };
}

export const parseSize = (s) => {
  const m = /^(\d+)x(\d+)$/.exec(s);
  if (!m) die(`--size wants WxH, got ${s}`);
  return { w: +m[1], h: +m[2] };
};

// Split on the first '=' only: a cookie value is percent-encoded JSON and is
// full of them.
export const parseCookie = (s) => {
  const i = s.indexOf("=");
  if (i < 1) die(`--cookie wants name=value, got ${s}`);
  return { name: s.slice(0, i), value: s.slice(i + 1) };
};

export const VERBS = ["click", "key", "type", "until", "wait", "eval", "back"];
// `back` names a whole gesture, so it takes nothing. Every other verb without
// its argument is a typo, and a silent no-op would be the worst kind.
export const NO_ARG = new Set(["back"]);
export function parseAction(s) {
  const i = s.indexOf(" ");
  const verb = i < 0 ? s : s.slice(0, i);
  if (!VERBS.includes(verb)) die(`--do: unknown verb '${verb}', want ${VERBS.join("|")}`);
  const arg = i < 0 ? "" : s.slice(i + 1).trim();
  if (!arg && !NO_ARG.has(verb)) die(`--do '${verb}' needs an argument`);
  return { verb, arg };
}

// One --size writes exactly the file that was asked for; several would
// overwrite each other, so the size disambiguates them.
export const outName = (out, size, many) =>
  many ? out.replace(/(\.png)?$/i, `-${size.w}x${size.h}.png`) : out;

export function usage() {
  const src = readFileSync(fileURLToPath(import.meta.url), "utf8");
  // the banner comment is the help text; keep them from drifting apart
  return src.slice(src.indexOf("// Usage:"), src.indexOf("import {")).replace(/^\/\/ ?/gm, "");
}

// ── a minimal CDP client ────────────────────────────────────────────────────

class Cdp {
  #ws; #next = 1; #pending = new Map(); #waiters = []; #listeners = [];

  static async attach(wsUrl) {
    const cdp = new Cdp();
    cdp.#ws = new WebSocket(wsUrl);
    cdp.#ws.addEventListener("message", (ev) => cdp.#onMessage(JSON.parse(ev.data)));
    await new Promise((res, rej) => {
      cdp.#ws.addEventListener("open", res, { once: true });
      cdp.#ws.addEventListener("error", () => rej(new Error(`cannot connect to ${wsUrl}`)), { once: true });
    });
    return cdp;
  }

  #onMessage(msg) {
    if (msg.id !== undefined) {
      const p = this.#pending.get(msg.id);
      if (!p) return;
      this.#pending.delete(msg.id);
      if (msg.error) p.reject(new Error(`${p.method}: ${msg.error.message}`));
      else p.resolve(msg.result);
      return;
    }
    // an event: hand it to anyone waiting for it
    for (const w of this.#waiters.splice(0)) {
      if (w.method === msg.method && (!w.sessionId || w.sessionId === msg.sessionId)) w.resolve(msg.params);
      else this.#waiters.push(w);
    }
    for (const l of this.#listeners) {
      if (l.method === msg.method && (!l.sessionId || l.sessionId === msg.sessionId)) l.fn(msg.params);
    }
  }

  on(method, sessionId, fn) {
    this.#listeners.push({ method, sessionId, fn });
  }

  send(method, params = {}, sessionId) {
    const id = this.#next++;
    this.#ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    return new Promise((resolve, reject) => this.#pending.set(id, { resolve, reject, method }));
  }

  // Register *before* the command that triggers the event, or it can be missed.
  once(method, sessionId, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const w = { method, sessionId, resolve };
      this.#waiters.push(w);
      sleep(timeoutMs).then(() => {
        const i = this.#waiters.indexOf(w);
        if (i >= 0) {
          this.#waiters.splice(i, 1);
          reject(new Error(`timed out waiting for ${method}`));
        }
      });
    });
  }

  close() { this.#ws.close(); }
}

// ── launching chrome ────────────────────────────────────────────────────────

async function launch() {
  const dir = mkdtempSync(join(tmpdir(), "shoot-"));
  let child = null;
  for (const bin of CHROMES) {
    child = spawn(bin, [
      "--headless=new",
      "--remote-debugging-port=0",
      `--user-data-dir=${dir}`,
      "--no-first-run", "--no-default-browser-check", "--no-sandbox",
      "--hide-scrollbars", "--disable-gpu", "--force-color-profile=srgb",
      "about:blank",
    ], { stdio: ["ignore", "ignore", "pipe"] });
    const failed = await new Promise((r) => {
      child.once("error", () => r(true));
      setTimeout(() => r(false), 300).unref?.();
    });
    if (!failed) break;
    child = null;
  }
  if (!child) die(`no chrome found — tried ${CHROMES.join(", ")}. Set $CHROME.`);

  // chrome writes the port it actually chose into the profile directory
  const portFile = join(dir, "DevToolsActivePort");
  for (let i = 0; i < 100 && !existsSync(portFile); i++) await sleep(50);
  if (!existsSync(portFile)) die("chrome never reported a debugging port");
  const port = readFileSync(portFile, "utf8").split("\n")[0].trim();

  const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  const cdp = await Cdp.attach(webSocketDebuggerUrl);
  return { cdp, child, dir };
}

// ── the page session ────────────────────────────────────────────────────────

async function newPage(cdp) {
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  await cdp.send("Page.enable", {}, sessionId);
  await cdp.send("Runtime.enable", {}, sessionId);
  await cdp.send("Network.enable", {}, sessionId);
  return sessionId;
}

const evaluate = async (cdp, sid, expression) => {
  const { result, exceptionDetails } = await cdp.send("Runtime.evaluate", {
    expression, returnByValue: true, awaitPromise: true,
  }, sid);
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
  return result.value;
};

// Chrome performs a key's *default action* only when the event carries text.
// Enter without `text: "\r"` silently does nothing — this cost a session once.
const KEYS = {
  Enter: { code: "Enter", keyCode: 13, text: "\r" },
  Backspace: { code: "Backspace", keyCode: 8, text: "" },
  Escape: { code: "Escape", keyCode: 27, text: "" },
  Tab: { code: "Tab", keyCode: 9, text: "" },
};

export function keySpec(name) {
  if (KEYS[name]) return { key: name, ...KEYS[name] };
  if (/^[0-9]$/.test(name)) return { key: name, code: `Digit${name}`, keyCode: 48 + +name, text: name };
  if (/^[a-z]$/i.test(name)) {
    const u = name.toUpperCase();
    return { key: name, code: `Key${u}`, keyCode: u.charCodeAt(0), text: name };
  }
  die(`--do key: don't know '${name}'`);
}

async function pressKey(cdp, sid, name) {
  const k = keySpec(name);
  const base = { key: k.key, code: k.code, windowsVirtualKeyCode: k.keyCode, nativeVirtualKeyCode: k.keyCode };
  await cdp.send("Input.dispatchKeyEvent", { type: k.text ? "keyDown" : "rawKeyDown", text: k.text, ...base }, sid);
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", ...base }, sid);
}

async function clickSelector(cdp, sid, sel) {
  const at = await evaluate(cdp, sid, `(() => {
    const el = document.querySelector(${JSON.stringify(sel)});
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return null;
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  if (!at) throw new Error(`click: '${sel}' is missing or has no box`);
  const btn = { button: "left", clickCount: 1, buttons: 1, ...at };
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", ...btn }, sid);
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...btn, buttons: 0 }, sid);
}

async function waitUntil(cdp, sid, sel, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ok = await evaluate(cdp, sid, `(() => {
      const el = document.querySelector(${JSON.stringify(sel)});
      if (!el || el.hasAttribute("hidden")) return false;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    })()`);
    if (ok) return;
    await sleep(50);
  }
  throw new Error(`until: '${sel}' never became visible`);
}

// The browser's own back, not the page's. `eval history.back()` tests what the
// page thinks a back is; this walks Chrome's navigation history the way the
// hardware button and the Android edge swipe do, which is the only way to see
// whether a history sentinel (`leaveguard.js`, §10.7) really catches them.
async function goBack(cdp, sid) {
  const { currentIndex, entries } = await cdp.send("Page.getNavigationHistory", {}, sid);
  if (currentIndex <= 0) throw new Error("back: this page has nothing behind it");
  await cdp.send("Page.navigateToHistoryEntry", { entryId: entries[currentIndex - 1].id }, sid);
}

async function runAction(cdp, sid, { verb, arg }) {
  if (verb === "click") return clickSelector(cdp, sid, arg);
  if (verb === "key") return pressKey(cdp, sid, arg);
  if (verb === "type") { for (const ch of arg) await pressKey(cdp, sid, ch); return; }
  if (verb === "until") return waitUntil(cdp, sid, arg);
  if (verb === "wait") return sleep(Number(arg));
  if (verb === "back") return goBack(cdp, sid);
  if (verb === "eval") return evaluate(cdp, sid, arg.startsWith("@") ? readFileSync(arg.slice(1), "utf8") : arg);
}

// Positive clipped* = pixels hidden past that edge of the clip box. Report all
// four: a probe that only checks the bottom will call a clipped top a success.
const probeScript = (probes, clip) => `(() => {
  const clipEl = ${clip ? `document.querySelector(${JSON.stringify(clip)})` : "null"};
  const b = clipEl
    ? clipEl.getBoundingClientRect()
    : { top: 0, left: 0, bottom: innerHeight, right: innerWidth };
  const round = (n) => Math.round(n * 10) / 10;
  const out = {};
  for (const sel of ${JSON.stringify(probes)}) {
    const el = document.querySelector(sel);
    if (!el) { out[sel] = { found: false }; continue; }
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    out[sel] = {
      found: true,
      hidden: el.hasAttribute("hidden") || cs.display === "none" || cs.visibility === "hidden",
      text: (el.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 160),
      rect: { x: round(r.x), y: round(r.y), w: round(r.width), h: round(r.height) },
      clippedAbove: round(b.top - r.top),
      clippedBelow: round(r.bottom - b.bottom),
      clippedLeft: round(b.left - r.left),
      clippedRight: round(r.right - b.right),
    };
  }
  return out;
})()`;

// ── horizontal overflow ─────────────────────────────────────────────────────

// Measured against `w`, the width `--size` asked for — NOT against innerWidth,
// which Chrome grows to fit overflowing content under mobile emulation, so that
// `scrollWidth > innerWidth` is false in exactly the case worth catching.
//
// `culprits` are the outermost elements that stick out while their own parent
// still fits: an ancestor of an overflowing box is wide because of it, not with
// it, and listing the whole chain buries the one line you need. <html> and
// <body> are always in that chain, so they are never culprits.
export const overflowScript = (w) => `(() => {
  const lim = ${w} + 0.5;
  const sticksOut = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;
    return r.right > lim || r.left < -0.5;
  };
  const over = new Set();
  for (const el of document.querySelectorAll("*")) if (sticksOut(el)) over.add(el);
  const name = (el) => {
    const cls = typeof el.className === "string" ? el.className.trim() : "";
    return el.tagName.toLowerCase()
      + (el.id ? "#" + el.id : "")
      + (cls ? "." + cls.split(/\\s+/).join(".") : "");
  };
  const culprits = [...over]
    .filter((el) => el !== document.documentElement && el !== document.body)
    .filter((el) => !over.has(el.parentElement))
    .slice(0, 6)
    .map((el) => {
      const r = el.getBoundingClientRect();
      return { el: name(el), left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) };
    });
  return {
    viewport: ${w},
    pageWidth: Math.round(document.documentElement.scrollWidth),
    innerWidth: window.innerWidth,
    culprits,
  };
})()`;

// null when the page fits. A message when it does not — one that names where to
// look, because "the page is 406px wide" sends you hunting through the DOM.
export function hscrollMessage(size, overflow) {
  if (!overflow || overflow.pageWidth <= overflow.viewport) return null;
  const by = overflow.pageWidth - overflow.viewport;
  const where = overflow.culprits.length
    ? overflow.culprits.map((c) => `${c.el} (${c.left}…${c.right})`).join(", ")
    : "no single element — check a grid track or a min-width";
  return `${size}: the page is ${by}px wider than its viewport `
    + `(${overflow.pageWidth} > ${overflow.viewport}; innerWidth grew to ${overflow.innerWidth}). `
    + `Widened by: ${where}`;
}

// ── one run at one viewport ─────────────────────────────────────────────────

async function shoot(cdp, opt, size) {
  const sid = await newPage(cdp);

  // The failure this project fears most is a page whose JS threw: it still
  // renders, it still screenshots, it just has no chips and no buttons. A
  // screenshot of a broken page must not pass for a screenshot of a good one.
  const errors = [];
  cdp.on("Runtime.exceptionThrown", sid, (p) => {
    const d = p.exceptionDetails;
    errors.push(d.exception?.description ?? d.text ?? "uncaught exception");
  });
  cdp.on("Runtime.consoleAPICalled", sid, (p) => {
    if (p.type === "error") errors.push(p.args.map((a) => a.description ?? a.value).join(" "));
  });

  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: size.w, height: size.h, deviceScaleFactor: 2, mobile: true,
  }, sid);
  if (opt.reducedMotion) {
    await cdp.send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-motion", value: "reduce" }],
    }, sid);
  }

  for (const c of opt.cookies) {
    await cdp.send("Network.setCookie", { name: c.name, value: c.value, url: opt.url }, sid);
  }

  // The main document's HTTP status, before the load event can hide it.
  let status = null;
  cdp.on("Network.responseReceived", sid, (p) => {
    if (p.type === "Document" && status === null) status = p.response.status;
  });

  const loaded = cdp.once("Page.loadEventFired", sid);
  const nav = await cdp.send("Page.navigate", { url: opt.url }, sid);
  // Chrome renders its own error page for a dead host or a 404 and fires
  // `load` on it, so a run against a stopped server used to screenshot that
  // error page, find no page errors, and exit 0. A shot of a page that never
  // loaded is not a passing shot.
  if (nav.errorText) throw new Error(`${opt.url}: ${nav.errorText}`);
  await loaded;
  if (status !== null && status >= 400) throw new Error(`${opt.url}: HTTP ${status}`);

  // Whatever an `eval` returns is reported. A driver script that quietly did
  // nothing must not be able to look like one that did the work.
  const report = { url: opt.url, size: `${size.w}x${size.h}`, status };
  for (const a of opt.actions) {
    const value = await runAction(cdp, sid, a);
    if (a.verb === "eval" && value !== undefined) (report.eval ??= []).push(value);
  }

  if (opt.probes.length) report.probes = await evaluate(cdp, sid, probeScript(opt.probes, opt.clip));

  // After the actions: an overlay that opens too wide is as broken as a shelf
  // that renders too wide, and only one of the two is on screen at load.
  const overflow = await evaluate(cdp, sid, overflowScript(size.w));
  if (overflow.pageWidth > overflow.viewport) report.overflowX = overflow;

  if (opt.out) {
    const file = outName(opt.out, size, opt.sizes.length > 1);
    // A scrolling page (the privacy and parents views) is not one screenful,
    // and a screenshot of its first screenful hides exactly what you came for.
    const shot = { format: "png" };
    if (opt.full) {
      const h = await evaluate(cdp, sid, "document.documentElement.scrollHeight");
      Object.assign(shot, {
        captureBeyondViewport: true,
        clip: { x: 0, y: 0, width: size.w, height: h, scale: 1 },
      });
      report.fullHeight = h;
    }
    const { data } = await cdp.send("Page.captureScreenshot", shot, sid);
    writeFileSync(file, Buffer.from(data, "base64"));
    report.screenshot = file;
  }

  if (errors.length) report.errors = errors;

  await cdp.send("Target.closeTarget", { targetId: (await cdp.send("Target.getTargetInfo", {}, sid)).targetInfo.targetId });
  return report;
}

// ── main ────────────────────────────────────────────────────────────────────

async function main(argv) {
  const opt = parseArgs(argv);
  if (opt.help) {
    console.log(usage());
    return 0;
  }

  const { cdp, child, dir } = await launch();
  let failed = false;
  try {
    const reports = [];
    for (const size of opt.sizes) reports.push(await shoot(cdp, opt, size));
    const json = JSON.stringify(reports.length === 1 ? reports[0] : reports, null, 2);
    if (opt.json) writeFileSync(opt.json, json + "\n");
    else console.log(json);

    const broke = reports.filter((r) => r.errors);
    if (broke.length && !opt.allowErrors) {
      failed = true;
      for (const r of broke) console.error(`shoot: ${r.size} logged ${r.errors.length} page error(s): ${r.errors[0]}`);
    }

    // This site never scrolls sideways (§5.1). When it did, the symptom appeared
    // in a fixed overlay two DOM levels away; the screenshot showed a centring
    // bug and the cause was a grid track.
    if (!opt.allowHscroll) {
      for (const r of reports) {
        const msg = hscrollMessage(r.size, r.overflowX);
        if (!msg) continue;
        failed = true;
        console.error(`shoot: ${msg}`);
      }
    }
  } catch (err) {
    failed = true;
    console.error(`shoot: ${err.message}`);
  } finally {
    if (!opt.keep) {
      cdp.close();
      // Chrome is still writing its profile; deleting it under a live process
      // fails with ENOTEMPTY. Wait for the exit, and never let the tidy-up
      // decide the exit code — a leftover temp directory is not a failed shot.
      const exited = new Promise((r) => child.once("exit", r));
      child.kill();
      await Promise.race([exited, sleep(3000)]);
      try {
        rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      } catch { /* the OS will reap it */ }
    }
  }
  return failed ? 1 : 0;
}

// Only drive a browser when run as a command. Importing this module — which the
// unit tests do, to reach the parsing above — must not launch Chrome.
const invokedDirectly =
  process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  try {
    process.exit(await main(process.argv.slice(2)));
  } catch (err) {
    console.error(`shoot: ${err.message}`);
    process.exit(1);
  }
}
