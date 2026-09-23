/**
 * Memory Match
 * Zoek paren. Score = 200 − beurten, dus hoe minder gokken hoe hoger de score.
 * Drie bordgroottes: 4×3, 4×4 en 6×4.
 */
(function (root) {
  'use strict';
  root.SBGames = root.SBGames || {};

  const EMOJI = ['🐶', '🐱', '🦊', '🐸', '🐵', '🦁', '🐼', '🐨', '🦄', '🐙', '🦋', '🐢'];

  const SIZES = {
    makkelijk: { cols: 4, rows: 3 },
    normaal: { cols: 4, rows: 4 },
    lastig: { cols: 6, rows: 4 },
  };

  root.SBGames.memory = function (ctx) {
    const J = root.SBJuice;
    let size, cards, first, second, lock, moves, matches, boardEl, pickerEl;

    function shuffled(n) {
      const a = [];
      for (let i = 0; i < n; i++) a.push(i);
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = a[i]; a[i] = a[j]; a[j] = t;
      }
      return a;
    }

    function paintHud() {
      ctx.hud([
        { icon: '🃏', label: 'Beurten', value: moves },
        { icon: '✅', label: 'Paren', value: matches + '/' + cards.length / 2 },
        { icon: '🎚️', label: 'Bord', value: size },
      ]);
    }

    function flip(i) {
      if (lock) return;
      const card = cards[i];
      if (card.done || card.el.classList.contains('up')) return;

      card.el.classList.add('up');
      ctx.sound('tap');

      if (first === null) { first = i; return; }
      second = i;
      moves++;
      lock = true;
      paintHud();

      const a = cards[first];
      const b = cards[second];

      if (a.face === b.face) {
        ctx.after(() => {
          a.el.classList.add('done');
          b.el.classList.add('done');
          a.done = b.done = true;
          matches++;
          first = second = null;
          lock = false;
          ctx.sound('coin');
          if (J) { J.bounce(a.el); J.bounce(b.el); }
          paintHud();
          if (matches === cards.length / 2) finish();
        }, 320);
      } else {
        // "wrong" laat de kaarten even schudden; de animatie staat in memory.css
        a.el.classList.add('wrong');
        b.el.classList.add('wrong');
        ctx.after(() => {
          [a.el, b.el].forEach((el) => { el.classList.remove('up', 'wrong'); });
          first = second = null;
          lock = false;
        }, 760);
      }
    }

    function finish() {
      // Minder beurten = meer punten. Minimum 10 zodat verliezen ook telt.
      const perfect = cards.length / 2;
      const score = Math.max(10, 200 - (moves - perfect) * 8 + perfect * 4);
      if (J) J.confetti({ count: 120, life: 2.4 });
      ctx.after(() => ctx.onEnd({ score: score, won: true }), 500);
    }

    function build(name) {
      size = name || 'normaal';
      const cfg = SIZES[size] || SIZES.normaal;
      const pairs = (cfg.cols * cfg.rows) / 2;
      const faces = EMOJI.slice(0, pairs);
      const deck = shuffled(pairs * 2).map((i) => faces[i % pairs]);

      first = second = null;
      lock = false;
      moves = 0;
      matches = 0;
      cards = [];

      boardEl.innerHTML = '';
      boardEl.style.setProperty('--cols', cfg.cols);
      deck.forEach((face, i) => {
        const el = ctx.el('button', { class: 'mem-card', type: 'button', 'aria-label': 'kaart ' + (i + 1) }, [
          ctx.el('span', { class: 'mem-back', text: '❔' }),
          ctx.el('span', { class: 'mem-face', text: face }),
        ]);
        el.onclick = () => flip(i);
        boardEl.appendChild(el);
        cards.push({ face: face, el: el, done: false });
      });
      paintHud();
    }

    let built = false;

    function init() {
      if (!built) {
        built = true;
        const wrap = ctx.el('div', { class: 'sb-dom-game mem-wrap' });
        pickerEl = ctx.el('div', { class: 'mem-picker' });
        Object.keys(SIZES).forEach((name) => {
          const b = ctx.el('button', {
            class: 'pong-lvl' + (name === 'normaal' ? ' on' : ''),
            type: 'button',
            text: name,
          });
          b.onclick = () => {
            ctx.sound('tap');
            pickerEl.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
            build(name);
          };
          pickerEl.appendChild(b);
        });
        boardEl = ctx.el('div', { class: 'mem-board' });
        wrap.appendChild(pickerEl);
        wrap.appendChild(boardEl);
        ctx.stage.appendChild(wrap);
      }
      build('normaal');
    }

    return { init: init, reset: () => build(size) };
  };
})(typeof self !== 'undefined' ? self : globalThis);
