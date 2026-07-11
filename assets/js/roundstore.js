// The round mirror (§10.7): one unfinished round per game, written into
// sessionStorage after every answer and read back on load. An interruption —
// an incoming call, an accidental edge swipe, a tab evicted under memory
// pressure — then costs nothing: the child returns and the fox is standing
// where she left it. The leave guard stays underneath as the answer for a
// *deliberate* exit, which clears the mirror (leaveguard.js `onGo`).
//
// sessionStorage on purpose, not localStorage: the mirror should live exactly
// as long as the browsing session that owns the round. A round resurrected a
// week later, over boxes the cookie has long moved past, would be a stale lie.
//
// Every touch wears a try: private modes and full quotas throw, and a mirror
// must never take the round down with it — losing the *mirror* only means the
// old behaviour, losing the ROUND to a reward-plumbing exception is the one
// unforgivable failure here.

const key = (game) => `schlaufuchs-round-${game}`;

export function saveRound(game, data) {
  try {
    sessionStorage.setItem(key(game), JSON.stringify(data));
  } catch {
    // storage refused: the guard still stands, the round just isn't mirrored
  }
}

export function loadRound(game) {
  try {
    const raw = sessionStorage.getItem(key(game));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearRound(game) {
  try {
    sessionStorage.removeItem(key(game));
  } catch {
    // nothing to do: if storage is unreadable, there is nothing to clear
  }
}
