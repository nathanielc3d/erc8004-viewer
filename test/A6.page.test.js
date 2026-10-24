import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../style.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");

test("A6 viewport meta and a page usable at 360 px (no fixed width above 360 px)", () => {
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
  const widths = [...css.matchAll(/(?<![-\w])(?:min-)?width:\s*(\d+)px/g)].map((m) => Number(m[1]));
  for (const w of widths) assert.ok(w <= 360, `fixed width ${w}px`);
  assert.match(css, /max-width:\s*760px/);
  assert.match(css, /@media \(max-width: 420px\)/);
  assert.match(css, /overflow-wrap:\s*anywhere/);
});

test("A6 light and dark themes (system preference and a manual switch)", () => {
  assert.match(css, /@media \(prefers-color-scheme: dark\)/);
  assert.match(css, /:root\[data-theme="light"\]/);
  assert.match(css, /:root\[data-theme="dark"\]/);
  assert.match(html, /<meta name="color-scheme" content="light dark">/);
});

test("A6 the page shows name, description, image, endpoints, supported trust, count, average and latest entries", () => {
  for (const s of ["name", "description", "image", "endpoints", "supportedTrust"]) assert.match(app, new RegExp(`g\\??\\.${s}\\b`), s);
  for (const s of ["f.count", "f.average", "f.items", "No feedback yet", "No such agent", "Could not load"]) assert.ok(app.includes(s), s);
  assert.ok(!/innerHTML/.test(app), "text only rendering");
});

test("A6 house rules: Latin digits and no long dashes in text people see", () => {
  for (const t of [html, app, readFileSync(new URL("../README.md", import.meta.url), "utf8")]) {
    assert.ok(!/[\u2013\u2014]/.test(t), "long dash");
    assert.ok(!/[\u0660-\u0669\u06F0-\u06F9]/.test(t), "non Latin digits");
  }
});
