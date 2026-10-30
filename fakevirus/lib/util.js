// Kleine helpers die overal in de FAKEVIRUS-engine gebruikt worden.
// Alles in dit bestand is onschuldig: random Zahlen, random IP's, random hashes.

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export const rand = (min, max) => min + Math.random() * (max - min);
export const randInt = (min, max) => Math.floor(min + Math.random() * (max - min + 1));
export const pick = (list) => list[(Math.random() * list.length) | 0];
export const chance = (p) => Math.random() < p;
export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

// ---------------------------------------------------------------- ANSIkleuren
export const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  underline: '\x1b[4m',
  blink: '\x1b[5m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',
};

export const paint = (text, color) => (color ? color + text + C.reset : text);

// ---------------------------------------------------------------- fake data
const HEX = '0123456789abcdef';

export const hex = (len) => {
  let out = '';
  for (let i = 0; i < len; i += 1) out += HEX[(Math.random() * 16) | 0];
  return out;
};

/** Zorgt dat de hash altijd geloofwaardig Nederlands-engels ziet. */
export const hash = () => `${hex(8)}${hex(8)}${hex(8)}${hex(8)}`;

export const ip = () =>
  `${randInt(1, 255)}.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`;

export const ipv6 = () =>
  Array.from({ length: 8 }, () => hex(4)).join(':');

export const mac = () => Array.from({ length: 6 }, () => hex(2)).join(':');

export const uuid = () =>
  `${hex(8)}-${hex(4)}-${hex(4)}-${hex(4)}-${hex(12)}`;

export const pct = () => `${randInt(62, 100)}%`;
export const mb = () => `${randInt(2, 480)} MB`;
export const gb = () => `${randInt(1, 40)} GB`;
export const port = () => randInt(1, 65535);

const CITIES = [
  ['Amsterdam', 'NL'], ['Rotterdam', 'NL'], ['Deventer', 'NL'], ['Utrecht', 'NL'],
  ['Berlin', 'DE'], ['Parijs', 'FR'], ['Londen', 'GB'], ['Madrid', 'ES'],
  ['Stockholm', 'SE'], ['Warschau', 'PL'], ['Moskou', 'RU'], ['Tokio', 'JP'],
  ['Seoul', 'KR'], ['Shanghai', 'CN'], ['Seattle', 'US'], ['Toronto', 'CA'],
  ['São Paulo', 'BR'], ['Istanbul', 'TR'], ['Kiev', 'UA'], ['Bangkok', 'TH'],
];

export const city = () => pick(CITIES);

export const service = () =>
  pick([
    'http', 'https', 'ssh', 'rdp', 'ftp', 'smtp', 'mysql', 'postgresql',
    'redis', 'mongodb', 'docker', 'kubernetes', 'elasticsearch', 'ms-wbt-server',
    'microsoft-iis', 'nginx', 'apache', 'openssh', 'vnc', 'telnet', 'sip', 'dns',
  ]);

export const osGuess = () =>
  pick([
    'Windows 10 Pro 22H2', 'Windows 11 Home 23H2', 'Windows Server 2019',
    'Ubuntu 22.04.3 LTS', 'Debian 12', 'macOS 14.4', 'Raspberry Pi OS',
    'Fedora 40', 'openSUSE 15.5',
  ]);

// ---------------------------------------------------------------- tekstvormgeving
export const pad = (text, width) => {
  const isNumber = typeof text === 'number';
  const s = String(text);
  if (s.length >= width) return s.slice(0, width);
  const fill = ' '.repeat(width - s.length);
  // Getallen links uitlijnen (01:05), tekst rechts (kolomvulling).
  return isNumber ? fill + s : s + fill;
};

/** Schalt ANSI-escapecodes weg, zodat breedtes kloppen. */
export const visible = (text) => String(text).replace(/\x1b\[[0-9;]*m/g, '');

/** Breedte van een tekst in het scherm, zonder kleurcodes. */
export const visibleLength = (text) => visible(text).length;

export const clip = (text, width) =>
  String(text).length > width ? `${String(text).slice(0, width - 1)}…` : String(text);

export const center = (text, width) =>
  pad(text, Math.max(width, text.length)).padStart(Math.max(width, text.length));

/** Vervangt {{naam}} in een string door een random waarde. */
export function substitute(template, vars = {}) {
  return String(template).replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(vars, key)) return String(vars[key]);
    const fn = FAKE_VARS[key];
    return fn ? fn() : match;
  });
}

const FAKE_VARS = {
  ip: () => ip(),
  ipv6: () => ipv6(),
  mac: () => mac(),
  hash: () => hash(),
  uuid: () => uuid(),
  pc: () => `${randInt(62, 100)}%`,
  mb: () => mb(),
  gb: () => gb(),
  port: () => port(),
  svc: () => service(),
  os: () => osGuess(),
  city: () => city()[0],
  country: () => city()[1],
  n: () => randInt(1, 999999),
  bign: () => randInt(100000, 99999999),
  version: () => `${randInt(1, 26)}.${randInt(0, 20)}.${randInt(0, 9)}`,
  money: () => `$${randInt(100, 99999)}`,
  btc: () => `${rand(0.01, 8.9).toFixed(4)} BTC`,
  stamp: () => stamp(),
  date: () => new Date().toISOString().slice(0, 10),
  files: () => `${randInt(100, 999)},${randInt(100, 999)}`,
};

// ---------------------------------------------------------------- klok & tijd
export const clock = () => {
  const d = new Date();
  return `${pad(d.getHours(), 2)}:${pad(d.getMinutes(), 2)}:${pad(d.getSeconds(), 2)}`;
};

export const stamp = () => {
  const d = new Date();
  const p = (n) => pad(n, 2);
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

export const mmss = (seconds) => {
  const s = Math.max(0, Math.floor(seconds));
  const pad2 = (n) => String(n).padStart(2, '0');
  return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;
};

/** Voorzienningsbalk uit blokken, zoals in een echte terminal. */
export const bar = (value, width = 24, filled = '█', empty = '░') => {
  const v = clamp(value, 0, 100);
  const n = Math.round((v / 100) * width);
  return filled.repeat(n) + empty.repeat(Math.max(0, width - n));
};

/** Opschonen van het scherm met een rand. */
export const rule = (width = 78, ch = '─') => ch.repeat(width);
