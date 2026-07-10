// Fullscreen (§3.4). The tricky parts are not the toggle — they are the two
// facts the toggle is built around: the API is spelled two ways and missing on
// a third device, and a remembered "on" cannot re-apply itself without a
// gesture. Both are pure functions here, and both are tested against the shapes
// a real browser hands them.

import { test } from "node:test";
import assert from "node:assert/strict";
import { fsMethods, fsSupported, isFullscreen, reentryNeeded, initFullscreen } from "../assets/js/fullscreen.js";

// The three documents that matter: modern (unprefixed), Safari/iPad (webkit),
// and iPhone (neither). `el` is the documentElement the request hangs off.
function modernDoc(fsElement = null) {
  const el = { requestFullscreen() { el.requested = true; } };
  return { documentElement: el, exitFullscreen() { this.exited = true; }, fullscreenElement: fsElement };
}
function webkitDoc(fsElement = null) {
  const el = { webkitRequestFullscreen() { el.requested = true; } };
  return { documentElement: el, webkitExitFullscreen() { this.exited = true; }, webkitFullscreenElement: fsElement };
}
const iphoneDoc = () => ({ documentElement: {} });

test("fsMethods resolves the unprefixed API and its event", () => {
  const d = modernDoc();
  const m = fsMethods(d);
  assert.ok(m, "modern document must be supported");
  assert.equal(m.event, "fullscreenchange");
  m.request();
  assert.ok(d.documentElement.requested, "request must reach the documentElement");
  m.exit();
  assert.ok(d.exited, "exit must reach the document");
});

test("fsMethods falls back to the webkit prefix and its event", () => {
  const d = webkitDoc();
  const m = fsMethods(d);
  assert.ok(m, "an iPad/Safari document must be supported");
  assert.equal(m.event, "webkitfullscreenchange", "the webkit event travels with the webkit method");
  m.request();
  assert.ok(d.documentElement.requested);
});

// The load-bearing case: iPhone Safari has neither method. null is not an error
// here, it is the signal the settings sheet reads to build no row at all.
test("fsMethods is null where the API is missing, and fsSupported agrees", () => {
  assert.equal(fsMethods(iphoneDoc()), null);
  assert.equal(fsSupported(iphoneDoc()), false);
  assert.equal(fsSupported(modernDoc()), true);
  assert.equal(fsSupported(webkitDoc()), true);
});

test("isFullscreen reads the live element under either spelling", () => {
  assert.equal(isFullscreen(modernDoc(null)), false);
  assert.equal(isFullscreen(modernDoc({})), true);
  assert.equal(isFullscreen(webkitDoc(null)), false);
  assert.equal(isFullscreen(webkitDoc({})), true);
  assert.equal(isFullscreen(iphoneDoc()), false);
});

// The whole point of persistence: a page that loaded windowed still owes a
// re-entry, but only if the child still wants one and is not already there.
test("reentryNeeded is true only when the preference is set and we are windowed", () => {
  assert.equal(reentryNeeded({ preference: true, active: false }), true);
  assert.equal(reentryNeeded({ preference: true, active: true }), false, "already there");
  assert.equal(reentryNeeded({ preference: false, active: false }), false, "not wanted");
  assert.equal(reentryNeeded({ preference: false, active: true }), false);
});

test("an unsupported device gets a controller whose toggle is a safe no-op", () => {
  // no global document, so fsMethods() → null, exactly the iPhone at runtime
  const ctrl = initFullscreen({ getPref: () => true, setPref: () => {} });
  assert.equal(ctrl.supported, false);
  assert.equal(ctrl.active(), false);
  assert.doesNotThrow(() => ctrl.toggle());
});

// The controller wiring, against a fake browser: a tap enters when windowed and
// exits when fullscreen, and each writes the intent to the store. The store is
// injected, so this is the real toggle() logic, not a mock of it.
test("toggle enters when windowed, exits when fullscreen, and records intent", () => {
  const el = { requestFullscreen() { el.requested = true; } };
  const fakeDoc = {
    documentElement: el,
    exitFullscreen() { fakeDoc.exited = true; },
    fullscreenElement: null,
    addEventListener() {},
  };
  const saved = globalThis.document;
  const savedAdd = globalThis.addEventListener;
  const savedRemove = globalThis.removeEventListener;
  globalThis.document = fakeDoc;
  globalThis.addEventListener = () => {};
  globalThis.removeEventListener = () => {};
  try {
    let pref = false;
    const ctrl = initFullscreen({ getPref: () => pref, setPref: (v) => { pref = v; } });
    assert.equal(ctrl.supported, true);

    ctrl.toggle(); // windowed → enter
    assert.ok(el.requested, "a windowed toggle must request fullscreen");
    assert.equal(pref, true, "and remember that the child wants it");

    fakeDoc.fullscreenElement = el; // the browser is now in fullscreen
    ctrl.toggle(); // → exit
    assert.ok(fakeDoc.exited, "a fullscreen toggle must exit");
    assert.equal(pref, false, "and forget the preference");
  } finally {
    globalThis.document = saved;
    globalThis.addEventListener = savedAdd;
    globalThis.removeEventListener = savedRemove;
  }
});
