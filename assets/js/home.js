/**
 * SpaceBlox — homepage
 *
 * Rendert de gamelijst uit assets/js/games.js en regelt profiel, muntjes,
 * vrienden, inloggen en de dagelijkse beloning. Er staat hier geen gamedata:
 * een spel toevoegen doe je alleen in games.js.
 */
(function (root) {
  'use strict';

  const store = root.localStorage;
  const Lib = root.SBLib;
  const $ = (id) => document.getElementById(id);

  let view = 'ontdek';
  let cat = 'alle';
  let query = '';

  const EMOJIS = ['🧑', '👧', '👦', '🦊', '🐼', '🦖', '🤖', '👾', '🐥', '🦄', '🐙', '🚀', '🌟', '🍕', '🎃', '🐸'];

  /* ───────────────────────── weergave ──────────────────────── */

  function paintTop() {
    const coins = SB.getCoins(store);
    const level = SB.getLevel(store);
    const profile = SB.getProfile(store);
    const user = root.SBAuth.currentUser(store);
    const stats = SB.getStats(store);

    $('coins').textContent = SB.formatCoins(coins);
    $('statCoins').textContent = SB.formatCoins(coins);
    $('statPlays').textContent = stats.plays || 0;

    // aantal games waarin je een record hebt staan
    let records = 0;
    Lib.GAMES.forEach((g) => { if (SB.getBest(store, g.id).value > 0) records++; });
    $('statBest').textContent = records;

    $('pbName').textContent = user ? user.name : profile.name;
    $('pbAvatar').textContent = user && user.admin ? '👑' : profile.emoji;
    $('pbAvatar').classList.toggle('admin', !!(user && user.admin));
    $('pbRole').hidden = !(user && user.admin);

    $('pbLv').textContent = 'Lv ' + level.level;
    $('pbXp').style.width = level.pct + '%';
    $('pbXpLabel').textContent = level.xp + ' XP';

    $('loginBtn').textContent = user ? (user.admin ? '👑' : '👤') : '👤';
    $('loginBtn').classList.toggle('has-new', !SB.read(store, SB.KEY.rewards, { last: 0 }).last);

    // beloningknop licht op als er iets te halen valt
    const canClaim = SB.read(store, SB.KEY.rewards, { last: 0 }).last !== SB.dayStamp();
    $('giftBtn').classList.toggle('has-new', canClaim);
  }

  function gameCard(g) {
    const best = SB.getBest(store, g.id);
    const card = document.createElement('a');
    card.className = 'game';
    card.href = Lib.path(g.id);
    card.innerHTML =
      '<div class="game-thumb" style="background:linear-gradient(135deg,' + g.grad[0] + ',' + g.grad[1] + ')">' +
        '<span aria-hidden="true">' + g.icon + '</span>' +
        '<span class="badge"><span class="dot"></span>' + g.players + ' speler</span>' +
        (best.value ? '<span class="best">🏆 ' + best.value + ' ' + g.unit + '</span>' : '') +
        '<span class="play"><span class="play-pill">▶ Spelen</span></span>' +
      '</div>' +
      '<div class="game-info">' +
        '<h3>' + SB.esc(g.name) + '</h3>' +
        '<div class="tag">' + SB.esc(g.tagline) + '</div>' +
        '<div class="meta"><span class="cat-tag">' + catName(g.cat) + '</span>' +
        '<span>' + (best.value ? 'record ' + best.value : 'nog niet gespeeld') + '</span></div>' +
      '</div>';
    return card;
  }

  function catName(id) {
    const c = Lib.CATEGORIES.find((x) => x.id === id);
    return c ? c.icon + ' ' + c.name : id;
  }

  function paintCats() {
    const box = $('cats');
    box.innerHTML = '';
    Lib.CATEGORIES.forEach((c) => {
      const b = document.createElement('button');
      b.className = 'cat' + (c.id === cat ? ' active' : '');
      b.textContent = c.icon + ' ' + c.name;
      b.onclick = () => { cat = c.id; paintCats(); paintGrid(); };
      box.appendChild(b);
    });
  }

  function paintGrid() {
    const grid = $('grid');
    grid.innerHTML = '';

    let list = query ? Lib.search(query) : Lib.byCategory(cat);

    $('gridTitle').textContent = query
      ? '🔍 "' + query + '"'
      : (cat === 'alle' ? '🎮 Alle games' : catName(cat));
    $('gridCount').textContent = list.length + (list.length === 1 ? ' game' : ' games');
    $('empty').hidden = list.length > 0;

    list.forEach((g) => grid.appendChild(gameCard(g)));

    // Uitgelicht alleen op het tabblad Ontdek zonder filter of zoekopdracht
    const showFeatured = view === 'ontdek' && !query && cat === 'alle';
    $('featuredSec').hidden = !showFeatured;
    if (showFeatured) {
      const fg = $('featuredGrid');
      fg.innerHTML = '';
      Lib.featured().forEach((g) => fg.appendChild(gameCard(g)));
    }
  }

  /* ───────────────────────── vrienden ──────────────────────── */

  function paintFriends() {
    const box = $('friendList');
    box.innerHTML = '';
    const list = SB.getFriends(store);
    if (!list.length) {
      box.innerHTML = '<div class="empty">Nog geen vrienden. Voeg er een toe!</div>';
      return;
    }
    list.forEach((f) => {
      const row = document.createElement('div');
      row.className = 'friend';
      row.innerHTML =
        '<span class="f-av">' + SB.esc(f.emoji) +
          '<span class="' + (f.online ? 'on' : 'on off') + '"></span></span>' +
        '<span class="f-txt"><span class="f-name">' + SB.esc(f.name) + '</span>' +
        '<span class="f-sub">Level ' + f.level + ' · ' + (f.online ? '🟢 online' : '⚪ offline') + '</span></span>';
      const del = document.createElement('button');
      del.className = 'f-del';
      del.textContent = '✕';
      del.title = 'Verwijder ' + f.name;
      del.onclick = () => { SB.removeFriend(store, f.name); paintFriends(); };
      row.appendChild(del);
      box.appendChild(row);
    });
  }

  /* ───────────────────────── profiel ───────────────────────── */

  function paintProfile() {
    const p = SB.getProfile(store);
    $('profName').value = p.name;
    const box = $('emojiPicker');
    box.innerHTML = '';
    EMOJIS.forEach((e) => {
      const b = document.createElement('button');
      b.className = 'reward-day' + (e === p.emoji ? ' today' : '');
      b.style.cursor = 'pointer';
      b.style.fontSize = '1.2rem';
      b.textContent = e;
      b.onclick = () => {
        SB.saveProfile(store, { emoji: e });
        paintProfile();
        paintTop();
      };
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
        '<span class="pb-lv">' + best.value + ' ' + g.unit + '</span>';
      rec.appendChild(row);
    });
    if (!any) rec.innerHTML = '<div class="empty">Nog geen records. Speel een game!</div>';

    $('setSound').checked = SB.getSettings(store).sound;
  }

  /* ───────────────────────── beloning ──────────────────────── */

  function paintGift() {
    const table = [10, 20, 30, 40, 50, 60, 75];
    const state = SB.read(store, SB.KEY.rewards, { streak: 0, last: 0 });
    const today = SB.dayStamp();
    const claimed = state.last === today;

    const box = $('rewardDays');
    box.innerHTML = '';
    table.forEach((amount, i) => {
      const d = document.createElement('div');
      const dayNum = i + 1;
      d.className = 'reward-day' +
        (dayNum < state.streak || (claimed && dayNum === state.streak) ? ' done' : '') +
        (!claimed && dayNum === Math.min(state.streak + 1, 7) ? ' today' : '');
      d.innerHTML = '<b>' + amount + '</b>dag ' + dayNum;
      box.appendChild(d);
    });

    $('rewardMsg').textContent = claimed
      ? '✅ Al geclaimd vandaag. Kom morgen terug — je reeks staat op ' + state.streak + ' dagen.'
      : '🪙 Je krijgt ' + table[Math.min(state.streak + 1, 7) - 1] + ' muntjes. Reeks: ' + state.streak + ' dagen.';
    $('claimReward').disabled = claimed;
    $('claimReward').textContent = claimed ? 'Al geclaimd' : '🪙 Claimen';
  }

  /* ───────────────────────── inloggen ──────────────────────── */

  function openModal(id) {
    document.querySelectorAll('.modal-bg').forEach((m) => m.classList.remove('open'));
    $(id).classList.add('open');
  }
  function closeModals() {
    document.querySelectorAll('.modal-bg').forEach((m) => m.classList.remove('open'));
  }

  function showAuthPane(which) {
    const user = root.SBAuth.currentUser(store);
    $('authLogin').hidden = true;
    $('authRegister').hidden = true;
    $('authAccount').hidden = true;
    $('authTabs').style.display = user ? 'none' : 'flex';

    if (user) {
      $('authAccount').hidden = false;
      $('accName').textContent = (user.admin ? '👑 ' : '') + user.name;
      $('accRole').textContent = user.admin ? 'Admin · dashboard beschikbaar' : 'Speler';
      $('accAdminBox').hidden = !user.admin;
      return;
    }
    $(which === 'register' ? 'authRegister' : 'authLogin').hidden = false;
  }

  /* ───────────────────────── events ────────────────────────── */

  function wire() {
    // tabs
    document.querySelectorAll('#tabs .tab').forEach((t) => {
      t.onclick = () => {
        view = t.dataset.view;
        document.querySelectorAll('#tabs .tab').forEach((x) => x.classList.toggle('active', x === t));
        ['ontdek', 'vrienden', 'profiel'].forEach((v) => {
          $('view-' + v).hidden = v !== view;
        });
        if (view === 'vrienden') paintFriends();
        if (view === 'profiel') paintProfile();
        if (view === 'ontdek') paintGrid();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      };
    });

    // zoeken
    $('search').addEventListener('input', (e) => {
      query = e.target.value.trim();
      if (view !== 'ontdek') document.querySelector('#tabs .tab[data-view="ontdek"]').click();
      paintGrid();
    });

    // beloning
    $('giftBtn').onclick = () => { paintGift(); openModal('giftModal'); };
    $('claimReward').onclick = () => {
      const r = SB.claimDaily(store);
      if (r.claimed) {
        $('rewardMsg').textContent = '🎉 +' + r.coins + ' muntjes! Reeks: ' + r.streak + ' dagen.';
        paintTop();
        paintGift();
      }
    };

    // inloggen
    $('loginBtn').onclick = () => { showAuthPane('login'); openModal('authModal'); };
    document.querySelectorAll('#authTabs .tab').forEach((t) => {
      t.onclick = () => {
        document.querySelectorAll('#authTabs .tab').forEach((x) => x.classList.toggle('active', x === t));
        showAuthPane(t.dataset.auth);
      };
    });
    document.querySelectorAll('[data-close]').forEach((b) => { b.onclick = closeModals; });
    document.querySelectorAll('.modal-bg').forEach((m) => {
      m.addEventListener('click', (e) => { if (e.target === m) closeModals(); });
    });

    $('logSubmit').onclick = async () => {
      $('logErr').textContent = '';
      const r = await root.SBAuth.login(store, $('logUser').value, $('logPass').value);
      if (!r.ok) { $('logErr').textContent = r.error; return; }
      SB.setSession(store, r.name);
      $('logPass').value = '';
      paintTop();
      showAuthPane('login');
    };
    $('logPass').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('logSubmit').click(); });

    $('regSubmit').onclick = async () => {
      $('regErr').textContent = '';
      const r = await root.SBAuth.register(store, $('regUser').value, $('regPass').value, $('regPass2').value);
      if (!r.ok) { $('regErr').textContent = r.error; return; }
      SB.setSession(store, r.name);
      $('regPass').value = '';
      $('regPass2').value = '';
      paintTop();
      showAuthPane('login');
    };

    $('logOut').onclick = () => {
      root.SBAuth.logout(store);
      paintTop();
      showAuthPane('login');
    };

    $('goDashboard').onclick = () => { root.location.href = 'dashboard.html'; };

    $('pwSubmit').onclick = async () => {
      $('pwErr').textContent = '';
      $('pwOk').textContent = '';
      const user = root.SBAuth.currentUser(store);
      if (!user) return;
      const r = await root.SBAuth.changePassword(
        store, user.name, $('pwOld').value, $('pwNew').value, $('pwNew2').value
      );
      if (!r.ok) { $('pwErr').textContent = r.error; return; }
      $('pwOk').textContent = '✅ Wachtwoord gewijzigd.';
      $('pwOld').value = ''; $('pwNew').value = ''; $('pwNew2').value = '';
    };

    // profiel
    $('saveProfile').onclick = () => {
      const name = root.SBAuth.cleanName($('profName').value) || 'Speler';
      SB.saveProfile(store, { name: name });
      $('profOk').textContent = '✅ Opgeslagen!';
      paintTop();
      paintProfile();
      root.setTimeout(() => { $('profOk').textContent = ''; }, 2200);
    };

    $('setSound').onchange = (e) => {
      SB.saveSettings(store, { sound: e.target.checked });
    };

    $('resetData').onclick = () => {
      if (!root.confirm('Alle muntjes, records en je profiel wissen? Dit kan niet terug.')) return;
      SB.wipe(store);
      root.location.reload();
    };

    // vrienden
    $('addFriend').onclick = () => {
      const r = SB.addFriend(store, $('friendName').value, EMOJIS[Math.floor(Math.random() * EMOJIS.length)]);
      $('friendErr').textContent = r.ok ? '' : (r.reason === 'bestaat al' ? 'Die vriend heb je al.' : 'Vul een naam in.');
      if (r.ok) { $('friendName').value = ''; paintFriends(); }
    };
    $('friendName').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('addFriend').click(); });
  }

  /* ───────────────────────── start ─────────────────────────── */

  function init() {
    // Eerste bezoek: geef een klein startkapitaal zodat de winkel niet leeg voelt.
    if (SB.read(store, SB.KEY.coins, null) === null) SB.addCoins(store, 100);
    wire();
    paintCats();
    paintGrid();
    paintTop();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(typeof self !== 'undefined' ? self : globalThis);
