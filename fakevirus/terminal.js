#!/usr/bin/env node
// Één fake terminalvenster. Iedere instantie krijgt een rol en prints een
// onafbroken stroom verzonnen commands. Dit venster is een console-venster op
// Windows en is 100% onschuldig: er wordt niets op de computer veranderd.

import process from 'node:process';
import { ROLES, roleById } from './lib/scenes.js';
import { C, paint, substitute, randInt, pick, chance, bar, sleep, stamp } from './lib/util.js';
import { requestSound } from './lib/sound.js';
import { render } from './lib/ascii.js';

const EOL = process.platform === 'win32' ? '\r\n' : '\n';

function parseArgs(argv) {
  const out = {};
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
  return out;
}

const args = parseArgs(process.argv.slice(2));
const role = roleById(args.role) || ROLES[0];
const id = Number(args.id || 0);
const maxLines = Number(args.lines || 0);
const noSound = args.sound === 'off' || args.noSound === 'true';
const soundDir = args.sounds && args.sounds !== 'off' ? args.sounds : null;

function play(name) {
  if (noSound || !soundDir) return;
  try {
    requestSound(name);
  } catch {
    /* geen noodzaak om te crashesen */
  }
}

/** Hoogstens één geluid per regel, met een kans afgeleid van het totaal gewicht. */
function weightedSound(weights) {
  const entries = Object.entries(weights || {});
  if (!entries.length) return;
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (total <= 0 || !chance(Math.min(0.4, total * 0.3))) return;
  let r = Math.random() * total;
  for (const [name, weight] of entries) {
    r -= weight;
    if (r <= 0) {
      play(name);
      return;
    }
  }
}

const SPEED = {
  scan: [55, 240],
  ssh: [110, 430],
  win: [90, 360],
  ps: [80, 320],
  trace: [180, 700],
  payload: [90, 420],
  crypto: [140, 520],
  wifi: [120, 480],
  sql: [100, 400],
  exploit: [100, 420],
  tor: [200, 760],
  keylog: [35, 150],
  botnet: [90, 380],
  tremium: [80, 300],
};
const [minDelay, maxDelay] = SPEED[role.id] || [80, 340];

const TITLE_POOL = [
  `FAKEVIRUS :: ${role.window}`,
  `${role.window} :: LIVE`,
  'DO NOT CLOSE THIS WINDOW',
  'SYSTEM32 :: 447 PROCESSES',
  `ACCESS GRANTED :: ${role.window}`,
  `TRACING :: ${role.window}`,
  'C2 :: CONNECTED',
  'YOUR PC IS INFECTED',
  `${role.window} :: ROOT`,
];

let lineCount = 0;
let titleIndex = 0;

function write(text) {
  process.stdout.write(`${text}${EOL}`);
}

function paintRole(text) {
  return paint(text, C[role.color] || C.white);
}

function makeRng(seed) {
  let s = (seed + id * 7919) >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 0xffffffff;
  };
}

async function main() {
  const seed = Number(args.seed || Date.now() % 100000);
  const rng = makeRng(seed);
  const pickR = (list) => {
    if (!list || !list.length) return null;
    return list[Math.floor(rng() * list.length) % list.length];
  };

  if (args.silent !== 'true') {
    write('');
    for (const artLine of render(role.id, { scale: 1 })) {
      write(paintRole(artLine));
    }
    write(paintRole(` ${role.title} :: ${role.window}`));
    write(paintRole(` pid ${44700 + id} · started ${stamp()}`));
    write('');
    write(paint('─'.repeat(78), C.dim));
    for (const line of role.intro) {
      write(paintRole(`[i] ${substitute(line)}`));
    }
    write(paint('─'.repeat(78), C.dim));
    write('');
  }

  let i = 0;
  while (maxLines === 0 || i < maxLines) {
    const template = pickR(role.lines);
    const text = substitute(template);
    const prefix = chance(0.25) ? `${paintRole(String(lineCount).padStart(4, '0'))} ` : '';
    write(`${prefix}${paintRole(text)}`);
    lineCount += 1;
    i += 1;

    weightedSound(role.sounds);

    if (role.progress && role.progress.length && chance(0.06)) {
      const [label, value] = pickR(role.progress);
      write(paintRole(`[*] ${label} ${bar(value, 20)}`));
    }

    if (chance(0.02)) {
      write(paintRole(`[!] WAARSCHUWING: ${pickR(TITLE_POOL)}`));
    }

    if (chance(0.03)) {
      // Snel block hex om het gevoel van een datadump te geven.
      const rows = randInt(4, 8);
      for (let r = 0; r < rows; r += 1) {
        write(paintRole(Array.from({ length: 12 }, () =>
          Array.from({ length: 8 }, () => '0123456789abcdef'[Math.floor(rng() * 16)]).join('')
        ).join('  ')));
      }
      write('');
    }

    if (chance(0.12)) {
      titleIndex = (titleIndex + 1) % TITLE_POOL.length;
      process.title = TITLE_POOL[titleIndex];
    }

    await sleep(Math.floor(rng() * (maxDelay - minDelay) + minDelay));
  }
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    try {
      process.stdout.write(`${EOL}[*] terminal ${id} stopped (nothing was ever touched)${EOL}`);
    } catch { /* venster al dicht */ }
    process.exit(0);
  });
}

process.on('exit', () => {
  process.title = 'FAKEVIRUS :: closed';
});

main().catch((error) => {
  process.stdout.write(`[!] terminal error: ${error && error.stack ? error.stack : error}${EOL}`);
  process.exit(1);
});
