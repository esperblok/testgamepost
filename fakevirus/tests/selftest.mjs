// Zelftest voor de FAKEVIRUS-engine. Draait op elke machine (ook Linux), opent
// géén vensters en verandert géén bestand.
//
//   npm test           (binnen de fakevirus-folder)
//   node app.js --self-test

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import * as util from '../lib/util.js';
import { render, box, centerRender, FONT_NAMES } from '../lib/ascii.js';
import { ensureSounds, SOUND_NAMES, SAMPLE_RATE } from '../lib/sound.js';
import { ROLES, FEED, SCARY_EVENTS, ROLE_IDS } from '../lib/scenes.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

const results = [];

function check(name, fn) {
  try {
    const detail = fn();
    results.push({ name, ok: true, detail: detail || '' });
  } catch (error) {
    const stack = error && error.stack ? String(error.stack).split('\n').slice(1, 3).join(' | ') : '';
    results.push({
      name,
      ok: false,
      detail: `${error && error.message ? error.message : String(error)} ${stack}`.trim(),
    });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// ------------------------------------------------------------------ 1. util
check('util: random helpers', () => {
  assert(util.randInt(1, 5) >= 1, 'randInt buiten de grenzen');
  assert(util.pick([1, 2, 3]) !== undefined, 'pick geeft niks terug');
  assert(util.mmss(65) === '01:05', `mmss gaf "${util.mmss(65)}" i.p.v. "01:05"`);
  assert(util.mmss(0) === '00:00', `mmss(0) gaf "${util.mmss(0)}"`);
  assert(util.bar(50, 10).length === 10, 'bar heeft de verkeerde lengte');
  assert(util.bar(50, 10).startsWith('█'), 'bar is niet gevuld');
  assert(util.pad(7, 3) === '  7', 'getallen worden niet links uitgezet');
  assert(util.pad('ab', 4) === 'ab  ', 'tekst wordt niet rechts uitgezet');
  return 'ok';
});

check('util: substitute vervangt alle placeholders', () => {
  const out = util.substitute('{{city}} -> {{ip}}:{{port}} ({{n}})', {});
  assert(!out.includes('{{'), `restant placeholder in: ${out}`);
  const [cityPart, rest] = out.split(' -> ');
  assert(cityPart.trim().length > 0, 'stad is leeg');
  const [ipPart, rest2] = rest.split(':');
  assert(/^\d+\.\d+\.\d+\.\d+$/.test(ipPart), `geen IP: ${ipPart}`);
  assert(/^\d+$/.test(rest2.replace(/[()]/g, '').split(' ')[0]), `geen poort: ${rest2}`);
  assert(util.substitute('{{x}}-{{x}}', { x: 'ZZ' }) === 'ZZ-ZZ', 'eigen variabelen worden genegeerd');
  return out;
});

// ------------------------------------------------------------------ 2. ascii
check('ascii: alle letters voor de ASCII-art zijn bekend', () => {
  const used = new Set();
  for (const role of ROLES) {
    for (const ch of `${role.id}TREMIUN0123456789`.toUpperCase()) used.add(ch);
  }
  const missing = [...used].filter((ch) => !/[A-Z0-9 ]/.test(ch) || !FONT_NAMES.includes(ch));
  assert(missing.length === 0, `onbekende tekens: ${missing.join(', ')}`);
  return `${used.size} tekens`;
});

check('ascii: render breedte klopt', () => {
  const lines = render('FAKEVIRUS', { scale: 1 });
  assert(lines.length === 7, `7 regels verwacht, kreeg ${lines.length}`);
  const width = lines[0].length;
  assert(width === 54, `breedte ${width} (verwacht 54)`);
  assert(lines.every((line) => line.length === width), 'regels hebben niet allemaal dezelfde breedte');

  const wide = render('TREMIUN', { scale: 2 });
  assert(wide[0].length === 7 * 7, `breedte scale 2 klopt niet: ${wide[0].length}`);
  assert(wide.length === 7 * 2, `scale 2 moet 14 regels geven, kreeg ${wide.length}`);
  assert(centerRender('TREMIUN', 78, 1).every((line) => line.length <= 78), 'centerRender is breder dan 78');
  return `${width} kolommen`;
});

check('ascii: box past aan op gegeven breedte', () => {
  const width = 40;
  const lines = box('TITEL', ['een regel die ergens over gaat'], width);
  assert(lines.length === 3, `box moet 3 regels hebben voor één regel tekst, kreeg ${lines.length}`);
  for (const line of lines) assert(line.length === width, `regelbreedte ${line.length} != ${width}`);

  const leeg = box(null, [], 20);
  assert(leeg.length === 2, 'lege box moet 2 regels hebben');
  return `3 regels x ${width}`;
});

// ------------------------------------------------------------------ 3. scenes
check('scenes: rollen zijn compleet', () => {
  for (const role of ROLES) {
    assert(role.id && role.prompt && role.color, `rol ${role.id} ontbreekt een veld`);
    assert(Array.isArray(role.intro) && role.intro.length > 0, `rol ${role.id} heeft geen intro`);
    assert(Array.isArray(role.lines) && role.lines.length >= 10, `rol ${role.id} heeft te weinig lines`);
    assert(role.sounds && typeof role.sounds === 'object', `rol ${role.id} heeft geen sounds`);
    for (const [name, weight] of Object.entries(role.sounds)) {
      assert(SOUND_NAMES.includes(name), `onbekend geluid "${name}" in rol ${role.id}`);
      assert(typeof weight === 'number' && weight > 0, `geluid ${name} heeft geen gewicht`);
    }
  }
  return `${ROLES.length} rollen: ${ROLE_IDS.join(', ')}`;
});

check('scenes: elk gebruikt placeholder bestaat', () => {
  const known = new Set([
    'ip', 'ipv6', 'mac', 'hash', 'uuid', 'pc', 'mb', 'gb', 'port', 'svc', 'os',
    'city', 'country', 'n', 'bign', 'version', 'money', 'btc', 'stamp', 'date', 'files',
  ]);
  const templates = [];
  for (const role of ROLES) templates.push(...role.intro, ...role.lines);
  templates.push(...FEED.map((f) => f.text), ...SCARY_EVENTS);

  const used = new Set();
  for (const tpl of templates) {
    for (const m of String(tpl).matchAll(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi)) used.add(m[1]);
  }
  const missing = [...used].filter((key) => !known.has(key));
  assert(missing.length === 0, `onbekende placeholders: ${missing.join(', ')}`);

  // Iedere lijn moet kunnen worden ingevuld zonder resterende placeholders.
  for (const role of ROLES) {
    for (const tpl of [...role.intro, ...role.lines]) {
      const filled = util.substitute(tpl, {});
      assert(!filled.includes('{{'), `restant placeholder in rol ${role.id}: ${tpl}`);
    }
  }
  return `${used.size} placeholders`;
});

check('scenes: feed-niveaus zijn veilig', () => {
  for (const item of FEED) {
    assert(['ok', 'warn', 'bad'].includes(item.level), `foute level: ${item.level}`);
  }
  for (const item of SCARY_EVENTS) {
    assert(typeof item === 'string' && item.length > 4, 'scary event is leeg');
  }
  return `${FEED.length} feed-items, ${SCARY_EVENTS.length} events`;
});

// ------------------------------------------------------------------ 4. geluid
check('geluid: alle wav-bestanden zijn geldig 16-bit PCM', () => {
  const dir = path.join(os.tmpdir(), 'fakevirus_sounds');
  const files = ensureSounds(dir);
  assert(Object.keys(files).length === SOUND_NAMES.length, 'niet alle geluiden zijn aangemaakt');

  for (const name of SOUND_NAMES) {
    const buf = fs.readFileSync(files[name]);
    assert(buf.length > 44, `${name} is te kort`);
    assert(buf.toString('ascii', 0, 4) === 'RIFF', `${name} is geen RIFF`);
    assert(buf.toString('ascii', 8, 12) === 'WAVE', `${name} is geen WAVE`);
    assert(buf.readUInt16LE(20) === 1, `${name} is niet PCM`);
    assert(buf.readUInt16LE(22) === 1, `${name} is niet mono`);
    assert(buf.readUInt32LE(24) === SAMPLE_RATE, `${name} heeft de verkeerde samplerate`);
    const dataLen = buf.readUInt32LE(40);
    assert(buf.length === 44 + dataLen, `${name} header/data-lengte klopt niet`);
    assert(dataLen > 0, `${name} bevat geen samples`);
  }
  return `${SOUND_NAMES.length} geluiden`;
});

check('geluid: samples zijn niet geheel stil', () => {
  const dir = path.join(os.tmpdir(), 'fakevirus_sounds');
  ensureSounds(dir);
  const stil = [];
  for (const name of SOUND_NAMES) {
    const buf = fs.readFileSync(path.join(dir, `${name}.wav`));
    const dataLen = buf.readUInt32LE(40);
    let peak = 0;
    for (let i = 0; i + 1 < dataLen; i += 2) {
      const v = Math.abs(buf.readInt16LE(44 + i));
      if (v > peak) peak = v;
    }
    if (peak < 500) stil.push(`${name}(${peak})`);
  }
  assert(stil.length === 0, `stil geluid: ${stil.join(', ')}`);
  return 'alle geluiden hebben amplitude';
});

// ------------------------------------------------------------------ 5. terminal
check('terminal: script produceert output en stopt', () => {
  const terminal = path.join(ROOT, 'terminal.js');
  const res = spawnSync(
    process.execPath,
    [terminal, '--role', 'scan', '--id', '1', '--lines', '6', '--sound', 'off', '--seed', '1'],
    { encoding: 'utf8', timeout: 30000 },
  );
  assert(res.status === 0, `exit code ${res.status}`);
  const out = (res.stdout || '').toLowerCase();
  assert(out.includes('target-scan'), 'rol-naam ontbreekt in de output');
  assert(out.includes('nmap'), 'intro ontbreekt in de output');
  assert((out.match(/\d+\.\d+\.\d+\.\d+/g) || []).length > 0, 'geen IP-adres in de output');
  assert(!(res.stdout || '').includes('\u0000'), 'output bevat null-bytes');
  return `${out.split('\n').length} regels`;
});

check('terminal: elke rol draait zonder fout', () => {
  const terminal = path.join(ROOT, 'terminal.js');
  const problemen = [];
  for (const role of ROLES) {
    const res = spawnSync(
      process.execPath,
      [terminal, '--role', role.id, '--id', '9', '--lines', '4', '--sound', 'off'],
      { encoding: 'utf8', timeout: 30000 },
    );
    const out = (res.stdout || '').toLowerCase();
    // De rol-id wordt als ASCII-logo getekend, dus kijk naar de titel die wel
    // letter voor letter in het venster staat.
    if (res.status !== 0 || !out.includes(role.title.toLowerCase())) {
      problemen.push(`${role.id}(status ${res.status})`);
    }
  }
  assert(problemen.length === 0, `problemen in: ${problemen.join(', ')}`);
  return `${ROLES.length} rollen ok`;
});

check('terminal: onbekende rol valt terug op een juiste rol', () => {
  const terminal = path.join(ROOT, 'terminal.js');
  const res = spawnSync(
    process.execPath,
    [terminal, '--role', 'does-not-exist', '--lines', '3', '--sound', 'off'],
    { encoding: 'utf8', timeout: 30000 },
  );
  assert(res.status === 0, `exit code ${res.status}`);
  assert((res.stdout || '').includes('TARGET-SCAN'), 'fallback-rol staat niet in de output');
  return 'fallback werkt';
});

check('terminal: --silent produceert geen intro', () => {
  const terminal = path.join(ROOT, 'terminal.js');
  const res = spawnSync(
    process.execPath,
    [terminal, '--role', 'scan', '--lines', '2', '--sound', 'off', '--silent', 'true'],
    { encoding: 'utf8', timeout: 30000 },
  );
  assert(res.status === 0, `exit code ${res.status}`);
  assert(!(res.stdout || '').includes('nmap'), 'stil mode moet de intro weglaten');
  return 'ok';
});

// ------------------------------------------------------------------ 6. shipped files
check('overlays: PowerShell-scripts bestaan', () => {
  const dir = path.join(ROOT, 'overlays');
  for (const file of ['ransom.ps1', 'bsod.ps1', 'flash.ps1', 'sound-daemon.ps1']) {
    const full = path.join(dir, file);
    assert(fs.existsSync(full), `${file} ontbreekt`);
    assert(fs.readFileSync(full, 'utf8').length > 200, `${file} is te kort`);
  }
  return '4 scripts';
});

check('overlays: ransom.ps1 leest het note-file', () => {
  const text = fs.readFileSync(path.join(ROOT, 'overlays', 'ransom.ps1'), 'utf8');
  assert(text.includes('NoteFile'), 'ransom.ps1 weet niet waar de tekst staat');
  assert(text.includes('PRANK'), 'ransom.ps1 vermeldt niet dat dit een prank is');
  return 'ransom.ps1 is compleet';
});

check('overlays: geluidsdaemon vindt de request-map', () => {
  const text = fs.readFileSync(path.join(ROOT, 'overlays', 'sound-daemon.ps1'), 'utf8');
  assert(text.includes('_req'), 'sound-daemon.ps1 zoekt niet in _req');
  assert(text.includes('SoundPlayer'), 'sound-daemon.ps1 gebruikt geen SoundPlayer');
  return 'sound-daemon.ps1 is compleet';
});

check('windows: launchers bestaan', () => {
  for (const file of ['FAKEVIRUS.bat', 'STOP_FAKEVIRUS.bat']) {
    assert(fs.existsSync(path.join(ROOT, file)), `${file} ontbreekt`);
  }
  const run = fs.readFileSync(path.join(ROOT, 'FAKEVIRUS.bat'), 'utf8');
  assert(run.includes('app.js'), 'FAKEVIRUS.bat roept app.js niet op');
  assert(run.toLowerCase().includes('node'), 'FAKEVIRUS.bat kijkt niet naar Node');
  const stop = fs.readFileSync(path.join(ROOT, 'STOP_FAKEVIRUS.bat'), 'utf8');
  assert(stop.toLowerCase().includes('fakevirus'), 'STOP_FAKEVIRUS.bat weet niet wat het moet stoppen');
  return '2 batch-bestanden';
});

check('app: entry-punt parseert en stopt netjes', () => {
  const res = spawnSync(
    process.execPath,
    [path.join(ROOT, 'app.js'), '--stop'],
    { encoding: 'utf8', timeout: 30000 },
  );
  assert(res.status === 0, `exit code ${res.status}`);
  return 'app.js --stop werkt';
});

// ------------------------------------------------------------------ uitvoer
export async function runSelfTest({ verbose = false } = {}) {
  const failed = results.filter((r) => !r.ok);
  for (const r of results) {
    const mark = r.ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
    process.stdout.write(`${mark}  ${r.name}${r.detail ? ` — ${r.detail}` : ''}\n`);
  }
  process.stdout.write(`\n${results.length - failed.length}/${results.length} checks goed\n`);
  return failed.length === 0;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const ok = await runSelfTest({ verbose: true });
  process.exit(ok ? 0 : 1);
}
