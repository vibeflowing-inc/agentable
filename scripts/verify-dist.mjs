#!/usr/bin/env node
/**
 * Verifies that every file path declared in the current package's `main`,
 * `module`, `types`, and `exports` map actually exists on disk inside `dist/`.
 *
 * Run from each package's root via the `prepublishOnly` script. If anything
 * is missing (e.g. tsup forgot to emit `.d.ts` files), this exits non-zero
 * so `pnpm publish` aborts before pushing a broken tarball to npm.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const cwd = process.cwd();
const pkgPath = resolve(cwd, "package.json");

if (!existsSync(pkgPath)) {
  console.error(`[verify-dist] No package.json found in ${cwd}`);
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const required = new Set();

const collect = (val) => {
  if (typeof val === "string" && val.startsWith("./")) required.add(val);
  else if (val && typeof val === "object")
    for (const v of Object.values(val)) collect(v);
};

for (const field of ["main", "module", "types", "typings"]) {
  if (pkg[field]) collect(pkg[field]);
}
collect(pkg.exports);

const missing = [];
for (const rel of required) {
  const abs = resolve(cwd, rel);
  if (!existsSync(abs)) missing.push(rel);
}

if (missing.length > 0) {
  console.error(
    `\n[verify-dist] ${pkg.name}@${pkg.version} is missing ${missing.length} declared file(s):`,
  );
  for (const m of missing) console.error(`  - ${m}`);
  console.error(
    "\nThe build is incomplete. Did tsup fail to emit .d.ts files? Aborting publish.\n",
  );
  process.exit(1);
}

console.log(
  `[verify-dist] ${pkg.name}@${pkg.version}: all ${required.size} declared file(s) present.`,
);
