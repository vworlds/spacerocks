#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const spacerocksRoot = resolve(scriptDir, "..");
const vecsRoot = resolve(process.env.VECS_ROOT ?? resolve(spacerocksRoot, "..", "vecs"));

const builds = [
  "@vworlds/vecs",
  "@vworlds/vecs-wire",
  "@vworlds/vecs-protocol",
  "@vworlds/vecs-client",
  "@vworlds/vecs-server",
];

const copies = [
  ["lib/vecs/dist", "node_modules/@vworlds/vecs/dist"],
  ["lib/vecs-wire/dist/vecs-wire/src", "node_modules/@vworlds/vecs-wire/vecs-wire/src"],
  ["lib/vecs-client/dist/vecs-client/src", "node_modules/@vworlds/vecs-client/vecs-client/src"],
  ["lib/vecs-client/dist/vecs-protocol/src", "node_modules/@vworlds/vecs-client/vecs-protocol/src"],
  ["lib/vecs-server/dist/vecs-server/src", "node_modules/@vworlds/vecs-server/vecs-server/src"],
  ["lib/vecs-server/dist/vecs-protocol/src", "node_modules/@vworlds/vecs-server/vecs-protocol/src"],
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

console.log("Hot-updated spacerocks node_modules from", vecsRoot);

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
