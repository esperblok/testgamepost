/**
 * SpaceBlox — gamebibliotheek
 *
 * Eén spel = één item in GAMES. Om een spel toe te voegen:
 *   1. Maak assets/js/games/<id>.js  (exporteert window.SBGames['<id>'])
 *   2. Voeg hier een item toe
 *   3. Maak games/<id>.html (kopieer een bestaande, pas SB_BOOT aan)
 *
 * Geen nepgames: alles wat hier staat is écht speelbaar.
 */
(function (root) {
  'use strict';

  const CATEGORIES = [
    { id: 'alle', name: 'Alle', icon: '🎮' },
    { id: 'actie', name: 'Actie', icon: '⚔️' },
    { id: 'race', name: 'Race', icon: '🏁' },
    { id: 'puzzel', name: 'Puzzel', icon: '🧩' },
    { id: 'avontuur', name: 'Avontuur', icon: '🗺️' },
    { id: 'bouwen', name: 'Bouwen', icon: '🧱' },
    { id: 'casual', name: 'Casual', icon: '🎲' },
  ];

  const GAMES = [
    {
      id: 'race', thumb: 'assets/img/race.jpg', name: 'Kart Race', icon: '🏎️', cat: 'race',
      render: 'canvas',
      width: 640, height: 400,
      tagline: 'Race tegen 3 rivalen op 3 circuits',
      desc: 'Kies je kart, pak de boost en win de beker. Drie circuits, drie rivalen, één beker.',
      players: 1, touches: true, featured: true,
      grad: ['#ff6a00', '#ff2d55'], accent: '#ff8a3d',
      best: 'highest', unit: 'punten',
    },
    {
      id: 'snake', thumb: 'assets/img/snake.jpg', name: 'Neon Snake', icon: '🐍', cat: 'actie',
      render: 'canvas',
      width: 480, height: 480,
      tagline: 'Eet, groei, raak jezelf niet',
      desc: 'De klassieker in een neon-jasje. Wordt steeds sneller naarmate je groeit.',
      players: 1, touches: true, featured: true,
      grad: ['#00e676', '#009688'], accent: '#00e676',
      best: 'highest', unit: 'appels',
    },
    {
      id: 'shooter', thumb: 'assets/img/shooter.jpg', name: 'Space Blaster', icon: '👾', cat: 'actie',
      render: 'canvas',
      width: 480, height: 640,
      tagline: 'Schiet de invasie neer',
      desc: 'Je bent het laatste kanon. Vijf golven aliens, eindbazen en power-ups.',
      players: 1, touches: true, featured: true,
      grad: ['#7c4dff', '#304ffe'], accent: '#9d7bff',
      best: 'highest', unit: 'punten',
    },
    {
      id: 'racer', thumb: 'assets/img/racer.jpg', name: 'Neon Rush', icon: '🚗', cat: 'race',
      render: 'canvas',
      width: 480, height: 640,
      tagline: 'Snelweg ontwijken op snelheid',
      desc: 'Eindeloze snelweg, steeds meer verkeer. Hoe lang houd jij het vol?',
      players: 1, touches: true,
      grad: ['#00c8ff', '#0066ff'], accent: '#00c8ff',
      best: 'highest', unit: 'meter',
    },
    {
      id: 'dino', thumb: 'assets/img/dino.jpg', name: 'Dino Runner', icon: '🦖', cat: 'actie',
      render: 'canvas',
      width: 640, height: 280,
      tagline: 'Spring over de cactussen',
      desc: 'Oneindig rennen, springen en bukken. Net iets te snel om makkelijk te zijn.',
      players: 1, touches: true,
      grad: ['#ffb300', '#ff6d00'], accent: '#ffc44d',
      best: 'highest', unit: 'meter',
    },
    {
      id: 'pong', thumb: 'assets/img/pong.jpg', name: 'Pong Duo', icon: '🏓', cat: 'actie',
      render: 'canvas',
      width: 480, height: 480,
      tagline: 'Eerste tot 7 wint',
      desc: 'Het oudste spel ooit, tegen de computer. Kies makkelijk, normaal of knotsgek.',
      players: 1, touches: true,
      grad: ['#26c6da', '#00838f'], accent: '#4dd0e1',
      best: 'highest', unit: 'punten',
    },
    {
      id: 'memory', thumb: 'assets/img/memory.jpg', name: 'Memory Match', icon: '🃏', cat: 'puzzel',
      tagline: 'Zoek de paren',
      desc: 'Draai kaarten om en onthoud waar alles ligt. Minder beurten is beter.',
      players: 1, touches: true,
      grad: ['#ff4081', '#c51162'], accent: '#ff80ab',
      best: 'lowest', unit: 'beurten',
    },
    {
      id: 'guess', thumb: 'assets/img/guess.jpg', name: 'Raad het Getal', icon: '🔢', cat: 'puzzel',
      tagline: '1 tot 100 — zo min mogelijk gokken',
      desc: 'Hoger of lager. Een goede gokker heeft het in 7 beurten.',
      players: 1, touches: false,
      grad: ['#ffd200', '#ff8f00'], accent: '#ffd200',
      best: 'lowest', unit: 'gokken',
    },
    {
      id: 'clicker', thumb: 'assets/img/clicker.jpg', name: 'Klik Tycoon', icon: '🪙', cat: 'casual',
      tagline: 'Jouw eigen tycoon: klik en bouw rijkdom',
      desc: 'Bouw een muntfabriek. Upgrades maken het leuker, niet makkelijker.',
      players: 1, touches: true,
      grad: ['#ffd200', '#ff6a00'], accent: '#ffd200',
      best: 'highest', unit: 'munten',
    },
    {
      id: 'orlog', thumb: 'assets/img/orlog.jpg', name: 'Orlog', icon: '🎲', cat: 'casual',
      tagline: 'Dobbelen tegen de vijand',
      desc: 'Drie rondes dobbelen, tokens inzetten, de beste combinatie wint.',
      players: 1, touches: true,
      grad: ['#8d6e63', '#4e342e'], accent: '#bcaaa4',
      best: 'highest', unit: 'zeges',
    },
    {
      id: 'moon', thumb: 'assets/img/moon.jpg', name: 'Maan Kolonie', icon: '🌙', cat: 'bouwen',
      tagline: 'Bouw een basis op de maan',
      desc: 'Zuurstof, energie en koepels. Overleef 30 dagen zonder dat alles ontploft.',
      players: 1, touches: true,
      grad: ['#78909c', '#37474f'], accent: '#b0bec5',
      best: 'highest', unit: 'dagen',
    },
    {
      id: 'blockrun', thumb: 'assets/img/blockrun.jpg', name: 'Mega Obby', icon: '🧱', cat: 'avontuur',
      render: 'canvas',
      width: 640, height: 360,
      tagline: 'Echte Roblox-obby: klim, spring, win',
      desc: 'Spring, verzamel kristallen en haal de vlag. Vijf levels, steeds lastiger.',
      players: 1, touches: true, featured: true,
      grad: ['#69f0ae', '#00897b'], accent: '#69f0ae',
      best: 'highest', unit: 'kristallen',
    },
  ];

  /** Zoek een game op id; geeft null bij onbekend id. */
  function byId(id) {
    for (let i = 0; i < GAMES.length; i++) if (GAMES[i].id === id) return GAMES[i];
    return null;
  }

  function byCategory(cat) {
    if (!cat || cat === 'alle') return GAMES.slice();
    return GAMES.filter((g) => g.cat === cat);
  }

  function search(q) {
    const needle = String(q || '').trim().toLowerCase();
    if (!needle) return GAMES.slice();
    return GAMES.filter((g) =>
      (g.name + ' ' + g.tagline + ' ' + g.cat).toLowerCase().indexOf(needle) !== -1
    );
  }

  function featured() {
    return GAMES.filter((g) => g.featured);
  }

  const api = {
    CATEGORIES: CATEGORIES,
    GAMES: GAMES,
    byId: byId,
    byCategory: byCategory,
    search: search,
    featured: featured,
    path: function (id) { return 'games/' + id + '.html'; },
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SBLib = api;
})(typeof self !== 'undefined' ? self : globalThis);
