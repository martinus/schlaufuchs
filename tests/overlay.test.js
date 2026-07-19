// The overlay contract (§3.3), tested against a document small enough to fit
// in this file. Three overlays used to open and close themselves, each having
// learned a different subset of what an overlay owes its user — and none of it
// was testable, because all of it was tangled into a page.

import { test, before } from "node:test";
import assert from "node:assert/strict";
import { read } from "./pages.js";

// A DOM the size of the contract: a keydown bus, an active element, and nodes
// that remember whether they are hidden.
const keydown = [];
let overlayFrom;
let anyOverlayOpen;

function node({ focusable = true, connected = true, named = {} } = {}) {
  const n = {
    hidden: true,
    focused: 0,
    isConnected: connected,
    closest: () => null,
    focus() { n.focused++; globalThis.document.activeElement = n; },
    // The element is its own sheet here. The long FOCUSABLE list finds the
    // first control; any other selector finds only what the caller named,
    // exactly as a real querySelector would.
    querySelector(sel) {
      if (sel === ".sheet") return null;
      if (sel.includes("button:not")) return focusable ? n.child : null;
      return named[sel] ?? null;
    },
    addEventListener(type, fn) { (n.on[type] ??= []).push(fn); },
    on: {},
    fire(type, e) { for (const fn of n.on[type] ?? []) fn(e); },
  };
  n.child = focusable ? { focus() { n.focused++; } } : null;
  return n;
}

before(async () => {
  globalThis.document = {
    activeElement: null,
    addEventListener(type, fn) { if (type === "keydown") keydown.push(fn); },
    // The root carries the scroll lock (overlay.js): a classList that just
    // remembers whether the "overlay-open" freeze is on.
    documentElement: {
      classList: {
        on: false,
        toggle(cls, want) { if (cls === "overlay-open") this.on = want; },
      },
    },
  };
  ({ overlayFrom, anyOverlayOpen } = await import("../assets/js/overlay.js"));
});

const escape = () => {
  let prevented = false;
  for (const fn of keydown) fn({ key: "Escape", preventDefault: () => (prevented = true) });
  return prevented;
};

test("an overlay opens, closes, and says which it is", () => {
  const el = node();
  const o = overlayFrom(el);
  assert.equal(anyOverlayOpen(), false);

  o.open();
  assert.equal(el.hidden, false);
  assert.ok(o.isOpen() && anyOverlayOpen());

  // opening twice must not stack it, or one close would leave it "open"
  o.open();
  o.close();
  assert.equal(el.hidden, true);
  assert.equal(anyOverlayOpen(), false);
  o.close(); // idempotent
});

test("the focus goes into the sheet and comes back to the button that opened it", () => {
  const opener = node();
  globalThis.document.activeElement = opener;
  const el = node();
  const o = overlayFrom(el);

  o.open();
  assert.equal(el.focused, 1, "the first control in the sheet takes focus");
  o.close();
  assert.equal(opener.focused, 1, "and the opener gets it back");
  o.close();
  assert.equal(opener.focused, 1, "a second close does not re-focus anything");
});

// The summary's own button opens the picker. When the picker closes, its opener
// is inside a hidden overlay, and focusing it would strand the focus behind the
// backdrop — so onClose gets the last word.
test("a hidden opener is not focused, and onClose runs anyway", () => {
  const opener = node();
  opener.closest = (sel) => (sel === "[hidden]" ? opener : null);
  globalThis.document.activeElement = opener;
  let closed = 0;
  const o = overlayFrom(node(), { onClose: () => closed++ });
  o.open();
  o.close();
  assert.equal(opener.focused, 0, "focus must not go behind a backdrop");
  assert.equal(closed, 1, "onClose still runs");
});

// The round summary leads with a link to the album on the trophy it just gave
// out. It is the first focusable thing in the sheet, so Enter — the key a child
// leans on — would leave the game instead of starting the next round.
test("initialFocus wins over the first control, and falls back to it", () => {
  let wanted = 0;
  const el = node({ named: { "#sum-ok": { focus: () => wanted++ } } });
  const named = overlayFrom(el, { initialFocus: "#sum-ok" });
  named.open();
  assert.equal(wanted, 1, "the named control takes the focus");
  assert.equal(el.focused, 0, "…and the first control does not");
  named.close();

  const bare = node();
  const missing = overlayFrom(bare, { initialFocus: "#gone" });
  missing.open();
  assert.equal(bare.focused, 1, "a selector that matches nothing falls back");
  missing.close();
});

test("Escape closes a dismissible overlay and nothing else", () => {
  const soft = overlayFrom(node());
  const hard = overlayFrom(node(), { dismissible: false });

  assert.equal(escape(), false, "with nothing open, Escape belongs to the page");

  hard.open();
  assert.equal(escape(), false, "the summary cannot be waved away");
  assert.ok(hard.isOpen(), "…and stays open");

  // the picker opens on top of the summary: Escape closes the topmost only
  soft.open();
  assert.equal(escape(), true);
  assert.ok(!soft.isOpen() && hard.isOpen(), "Escape closed the top one, not both");
  hard.close();
});

test("a backdrop click closes only what may be dismissed", () => {
  const soft = node();
  const hard = node();
  const a = overlayFrom(soft);
  const b = overlayFrom(hard, { dismissible: false });
  a.open();
  b.open();

  hard.fire("click", { target: hard });
  assert.ok(b.isOpen(), "an undismissible overlay ignores its backdrop");
  assert.equal(hard.on.click, undefined, "…and never listens for it");

  soft.fire("click", { target: soft.child }); // a click inside the sheet
  assert.ok(a.isOpen(), "a click on the sheet is not a click on the backdrop");
  soft.fire("click", { target: soft });
  assert.ok(!a.isOpen());
  b.close();
});

// The page behind an open overlay must not scroll (the Pokalraum shelf did):
// the lock goes on with the first overlay of a stack and comes off only with
// the last, or the summary opening the picker would unlock the page under it.
test("the page behind is frozen while any overlay is open", () => {
  const locked = () => globalThis.document.documentElement.classList.on;
  const a = overlayFrom(node());
  const b = overlayFrom(node());
  assert.equal(locked(), false);

  a.open();
  assert.equal(locked(), true);
  b.open();
  assert.equal(locked(), true, "still frozen with two open");
  b.close();
  assert.equal(locked(), true, "…and while one remains");
  a.close();
  assert.equal(locked(), false, "unfrozen when the last closes");
});

// Regression: einmaleins asked `sum-overlay.hidden` to decide whether the
// keyboard was live. With the settings sheet or the picker open, digits went
// into the question behind it and Enter submitted the answer.
test("the keyboard belongs to whichever overlay is open", () => {
  const game = read("games/einmaleins/einmaleins.js");
  const handler = game.slice(game.indexOf('document.addEventListener("keydown"'));
  assert.match(handler.slice(0, 400), /anyOverlayOpen\(\)/, "the guard must ask the overlays");
  assert.ok(!game.includes('$("sum-overlay").hidden'), "no page reaches into an overlay's hidden flag");
});

// An overlay toggled by hand is an overlay that never fires onClose, never
// restores focus, and is invisible to `anyOverlayOpen()`.
test("no page opens an overlay by setting .hidden", () => {
  for (const f of ["games/einmaleins/einmaleins.js", "assets/js/chrome.js", "assets/js/map.js", "assets/js/album.js"]) {
    assert.ok(!/-overlay"\)\.hidden/.test(read(f)), `${f} toggles an overlay by hand`);
  }
});
