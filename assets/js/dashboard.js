/**
 * SpaceBlox — dashboard
 *
 * Leest alles uit dezelfde opslaglaag als de rest van de site. Voor de admin
 * is er een extra sectie met de geregistreerde accounts (namen en aanmaakdatum
 * alleen — hashes worden hier bewust niet getoond).
 */
(function (root) {
  'use strict';

  const store = root.localStorage;
  const Lib = root.SBLib;

  if (root.SB && root.SB.bootScreen) root.SB.bootScreen();

  // Alleen de beheerder mag het dashboard zien
  if (!root.SB || !root.SB.isAdmin(store)) {
    const lock = () => {
      document.body.innerHTML =
        '<div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:#232527;color:#eee;font-family:system-ui,sans-serif">' +
        '<div style="font-size:52px">🔒</div>' +
        '<h1 style="margin:0">Dit dashboard is alleen voor de beheerder</h1>' +
        '<p style="color:#9aa0a6">Log in als beheerder via Profiel → Instellingen.</p>' +
        '<a href="index.html" style="color:#00b06f;font-weight:700">← terug naar SpaceBlox</a></div>';
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', lock);
    else lock();
    return;
  }
  const $ = (id) => document.getElementById(id);

  function card(label, value, sub, tone) {
    const d = document.createElement('div');
    d.className = 'dash-card' + (tone ? ' ' + tone : '');
    d.innerHTML =
      '<div class="dc-label">' + label + '</div>' +
      '<div class="dc-value">' + value + '</div>' +
      (sub ? '<div class="dc-sub">' + sub + '</div>' : '');
    return d;
  }

  function paintCards() {
    const stats = SB.getStats(store);
    const level = SB.getLevel(store);
    const box = $('cards');
    box.innerHTML = '';

    let records = 0;
    let plays = stats.plays || 0;
    Lib.GAMES.forEach((g) => { if (SB.getBest(store, g.id).value > 0) records++; });

    box.appendChild(card('Level', level.level, level.xp + ' XP totaal', 'gold'));

    const lv = card('Voortgang', level.pct + '%', level.into + ' / ' + level.need + ' XP naar Lv ' + (level.level + 1));
    const bar = document.createElement('div');
    bar.className = 'dc-bar';
    bar.innerHTML = '<i style="width:' + level.pct + '%"></i>';
    lv.appendChild(bar);
    box.appendChild(lv);

    box.appendChild(card('Muntjes', SB.formatCoins(SB.getCoins(store)), 'beschikbaar', 'gold'));
    box.appendChild(card('Speelbeurten', plays, 'totaal', 'blue'));
    box.appendChild(card('Records', records + ' / ' + Lib.GAMES.length, 'games gespeeld', 'green'));
    box.appendChild(card('Vrienden', SB.getFriends(store).length, 'op dit apparaat'));

    const streak = SB.read(store, SB.KEY.rewards, { streak: 0, last: 0 }).streak;
    box.appendChild(card('Dagelijkse reeks', streak + (streak === 1 ? ' dag' : ' dagen'),
      SB.read(store, SB.KEY.rewards, { last: 0 }).last === SB.dayStamp() ? 'vandaag geclaimd' : 'nog te claimen'));
  }

  function paintGames() {
    const body = $('gameRows');
    body.innerHTML = '';
    Lib.GAMES.forEach((g) => {
      const best = SB.getBest(store, g.id);
      const board = SB.getBoard(store, g.id);
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td class="g-name">' + g.icon + ' ' + SB.esc(g.name) + '</td>' +
        '<td>' + SB.esc(g.cat) + '</td>' +
        (best.value
          ? '<td class="num">' + best.value + ' ' + SB.esc(g.unit) + '</td>'
          : '<td class="none">nog niet gespeeld</td>') +
        '<td>' + (board.length || '—') + '</td>' +
        '<td></td>';
      const td = tr.lastElementChild;
      if (board.length) {
        const b = document.createElement('button');
        b.className = 'link';
        b.textContent = 'Top 8 →';
        b.onclick = () => openBoard(g);
        td.appendChild(b);
      }
      body.appendChild(tr);
    });
  }

  function openBoard(g) {
    const board = SB.getBoard(store, g.id);
    const best = SB.getBest(store, g.id);
    $('boardTitle').textContent = g.icon + ' ' + g.name;
    $('boardSub').textContent = 'Jouw record: ' + best.value + ' ' + g.unit;
    const ol = $('boardList');
    ol.innerHTML = board.map((e, i) =>
      '<li><span class="rk">' + (i + 1) + '</span><span class="nm">' + SB.esc(e.name) +
      '</span><span class="vl">' + e.value + '</span></li>').join('');
    $('boardModal').classList.add('open');
  }

  function paintAdmin() {
    const user = root.SBAuth.currentUser(store);
    $('adminSec').hidden = !(user && user.admin);
    if (!user || !user.admin) return;

    const users = SB.readUsers(store);
    const body = $('userRows');
    body.innerHTML = '';
    const names = Object.keys(users);
    if (!names.length) {
      body.innerHTML = '<tr><td colspan="3" class="none">Nog geen geregistreerde accounts.</td></tr>';
      return;
    }
    names.forEach((key) => {
      const u = users[key];
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td class="g-name">' + SB.esc(u.name) + '</td>' +
        '<td>' + new Date(u.created).toLocaleString('nl-NL') + '</td>' +
        '<td>' + (u.admin ? '👑 admin' : 'speler') + '</td>';
      body.appendChild(tr);
    });
  }

  /* ───────────────── export / import ───────────────── */

  function exportData() {
    const dump = {};
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i);
      if (k && k.indexOf('sbx.') === 0) dump[k] = store.getItem(k);
    }
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'spaceblox-gegevens.json';
    a.click();
    URL.revokeObjectURL(a.href);
    $('ioMsg').textContent = '✅ Geëxporteerd.';
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        let n = 0;
        Object.keys(data).forEach((k) => {
          // alleen onze eigen keys, nooit iets anders overschrijven
          if (k.indexOf('sbx.') === 0 && typeof data[k] === 'string') { store.setItem(k, data[k]); n++; }
        });
        $('ioMsg').textContent = '✅ ' + n + ' onderdelen geïmporteerd. Pagina wordt herladen…';
        root.setTimeout(() => root.location.reload(), 1200);
      } catch (err) {
        $('ioMsg').textContent = '❌ Dat bestand is geen geldige SpaceBlox-export.';
      }
    };
    reader.readAsText(file);
  }

  function init() {
    $('coins').textContent = SB.formatCoins(SB.getCoins(store));
    const user = root.SBAuth.currentUser(store);
    const profile = SB.getProfile(store);
    $('whoAmI').textContent = user ? '👑 ' + user.name + ' (admin)' : profile.emoji + ' ' + profile.name;

    paintCards();
    paintGames();
    paintAdmin();

    document.querySelectorAll('[data-close]').forEach((b) => {
      b.onclick = () => $('boardModal').classList.remove('open');
    });
    $('boardModal').addEventListener('click', (e) => {
      if (e.target === $('boardModal')) $('boardModal').classList.remove('open');
    });

    $('btnExport').onclick = exportData;
    $('btnImport').onchange = (e) => { if (e.target.files[0]) importData(e.target.files[0]); };
    $('btnWipe').onclick = () => {
      if (!root.confirm('Werkelijk alles wissen? Muntjes, records en accounts zijn dan weg.')) return;
      SB.wipe(store);
      root.location.href = 'index.html';
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(typeof self !== 'undefined' ? self : globalThis);
