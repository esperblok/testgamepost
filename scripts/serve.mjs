#!/usr/bin/env node
/**
 * Simpele statische server om SpaceBlox lokaal te proberen.
 *
 *   npm run serve            → http://localhost:8080
 *   PORT=3000 npm run serve  → http://localhost:3000
 *
 * Bindt op 0.0.0.0 zodat je ook vanaf een ander apparaat op het netwerk kunt
 * kijken (handig om de touch-bediening op een telefoon te testen).
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, normalize, extname } from 'node:path';
import { networkInterfaces } from 'node:os';

const root = join(import.meta.dirname, '..');
const port = Number(process.env.PORT) || 8080;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let path = decodeURIComponent(url.pathname);
    if (path.endsWith('/')) path += 'index.html';

    // normaliseren en controleren dat we niet uit de root ontsnappen (../)
    const safe = normalize(path).replace(/^(\.\.[/\\])+/, '');
    const file = join(root, safe);
    if (!file.startsWith(root)) {
      res.writeHead(403).end('Verboden');
      return;
    }

    let info;
    try {
      info = await stat(file);
    } catch {
      res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
      res.end('<h1>404 — ' + safe + ' bestaat niet</h1><p><a href="/">Naar de homepage</a></p>');
      return;
    }

    const target = info.isDirectory() ? join(file, 'index.html') : file;
    const body = await readFile(target);
    res.writeHead(200, {
      'content-type': TYPES[extname(target)] || 'application/octet-stream',
      // geen cache tijdens het ontwikkelen, anders zie je je wijziging niet
      'cache-control': 'no-store',
    });
    res.end(body);
  } catch (err) {
    res.writeHead(500).end('Fout: ' + err.message);
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log('\n🎮 SpaceBlox draait op:');
  console.log('   http://localhost:' + port);
  Object.values(networkInterfaces()).flat().forEach((i) => {
    if (i && i.family === 'IPv4' && !i.internal) {
      console.log('   http://' + i.address + ':' + port + '  (ander apparaat)');
    }
  });
  console.log('\nStoppen met Ctrl+C\n');
});
