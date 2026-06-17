#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, cpSync, mkdirSync, rmSync, readdirSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const spacerocksRoot = resolve(scriptDir, "..");
const vecsRoot = resolve(process.env.VECS_ROOT ?? resolve(spacerocksRoot, "..", "vecs"));

const builds = [
  "@vworlds/vecs",
  "@vworlds/vecs-physics",
  "@vworlds/vecs-wire",
  "@vworlds/vecs-protocol",
  "@vworlds/vecs-client",
  "@vworlds/vecs-server",
];

// Packages whose compiled `dist/` is published flattened to the package root
// (so node_modules/<pkg>/index.js rather than .../dist/index.js). These are
// overlaid entry-by-entry onto the installed package so package.json survives.
// vecs-protocol/client/server all build flat and resolve @vworlds/vecs-protocol
// from the hoisted top-level install (no vendored copy inside client/server).
const packageRootCopies = [
  ["lib/vecs-physics/dist", "node_modules/@vworlds/vecs-physics"],
  ["lib/vecs-protocol/dist", "node_modules/@vworlds/vecs-protocol"],
  ["lib/vecs-client/dist", "node_modules/@vworlds/vecs-client"],
  ["lib/vecs-server/dist", "node_modules/@vworlds/vecs-server"],
];

// Packages that keep a nested published layout (main points below the root), so
// the build output maps to a subdirectory of the installed package.
const copies = [
  ["lib/vecs/dist", "node_modules/@vworlds/vecs/dist"],
  ["lib/vecs-wire/dist/vecs-wire/src", "node_modules/@vworlds/vecs-wire/vecs-wire/src"],
];

const viteCaches = [
  "node_modules/.vite",
  "apps/client/node_modules/.vite",
  "packages/common/node_modules/.vite",
  "apps/server/node_modules/.vite",
];

if (!existsSync(resolve(vecsRoot, "package.json"))) {
  throw new Error(`Could not find vecs repo at ${vecsRoot}. Set VECS_ROOT=/path/to/vecs.`);
}

for (const workspace of builds) {
  run("npm", ["run", "build", "-w", workspace], vecsRoot);
}

for (const [from, to] of copies) {
  copyDir(resolve(vecsRoot, from), resolve(spacerocksRoot, to));
}

for (const [from, to] of packageRootCopies) {
  overlayDir(resolve(vecsRoot, from), resolve(spacerocksRoot, to));
}

// Vite pre-bundles dependencies into an optimized cache keyed by package
// version, not file content, so copying fresh files into node_modules above does
// NOT invalidate it -- a running (or restarted) dev server keeps serving the old
// bundle. Drop every .vite cache so the next `vite` start re-optimizes the
// freshly copied @vworlds/* packages.
for (const cache of viteCaches) {
  const dir = resolve(spacerocksRoot, cache);
  if (existsSync(dir)) {
    console.log(`clear vite cache ${dir}`);
    rmSync(dir, { recursive: true, force: true });
  }
}

console.log("Hot-updated spacerocks node_modules from", vecsRoot);
console.log("Restart the dev server (vite) and game server, then hard-reload the browser.");

function run(command, args, cwd) {
  console.log(`> ${command} ${args.join(" ")}`);
  execFileSync(command, args, { cwd, stdio: "inherit" });
}

function copyDir(source, target) {
  if (!existsSync(source)) {
    throw new Error(`Build output missing: ${source}`);
  }
  if (!existsSync(target)) {
    throw new Error(`Spacerocks package target missing: ${target}`);
  }
  console.log(`copy ${source} -> ${target}`);
  rmSync(target, { recursive: true, force: true });
  mkdirSync(dirname(target), { recursive: true });
  cpSync(source, target, { recursive: true });
}

// Overlay each entry of `source` onto an existing package directory, replacing
// matching entries but leaving siblings (e.g. package.json) untouched.
function overlayDir(source, target) {
  if (!existsSync(source)) {
    throw new Error(`Build output missing: ${source}`);
  }
  if (!existsSync(target)) {
    throw new Error(`Spacerocks package target missing: ${target}`);
  }
  console.log(`overlay ${source} -> ${target}`);
  for (const entry of readdirSync(source)) {
    const entryTarget = join(target, entry);
    rmSync(entryTarget, { recursive: true, force: true });
    cpSync(join(source, entry), entryTarget, { recursive: true });
  }
}
