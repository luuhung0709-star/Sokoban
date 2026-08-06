/**
 * Drives the real game in headless Chrome to check the music-pause wiring in
 * `src/main.js` — the one file unit tests cannot reach, because it does a top-level
 * `await fetch` for the level set and touches `document`, `window` and `localStorage`.
 * Faking all of that would mean pulling in jsdom, which this project
 * deliberately refuses (see `tests/fakeDom.mjs`). So instead of faking the browser,
 * this script uses a real one via the DevTools Protocol (CDP) and asserts on real state.
 *
 * What this CAN prove: the blur/focus/visibilitychange listeners are registered on the
 * right targets with the right event names, the visibilitychange branch picks correctly
 * for each value of `document.hidden`, and `suspend()`/`resume()` really flip the music
 * element's `paused` through the actual composition root in `main.js` — not through a
 * mock of it.
 *
 * What it CANNOT prove: that Chrome fires `blur` when a human alt-tabs (that is browser
 * behaviour, not ours, so it is not exercised here — the script dispatches synthetic
 * `blur`/`focus`/`visibilitychange` events instead), or that anything is actually
 * audible. A human still checks those by ear in a real browser.
 *
 * Deliberately NOT part of `npm test`: it needs an installed Chrome and a couple of
 * seconds to spin one up, which does not belong in the fast unit-test loop.
 */
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { join, dirname, extname, normalize, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { once } from 'node:events';

// Resolved from this file's own location so the script works from any checkout, on any
// machine, regardless of the current working directory it is run from.
const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// Ephemeral — the static server's port only needs to be known to this process, so there is
// nothing to hardcode and nothing to collide with. The debug port stays fixed below: Chrome
// needs it as a launch flag before it exists, so it cannot be discovered after the fact.
const DEBUG_PORT = 9333;
const CDP_TIMEOUT_MS = 10_000;

/**
 * Finds a Chrome (or Chromium) executable without hardcoding one machine's install path.
 * `CHROME` always wins if set, so anyone with a nonstandard install can point at it
 * directly — but it still goes through the same existence check as every other
 * candidate, so a typo in `CHROME` fails here with a clear message rather than surfacing
 * 15 seconds later as an unrelated "debugging port" timeout. Returns null rather than
 * throwing so the caller can fail with a clear message instead of a raw spawn error.
 */
function findChrome() {
  if (process.env.CHROME) return existsSync(process.env.CHROME) ? process.env.CHROME : null;

  const candidates = {
    win32: [
      'C:/Program Files/Google/Chrome/Application/chrome.exe',
      'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
      process.env.LOCALAPPDATA && `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
      'C:/Program Files/Chromium/Application/chrome.exe',
    ],
    darwin: [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ],
    linux: [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/snap/bin/chromium',
    ],
  }[process.platform] ?? [];

  return candidates.find((path) => path && existsSync(path)) ?? null;
}

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.css': 'text/css', '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg', '.png': 'image/png', '.txt': 'text/plain',
};

const server = createServer(async (req, res) => {
  let path;
  try {
    // Decoded before anything else so a malformed escape fails here with a clean 400,
    // rather than throwing inside this async handler with nothing there to catch it.
    path = decodeURIComponent(req.url.split('?')[0]);
  } catch {
    res.writeHead(400).end('bad request');
    return;
  }
  const file = normalize(join(WEB_ROOT, path === '/' ? '/index.html' : path));
  // path.relative, not startsWith: a bare prefix check also accepts a sibling directory
  // whose name merely begins with WEB_ROOT's own name. See tools/serve.mjs for the fuller
  // version of this same guard, which this harness intentionally mirrors.
  const rel = relative(WEB_ROOT, file);
  if (isAbsolute(rel) || rel.split(sep)[0] === '..') { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});

// Wraps server.listen so a bind failure rejects clearly instead of an uncaught 'error'
// event crashing the process with no obvious cause. Called with port 0 (ephemeral), so
// there is no EADDRINUSE case left to special-case — any rejection here is something
// else entirely (e.g. no loopback interface), and deserves to surface as-is.
function listen(srv, port) {
  return new Promise((resolve, reject) => {
    const onError = (err) => { srv.off('error', onError); reject(err); };
    srv.once('error', onError);
    srv.listen(port, '127.0.0.1', () => { srv.off('error', onError); resolve(); });
  });
}

class CDP {
  #ws; #id = 0; #pending = new Map(); #handlers = new Map();

  constructor(ws) {
    this.#ws = ws;
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.#pending.has(msg.id)) {
        const { resolve, reject, timer } = this.#pending.get(msg.id);
        clearTimeout(timer);
        this.#pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      } else if (msg.method) {
        this.#handlers.get(msg.method)?.resolve(msg.params);
      }
    };
    // Without this, a Chrome crash or kill mid-run leaves every outstanding send()/once()
    // promise unsettled for ever — the one failure mode a headless-browser harness must
    // never have, since there is no human watching a window to notice it hung.
    ws.onclose = () => {
      const err = new Error('CDP WebSocket closed before Chrome replied — Chrome likely crashed or was killed mid-run.');
      for (const { reject, timer } of this.#pending.values()) { clearTimeout(timer); reject(err); }
      this.#pending.clear();
      for (const { reject } of this.#handlers.values()) reject(err);
      this.#handlers.clear();
    };
  }

  send(method, params = {}, timeoutMs = CDP_TIMEOUT_MS) {
    const id = ++this.#id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(new Error(`CDP call '${method}' timed out after ${timeoutMs}ms — Chrome is unresponsive or has died.`));
      }, timeoutMs);
      this.#pending.set(id, { resolve, reject, timer });
      this.#ws.send(JSON.stringify({ id, method, params }));
    });
  }

  once(method) {
    return new Promise((resolve, reject) => this.#handlers.set(method, { resolve, reject }));
  }
}

const results = [];
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push({ ok, name, actual, expected });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) console.log(`        expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
};

// Resolved before anything is started, so a missing Chrome fails fast with nothing
// left to clean up — no server bound, no browser spawned, no finally block to reason
// about the ordering of.
const chromePath = findChrome();
if (!chromePath) {
  if (process.env.CHROME) {
    console.error(`CHROME is set to '${process.env.CHROME}', but that path does not exist.`);
  } else {
    console.error(
      'Could not find Chrome in the usual install locations.\n' +
      'Set the CHROME environment variable to point at the executable and try again, for example:\n' +
      '  CHROME="C:/path/to/chrome.exe" node tools/verify-music-pause.mjs'
    );
  }
  process.exit(1);
}

let chrome, profile;
try {
  await listen(server, 0);
  const port = server.address().port;

  // A previous run that did not shut down cleanly, or an unrelated process, could
  // already be sitting on the debug port. Failing here is far clearer than waiting out
  // the poll loop below only to report a vague "Chrome could not open" at the end.
  const debugPortBusy = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`).then(() => true, () => false);
  if (debugPortBusy) {
    throw new Error(`Debug port ${DEBUG_PORT} is already in use — stop the process holding it, or edit DEBUG_PORT in this script.`);
  }

  profile = await mkdtemp(join(tmpdir(), 'sokoban-verify-'));
  chrome = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu',
    // The game gates music behind a real interaction; we still send a trusted click,
    // but headless has no audio device and would otherwise reject play().
    '--autoplay-policy=no-user-gesture-required',
    'about:blank',
  ], { stdio: 'ignore' });

  // Poll for the debugger endpoint rather than sleeping a fixed guess.
  let targets;
  for (let i = 0; i < 60; i++) {
    try {
      targets = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();
      if (targets.some((t) => t.type === 'page')) break;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  const page = targets?.find((t) => t.type === 'page');
  if (!page) throw new Error(`Chrome did not open a debugging endpoint on port ${DEBUG_PORT} within 15s.`);

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  const cdp = new CDP(ws);
  // Past the handshake above, no separate 'error' handling is needed: killing Chrome at
  // the end of a run closes this socket abruptly (an expected "error"), and CDP's onclose
  // already turns any close — expected or not — into a clear rejection for every pending
  // call, so there is nothing an 'error' listener here would add.

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  // AudioService keeps the loop in a private field and never attaches it to the DOM, so
  // querySelector cannot find it. Instead we wrap window.Audio before any page script
  // runs, recording every element the page constructs; later we pick out the one whose
  // src contains 'music_loop' and read .paused off it. That is the only observation
  // point into a private field from outside the module.
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `
      window.__pageErrors = [];
      // Capture phase: a resource-load failure (a 404'd script or asset) fires 'error' on
      // the element itself and does not bubble, so a bubble-phase listener here would miss
      // it and 'no uncaught page errors' would be checking less than its name promises.
      window.addEventListener('error', (e) => window.__pageErrors.push(String(e.message)), true);
      window.addEventListener('unhandledrejection', (e) => window.__pageErrors.push('unhandled rejection: ' + String(e.reason)));

      window.__audios = [];
      const Native = window.Audio;
      window.Audio = function (src) {
        const el = new Native(src);
        window.__audios.push(el);
        return el;
      };
      window.Audio.prototype = Native.prototype;
    `,
  });

  const loaded = cdp.once('Page.loadEventFired');
  // Attached immediately, not after the `await` below: if `Page.navigate` itself rejects
  // (its own timeout, a CDP error, or the socket closing because Chrome died), `await
  // loaded` on the next line is never reached and `loaded` would otherwise be an orphan
  // promise with no handler — which ws.onclose then rejects, and Node reports as an
  // unhandled rejection on top of the real, already-surfaced error. This no-op catch
  // marks it handled without affecting what `await loaded` itself observes below.
  loaded.catch(() => {});
  await cdp.send('Page.navigate', { url: `http://127.0.0.1:${port}/` });
  await loaded;

  const evalJs = async (expression) => {
    const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(`${expression}\n  -> ${JSON.stringify(r.exceptionDetails.exception ?? r.exceptionDetails)}`);
    return r.result.value;
  };

  const settle = () => evalJs('new Promise(r => setTimeout(r, 200))');
  const paused = () => evalJs(
    `(() => { const m = window.__audios.find(a => a.src.includes('music_loop')); return m ? m.paused : 'MUSIC ELEMENT NOT FOUND'; })()`
  );

  // main.js does a top-level `await fetch` for the level set, so the module may still be
  // running when load fires. Poll for the audio it builds rather than guessing how long
  // that takes: a fixed wait either flakes under load or pads every run that finishes early.
  const waitUntil = async (predicateExpr, timeoutMs = 5000) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await evalJs(predicateExpr)) return true;
      await new Promise((r) => setTimeout(r, 50));
    }
    return false;
  };

  check('the level set loaded and the game built its audio', await waitUntil('window.__audios.length > 0'), true);
  check('the music loop was created with loop = true',
    await evalJs(`window.__audios.find(a => a.src.includes('music_loop'))?.loop`), true);
  check('music is idle before any interaction (autoplay rule)', await paused(), true);

  // A trusted click, the way a player unlocks the audio.
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 200, y: 300, button: 'left', clickCount: 1 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 200, y: 300, button: 'left', clickCount: 1 });
  await settle();
  check('CA 0 — a click unlocks and starts the music', await paused(), false);

  // --- Case 1 & 2: leaving and returning to the window ---
  await evalJs(`window.dispatchEvent(new Event('blur'))`);
  await settle();
  check('CA 1 — window blur pauses the music', await paused(), true);

  const wasAt = await evalJs(`window.__audios.find(a => a.src.includes('music_loop')).currentTime`);
  // Without this, the next check's `>= wasAt` is only non-vacuous by luck: if wasAt were
  // 0 (e.g. playback never actually advanced), `0 >= 0` would pass regardless of whether
  // resume() really continued from where it left off.
  check('CA 2 — playback had advanced past zero before the blur', wasAt > 0, true);
  await evalJs(`window.dispatchEvent(new Event('focus'))`);
  await settle();
  check('CA 2 — window focus resumes the music', await paused(), false);
  check('CA 2 — it resumed from where it stopped, not from the top',
    await evalJs(`window.__audios.find(a => a.src.includes('music_loop')).currentTime >= ${wasAt}`), true);

  // --- Case 3: hiding and showing the tab ---
  const setHidden = (value) => evalJs(
    `Object.defineProperty(document, 'hidden', { configurable: true, get: () => ${value} }); ` +
    `document.dispatchEvent(new Event('visibilitychange')); true`
  );
  await setHidden(true);
  await settle();
  check('CA 3 — hiding the tab pauses the music', await paused(), true);

  await setHidden(false);
  await settle();
  check('CA 3 — showing it again resumes', await paused(), false);

  // --- Case 4: the player's own switch must win, and must survive the round trip ---
  await evalJs(`document.getElementById('btn-settings').click(); document.getElementById('btn-music').click(); true`);
  await settle();
  check('CA 4 — turning Music off in Settings stops it', await paused(), true);
  check('CA 4 — the switch reads off',
    await evalJs(`document.getElementById('btn-music').getAttribute('aria-pressed')`), 'false');

  await evalJs(`window.dispatchEvent(new Event('blur'))`);
  await settle();
  await evalJs(`window.dispatchEvent(new Event('focus'))`);
  await settle();
  check('CA 4 — after leaving and returning it STAYS off', await paused(), true);
  check('CA 4 — and the switch still reads off',
    await evalJs(`document.getElementById('btn-music').getAttribute('aria-pressed')`), 'false');
  check('CA 4 — the saved setting says off, so a system pause never wrote over it',
    await evalJs(`JSON.parse(localStorage.getItem('sokoban.progress')).musicOn`), false);

  // Turning it back on must work, and must survive a round trip the same way.
  await evalJs(`document.getElementById('btn-music').click(); true`);
  await settle();
  check('CA 5 — turning Music back on restarts it', await paused(), false);
  await evalJs(`window.dispatchEvent(new Event('blur'))`);
  await settle();
  check('CA 5 — and blur still pauses it afterwards', await paused(), true);

  // CA 5 left the service suspended (its last step was a blur). Starting a "doubled
  // suspend" check from there would just be a third and fourth suspend on top of what
  // CA 5 already proved, re-asserting nothing new — #suspended absorbing a doubled
  // suspend only means something if it started from an unsuspended, playing state.
  await evalJs(`window.dispatchEvent(new Event('focus'))`);
  await settle();
  check('CA 6 — focus first resets to a playing baseline', await paused(), false);

  // Minimising fires both events back to back; the #suspended flag must absorb that.
  await evalJs(`window.dispatchEvent(new Event('blur'))`);
  await setHidden(true);
  await settle();
  check('CA 6 — a doubled suspend (blur + visibilitychange) stays paused', await paused(), true);
  await setHidden(false);
  await evalJs(`window.dispatchEvent(new Event('focus'))`);
  await settle();
  // Named for what this actually shows, not more: a doubled resume (visibilitychange +
  // focus) still ends up unpaused. paused === false cannot distinguish one resume from
  // two, so this does not claim to prove "exactly once" — only that it is not broken.
  check('CA 6 — the doubled resume also ends up unpaused', await paused(), false);

  // --- Case 7 (37fb8e5): the musicOn setter must defer to #suspended, not fight it ---
  // Before #startMusic() consolidated all three start sites, flipping the switch while
  // suspended could start playback anyway, out from under an away player. Neither unit
  // test can reach the composition root's Settings button, so this is the only check
  // that exercises the fix through the real UI.
  await evalJs(`window.dispatchEvent(new Event('blur'))`);
  await settle();
  check('CA 7 — blur suspends before the setter regression check', await paused(), true);

  await evalJs(`document.getElementById('btn-music').click(); document.getElementById('btn-music').click(); true`);
  await settle();
  check('CA 7 — toggling Music off then on while blurred still stays paused', await paused(), true);

  await evalJs(`window.dispatchEvent(new Event('focus'))`);
  await settle();
  check('CA 7 — and focus afterwards actually starts it playing', await paused(), false);

  // The collector is installed before any page script runs, so an empty array is real
  // evidence rather than an undefined that happens to compare equal to zero.
  check('the error collector was actually installed', await evalJs(`Array.isArray(window.__pageErrors)`), true);
  check('no uncaught page errors', await evalJs(`window.__pageErrors`), []);
} finally {
  // kill() only delivers the signal; Chrome still holds handles under the profile
  // directory until it has actually exited, and rm would fail on Windows.
  if (chrome) {
    chrome.kill();
    await once(chrome, 'exit').catch((e) => console.warn(`Chrome reported an error while exiting: ${e.message}`));
  }
  server.close();
  if (profile) await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
    .catch((e) => console.warn(`Could not remove ${profile}: ${e.message}`));
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
