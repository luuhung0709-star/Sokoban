# Sokoban — web build

Plain HTML, CSS and JavaScript. No framework, no build step.

## Running it during development

```bash
cd web && npm start
```

It has to be served over http. Do **not** double-click `index.html`: `file://` blocks ES
modules and `fetch`, so the game comes up blank.

`npm start` runs `tools/serve.mjs`, a static file server built only from Node's own `http`
module — no dependency, no `npx`, no network. It listens on `http://127.0.0.1:8000/` by
default; if 8000 is taken, override it with `PORT=8100 npm start` (or `node tools/serve.mjs
8100`).

## Tests

```bash
cd web && npm test
```

Runs `node --test` over the core (`src/core`, `src/levels`, `src/progress`) and the view layer
(`src/view`, `src/ui`).

The view tests drive the real modules against the hand-rolled fake DOM in
[tests/fakeDom.mjs](tests/fakeDom.mjs) — the project takes no dependencies, so jsdom is not an
option. That fake models only what the view code touches: element trees, simple `.class`/`#id`
lookups, classes, dataset and event dispatch. It models no layout, no CSS and no event
bubbling, so anything resting on those — cell sizing, the look of the board, real transitions —
is still checked by eye in a browser.

## Changing the level set

`src/levels/microban.json` is generated from `tools/microban.txt`; run it by hand, then commit:

```bash
cd web && node tools/import-microban.mjs
```

To use a different set, overwrite `tools/microban.txt` with a file in Microban format and run
the script again. It validates every level and **stops without writing anything** if any level
is malformed.

## Level editor

Open `/editor/` through a local server. That page is not part of the deployed build.

## Verifying the music-pause wiring

`src/main.js` is the composition root, and it is the one file the unit tests cannot
reach: it does a top-level `await fetch` for the level set and touches `document`,
`window` and `localStorage`, so importing it under `node --test` would need a fake
browser — jsdom, which this project deliberately does not depend on.

`tools/verify-music-pause.mjs` covers the gap that leaves: it drives the real game in
headless Chrome over the DevTools Protocol and asserts on real state (does blur really
pause the music, does the Settings switch really win over a system pause, and so on).

```bash
cd web && node tools/verify-music-pause.mjs
```

It needs Chrome (or Chromium) installed. It looks in the common install locations for
your platform; if yours isn't found, point at it with `CHROME=/path/to/chrome`. It also
needs Node 22.4 or newer — it uses the global `WebSocket`, which is unflagged only from
that version. It is deliberately **not** part of `npm test` — it needs a real browser and
a couple of seconds to start one, which does not belong in the fast unit-test loop.
