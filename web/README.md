# Sokoban — web build

Plain HTML, CSS and JavaScript. No framework, no build step.

## Running it during development

```bash
npx serve web
```

It has to be served over http. Do **not** double-click `index.html`: `file://` blocks ES
modules and `fetch`, so the game comes up blank.

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
