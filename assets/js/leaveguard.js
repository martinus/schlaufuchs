// The guard between a running round and the ways out of it (§10.7).
//
// Einmaleins writes nothing until `endRound()` — a round exists only in memory
// while it is played. Every way off the page therefore costs the whole round,
// and a child finds three of them by accident:
//
//   1. the Android back gesture (a swipe from the screen's edge),
//   2. the map button in the top bar, one tap away from the keypad,
//   3. pull-to-refresh — closed in CSS (`overscroll-behavior`), not here.
//
// **The back gesture cannot be disabled.** It belongs to the operating system,
// not to the page, and no web API suppresses it; `overscroll-behavior-x` is
// often named as the fix and is not one — it governs the browser's own
// overscroll navigation, which this site, never scrolling sideways, never
// triggers. What a page *can* do is own a history entry for the gesture to
// consume, so that going back lands inside this document instead of leaving it.
//
// That is the sentinel below. It is pushed once, and pushed again on every pop,
// so a child swiping twice in a second is caught twice. The page therefore never
// travels backwards on its own: when leaving is the answer, this module
// navigates to the map itself. The cost is that the browser's back stack for
// this page is a fiction; the gain is that there is no window in which the
// sentinel is missing and a swipe falls through it.

import { createOverlay } from "./overlay.js";
import { t } from "./i18n.js";

// What a leave attempt means, given what is on screen. Pulled out of the DOM so
// `node --test` can hold it: the three cases are the whole behaviour, and two of
// them (the second swipe, the swipe with no round running) are the ones that a
// browser test would be least likely to reach.
//
//   "stay"  — the question is already on screen; this gesture answers it with
//             "keep playing", the same as Escape on any other overlay.
//   "ask"   — a round is running; its stars are not saved yet.
//   "leave" — nothing is at stake: the picker, or a summary already written to
//             the cookie. Go, without a dialog nobody needs.
export function leaveAction({ inRound, confirmOpen }) {
  if (confirmOpen) return "stay";
  return inRound ? "ask" : "leave";
}

// `inRound()` is asked afresh on every attempt — the round starts and ends long
// after this guard is built. `mapUrl` is where an unanswered gesture goes.
// `onGo` fires when the child *confirms* the leave: the one moment the round
// mirror (§10.7, roundstore.js) must be dropped, because "Zur Karte" on the
// sheet means it — every other way off the page is an accident to resume from.
export function createLeaveGuard({ inRound, mapUrl, onGo }) {
  // Where the interrupted leave was headed. The back gesture aims at the map;
  // the top bar's button aims at its own href, which is the same place today
  // and need not stay that way.
  let target = mapUrl;

  const sheet = createOverlay({
    className: "leaveask",
    sheet: `<h2 class="lg-title"></h2>
      <p class="lg-body"></p>
      <button class="primary" id="lg-stay"></button>
      <button class="ghost" id="lg-go"></button>`,
    onOpen() {
      sheet.el.querySelector(".lg-title").textContent = t("leaveTitle");
      sheet.el.querySelector(".lg-body").textContent = t("leaveBody");
      sheet.el.querySelector("#lg-stay").textContent = t("leaveStay");
      sheet.el.querySelector("#lg-go").textContent = t("leaveGo");
    },
  });
  // The safe answer is the big orange one and it takes the focus (the overlay
  // focuses the first control): a child who presses Enter on a question she did
  // not ask keeps her round.
  sheet.el.querySelector("#lg-stay").addEventListener("click", sheet.close);
  sheet.el.querySelector("#lg-go").addEventListener("click", () => {
    onGo?.();
    location.href = target;
  });

  const arm = () => history.pushState({ sfGuard: true }, "");

  // `to` is the destination if this attempt is allowed through.
  function attempt(to) {
    target = to;
    switch (leaveAction({ inRound: inRound(), confirmOpen: sheet.isOpen() })) {
      case "stay": sheet.close(); break;
      case "ask": sheet.open(); break;
      case "leave": location.href = to; break;
    }
  }

  arm();
  addEventListener("popstate", () => {
    arm(); // before anything else: the next swipe must find a sentinel too
    attempt(mapUrl);
  });

  // Turn an anchor into the same question. The link keeps its href — it is a
  // real link, it says where it goes, and with JS broken it still works.
  function guardLink(a) {
    a?.addEventListener("click", (e) => {
      e.preventDefault();
      attempt(a.href);
    });
  }

  return { guardLink, attempt, overlay: sheet };
}
