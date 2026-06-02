# Co-op Asteroids: Boss Rush

A fast-paced, two-player cooperative Asteroids-style game.

**[Play the latest version](https://vworlds.github.io/spacerocks/dev/)**

## Features

- **Local Co-op**: Play with two players on one keyboard.
- **Waves**: Increasing difficulty with every wave.
- **Boss Rush**: Special boss battles every few waves.
- **Powerups**: Collect shields, weapons (Laser, Aura, Rocket, Boomerang), and health pickups. The Boomerang spins through enemies, curves back, and refunds ammo if you catch it.
- **Aliens**: Watch out for alien ships that hunt you down!

## Controls

### Player 1

- **Movement**: `W` (Thrust), `A` (Rotate Left), `D` (Rotate Right)
- **Shoot**: `Space`

### Player 2

- **Movement**: `Up Arrow` (Thrust), `Left Arrow` (Rotate Left), `Right Arrow` (Rotate Right)
- **Shoot**: `Enter`

## Development

```bash
npm install         # install all workspace dependencies
npm run dev:server  # start the authoritative vecs server
npm run dev:client  # start Vite dev server (http://localhost:5173)
npm run build       # typecheck + build all workspaces
npm run test        # run workspace tests
```

## Repository layout

This project uses npm workspaces:

- `apps/client`: Vite browser renderer and input client
- `apps/server`: authoritative server-side simulation
- `packages/common`: shared code for client and server

## GitHub Pages previews

Pushes and same-repository PRs automatically build and publish the game to GitHub Pages.

- **Latest (dev)**: https://vworlds.github.io/spacerocks/dev/
- **Branch preview**: `https://vworlds.github.io/spacerocks/<branch>/`
- **PR preview**: `https://vworlds.github.io/spacerocks/pr-<number>/`

When a PR is opened, a bot comment is automatically posted with a direct link to play that PR's build.

Enable GitHub Pages in repository settings with source branch `gh-pages` and folder `/`.
