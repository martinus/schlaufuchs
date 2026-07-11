// Where the fox stands on the island, and how it gets there (§3.1).
//
// Mara tapped the Trophy Room and the page simply swapped. The fox — who is her
// on this map — stayed behind, and nothing tied the island she left to the room
// she landed in. Now she watches herself walk there, and when she comes back
// the fox is standing where she has been.
//
// The arithmetic is here, apart from the DOM, so `node --test` can hold it to
// the two promises the animation makes: a walk starts where the fox is and ends
// exactly on the anchor she tapped, with both feet on the ground at each end.

// Fox anchor per region — the spot the fox occupies when it is *at* that place.
// The Trophy Room's is beside its house, not on it: the fox is drawn after every
// region, so an anchor on the shelf would paint the fox over the trophies.
export const ANCHORS = {
  einmaleins: [170, 372],
  rechnungen: [282, 196],
  tippen: [300, 266],
  vokabeln: [88, 198],
  lesen: [78, 490],
  pokalraum: [220, 498],
};

// A walk is hops, not a slide. Three of them, damped to nothing at both ends so
// the fox is never caught mid-air at the moment it arrives or departs.
const HOPS = 3;
const HOP_HEIGHT = 9; // map units
const MS_PER_UNIT = 3.2;
const MIN_MS = 420;
const MAX_MS = 1100;

// Long enough that a child sees the fox travel, short enough that a child who
// wants to play is not made to watch it (§15).
export function walkMs(from, to) {
  const d = Math.hypot(to[0] - from[0], to[1] - from[1]);
  return Math.round(Math.min(MAX_MS, Math.max(MIN_MS, d * MS_PER_UNIT)));
}

// The fox's position at progress `p` (0 → from, 1 → to).
export function walkPoint(from, to, p) {
  const c = Math.min(1, Math.max(0, p));
  const ease = c < 0.5 ? 2 * c * c : 1 - ((-2 * c + 2) ** 2) / 2;
  const x = from[0] + (to[0] - from[0]) * ease;
  const y = from[1] + (to[1] - from[1]) * ease;
  const hop = Math.abs(Math.sin(c * Math.PI * HOPS)) * Math.sin(c * Math.PI) * HOP_HEIGHT;
  return [x, y - hop];
}
