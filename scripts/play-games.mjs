#!/usr/bin/env node
/**
 * SpaceBlox — speelt de spellen echt
 *
 * Waar smoke-pages.mjs alleen kijkt of alles laadt, doet dit script wat een
 * kind doet: toetsen indrukken, op knoppen klikken, een beurt uitspelen.
 * Daarna controleren we of het spel reageerde én of de beloning echt in de
 * opslag is beland.
 *
 *   npm run play        (vereist: npm install)
 */
import { JSDOM, VirtualConsole } from 'jsdom';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

let failures = 0;
const ok = (m) => console.log('  \x1b[32m✓\x1b[0m ' + m);
const bad = (m) => { failures++; console.log('  \x1b[31m✗\x1b[0m ' + m); };

function installCanvasStub(window) {
  const gradient = { addColorStop() {} };
  const ctx = new Proxy({}, {
    get(_t, prop) {
      if (prop === 'canvas') return {};
      if (prop === 'measureText') return () => ({ width: 10 });
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => gradient;
      return () => undefined;
    },
    set() { return true; },
  });
  window.HTMLCanvasElement.prototype.getContext = () => ctx;
}

async function openPage(rel) {
  const path = join(root, rel);
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push('jsdomError: ' + (e.message || e)));
  vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

  const dom = new JSDOM(readFileSync(path, 'utf8'), {
    url: 'http://localhost:8080/' + rel,
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: vc,
  });
  installCanvasStub(dom.window);

  for (const s of dom.window.document.querySelectorAll('script[src]')) {
    const abs = join(dirname(path), s.getAttribute('src').split('?')[0]);
    if (existsSync(abs)) dom.window.eval(readFileSync(abs, 'utf8'));
    else errors.push('script ontbreekt: ' + s.getAttribute('src'));
  }
  await new Promise((r) => setTimeout(r, 80));
  return { dom, errors };
}

/** Druk een toets in zoals een browser dat zou doen. */
function key(dom, k, type) {
  dom.window.document.dispatchEvent(new dom.window.KeyboardEvent(type || 'keydown', {
    key: k, bubbles: true, cancelable: true,
  }));
}

function hudValue(dom, label) {
  const items = [...dom.window.document.querySelectorAll('.sb-hud .sb-hud-item')];
  for (const it of items) {
    if (it.querySelector('em').textContent.toLowerCase().includes(label.toLowerCase())) {
      return it.querySelector('b').textContent;
    }
  }
  return null;
}

/* ═══════════════════════ Neon Snake ═══════════════════════ */

console.log('\n\x1b[1m🐍 Neon Snake — echt spelen\x1b[0m');
{
  const { dom, errors } = await openPage('games/snake.html');
  errors.forEach(bad);

  const before = hudValue(dom, 'appels');
  ok('start op ' + before + ' appels');

  // Stuur de slang naar beneden en wacht tot hij de onderkant raakt.
  // Eén stap duurt 0.16 s en hij start op rij 12 van 24, dus na ~2 s is het voorbij.
  key(dom, 'ArrowDown');
  let ended = false;
  for (let i = 0; i < 60 && !ended; i++) {
    await new Promise((r) => setTimeout(r, 100));
    ended = dom.window.document.querySelector('.sb-overlay').classList.contains('open');
  }

  if (ended) ok('game over na de botsing met de muur');
  else bad('na 6 seconden rechtuit was er nog geen game over');

  const finalScore = dom.window.document.querySelector('.sb-final-num');
  if (finalScore) ok('eindscore getoond: ' + finalScore.textContent);
  else bad('geen eindscore op het game-over-scherm');

  const board = dom.window.document.querySelectorAll('.sb-modal .sb-board li');
  if (board.length) ok(board.length + ' regel(s) op het scorebord');
  else bad('scorebord bleef leeg');

  const stored = dom.window.SB.getBest(dom.window.localStorage, 'snake');
  if (stored.name) ok('record staat in localStorage onder "' + stored.name + '"');
  else bad('record is niet opgeslagen');

  const plays = dom.window.SB.getStats(dom.window.localStorage).plays;
  if (plays === 1) ok('speelbeurt geteld (plays = 1)');
  else bad('verwachtte plays = 1, zag ' + plays);

  const xp = dom.window.SB.getStats(dom.window.localStorage).xp;
  if (xp >= 1) ok('XP bijgeschreven: ' + xp);
  else bad('geen XP bijgeschreven');

  dom.window.close();
}

/* ═══════════════════════ Raad het Getal ═══════════════════════ */

console.log('\n\x1b[1m🔢 Raad het Getal — echt spelen\x1b[0m');
{
  const { dom, errors } = await openPage('games/guess.html');
  errors.forEach(bad);

  const win = dom.window;
  const input = win.document.querySelector('.guess-input');
  const btn = [...win.document.querySelectorAll('button')].find((b) => b.textContent === 'Raad');
  if (!input || !btn) { bad('invoer of knop niet gevonden'); }
  else {
    // Binair zoeken: dit moet altijd winnen binnen 7 gokken.
    let lo = 1;
    let hi = 100;
    let tries = 0;
    while (tries < 10) {
      const mid = Math.floor((lo + hi) / 2);
      input.value = String(mid);
      btn.click();
      tries++;
      await new Promise((r) => setTimeout(r, 30));
      const hint = win.document.querySelector('.guess-hint').textContent;
      if (hint.includes('Het was')) break;
      if (hint.includes('Hoger')) lo = mid + 1;
      else if (hint.includes('Lager')) hi = mid - 1;
    }
    if (tries <= 7) ok('gewonnen in ' + tries + ' gokken (binair zoeken werkt)');
    else bad('had meer dan 7 gokken nodig: ' + tries);

    const overlay = win.document.querySelector('.sb-overlay');
    await new Promise((r) => setTimeout(r, 800));
    if (overlay.classList.contains('open')) ok('game over met score');
    else bad('geen afrondscherm na winst');

    // Een te hoge invoer moet geweigerd worden, niet crashen.
    win.SBShell.restart();
    await new Promise((r) => setTimeout(r, 100));
    input.value = '999';
    btn.click();
    const err = win.document.querySelector('#guess-err').textContent;
    if (err) ok('buiten het bereik wordt afgewezen: "' + err + '"');
    else bad('999 werd niet afgewezen');
  }
  dom.window.close();
}

/* ═══════════════════════ Munt Clicker ═══════════════════════ */

console.log('\n\x1b[1m🪙 Munt Clicker — echt spelen\x1b[0m');
{
  const { dom, errors } = await openPage('games/clicker.html');
  errors.forEach(bad);

  const win = dom.window;
  const pad = win.document.querySelector('.cl-pad');
  if (!pad) bad('klikknop niet gevonden');
  else {
    const before = Number(win.document.querySelector('.cl-coin').textContent.replace(/\D/g, '')) || 0;
    for (let i = 0; i < 30; i++) pad.click();
    const after = Number(win.document.querySelector('.cl-coin').textContent.replace(/\D/g, '')) || 0;
    if (after >= before + 30) ok('30 klikken = ' + after + ' munten');
    else bad('klikken telde niet op: ' + before + ' → ' + after);

    // Genoeg klikken voor de eerste upgrade (25 munten), dan kopen.
    // Let op: renderShop() herbouwt de winkel, dus daarna opnieuw opzoeken.
    for (let i = 0; i < 60; i++) pad.click();
    const saldoVoor = Number(win.document.querySelector('.cl-coin').textContent.replace(/\D/g, ''));
    win.document.querySelectorAll('.cl-up')[0].click();
    await new Promise((r) => setTimeout(r, 30));

    const label = win.document.querySelectorAll('.cl-up')[0].querySelector('.cl-up-text b').textContent;
    if (label.includes('×1')) ok('upgrade gekocht: ' + label);
    else bad('upgrade niet gekocht, label is: ' + label);

    const saldoNa = Number(win.document.querySelector('.cl-coin').textContent.replace(/\D/g, ''));
    if (saldoNa < saldoVoor) ok('prijs afgetrokken: ' + saldoVoor + ' → ' + saldoNa);
    else bad('er werd niets afgetrokken: ' + saldoVoor + ' → ' + saldoNa);

    const perKlik = win.document.querySelectorAll('.sb-hud .sb-hud-item')[1].querySelector('b').textContent;
    if (Number(perKlik) === 2) ok('"per klik" steeg naar ' + perKlik);
    else bad('verwachtte 2 per klik, zag ' + perKlik);

    // Incasseren: munten moeten echt in het saldo belanden.
    const saldoBefore = win.SB.getCoins(win.localStorage);
    const cashBtn = [...win.document.querySelectorAll('button')].find((b) => b.textContent.includes('Incasseren'));
    cashBtn.click();
    await new Promise((r) => setTimeout(r, 60));
    const saldoAfter = win.SB.getCoins(win.localStorage);
    if (saldoAfter > saldoBefore) {
      ok('incasseren verhoogt het saldo: ' + saldoBefore + ' → ' + saldoAfter);
    } else bad('incasseren deed niets: ' + saldoBefore + ' → ' + saldoAfter);
  }
  dom.window.close();
}

/* ═══════════════════════ Block Run ═══════════════════════ */

console.log('\n\x1b[1m🧱 Block Run — echt spelen\x1b[0m');
{
  const { dom, errors } = await openPage('games/blockrun.html');
  errors.forEach(bad);

  // Ren naar rechts en spring; de speler moet van het startplatform afkomen.
  key(dom, 'ArrowRight');
  for (let i = 0; i < 25; i++) {
    key(dom, ' ');
    await new Promise((r) => setTimeout(r, 60));
  }
  key(dom, 'ArrowRight', 'keyup');
  await new Promise((r) => setTimeout(r, 120));

  const hud = hudValue(dom, 'level');
  if (hud) ok('level-teller staat op ' + hud);
  else bad('geen level in de HUD');

  // Levens moeten er zijn, en vallen kost er een.
  const lives = hudValue(dom, 'levens');
  if (lives && Number(lives) <= 3) ok('levens bijgehouden: ' + lives);
  else bad('onverwachte levens: ' + lives);

  dom.window.close();
}

/* ═══════════════════════ Inloggen vanaf de homepage ═══════════════════════ */

console.log('\n\x1b[1m👤 Registreren en inloggen\x1b[0m');
{
  const { dom, errors } = await openPage('index.html');
  errors.forEach(bad);
  const win = dom.window;

  win.document.getElementById('regUser').value = 'Kaan';
  win.document.getElementById('regPass').value = 'geheim1';
  win.document.getElementById('regPass2').value = 'geheim1';
  await win.document.getElementById('regSubmit').click();
  await new Promise((r) => setTimeout(r, 120));

  if (win.SB.getSession(win.localStorage)) ok('registreren logt meteen in');
  else bad('registreren logde niet in');

  const raw = Object.keys(win.localStorage).map((k) => win.localStorage.getItem(k)).join('|');
  if (!raw.includes('geheim1')) ok('het wachtwoord staat nergens in localStorage');
  else bad('plaintext wachtwoord gevonden in localStorage');

  // Uitloggen en met een fout wachtwoord proberen.
  win.SBAuth.logout(win.localStorage);
  const wrong = await win.SBAuth.login(win.localStorage, 'Kaan', 'verkeerd1');
  if (!wrong.ok) ok('fout wachtwoord wordt geweigerd');
  else bad('fout wachtwoord werd geaccepteerd');

  const right = await win.SBAuth.login(win.localStorage, 'Kaan', 'geheim1');
  if (right.ok) ok('goed wachtwoord werkt na uitloggen');
  else bad('goed wachtwoord werkte niet');

  dom.window.close();
}

console.log('');
if (failures) {
  console.log('\x1b[31m\x1b[1m' + failures + ' probleem(en)\x1b[0m');
  process.exit(1);
}
console.log('\x1b[32m\x1b[1mSpeeltest geslaagd\x1b[0m — invoer, scores en beloningen werken');
