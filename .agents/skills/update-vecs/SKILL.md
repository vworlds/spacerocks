---
name: update-vecs
description: 'Updates all @vworlds/vecs* packages to the latest npm version across apps/client, apps/server, packages/common, and root overrides. Run before starting work that depends on new vecs API features. Use when asked to "update vecs", "bump vecs", "upgrade vecs", or "latest vecs".'
---

# Update @vworlds/vecs* Packages

Updates every `@vworlds/vecs*` dependency across all workspace manifests and the root `overrides` to the latest npm version, then installs and verifies.

## Script

```bash
.agents/skills/update-vecs/scripts/update-vecs.sh
```

Direct invocation from the project root:

```bash
bash .agents/skills/update-vecs/scripts/update-vecs.sh
```

## What it does

1. Fetches the latest version of `@vworlds/vecs` from npm.
2. Discovers all `@vworlds/vecs*` package names in `package.json`, `apps/client/package.json`, `apps/server/package.json`, and `packages/common/package.json`.
3. Warns if any sub-package latest version differs from the core package version.
4. Replaces every occurrence of the old version with the new version across all four manifests (including the root `overrides` block).
5. Runs `npm install` to update the lockfile.
6. Verifies with `npm ls @vworlds/vecs`.

## Manual fallback

If the script fails, update each manifest file individually:

- `package.json` (root `overrides`)
- `apps/client/package.json`
- `apps/server/package.json`
- `packages/common/package.json`

Find the latest version: `npm view @vworlds/vecs version`
