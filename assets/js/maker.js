/**
 * SpaceBlox — Game Maker
 *
 * Laat spelers eigen games toevoegen: een html-bestand uploaden (hun "rom")
 * of een simpele klik-game laten bouwen. Alles blijft lokaal in localStorage.
 */
(function (root) {
  'use strict';

  const SB = root.SB;
  const store = root.localStorage;
  if (SB.bootScreen) SB.bootScreen();
  const $ = (id) => document.getElementById(id);

  function msg(el, text, ok) {
    el.textContent = text;
    el.className = 'mk-msg ' + (ok ? 'ok' : 'err');
  }

  function rid() {
    return 'c' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
  }

  function paintList() {
    const box = $('list');
    box.innerHTML = '';
    const games = SB.getCustomGames(store);
    if (!games.length) {
      box.innerHTML = '<p style="color:#9aa0a6">Nog geen eigen games — maak of upload er een!</p>';
      return;
    }
    games.forEach((g) => {
      const row = document.createElement('div');
      row.className = 'mk-item';
      row.innerHTML =
        '<span class="em">' + SB.esc(g.emoji || '🎮') + '</span>' +
        '<span><b>' + SB.esc(g.name) + '</b><small>' + (g.type === 'upload' ? 'geüploade html-game' : 'klik-game · doel ' + g.target + ' kliks') + '</small></span>';
      const sp = document.createElement('span');
      sp.className = 'sp';
      const play = document.createElement('a');
      play.className = 'sb-btn sb-btn-primary';
      play.href = 'custom.html?id=' + encodeURIComponent(g.id);
      play.textContent = '▶ Spelen';
      const del = document.createElement('button');
      del.className = 'sb-btn sb-btn-ghost';
      del.textContent = '🗑️';
      del.addEventListener('click', () => { SB.deleteCustomGame(store, g.id); paintList(); });
      sp.appendChild(play);
      sp.appendChild(del);
      row.appendChild(sp);
      box.appendChild(row);
    });
  }

  /* ── upload ── */
  $('upForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const file = $('upFile').files[0];
    const name = $('upName').value.trim();
    if (!file) return msg($('upMsg'), 'Kies eerst een bestand.', false);
    if (!name) return msg($('upMsg'), 'Vul een naam in.', false);
    if (file.size > 1500000) return msg($('upMsg'), 'Maximaal 1,5 MB — maak je game wat kleiner.', false);
    const r = new FileReader();
    r.onload = () => {
      SB.saveCustomGame(store, {
        id: rid(),
        name: name,
        emoji: $('upEmoji').value.trim() || '🎮',
        type: 'upload',
        html: String(r.result),
        c1: '#00b06f',
        c2: '#00a2ff',
      });
      msg($('upMsg'), '✅ "' + name + '" staat nu op SpaceBlox!', true);
      $('upForm').reset();
      paintList();
    };
    r.onerror = () => msg($('upMsg'), 'Kon het bestand niet lezen.', false);
    r.readAsText(file);
  });

  /* ── bouwen ─ */
  $('buildForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('bName').value.trim();
    if (!name) return msg($('bMsg'), 'Vul een naam in.', false);
    const target = Math.min(500, Math.max(5, parseInt($('bTarget').value, 10) || 50));
    SB.saveCustomGame(store, {
      id: rid(),
      name: name,
      emoji: $('bEmoji').value.trim() || '💎',
      type: 'clicker',
      target: target,
      c1: $('bC1').value,
      c2: $('bC2').value,
    });
    msg($('bMsg'), '✅ "' + name + '" is gebouwd en speelbaar!', true);
    $('buildForm').reset();
    paintList();
  });

  paintList();
})(typeof self !== 'undefined' ? self : globalThis);
