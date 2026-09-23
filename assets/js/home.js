/**
 * SpaceBlox — homepage
 *
 * Rendert de Roblox-achtige voorpagina: een hero-carrousel, rijen die
 * horizontaal scrollen, het hele speleroverzicht, plus avatar, winkel,
 * vrienden, records en instellingen. Er staat hier geen gamedata: een spel
 * toevoegen doe je alleen in assets/js/games.js.
 */
(function (root) {
  'use strict';

  const store = root.localStorage;
  const Lib = root.SBLib;
  const Av = root.SBAvatar;
  const J = root.SBJuice;
  const $ = (id) => document.getElementById(id);

  let view = 'ontdek';
  let cat = 'alle';
  let query = '';
  let heroIndex = 0;
  let heroTimer = null;

  const EMOJIS = ['🧑', '👧', '👦', '🦊', '🐼', '🦖', '🤖', '👾', '🐥', '🦄', '🐙', '🚀', '🌟', '🍕', '🎃', '🐸'];

  /* ───────────────────── "hoe druk is het" ─────────────────── */

  /**
   * Stabiele hash van een tekst. Gebruikt om elk spel een vast startaantal
   * spelers te geven, zodat de lijst er levendig uitziet zonder server.
   */
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    return h >>> 0;
  }

  /**
   * Aantal "spelers" voor op het kaartje. Eerlijk gezegd: het startgetal is
   * verzonnen (elk spel krijgt een vast aantal), maar je eigen speelbeurten
   * tellen echt mee. Zie README.
   */
  function playersFor(g) {
    const stats = SB.getStats(store);
    const plays = Number(stats['plays.' + g.id]) || 0;
    return 140 + (hash(g.id) % 880) + plays * 7;
  }

  function fmtCount(n) {
    if (n >= 1000) return (n / 1000).toFixed(1).replace('.', ',') + 'K';
    return String(n);
  }

  function likePct(g) {
    return 88 + (hash(g.id + 'like') % 11);
  }

  function playsOf(g) {
    return Number(SB.getStats(store)['plays.' + g.id]) || 0;
  }

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

    let records = 0;
    Lib.GAMES.forEach((g) => { if (SB.getBest(store, g.id).value > 0) records++; });
    $('statBest').textContent = records;

    $('pbName').textContent = user ? user.name : profile.name;
    $('pbAvatar').textContent = user && user.admin ? '👑' : profile.emoji;
    $('pbAvatar').classList.toggle('admin', !!(user && user.admin));
    $('pbRole').hidden = !(user && user.admin);
    $('loginBtn').textContent = user && user.admin ? '👑' : profile.emoji;
    $('loginBtn').classList.toggle('admin', !!(user && user.admin));
    $('friendCount').textContent = SB.getFriends(store).length;

    $('pbLv').textContent = 'Lv ' + level.level;
    $('pbXp').style.width = level.pct + '%';

    const canClaim = SB.read(store, SB.KEY.rewards, { last: 0 }).last !== SB.dayStamp();
    $('giftBtn').classList.toggle('has-new', canClaim);
  }

  function thumbStyle(g) {
    const grad = 'linear-gradient(135deg,' + g.grad[0] + ',' + g.grad[1] + ')';
    if (!g.thumb) return 'background:' + grad;
    return 'background-image:url(' + g.thumb + '),' + grad +
      ';background-size:cover,cover;background-position:center,center;';
  }

  function gameCard(g) {
    const best = SB.getBest(store, g.id);
    const card = document.createElement('a');
    card.className = 'game';
    card.href = Lib.path(g.id);
    card.dataset.id = g.id;
    card.innerHTML =
      '<div class="game-thumb" style="' + thumbStyle(g) + '">' +
        (g.thumb ? '' : '<span class="art" aria-hidden="true">' + g.icon + '</span>') +
        '<span class="badge"><span class="dot"></span>' + fmtCount(playersFor(g)) + '</span>' +
        (best.value ? '<span class="best">🏆 ' + best.value + '</span>' : '') +
        '<span class="play"><span class="play-pill">▶ Spelen</span></span>' +
      '</div>' +
      '<div class="game-info">' +
        '<h3>' + SB.esc(g.name) + '</h3>' +
        '<div class="tag">' + SB.esc(g.tagline) + '</div>' +
        '<div class="meta">' +
          '<span class="live">' + fmtCount(playersFor(g)) + '</span>' +
          '<span>👍 ' + likePct(g) + '%</span>' +
        '</div>' +
      '</div>';
    // Klik = eerst de spelpagina bekijken, zoals op Roblox. De groene knop
    // daarop start het spel echt.
    card.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return; // nieuw tabblad mag
      e.preventDefault();
      openDetail(g.id);
    });
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
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', c.id === cat ? 'true' : 'false');
      b.onclick = () => { cat = c.id; paintCats(); paintAll(); };
      box.appendChild(b);
    });
  }

  /** Eén horizontaal scrollende rij. */
  function makeRow(title, hint, list) {
    const sec = document.createElement('section');
    sec.className = 'rb-row';

    const head = document.createElement('div');
    head.className = 'rb-row-head';
    head.innerHTML =
      '<h2>' + SB.esc(title) + '</h2>' +
      '<span class="hint">' + SB.esc(hint) + '</span>' +
      '<span class="tools"></span>';

    const track = document.createElement('div');
    track.className = 'rb-track';
    list.forEach((g) => track.appendChild(gameCard(g)));

    // Pijltjes om de rij door te schuiven (handig met een muis).
    const step = () => Math.max(180, track.clientWidth * 0.8);
    const tools = head.querySelector('.tools');
    ['◀', '▶'].forEach((label, i) => {
      const b = document.createElement('button');
      b.className = 'rb-mini';
      b.textContent = label;
      b.setAttribute('aria-label', i === 0 ? 'Naar links scrollen' : 'Naar rechts scrollen');
      b.onclick = () => {
        track.scrollBy({ left: (i === 0 ? -1 : 1) * step(), behavior: 'smooth' });
      };
      tools.appendChild(b);
    });

    sec.appendChild(head);
    sec.appendChild(track);
    return sec;
  }

  function paintRows() {
    const host = $('rows');
    host.innerHTML = '';
    if (query || cat !== 'alle') return;

    const popular = Lib.GAMES.slice().sort((a, b) => playersFor(b) - playersFor(a));
    host.appendChild(makeRow('🔥 Populair nu', 'meest gespeeld op dit apparaat', popular.slice(0, 8)));

    Lib.CATEGORIES.filter((c) => c.id !== 'alle').forEach((c) => {
      const list = Lib.byCategory(c.id);
      if (list.length) host.appendChild(makeRow(c.icon + ' ' + c.name, list.length + ' spellen', list));
    });
  }

  function paintGrid() {
    const grid = $('grid');
    grid.innerHTML = '';

    const list = query ? Lib.search(query) : Lib.byCategory(cat);

    $('gridTitle').textContent = query
      ? '🔍 "' + query + '"'
      : (cat === 'alle' ? '🎮 Alle games' : catName(cat));
    $('gridCount').textContent = list.length + (list.length === 1 ? ' game' : ' games');
    $('empty').hidden = list.length > 0;

    list.forEach((g) => grid.appendChild(gameCard(g)));

    // Uitgelicht en de rijen alleen zonder filter of zoekopdracht
    const plain = !query && cat === 'alle';
    $('featuredSec').hidden = !plain;
    if (plain) {
      const fg = $('featuredGrid');
      fg.innerHTML = '';
      Lib.featured().forEach((g) => fg.appendChild(gameCard(g)));
    }
    paintRows();
  }

  function paintAll() {
    paintGrid();
    paintTop();
  }

  /* ───────────────────────── hero ──────────────────────────── */

  function paintHero() {
    const list = Lib.featured();
    if (!list.length) return;
    if (heroIndex >= list.length) heroIndex = 0;
    const g = list[heroIndex];
    const best = SB.getBest(store, g.id);

    $('heroBg').style.cssText = thumbStyle({ grad: [g.grad[0], g.grad[1]], thumb: g.thumb })
      .replace('135deg', '120deg');
    $('heroArt').textContent = g.icon;
    $('heroArt').style.display = g.thumb ? 'none' : '';
    $('heroTitle').textContent = g.name;
    $('heroDesc').textContent = g.desc;
    $('heroStats').innerHTML =
      '<span><span class="live">●</span> <b>' + fmtCount(playersFor(g)) + '</b> spelen nu</span>' +
      '<span>👍 <b>' + likePct(g) + '%</b></span>' +
      '<span>' + (g.render === 'canvas' ? '🖥️' : '🃏') + ' ' + (g.render === 'canvas' ? 'Arcade' : 'Bordspel') + '</span>' +
      '<span>🏆 record: <b>' + (best.value ? best.value + ' ' + g.unit : '—') + '</b></span>';
    $('heroPlay').dataset.id = g.id;
    $('heroMore').dataset.id = g.id;

    const dots = $('heroDots');
    dots.innerHTML = '';
    list.forEach((x, i) => {
      const d = document.createElement('button');
      d.className = 'rb-dot' + (i === heroIndex ? ' active' : '');
      d.setAttribute('aria-label', 'Toon ' + x.name);
      d.onclick = () => { heroIndex = i; paintHero(); restartHeroTimer(); };
      dots.appendChild(d);
    });
  }

  function restartHeroTimer() {
    if (heroTimer) root.clearInterval(heroTimer);
    heroTimer = root.setInterval(() => {
      if (view !== 'ontdek' || document.hidden) return;
      heroIndex = (heroIndex + 1) % Lib.featured().length;
      paintHero();
    }, 7000);
  }

  /* ───────────────────── gamedetail (Roblox-spelpagina) ────── */

  function openDetail(id) {
    const g = Lib.byId(id);
    if (!g) return;
    const best = SB.getBest(store, id);
    const board = SB.getBoard(store, id);
    const me = SB.getProfile(store).name;

    $('dHero').style.cssText = thumbStyle({ grad: [g.grad[0], g.grad[1]], thumb: g.thumb })
      .replace('135deg', '120deg');
    $('dArt').textContent = g.icon;
    $('dArt').style.display = g.thumb ? 'none' : '';
    $('dName').textContent = g.name;
    $('dDesc').textContent = g.desc;
    $('dPlay').dataset.id = id;

    $('dStats').innerHTML =
      '<div><div class="k">Spelers nu</div><div class="v">' + fmtCount(playersFor(g)) + '</div></div>' +
      '<div><div class="k">Jouw record</div><div class="v">' + (best.value || 0) + ' ' + SB.esc(g.unit) + '</div></div>' +
      '<div><div class="k">Speelbeurten</div><div class="v">' + playsOf(g) + '</div></div>' +
      '<div><div class="k">Waardering</div><div class="v">👍 ' + likePct(g) + '%</div></div>';

    $('dChips').innerHTML =
      '<span>' + catName(g.cat) + '</span>' +
      '<span>👤 ' + g.players + ' speler</span>' +
      '<span>📱 werkt met touch</span>' +
      '<span>⌨️ pijltjes + spatie</span>';

    $('dBoard').innerHTML = board.length
      ? board.map((e, i) =>
          '<li' + (e.name === me ? ' class="me"' : '') + '><span class="rk">' + (i + 1) + '</span>' +
          '<span class="nm">' + SB.esc(e.name) + '</span><span class="vl">' + e.value + '</span></li>').join('')
      : '<li><span class="nm" style="color:var(--rb-faint)">Nog geen scores — wees de eerste!</span></li>';

    openModal('detailModal');
    const play = $('dPlay');
    if (play) play.focus();
  }

  /* ───────────────────── avatar & winkel ───────────────────── */

  function avatarHooks() {
    return {
      onChange() { paintAvatar(); paintTop(); },
      onError(msg) {
        const box = $('shopErr');
        box.textContent = msg;
        root.setTimeout(() => { box.textContent = ''; }, 3200);
      },
      onBuy(item) {
        paintTop();
        paintAvatar();
      },
    };
  }

  function paintAvatar() {
    const p = SB.getProfile(store);
    if (!$('avFigure')) return;
    Av.renderFigure($('avFigure'), store);
    Av.renderSkins($('avSkins'), store, avatarHooks());
    Av.renderHats($('avHats'), store, avatarHooks());
    $('avName').textContent = p.name;
    $('avProfileName').value = p.name;
    const skin = SB.itemById(p.skin);
    const hat = SB.itemById(p.hat);
    $('avSkinName').textContent = skin ? skin.name : '';
    $('avHatName').textContent = hat ? hat.name : '';
  }

  function paintShop() {
    if (!$('shopGrid')) return;
    Av.renderShop($('shopGrid'), store, avatarHooks());
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
          '<span class="' + (f.online ? 'on' : 'off') + '"></span></span>' +
        '<span class="f-txt"><span class="f-name">' + SB.esc(f.name) + '</span>' +
        '<span class="f-sub">Level ' + f.level + ' · ' + (f.online ? '🟢 online' : '⚪ offline') + '</span></span>';
      const del = document.createElement('button');
      del.className = 'f-del';
      del.textContent = '✕';
      del.title = 'Verwijder ' + f.name;
      del.setAttribute('aria-label', 'Verwijder ' + f.name);
      del.onclick = () => { SB.removeFriend(store, f.name); paintFriends(); paintTop(); };
      row.appendChild(del);
      box.appendChild(row);
    });
  }

  /* ───────────────────────── records ───────────────────────── */

  function paintRecords() {
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

  /* ───────────────────────── views ─────────────────────────── */

  const VIEWS = ['ontdek', 'avatar', 'winkel', 'vrienden', 'records', 'profiel'];

  function setView(next) {
    view = next;
    VIEWS.forEach((v) => {
      const node = $('view-' + v);
      if (node) node.hidden = v !== view;
    });
    document.querySelectorAll('[data-view]').forEach((b) => {
      b.classList.toggle('active', b.dataset.view === view);
    });
    if (view === 'vrienden') paintFriends();
    if (view === 'records') paintRecords();
    if (view === 'avatar') paintAvatar();
    if (view === 'winkel') paintShop();
    if (view === 'profiel') {
      $('setSound').checked = SB.getSettings(store).sound;
      $('setMotion').checked = SB.getSettings(store).reduceMotion;
    }
    if (view === 'ontdek') paintGrid();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ───────────────────────── events ────────────────────────── */

  function wire() {
    document.querySelectorAll('[data-view]').forEach((t) => {
      t.onclick = () => setView(t.dataset.view);
    });

    // zoeken
    $('search').addEventListener('input', (e) => {
      query = e.target.value.trim();
      if (view !== 'ontdek') setView('ontdek');
      paintGrid();
    });

    // hero
    $('heroPlay').onclick = () => { root.location.href = Lib.path($('heroPlay').dataset.id); };
    $('heroMore').onclick = () => openDetail($('heroMore').dataset.id);
    $('heroPrev').onclick = () => {
      heroIndex = (heroIndex - 1 + Lib.featured().length) % Lib.featured().length;
      paintHero(); restartHeroTimer();
    };
    $('heroNext').onclick = () => {
      heroIndex = (heroIndex + 1) % Lib.featured().length;
      paintHero(); restartHeroTimer();
    };

    // detail
    $('dPlay').onclick = () => { root.location.href = Lib.path($('dPlay').dataset.id); };

    // beloning
    $('giftBtn').onclick = () => { paintGift(); openModal('giftModal'); };
    $('claimReward').onclick = () => {
      const r = SB.claimDaily(store);
      if (r.claimed) {
        $('rewardMsg').textContent = '🎉 +' + r.coins + ' muntjes! Reeks: ' + r.streak + ' dagen.';
        if (J) J.confetti({ count: 90, life: 2 });
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
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModals(); });

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
      if (J) J.confetti({ count: 110, life: 2.2 });
      paintTop();
      showAuthPane('login');
    };

    $('logOut').onclick = () => {
      root.SBAuth.logout(store);
      paintTop();
      showAuthPane('login');
    };

    $('goDashboard').onclick = () => { root.location.href = 'dashboard.html'; };
    $('goDashboard2').onclick = () => { root.location.href = 'dashboard.html'; };

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

    // avatar
    $('avSave').onclick = () => {
      const name = root.SBAuth.cleanName($('avProfileName').value) || 'Speler';
      SB.saveProfile(store, { name: name });
      $('avOk').textContent = '✅ Opgeslagen!';
      paintTop();
      paintAvatar();
      if (J) J.ripple($('avFigure'));
      root.setTimeout(() => { $('avOk').textContent = ''; }, 2200);
    };

    // instellingen
    $('setSound').onchange = (e) => SB.saveSettings(store, { sound: e.target.checked });
    $('setMotion').onchange = (e) => SB.saveSettings(store, { reduceMotion: e.target.checked });

    $('resetData').onclick = () => {
      if (!root.confirm('Alle muntjes, records en je profiel wissen? Dit kan niet terug.')) return;
      SB.wipe(store);
      root.location.reload();
    };

    // vrienden
    $('addFriend').onclick = () => {
      const r = SB.addFriend(store, $('friendName').value, EMOJIS[Math.floor(Math.random() * EMOJIS.length)]);
      $('friendErr').textContent = r.ok ? '' : (r.reason === 'bestaat al' ? 'Die vriend heb je al.' : 'Vul een naam in.');
      if (r.ok) {
        $('friendName').value = '';
        paintFriends();
        paintTop();
        if (J) J.confetti({ count: 60, life: 1.4 });
      }
    };
    $('friendName').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('addFriend').click(); });
  }

  /* ───────────────────────── start ─────────────────────────── */

  function init() {
    // Eerste bezoek: geef een klein startkapitaal zodat de winkel niet leeg voelt.
    if (SB.read(store, SB.KEY.coins, null) === null) SB.addCoins(store, 100);
    wire();
    paintCats();
    paintHero();
    restartHeroTimer();
    paintGrid();
    paintTop();

    // index.html#winkel opent meteen die tab (gebruikt door profile.html)
    const hash = String(root.location.hash || '').replace('#', '');
    if (VIEWS.indexOf(hash) !== -1) setView(hash);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(typeof self !== 'undefined' ? self : globalThis);
