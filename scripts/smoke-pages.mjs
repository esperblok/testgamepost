#!/usr/bin/env node
/**
 * SpaceBlox — pagina-smoketest
 *
 * Laadt élke pagina in jsdom mét de scripts aan, en controleert:
 *   • geen JavaScript-fouten tijdens het laden
 *   • de verwachte elementen zijn er
 *   • op een spelpagina draait de engine echt een paar frames
 *
 * jsdom heeft geen canvas, dus getContext is nagebouwd als iets dat alle
 * tekenopdrachten slikt. Daarmee blijft de spelcode op de echte paden lopen:
 * update() en render() worden werkelijk aangeroepen.
 *
 *   npm run smoke        (vereist: npm install)
 */
import { JSDOM, VirtualConsole } from 'jsdom';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

let failures = 0;
function ok(msg) { console.log('  \x1b[32m✓\x1b[0m ' + msg); }
function bad(msg) { failures++; console.log('  \x1b[31m✗\x1b[0m ' + msg); }

/** Canvas-namaak: onthoudt hoeveel er getekend is, zodat we kunnen zien of render() iets deed. */
function installCanvasStub(window) {
  const calls = { count: 0 };
  const gradient = { addColorStop() {} };
  const ctx = new Proxy({}, {
    get(_t, prop) {
      if (prop === 'canvas') return {};
      if (prop === 'measureText') return () => ({ width: 10 });
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => gradient;
      if (prop === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
      return (...args) => { calls.count++; return undefined; };
    },
    set() { return true; },
  });
  window.HTMLCanvasElement.prototype.getContext = () => ctx;
  return calls;
}

async function loadPage(rel, expect) {
  const path = join(root, rel);
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push('jsdomError: ' + (e.message || e)));
  vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

  const dom = new JSDOM(readFileSync(path, 'utf8'), {
    url: 'http://localhost:8080/' + rel,
    runScripts: 'dangerously',
    resources: undefined,        // externe @import (Google Fonts) overslaan
    pretendToBeVisual: true,
    virtualConsole: vc,
  });

  installCanvasStub(dom.window);

  // jsdom laadt <script src> niet vanzelf zonder resource loader; handmatig
  // in volgorde uitvoeren is hier betrouwbaarder en doet exact hetzelfde.
  const scripts = [...dom.window.document.querySelectorAll('script[src]')]
    .map((s) => s.getAttribute('src'));
  for (const src of scripts) {
    const abs = join(dirname(path), src.split('?')[0]);
    if (!existsSync(abs)) { errors.push('script niet gevonden: ' + src); continue; }
    try {
      dom.window.eval(readFileSync(abs, 'utf8'));
    } catch (e) {
      errors.push(src + ': ' + e.message);
    }
  }

  // eventjes laten draaien (requestAnimationFrame + timers)
  await new Promise((r) => setTimeout(r, 120));

  const missing = [];
  (expect || []).forEach((sel) => {
    if (!dom.window.document.querySelector(sel)) missing.push(sel);
  });

  return { dom, errors, missing, scripts };
}

/* ════════════════════════ homepage ════════════════════════ */

console.log('\n\x1b[1mindex.html\x1b[0m');
{
  const { dom, errors, missing } = await loadPage('index.html', [
    '#grid', '#cats', '#coins', '#pbName', '#loginBtn', '#giftModal', '#authModal',
  ]);
  errors.forEach((e) => bad(e));
  if (!errors.length) ok('laadt zonder JavaScript-fouten');
  missing.forEach((m) => bad('ontbrekend element: ' + m));
  if (!missing.length) ok('alle verwachte elementen aanwezig');

  const cards = dom.window.document.querySelectorAll('#grid .game');
  if (cards.length === 12) ok('12 gamekaarten gerenderd');
  else bad('verwachtte 12 gamekaarten, zag er ' + cards.length);

  const featured = dom.window.document.querySelectorAll('#featuredGrid .game');
  if (featured.length >= 3) ok(featured.length + ' uitgelichte kaarten');
  else bad('te weinig uitgelichte kaarten: ' + featured.length);

  const cats = dom.window.document.querySelectorAll('#cats .cat');
  if (cats.length >= 5) ok(cats.length + ' categorieknoppen');
  else bad('te weinig categorieën: ' + cats.length);

  // een kaart moet naar de juiste pagina linken
  const hrefs = [...cards].map((c) => c.getAttribute('href'));
  if (hrefs.includes('games/snake.html') && hrefs.includes('games/race.html')) {
    ok('kaarten linken naar games/<id>.html');
  } else bad('kaarten linken niet goed: ' + hrefs.slice(0, 3).join(', '));

  // startkapitaal bij eerste bezoek
  if (dom.window.SB.getCoins(dom.window.localStorage) >= 100) {
    ok('eerste bezoek krijgt startmuntjes');
  } else bad('geen startmuntjes uitgedeeld');

  dom.window.close();
}

/* ════════════════════════ dashboard ════════════════════════ */

console.log('\n\x1b[1mdashboard.html\x1b[0m');
{
  const { dom, errors, missing } = await loadPage('dashboard.html', [
    '#cards', '#gameRows', '#whoAmI',
  ]);
  errors.forEach((e) => bad(e));
  if (!errors.length) ok('laadt zonder JavaScript-fouten');
  missing.forEach((m) => bad('ontbrekend element: ' + m));

  const rows = dom.window.document.querySelectorAll('#gameRows tr');
  if (rows.length === 12) ok('12 spelerijen in de tabel');
  else bad('verwachtte 12 rijen, zag er ' + rows.length);

  const admin = dom.window.document.getElementById('adminSec');
  if (admin && admin.hidden) ok('admin-sectie verborgen voor wie geen admin is');
  else bad('admin-sectie stond zichtbaar zonder ingelogde admin');

  dom.window.close();
}

/* ══════════════════ ctx.el() — de disabled-valkuil ══════════════════ */

console.log('\n\x1b[1mElementenbouw (ctx.el)\x1b[0m');
{
  const { dom, errors } = await loadPage('games/clicker.html');
  errors.forEach(bad);
  const win = dom.window;

  // Regressietest: setAttribute('disabled', null) maakte de string "null",
  // waardoor elke knop met `disabled: cond ? null : 'disabled'` op slot stond.
  const probe = win.SBShellKit.el('button', { disabled: null, text: 'x' });
  if (probe.disabled === false) ok('disabled: null houdt een knop klikbaar');
  else bad('disabled: null maakte de knop grijs');

  const probe2 = win.SBShellKit.el('button', { disabled: 'disabled' });
  if (probe2.disabled === true) ok('disabled: "disabled" zet een knop wél op slot');
  else bad('disabled: "disabled" werkte niet');

  const probe3 = win.SBShellKit.el('input', { min: '1', placeholder: 'p' });
  if (probe3.getAttribute('min') === '1' && probe3.getAttribute('placeholder') === 'p') {
    ok('gewone attributen blijven werken');
  } else bad('gewone attributen gingen stuk');

  const probe4 = win.SBShellKit.el('div', { iets: null });
  if (probe4.getAttribute('iets') === null) ok('null-attributen worden overgeslagen');
  else bad('null-attributen werden als "null" gezet');

  dom.window.close();
}

/* ════════════════════════ elke spelpagina ════════════════════════ */

await import('file://' + join(root, 'assets/js/games.js'));
const Lib = globalThis.SBLib;

for (const g of Lib.GAMES) {
  console.log('\n\x1b[1mgames/' + g.id + '.html\x1b[0m');
  const { dom, errors, missing, scripts } = await loadPage('games/' + g.id + '.html', [
    '#app', '.sb-topbar', '.sb-stage', '.sb-hud',
  ]);

  errors.forEach((e) => bad(e));
  if (!errors.length) ok('laadt zonder JavaScript-fouten');
  missing.forEach((m) => bad('ontbrekend element: ' + m));
  if (!missing.length) ok('shell is opgebouwd (topbar, stage, HUD)');

  if (!scripts.some((s) => s.includes('games/' + g.id + '.js'))) {
    bad('laadt zijn eigen module niet');
  }

  // Draait de engine echt? Vraag een paar frames op en kijk of de HUD gevuld is.
  const win = dom.window;
  for (let i = 0; i < 5; i++) {
    win.dispatchEvent(new win.Event('resize'));
    await new Promise((r) => setTimeout(r, 25));
  }

  const hudItems = dom.window.document.querySelectorAll('.sb-hud .sb-hud-item');
  const domGame = dom.window.document.querySelector('.sb-dom-game');

  if (g.render === 'canvas') {
    const canvas = dom.window.document.querySelector('.sb-stage canvas');
    if (canvas) ok('canvas aangemaakt (' + canvas.width + '×' + canvas.height + ')');
    else bad('geen canvas in het speelveld');
  } else if (domGame) {
    ok('DOM-spel heeft zijn eigen interface opgebouwd');
  } else {
    bad('geen canvas en geen DOM-interface');
  }

  if (hudItems.length > 0) ok(hudItems.length + ' HUD-tellers gevuld');
  else bad('HUD is leeg — update() heeft vermoedelijk niet gelopen');

  // De speler moet de game kunnen beëindigen zonder dat de shell omvalt.
  try {
    if (win.SBShell && win.SBShell.restart) {
      win.SBShell.restart();
      ok('herstarten zonder fouten');
    } else bad('SBShell niet beschikbaar');
  } catch (e) {
    bad('herstarten faalt: ' + e.message);
  }

  dom.window.close();
}

console.log('');
if (failures) {
  console.log('\x1b[31m\x1b[1m' + failures + ' probleem(en)\x1b[0m');
  process.exit(1);
}
console.log('\x1b[32m\x1b[1mSmoketest geslaagd:\x1b[0m alle pagina\'s laden en draaien');
