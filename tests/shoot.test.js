// tools/shoot.mjs drives a real Chrome, so most of it cannot be unit-tested
// here — the deploy workflow has no browser. What *can* be tested is the part
// that has actually gone wrong: the argument parsing and, above all, the key
// specs. Importing the module must not launch anything.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseArgs, parseSize, parseCookie, parseAction, keySpec, outName, hscrollMessage, overflowScript, VERBS } from "../tools/shoot.mjs";

// Regression, learned the hard way in a previous session: a CDP keyDown without
// `text` never performs the key's default action, so a scripted Enter silently
// does nothing and the harness "proves" whatever you hoped. A key that produces
// a character must carry it.
test("keys that type something carry their text, or Chrome ignores them", () => {
  assert.equal(keySpec("Enter").text, "\r", "Enter without text does nothing at all");
  assert.equal(keySpec("7").text, "7");
  assert.equal(keySpec("7").code, "Digit7");
  assert.equal(keySpec("7").keyCode, 55);
  assert.equal(keySpec("a").code, "KeyA");
  // …and keys that type nothing must not claim to
  assert.equal(keySpec("Backspace").text, "");
  assert.equal(keySpec("Escape").text, "");
  assert.throws(() => keySpec("F13"), /don't know/);
});

test("parseSize / parseCookie / parseAction reject what they cannot mean", () => {
  assert.deepEqual(parseSize("360x640"), { w: 360, h: 640 });
  assert.throws(() => parseSize("360"), /wants WxH/);
  assert.throws(() => parseSize("360x"), /wants WxH/);

  // a cookie value is percent-encoded JSON: it is full of '='
  assert.deepEqual(parseCookie("a=b=c"), { name: "a", value: "b=c" });
  assert.throws(() => parseCookie("=nope"), /wants name=value/);
  assert.throws(() => parseCookie("nope"), /wants name=value/);

  assert.deepEqual(parseAction("click #ok"), { verb: "click", arg: "#ok" });
  assert.deepEqual(parseAction("eval @play.js"), { verb: "eval", arg: "@play.js" });
  assert.throws(() => parseAction("clcik #ok"), /unknown verb/);
  assert.throws(() => parseAction("click"), /needs an argument/);
  for (const v of VERBS) assert.equal(parseAction(`${v} x`).verb, v);
});

test("parseArgs: a default viewport, repeatable flags, and a url it insists on", () => {
  const d = parseArgs(["http://x/"]);
  assert.equal(d.url, "http://x/");
  assert.deepEqual(d.sizes, [{ w: 390, h: 844 }]);

  const o = parseArgs(["http://x/", "--size", "360x640", "--size", "390x844",
    "--probe", "#a", "--probe", "#b", "--clip", ".stage", "--keep", "--allow-errors",
    "--full", "--reduced-motion", "--allow-hscroll"]);
  assert.equal(o.sizes.length, 2);
  assert.deepEqual(o.probes, ["#a", "#b"]);
  assert.equal(o.clip, ".stage");
  assert.equal(o.keep, true);
  assert.equal(o.allowErrors, true);
  assert.equal(o.full, true);
  assert.equal(o.reducedMotion, true);
  assert.equal(o.allowHscroll, true);

  // Each of these is off unless it is asked for. A run must not silently
  // tolerate a page error, and it must not silently emulate a media feature —
  // a screenshot taken under `prefers-reduced-motion` proves nothing about the
  // page everyone else sees.
  const d2 = parseArgs(["http://x/"]);
  assert.equal(d2.allowErrors, false);
  assert.equal(d2.full, false);
  assert.equal(d2.reducedMotion, false);
  assert.equal(d2.allowHscroll, false);

  assert.throws(() => parseArgs([]), /needs a url/);
  assert.throws(() => parseArgs(["http://x/", "--bogus"]), /unknown option/);
  assert.throws(() => parseArgs(["http://x/", "--size"]), /needs a value/);
  assert.throws(() => parseArgs(["http://x/", "http://y/"]), /two urls/);
  assert.equal(parseArgs(["--help"]).help, true);
});

// Two viewports writing to one --out would leave only the last one on disk,
// and the run would look like it had shot both.
test("outName keeps several viewports from overwriting each other", () => {
  const size = { w: 360, h: 640 };
  assert.equal(outName("aid.png", size, false), "aid.png");
  assert.equal(outName("aid.png", size, true), "aid-360x640.png");
  assert.equal(outName("aid", size, true), "aid-360x640.png");
  assert.notEqual(outName("aid.png", { w: 390, h: 844 }, true), outName("aid.png", size, true));
});

// Regression, found while claiming "all pages are error-free": Chrome renders
// its own error page for a dead host or a 404 and fires `load` on it, so a run
// against a stopped server screenshotted that error page, found no page errors
// and exited 0. Every page "passed" while nothing was serving them.
test("a page that never loaded is not a passing shot", () => {
  const src = readFileSync(new URL("../tools/shoot.mjs", import.meta.url), "utf8");
  assert.match(src, /if \(nav\.errorText\) throw/, "a failed navigation must throw");
  assert.match(src, /status >= 400\) throw/, "a 4xx/5xx main document must throw");
  assert.match(src, /"Network\.responseReceived"/, "…which means the status must be captured");
});

// The Pokalraum scrolled sideways for two commits. The symptom showed up in a
// `position: fixed` overlay two DOM levels away — it opened 46px off-centre,
// because a fixed box inherits the layout viewport that some grid track widened.
// A session went into finding that a `<button>` in a `repeat(4, 1fr)` grid
// floors its track at its longest unbreakable word ("Rechenschieber").
test("a page wider than its viewport is not a passing shot", () => {
  const size = "360x640";
  assert.equal(hscrollMessage(size, null), null, "no measurement, no complaint");
  assert.equal(hscrollMessage(size, { viewport: 360, pageWidth: 360, innerWidth: 360, culprits: [] }), null);

  const msg = hscrollMessage(size, {
    viewport: 360, pageWidth: 406, innerWidth: 406,
    culprits: [{ el: "button.tcard.slot.earned", left: 314, right: 406, width: 92 }],
  });
  assert.match(msg, /46px wider/, "say by how much");
  assert.match(msg, /406 > 360/);
  assert.match(msg, /button\.tcard\.slot\.earned \(314…406\)/, "…and name where the width is born");

  // A page can be too wide with no single element to blame — a grid track, a
  // min-width. Saying "no culprits" is more honest than saying nothing.
  const vague = hscrollMessage(size, { viewport: 360, pageWidth: 400, innerWidth: 400, culprits: [] });
  assert.match(vague, /no single element/);
});

// The trap that made the naive check useless: under mobile emulation Chrome
// grows `innerWidth` to fit the overflow, so in the broken case above BOTH
// scrollWidth and innerWidth read 406 and `scrollWidth > innerWidth` is false.
test("horizontal overflow is measured against the viewport that was asked for", () => {
  const src = overflowScript(360);
  assert.match(src, /const lim = 360 \+ 0\.5;/, "the requested width, not innerWidth");
  assert.match(src, /viewport: 360/);
  assert.ok(!/scrollWidth\s*>\s*(window\.)?innerWidth/.test(src), "that comparison is always false here");

  // innerWidth is still reported, because it is the clue that explains the bug.
  assert.match(src, /innerWidth: window\.innerWidth/);

  // An ancestor of an overflowing box is wide *because of* it. Only the
  // outermost element whose own parent still fits is worth naming.
  assert.match(src, /!over\.has\(el\.parentElement\)/);
  assert.match(src, /el !== document\.documentElement && el !== document\.body/);

  const shoot = readFileSync(new URL("../tools/shoot.mjs", import.meta.url), "utf8");
  assert.match(shoot, /if \(!opt\.allowHscroll\)/, "the guard must be on by default");
  assert.match(shoot, /report\.overflowX = overflow/, "…and the measurement must reach the report");
});
