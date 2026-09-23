#!/usr/bin/env node
/**
 * Loopt alle HTML langs en controleert of elke verwijzing echt bestaat.
 * Vangt de klassiekers: een <script src> naar een bestand dat er niet is,
 * een game in games.js zonder module of zonder pagina, een CSS-link naar niks.
 *
 *   npm run check
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

let errors = 0;
let checked = 0;

function fail(msg) {
  errors++;
  console.log('  \x1b[31m✗\x1b[0m ' + msg);
}
function pass(msg) {
  console.log('  \x1b[32m✓\x1b[0m ' + msg);
}

function htmlFiles(dir, acc) {
  acc = acc || [];
  readdirSync(dir).forEach((name) => {
    if (name === '.git' || name === 'node_modules') return;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) htmlFiles(full, acc);
    else if (name.endsWith('.html')) acc.push(full);
  });
  return acc;
}

console.log('\n\x1b[1mBestandsverwijzingen in HTML\x1b[0m');

const pages = htmlFiles(root);
const missing = [];

pages.forEach((page) => {
  const html = readFileSync(page, 'utf8');
  const rel = page.slice(root.length + 1);
  const refs = [];

  const patterns = [
    /<script[^>]+src=["']([^"']+)["']/g,
    /<link[^>]+href=["']([^"']+)["']/g,
    /<a[^>]+href=["']([^"']+)["']/g,
  ];
  patterns.forEach((re) => {
    let m;
    while ((m = re.exec(html))) refs.push(m[1]);
  });

  refs.forEach((ref) => {
    if (/^(https?:|mailto:|#|data:|javascript:)/.test(ref)) return;
    const clean = ref.split('?')[0].split('#')[0];
    if (!clean) return;
    checked++;
    const target = resolve(dirname(page), clean);
    if (!existsSync(target)) missing.push(rel + ' → ' + ref);
  });
});

if (missing.length) {
  missing.forEach((m) => fail('kapotte verwijzing: ' + m));
} else {
  pass(checked + ' verwijzingen in ' + pages.length + ' pagina\'s, allemaal gevonden');
}

/* ── games.js ↔ modules ↔ pagina\'s ── */

console.log('\n\x1b[1mGamebibliotheek ↔ bestanden\x1b[0m');

await import('file://' + join(root, 'assets/js/games.js'));
const Lib = globalThis.SBLib;

Lib.GAMES.forEach((g) => {
  const mod = join(root, 'assets/js/games/' + g.id + '.js');
  const page = join(root, 'games/' + g.id + '.html');
  const css = join(root, 'assets/css/games/' + g.id + '.css');
  if (!existsSync(mod)) fail(g.id + ': module assets/js/games/' + g.id + '.js ontbreekt');
  if (!existsSync(page)) fail(g.id + ': pagina games/' + g.id + '.html ontbreekt');
  if (!existsSync(css)) fail(g.id + ': assets/css/games/' + g.id + '.css ontbreekt');

  if (existsSync(page)) {
    const html = readFileSync(page, 'utf8');
    if (!html.includes('data-game="' + g.id + '"')) {
      fail(g.id + ': games/' + g.id + '.html heeft geen data-game="' + g.id + '"');
    }
  }
  if (existsSync(mod)) {
    const src = readFileSync(mod, 'utf8');
    if (!src.includes('SBGames.' + g.id)) {
      fail(g.id + ': module registreert zich niet als SBGames.' + g.id);
    }
  }
});

// Omgekeerd: staat er een module of pagina die niet in de bibliotheek staat?
readdirSync(join(root, 'assets/js/games')).forEach((f) => {
  const id = f.replace(/\.js$/, '');
  if (!Lib.byId(id)) fail('assets/js/games/' + f + ' staat niet in games.js (onbereikbaar)');
});
readdirSync(join(root, 'games')).forEach((f) => {
  const id = f.replace(/\.html$/, '');
  if (!Lib.byId(id)) fail('games/' + f + ' staat niet in games.js (onbereikbaar)');
});

pass(Lib.GAMES.length + ' games: module, pagina en css aanwezig en geregistreerd');

/* ── service worker cachet wat er is ── */

console.log('\n\x1b[1mService worker\x1b[0m');

const sw = readFileSync(join(root, 'sw.js'), 'utf8');
const listed = [...sw.matchAll(/^\s*'\.\/([^']+)'/gm)].map((m) => m[1]);
listed.forEach((f) => {
  if (!existsSync(join(root, f))) fail('sw.js cachet ' + f + ' maar dat bestand bestaat niet');
});
pass(listed.length + ' bestanden in de cache-lijst bestaan allemaal');

console.log('');
if (errors) {
  console.log('\x1b[31m\x1b[1m' + errors + ' probleem(en)\x1b[0m');
  process.exit(1);
}
console.log('\x1b[32m\x1b[1mPagina-check geslaagd\x1b[0m (' + checked + ' verwijzingen)');
