// Geluid synthetiseren vanaf scratch: pure JS, geen bestanden, geen afhankelijkheden.
// We generaeren .wav-bestanden in %TEMP%\fakevirus_sounds en laten die afspelen via
// een PowerShell-daemon die met de SoundPlayer van Windows werkt.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const SAMPLE_RATE = 22050;
const TAU = Math.PI * 2;

/** Time-serie van `dur` seconden. */
function gen(dur, fn) {
  const n = Math.max(1, Math.floor(dur * SAMPLE_RATE));
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) out[i] = fn(i / SAMPLE_RATE, i, n);
  return out;
}

function wave(phase, kind) {
  switch (kind) {
    case 'sine':
      return Math.sin(phase);
    case 'square':
      return Math.sin(phase) >= 0 ? 1 : -1;
    case 'saw':
      return 2 * ((phase / TAU) % 1) - 1;
    case 'tri':
      return (2 / Math.PI) * Math.asin(Math.sin(phase));
    default:
      return Math.sin(phase);
  }
}

function tone(freq, dur, { kind = 'square', vol = 0.3, attack = 0.004, release = 0.012, delay = 0 } = {}) {
  return gen(dur + delay, (t) => {
    if (t < delay) return 0;
    const local = t - delay;
    const env = Math.min(1, local / attack) * Math.max(0, 1 - Math.max(0, local - (dur - release)) / release);
    return vol * env * wave(TAU * freq * local, kind);
  });
}

function sweep(f1, f2, dur, { kind = 'square', vol = 0.3, delay = 0, attack = 0.005 } = {}) {
  return gen(dur + delay, (t) => {
    if (t < delay) return 0;
    const local = t - delay;
    const env = Math.min(1, local / attack) * Math.max(0, 1 - Math.max(0, local - dur) / 0.01);
    const phase = TAU * f1 * local + (TAU * (f2 - f1) * local * local) / (2 * dur);
    return vol * env * wave(phase, kind);
  });
}

function noise(dur, { vol = 0.2, lp = 0, delay = 0 } = {}) {
  let last = 0;
  return gen(dur + delay, (t) => {
    if (t < delay) return 0;
    const local = t - delay;
    if (lp > 0) {
      last = last + lp * ((Math.random() * 2 - 1) - last);
    } else {
      last = Math.random() * 2 - 1;
    }
    const env = Math.exp(-local * 3.5);
    return vol * env * last;
  });
}

/** Vermengt meerdere samples. Elk deel is een Float32Array, of [Float32Array, scale]. */
function mix(...parts) {
  const parts_ = parts.map((p) => (Array.isArray(p) ? [p[0], p[1] ?? 1] : [p, 1]));
  const length = parts_.reduce((max, p) => Math.max(max, p[0].length), 0);
  const out = new Float32Array(length);
  for (const [samples, scale] of parts_) {
    for (let k = 0; k < samples.length; k += 1) out[k] += samples[k] * scale;
  }
  return out;
}

/** Normaliseert zodat geen sample clipt. */
function normalize(samples, target = 0.85) {
  let peak = 0;
  for (let i = 0; i < samples.length; i += 1) peak = Math.max(peak, Math.abs(samples[i]));
  if (peak === 0) return samples;
  const gain = target / peak;
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) out[i] = samples[i] * gain;
  return out;
}

export function writeWav(file, samples, sampleRate = SAMPLE_RATE) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i += 1) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE((v * 32767) | 0, 44 + i * 2);
  }
  fs.writeFileSync(file, buf);
  return file;
}

// ------------------------------------------------------------------ de geluiden

const SOUND_BUILDERS = {
  // Kleine 'tick' tussen commands
  tick: () => tone(1800, 0.02, { kind: 'sine', vol: 0.12, attack: 0.001, release: 0.01 }),

  // Classiek loggebzijn
  beep: () => tone(880, 0.07, { vol: 0.22, attack: 0.002, release: 0.02 }),
  beepHigh: () => tone(1568, 0.1, { vol: 0.22, attack: 0.002, release: 0.03 }),
  beepLow: () => tone(320, 0.14, { kind: 'sine', vol: 0.3 }),

  // Foutuur / fout
  error: () => normalize(mix(tone(150, 0.3, { vol: 0.35 }), [noise(0.28, { vol: 0.18 }), 0.6])),
  buzz: () => tone(92, 0.55, { kind: 'saw', vol: 0.3 }),
  denied: () => normalize(mix(
    tone(330, 0.13, { vol: 0.3 }),
    tone(262, 0.13, { vol: 0.3, delay: 0.15 }),
    tone(196, 0.2, { vol: 0.3, delay: 0.3 }),
  )),

  // Laser / zweven
  laser: () => sweep(1500, 180, 0.35, { vol: 0.22, kind: 'square' }),
  laserUp: () => sweep(240, 1500, 0.24, { vol: 0.2, kind: 'saw' }),
  zap: () => normalize(mix(sweep(1800, 400, 0.12, { vol: 0.3, kind: 'square' }), [noise(0.12, { vol: 0.25 }), 0.8])),

  // Sirene
  alarm: () => {
    const a = tone(520, 0.42, { vol: 0.28, kind: 'square' });
    const b = tone(760, 0.42, { vol: 0.28, kind: 'square', delay: 0.44 });
    const c = tone(520, 0.42, { vol: 0.28, kind: 'square', delay: 0.88 });
    const d = tone(760, 0.42, { vol: 0.28, kind: 'square', delay: 1.32 });
    return normalize(mix(a, b, c, d));
  },

  // Geluid van een bitcoin/cash
  coin: () => normalize(mix(
    tone(988, 0.06, { kind: 'sine', vol: 0.3 }),
    tone(1319, 0.16, { kind: 'sine', vol: 0.3, delay: 0.07 }),
  )),
  cash: () => normalize(mix(
    tone(1200, 0.05, { kind: 'sine', vol: 0.25 }),
    tone(1600, 0.05, { kind: 'sine', vol: 0.25, delay: 0.06 }),
    tone(2100, 0.05, { kind: 'sine', vol: 0.25, delay: 0.12 }),
    tone(2600, 0.2, { kind: 'sine', vol: 0.3, delay: 0.18 }),
  )),

  // Opstarten / afsluiten
  powerUp: () => sweep(180, 1300, 0.45, { kind: 'saw', vol: 0.24 }),
  powerDown: () => sweep(900, 60, 0.55, { kind: 'saw', vol: 0.24 }),
  boot: () => normalize(mix(
    tone(120, 0.28, { kind: 'sine', vol: 0.25 }),
    [noise(0.3, { vol: 0.12, lp: 0.5 }), 0.7],
    tone(220, 0.4, { kind: 'sine', vol: 0.18, delay: 0.2 }),
  )),

  // Rmut
  static: () => noise(0.22, { vol: 0.16, lp: 0.35 }),
  explosion: () => normalize(mix(
    [noise(0.7, { vol: 0.35, lp: 0.6 }), 1],
    tone(70, 0.65, { kind: 'sine', vol: 0.35 }),
  )),
  knock: () => normalize(mix(
    [noise(0.06, { vol: 0.5, lp: 0.8 }), 1],
    tone(90, 0.08, { kind: 'sine', vol: 0.4 }),
  )),

  // Hartslag — schrikt op omdat het ritme sneller wordt
  heartbeat: () => normalize(mix(
    tone(70, 0.12, { kind: 'sine', vol: 0.45, attack: 0.005 }),
    tone(70, 0.1, { kind: 'sine', vol: 0.35, delay: 0.22 }),
  )),
  heartbeatFast: () => normalize(mix(
    tone(80, 0.1, { kind: 'sine', vol: 0.45, attack: 0.005 }),
    tone(80, 0.09, { kind: 'sine', vol: 0.35, delay: 0.14 }),
  )),

  // Toetsen
  key: () => tone(2200, 0.015, { kind: 'square', vol: 0.06, attack: 0.0005, release: 0.006 }),
  type: () => normalize(mix(
    tone(1400 + Math.random() * 900, 0.012, { kind: 'square', vol: 0.07, attack: 0.0005, release: 0.005 }),
    [noise(0.01, { vol: 0.05 }), 0.5],
  )),

  // Computer die inbreekt
  hack: () => normalize(mix(
    [noise(0.35, { vol: 0.3, lp: 0.5 }), 0.9],
    tone(110, 0.35, { kind: 'saw', vol: 0.28 }),
    tone(55, 0.4, { kind: 'sine', vol: 0.3 }),
  )),
  granted: () => sweep(500, 1600, 0.3, { kind: 'sine', vol: 0.26 }),
  scan: () => sweep(400, 2200, 0.5, { kind: 'sine', vol: 0.14 }),
  encrypt: () => normalize(mix(
    tone(2000, 0.03, { kind: 'square', vol: 0.1 }),
    tone(1400, 0.03, { kind: 'square', vol: 0.1, delay: 0.04 }),
    tone(900, 0.05, { kind: 'square', vol: 0.1, delay: 0.08 }),
    [noise(0.2, { vol: 0.05, lp: 0.2 }), 0.4],
  )),
  door: () => normalize(mix(
    sweep(300, 900, 0.18, { kind: 'sine', vol: 0.22 }),
    sweep(900, 300, 0.22, { kind: 'sine', vol: 0.16, delay: 0.18 }),
  )),
  alert: () => normalize(mix(
    tone(1046, 0.1, { kind: 'square', vol: 0.3 }),
    tone(1046, 0.1, { kind: 'square', vol: 0.3, delay: 0.12 }),
    tone(784, 0.2, { kind: 'square', vol: 0.3, delay: 0.24 }),
  )),
};

export const SOUND_NAMES = Object.keys(SOUND_BUILDERS);

/** Alle benodigde .wav-bestanden aanmaken. Returns naam -> pad. */
export function ensureSounds(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const files = {};
  for (const [name, build] of Object.entries(SOUND_BUILDERS)) {
    const file = path.join(dir, `${name}.wav`);
    if (!fs.existsSync(file)) {
      writeWav(file, normalize(build()));
    }
    files[name] = file;
  }
  return files;
}

/** Standaardlocatie: %TEMP%\fakevirus_sounds */
export function soundDir() {
  const base = os.tmpdir();
  return path.join(base, 'fakevirus_sounds');
}

/** Request plaatsen voor de PowerShell-daemon. */
export function requestSound(name) {
  if (!SOUND_NAMES.includes(name)) return false;
  const dir = requestDir();
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${Date.now()}-${Math.floor(Math.random() * 1e6)}.txt`);
  fs.writeFileSync(file, `${name}\n`);
  return true;
}

/** Map waarin de daemon verzoeken vindt. */
export function requestDir() {
  return path.join(soundDir(), '_req');
}

/** Direct afspelen (niet-Windows, of als de daemon uit zit). */
export function playDirect(file, { timeout = 2500 } = {}) {
  if (!file) return false;
  const players = ['aplay', 'paplay', 'ffplay', 'afplay'];
  for (const bin of players) {
    const args = bin === 'ffplay'
      ? ['-nodisp', '-autoexit', '-loglevel', 'quiet', file]
      : ['-q', file];
    const res = spawnSync(bin, args, { timeout, stdio: 'ignore' });
    if (res.status === 0) return true;
  }
  return false;
}

/** Extra "geluidsmuur": een constante stroom van lijkt-op-virus geluiden. */
export const NOISE_POOL = [
  'tick', 'beep', 'beepHigh', 'static', 'type', 'key', 'beepLow', 'zap',
  'scan', 'error', 'tick', 'beep', 'type', 'key', 'scan',
];

export function randomNoise() {
  return SOUND_NAMES[(Math.random() * SOUND_NAMES.length) | 0];
}
