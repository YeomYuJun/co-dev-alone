/**
 * Template manifest — single source of truth for scaffolded files.
 *
 * Shared between codev_init (first install) and codev_sync (reconcile).
 * Add new templates here, not inline in tool handlers.
 */

export interface TemplateEntry {
  /** Logical name for sync reports */
  name: string;
  /** Path relative to src/templates/ */
  templatePath: string;
  /** Install path relative to project root (cwd) */
  installPath: string;
}

export const TEMPLATES: readonly TemplateEntry[] = [
  { name: "COLLABO.md", templatePath: "COLLABO.md", installPath: "co-dev/COLLABO.md" },
  { name: "ROLE-GUIDE.md", templatePath: "ROLE-GUIDE.md", installPath: "co-dev/ROLE-GUIDE.md" },
  { name: "TASK.md", templatePath: "TASK.md", installPath: "co-dev/TASK.md" },
  { name: "EVAL-CRITERIA.md", templatePath: "EVAL-CRITERIA.md", installPath: "co-dev/EVAL-CRITERIA.md" },
  { name: "dev-state.md", templatePath: "dev-state.md", installPath: "co-dev/communication/dev-state.md" },
  { name: "eval-state.md", templatePath: "eval-state.md", installPath: "co-dev/communication/eval-state.md" },
  {
    name: "co-dev-convention-checker (agent)",
    templatePath: "agents/co-dev-convention-checker.md",
    installPath: ".claude/agents/co-dev-convention-checker.md",
  },
];
