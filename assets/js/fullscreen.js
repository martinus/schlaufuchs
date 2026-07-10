// Fullscreen mode (§3.4), remembered across page loads.
//
// Two hard facts shape everything here:
//
//   1. **The API is missing on iPhone Safari** — only iPad, Android and the
//      desktops have it. A button that does nothing when tapped is worse than
//      no button (a silent no-op, the thing this repo hunts), so the toggle
//      hides itself wherever `fsSupported()` is false.
//
//   2. **`requestFullscreen()` is granted only from inside a user gesture.** A
//      remembered "on" therefore cannot re-apply itself on load — the browser
//      refuses a request that no tap asked for. So the preference is honoured
//      on the *first* pointer or key event after a navigation instead, which
//      on a game page is the child's first tap and feels immediate.
//
// The cross-browser surface is small but real: Safari (desktop + iPad) still
// spells the methods `webkit…` and fires `webkitfullscreenchange`. `fsMethods`
// resolves the pair once, or returns null — and null is exactly the iPhone.

const doc = () => (typeof document !== "undefined" ? document : null);

// The four things the rest of the module needs, resolved across the unprefixed
// spec and Safari's `webkit-` prefix. Returns null when neither exists — that
// is not an error, it is the iPhone, and callers branch on it. Kept pure (the
// document is an argument) so the whole cross-browser table is unit-testable.
export function fsMethods(d = doc(), el = d?.documentElement) {
  if (!d || !el) return null;
  const request = el.requestFullscreen || el.webkitRequestFullscreen;
  const exit = d.exitFullscreen || d.webkitExitFullscreen;
  if (!request || !exit) return null;
  return {
    request: () => request.call(el),
    exit: () => exit.call(d),
    // Read live — the element can be entered and left many times.
    elementOf: () => d.fullscreenElement ?? d.webkitFullscreenElement ?? null,
    // The unprefixed method and the unprefixed event travel together.
    event: d.exitFullscreen ? "fullscreenchange" : "webkitfullscreenchange",
  };
}

export function fsSupported(d = doc()) {
  return fsMethods(d) !== null;
}

export function isFullscreen(d = doc()) {
  const m = fsMethods(d);
  return !!(m && m.elementOf());
}

// The remembered preference has been honoured once we are actually in
// fullscreen; until then, a page that loads windowed with the preference set
// still owes the child a re-entry. Pure, because it is the one rule that a
// browser test would be least able to explain.
export function reentryNeeded({ preference, active }) {
  return preference === true && active === false;
}

// Wire the toggle to the browser and to the cookie. `getPref`/`setPref` are
// injected so the store stays out of this module (and testable); `onChange`
// fires whenever the real state changes, so the settings icon can follow a
// child who left fullscreen with Escape or a system gesture.
//
// Returns { supported, active, toggle }. On a device without the API every
// method is a safe no-op and `supported` is false, which is the caller's cue
// to build no row at all.
export function initFullscreen({ getPref, setPref, onChange } = {}) {
  const m = fsMethods();
  if (!m) return { supported: false, active: () => false, toggle() {} };

  const active = () => !!m.elementOf();

  // The source of truth is the browser, not our optimistic write: on every
  // real change we make the preference match reality. That single line is what
  // clears the preference when the child leaves fullscreen deliberately on a
  // live page, so the first-tap re-entry below never fights her.
  document.addEventListener(m.event, () => {
    setPref?.(active());
    onChange?.();
  });

  // A remembered "on" cannot re-enter on load (no gesture), so it waits for the
  // first one. One tap is enough; the change handler keeps the books, and a
  // reload re-arms. We do not loop, so a child who wanted out stays out.
  if (reentryNeeded({ preference: getPref?.() === true, active: active() })) {
    const onGesture = () => {
      remove();
      if (reentryNeeded({ preference: getPref?.() === true, active: active() })) {
        Promise.resolve(m.request()).catch(() => {});
      }
    };
    const remove = () => {
      removeEventListener("pointerdown", onGesture);
      removeEventListener("keydown", onGesture);
    };
    addEventListener("pointerdown", onGesture);
    addEventListener("keydown", onGesture);
  }

  return {
    supported: true,
    active,
    // Called from the settings button, which is itself the required gesture.
    toggle() {
      if (active()) {
        Promise.resolve(m.exit()).catch(() => {});
      } else {
        Promise.resolve(m.request()).catch(() => {});
      }
      // Write the intent now; the change handler will correct it if the
      // request is refused. Without this, a request that never resolves (some
      // webkit builds) would leave the preference stale.
      setPref?.(!active());
    },
  };
}
