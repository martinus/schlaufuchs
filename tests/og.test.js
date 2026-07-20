// Link previews: every deployed page must carry the social-sharing tags, or a
// shared link renders blank. This was true of index.html alone for a while —
// album, the games and the reader pages (about/parents/privacy) shipped without
// any, so a directly shared game link showed nothing.
//
// The tags are hand-authored per page on purpose: their invariant part is frozen
// content with no version churn, so unlike the importmap they do not belong in
// version-assets.js (that tool exists for per-deploy version stamping). The one
// thing that can then rot is a NEW page forgetting the block. This file is that
// guard — discovery via tests/pages.js, not a list, so a new page joins it the
// moment it exists (the same way topbar/cache tests pin their per-page shape).

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { PAGES, read, abs } from "./pages.js";

const PROD = "https://schlaufuchs.ankerl.com/";

// The content of a <meta name=".."> or <meta property=".."> tag.
const meta = (html, key) =>
  html.match(new RegExp(`<meta (?:name|property)="${key}" content="([^"]*)"`))?.[1];

test("every page carries a description and an absolute canonical URL", () => {
  for (const page of PAGES) {
    const html = read(page);
    const desc = meta(html, "description");
    assert.ok(desc?.length, `${page}: no non-empty <meta name="description">`);
    const canon = html.match(/<link rel="canonical" href="([^"]*)"/)?.[1];
    assert.ok(canon?.startsWith(PROD), `${page}: canonical missing or not an absolute production URL`);
  }
});

test("every page carries a full link-preview block (Open Graph + Twitter)", () => {
  for (const page of PAGES) {
    const html = read(page);
    for (const key of ["og:title", "og:description", "og:url", "og:image", "twitter:card"]) {
      assert.ok(meta(html, key)?.length, `${page}: missing ${key}`);
    }
    // A crawler needs a full URL: a relative og:image / og:url silently breaks
    // the preview (the reason the block carries absolute URLs — see index.html).
    assert.ok(meta(html, "og:url").startsWith(PROD), `${page}: og:url is not absolute`);
    assert.ok(meta(html, "og:image").startsWith("https://"), `${page}: og:image is not absolute`);
    // og:url and canonical name the same page; they must agree.
    const canon = html.match(/<link rel="canonical" href="([^"]*)"/)?.[1];
    assert.equal(meta(html, "og:url"), canon, `${page}: og:url and canonical disagree`);
  }
});

test("the one shared preview image the pages point at exists in the repo", () => {
  // Every page uses the single site image; pin that the file is really there —
  // the way cache.test pins the assets a page names. A renamed or deleted image
  // is blank previews everywhere, invisible until someone shares a link.
  const imgs = new Set(PAGES.map((p) => meta(read(p), "og:image")));
  assert.equal(imgs.size, 1, "pages disagree on the preview image");
  assert.ok([...imgs][0].endsWith("/assets/img/og-image.jpg"), "unexpected preview image path");
  assert.ok(existsSync(abs("assets/img/og-image.jpg")), "the preview image is missing from the repo");
});
