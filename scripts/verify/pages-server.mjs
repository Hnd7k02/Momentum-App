// A static server that answers as GitHub Pages does (the tidy-up of WP3,
// step 5, D163).
//
//   node scripts/verify/pages-server.mjs [--dir dist] [--base /Momentum-App/] [--port 4173] [--host 127.0.0.1]
//
// The suites used to read the built app from `vite preview`. That is a
// development tool with habits of its own, and one of them misled a check
// for months: it answers every file with `Vary: Origin`. The service
// worker's cache keeps that header with the response, and a cache does not
// hand out a stored response whose `Vary` names a header the new request
// sends differently — so offline, the first dynamic import of the body's
// chunk (a module request, which carries an `Origin`) was refused the copy
// the worker had precached (a plain request, which carries none), and
// `release-proof.mjs` showed the flat figure where the 3D body should
// stand. GitHub Pages, where the app really lives, sends no `Vary: Origin`.
//
// What this server sends is what Pages is known to send for a file:
//
//   Content-Type                  by the file's extension
//   Content-Length, Accept-Ranges: bytes
//   ETag, Last-Modified           and 304 for a matching If-None-Match
//   Cache-Control: max-age=600
//   Access-Control-Allow-Origin: *
//   Vary: Accept-Encoding
//   404 with a short page         for what is not there
//
// It could not be read off a real answer in the session that wrote it: the
// session's network rules close `github.io`. The list is from GitHub's
// documentation of Pages and from answers recorded before; if Pages ever
// answers differently, this file is the one place to say so. Two things
// are left out on purpose: compression (Pages gzips text; the bytes that
// reach the page are the same) and Pages' own `Server`, `X-GitHub-*` and
// CDN headers, which nothing in the app reads.
//
// The owner's check in flight mode after the go-live stays what decides
// (D163): a runner's Chromium is not an installed app on an iPhone.
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.glb': 'model/gltf-binary',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

/** The file a request path names under `dir`, or `null` — never outside it. */
function fileFor(dir, base, path) {
  if (!path.startsWith(base)) return null;
  let relative;
  try {
    relative = decodeURIComponent(path.slice(base.length));
  } catch {
    return null;
  }
  const full = normalize(join(dir, relative));
  if (full !== dir && !full.startsWith(dir + sep)) return null;
  for (const candidate of [full, join(full, 'index.html')]) {
    try {
      const stat = statSync(candidate);
      if (stat.isFile()) return { path: candidate, stat };
    } catch {
      // Not there: the next candidate, or none.
    }
  }
  return null;
}

/**
 * Starts the server. `base` is the path the site is published under, with
 * both slashes; a request for it without the last slash is redirected, as
 * Pages does.
 */
export function servePages({ dir, base = '/Momentum-App/', port = 4173, host = '127.0.0.1', vary = 'Accept-Encoding' }) {
  const root = resolve(dir);
  const server = createServer((request, response) => {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname;
    const common = { 'Access-Control-Allow-Origin': '*', Vary: vary };
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { ...common, Allow: 'GET, HEAD' }).end();
      return;
    }
    if (`${path}/` === base) {
      response.writeHead(301, { ...common, Location: base }).end();
      return;
    }
    const file = fileFor(root, base, path);
    if (!file) {
      const body = '<!doctype html><title>Page not found</title><h1>404</h1><p>File not found.</p>';
      response.writeHead(404, { ...common, 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
      response.end(request.method === 'HEAD' ? undefined : body);
      return;
    }
    const etag = `"${file.stat.size.toString(16)}-${Math.floor(file.stat.mtimeMs).toString(16)}"`;
    const headers = {
      ...common,
      'Content-Type': TYPES[extname(file.path).toLowerCase()] ?? 'application/octet-stream',
      'Cache-Control': 'max-age=600',
      'Accept-Ranges': 'bytes',
      'Last-Modified': file.stat.mtime.toUTCString(),
      ETag: etag,
    };
    if (request.headers['if-none-match'] === etag) {
      response.writeHead(304, headers).end();
      return;
    }
    response.writeHead(200, { ...headers, 'Content-Length': file.stat.size });
    if (request.method === 'HEAD') response.end();
    else createReadStream(file.path).pipe(response);
  });
  return new Promise((done, failed) => {
    server.once('error', failed);
    server.listen(port, host, () => done(server));
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const option = (name, fallback) => {
    const at = process.argv.indexOf(`--${name}`);
    return at === -1 ? fallback : process.argv[at + 1];
  };
  const dir = option('dir', 'dist');
  const base = option('base', '/Momentum-App/');
  const port = Number(option('port', '4173'));
  const host = option('host', '127.0.0.1');
  // `--vary Origin` answers as `vite preview` did: the counter-proof.
  await servePages({ dir, base, port, host, vary: option('vary', 'Accept-Encoding') });
  console.log(`pages-server: ${resolve(dir)} at http://${host}:${port}${base}`);
}
