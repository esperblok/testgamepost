#!/usr/bin/env node
// FAKEVIRUS — hoofdvenster en orkestrator.
//
// Dit programma opent meerdere terminals, speelt geluid af en toont fake overlays.
// Het DOET NIETS: er wordt niets op de computer veranderd. Geen bestanden, geen
// registry, geen netwerk, geen ransomware. Alles wat je ziet is verzonnen.
//
// Gebruik:
//   node app.js                      -> standaard prank (14 terminals)
//   node app.js --terminals 24       -> meer terminals
//   node app.js --countdown 120      -> kortere countdown
//   node app.js --sound off          -> géén geluid
//   node app.js --overlays off       -> geen overlays
//   node app.js --stop               -> alles uitschakelen
//   node app.js --self-test          -> console-check, geen vensters

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  C, paint, substitute, randInt, pick, chance, bar, sleep, mmss, stamp,
} from './lib/util.js';
import { ROLES, FEED, SCARY_EVENTS, VIRUS_FACTS } from './lib/scenes.js';
import { box, centerRender } from './lib/ascii.js';
import { ensureSounds, soundDir, requestSound, NOISE_POOL } from './lib/sound.js';
import {
  IS_WINDOWS, openTerminal, openOverlay, startSoundDaemon, killEngine, track, killTerminals,
} from './lib/spawn.js';

const EOL = process.platform === 'win32' ? '\r\n' : '\n';
const TERMINAL_SCRIPT = fileURLToPath(new URL('./terminal.js', import.meta.url));
const TERMINAL_DIR = path.dirname(TERMINAL_SCRIPT);
const WIDTH = 78;

// ------------------------------------------------------------------ args
function parseArgs(argv) {
  const out = { terminals: 14, countdown: 600, sound: 'on' };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith('--')) continue;
    const name = key.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      out[name] = true;
    } else {
      out[name] = next;
      i += 1;
    }
  }
  out.terminals = Math.max(1, Math.min(64, Number(out.terminals) || 14));
  if (out.countdown === true) out.countdown = 600;
  out.countdown = Math.max(0, Number(out.countdown) || 0);
  return out;
}

const ARGS = parseArgs(process.argv.slice(2));
const PRANK = ARGS['no-scary-note'] !== true;
const SHOW_DISCLAIMER = ARGS.disclaimer !== 'off';

// ------------------------------------------------------------------ helpers
function write(text = '') {
  process.stdout.write(`${text}${EOL}`);
}

function panel(title, lines) {
  for (const line of box(title, lines, WIDTH)) write(line);
  write('');
}

const status = (label, value, color) =>
  `${paint(label.padEnd(16), C.dim)}${paint(String(value), color)}`;

// ------------------------------------------------------------------ overlays
function overlayDir() {
  return path.join(os.tmpdir(), 'fakevirus_overlays');
}

function spawnRansomNote() {
  if (!IS_WINDOWS) {
    write(paint('[!] (demo) de ransom-note works alleen op Windows', C.yellow));
    return null;
  }
  const dir = overlayDir();
  fs.mkdirSync(dir, { recursive: true });
  const noteFile = path.join(dir, 'ransom.txt');

  const lines = [
    '==================================================',
    '  YOUR SYSTEM HAS BEEN LOCKED',
    '==================================================',
    '',
    '  All your files have been encrypted.',
    `  Encrypted:      ${pick(['447,221', '384,119', '912,004'])} files`,
    '  Shadow copies:  deleted',
    '  Backups:        removed',
    `  Ransomware:     FAKEVIRUS ${VIRUS_FACTS.versie}`,
    '',
    `  To recover your files, pay ${substitute('{{money}}')} in Bitcoin to:`,
    `    ${substitute('{{hash}}')}${substitute('{{hash}}')}:${substitute('{{hash}}')}`,
    '',
    '  Deadline: 44 hours. After that, your files are gone forever.',
    '  Do not restart your computer. Do not contact support.',
    '==================================================',
  ];
  if (PRANK) {
    lines.push('');
    lines.push('  p.s. dit is een nep-virus uit een GitHub-repo.');
    lines.push('  Er is niets met je computer gebeurd. Sluit dit venster.');
  }
  fs.writeFileSync(noteFile, `${lines.join('\r\n')}\r\n`, 'utf8');

  return track(openOverlay('overlays/ransom.ps1', ['-NoteFile', noteFile]));
}

function spawnBsod(seconds = 3) {
  if (!IS_WINDOWS) return null;
  return track(openOverlay('overlays/bsod.ps1', ['-Seconds', String(seconds)]));
}

function spawnFlash(ms, text, color) {
  if (!IS_WINDOWS) return null;
  return track(openOverlay('overlays/flash.ps1', [
    '-Milliseconds', String(ms),
    '-Text', text || '',
    '-Color', color || 'Red',
  ]));
}

// ------------------------------------------------------------------ startup
async function banner() {
  write('');
  write(paint('█'.repeat(WIDTH), C.brightRed));
  for (const line of centerRender('FAKEVIRUS', WIDTH, 2)) write(paint(line, C.brightRed));
  for (const line of centerRender('PRANK ENGINE', WIDTH, 1)) write(paint(line, C.gray));
  write(paint('█'.repeat(WIDTH), C.brightRed));
  write('');

  panel('VIRUS SIGNATURE', [
    status('naam', VIRUS_FACTS.naam, C.brightRed),
    status('versie', VIRUS_FACTS.versie, C.yellow),
    status('hash', substitute(VIRUS_FACTS.hash), C.gray),
    status('formaat', VIRUS_FACTS.formaat, C.gray),
    status('compiled', substitute(VIRUS_FACTS.compiled), C.gray),
    status('schrijver', VIRUS_FACTS.schrijver, C.gray),
  ]);

  panel('ENGINE', [
    status('terminals', `${ARGS.terminals} geopend`, C.green),
    status('geluid', ARGS.sound === 'off' ? 'uit' : 'aan — heel veel', C.green),
    status('overlays', ARGS.overlays === 'off' ? 'uit' : 'aan', C.green),
    status('countdown', ARGS.countdown ? `${mmss(ARGS.countdown)} (${ARGS.countdown}s)` : 'uit', C.brightYellow),
    status('mode', PRANK ? 'prank' : 'demo', C.gray),
  ]);

  if (SHOW_DISCLAIMER) {
    panel('DISCLAIMER', [
      paint('  Dit is een nep-virus voor in een grap. Er wordt niets veranderd,', C.yellow),
      paint('  niets versleuteld, niets weggehaald, niets doorgestuurd.', C.yellow),
      paint('  Sluit dit venster, of gebruik STOP_FAKE_VIRUS.bat om alles uit te zetten.', C.yellow),
      paint('  --disclaimer off verbergt deze tekst (niet doen bij kinderen).', C.gray),
    ]);
  }
}

// ------------------------------------------------------------------ main
async function main() {
  if (ARGS.stop) {
    write(paint('[*] FAKEVIRUS uitschakelen…', C.brightYellow));
    write(paint(killEngine() || '[*] alles gestopt (er was niets actief)', C.green));
    write(paint('[*] je computer is netjes, zoals altijd.', C.green));
    process.exit(0);
  }

  if (ARGS['self-test'] || ARGS['check']) {
    const { runSelfTest } = await import('./tests/selftest.mjs');
    const ok = await runSelfTest({ verbose: true });
    process.exit(ok ? 0 : 1);
  }

  const soundsOn = ARGS.sound !== 'off' && ARGS.sound !== 'false';
  const soundsDir = soundDir();

  write(paint('[*] FAKEVIRUS starten — alle processen zijn fake.', C.brightCyan));
  write(paint('[*] Geen bestanden worden veranderd. Dit is een demonstratie.', C.gray));
  write('');

  if (soundsOn) {
    const files = ensureSounds(soundsDir);
    write(paint(`[*] ${Object.keys(files).length} geluidsbestanden klaar in ${soundsDir}`, C.gray));
    startSoundDaemon('overlays/sound-daemon.ps1');
    write(paint('[*] Geluidsdaemon gestart.', C.gray));
  } else {
    write(paint('[*] Geluid uitgeschakeld.', C.gray));
  }

  if (!IS_WINDOWS) {
    write(paint('[!] Dit venster is bedoeld voor Windows. Op dit systeem wordt alleen', C.yellow));
    write(paint('    de tekst getoond, geen echte terminals of overlays.', C.yellow));
    write('');
  }

  await banner();

  for (let i = 0; i < ARGS.terminals; i += 1) {
    const role = ROLES[i % ROLES.length];
    track(openTerminal({
      role: role.id,
      id: i + 1,
      terminalScript: TERMINAL_SCRIPT,
      appDir: TERMINAL_DIR,
      soundsDir,
    }));
  }
  const geopend = [];
  for (let i = 0; i < ARGS.terminals; i += 1) geopend.push(ROLES[i % ROLES.length].id);
  write(paint(`[+] ${ARGS.terminals} terminals geopend: ${geopend.join(', ')}`, C.green));
  write('');
  write(paint('─'.repeat(WIDTH), C.dim));
  write(paint('  LIVE FEED — het lijkt hacken, maar dit is allemaal verzonnen', C.gray));
  write(paint('─'.repeat(WIDTH), C.dim));
  write('');

  if (soundsOn) requestSound('powerUp');

  // ------------------------------------------------------------------ state
  let encrypted = 0;
  let scanned = 0;
  let bots = randInt(400, 500);
  let coins = 0;
  let secondsLeft = ARGS.countdown;
  let feedCount = 0;
  let scarySent = 0;
  let bsodSent = 0;
  let flashSent = 0;
  let ransomSent = 0;
  let startedAt = Date.now();
  let lastFeed = Date.now();
  let lastStatus = Date.now();
  let lastScary = Date.now();
  let lastBsod = Date.now();
  let lastFlash = Date.now();
  let lastHeartbeat = 0;
  const maxSeconds = Number(ARGS['max-seconds'] || 0);

  const statusLine = () => {
    const encryptPct = Math.min(100, Math.round((encrypted / 447221) * 100));
    const city = substitute('{{city}}');
    write(paint('─'.repeat(WIDTH), C.dim));
    write(status('FILES', `${encrypted.toLocaleString('en-US')} / 447,221 versleuteld ${bar(encryptPct, 18)}`, C.brightRed));
    write(status('SCANNED', `${scanned.toLocaleString('en-US')} adressen in het ${city}-netwerk`, C.green));
    write(status('BOTNET', `${bots} hosts online`, C.green));
    write(status('COINS', `${coins.toFixed(4)} BTC`, C.yellow));
    write(status('TIJD', ARGS.countdown ? `SHUTDOWN IN ${mmss(secondsLeft)}` : 'GEDOOGD', C.brightYellow));
    write(status('FEED', `${feedCount} items`, C.gray));
    write(paint('─'.repeat(WIDTH), C.dim));
    write('');
  };

  const feedColors = { ok: C.brightGreen, warn: C.brightYellow, bad: C.brightRed };

  while (true) {
    const now = Date.now();
    const delta = (now - lastFeed) / 1000;
    lastFeed = now;

    // ---- countdown
    if (ARGS.countdown) {
      secondsLeft = Math.max(0, secondsLeft - delta);
      const urgency = secondsLeft < 60 ? 1 : secondsLeft < 180 ? 3 : 6;
      if (now - lastHeartbeat > urgency * 1000) {
        lastHeartbeat = now;
        if (soundsOn) requestSound(secondsLeft < 60 ? 'heartbeatFast' : 'heartbeat');
        if (secondsLeft < 60 && Math.floor(secondsLeft) % 10 === 0) {
          write(paint(`[!] SHUTDOWN IN ${mmss(secondsLeft)} — dit wordt pijnlijk`, C.brightRed));
        }
      }

      if (secondsLeft === 60 && ransomSent < 2) {
        spawnRansomNote();
        ransomSent += 1;
        write(paint('[!] BETALING GEVRAAGD — ransom note geopend', C.brightRed));
      }
      if (secondsLeft === 0 && ransomSent >= 1) {
        if (soundsOn) requestSound('alarm');
        spawnFlash(900, 'SYSTEM SHUTDOWN CANCELLED', 'Red');
        write(paint('[!] TIJD OM — systeemuitvoering geannuleerd (omdat dit nep is)', C.brightRed));
        write(paint('[+] Je computer draait net als voorheen. Fijn dagje.', C.green));
        if (soundsOn) requestSound('powerDown');
      }
    }

    // ---- feed
    if (now - lastFeed > 2100) {
      const item = pick(FEED);
      const color = feedColors[item.level] || C.white;
      write(`${paint(stamp().slice(11), C.dim)} ${paint(`[${item.level[0].toUpperCase()}]`, color)} ${paint(substitute(item.text), color)}`);
      feedCount += 1;
    }

    // ---- grote blikvangers
    if (now - lastScary > 16000 && scarySent < 40) {
      lastScary = now;
      scarySent += 1;
      const event = substitute(pick(SCARY_EVENTS));
      write('');
      write(paint('█'.repeat(WIDTH), C.brightRed));
      for (const line of centerRender(event, WIDTH, 1)) write(paint(line, C.brightRed));
      write(paint('█'.repeat(WIDTH), C.brightRed));
      write('');
      if (soundsOn) requestSound(pick(['alert', 'denied', 'error', 'alarm']));
    }

    // ---- overlays
    if (ARGS.overlays !== 'off') {
      if (now - lastBsod > 45000 && bsodSent < 4) {
        lastBsod = now;
        bsodSent += 1;
        spawnBsod(randInt(2, 4));
        write(paint('[!] BLUE SCREEN — even stilte… (fake)', C.brightCyan));
        if (soundsOn) requestSound('buzz');
      }
      if (now - lastFlash > 30000 && flashSent < 8) {
        lastFlash = now;
        flashSent += 1;
        spawnFlash(randInt(250, 600), pick(['ACCESS DENIED', 'TRACING…', 'DO NOT CLOSE', '', '']), pick(['Red', 'Black']));
        if (soundsOn) requestSound(pick(['denied', 'alert', 'static', 'error']));
      }
      if (ransomSent === 0 && now - startedAt > 30000 && chance(0.5)) {
        spawnRansomNote();
        ransomSent += 1;
        write(paint('[!] RANSOM NOTE geopend op je bureaublad', C.brightRed));
        if (soundsOn) requestSound('alarm');
      }
    }

    // ---- stats
    if (now - lastStatus > 6000) {
      encrypted = Math.min(447221, encrypted + randInt(20, 320));
      scanned += randInt(1200, 5200);
      bots = Math.max(120, Math.min(999, bots + randInt(-6, 7)));
      coins += Math.random() * 0.02;
      statusLine();
      lastStatus = now;
    }

    // ---- geluidsmuur: heel veel geluid
    if (soundsOn && chance(0.35)) requestSound(pick(NOISE_POOL));

    if (maxSeconds && now - startedAt > maxSeconds * 1000) break;
    await sleep(250);
  }

  write('');
  write(paint('[*] FAKEVIRUS stopt — nothing was ever touched.', C.green));
  killTerminals();
  process.exit(0);
}

// ------------------------------------------------------------------ signals
let stopping = false;
function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  write('');
  write(paint('[!] FAKEVIRUS uitzetten… er is niets veranderd op je PC.', C.brightYellow));
  killTerminals();
  if (ARGS['keep-windows'] !== 'true') killEngine();
  write(paint('[+] Klaar. Je computer is ongerept.', C.green));
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
process.on('exit', () => {
  if (!stopping) killTerminals();
});

main().catch((error) => {
  write(paint(`[!] fout: ${error && error.stack ? error.stack : error}`, C.brightRed));
  process.exit(1);
});
