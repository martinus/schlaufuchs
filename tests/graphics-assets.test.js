import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { AVAILABLE, GRAPHICS } from "../assets/js/graphics.js";
import { validateSvgIcon } from "./svg-icon-validator.js";

const ICON_DIR = new URL("../assets/img/icons/", import.meta.url);
const ICON_DIR_PATH = fileURLToPath(ICON_DIR);

// A minimal icon that satisfies every machine-checkable rule.
const VALID =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
  '<circle cx="32" cy="32" r="22" fill="#e8590c"/></svg>';

// ---- validator unit tests (run even with no assets delivered) --------------

test("a clean icon passes", () => {
  assert.deepEqual(validateSvgIcon("ok", VALID), []);
});

test("an internal gradient reference is allowed", () => {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
    '<defs><linearGradient id="g"><stop offset="0" stop-color="#fff"/></linearGradient></defs>' +
    '<rect x="8" y="8" width="48" height="48" fill="url(#g)"/></svg>';
  assert.deepEqual(validateSvgIcon("grad", svg), []);
});

const hasError = (errs, needle) => errs.some((e) => e.includes(needle));

test("wrong viewBox is rejected", () => {
  const svg = VALID.replace("0 0 64 64", "0 0 128 128");
  assert.ok(hasError(validateSvgIcon("x", svg), "viewBox"));
});

test("missing <svg> root is rejected", () => {
  assert.ok(hasError(validateSvgIcon("x", "<circle r='1'/>"), "standalone"));
});

test("<script> is rejected", () => {
  const svg = VALID.replace("</svg>", '<script>alert(1)</script></svg>');
  assert.ok(hasError(validateSvgIcon("x", svg), "<script>"));
});

test("embedded raster (data: URI) is rejected", () => {
  const svg = VALID.replace(
    "</svg>",
    '<image href="data:image/png;base64,AAAA" x="0" y="0" width="64" height="64"/></svg>',
  );
  const errs = validateSvgIcon("x", svg);
  assert.ok(hasError(errs, "raster"));
  assert.ok(hasError(errs, "<image>"));
});

test("external reference is rejected", () => {
  const svg = VALID.replace("</svg>", '<use href="https://ex.com/a.svg#i"/></svg>');
  assert.ok(hasError(validateSvgIcon("x", svg), "external reference"));
});

test("external file path is rejected", () => {
  const svg = VALID.replace("</svg>", '<use href="../other.svg#i"/></svg>');
  assert.ok(hasError(validateSvgIcon("x", svg), "external reference"));
});

test("external url() in a fill is rejected", () => {
  const svg = VALID.replace('fill="#e8590c"', 'fill="url(https://ex.com/p.svg#p)"');
  assert.ok(hasError(validateSvgIcon("x", svg), "external url()"));
});

test("<text> / font dependency is rejected", () => {
  const svg = VALID.replace("</svg>", "<text>hi</text></svg>");
  assert.ok(hasError(validateSvgIcon("x", svg), "font"));
});

test("opaque full-canvas background rect is rejected", () => {
  const svg = VALID.replace(
    "<circle",
    '<rect x="0" y="0" width="64" height="64" fill="#fff"/><circle',
  );
  assert.ok(hasError(validateSvgIcon("x", svg), "background"));
});

test("full-canvas rect with a default (unset) fill is rejected", () => {
  const svg = VALID.replace("<circle", '<rect width="64" height="64"/><circle');
  assert.ok(hasError(validateSvgIcon("x", svg), "background"));
});

test("a transparent full-canvas rect is allowed", () => {
  const svg = VALID.replace("<circle", '<rect width="64" height="64" fill="none"/><circle');
  assert.deepEqual(validateSvgIcon("x", svg), []);
});

test("oversized file is rejected via the byte backstop", () => {
  assert.ok(hasError(validateSvgIcon("x", VALID, 999_999), "too large"));
});

// ---- real asset gate (enforced as soon as AVAILABLE has entries) -----------

test("every AVAILABLE icon has a file that passes the checklist", () => {
  for (const name of [...AVAILABLE].sort()) {
    const file = new URL(`${name}.svg`, ICON_DIR);
    assert.ok(fs.existsSync(file), `missing icon file: assets/img/icons/${name}.svg`);
    const content = fs.readFileSync(file, "utf8");
    const bytes = fs.statSync(file).size;
    const errs = validateSvgIcon(name, content, bytes);
    assert.deepEqual(errs, [], `assets/img/icons/${name}.svg: ${errs.join("; ")}`);
  }
});

test("every SVG file in assets/img/icons matches a registry name", () => {
  if (!fs.existsSync(ICON_DIR_PATH)) return; // no assets delivered yet
  for (const f of fs.readdirSync(ICON_DIR_PATH)) {
    if (!f.endsWith(".svg")) continue;
    const name = f.slice(0, -4);
    assert.ok(GRAPHICS[name], `stray file: ${f} matches no name in the graphics registry`);
  }
});
