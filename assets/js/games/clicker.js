/**
 * Munt Clicker
 * Klik om munten te slaan, koop upgrades, laat automaten het werk doen.
 *
 * Eerlijk ontwerp: munten die je hier slaat gaan echt naar je SpaceBlox-saldo,
 * en je score is wat je in deze beurt geslagen hebt. De beurt eindigt als je
 * op "Incasseren" drukt — dan wordt je saldo bijgeschreven.
 */
(function (root) {
  'use strict';
  root.SBGames = root.SBGames || {};

  const UPGRADES = [
    { id: 'hands', icon: '🧤', name: 'Betere handschoenen', desc: '+1 per klik', base: 25, mult: 1.7, kind: 'click', step: 1 },
    { id: 'hammer', icon: '🔨', name: 'Munthamer', desc: '+4 per klik', base: 120, mult: 1.8, kind: 'click', step: 4 },
    { id: 'press', icon: '⚙️', name: 'Muntpers', desc: '+2 per seconde', base: 90, mult: 1.65, kind: 'auto', step: 2 },
    { id: 'robot', icon: '🤖', name: 'Muntrobot', desc: '+12 per seconde', base: 650, mult: 1.7, kind: 'auto', step: 12 },
    { id: 'fabriek', icon: '🏭', name: 'Muntfabriek', desc: '+70 per seconde', base: 4200, mult: 1.75, kind: 'auto', step: 70 },
  ];

  root.SBGames.clicker = function (ctx) {
    let minted, perClick, perSec, owned, floaters, wrap, coinEl, rateEl, shopEl, cashBtn, tickAcc;

    function cost(u) {
      return Math.floor(u.base * Math.pow(u.mult, owned[u.id] || 0));
    }

    function recalc() {
      perClick = 1;
      perSec = 0;
      UPGRADES.forEach((u) => {
        const n = owned[u.id] || 0;
        if (u.kind === 'click') perClick += u.step * n;
        else perSec += u.step * n;
      });
    }

    function paintHud() {
      ctx.hud([
        { icon: '🪙', label: 'Geslagen', value: Math.floor(minted) },
        { icon: '👆', label: 'Per klik', value: perClick },
        { icon: '⏱️', label: 'Per sec', value: perSec },
      ]);
    }

    function renderShop() {
      shopEl.innerHTML = '';
      UPGRADES.forEach((u) => {
        const n = owned[u.id] || 0;
        const price = cost(u);
        const afford = minted >= price;
        const row = ctx.el('button', {
          class: 'cl-up' + (afford ? '' : ' locked'),
          type: 'button',
          disabled: afford ? null : 'disabled',
        }, [
          ctx.el('span', { class: 'cl-up-icon', text: u.icon }),
          ctx.el('span', { class: 'cl-up-text' }, [
            ctx.el('b', { text: u.name + (n ? ' ×' + n : '') }),
            ctx.el('i', { text: u.desc }),
          ]),
          ctx.el('span', { class: 'cl-up-cost', text: price + ' 🪙' }),
        ]);
        row.onclick = () => buy(u);
        shopEl.appendChild(row);
      });
    }

    function buy(u) {
      const price = cost(u);
      if (minted < price) { ctx.sound('hit'); return; }
      minted -= price;
      owned[u.id] = (owned[u.id] || 0) + 1;
      recalc();
      ctx.sound('coin');
      paint();
    }

    function paint() {
      coinEl.textContent = Math.floor(minted).toLocaleString('nl-NL');
      rateEl.textContent = perSec ? '+' + perSec + ' per seconde' : 'Klik om te slaan';
      cashBtn.disabled = minted < 1;
      cashBtn.textContent = '💰 Incasseren (' + Math.floor(minted) + ' 🪙)';
      paintHud();
      renderShop();
    }

    function addClick(ev) {
      minted += perClick;
      ctx.sound('coin');
      if (ev) {
        const r = ctx.stage.getBoundingClientRect();
        floaters.push({
          x: ((ev.clientX || r.left + r.width / 2) - r.left) / r.width * 100,
          y: ((ev.clientY || r.top + r.height / 2) - r.top) / r.height * 100,
          life: 0.8,
          text: '+' + perClick,
        });
      }
      paint();
    }

    function update(dt) {
      if (perSec) {
        minted += perSec * dt;
        tickAcc += dt;
        if (tickAcc > 0.25) { tickAcc = 0; paint(); }
      }
      for (let i = floaters.length - 1; i >= 0; i--) {
        floaters[i].life -= dt;
        if (floaters[i].life <= 0) floaters.splice(i, 1);
      }
      // de zwevende +N'tjes leven in de DOM, dus alleen bijwerken als er iets is
      if (floaters.length || floatLayer.childNodes.length) renderFloats();
    }

    let floatLayer;
    function renderFloats() {
      floatLayer.innerHTML = floaters.map((f) =>
        '<span style="left:' + f.x.toFixed(1) + '%;top:' + f.y.toFixed(1) +
        '%;opacity:' + Math.max(0, f.life).toFixed(2) + '">' + f.text + '</span>').join('');
    }

    function cashOut() {
      const total = Math.floor(minted);
      if (total < 1) return;
      // De munten gaan hier rechtstreeks naar het saldo; de shell hoeft dat
      // dus niet nog eens te doen (vandaar coins: 0).
      SB.addCoins(localStorage, total);
      ctx.onEnd({ score: total, coins: 0, won: true });
    }

    function init() {
      if (!wrap) {
        wrap = ctx.el('div', { class: 'sb-dom-game cl-wrap' });

        const clicker = ctx.el('div', { class: 'cl-clicker' });
        coinEl = ctx.el('div', { class: 'cl-coin', text: '0' });
        rateEl = ctx.el('div', { class: 'cl-rate', text: 'Klik om te slaan' });
        const pad = ctx.el('button', { class: 'cl-pad', type: 'button', 'aria-label': 'Munt slaan', text: '🪙' });
        pad.onclick = (e) => addClick(e);
        floatLayer = ctx.el('div', { class: 'cl-floats' });
        clicker.appendChild(pad);
        clicker.appendChild(floatLayer);
        wrap.appendChild(clicker);
        wrap.appendChild(coinEl);
        wrap.appendChild(rateEl);

        shopEl = ctx.el('div', { class: 'cl-shop' });
        wrap.appendChild(shopEl);

        cashBtn = ctx.el('button', { class: 'sb-btn sb-btn-gold', type: 'button', text: '💰 Incasseren' });
        cashBtn.onclick = cashOut;
        wrap.appendChild(cashBtn);

        ctx.stage.appendChild(wrap);
      }
      reset();
    }

    function reset() {
      minted = 0;
      owned = {};
      floaters = [];
      tickAcc = 0;
      recalc();
      paint();
    }

    return {
      init: init,
      reset: reset,
      update: update,
      onAction(t) { if (t === 'down') addClick(null); },
    };
  };
})(typeof self !== 'undefined' ? self : globalThis);
