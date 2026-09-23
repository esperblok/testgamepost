/**
 * Oude URL's doorsturen naar de nieuwe structuur.
 *
 * Vroeger lag elk spel los in de root (snake.html, orlog.html, ...). Nu staan
 * ze onder games/. Dit bestand houdt oude links en bladwijzers werkend.
 * Zet de id in <body data-redirect="..."> of gebruik ?naar=<id>.
 */
(function () {
  'use strict';

  var TARGETS = {
    // oude losse games -> nieuwe plek
    snake: 'games/snake.html',
    pong: 'games/pong.html',
    dino: 'games/dino.html',
    clicker: 'games/clicker.html',
    guess: 'games/guess.html',
    memory: 'games/memory.html',
    racer: 'games/racer.html',
    shooter: 'games/shooter.html',
    race: 'games/race.html',
    orlog: 'games/orlog.html',
    moon: 'games/moon.html',
    blockrun: 'games/blockrun.html',
    dashboard: 'dashboard.html',
    // De oude game_0.html t/m game_3214.html waren allemaal nep; die gaan
    // allemaal naar de homepage.
    index: 'index.html',
  };

  function target() {
    var q = new URLSearchParams(location.search).get('naar');
    if (q && TARGETS[q]) return TARGETS[q];
    var id = document.body && document.body.dataset ? document.body.dataset.redirect : null;
    if (id && TARGETS[id]) return TARGETS[id];
    // game_<nummer>.html of een onbekende id: terug naar het overzicht
    return 'index.html';
  }

  var to = target();
  document.getElementById('target').textContent = to;
  location.replace(to);
})();
