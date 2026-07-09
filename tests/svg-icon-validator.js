// Pure validator for the SVG icons that back the graphics registry
// (assets/js/graphics.js). It enforces the machine-checkable items of the
// acceptance checklist in docs/GRAPHICS_BRIEF.md so a delivered icon set can be
// gated by `node --test` instead of eyeballed. Exported separately from the
// test file so the logic itself can be unit-tested with inline fixtures.
//
// Not checkable here (still needs a human): reads well at 24px AND 120px, and
// style/palette consistency.

const MAX_BYTES = 20 * 1024; // backstop: real vector icons are tiny; a big file
                             // usually means an embedded raster (brief: < 4 KB)

// Read an attribute value out of a tag's attribute string. Word-boundary
// anchored so `x=` does not match inside `rx=` / `max-...`.
function attr(attrs, name) {
  const m = attrs.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*["']([^"']*)["']`, "i"));
  return m ? m[1] : null;
}

// Read a CSS property out of an inline style="..." attribute.
function styleProp(attrs, prop) {
  const style = attr(attrs, "style");
  if (!style) return null;
  const m = style.match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, "i"));
  return m ? m[1].trim() : null;
}

const isTransparent = (v) => v != null && /^(none|transparent)$/i.test(v.trim());

// An href/src/url() value that points outside this file.
function isExternalRef(value) {
  const v = value.trim();
  if (v === "" || v.startsWith("#")) return false;   // internal anchor / gradient ref
  if (v.startsWith("data:")) return false;            // inline data (raster handled separately)
  if (/^(https?:)?\/\//i.test(v)) return true;        // absolute or protocol-relative URL
  if (/\.[a-z0-9]{2,5}([?#]|$)/i.test(v)) return true; // a file path with an extension
  return false;
}

// Validate one icon. Returns an array of human-readable problem strings
// (empty === valid). `bytes` is optional (Buffer length) for the size backstop.
export function validateSvgIcon(name, content, bytes) {
  const errors = [];
  const src = String(content ?? "");

  if (src.trim() === "") {
    return ["file is empty"];
  }
  if (!/<svg[\s>]/i.test(src) || !/<\/svg>/i.test(src)) {
    errors.push("not a standalone <svg> document");
  }
  if (!/viewBox\s*=\s*["']\s*0\s+0\s+64\s+64\s*["']/i.test(src)) {
    errors.push('viewBox must be "0 0 64 64"');
  }
  if (/<script[\s>]/i.test(src)) {
    errors.push("contains <script>");
  }
  if (/<foreignObject[\s>]/i.test(src)) {
    errors.push("contains <foreignObject>");
  }
  if (/data:image\/(png|jpe?g|gif|webp|bmp|tiff?)/i.test(src)) {
    errors.push("embeds a raster image (data: URI)");
  }
  if (/<image[\s>]/i.test(src)) {
    errors.push("contains <image> (embed the motif as vector paths)");
  }
  if (/<text[\s>]/i.test(src) || /font-family/i.test(src)) {
    errors.push("depends on a font / <text> (convert text to outline paths)");
  }
  if (/@import/i.test(src) || /<\?xml-stylesheet/i.test(src)) {
    errors.push("pulls in an external stylesheet");
  }

  // external references via href / src / xlink:href
  const refRe = /(?:xlink:href|href|src)\s*=\s*["']([^"']*)["']/gi;
  for (let m; (m = refRe.exec(src)); ) {
    if (isExternalRef(m[1])) errors.push(`external reference: ${m[1]}`);
  }
  // external references via url(...) in fills/styles
  const urlRe = /url\(\s*['"]?([^'")]+?)['"]?\s*\)/gi;
  for (let m; (m = urlRe.exec(src)); ) {
    if (isExternalRef(m[1])) errors.push(`external url() reference: ${m[1]}`);
  }

  // transparent background: reject an opaque rect covering the whole canvas
  const rectRe = /<rect\b([^>]*)>/gi;
  for (let m; (m = rectRe.exec(src)); ) {
    const a = m[1];
    const w = attr(a, "width");
    const h = attr(a, "height");
    const x = attr(a, "x") ?? "0";
    const y = attr(a, "y") ?? "0";
    const fullW = w === "100%" || (w != null && Number.parseFloat(w) >= 64);
    const fullH = h === "100%" || (h != null && Number.parseFloat(h) >= 64);
    const atOrigin = Number.parseFloat(x) <= 0 && Number.parseFloat(y) <= 0;
    if (!(fullW && fullH && atOrigin)) continue;

    const fill = styleProp(a, "fill") ?? attr(a, "fill"); // default SVG fill is opaque black
    const fillOpacity = styleProp(a, "fill-opacity") ?? attr(a, "fill-opacity");
    const opacity = styleProp(a, "opacity") ?? attr(a, "opacity");
    const invisible =
      isTransparent(fill) ||
      Number.parseFloat(fillOpacity) === 0 ||
      Number.parseFloat(opacity) === 0;
    if (!invisible) {
      errors.push("opaque full-canvas <rect> (background must be transparent)");
      break;
    }
  }

  if (typeof bytes === "number" && bytes > MAX_BYTES) {
    errors.push(`file too large (${bytes} bytes > ${MAX_BYTES}); likely not a clean vector`);
  }

  return errors;
}
