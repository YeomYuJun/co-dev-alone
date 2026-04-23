#!/usr/bin/env node
/**
 * Bundle plugin/ into plugin/co-dev.plugin as a ZIP archive.
 *
 * Uses POSIX forward-slash paths so the output matches what a Linux
 * `zip` command would produce — Windows PowerShell's Compress-Archive
 * emits backslashes which some plugin loaders reject.
 *
 * Usage: `npm run bundle:plugin`
 *
 * Paths included (relative to plugin/):
 *   .claude-plugin/ , commands/ , skills/ , README.md
 *
 * The output file itself and any other *.plugin artifacts are excluded.
 */

import AdmZip from "adm-zip";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginDir = join(__dirname, "..", "plugin");
const outputPath = join(pluginDir, "co-dev.plugin");

const INCLUDE = [".claude-plugin", "commands", "skills", "README.md"];

function toPosix(p) {
  return p.split(sep).join("/");
}

const zip = new AdmZip();

function addDir(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const s = statSync(full);
    if (s.isDirectory()) {
      addDir(full);
    } else {
      const rel = toPosix(relative(pluginDir, full));
      zip.addFile(rel, readFileSync(full));
    }
  }
}

for (const item of INCLUDE) {
  const full = join(pluginDir, item);
  const s = statSync(full);
  if (s.isFile()) {
    zip.addFile(item, readFileSync(full));
  } else if (s.isDirectory()) {
    addDir(full);
  }
}

zip.writeZip(outputPath);

const size = statSync(outputPath).size;
const count = zip.getEntries().length;
console.log(`[bundle:plugin] Wrote ${relative(process.cwd(), outputPath)}  ${count} files, ${size} bytes`);
