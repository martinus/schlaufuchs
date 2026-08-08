// The drachen level picker (§21, §3.3): the shared picker
// (assets/js/levelpicker.js — tiles, fox, walk-then-open) over this game's
// tiles. What is drachen's own: a tile is one STORY, and the stars it still has
// to give are the endings she has not found yet — which is why the picker needs
// no special case at all. Three stories per difficulty, one row.
//
// There is no tempo ladder here (§21), so every tile reports tier 0 and the
// corner stays empty — the picker's designed tier-0 state, never a snail.

import { createLevelPicker as sharedPicker } from "../../assets/js/levelpicker.js";
import { getGame } from "../../assets/js/storage.js";
import { tilePointsLeft } from "../../assets/js/rewards.js";
import { STORIES } from "./content.js";
import { storiesFor, endMask, foundCount } from "./logic.js";

// The tile's FACE: the story's emoji over its title. The picker tile is a third
// of a phone wide, so the emoji carries the recognition and the title only
// confirms it — a child finds "the one with the egg" long before she reads it.
export function storyFace(story) {
  return `<span class="story-e" aria-hidden="true">${story.e}</span>`
    + `<span class="story-t">${story.title}</span>`;
}

export function createLevelPicker(el, { current, onPick, onDismiss }) {
  return sharedPicker(el, {
    // No remap: the shared picker's tile id is opaque, and drachen's tile id IS
    // the story index. The three older adapters rename a field here only
    // because their game modules predate that contract.
    current,
    onPick,
    onDismiss,
    tilesFor(d) {
      // read the store as it is now, not as it was when the game loaded
      const masks = getGame("drachen").e ?? {};
      return storiesFor(d, STORIES.de).map((story, i) => ({
        id: i,
        face: storyFace(story),
        name: story.title,
        left: tilePointsLeft(foundCount(endMask(masks[d], i)), d),
        tempo: 0,
      }));
    },
  });
}
