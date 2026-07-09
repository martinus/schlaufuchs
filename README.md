# schlaufuchs

Spielerisch lernen und ein Schlaufuchs werden — https://schlaufuchs.ankerl.com

Educational browser games for children, framed as an illustrated world map.
Fully static (vanilla HTML/CSS/JS, no build step), hosted on GitHub Pages,
all progress stored client-side in a single cookie. See
[docs/SPEC.md](docs/SPEC.md) for the full specification, and
[CLAUDE.md](CLAUDE.md) for an agent-oriented project orientation.

## Development

```sh
python3 -m http.server 8000   # serve the site locally
node --test                   # run the unit tests (requires Node 22+)
```

No dependencies, no build. Open http://localhost:8000 and play.
