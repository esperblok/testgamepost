/**
 * Orlog — dobbelduel
 * Je speelt drie rondes tegen de computer. Per beurt dobbel je, leg je dobbel-
 * stenen vast en zet je tokens in op een aanval. Wie eerst de andere op 0
 * leven krijgt wint de ronde.
 *
 * Tokens:
 *   🗡 zwaard    schade = aantal zwaarden
 *   🛡 schild    blokkeert schade, 1 per schild
 *   🪓 bijl      dubbele zwaardschade
 *   ❤ levenssteen  +1 leven voor jou, −1 voor de vijand
 *   ⚡ dief      steelt 2 tokens van de vijand
 */
(function (root) {
  'use strict';
  root.SBGames = root.SBGames || {};

  const START_HP = 20;
  const MAX_ROUNDS = 3;
  const REROLLS = 2;

  // Zes zijden: hoeveel van elk symbool er op één dobbelsteen staat is vast,
  // zodat het spel eerlijk en voorspelbaar blijft.
  const FACES = ['🗡', '🛡', '🪓', '🗡', '⚡', '❤'];
  const TOKEN_POOL = ['🗡', '🛡', '🪓', '❤', '⚡'];

  root.SBGames.orlog = function (ctx) {
    let hpP, hpE, tokensP, tokensE, dice, held, rerolls, phase, round, winsP, winsE;
    let wrap, hpPEl, hpEEl, diceEl, poolEl, logEl, tokenPEl, tokenEEl, actionEl;

    function roll() {
      dice = [];
      for (let i = 0; i < 6; i++) dice.push({ face: FACES[Math.floor(Math.random() * 6)], held: false });
    }

    function paintHud() {
      ctx.hud([
        { icon: '🏆', label: 'Rondes', value: winsP + '–' + winsE },
        { icon: '🎲', label: 'Ronde', value: round + '/' + MAX_ROUNDS },
        { icon: '🔁', label: 'Herworp', value: rerolls },
      ]);
    }

    function tokenLine(pool) {
      if (!Object.keys(pool).length) return ctx.el('span', { class: 'ol-empty', text: 'geen tokens' });
      const n = ctx.el('div', { class: 'ol-tokens' });
      TOKEN_POOL.forEach((t) => {
        if (pool[t]) n.appendChild(ctx.el('span', { class: 'ol-tok', text: t + '×' + pool[t] }));
      });
      return n;
    }

    function log(msg) {
      logEl.insertBefore(ctx.el('li', { text: msg }), logEl.firstChild);
      while (logEl.children.length > 6) logEl.removeChild(logEl.lastChild);
    }

    function paint() {
      hpPEl.textContent = hpP;
      hpEEl.textContent = hpE;
      hpPEl.parentElement.classList.toggle('low', hpP <= 6);
      hpEEl.parentElement.classList.toggle('low', hpE <= 6);
      tokenPEl.innerHTML = '';
      tokenPEl.appendChild(tokenLine(tokensP));
      tokenEEl.innerHTML = '';
      tokenEEl.appendChild(tokenLine(tokensE));

      diceEl.innerHTML = '';
      dice.forEach((d, i) => {
        const b = ctx.el('button', {
          class: 'ol-die' + (d.held ? ' held' : ''),
          type: 'button',
          disabled: phase !== 'roll' ? 'disabled' : null,
          text: d.face,
          'aria-label': 'dobbelsteen ' + (i + 1),
        });
        b.onclick = () => {
          if (phase !== 'roll') return;
          d.held = !d.held;
          ctx.sound('tap');
          paint();
        };
        diceEl.appendChild(b);
      });

      // inzetknoppen: alleen in de inzetfase
      actionEl.innerHTML = '';
      if (phase === 'roll') {
        actionEl.appendChild(ctx.el('button', {
          class: 'sb-btn sb-btn-primary', type: 'button',
          text: rerolls > 0 ? '🎲 Herwerpen (' + rerolls + ')' : '🎲 Niet meer herwerpen',
          disabled: rerolls > 0 ? null : 'disabled',
          onclick: doReroll,
        }));
        actionEl.appendChild(ctx.el('button', {
          class: 'sb-btn sb-btn-gold', type: 'button', text: '✅ Inzetten', onclick: startAttack,
        }));
      } else if (phase === 'attack') {
        TOKEN_POOL.forEach((t) => {
          const have = tokensP[t] || 0;
          actionEl.appendChild(ctx.el('button', {
            class: 'sb-btn ol-play', type: 'button',
            text: t + ' ×' + have,
            disabled: have > 0 ? null : 'disabled',
            onclick: () => playToken(t),
          }));
        });
      } else if (phase === 'roundover') {
        actionEl.appendChild(ctx.el('button', {
          class: 'sb-btn sb-btn-primary', type: 'button', text: '➡️ Volgende ronde', onclick: nextRound,
        }));
      }
      paintHud();
    }

    function doReroll() {
      if (rerolls <= 0) return;
      rerolls--;
      dice.forEach((d) => {
        if (!d.held) d.face = FACES[Math.floor(Math.random() * 6)];
      });
      ctx.sound('tap');
      paint();
    }

    function startAttack() {
      // Vastgelegde dobbelstenen worden tokens.
      dice.forEach((d) => {
        if (d.held) tokensP[d.face] = (tokensP[d.face] || 0) + 1;
      });
      // De computer dobbelt ook.
      for (let i = 0; i < 6; i++) {
        const f = FACES[Math.floor(Math.random() * 6)];
        tokensE[f] = (tokensE[f] || 0) + 1;
      }
      phase = 'attack';
      log('⚔️ Zet je tokens in!');
      paint();
    }

    function playToken(t) {
      if (phase !== 'attack' || !tokensP[t]) return;
      tokensP[t]--;
      ctx.sound('eat');

      // De vijand verdedigt automatisch met schilden waar dat kan.
      const blockable = () => (tokensE['🛡'] || 0) > 0;
      const useBlock = () => { tokensE['🛡']--; };

      if (t === '🗡') {
        if (blockable()) { useBlock(); log('🛡 Vijand blokkeert je zwaard.'); }
        else { hpE -= 1; log('🗡 1 schade!'); }
      } else if (t === '🪓') {
        if (blockable()) { useBlock(); log('🛡 Vijand blokkeert je bijl.'); }
        else { hpE -= 2; log('🪓 2 schade!'); }
      } else if (t === '❤') {
        hpP = Math.min(START_HP, hpP + 1);
        hpE -= 1;
        log('❤ +1 leven voor jou, −1 voor de vijand.');
      } else if (t === '⚡') {
        const keys = TOKEN_POOL.filter((k) => (tokensE[k] || 0) > 0);
        if (keys.length) {
          const stolen = keys[Math.floor(Math.random() * keys.length)];
          const n = Math.min(2, tokensE[stolen]);
          tokensE[stolen] -= n;
          tokensP[stolen] = (tokensP[stolen] || 0) + n;
          log('⚡ ' + n + '× ' + stolen + ' gestolen!');
        } else log('⚡ Niets te stelen.');
      } else if (t === '🛡') {
        log('🛡 Schild opgelegd (verdedigt straks).');
      }

      hpE = Math.max(0, hpE);
      hpP = Math.max(0, hpP);

      // Heeft de speler nog tokens? Anders is de vijand aan zet.
      const left = TOKEN_POOL.some((k) => (tokensP[k] || 0) > 0);
      if (hpE <= 0 || hpP <= 0) return endRound();
      if (!left) return enemyTurn();
      paint();
    }

    function enemyTurn() {
      // Eenvoudige maar eerlijke AI: eerst aanvallen, dan genezen, dan stelen.
      const order = ['🪓', '🗡', '❤', '⚡', '🛡'];
      order.forEach((t) => {
        while ((tokensE[t] || 0) > 0) {
          tokensE[t]--;
          if (t === '🪓') {
            if ((tokensP['🛡'] || 0) > 0) { tokensP['🛡']--; log('🛡 Jij blokkeert de bijl.'); }
            else { hpP -= 2; log('🪓 Vijand doet 2 schade.'); }
          } else if (t === '🗡') {
            if ((tokensP['🛡'] || 0) > 0) { tokensP['🛡']--; log('🛡 Jij blokkeert het zwaard.'); }
            else { hpP -= 1; log('🗡 Vijand doet 1 schade.'); }
          } else if (t === '❤') {
            hpE = Math.min(START_HP, hpE + 1);
            hpP -= 1;
            log('❤ Vijand geneest en doet 1 schade.');
          } else if (t === '⚡') {
            const keys = TOKEN_POOL.filter((k) => (tokensP[k] || 0) > 0);
            if (keys.length) {
              const st = keys[Math.floor(Math.random() * keys.length)];
              const n = Math.min(2, tokensP[st]);
              tokensP[st] -= n;
              tokensE[st] = (tokensE[st] || 0) + n;
              log('⚡ Vijand steelt ' + n + '× ' + st);
            }
          }
          hpP = Math.max(0, hpP);
          hpE = Math.max(0, hpE);
          if (hpP <= 0 || hpE <= 0) break;
        }
      });
      endRound();
    }

    function endRound() {
      phase = 'roundover';
      if (hpE <= 0 && hpP > 0) { winsP++; log('🎉 Ronde gewonnen!'); ctx.sound('win'); }
      else if (hpP <= 0) { winsE++; log('💀 Ronde verloren.'); ctx.sound('lose'); }
      else { log('🤝 Gelijk — beide blijven staan.'); }

      if (winsP === 2 || winsE === 2 || round >= MAX_ROUNDS) {
        const won = winsP > winsE;
        paint();
        ctx.after(() => ctx.onEnd({
          score: winsP * 60 + hpP * 2 + (won ? 50 : 0),
          won: won,
        }), 900);
        return;
      }
      paint();
    }

    function nextRound() {
      round++;
      startRound();
    }

    function startRound() {
      hpP = START_HP;
      hpE = START_HP;
      tokensP = {};
      tokensE = {};
      rerolls = REROLLS;
      phase = 'roll';
      logEl.innerHTML = '';
      roll();
      log('🎲 Ronde ' + round + ' — leg sterke stenen vast.');
      paint();
    }

    function init() {
      if (!wrap) {
        wrap = ctx.el('div', { class: 'sb-dom-game ol-wrap' });

        const foes = ctx.el('div', { class: 'ol-row' });
        foes.appendChild(ctx.el('span', { class: 'ol-who', text: '🤖 Vijand' }));
        const hpEBox = ctx.el('div', { class: 'ol-hp' }, [ctx.el('b', { text: String(START_HP) })]);
        hpEEl = hpEBox.querySelector('b');
        foes.appendChild(hpEBox);
        tokenEEl = ctx.el('div', { class: 'ol-pool' });
        foes.appendChild(tokenEEl);
        wrap.appendChild(foes);

        diceEl = ctx.el('div', { class: 'ol-dice' });
        wrap.appendChild(diceEl);

        actionEl = ctx.el('div', { class: 'ol-actions' });
        wrap.appendChild(actionEl);

        const me = ctx.el('div', { class: 'ol-row' });
        me.appendChild(ctx.el('span', { class: 'ol-who', text: '🙂 Jij' }));
        const hpPBox = ctx.el('div', { class: 'ol-hp' }, [ctx.el('b', { text: String(START_HP) })]);
        hpPEl = hpPBox.querySelector('b');
        me.appendChild(hpPBox);
        tokenPEl = ctx.el('div', { class: 'ol-pool' });
        me.appendChild(tokenPEl);
        wrap.appendChild(me);

        logEl = ctx.el('ul', { class: 'ol-log' });
        wrap.appendChild(logEl);

        ctx.stage.appendChild(wrap);
      }
      round = 1;
      winsP = 0;
      winsE = 0;
      startRound();
    }

    return { init: init, reset: init, onAction() {} };
  };
})(typeof self !== 'undefined' ? self : globalThis);
