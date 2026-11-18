# UBC Brawl

A 2D pixel-art platform fighter that runs in the browser. Plain HTML, CSS and
JavaScript modules: no build step, no frameworks, no asset files.

**Current version:** see `config/version.js` (shown on the title screen).
**Status:** in progress: movement, normals, shield and dodges, Bluff, and a CPU opponent (training dummy or fighter, picked with W / S on stage select).

## Play it locally

Browsers block JavaScript modules opened straight from a file, so use a tiny
local server. From this folder, run one of:

```
python3 -m http.server 8000
```
```
npx serve .
```

Then open http://localhost:8000 in Chrome, Edge, Firefox or Safari.

## Controls (milestone 1)

| Action | Key |
|---|---|
| Move | A / D (double-tap to dash and run) |
| Crouch / fast fall | S |
| Jump | Space (tap = short hop, hold = full hop, again in the air = double jump) |
| Pause | Esc |
| Debug info + state hash | F1 |
| Hurtboxes, collision and ledge boxes | F2 |

## Put it on GitHub Pages (one time)

1. Open the repository on GitHub, then **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
3. Choose branch **main** and folder **/ (root)**, then **Save**.
4. After a minute or two the game is live at
   `https://<your-username>.github.io/super-simmys-bros/`.

## Publish an update

1. Bump the version (this also refreshes the cache-busting file list):
   ```
   node tools/release.mjs 0.1.1
   ```
2. Commit and push to `main`.
3. Wait 1–2 minutes, then refresh the game page.

No Node? Edit the version by hand in **both** `config/version.js` and
`version.json`, and add any new `.js` files to the list in `version.json`.

### How updates reach players

- `config/version.js` holds the single `GAME_VERSION` constant.
- `index.html` fetches `version.json` (never cached), then loads the stylesheet,
  `main.js` and every module with `?v=<version>` through an import map, so
  nobody mixes old and new files.
- The title screen re-checks `version.json` every minute and shows
  "Update available. Refresh to play the latest version." when it is newer.
- `net/handshake.js` already contains the version handshake the future online
  mode must use before starting a match.

## Online play

Title screen, any key, then **Host an online room** or **Join an online room**.
The host gets a four-letter room code; friends type it to join (up to four
fighters, CPUs included). Everyone must be on the same game version.

- Game data goes straight between the browsers (WebRTC). The free public
  PeerJS server is only used to introduce them; the library is loaded from
  unpkg the first time someone goes online.
- The netcode is rollback with 2 frames of input delay: see `net/session.js`.
- `node tools/net-test.mjs` plays whole online matches over pretend links with
  lag, and checks every machine ends with the same game.

## Project layout

| Folder | What lives there |
|---|---|
| `config/` | Version and global tunable values |
| `engine/` | Deterministic simulation: fixed-point math, input bitmasks, fighter states, physics, skeleton, state hash |
| `characters/` | One data file per fighter (stats, body parts, palettes, poses) + registry |
| `stages/` | One data file per stage (collision, ledges, blast zones, art) + registry |
| `render/` | Canvas drawing: paper-doll characters, background, HUD, pixel font |
| `ui/` | Settings (localStorage), update check; menus arrive in milestone 5 |
| `audio/` | Sound effects (stub until milestone 5) |
| `net/` | Online play: rollback netcode (`session.js`), rooms and lobby (`room.js`), browser-to-browser links through PeerJS (`peer.js`), version handshake |
| `tools/` | `release.mjs`, `sim-test.mjs`, `cpu-test.mjs`, `fuzz-test.mjs`, `sound-test.mjs` and `audio-check.mjs` (headless checks), `pose-sheet.html` (art preview) |

**Add a character:** copy `characters/simeon.js`, change the data, and add it
to `characters/index.js`. **Add a stage:** same idea in `stages/`.

## Determinism rules (needed for online play later)

- The simulation runs at a fixed 60 ticks per second, separate from drawing.
- `step(state, inputs)` in `engine/sim.js` is the only thing that changes the
  game state, and it uses only the previous state plus each player's input bitmask.
- Positions and speeds are integers in units of 1/256 pixel. No `Math.sin`,
  `Math.cos` or `Math.random` in `engine/`; use `engine/fixed.js`.
- Check with `node tools/sim-test.mjs`.
