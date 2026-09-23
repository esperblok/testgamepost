/**
 * Minimale test-helpers, zodat de tests zonder npm-install draaien.
 * Alles wordt gewoon met node uitgevoerd: `npm test`.
 */

let passed = 0;
let failed = 0;
const failures = [];
let currentSuite = '';

export function suite(name) {
  currentSuite = name;
  console.log('\n\x1b[1m' + name + '\x1b[0m');
}

export function test(name, fn) {
  try {
    const out = fn();
    if (out && typeof out.then === 'function') {
      return out.then(
        () => { passed++; console.log('  \x1b[32m✓\x1b[0m ' + name); },
        (err) => { fail(name, err); }
      );
    }
    passed++;
    console.log('  \x1b[32m✓\x1b[0m ' + name);
  } catch (err) {
    fail(name, err);
  }
}

function fail(name, err) {
  failed++;
  const msg = currentSuite + ' › ' + name + ': ' + (err && err.message ? err.message : err);
  failures.push(msg);
  console.log('  \x1b[31m✗\x1b[0m ' + name);
  console.log('      ' + (err && err.stack ? err.stack.split('\n')[0] : err));
}

export function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'verwachtte true, kreeg false');
}

export function eq(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error((msg ? msg + ' — ' : '') + 'verwachtte ' + JSON.stringify(expected) +
      ', kreeg ' + JSON.stringify(actual));
  }
}

export function ok(value, msg) {
  if (!value) throw new Error(msg || 'verwachtte een truthy waarde, kreeg ' + JSON.stringify(value));
}

/** localStorage-namaak die zich precies zo gedraagt als de echte. */
export function fakeStorage(seed) {
  const map = new Map(Object.entries(seed || {}));
  return {
    getItem: (k) => (map.has(String(k)) ? map.get(String(k)) : null),
    setItem: (k, v) => { map.set(String(k), String(v)); },
    removeItem: (k) => { map.delete(String(k)); },
    key: (i) => Array.from(map.keys())[i] ?? null,
    clear: () => map.clear(),
    get length() { return map.size; },
    _dump: () => Object.fromEntries(map),
  };
}

export function report() {
  console.log('');
  if (failed) {
    console.log('\x1b[31m\x1b[1m' + failed + ' gefaald\x1b[0m, ' + passed + ' geslaagd');
    failures.forEach((f) => console.log('  • ' + f));
    process.exit(1);
  }
  console.log('\x1b[32m\x1b[1mAlles geslaagd:\x1b[0m ' + passed + ' tests');
}
