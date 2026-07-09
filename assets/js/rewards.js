// Motivation system (§8): stars, deterministic trophies, daily streak,
// site-wide fox level, map region states. Pure functions are exported for
// tests; the record/read functions use storage.js.

import { loadState, getRewards, setRewards } from "./storage.js";

export const GAMES = ["einmaleins", "tippen", "rechnungen", "vokabeln", "lesen"];

// Trophy s (1-indexed) is earned when the game's lifetime point counter reaches
// THRESHOLDS[s-1] (§8.3). Deterministic, no randomness.
//
// Balanced against einmaleins, whose 27 tiles are worth 360 points in total
// (§8.3): the last trophy lands at ~62 % of everything there is, so finishing
// the collection is a realistic goal rather than a grind.
// The first trophy must land in the first sitting. The cheapest thing a child
// can do — one Leicht tile taken to two stars — now pays 2, not 3, because the
// old "first mistake-free round" bonus moved onto mastery (§8.3).
export const THRESHOLDS = [2, 9, 18, 30, 46, 64, 86, 112, 142, 172, 200, 225];

// 12 fixed trophies per region (§8.3), themed. {e: emoji, de/en: name}.
export const TROPHIES = {
  einmaleins: [
    { e: "🔔", de: "Schulglocke", en: "School Bell" },
    { e: "🏠", de: "Häuschen", en: "Little House" },
    { e: "🧮", de: "Rechenschieber", en: "Abacus" },
    { e: "🥨", de: "Brezel", en: "Pretzel" },
    { e: "🐓", de: "Dorfhahn", en: "Village Rooster" },
    { e: "🪁", de: "Drachen", en: "Kite" },
    { e: "🎺", de: "Trompete", en: "Trumpet" },
    { e: "🐴", de: "Pony", en: "Pony" },
    { e: "⛲", de: "Dorfbrunnen", en: "Village Fountain" },
    { e: "🎪", de: "Dorffest", en: "Village Fair" },
    { e: "🌟", de: "Dorfstern", en: "Village Star" },
    { e: "👑", de: "Zahlenkönig", en: "Number King" },
  ],
  rechnungen: [
    { e: "🥾", de: "Wanderschuhe", en: "Hiking Boots" },
    { e: "🪨", de: "Glücksstein", en: "Lucky Stone" },
    { e: "⛺", de: "Zelt", en: "Tent" },
    { e: "🐐", de: "Bergziege", en: "Mountain Goat" },
    { e: "🦅", de: "Adler", en: "Eagle" },
    { e: "❄️", de: "Schneeflocke", en: "Snowflake" },
    { e: "🌄", de: "Sonnenaufgang", en: "Sunrise" },
    { e: "🦌", de: "Hirsch", en: "Deer" },
    { e: "🧗", de: "Kletterprofi", en: "Climbing Pro" },
    { e: "🏔️", de: "Gipfel", en: "Summit" },
    { e: "🚩", de: "Gipfelfahne", en: "Summit Flag" },
    { e: "👑", de: "Bergkönig", en: "Mountain King" },
  ],
  tippen: [
    { e: "💧", de: "Wassertropfen", en: "Water Drop" },
    { e: "🐸", de: "Frosch", en: "Frog" },
    { e: "🦆", de: "Ente", en: "Duck" },
    { e: "🐟", de: "Fisch", en: "Fish" },
    { e: "🐚", de: "Muschel", en: "Seashell" },
    { e: "🛶", de: "Kanu", en: "Canoe" },
    { e: "🎣", de: "Angel", en: "Fishing Rod" },
    { e: "⛵", de: "Segelboot", en: "Sailboat" },
    { e: "🌊", de: "Welle", en: "Wave" },
    { e: "🦢", de: "Schwan", en: "Swan" },
    { e: "🚤", de: "Flinkes Boot", en: "Speedy Boat" },
    { e: "👑", de: "Seekönig", en: "Lake King" },
  ],
  vokabeln: [
    { e: "🍄", de: "Fliegenpilz", en: "Toadstool" },
    { e: "🌰", de: "Kastanie", en: "Chestnut" },
    { e: "🐿️", de: "Eichhörnchen", en: "Squirrel" },
    { e: "🦔", de: "Igel", en: "Hedgehog" },
    { e: "🦉", de: "Eule", en: "Owl" },
    { e: "🦡", de: "Dachs", en: "Badger" },
    { e: "🫐", de: "Beeren", en: "Berries" },
    { e: "🦊", de: "Fuchsfreund", en: "Fox Friend" },
    { e: "🐺", de: "Wolf", en: "Wolf" },
    { e: "🌲", de: "Tanne", en: "Fir Tree" },
    { e: "🧚", de: "Waldfee", en: "Forest Fairy" },
    { e: "👑", de: "Waldkönig", en: "Forest King" },
  ],
  lesen: [
    { e: "🌼", de: "Blume", en: "Flower" },
    { e: "🐝", de: "Biene", en: "Bee" },
    { e: "🦋", de: "Schmetterling", en: "Butterfly" },
    { e: "🐞", de: "Marienkäfer", en: "Ladybug" },
    { e: "🐌", de: "Schnecke", en: "Snail" },
    { e: "🐇", de: "Hase", en: "Rabbit" },
    { e: "☀️", de: "Sonne", en: "Sun" },
    { e: "🎈", de: "Ballon", en: "Balloon" },
    { e: "🌈", de: "Regenbogen", en: "Rainbow" },
    { e: "📖", de: "Lieblingsbuch", en: "Favorite Book" },
    { e: "⭐", de: "Lesestern", en: "Reading Star" },
    { e: "👑", de: "Lesekönig", en: "Reading King" },
  ],
};

// Stamp a stable icon name on every trophy (used by the graphics registry).
// Additive only — the {e, de, en} fields are untouched.
for (const g of GAMES) TROPHIES[g].forEach((s, i) => { s.icon = `trophy-${g}-${i + 1}`; });

// Achievable stars per game, for map region states (§3.1). einmaleins: 27 tiles
// (Leicht offers only 4 tables + "Alle"; Mittel and Schwer offer all 10 + "Alle")
// × 3 stars = 81. It was 99, which counted tiles Leicht never shows — so the
// region could never reach "mastered" and its road could never pave itself.
export const ACHIEVABLE = { einmaleins: 81, rechnungen: 45, tippen: 120, vokabeln: 54, lesen: 9 };

// Cosmetic fox upgrades at fixed levels (§8.4).
export const COSMETICS = [
  [3, "scarf"], [6, "cap"], [9, "glasses"], [12, "backpack"],
  [15, "medal"], [18, "crown"], [20, "goldcrown"],
];

export const STREAK_MILESTONES = [3, 7, 14, 30];

// ---- pure functions -------------------------------------------------------

export function trophyCount(pr) {
  let n = 0;
  while (n < THRESHOLDS.length && (pr ?? 0) >= THRESHOLDS[n]) n++;
  return n;
}

// Points a finished round is worth (§8.3). Everything is derived from the
// tile's best-star count before and after, so nothing extra is stored:
//
//   · each NEW star                          1×   (play what you have not solved)
//   · mastering the tile (its third star)    3×   (a mistake-free round)
//
// each multiplied by the difficulty: Leicht ×1, Mittel ×2, Schwer ×3. A whole
// tile is therefore worth 6, 12 or 18 — the hard work pays three times the easy
// work, which is a gap a child can see on the tile and act on.
//
// A tile you have already mastered is worth nothing, so no amount of replaying
// the easiest level fills the Pokalraum. The mastery bonus needs no flag of its
// own: three stars *mean* 10/10 on the first try (§10.3).
//
// difficulty: 0 = Leicht, 1 = Mittel, 2 = Schwer.
export function roundPoints({ oldStars = 0, newStars = 0, difficulty = 0 } = {}) {
  if (!(newStars > oldStars)) return 0; // no improvement, no points
  const multiplier = difficulty + 1;
  let awards = newStars - oldStars;
  if (oldStars < 3 && newStars === 3) awards += 3;
  return awards * multiplier;
}

// What is still to be gained on one tile — the number a child sees on the tile
// in the picker, so the rules never have to be read (§10.2).
export function tilePointsLeft(stars = 0, difficulty = 0) {
  return roundPoints({ oldStars: stars, newStars: 3, difficulty });
}

function sumDigits(str) {
  let sum = 0;
  for (const ch of String(str)) {
    const d = Number.parseInt(ch, 10);
    if (Number.isInteger(d)) sum += d;
  }
  return sum;
}

// Stars of one game: its "stars" field is a digit string or an object whose
// values are digit strings (§9.2 per-game shapes).
export function gameStars(state, game) {
  const s = state?.[game]?.stars;
  if (!s) return 0;
  if (typeof s === "string") return sumDigits(s);
  if (typeof s === "object") return Object.values(s).reduce((a, v) => a + sumDigits(v), 0);
  return 0;
}

export function sumStars(state) {
  return GAMES.reduce((a, g) => a + gameStars(state, g), 0);
}

// Level = min(20, 1 + floor(totalStars / 10)) (§8.4).
export function foxLevel(totalStars) {
  return Math.min(20, 1 + Math.floor(totalStars / 10));
}

// Region visual state (§3.1): base → thriving (≥ 1/3) → mastered (100 %).
export function regionState(state, game) {
  const frac = gameStars(state, game) / ACHIEVABLE[game];
  if (frac >= 1) return "mastered";
  if (frac >= 1 / 3) return "thriving";
  return "base";
}

// Badge tier for the map star badges: 0 = none, 1 = some stars,
// 2 = >= 1/3 of achievable (gold), 3 = 100 % (glowing).
export function starBadgeTier(state, game) {
  const n = gameStars(state, game);
  if (n <= 0) return 0;
  const frac = n / ACHIEVABLE[game];
  return frac >= 1 ? 3 : frac >= 1 / 3 ? 2 : 1;
}

// Progress toward the next trophy of one game (pr = lifetime perfect rounds).
// Returns null once all 12 trophies are earned.
export function nextTrophyInfo(pr) {
  const earned = trophyCount(pr);
  if (earned >= THRESHOLDS.length) return null;
  return { earned, threshold: THRESHOLDS[earned], remaining: THRESHOLDS[earned] - (pr ?? 0) };
}

// Daily streak (§8.5): consecutive local calendar days.
export function updateStreak(prev, todayISO) {
  if (!Array.isArray(prev) || prev.length !== 2) return [todayISO, 1];
  const [last, count] = prev;
  if (last === todayISO) return [todayISO, count];
  const days = Math.round((Date.parse(todayISO) - Date.parse(last)) / 86400000);
  return days === 1 ? [todayISO, count + 1] : [todayISO, 1];
}

export function todayLocalISO(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ---- storage-backed functions ---------------------------------------------

export function levelInfo() {
  const total = sumStars(loadState());
  const level = foxLevel(total);
  const base = (level - 1) * 10;
  return {
    total,
    level,
    nextAt: level < 20 ? level * 10 : null,
    frac: level < 20 ? (total - base) / 10 : 1,
  };
}

// Called by games at the end of every round (§8). Updates fox map position,
// streak and perfect-round counters; returns what to celebrate.
export function recordRound(game, { points = 0 }) {
  const r = getRewards();
  const today = todayLocalISO();
  const prevCount = Array.isArray(r.streak) ? r.streak[1] : 0;
  const prevDate = Array.isArray(r.streak) ? r.streak[0] : null;
  const streak = updateStreak(r.streak, today);
  const pr = { ...(r.pr ?? {}) };
  let newTrophies = [];
  if (points > 0) {
    const before = trophyCount(pr[game]);
    pr[game] = (pr[game] ?? 0) + points;
    newTrophies = TROPHIES[game].slice(before, trophyCount(pr[game]));
  }
  setRewards({ at: game, streak, pr });
  const grew = streak[1] > prevCount || prevDate !== streak[0];
  return {
    newTrophies,
    streak,
    streakMilestone: grew && STREAK_MILESTONES.includes(streak[1]),
  };
}
