/**
 * A small static file server for local development, built entirely from Node's own
 * `http`/`fs` — this project takes no dependencies, so `npx serve` (needs the network to
 * fetch a package) and `python -m http.server` (needs Python, which this machine does not
 * have) are both non-starters. See `README.md` for why the game needs to be served over
 * http at all rather than opened as `file://`.
 *
 * Shares its shape — the MIME map, the path-traversal guard — with the embedded server in
 * `verify-music-pause.mjs`, so the two agree on how this tree is served. That one is a
 * throwaway test harness that binds an ephemeral port and tears itself down in seconds; this
 * one is meant to be started by hand and left running, so it adds what a human needs: a
 * configurable, defaulted port, a clear message on a busy one, and a startup banner naming
 * the URL to open.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, isAbsolute, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolved from this file's own location — never a hardcoded absolute path — so the server
// works from any checkout, regardless of the directory it happens to be launched from.
const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const DEFAULT_PORT = 8000;

const MIME = {
  '.html': 'text/html; charset=utf-8', // the game's markup is not pure ASCII
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain',
};

/**
 * A command-line argument is the most explicit ask, so it wins over the environment
 * variable, which in turn wins over the built-in default. Falls back to the default (with
 * a warning, rather than a crash) on anything that is not a sane port number, since a typo
 * here should not be fatal for a dev-only tool. Requires the trimmed value to be all
 * digits: `Number('')` is `0` and `Number(' ')` is also `0`, both of which would otherwise
 * pass a bare `Number.isInteger` check silently and bind an unexpected ephemeral port.
 */
function resolvePort() {
  const raw = process.argv[2] ?? process.env.PORT ?? String(DEFAULT_PORT);
  const trimmed = raw.trim();
  const port = Number(trimmed);
  if (!/^\d+$/.test(trimmed) || port > 65535) {
    console.error(`Ignoring invalid port '${raw}'; falling back to ${DEFAULT_PORT}.`);
    return DEFAULT_PORT;
  }
  return port;
}

// Resolves `file` against WEB_ROOT and reports whether it is still inside it. Shared by the
// request path itself and by the directory -> index.html retry below, so a directory
// request can never take a path that skips this check.
//
// `file.startsWith(WEB_ROOT)` would look right but is not: it also accepts a sibling
// directory whose name merely begins with WEB_ROOT's own name (a `web-secret/` next to
// `web/`). Comparing the *relative* path instead makes that impossible, and doing it with
// path.relative — rather than string-slicing — keeps the check correct on Windows, where the
// separator is `\` rather than `/`.
//
// This check is purely lexical: it does not call realpath, so a symlink inside `web/`
// pointing outside the root would be followed by readFile without ever tripping it. There
// are no symlinks under `web/` today, and planting one needs write access to the served
// tree already — so this is a documented limit, not something worth a stat()-based fix.
function insideRoot(file) {
  const rel = relative(WEB_ROOT, file);
  return !isAbsolute(rel) && rel.split(sep)[0] !== '..';
}

const server = createServer(async (req, res) => {
  let pathname;
  try {
    // Decoded before anything else so a malformed escape (a lone trailing '%', say) fails
    // right here with a clean 400, rather than surfacing later as an unhandled rejection.
    pathname = decodeURIComponent(req.url.split('?')[0]);
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain' }).end('Bad request: malformed URL encoding');
    return;
  }

  const requested = join(WEB_ROOT, pathname);
  if (!insideRoot(requested)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' }).end('Forbidden');
    return;
  }

  try {
    let file = requested;
    let body;
    try {
      body = await readFile(file);
    } catch (err) {
      // A directory request — `/`, `/editor`, or `/editor/` alike — serves that directory's
      // index.html, matching what both tools this server replaces (`npx serve`,
      // `python -m http.server`) already did, and what the README promises for `/editor/`.
      // Re-running the guard on the retried path is defence in depth, not because appending
      // a literal `index.html` to an already-inside path could actually escape on its own.
      if (err.code !== 'EISDIR') throw err;
      const indexed = join(file, 'index.html');
      if (!insideRoot(indexed)) throw err;
      file = indexed;
      body = await readFile(file);
    }
    const type = MIME[extname(file).toLowerCase()] ?? 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
  }
});

const port = resolvePort();

// A raw stack trace names no port and suggests no fix — and this project has already been
// bitten once by a confusing port failure. Catching the two common bind failures here turns
// each into a one-line answer instead of a crash the reader has to decode; anything else
// still exits non-zero, but with a readable line rather than a bare rethrow.
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `Port ${port} is already in use. Stop whatever is using it, or pick another port:\n` +
      `  PORT=8100 npm start\n` +
      `  node tools/serve.mjs 8100`
    );
    process.exit(1);
  }
  if (err.code === 'EACCES') {
    console.error(
      `Not allowed to bind port ${port} — ports below 1024 usually need administrator ` +
      `privileges. Pick a higher port instead:\n` +
      `  PORT=8100 npm start\n` +
      `  node tools/serve.mjs 8100`
    );
    process.exit(1);
  }
  console.error(`Could not start the server: ${err.message}`);
  process.exit(1);
});

// Loopback only: this is a local dev server, not something that should be reachable from
// the network.
server.listen(port, '127.0.0.1', () => {
  const boundPort = server.address().port;
  console.log(`Serving ${WEB_ROOT}`);
  console.log(`Open http://127.0.0.1:${boundPort}/`);
});
