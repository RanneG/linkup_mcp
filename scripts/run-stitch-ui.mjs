#!/usr/bin/env node
/**
 * Resolve a local stitch-app monorepo and run an npm script from its root.
 * Prefers STITCH_APP_ROOT, then ../stitch-app next to linkup_mcp.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function isStitchMonorepoRoot(dir) {
  const pkg = path.join(dir, "package.json");
  if (!fs.existsSync(pkg)) return false;
  try {
    const j = JSON.parse(fs.readFileSync(pkg, "utf8"));
    return Array.isArray(j.workspaces) && j.workspaces.some((w) => String(w).includes("desktop"));
  } catch {
    return false;
  }
}

const envRoot = process.env.STITCH_APP_ROOT?.trim();
const candidates = [];
if (envRoot) candidates.push(path.resolve(envRoot));
candidates.push(path.resolve(repoRoot, "..", "stitch-app"));

const appRoot = candidates.find((p) => isStitchMonorepoRoot(p));
if (!appRoot) {
  console.error(`Stitch UI monorepo not found. Clone https://github.com/RanneG/stitch-app next to this repo (sibling folder stitch-app), or set STITCH_APP_ROOT to your stitch-app clone path.
See docs/stitch/MIGRATION.md and integrations/stitch/README.md.
`);
  process.exit(1);
}

const parts = process.argv.slice(2);
if (parts.length === 0) {
  console.error("Usage: node scripts/run-stitch-ui.mjs <npm-script> [args passed after --]\n");
  console.error("Examples:\n  node scripts/run-stitch-ui.mjs dev:browser\n  node scripts/run-stitch-ui.mjs tauri build");
  process.exit(1);
}

const script = parts[0];
const extra = parts.slice(1);
const useShell = process.platform === "win32";
const args = ["--prefix", appRoot, "run", script];
if (extra.length) args.push("--", ...extra);

console.error(`[run-stitch-ui] using: ${appRoot}\n`);
const r = spawnSync("npm", args, {
  stdio: "inherit",
  shell: useShell,
});
process.exit(typeof r.status === "number" ? r.status : 1);
