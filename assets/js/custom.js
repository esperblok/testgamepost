/**
 * SpaceBlox — eigen games afspelen
 *
 * Speelt games af die in de Game Maker zijn gemaakt (klik-game) of
 * geüpload (html in een afgeschermde iframe).
 */
(function (root) {
  'use strict';

  const SB = root.SB;
  const J = root.SBJuice;
  const store = root.localStorage;
  const $ = (id) => document.getElementById(id);

  const id = new URLSearchParams(root.location.search).get('id') || '';
  const game = SB.getCustomGames(store).find((g) => g.id === id);

  if (!game) {
    $('cuStage').innerHTML = '<div class="cu-none">😕 Deze game bestaat niet (meer).<br><a href="maker.html" style="color:#00b06f">→ naar de Game Maker</a></div>';
    return;
  }

  $('cuTitle').textContent = (game.emoji || '🎮') + ' ' + game.name;

  if (game.type === 'upload') {
    const f = document.createElement('iframe');
    f.className = 'cu-frame';
    f.setAttribute('sandbox', 'allow-scripts allow-pointer-lock');
    f.srcdoc = game.html || '';
    $('cuStage').appendChild(f);
    return;
  }

  /* klik-game */
  const target = game.target || 50;
  let clicks = 0;
  let done = false;

  const wrap = document.createElement('div');
  wrap.className = 'cu-click';
  wrap.innerHTML =
    '<button class="cu-big" id="cuBig">' + SB.esc(game.emoji || '💎') + '</button>' +
    '<div class="cu-bar"><i id="cuBar"></i></div>' +
    '<div class="cu-count" id="cuCount">0 / ' + target + '</div>' +
    '<div class="cu-win" id="cuWin"></div>';
  $('cuStage').appendChild(wrap);

  $('cuBig').addEventListener('click', () => {
    if (done) return;
    clicks++;
    $('cuCount').textContent = clicks + ' / ' + target;
    $('cuBar').style.width = Math.min(100, (clicks / target) * 100) + '%';
    if (J && J.bounce) J.bounce($('cuBig'));
    if (clicks >= target) {
      done = true;
      const coins = Math.max(5, Math.round(target / 5));
      SB.addCoins(store, coins);
      $('cuWin').textContent = ' Gewonnen! +' + coins + ' muntjes';
      if (J && J.confetti) J.confetti();
    }
  });
})(typeof self !== 'undefined' ? self : globalThis);
