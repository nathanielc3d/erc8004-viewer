// Copies the static site into dist/ for Cloudflare Workers static assets (wrangler deploy).
import { mkdirSync, copyFileSync, rmSync } from "node:fs";
rmSync("dist", { recursive: true, force: true });
mkdirSync("dist");
for (const f of ["index.html", "style.css", "app.js", "viewer.js", "config.js"]) copyFileSync(f, `dist/${f}`);
console.log("dist/ ready");
