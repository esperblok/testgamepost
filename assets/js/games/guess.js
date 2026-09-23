/**
 * Raad het Getal
 * 1 tot 100, hoger/lager-hints. Score hangt af van hoeveel gokken je nodig had:
 * binair zoeken haalt het in 7, dus dat is de maatstaf.
 */
(function (root) {
  'use strict';
  root.SBGames = root.SBGames || {};

  const MAX = 100;
  const PAR = 7;

  root.SBGames.guess = function (ctx) {
    let secret, guesses, lo, hi, over, wrap, input, listEl, hintEl, btn;

    function build() {
      if (wrap) return;
      wrap = ctx.el('div', { class: 'sb-dom-game guess-wrap' });

      wrap.appendChild(ctx.el('p', { class: 'guess-range', text: 'Ik denk aan een getal tussen 1 en ' + MAX }));

      hintEl = ctx.el('div', { class: 'guess-hint', text: 'Doe je eerste gok!' });
      wrap.appendChild(hintEl);

      const row = ctx.el('div', { class: 'guess-row' });
      input = ctx.el('input', {
        class: 'sb-field guess-input',
        type: 'number',
        min: '1',
        max: String(MAX),
        placeholder: '1 – ' + MAX,
        'aria-label': 'Jouw gok',
      });
      btn = ctx.el('button', { class: 'sb-btn sb-btn-primary', type: 'button', text: 'Raad' });
      row.appendChild(input);
      row.appendChild(btn);
      wrap.appendChild(row);

      const err = ctx.el('p', { class: 'sb-error', id: 'guess-err' });
      wrap.appendChild(err);

      // Snelknoppen halveren het bereik — zo leer je binair zoeken spelenderwijs.
      const quick = ctx.el('div', { class: 'guess-quick' });
      ['50', '25', '75'].forEach((v) => {
        quick.appendChild(ctx.el('button', {
          class: 'sb-btn sb-btn-ghost', type: 'button', text: v,
          onclick: () => { input.value = v; guess(); },
        }));
      });
      wrap.appendChild(quick);

      listEl = ctx.el('ol', { class: 'guess-list' });
      wrap.appendChild(listEl);

      btn.onclick = guess;
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') guess(); });
      ctx.stage.appendChild(wrap);
    }

    function guess() {
      if (over) return;
      const err = wrap.querySelector('#guess-err');
      const raw = parseInt(input.value, 10);
      if (!Number.isFinite(raw) || raw < 1 || raw > MAX) {
        err.textContent = 'Vul een getal tussen 1 en ' + MAX + ' in.';
        return;
      }
      err.textContent = '';
      guesses++;

      const item = ctx.el('li', {}, [
        ctx.el('span', { class: 'g-num', text: String(raw) }),
        ctx.el('span', { class: 'g-tag', text: raw === secret ? '🎯' : raw < secret ? '⬆ hoger' : '⬇ lager' }),
      ]);
      listEl.insertBefore(item, listEl.firstChild);

      if (raw < secret) { lo = Math.max(lo, raw + 1); ctx.sound('tap'); }
      else if (raw > secret) { hi = Math.min(hi, raw - 1); ctx.sound('tap'); }

      if (raw === secret) {
        over = true;
        ctx.sound('win');
        // Par is 7 gokken: beter dan par levert bonus op, slechter kost punten.
        const score = Math.max(10, 160 - (guesses - PAR) * 22);
        hintEl.textContent = '🎯 Het was ' + secret + '!';
        ctx.after(() => ctx.onEnd({ score: score, won: true }), 700);
        return;
      }

      hintEl.textContent = raw < secret
        ? '⬆ Hoger! (tussen ' + lo + ' en ' + hi + ')'
        : '⬇ Lager! (tussen ' + lo + ' en ' + hi + ')';
      input.value = '';
      input.focus();
      paintHud();
    }

    function paintHud() {
      ctx.hud([
        { icon: '🔢', label: 'Gokken', value: guesses },
        { icon: '🎯', label: 'Par', value: PAR },
        { icon: '🔍', label: 'Bereik', value: lo + '–' + hi },
      ]);
    }

    function reset() {
      build();
      secret = 1 + Math.floor(Math.random() * MAX);
      guesses = 0;
      lo = 1;
      hi = MAX;
      over = false;
      listEl.innerHTML = '';
      input.value = '';
      input.disabled = false;
      btn.disabled = false;
      const err = wrap.querySelector('#guess-err');
      if (err) err.textContent = '';
      hintEl.textContent = 'Doe je eerste gok!';
      paintHud();
      ctx.after(() => input.focus(), 120);
    }

    return {
      init: reset,
      reset: reset,
      onAction(t) { if (t === 'down') guess(); },
    };
  };
})(typeof self !== 'undefined' ? self : globalThis);
