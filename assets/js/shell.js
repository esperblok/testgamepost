/**
 * SpaceBlox — game-shell
 *
 * De shell is de "Roblox-app" om een spel heen: topbar met profiel en muntjes,
 * HUD, touch-bediening, geluid, game-over-scherm met highscores, en de
 * muntjes-/XP-beloning na elke beurt.
 *
 * Een spel hoeft zelf niets van de chrome te weten. Het registreert zich met
 * een module-functie en krijgt een context-object met het speelveld en de
 * besturing. Zie assets/js/games/snake.js voor een compleet voorbeeld.
 */
(function (root) {
  'use strict';

  const SB = root.SB;
  const Lib = root.SBLib;

  /* ───────────────────────── geluid ────────────────────────── */

  const Sound = (function () {
    let ctx = null;
    let enabled = true;

    function ac() {
      if (ctx) return ctx;
      const Ctor = root.AudioContext || root.webkitAudioContext;
      if (!Ctor) return null;
      try { ctx = new Ctor(); } catch (e) { ctx = null; }
      return ctx;
    }

    /**
     * @param {string} kind een van: tap, eat, hit, win, lose, coin, jump
     */
    function play(kind) {
      if (!enabled) return;
      const a = ac();
      if (!a) return;
      if (a.state === 'suspended') a.resume().catch(function () {});
      const spec = {
        tap:   [520, 0.05, 'square',   0.05],
        eat:   [660, 0.08, 'sine',     0.08],
        hit:   [150, 0.16, 'sawtooth', 0.12],
        jump:  [420, 0.09, 'triangle', 0.07],
        coin:  [880, 0.09, 'square',   0.06],
        win:   [720, 0.30, 'sine',     0.12],
        lose:  [220, 0.35, 'sawtooth', 0.12],
      }[kind] || [440, 0.06, 'sine', 0.06];

      const osc = a.createOscillator();
      const gain = a.createGain();
      osc.type = spec[2];
      osc.frequency.setValueAtTime(spec[0], a.currentTime);
      if (kind === 'coin' || kind === 'win') {
        osc.frequency.exponentialRampToValueAtTime(spec[0] * 1.6, a.currentTime + spec[1]);
      }
      if (kind === 'lose' || kind === 'hit') {
        osc.frequency.exponentialRampToValueAtTime(spec[0] * 0.5, a.currentTime + spec[1]);
      }
      gain.gain.setValueAtTime(spec[3], a.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + spec[1]);
      osc.connect(gain).connect(a.destination);
      osc.start();
      osc.stop(a.currentTime + spec[1] + 0.02);
    }

    return {
      play: play,
      setEnabled(v) { enabled = !!v; },
      isEnabled() { return enabled; },
    };
  })();

  /* ───────────────────────── invoer ────────────────────────── */

  /**
   * Verzamelt toetsenbord + touch in één abonnement. Een spel krijgt een
   * richting ('up'|'down'|'left'|'right'), een actie ('primary') of een as
   * ({x, y} tussen -1 en 1 voor analoge pads/sticks).
   */
  function Input(stage, opts) {
    const o = opts || {};
    const listeners = { dir: [], action: [], axis: [], key: [] };
    const held = new Set();
    const axis = { x: 0, y: 0 };
    let padTouchId = null;
    let padOrigin = null;

    function emitDir(d) { listeners.dir.forEach((f) => f(d)); }
    function emitAction(type, ev) { listeners.action.forEach((f) => f(type, ev)); }
    function emitAxis() { listeners.axis.forEach((f) => f(axis.x, axis.y)); }
    // 'key' vertelt of een richting nog steeds ingedrukt is; spellen die
    // moeten kunnen stilstaan (platformers) hebben dat nodig.
    function emitKey(d, down) { listeners.key.forEach((f) => f(d, down)); }

    const KEYMAP = {
      ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
      w: 'up', s: 'down', a: 'left', d: 'right',
      W: 'up', S: 'down', A: 'left', D: 'right',
    };

    function onKeyDown(e) {
      const dir = KEYMAP[e.key];
      if (dir) {
        // Pijltjes scrollen de pagina; dat willen we niet tijdens het spelen.
        e.preventDefault();
        if (e.repeat) return;
        emitDir(dir);
        emitKey(dir, true);
      }
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (e.repeat) return;
        held.add('primary');
        emitAction('down', e);
      }
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') emitAction('pause', e);
    }

    function onKeyUp(e) {
      const dir = KEYMAP[e.key];
      if (dir) emitKey(dir, false);
      if (e.key === ' ' || e.key === 'Enter') {
        held.delete('primary');
        emitAction('up', e);
      }
    }

    // Verliest het venster de focus dan blijven toetsen "hangen"; dan alles loslaten.
    function onBlur() {
      ['up', 'down', 'left', 'right'].forEach((d) => emitKey(d, false));
      if (held.delete('primary')) emitAction('up', null);
    }

    function onTouchStart(e) {
      if (!o.touch) return;
      const t = e.changedTouches[0];
      padTouchId = t.identifier;
      padOrigin = { x: t.clientX, y: t.clientY };
    }

    function onTouchMove(e) {
      if (!o.touch || padTouchId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier !== padTouchId) continue;
        const dx = t.clientX - padOrigin.x;
        const dy = t.clientY - padOrigin.y;
        const len = Math.hypot(dx, dy) || 1;
        const n = Math.min(1, len / 40);
        axis.x = (dx / len) * n;
        axis.y = (dy / len) * n;
        emitAxis();
        if (len > 24) {
          if (Math.abs(dx) > Math.abs(dy)) emitDir(dx > 0 ? 'right' : 'left');
          else emitDir(dy > 0 ? 'down' : 'up');
        }
        e.preventDefault();
      }
    }

    function onTouchEnd() {
      padTouchId = null;
      axis.x = 0; axis.y = 0;
      emitAxis();
    }

    document.addEventListener('keydown', onKeyDown, { passive: false });
    document.addEventListener('keyup', onKeyUp);
    root.addEventListener('blur', onBlur);
    if (o.touch && stage) {
      stage.addEventListener('touchstart', onTouchStart, { passive: true });
      stage.addEventListener('touchmove', onTouchMove, { passive: false });
      stage.addEventListener('touchend', onTouchEnd);
      stage.addEventListener('touchcancel', onTouchEnd);
    }

    return {
      onDir(f) { listeners.dir.push(f); },
      onAction(f) { listeners.action.push(f); },
      onAxis(f) { listeners.axis.push(f); },
      onKey(f) { listeners.key.push(f); },
      isHeld(k) { return held.has(k); },
      axis: axis,
      destroy() {
        document.removeEventListener('keydown', onKeyDown);
        document.removeEventListener('keyup', onKeyUp);
        root.removeEventListener('blur', onBlur);
      },
    };
  }

  /* ───────────────────────── canvas ────────────────────────── */

  /**
   * Maakt een canvas die scherp blijft op hoge-DPI-schermen en meeschaalt met
   * zijn container. Spellen tekenen altijd in logische pixels (w×h).
   */
  function makeCanvas(host, logicalW, logicalH) {
    const canvas = document.createElement('canvas');
    canvas.className = 'sb-canvas';
    host.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const view = { w: logicalW, h: logicalH, dpr: 1 };

    function resize() {
      const dpr = Math.min(root.devicePixelRatio || 1, 2);
      const rect = host.getBoundingClientRect();
      const scale = Math.min(rect.width / logicalW, rect.height / logicalH) || 1;
      const cssW = Math.round(logicalW * scale);
      const cssH = Math.round(logicalH * scale);
      canvas.style.width = cssW + 'px';
      canvas.style.height = cssH + 'px';
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      ctx.setTransform((canvas.width / logicalW), 0, 0, (canvas.height / logicalH), 0, 0);
      view.dpr = dpr;
    }

    resize();
    return { canvas: canvas, ctx: ctx, view: view, resize: resize };
  }

  /* ───────────────────────── DOM-hulp ──────────────────────── */

  function el(tag, attrs, kids) {
    const n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach((k) => {
      const v = attrs[k];
      // null/undefined overslaan: setAttribute(k, null) zet de letterlijke
      // string "null", en dat maakte elke "disabled: null" knop alsnog grijs.
      if (v === null || v === undefined) return;
      if (k === 'class') n.className = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), v);
      else if (k === 'text') n.textContent = v;
      else if (k === 'disabled') n.disabled = !!v;   // property, geen attribuut
      else n.setAttribute(k, v);
    });
    (Array.isArray(kids) ? kids : kids ? [kids] : []).forEach((c) => {
      if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return n;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* ───────────────────────── de shell ──────────────────────── */

  function Shell(gameDef, mount) {
    const store = root.localStorage;
    const settings = SB.getSettings(store);
    Sound.setEnabled(settings.sound);

    let module = null;
    let running = false;
    let paused = false;
    let ended = false;
    let rafId = null;
    let lastTs = 0;
    let input = null;
    let stage = null;
    let hudNodes = {};
    let sessionScore = 0;

    /* ── chrome bouwen ── */

    function buildChrome() {
      const profile = SB.getProfile(store);
      const user = root.SBAuth ? root.SBAuth.currentUser(store) : null;
      const level = SB.getLevel(store);
      const board = SB.getBoard(store, gameDef.id);
      const best = SB.getBest(store, gameDef.id);

      const topbar = el('header', { class: 'sb-topbar' }, [
        el('a', { class: 'sb-logo', href: '../index.html' }, [
          el('span', { class: 'sb-logo-mark', text: '⬛' }),
          el('span', { text: 'SpaceBlox' }),
        ]),
        el('div', { class: 'sb-topbar-right' }, [
          el('div', { class: 'sb-chip sb-coins', title: 'Muntjes' }, [
            el('span', { text: '🪙' }),
            el('span', { class: 'sb-coin-count', text: SB.formatCoins(SB.getCoins(store)) }),
          ]),
          el('div', { class: 'sb-chip sb-level', title: 'Level ' + level.level }, [
            el('span', { text: '⭐' }),
            el('span', { text: 'Lv ' + level.level }),
          ]),
          el('a', {
            class: 'sb-chip sb-avatar',
            href: '../profile.html',
            title: user ? user.name : profile.name,
            text: user ? '👑' : profile.emoji,
          }),
        ]),
      ]);

      // spelkop toont de Roblox-thumbnail als die er is, anders de gradient+emoji
      const headGrad = 'linear-gradient(135deg,' + gameDef.grad[0] + ',' + gameDef.grad[1] + ')';
      const headStyle = gameDef.thumb
        ? 'background-image:url(../' + gameDef.thumb + '),' + headGrad +
          ';background-size:cover,cover;background-position:center,center;'
        : 'background:' + headGrad;

      const head = el('div', { class: 'sb-head' }, [
        el('div', { class: 'sb-head-icon', style: headStyle, text: gameDef.thumb ? '' : gameDef.icon }),
        el('div', { class: 'sb-head-text' }, [
          el('h1', { text: gameDef.name }),
          el('p', { text: gameDef.tagline }),
        ]),
        el('div', { class: 'sb-head-best' }, [
          el('span', { class: 'sb-label', text: 'Record' }),
          el('span', { class: 'sb-value', text: best.value ? best.value + ' ' + gameDef.unit : '—' }),
        ]),
      ]);

      stage = el('div', { class: 'sb-stage', id: 'sb-stage' });
      const hud = el('div', { class: 'sb-hud' });
      stage.appendChild(hud);
      hudNodes.root = hud;

      const touch = el('div', { class: 'sb-touch' }, [
        el('button', { class: 'sb-tbtn', 'data-dir': 'left', text: '◀', 'aria-label': 'naar links' }),
        el('button', { class: 'sb-tbtn sb-tbtn-primary', 'data-action': 'primary', text: '▲', 'aria-label': 'actie' }),
        el('button', { class: 'sb-tbtn', 'data-dir': 'right', text: '▶', 'aria-label': 'naar rechts' }),
      ]);
      if (!gameDef.touches) touch.style.display = 'none';

      const controls = el('div', { class: 'sb-controls' }, [
        el('button', { class: 'sb-btn sb-btn-ghost', id: 'sb-btn-restart', text: '🔄 Opnieuw' }),
        el('button', { class: 'sb-btn sb-btn-ghost', id: 'sb-btn-sound', text: settings.sound ? '🔊 Geluid' : '🔇 Stil' }),
        el('button', { class: 'sb-btn sb-btn-ghost', id: 'sb-btn-board', text: '🏆 Scores' }),
      ]);

      const info = el('div', { class: 'sb-info' }, [
        el('span', { text: gameDef.desc }),
        el('span', { class: 'sb-info-keys', text: 'Pijltjes / WASD bewegen • Spatie actie • P pauze' }),
      ]);

      const wrap = el('div', { class: 'sb-page' }, [topbar, head, stage, touch, controls, info]);
      mount.appendChild(wrap);
      buildOverlay();

      controls.querySelector('#sb-btn-restart').onclick = () => { Sound.play('tap'); restart(); };
      controls.querySelector('#sb-btn-sound').onclick = (e) => {
        const next = !Sound.isEnabled();
        Sound.setEnabled(next);
        SB.saveSettings(store, { sound: next });
        e.currentTarget.textContent = next ? '🔊 Geluid' : '🔇 Stil';
        if (next) Sound.play('tap');
      };
      controls.querySelector('#sb-btn-board').onclick = () => { Sound.play('tap'); openBoard(); };

      if (gameDef.touches) {
        touch.querySelectorAll('[data-dir]').forEach((b) => {
          b.addEventListener('pointerdown', (e) => { e.preventDefault(); input && emitTouchDir(b.dataset.dir); });
        });
        const prim = touch.querySelector('[data-action]');
        prim.addEventListener('pointerdown', (e) => { e.preventDefault(); input && emitTouchAction('down'); });
        prim.addEventListener('pointerup', () => { input && emitTouchAction('up'); });
      }
    }

    function emitTouchDir(d) { touchDir.forEach((f) => f(d)); }
    function emitTouchAction(t) { touchAction.forEach((f) => f(t)); }
    let touchDir = [];
    let touchAction = [];

    /* ── overlay (game over / scores / pauze) ── */

    let overlay, overlayBody;
    function buildOverlay() {
      overlay = el('div', { class: 'sb-overlay', id: 'sb-overlay' });
      overlayBody = el('div', { class: 'sb-modal' });
      overlay.appendChild(overlayBody);
      overlay.addEventListener('click', (e) => { if (e.target === overlay) closeOverlay(); });
      document.body.appendChild(overlay);
    }

    function closeOverlay() {
      overlay.classList.remove('open');
      overlayBody.innerHTML = '';
    }

    function openBoard() {
      const board = SB.getBoard(store, gameDef.id);
      const best = SB.getBest(store, gameDef.id);
      overlayBody.innerHTML =
        '<h2>🏆 ' + esc(gameDef.name) + '</h2>' +
        '<p class="sb-modal-sub">Jouw record: <strong>' + (best.value || 0) + ' ' + esc(gameDef.unit) + '</strong></p>' +
        (board.length
          ? '<ol class="sb-board">' + board.map((e, i) =>
              '<li' + (e.name === SB.getProfile(store).name ? ' class="me"' : '') + '>' +
              '<span class="rk">' + (i + 1) + '</span>' +
              '<span class="nm">' + esc(e.name) + '</span>' +
              '<span class="vl">' + e.value + '</span></li>').join('') + '</ol>'
          : '<p class="sb-empty">Nog geen scores. Speel een beurt!</p>') +
        '<button class="sb-btn sb-btn-primary" data-close>Sluiten</button>';
      overlayBody.querySelector('[data-close]').onclick = closeOverlay;
      overlay.classList.add('open');
    }

    function openGameOver(result) {
      const board = SB.getBoard(store, gameDef.id);
      overlayBody.innerHTML =
        '<h2>' + (result.won ? '🎉 Gewonnen!' : '💀 Game over') + '</h2>' +
        '<div class="sb-final">' +
          '<span class="sb-final-num">' + result.score + '</span>' +
          '<span class="sb-final-unit">' + esc(gameDef.unit) + '</span>' +
        '</div>' +
        (result.improved ? '<div class="sb-badge-new">✨ Nieuw record!</div>' : '') +
        (result.coins > 0 ? '<div class="sb-coins-earned">+' + result.coins + ' 🪙 verdiend</div>' : '') +
        '<ol class="sb-board">' + board.map((e, i) =>
          '<li><span class="rk">' + (i + 1) + '</span><span class="nm">' + esc(e.name) + '</span><span class="vl">' + e.value + '</span></li>').join('') + '</ol>' +
        '<div class="sb-modal-actions">' +
          '<button class="sb-btn sb-btn-primary" data-again>🔄 Opnieuw</button>' +
          '<button class="sb-btn sb-btn-ghost" data-home>🎮 Meer games</button>' +
        '</div>';
      overlayBody.querySelector('[data-again]').onclick = () => { closeOverlay(); restart(); };
      overlayBody.querySelector('[data-home]').onclick = () => { root.location.href = '../index.html'; };
      overlay.classList.add('open');
      // Focus op "opnieuw" zodat enter meteen werkt.
      const again = overlayBody.querySelector('[data-again]');
      if (again) again.focus();
    }

    /* ── API voor het spel ── */

    function hud(items) {
      // items: [{label, value, icon}]
      hudNodes.root.innerHTML = items.map((it) =>
        '<span class="sb-hud-item"><em>' + (it.icon ? esc(it.icon) + ' ' : '') + esc(it.label) + '</em>' +
        '<b>' + esc(String(it.value)) + '</b></span>').join('');
      return hudNodes.root;
    }

    function endGame(opts) {
      if (ended) return;
      ended = true;
      running = false;
      stopLoop();
      const o = opts || {};
      const score = Math.floor(Number(o.score) || 0);
      sessionScore = score;
      const name = SB.getProfile(store).name;
      const res = SB.submitScore(store, gameDef.id, score, name);
      // Een spel dat zelf al munten uitkeert (Munt Clicker) geeft coins: 0 mee,
      // anders zouden we dubbel uitbetalen.
      const coins = o.coins === undefined ? SB.coinsForScore(score) : Math.floor(o.coins);
      if (coins > 0) SB.addCoins(store, coins);
      SB.bumpStat(store, 'plays', 1);
      SB.bumpStat(store, 'xp', Math.max(1, Math.floor(score / 10)));
      Sound.play(o.won ? 'win' : 'lose');
      const coinNode = document.querySelector('.sb-coin-count');
      if (coinNode) coinNode.textContent = SB.formatCoins(SB.getCoins(store));
      openGameOver({ score: score, improved: res.improved, coins: coins, won: !!o.won });
    }

    function setPaused(v) {
      paused = !!v;
      if (module && module.onPause) module.onPause(paused);
      stage.classList.toggle('paused', paused);
      if (!paused) { lastTs = 0; startLoop(); } else stopLoop();
    }

    /* ── lus ── */

    function frame(ts) {
      if (!running || paused) return;
      const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0.016;
      lastTs = ts;
      if (module && module.update) module.update(dt);
      if (module && module.render) module.render();
      rafId = root.requestAnimationFrame(frame);
    }

    function startLoop() {
      if (rafId) return;
      rafId = root.requestAnimationFrame(frame);
    }

    function stopLoop() {
      if (rafId) { root.cancelAnimationFrame(rafId); rafId = null; }
    }

    /* ── opstarten ── */

    function start() {
      buildChrome();
      input = Input(stage, { touch: gameDef.touches });
      input.onDir((d) => { if (module && module.onDir) module.onDir(d); });
      input.onKey((d, down) => { if (module && module.onKey) module.onKey(d, down); });
      input.onAxis((ax, ay) => { if (module && module.onAxis) module.onAxis(ax, ay); });
      input.onAction((t) => {
        if (t === 'pause') { setPaused(!paused); return; }
        if (module && module.onAction) module.onAction(t);
      });
      // De on-screen knoppen gaan via dezelfde handlers als het toetsenbord,
      // zodat een spel niet twee keer dezelfde gebeurtenis binnenkrijgt.
      touchDir.push((d) => {
        if (module && module.onDir) module.onDir(d);
        if (module && module.onKey) module.onKey(d, true);
        // Een tik op de knop is even "ingedrukt"; na 140 ms weer los.
        root.setTimeout(() => { if (module && module.onKey) module.onKey(d, false); }, 140);
      });
      touchAction.push((t) => { if (module && module.onAction) module.onAction(t); });

      const canvasKit = gameDef.render === 'canvas'
        ? makeCanvas(stage, gameDef.width || 480, gameDef.height || 480)
        : null;

      const ctx = {
        stage: stage,
        el: el,
        canvas: canvasKit ? canvasKit.canvas : null,
        ctx2d: canvasKit ? canvasKit.ctx : null,
        resizeCanvas: canvasKit ? canvasKit.resize : null,
        logical: canvasKit ? { w: gameDef.width || 480, h: gameDef.height || 480 } : null,
        hud: hud,
        sound: Sound.play,
        /** setTimeout-wrapper; spellen hoeven dan niet zelf root aan te raken. */
        after: (fn, ms) => root.setTimeout(fn, ms),
        coins: SB.getCoins(store),
        profile: SB.getProfile(store),
        onEnd: endGame,
        isPaused: () => paused,
      };

      module = root.SBGames && root.SBGames[gameDef.id];
      if (!module) {
        stage.appendChild(el('div', { class: 'sb-missing', html:
          '<h2>🚧 ' + esc(gameDef.name) + '</h2><p>Deze game is nog niet klaar.</p>' }));
        return;
      }
      if (typeof module === 'function') module = module(ctx);
      if (module.init) module.init(ctx);

      document.addEventListener('visibilitychange', () => {
        if (document.hidden && running && !paused && module && module.autoPause !== false) setPaused(true);
      });

      running = true;
      startLoop();
    }

    function restart() {
      ended = false;
      paused = false;
      stopLoop();
      closeOverlay();
      stage.classList.remove('paused');
      if (module && module.reset) module.reset();
      else if (module && module.init) module.init();
      running = true;
      lastTs = 0;
      startLoop();
    }

    return { start: start, restart: restart, sound: Sound };
  }

  /* ───────────────────────── bootstrap ─────────────────────── */

  /**
   * Start de shell voor één game. Leest de game-id uit <body data-game="...">
   * of uit ?g= in de URL.
   */
  function boot() {
    const fromUrl = new URLSearchParams(root.location.search).get('g');
    const fromBody = document.body && document.body.dataset ? document.body.dataset.game : null;
    const id = fromBody || fromUrl;
    const def = Lib.byId(id);
    const mount = document.getElementById('app') || document.body;

    if (!def) {
      mount.innerHTML =
        '<div class="sb-page"><div class="sb-missing"><h2>🤔 Onbekende game</h2>' +
        '<p>Er is geen spel met id "' + esc(String(id)) + '".</p>' +
        '<a class="sb-btn sb-btn-primary" href="../index.html">🎮 Terug naar alle games</a></div></div>';
      return;
    }

    document.title = def.icon + ' ' + def.name + ' — SpaceBlox';
    const shell = Shell(def, mount);
    shell.start();
    root.SBShell = shell;
  }

  root.SBShellKit = { boot: boot, Shell: Shell, Sound: Sound, Input: Input, makeCanvas: makeCanvas, el: el, esc: esc };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof self !== 'undefined' ? self : globalThis);
