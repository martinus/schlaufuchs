// One overlay, three users (§3.3, §3.4): the settings sheet, the table picker,
// the round summary. Each used to open and close itself, and each had learned a
// different subset of what an overlay owes its user.
//
// What they now share:
//   - Escape closes a dismissible overlay. The picker and the settings sheet
//     are dismissible; the summary is not — closing it would leave a child in a
//     finished round with nothing to press.
//   - The focus goes into the sheet on open and back to the button that opened
//     it on close. A dialog you tab into from behind is not a dialog.
//   - `anyOverlayOpen()` is the truth the rest of the page asks. The einmaleins
//     keyboard handler used to ask `sum-overlay.hidden` instead, which meant
//     that with the settings sheet up, digits went into the question behind it
//     and Enter submitted the answer.

const openOverlays = new Set();

export function anyOverlayOpen() {
  return openOverlays.size > 0;
}

// While any overlay is open, the page behind it must not scroll: the Pokalraum
// is taller than the screen, and a wheel or drag on the backdrop scrolled the
// shelf behind the open sheet. The lock rides on <html> so it holds whether the
// page scrolls on the body or the root, and lifts only when the LAST overlay of
// a stack closes (the summary opens the picker on top of itself).
function syncScrollLock() {
  const root = typeof document !== "undefined" && document.documentElement;
  if (!root) return;
  root.classList.toggle("overlay-open", openOverlays.size > 0);
}

// The last opened one is the one Escape closes: overlays stack (the summary
// opens the picker), and the topmost is the one the user is looking at.
function topmost() {
  let last = null;
  for (const o of openOverlays) last = o;
  return last;
}

if (typeof document !== "undefined") {
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const top = topmost();
    if (!top?.dismissible) return;
    top.close();
    e.preventDefault();
  });
}

const FOCUSABLE = "button:not([disabled]), a[href], input, select, [tabindex]:not([tabindex='-1'])";

// Wrap an overlay element that already sits in the page markup.
// `dismissible` allows the backdrop and Escape to close it.
// `onClose` fires after the focus has gone home, so it may move it elsewhere.
// `initialFocus` is a selector for the control that should take the focus
// instead of the first one — the round summary leads with a trophy link, and
// Enter on it would send the child to the album instead of the next round.
export function overlayFrom(el, { dismissible = true, onClose, onOpen, initialFocus } = {}) {
  if (!el) return { open() {}, close() {}, isOpen: () => false, el: null };

  const sheet = el.querySelector(".sheet") ?? el;
  let opener = null;

  const handle = {
    el,
    dismissible,
    isOpen: () => openOverlays.has(handle),
    open() {
      if (handle.isOpen()) return;
      opener = document.activeElement;
      el.hidden = false;
      openOverlays.add(handle);
      syncScrollLock();
      onOpen?.();
      // The first control, not the sheet: a child tabbing forward should land
      // on something they can press, and a screen reader should read the title
      // it is already inside. `initialFocus` overrides the choice when the
      // first control is not the one to press.
      //
      // `preventScroll`: a tall sheet (the help guide) whose first control sits
      // below the fold would otherwise scroll to it on focus and open on its
      // last line. Focusing without scroll lets every overlay open at its top,
      // owned here rather than worked around per sheet.
      const wanted = initialFocus ? sheet.querySelector(initialFocus) : null;
      (wanted ?? sheet.querySelector(FOCUSABLE))?.focus({ preventScroll: true });
    },
    close() {
      if (!handle.isOpen()) return;
      el.hidden = true;
      openOverlays.delete(handle);
      syncScrollLock();
      // A hidden opener cannot take focus (the summary's own button opens the
      // picker), and the browser would drop it on <body>. onClose picks it up.
      if (opener?.isConnected && !opener.closest("[hidden]")) opener.focus();
      opener = null;
      onClose?.();
    },
  };

  if (dismissible) {
    el.addEventListener("click", (e) => {
      if (e.target === el) handle.close();
    });
  }
  return handle;
}

// Build an overlay from a sheet's inner markup and append it to the body.
export function createOverlay({ sheet = "", className = "", ...opts } = {}) {
  const el = document.createElement("div");
  el.className = className ? `overlay ${className}` : "overlay";
  el.hidden = true;
  el.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${sheet}</div>`;
  document.body.appendChild(el);
  return overlayFrom(el, opts);
}
