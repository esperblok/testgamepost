/**
 * SpaceBlox — avatarpagina (profile.html)
 *
 * Dezelfde pop en winkel als op de homepage, maar dan als eigen pagina —
 * hierheen linkt de avatar in de topbar van elke spelpagina.
 */
(function (root) {
  'use strict';

  if (root.SB && root.SB.bootScreen) root.SB.bootScreen();

  const store = root.localStorage;
  const Lib = root.SBLib;
  const Av = root.SBAvatar;
  const J = root.SBJuice;
  const $ = (id) => document.getElementById(id);

  const EMOJIS = ['🧑', '👧', '👦', '🦊', '🐼', '🦖', '🤖', '👾', '🐥', '🦄', '🐙', '🚀', '🌟', '🍕', '🎃', '🐸'];

  function hooks() {
    return {
      onChange: paint,
      onError(msg) {
        $('shopErr').textContent = msg;
        root.setTimeout(() => { $('shopErr').textContent = ''; }, 3200);
      },
    };
  }

  function paint() {
    const p = SB.getProfile(store);
    Av.renderFigure($('avFigure'), store);
    Av.renderSkins($('avSkins'), store, hooks());
    Av.renderHats($('avHats'), store, hooks());

    $('avName').textContent = p.name;
    const st = $('avStats');
    if (st) {
      st.innerHTML =
        '<span><b>' + SB.getFriends(store).length + '</b><small>vrienden</small></span>' +
        '<span><b>' + (SB.getLevel(store).level || 1) + '</b><small>level</small></span>' +
        '<span><b>' + SB.getCoins(store) + '</b><small>muntjes</small></span>';
    }
    $('avProfileName').value = p.name;
    $('coins').textContent = SB.formatCoins(SB.getCoins(store));

    const skin = SB.itemById(p.skin);
    const hat = SB.itemById(p.hat);
    $('avSkinName').textContent = skin ? skin.name : '';
    $('avHatName').textContent = hat ? hat.name : '';

    // emoji-kiezer
    const box = $('avEmojis');
    box.innerHTML = '';
    EMOJIS.forEach((e) => {
      const b = document.createElement('button');
      b.className = 'av-swatch' + (e === p.emoji ? ' on' : '');
      b.style.fontSize = '1.3rem';
      b.textContent = e;
      b.setAttribute('aria-label', 'Kies ' + e);
      b.onclick = () => { SB.saveProfile(store, { emoji: e }); paint(); };
      box.appendChild(b);
    });

    // records
    const rec = $('recordList');
    rec.innerHTML = '';
    let any = false;
    Lib.GAMES.forEach((g) => {
      const best = SB.getBest(store, g.id);
      if (!best.value) return;
      any = true;
      const row = document.createElement('div');
      row.className = 'friend';
      row.innerHTML =
        '<span class="f-av">' + g.icon + '</span>' +
        '<span class="f-txt"><span class="f-name">' + SB.esc(g.name) + '</span>' +
        '<span class="f-sub">' + SB.esc(best.name) + ' · ' + new Date(best.at).toLocaleDateString('nl-NL') + '</span></span>' +
        '<span class="sb-chip sb-coins">' + best.value + ' ' + SB.esc(g.unit) + '</span>';
      rec.appendChild(row);
    });
    if (!any) rec.innerHTML = '<div class="empty">Nog geen records. Speel een game!</div>';
  }

  function init() {
    if (SB.read(store, SB.KEY.coins, null) === null) SB.addCoins(store, 100);

    $('avSave').onclick = () => {
      const name = root.SBAuth.cleanName($('avProfileName').value) || 'Speler';
      SB.saveProfile(store, { name: name });
      $('avOk').textContent = '✅ Opgeslagen!';
      if (J) J.ripple($('avFigure'));
      paint();
      root.setTimeout(() => { $('avOk').textContent = ''; }, 2200);
    };

    paint();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(typeof self !== 'undefined' ? self : globalThis);

;(function () {
  const r = typeof self !== 'undefined' ? self : globalThis;
  const hide = () => {
    if (r.SB && !r.SB.isAdmin(r.localStorage)) {
      document.querySelectorAll('a[href="dashboard.html"]').forEach((n) => { n.style.display = 'none'; });
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hide);
  else hide();
})();
