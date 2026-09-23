#!/usr/bin/env node
/**
 * Maakt een zout + hash voor assets/js/admin.config.js.
 *
 *   npm run hash -- "JouwNieuweWachtwoord"
 *
 * Gebruikt exact dezelfde code als de browser (assets/js/auth.js), dus wat
 * hier uitkomt werkt ook op de site.
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// auth.js verwacht een globale SB voor zijn opslagfuncties; hier heeft hij
// die niet nodig, dus een lege shim volstaat.
globalThis.SB = require(join(root, 'assets/js/store.js'));
const SBAuth = require(join(root, 'assets/js/auth.js'));

const password = process.argv[2];

if (!password) {
  console.error('Gebruik:  npm run hash -- "JouwNieuweWachtwoord"');
  process.exit(1);
}

const problem = SBAuth.validatePassword(password);
if (problem) {
  console.error('❌ Dat wachtwoord mag niet: ' + problem);
  process.exit(1);
}

const salt = SBAuth.randomHex(16);
const hash = await SBAuth.hashPassword(password, salt);

// Controle: komt onze eigen SHA-256 overeen met die van Node?
const { createHash } = await import('node:crypto');
const reference = createHash('sha256').update(salt + '::' + password).digest('hex');
if (reference !== hash) {
  console.error('❌ Interne check mislukt: hash komt niet overeen met node:crypto.');
  process.exit(1);
}

const configPath = join(root, 'assets/js/admin.config.js');
const before = readFileSync(configPath, 'utf8');
const after = before
  .replace(/salt: '[0-9a-f]*'/, "salt: '" + salt + "'")
  .replace(/hash: '[0-9a-f]*'/, "hash: '" + hash + "'");

if (before === after) {
  console.error('❌ Kon ' + configPath + ' niet bijwerken — vind geen salt/hash-regel.');
  process.exit(1);
}

writeFileSync(configPath, after);
console.log('✅ admin.config.js bijgewerkt.');
console.log('   salt: ' + salt);
console.log('   hash: ' + hash);
console.log('');
console.log('Commit dat bestand. Het wachtwoord zelf staat nergens op schijf.');
