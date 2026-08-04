/**
 * Drives the real game in headless Chrome to check the music-pause wiring in
 * `src/main.js` — the one file unit tests cannot reach, because it does a top-level
 * `await fetch` for the level set and touches `document`, `window`, `localStorage` and
 * `Worker`. Faking all of that would mean pulling in jsdom, which this project
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
import { join, dirname, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

// Resolved from this file's own location so the script works from any checkout, on any
// machine, regardless of the current working directory it is run from.
const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8123;
const DEBUG_PORT = 9333;

/**
 * Finds a Chrome (or Chromium) executable without hardcoding one machine's install path.
 * `CHROME` always wins if set, so anyone with a nonstandard install can point at it
 * directly. Otherwise we probe the handful of locations the common installers actually
 * use, per platform. Returns null rather than throwing so the caller can fail with a
 * clear message instead of a raw spawn error.
 */
function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;

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
  const path = decodeURIComponent(req.url.split('?')[0]);
  const file = normalize(join(WEB_ROOT, path === '/' ? '/index.html' : path));
  if (!file.startsWith(normalize(WEB_ROOT))) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});

// Wraps server.listen so a busy port fails with a readable message instead of an
// uncaught 'error' event crashing the process with no obvious cause.
function listen(srv, port) {
  return new Promise((resolve, reject) => {
    const onError = (err) => {
      srv.off('error', onError);
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`Port ${port} is already in use — stop whatever is using it, or edit PORT in this script.`));
      } else {
        reject(err);
      }
    };
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
        const { resolve, reject } = this.#pending.get(msg.id);
        this.#pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      } else if (msg.method) {
        this.#handlers.get(msg.method)?.(msg.params);
      }
    };
  }

  send(method, params = {}) {
    const id = ++this.#id;
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      this.#ws.send(JSON.stringify({ id, method, params }));
    });
  }

  once(method) {
    return new Promise((resolve) => this.#handlers.set(method, resolve));
  }
}

const results = [];
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push({ ok, name, actual, expected });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) console.log(`        mong doi ${JSON.stringify(expected)}, nhan duoc ${JSON.stringify(actual)}`);
};

// Resolved before anything is started, so a missing Chrome fails fast with nothing
// left to clean up — no server bound, no browser spawned, no finally block to reason
// about the ordering of.
const chromePath = findChrome();
if (!chromePath) {
  console.error(
    'Khong tim thay Chrome o cac vi tri thuong gap.\n' +
    'Dat bien moi truong CHROME tro toi file thuc thi roi chay lai, vi du:\n' +
    '  CHROME="C:/path/to/chrome.exe" node tools/verify-music-pause.mjs'
  );
  process.exit(1);
}

let chrome, profile;
try {
  await listen(server, PORT);

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
      window.addEventListener('error', (e) => window.__pageErrors.push(String(e.message)));
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
  await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/` });
  await loaded;

  const evalJs = async (expression) => {
    const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(`${expression}\n  -> ${JSON.stringify(r.exceptionDetails.exception ?? r.exceptionDetails)}`);
    return r.result.value;
  };

  const settle = () => evalJs('new Promise(r => setTimeout(r, 200))');
  const paused = () => evalJs(
    `(() => { const m = window.__audios.find(a => a.src.includes('music_loop')); return m ? m.paused : 'KHONG TIM THAY THE NHAC'; })()`
  );

  // main.js does a top-level `await fetch` for the level set, so the module is still
  // running when load fires.
  await settle();
  await settle();

  check('the level set loaded and the game built its audio', await evalJs('window.__audios.length > 0'), true);
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

  // Minimising fires both events back to back; the #suspended flag must absorb that.
  await evalJs(`window.dispatchEvent(new Event('blur'))`);
  await setHidden(true);
  await settle();
  check('CA 6 — a doubled suspend (blur + visibilitychange) stays paused', await paused(), true);
  await setHidden(false);
  await evalJs(`window.dispatchEvent(new Event('focus'))`);
  await settle();
  check('CA 6 — and the doubled resume comes back exactly once', await paused(), false);

  // The collector is installed before any page script runs, so an empty array is real
  // evidence rather than an undefined that happens to compare equal to zero.
  check('the error collector was actually installed', await evalJs(`Array.isArray(window.__pageErrors)`), true);
  check('no uncaught page errors', await evalJs(`window.__pageErrors`), []);
} finally {
  chrome?.kill();
  server.close();
  if (profile) await rm(profile, { recursive: true, force: true }).catch(() => {});
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} kiem tra dat`);
process.exit(failed.length ? 1 : 0);
