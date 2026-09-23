/**
 * SpaceBlox — opslaglaag
 *
 * Alles staat lokaal in localStorage (geen server nodig). Elke functie hier is
 * "puur": hij krijgt een storage-object mee in plaats van rechtstreeks
 * localStorage aan te raken. Daardoor kan deze module ook in Node gedraaid en
 * getest worden (zie tests/run.mjs).
 *
 * In de browser hangt alles onder window.SB.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SB = api;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  const KEY = {
    users: 'sbx.users',
    session: 'sbx.session',
    coins: 'sbx.coins',
    profile: 'sbx.profile',
    scores: 'sbx.scores',
    stats: 'sbx.stats',
    friends: 'sbx.friends',
    inventory: 'sbx.inventory',
    rewards: 'sbx.rewards',
    settings: 'sbx.settings',
  };

  /* ───────────────────────── helpers ───────────────────────── */

  function read(store, key, fallback) {
    try {
      const raw = store.getItem(key);
      if (raw === null || raw === undefined) return fallback;
      return JSON.parse(raw);
    } catch (err) {
      return fallback;
    }
  }

  function write(store, key, value) {
    try {
      store.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      return false; // quota vol / privémodus — nooit crashen
    }
  }

  /** HTML-escapen: alles wat uit gebruikersinvoer komt gaat hier doorheen. */
  function esc(s) {
    return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /** Aantal ms sinds middernacht; gebruikt voor dagelijkse beloningen. */
  function dayStamp(now) {
    const d = new Date(now === undefined ? Date.now() : now);
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }

  /** Leest een score als {value, name, at}. Oude losse getallen worden ook geaccepteerd. */
  function normalizeScoreEntry(raw, name) {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'number') return { value: raw, name: name || 'Jij', at: Date.now() };
    if (typeof raw === 'string') {
      const n = parseInt(raw, 10);
      return Number.isFinite(n) ? { value: n, name: name || 'Jij', at: Date.now() } : null;
    }
    if (typeof raw === 'object' && typeof raw.value === 'number') {
      return { value: raw.value, name: raw.name || name || 'Jij', at: raw.at || Date.now() };
    }
    return null;
  }

  /* ───────────────────────── muntjes ───────────────────────── */

  /**
   * Verdien muntjes. Negatieve bedragen worden geweigerd zodat een bug nooit
   * stiekem iemands saldo kan wissen.
   */
  function addCoins(store, amount) {
    const n = Math.floor(Number(amount));
    if (!Number.isFinite(n) || n <= 0) return getCoins(store);
    const next = getCoins(store) + n;
    write(store, KEY.coins, next);
    return next;
  }

  /**
   * Geef muntjes uit. Lukt alleen bij voldoende saldo.
   * @returns {{ok:boolean, coins:number}}
   */
  function spendCoins(store, amount) {
    const n = Math.floor(Number(amount));
    if (!Number.isFinite(n) || n <= 0) return { ok: false, coins: getCoins(store) };
    const current = getCoins(store);
    if (current < n) return { ok: false, coins: current };
    write(store, KEY.coins, current - n);
    return { ok: true, coins: current - n };
  }

  function getCoins(store) {
    const v = read(store, KEY.coins, 0);
    return Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
  }

  /** Formateert 12345 als "12.3K" voor in de topbar. */
  function formatCoins(n) {
    const v = Math.floor(Number(n) || 0);
    if (v < 1000) return String(v);
    if (v < 1000000) return (v / 1000).toFixed(v < 10000 ? 1 : 0).replace('.', ',') + 'K';
    return (v / 1000000).toFixed(1).replace('.', ',') + 'M';
  }

  /* ─────────────────────── daily reward ────────────────────── */

  /**
   * Dagelijkse beloning. Eén keer per kalenderdag; elke dag oplopende reeks
   * (10, 20, 30, 40, 50, 60, 75) die daarna op 75 blijft hangen.
   * @returns {{claimed:boolean, streak:number, coins:number, total:number}}
   */
  function claimDaily(store, now) {
    const today = dayStamp(now);
    const state = read(store, KEY.rewards, { streak: 0, last: 0 });
    if (state.last === today) {
      return { claimed: false, streak: state.streak, coins: 0, total: getCoins(store) };
    }
    const yesterday = dayStamp((now === undefined ? Date.now() : now) - 86400000);
    const streak = state.last === yesterday ? Math.min(state.streak + 1, 7) : 1;
    const table = [10, 20, 30, 40, 50, 60, 75];
    const amount = table[Math.min(streak, 7) - 1];
    write(store, KEY.rewards, { streak: streak, last: today });
    const total = addCoins(store, amount);
    return { claimed: true, streak: streak, coins: amount, total: total };
  }

  /* ───────────────────────── scores ────────────────────────── */

  /**
   * Zet een score weg. Beter dan de vorige hoogste = true.
   * Houdt zowel de persoonlijke hoogste als een top-8 per game bij.
   */
  function submitScore(store, gameId, value, playerName) {
    const v = Math.floor(Number(value));
    if (!Number.isFinite(v)) return { improved: false, best: getBest(store, gameId).value };
    const name = (playerName || 'Jij').slice(0, 20);

    const best = normalizeScoreEntry(read(store, KEY.scores + '.' + gameId + '.best', null), name);
    const improved = !best || v > best.value;
    if (improved) {
      write(store, KEY.scores + '.' + gameId + '.best', { value: v, name: name, at: Date.now() });
    }

    const board = read(store, KEY.scores + '.' + gameId + '.board', []);
    const list = Array.isArray(board) ? board.map((e) => normalizeScoreEntry(e, name)).filter(Boolean) : [];
    list.push({ value: v, name: name, at: Date.now() });
    list.sort((a, b) => b.value - a.value || a.at - b.at);
    write(store, KEY.scores + '.' + gameId + '.board', list.slice(0, 8));

    return { improved: improved, best: Math.max(v, best ? best.value : 0) };
  }

  function getBest(store, gameId) {
    const e = normalizeScoreEntry(read(store, KEY.scores + '.' + gameId + '.best', null), 'Jij');
    return e || { value: 0, name: '—', at: 0 };
  }

  function getBoard(store, gameId) {
    const board = read(store, KEY.scores + '.' + gameId + '.board', []);
    if (!Array.isArray(board)) return [];
    return board.map((e) => normalizeScoreEntry(e, 'Jij')).filter(Boolean).slice(0, 8);
  }

  /**
   * Muntjes voor een score: 1 munt per 25 punten, met een plafond per beurt
   * zodat één game niet het hele saldo kan laten ontploffen.
   */
  function coinsForScore(value, opts) {
    const o = opts || {};
    const per = o.per || 25;
    const max = o.max === undefined ? 60 : o.max;
    const v = Math.floor(Number(value));
    if (!Number.isFinite(v) || v <= 0) return 0;
    return Math.min(Math.floor(v / per), max);
  }

  /* ───────────────────────── statistiek ────────────────────── */

  function bumpStat(store, name, by) {
    const stats = read(store, KEY.stats, {});
    const step = Math.floor(Number(by) || 1);
    const cur = Number.isFinite(stats[name]) ? stats[name] : 0;
    stats[name] = cur + step;
    write(store, KEY.stats, stats);
    return stats[name];
  }

  function getStats(store) {
    const s = read(store, KEY.stats, {});
    return s && typeof s === 'object' ? s : {};
  }

  /** XP = som van alle hoogste scores. Bepaalt het spelerslevel. */
  function getLevel(store) {
    const stats = getStats(store);
    const xp = Number(stats.xp) || 0;
    // Level n kost 100*n XP; level = grootste n met 50*n*(n+1) <= xp
    let level = 1;
    while (50 * level * (level + 1) <= xp) level++;
    const floorXp = 50 * (level - 1) * level;
    const needXp = 50 * level * (level + 1);
    return {
      level: level,
      xp: xp,
      into: xp - floorXp,
      need: needXp - floorXp,
      pct: Math.max(0, Math.min(100, Math.round(((xp - floorXp) / (needXp - floorXp)) * 100))),
    };
  }

  /* ───────────────────────── profiel ───────────────────────── */

  const DEFAULT_PROFILE = {
    name: 'Speler',
    emoji: '🧑',
    skin: 'groen',
    hat: 'geen',
    owned: { skin: ['groen'], hat: ['geen'] },
  };

  /**
   * owned echt kopiëren (niet alleen de referentie). Zonder deze clone lekte
   * een aankoop in DEFAULT_PROFILE, waardoor elk volgend profiel dat item al
   * "bezat" en niemand meer iets kon kopen.
   */
  function cloneOwned(owned) {
    const out = {};
    Object.keys(owned).forEach((k) => {
      out[k] = Array.isArray(owned[k]) ? owned[k].slice() : owned[k];
    });
    return out;
  }

  function getProfile(store) {
    const p = read(store, KEY.profile, null);
    if (!p || typeof p !== 'object') {
      return Object.assign({}, DEFAULT_PROFILE, { owned: cloneOwned(DEFAULT_PROFILE.owned) });
    }
    const owned = cloneOwned(Object.assign({ skin: ['groen'], hat: ['geen'] }, p.owned || {}));
    return Object.assign({}, DEFAULT_PROFILE, p, { owned: owned });
  }

  function saveProfile(store, patch) {
    const next = Object.assign(getProfile(store), patch || {});
    write(store, KEY.profile, next);
    return next;
  }

  /* ─────────────────────── winkel / bezit ──────────────────── */

  /**
   * De hele winkelcatalogus. Een item is altijd van één type ('skin' of 'hat')
   * en kost muntjes. Gratis items (price 0) zitten er ook in, zodat een nieuw
   * profiel meteen iets heeft om aan te trekken.
   */
  const SHOP = [
    // lichaamskleuren
    { id: 'groen',     type: 'skin', name: 'Grasgroen',   price: 0,    color: '#3ecf6a' },
    { id: 'blauw',     type: 'skin', name: 'Oceaanblauw', price: 60,   color: '#2f9bff' },
    { id: 'rood',      type: 'skin', name: 'Lavarood',    price: 60,   color: '#ff5a4d' },
    { id: 'geel',      type: 'skin', name: 'Citroen',     price: 90,   color: '#ffd83d' },
    { id: 'paars',     type: 'skin', name: 'Druivenpaars', price: 140,  color: '#8b5cff' },
    { id: 'roze',      type: 'skin', name: 'Kauwgum',     price: 140,  color: '#ff6fb5' },
    { id: 'goud',      type: 'skin', name: 'Massief goud', price: 400,  color: '#ffc700' },
    { id: 'robloxgrijs', type: 'skin', name: 'Steenblok', price: 220,  color: '#a8adb3' },
    { id: 'neon',      type: 'skin', name: 'Neon',        price: 320,  color: '#00ffcc' },
    { id: 'regenboog', type: 'skin', name: 'Regenboog',   price: 750,  color: 'rainbow' },

    // hoofddeksels
    { id: 'geen',      type: 'hat', name: 'Niets',        price: 0,   icon: '🚫', css: '' },
    { id: 'pet',       type: 'hat', name: 'Pet',          price: 50,  icon: '🧢', css: 'cap' },
    { id: 'party',     type: 'hat', name: 'Feesthoed',    price: 80,  icon: '🥳', css: 'party' },
    { id: 'koptel',    type: 'hat', name: 'Koptelefoon',  price: 120, icon: '🎧', css: 'phones' },
    { id: 'kroon',     type: 'hat', name: 'Kroon',        price: 300, icon: '👑', css: 'crown' },
    { id: 'tophat',    type: 'hat', name: 'Hoge hoed',    price: 250, icon: '🎩', css: 'tophat' },
    { id: 'halo',      type: 'hat', name: 'Halo',         price: 450, icon: '😇', css: 'halo' },
    { id: 'duivel',    type: 'hat', name: 'Duivelshoorns', price: 450, icon: '😈', css: 'horns' },
    { id: 'raket',     type: 'hat', name: 'Raket op je rug', price: 600, icon: '🚀', css: 'rocket' },
    { id: 'draak',     type: 'hat', name: 'Drakenkop',    price: 900, icon: '🐲', css: 'dragon' },
  ];

  function itemById(id) {
    for (let i = 0; i < SHOP.length; i++) if (SHOP[i].id === id) return SHOP[i];
    return null;
  }

  /** Alle items van één type. */
  function shopFor(type) {
    return SHOP.filter((i) => i.type === type);
  }

  /** Bezit je dit item al? */
  function owns(store, type, id) {
    const bag = getProfile(store).owned[type] || [];
    return bag.indexOf(id) !== -1;
  }

  /**
   * Doe een item aan dat je al bezit. Onbekende of niet-bezaten items worden
   * geweigerd, zodat een foute klik nooit het profiel in de war schopt.
   * @returns {{ok:boolean, reason?:string}}
   */
  function equipItem(store, type, id) {
    if (type !== 'skin' && type !== 'hat') return { ok: false, reason: 'onbekend type' };
    const item = itemById(id);
    if (!item || item.type !== type) return { ok: false, reason: 'onbekend item' };
    if (!owns(store, type, id)) return { ok: false, reason: 'niet in bezit' };
    saveProfile(store, { [type]: id });
    return { ok: true };
  }

  /**
   * Koopt een item. Failt netjes bij te weinig muntjes of dubbel bezit.
   * @returns {{ok:boolean, reason?:string, coins:number}}
   */
  function buyItem(store, item) {
    if (!item || typeof item.price !== 'number') return { ok: false, reason: 'onbekend', coins: getCoins(store) };
    const profile = getProfile(store);
    const bag = profile.owned[item.type] || [];
    if (bag.indexOf(item.id) !== -1) return { ok: false, reason: 'bezit', coins: getCoins(store) };
    const paid = spendCoins(store, item.price);
    if (!paid.ok) return { ok: false, reason: 'muntjes', coins: paid.coins };
    bag.push(item.id);
    profile.owned[item.type] = bag;
    if (item.equip !== false) profile[item.type] = item.id;
    write(store, KEY.profile, profile);
    return { ok: true, coins: paid.coins };
  }

  /* ───────────────────────── vrienden ──────────────────────── */

  /** Nep-vrienden zodat de lijst niet leeg is; de speler kan ze verwijderen. */
  const SEED_FRIENDS = [
    { name: 'Nova', emoji: '🤖', level: 7, online: true },
    { name: 'Pip', emoji: '🐥', level: 3, online: true },
    { name: 'Bram', emoji: '🦖', level: 12, online: false },
  ];

  function getFriends(store) {
    const f = read(store, KEY.friends, null);
    return Array.isArray(f) ? f : SEED_FRIENDS.slice();
  }

  function addFriend(store, name, emoji) {
    const clean = String(name || '').trim().slice(0, 16);
    if (!clean) return { ok: false, friends: getFriends(store) };
    const list = getFriends(store);
    if (list.some((x) => x.name.toLowerCase() === clean.toLowerCase())) {
      return { ok: false, reason: 'bestaat al', friends: list };
    }
    list.push({
      name: clean,
      emoji: emoji || '🙂',
      level: 1 + Math.floor(Math.random() * 9),
      online: Math.random() > 0.4,
    });
    write(store, KEY.friends, list);
    return { ok: true, friends: list };
  }

  function removeFriend(store, name) {
    const list = getFriends(store).filter((x) => x.name !== name);
    write(store, KEY.friends, list);
    return list;
  }

  /* ───────────────────────── instellingen ──────────────────── */

  const DEFAULT_SETTINGS = { sound: true, reduceMotion: false, highScoresShared: true };

  function getSettings(store) {
    const s = read(store, KEY.settings, null);
    return Object.assign({}, DEFAULT_SETTINGS, s && typeof s === 'object' ? s : {});
  }

  function saveSettings(store, patch) {
    const next = Object.assign(getSettings(store), patch || {});
    write(store, KEY.settings, next);
    return next;
  }

  /* ───────────────────────── sessie ────────────────────────── */

  function getSession(store) {
    return read(store, KEY.session, null);
  }

  function setSession(store, user) {
    if (!user) {
      try { store.removeItem(KEY.session); } catch (e) { /* noop */ }
      return null;
    }
    write(store, KEY.session, { name: user, at: Date.now() });
    return { name: user, at: Date.now() };
  }

  function readUsers(store) {
    const u = read(store, KEY.users, null);
    return u && typeof u === 'object' ? u : {};
  }

  function writeUsers(store, users) {
    write(store, KEY.users, users);
  }

  /** Wis alleen SpaceBlox-data, laat andere sites met rust. */
  function wipe(store) {
    Object.keys(KEY).forEach((k) => {
      try { store.removeItem(KEY[k]); } catch (e) { /* noop */ }
    });
    // scores zitten onder eigen keys
    try {
      const doomed = [];
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        if (k && k.indexOf(KEY.scores) === 0) doomed.push(k);
      }
      doomed.forEach((k) => store.removeItem(k));
    } catch (e) { /* noop */ }
  }

  return {
    KEY: KEY,
    SEED_FRIENDS: SEED_FRIENDS,
    SHOP: SHOP,
    DEFAULT_PROFILE: DEFAULT_PROFILE,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    read: read,
    write: write,
    esc: esc,
    dayStamp: dayStamp,
    addCoins: addCoins,
    spendCoins: spendCoins,
    getCoins: getCoins,
    formatCoins: formatCoins,
    claimDaily: claimDaily,
    submitScore: submitScore,
    getBest: getBest,
    getBoard: getBoard,
    coinsForScore: coinsForScore,
    bumpStat: bumpStat,
    getStats: getStats,
    getLevel: getLevel,
    getProfile: getProfile,
    saveProfile: saveProfile,
    itemById: itemById,
    shopFor: shopFor,
    owns: owns,
    equipItem: equipItem,
    buyItem: buyItem,
    getFriends: getFriends,
    addFriend: addFriend,
    removeFriend: removeFriend,
    getSettings: getSettings,
    saveSettings: saveSettings,
    getSession: getSession,
    setSession: setSession,
    readUsers: readUsers,
    writeUsers: writeUsers,
    wipe: wipe,
  };
});
