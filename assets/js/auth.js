/**
 * SpaceBlox — accounts & inloggen
 *
 * Belangrijkste verschil met de oude versie: er staat GEEN wachtwoord meer in
 * de broncode. Wachtwoorden worden gezouten en gehashet met SHA-256 voordat ze
 * ooit localStorage raken, en de admin-hash staat in een apart config-bestand.
 *
 * Eerlijkheidshalve: dit is een statische site zonder server, dus de hash is
 * door wie de broncode leest te brute-forcen. Het doel hier is (a) geen
 * plaintext wachtwoorden op schijf, (b) geen wachtwoord dat herbruikbaar is,
 * en (c) kinderen geen vals gevoel van veiligheid geven. Voor echte accounts
 * hoort er een backend bij.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SBAuth = api;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  const MIN_PASS = 6;
  const MAX_NAME = 16;

  /* ───────────────────────── hashing ───────────────────────── */

  function toHex(bytes) {
    let out = '';
    for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0');
    return out;
  }

  function randomHex(len) {
    const n = len || 16;
    const buf = new Uint8Array(n);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(buf);
    else for (let i = 0; i < n; i++) buf[i] = Math.floor(Math.random() * 256);
    return toHex(buf);
  }

  /**
   * SHA-256 over salt + wachtwoord. Gebruikt Web Crypto waar dat kan; anders
   * een kleine pure-JS SHA-256 zodat het ook op http:// of in Node werkt.
   */
  async function hashPassword(password, salt) {
    const data = salt + '::' + password;
    if (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
      return toHex(new Uint8Array(buf));
    }
    return sha256(data);
  }

  /**
   * Vergelijkt twee hashes zonder vroegtijdig af te breken, zodat de
   * vergelijkingstijd niets lekt over de hash.
   */
  function safeEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }

  /* ───────────────────── pure-JS SHA-256 ───────────────────── */

  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  function sha256(ascii) {
    // UTF-8 coderen via TextEncoder: die doet surrogeerparen (emoji 🎮) goed,
    // een handgeschreven charCodeAt-loop niet.
    const bytes = Array.from(new TextEncoder().encode(ascii));
    const l = bytes.length;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    const bits = l * 8;
    for (let i = 7; i >= 0; i--) bytes.push((bits / Math.pow(2, i * 8)) & 0xff);

    let h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const w = new Array(64);

    for (let off = 0; off < bytes.length; off += 64) {
      for (let i = 0; i < 16; i++) {
        w[i] = (bytes[off + i * 4] << 24) | (bytes[off + i * 4 + 1] << 16) |
               (bytes[off + i * 4 + 2] << 8) | bytes[off + i * 4 + 3];
      }
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      let [a, b, c, d, e, f, g, hh] = h;
      for (let i = 0; i < 64; i++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const ch = (e & f) ^ (~e & g);
        const t1 = (hh + S1 + ch + K[i] + w[i]) | 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) | 0;
        hh = g; g = f; f = e; e = (d + t1) | 0;
        d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h = [h[0] + a | 0, h[1] + b | 0, h[2] + c | 0, h[3] + d | 0,
           h[4] + e | 0, h[5] + f | 0, h[6] + g | 0, h[7] + hh | 0];
    }
    return h.map((x) => (x >>> 0).toString(16).padStart(8, '0')).join('');
  }

  function rotr(x, n) {
    return (x >>> n) | (x << (32 - n));
  }

  /* ───────────────────────── validatie ─────────────────────── */

  function cleanName(raw) {
    return String(raw || '').trim().replace(/[<>&"'`\\/]/g, '').slice(0, MAX_NAME);
  }

  function validatePassword(pw) {
    if (typeof pw !== 'string' || pw.length < MIN_PASS) return 'Minimaal ' + MIN_PASS + ' tekens.';
    if (pw.length > 200) return 'Te lang.';
    if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) return 'Gebruik letters én cijfers.';
    return null;
  }

  /* ───────────────────────── account API ───────────────────── */

  /**
   * Admin-config wordt apart ingelezen (assets/js/admin.config.js) zodat een
   * nieuw wachtwoord niet in deze module hoeft te staan.
   */
  function adminConfig(root) {
    const cfg = (root || (typeof self !== 'undefined' ? self : globalThis)).SB_ADMIN || {};
    return { user: cfg.user || 'admin', hash: cfg.hash || '', salt: cfg.salt || '' };
  }

  async function register(store, rawName, password, password2) {
    const name = cleanName(rawName);
    if (!name) return { ok: false, error: 'Vul een gebruikersnaam in.' };
    const pwErr = validatePassword(password);
    if (pwErr) return { ok: false, error: pwErr };
    if (password !== password2) return { ok: false, error: 'Wachtwoorden komen niet overeen.' };

    const users = readUsers(store);
    if (users[name.toLowerCase()]) return { ok: false, error: 'Die naam is al in gebruik.' };
    if (SB().isBanned(store, name)) return { ok: false, error: 'Deze naam is geband.' };
    const admin = adminConfig();
    if (name.toLowerCase() === admin.user.toLowerCase()) {
      return { ok: false, error: 'Die naam is gereserveerd.' };
    }

    const salt = randomHex(16);
    users[name.toLowerCase()] = {
      name: name,
      salt: salt,
      hash: await hashPassword(password, salt),
      admin: false,
      created: Date.now(),
    };
    writeUsers(store, users);
    return { ok: true, name: name };
  }

  async function login(store, rawName, password) {
    const name = cleanName(rawName);
    if (SB().isBanned(store, name)) return { ok: false, error: 'Deze gebruiker is geband.' };
    const admin = adminConfig();

    if (name.toLowerCase() === admin.user.toLowerCase()) {
      if (!admin.hash) return { ok: false, error: 'Admin is nog niet ingesteld.' };
      const attempt = await hashPassword(password, admin.salt);
      if (!safeEqual(attempt, admin.hash)) return { ok: false, error: 'Onjuiste gegevens.' };
      return { ok: true, name: admin.user, admin: true };
    }

    const users = readUsers(store);
    const rec = users[name.toLowerCase()];
    if (!rec) return { ok: false, error: 'Onjuiste gegevens.' };
    const attempt = await hashPassword(password, rec.salt);
    if (!safeEqual(attempt, rec.hash)) return { ok: false, error: 'Onjuiste gegevens.' };
    return { ok: true, name: rec.name, admin: !!rec.admin };
  }

  /**
   * Wachtwoord wijzigen. Vereist het oude wachtwoord, behalve voor de admin —
   * die heeft geen record in localStorage en wijzigt via config.js.
   */
  async function changePassword(store, rawName, oldPw, newPw, newPw2) {
    const name = cleanName(rawName);
    const users = readUsers(store);
    const rec = users[name.toLowerCase()];
    if (!rec) {
      return {
        ok: false,
        error: 'Admin-wachtwoord wijzig je in assets/js/admin.config.js — zie README.',
        admin: true,
      };
    }
    const check = await hashPassword(oldPw, rec.salt);
    if (!safeEqual(check, rec.hash)) return { ok: false, error: 'Oude wachtwoord klopt niet.' };
    const pwErr = validatePassword(newPw);
    if (pwErr) return { ok: false, error: pwErr };
    if (newPw !== newPw2) return { ok: false, error: 'Nieuwe wachtwoorden komen niet overeen.' };
    const salt = randomHex(16);
    rec.salt = salt;
    rec.hash = await hashPassword(newPw, salt);
    users[name.toLowerCase()] = rec;
    writeUsers(store, users);
    return { ok: true };
  }

  function logout(store) {
    setSession(store, null);
  }

  function currentUser(store) {
    const s = getSession(store);
    if (!s || !s.name) return null;
    const admin = adminConfig();
    return { name: s.name, admin: s.name.toLowerCase() === admin.user.toLowerCase() };
  }

  /* ───────────────────── store-doorgeefluik ────────────────── */
  // SB mag nog niet geladen zijn als deze module parseert, dus lazy ophalen.

  function SB(root) {
    return (root || (typeof self !== 'undefined' ? self : globalThis)).SB;
  }

  function readUsers(store) { return SB().readUsers(store); }
  function writeUsers(store, u) { return SB().writeUsers(store, u); }
  function getSession(store) { return SB().getSession(store); }
  function setSession(store, u) { return SB().setSession(store, u); }

  return {
    MIN_PASS: MIN_PASS,
    hashPassword: hashPassword,
    safeEqual: safeEqual,
    randomHex: randomHex,
    sha256: sha256,
    cleanName: cleanName,
    validatePassword: validatePassword,
    adminConfig: adminConfig,
    register: register,
    login: login,
    changePassword: changePassword,
    logout: logout,
    currentUser: currentUser,
  };
});
