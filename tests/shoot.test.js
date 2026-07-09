// tools/shoot.mjs drives a real Chrome, so most of it cannot be unit-tested
// here — the deploy workflow has no browser. What *can* be tested is the part
// that has actually gone wrong: the argument parsing and, above all, the key
// specs. Importing the module must not launch anything.

import { test } from "node:test";
import assert from "node:assert/strict";
import { parseArgs, parseSize, parseCookie, parseAction, keySpec, outName, VERBS } from "../tools/shoot.mjs";

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
    "--probe", "#a", "--probe", "#b", "--clip", ".stage", "--keep", "--allow-errors"]);
  assert.equal(o.sizes.length, 2);
  assert.deepEqual(o.probes, ["#a", "#b"]);
  assert.equal(o.clip, ".stage");
  assert.equal(o.keep, true);
  assert.equal(o.allowErrors, true);

  // a page error fails the run unless it was asked to be tolerated
  assert.equal(parseArgs(["http://x/"]).allowErrors, false);

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
