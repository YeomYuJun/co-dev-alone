/**
 * Unit tests for roleParser.ts (compiled to out/roleParser.js)
 * Usage: node test-role-parser.cjs  (from vscode-for-co-dev-launcher/)
 *
 * No external test framework required.
 */

"use strict";

const { parseRoles } = require("./out/roleParser.js");
const { readFileSync } = require("fs");
const { join } = require("path");

let passed = 0;
let failed = 0;

function ok(label, condition) {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else           { console.error(`  ✗ ${label}`); failed++; }
}

function section(title) { console.log(`\n── ${title} ──`); }

// ── 1. Basic parsing ──────────────────────────────────────────────────────────

section("Basic role parsing");

const basic = `
## Developer Session

You are a developer. Build things.

---

## Evaluator Session

You are an evaluator. Review things.
`.trim();

const basicRoles = parseRoles(basic);
ok("parses 2 roles",                 basicRoles.length === 2);
ok("first role name is 'Developer Session'",  basicRoles[0]?.name === "Developer Session");
ok("second role name is 'Evaluator Session'", basicRoles[1]?.name === "Evaluator Session");
ok("developer prompt has content",   basicRoles[0]?.prompt.includes("developer"));
ok("evaluator prompt has content",   basicRoles[1]?.prompt.includes("evaluator"));
ok("separator (---) removed from prompt", !basicRoles[0]?.prompt.includes("---"));

// ── 2. Empty / edge cases ─────────────────────────────────────────────────────

section("Edge cases");

ok("empty string → 0 roles", parseRoles("").length === 0);
ok("no ## headers → 0 roles", parseRoles("just some text\nno headers").length === 0);
ok("### subheaders ignored as role", parseRoles("### Not a role\ncontent").length === 0);

const singleRole = "## Solo Role\nSolo content here";
const soloRoles = parseRoles(singleRole);
ok("single role parsed correctly", soloRoles.length === 1);
ok("single role name correct",     soloRoles[0]?.name === "Solo Role");
ok("single role prompt correct",   soloRoles[0]?.prompt === "Solo content here");

// ── 3. Whitespace handling ────────────────────────────────────────────────────

section("Whitespace handling");

const spaced = `

## My Role

  Content with leading spaces.

More content.


## Other Role
Content.
`;

const spacedRoles = parseRoles(spaced);
ok("leading/trailing whitespace trimmed from prompt", !spacedRoles[0]?.prompt.startsWith("\n"));
ok("inner content preserved", spacedRoles[0]?.prompt.includes("Content with leading spaces"));
ok("multi-line content kept",  spacedRoles[0]?.prompt.includes("More content"));

// ── 4. Template file parsing (ROLE-GUIDE.md) ──────────────────────────────────

section("ROLE-GUIDE.md template parsing");

const templatePath = join(__dirname, "..", "src", "templates", "ROLE-GUIDE.md");
let templateRoles = [];
try {
  const content = readFileSync(templatePath, "utf-8");
  templateRoles = parseRoles(content);
} catch (e) {
  console.error("  ! Could not read template:", e.message);
}

ok("template parses at least 2 roles", templateRoles.length >= 2);

const devRole  = templateRoles.find(r => r.name.toLowerCase().includes("developer"));
const evalRole = templateRoles.find(r => r.name.toLowerCase().includes("evaluator"));
ok("finds Developer role in template",  devRole !== undefined);
ok("finds Evaluator role in template",  evalRole !== undefined);
ok("Developer prompt mentions codev_check_inbox", devRole?.prompt.includes("codev_check_inbox") ?? false);
ok("Evaluator prompt mentions codev_mark_done",   evalRole?.prompt.includes("codev_mark_done") ?? false);
ok("Developer prompt mentions TASK.md",           devRole?.prompt.includes("TASK.md") ?? false);

// ── 5. Role slug detection (extension logic) ──────────────────────────────────

section("Role slug detection (used by extension)");

// Simulate the slug detection logic from extension.ts
function isDevRole(name) { return name.toLowerCase().includes("developer"); }
function isEvalRole(name) { return name.toLowerCase().includes("evaluator"); }

ok("'Developer 역할' → isDevRole",   isDevRole("Developer 역할"));
ok("'Evaluator 역할' → isEvalRole",  isEvalRole("Evaluator 역할"));
ok("'Developer Session' → isDevRole",isDevRole("Developer Session"));
ok("'Other Role' → neither",
  !isDevRole("Other Role") && !isEvalRole("Other Role"));

// ── summary ──────────────────────────────────────────────────────────────────

console.log(`\n── Result: ${passed} passed, ${failed} failed ──\n`);
if (failed > 0) process.exit(1);
