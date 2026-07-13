# Schlaufuchs 🦊

**Spielerisch lernen und ein Schlaufuchs werden** — a collection of educational
browser games for children (roughly ages 5–15), framed as an illustrated world
map you explore one region at a time.

**Live:** https://schlaufuchs.ankerl.com

The whole site is static: vanilla HTML, CSS and JavaScript with **no build step,
no dependencies and no framework**. All progress lives client-side in a single
cookie — no accounts, no analytics, no external requests at runtime. Every page
ships in **German and English**.

## What it looks like

The homepage is a hand-drawn world map. Each region is a game; tapping one walks
the fox there and starts a round. A round is a little journey along a path: the
fox advances on every answer, stars fly into a basket at the end, and mastering a
level earns a trophy for the Trophy Room. A wrong answer never costs anything —
the site motivates, it never punishes.

## The games

| Region (EN / DE) | Teaches | Status |
| --- | --- | --- |
| **Times tables** / Einmaleins | Multiplication facts, choice- and keypad-based | ✅ Playable |
| **Math Mountain** / Rechenberg | Arithmetic within 100: ＋ − with carrying, division with remainder (÷R), number walls (Rechenmauern 🧱), operation grids (Rechenquadrate ⊞) and a mixed mode | ✅ Playable |
| **Reading Meadow** / Lesewiese | Reading: flash words (Blitzwörter) and silly-sentence comprehension (Quatsch-Sätze) | ✅ Playable |
| **Typing Lake** / Tippsee | Keyboard / typing | 🚧 Stub |
| **Word Forest** / Wörterwald | Vocabulary | 🚧 Stub |
| **Trophy Room** / Pokalraum | The album of everything won so far | ✅ |

Each game has three explicit difficulty levels (Leicht / Mittel / Schwer) and is
backed by a shared, Leitner-style adaptive engine that quietly practises whatever
a child struggles with more often.

## Getting started

Requires **Node 22+** (only for the tests and tooling — the site itself needs
nothing). Because the site uses ES modules, it must be served over HTTP; opening
the files via `file://` will not work.

```sh
sh tools/serve.sh      # serve the site on http://localhost:8000
sh tools/kill-serve.sh # stop it again
node --test            # run the unit tests (tests/*.test.js)
```

Then open http://localhost:8000 and play.

## Project layout

```
index.html            the world map (inline SVG), the entry point
album.html            the trophy album
about/privacy/parents supporting pages
assets/
  css/                one shared design-system stylesheet
  js/                 shared modules (map, storage, rewards, i18n, journey, …)
  i18n/               de.js / en.js string dictionaries
  img/                icons and art
games/<name>/         one folder per game: index.html + <name>.js + logic + i18n
tools/                serve, screenshot, and the PR/deploy helpers
tests/                node --test unit tests (no browser needed)
docs/                 the specification and design notes
```

## How it's built & deployed

- **No build, no bundler, no dependencies.** Small vanilla ES modules with
  relative imports. `node --test` is the only gate.
- **State** is a single ~3.5 KB cookie (`assets/js/storage.js`).
- **Graphics** go through an icon registry with emoji fallbacks, so the site is
  fully playable before any custom art is dropped in.
- **Deployment** is automatic: every push to `main` runs the tests and, on
  green, publishes to **GitHub Pages**. Each deploy stamps a cache-busting asset
  version (derived from the commit count) into every page, and a post-deploy
  **smoke test drives both Chrome and Firefox over every page** to catch
  cross-engine regressions before a child ever sees them.

## Documentation

- [`docs/SPEC.md`](docs/SPEC.md) — the authoritative product specification.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — the code map: layers,
  dependency rules, testing kinds, and how to add a game.
- [`docs/NEW_GAME.md`](docs/NEW_GAME.md) — the checklist for shipping a new game.
- [`CLAUDE.md`](CLAUDE.md) — orientation for an AI agent working on the repo.

---

A personal project by [Martin Leitner-Ankerl](https://github.com/martinus),
built for and play-tested with his kids.
