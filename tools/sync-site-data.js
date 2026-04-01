/**
 * Regenerates assets/data/site-data.js from assets/data/content.json
 * so opening index.html via file:// works (browsers block fetch() there).
 * Run from repo root: node tools/sync-site-data.js
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const jsonPath = path.join(root, "assets", "data", "content.json");
const outPath = path.join(root, "assets", "data", "site-data.js");

const raw = fs.readFileSync(jsonPath, "utf8");
JSON.parse(raw); // validate
const banner =
  "/* Generated from content.json — edit that file, then run: node tools/sync-site-data.js */\n";
fs.writeFileSync(outPath, banner + "window.__SITE_CONTENT__ = " + raw.trim() + ";\n");
console.log("Wrote", path.relative(root, outPath));
