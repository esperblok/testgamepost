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
    // nieuwe Roblox-chrome
    '.rb-nav', '.rb-side', '#hero', '#heroTitle', '#rows', '#detailModal', '#shopGrid', '#avFigure',
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

  // de rijen die horizontaal scrollen
  const rows = dom.window.document.querySelectorAll('#rows .rb-row');
  const rowCards = dom.window.document.querySelectorAll('#rows .rb-track .game');
  if (rows.length >= 5 && rowCards.length >= 20) ok(rows.length + ' rijen met ' + rowCards.length + ' kaarten');
  else bad('rijen niet goed opgebouwd: ' + rows.length + ' rijen, ' + rowCards.length + ' kaarten');

  // de hero toont een echt spel
  const heroTitle = dom.window.document.getElementById('heroTitle').textContent;
  if (heroTitle && heroTitle !== '—') ok('hero gevuld met "' + heroTitle + '"');
  else bad('hero is leeg');

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

/* ═══════════════════════ avatarpagina ════════════════════════ */

console.log('\n\x1b[1mprofile.html\x1b[0m');
{
  const { dom, errors, missing } = await loadPage('profile.html', [
    '#avFigure', '.av-fig', '#avSkins', '#avHats', '#recordList', '#avProfileName',
  ]);
  errors.forEach((e) => bad(e));
  if (!errors.length) ok('laadt zonder JavaScript-fouten');
  missing.forEach((m) => bad('ontbrekend element: ' + m));
  if (!missing.length) ok('alle verwachte elementen aanwezig');

  const win = dom.window;
  const fig = win.document.querySelector('.av-fig');
  const parts = win.document.querySelectorAll('.av-fig .av-part');
  if (parts.length === 6) ok('pop bestaat uit 6 blokjes (hoofd, romp, 2 armen, 2 benen)');
  else bad('verwachtte 6 blokjes, zag er ' + parts.length);

  const skins = win.document.querySelectorAll('#avSkins .av-swatch');
  const hats = win.document.querySelectorAll('#avHats .av-tile');
  if (skins.length === win.SB.shopFor('skin').length) ok(skins.length + ' huidkleuren in de kiezer');
  else bad('huidkleuren kloppen niet: ' + skins.length);
  if (hats.length === win.SB.shopFor('hat').length) ok(hats.length + ' hoofddeksels in de kiezer');
  else bad('hoofddeksels kloppen niet: ' + hats.length);

  if (fig && fig.dataset.skin === 'groen') ok('nieuw profiel draagt de gratis kleur');
  else bad('standaardkleur klopt niet: ' + (fig && fig.dataset.skin));

  // klikken op een betaalde kleur moet kopen én aantrekken
  const paid = [...skins].find((s) => s.dataset.skin === 'blauw');
  const before = win.SB.getCoins(win.localStorage);
  paid.click();
  const after = win.SB.getCoins(win.localStorage);
  if (win.SB.getProfile(win.localStorage).skin === 'blauw') ok('klik op een kleur koopt en trekt hem aan');
  else bad('kleur werd niet aangetrokken');
  if (after === before - 60) ok('prijs afgetrokken: ' + before + ' → ' + after);
  else bad('prijs klopt niet: ' + before + ' → ' + after);

  dom.window.close();
}

/* ═══════════════════════ juice (effectenlaag) ═════════════════ */

console.log('\n\x1b[1massets/js/juice.js\x1b[0m');
{
  // UMD-module: als side-effect importeren, daarna van globalThis halen
  await import('file://' + join(root, 'assets/js/juice.js'));
  const juice = globalThis.SBJuice;
  const calls = { n: 0 };
  const gradient = { addColorStop() {} };
  const fakeCtx = new Proxy({}, {
    get(_t, prop) {
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => gradient;
      if (prop === 'measureText') return () => ({ width: 10 });
      return (...a) => { calls.n++; return undefined; };
    },
    set() { return true; },
  });

  const fx = juice.fx(fakeCtx, { w: 480, h: 480 });
  fx.burst(100, 100, { colors: ['#fff', '#0f0'], count: 12 });
  fx.pop(50, 50, '+1');
  fx.ring(50, 50, { color: '#fff' });
  fx.shake(8);
  if (fx.count === 12) ok('burst maakt 12 deeltjes');
  else bad('verwachtte 12 deeltjes, zag er ' + fx.count);
  if (fx.shaking) ok('shake staat aan na fx.shake(8)');
  else bad('shake stond niet aan');

  // eerst tekenen mét levende deeltjes, dan pas laten uitdoven
  for (let i = 0; i < 6; i++) fx.update(0.05);
  fx.begin();
  fx.end();
  if (calls.n > 40) ok('tekenen doet echt iets (' + calls.n + ' canvas-opdrachten)');
  else bad('te weinig getekend: ' + calls.n);

  for (let i = 0; i < 60; i++) fx.update(0.05);
  if (fx.count === 0) ok('deeltjes sterven uit na 3 seconden');
  else bad('deeltjes bleven hangen: ' + fx.count);

  const sf = juice.starfield(fakeCtx, { w: 480, h: 480, count: 20 });
  if (sf.stars.length === 20) ok('sterrenveld heeft 20 sterren');
  else bad('sterrenveld klopt niet: ' + sf.stars.length);
  sf.update(0.1, 40);
  sf.draw(fakeCtx);
  ok('sterrenveld tekent zonder fouten');

  if (juice.clamp(5, 0, 3) === 3 && juice.lerp(0, 10, 0.25) === 2.5) ok('clamp en lerp rekenen goed');
  else bad('clamp/lerp kloppen niet');
}

/* ════════════════════════ dashboard ════════════════════════ */

console.log('\n\x1b[1mdashboard.html\x1b[0m');
{
  const { dom, errors } = await loadPage('dashboard.html', []);
  errors.forEach((e) => bad(e));
  if (!errors.length) ok('laadt zonder JavaScript-fouten');

  // Nieuw gedrag: zonder ingelogde admin toont het dashboard een slot en
  // GEEN gegevens. Met admin zouden #cards en 12 rijen verschijnen.
  const doc = dom.window.document;
  const locked = /alleen voor de beheerder/i.test(doc.body.textContent);
  const cards = doc.getElementById('cards');
  if (locked && !cards) ok('dashboard vergrendeld voor niet-admins (geen data gelekt)');
  else if (!locked && cards) ok('dashboard toont data (admin-sessie aanwezig)');
  else bad('dashboard-slot werkt niet goed (locked=' + locked + ', cards=' + !!cards + ')');

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
