/**
 * Maan Kolonie
 * Overleef 30 dagen op de maan. Elke dag produceren je gebouwen zuurstof,
 * energie en voedsel; je kolonisten verbruiken dat weer. Komt er iets tekort,
 * dan vallen er doden.
 *
 * De spanning zit in de groei: elke 3 dagen komen er kolonisten bij, dus je
 * verbruik stijgt terwijl je credits maar langzaam binnenkomen. Te vroeg
 * uitbreiden is net zo dodelijk als te laat.
 */
(function (root) {
  'use strict';
  root.SBGames = root.SBGames || {};

  const GOAL = 30;

  const BUILDINGS = [
    { id: 'solar',  icon: '☀️', name: 'Zonnepaneel',      cost: 40, prod: { energy: 4 } },
    { id: 'oxygen', icon: '💨', name: 'Zuurstofgenerator', cost: 55, prod: { oxygen: 3 } },
    { id: 'farm',   icon: '🌾', name: 'Kas',               cost: 50, prod: { food: 3 } },
    { id: 'dome',   icon: '🏠', name: 'Koepel',            cost: 75, prod: {}, pop: 4 },
    { id: 'mine',   icon: '⛏️', name: 'Mijn',              cost: 90, prod: { credits: 22 } },
  ];

  const EVENTS = [
    { id: 'storm', text: '🌪️ Zandstorm! Een zonnepaneel is stuk.', fn: (s) => breakOne(s, 'solar'), minDay: 4 },
    { id: 'meteor', text: '☄️ Meteoor! Een gebouw is verwoest.', fn: (s) => breakAny(s), minDay: 6 },
    { id: 'ship', text: '🚀 Bevoorradingsschip: +80 credits.', fn: (s) => { s.credits += 80; }, minDay: 3 },
    { id: 'bonus', text: '✨ Goed moreel: +10 van alles.', fn: (s) => { s.oxygen += 10; s.energy += 10; s.food += 10; }, minDay: 2 },
    { id: 'leak', text: '🕳️ Lek in een koepel: −15 zuurstof.', fn: (s) => { s.oxygen = Math.max(0, s.oxygen - 15); }, minDay: 5 },
  ];

  root.SBGames.moon = function (ctx) {
    const J = root.SBJuice;
    let s, wrap, resEl, popEl, creditEl, dayEl, gridEl, shopEl, logEl, nextBtn;

    function startState() {
      return {
        day: 1,
        credits: 110,
        oxygen: 22, energy: 22, food: 22,
        pop: 4, cap: 5,
        built: { solar: 1, oxygen: 1, farm: 1, dome: 0, mine: 0 },
        alive: true,
        log: ['🌙 Dag 1 — je basis staat. Succes.'],
      };
    }

    function production() {
      const out = { oxygen: 0, energy: 0, food: 0, credits: 10 };
      BUILDINGS.forEach((b) => {
        const n = s.built[b.id] || 0;
        Object.keys(b.prod).forEach((k) => { out[k] += b.prod[k] * n; });
      });
      // Een mijn draait op energie: zonder stroom geen credits.
      if (out.energy <= 0) out.credits = 10;
      return out;
    }

    function consumption() {
      return { oxygen: s.pop, energy: Math.ceil(s.pop * 0.6), food: s.pop };
    }

    function breakOne(st, id) {
      if ((st.built[id] || 0) > 0) st.built[id]--;
    }
    function breakAny(st) {
      const ids = BUILDINGS.map((b) => b.id).filter((id) => (st.built[id] || 0) > 0);
      if (ids.length) breakOne(st, ids[Math.floor(Math.random() * ids.length)]);
    }

    function paintHud() {
      ctx.hud([
        { icon: '📅', label: 'Dag', value: s.day + '/' + GOAL },
        { icon: '👥', label: 'Kolonisten', value: s.pop + '/' + s.cap },
        { icon: '💳', label: 'Credits', value: s.credits },
      ]);
    }

    function meter(icon, label, value, need) {
      const bad = value < need;
      const n = ctx.el('div', { class: 'mn-res' + (bad ? ' bad' : '') });
      n.appendChild(ctx.el('span', { class: 'mn-ico', text: icon }));
      const txt = ctx.el('span', { class: 'mn-txt' });
      txt.appendChild(ctx.el('b', { text: String(value) }));
      txt.appendChild(ctx.el('i', { text: label + ' (−' + need + '/dag)' }));
      n.appendChild(txt);
      return n;
    }

    function paint() {
      const prod = production();
      const cons = consumption();
      resEl.innerHTML = '';
      resEl.appendChild(meter('💨', 'Zuurstof', s.oxygen, cons.oxygen));
      resEl.appendChild(meter('⚡', 'Energie', s.energy, cons.energy));
      resEl.appendChild(meter('🍞', 'Voedsel', s.food, cons.food));
      popEl.textContent = '👥 ' + s.pop + ' / ' + s.cap + ' plekken';
      creditEl.textContent = '💳 ' + s.credits + ' credits  •  +' + prod.credits + '/dag';
      dayEl.textContent = '📅 Dag ' + s.day + ' van ' + GOAL;

      gridEl.innerHTML = '';
      BUILDINGS.forEach((b) => {
        const n = s.built[b.id] || 0;
        if (!n) return;
        for (let i = 0; i < n; i++) {
          gridEl.appendChild(ctx.el('span', { class: 'mn-cell', text: b.icon, title: b.name }));
        }
      });
      if (!gridEl.children.length) gridEl.appendChild(ctx.el('span', { class: 'mn-none', text: 'nog geen gebouwen' }));

      shopEl.innerHTML = '';
      BUILDINGS.forEach((b) => {
        const afford = s.credits >= b.cost;
        const row = ctx.el('button', {
          class: 'cl-up' + (afford ? '' : ' locked'),
          type: 'button',
          disabled: afford && s.alive ? null : 'disabled',
        }, [
          ctx.el('span', { class: 'cl-up-icon', text: b.icon }),
          ctx.el('span', { class: 'cl-up-text' }, [
            ctx.el('b', { text: b.name + ' ×' + (s.built[b.id] || 0) }),
            ctx.el('i', {
              text: Object.keys(b.prod).length
                ? Object.keys(b.prod).map((k) => '+' + b.prod[k] + ' ' + k).join(', ') + '/dag'
                : '+' + b.pop + ' kolonist-plekken',
            }),
          ]),
          ctx.el('span', { class: 'cl-up-cost', text: b.cost + ' 💳' }),
        ]);
        row.onclick = () => build(b);
        shopEl.appendChild(row);
      });

      logEl.innerHTML = '';
      s.log.slice(0, 7).forEach((line, i) => {
        logEl.appendChild(ctx.el('li', { class: i === 0 ? 'fresh' : '', text: line }));
      });

      nextBtn.disabled = !s.alive;
      paintHud();
    }

    function build(b) {
      if (s.credits < b.cost || !s.alive) return;
      s.credits -= b.cost;
      s.built[b.id] = (s.built[b.id] || 0) + 1;
      if (b.pop) s.cap += b.pop;
      ctx.sound('coin');
      s.log.unshift('🔨 ' + b.name + ' gebouwd.');
      paint();
    }

    function nextDay() {
      if (!s.alive) return;
      const prod = production();
      const cons = consumption();

      s.oxygen += prod.oxygen - cons.oxygen;
      s.energy += prod.energy - cons.energy;
      s.food += prod.food - cons.food;
      s.credits += prod.credits;

      const dead = [];
      if (s.oxygen < 0) { dead.push('zuurstof'); s.oxygen = 0; }
      if (s.energy < 0) { dead.push('energie'); s.energy = 0; }
      if (s.food < 0) { dead.push('voedsel'); s.food = 0; }
      if (dead.length) {
        const lost = Math.min(s.pop, 1 + dead.length - 1);
        s.pop = Math.max(0, s.pop - lost);
        s.log.unshift('☠️ Tekort aan ' + dead.join(' en ') + ': ' + lost + ' kolonist(en) verloren.');
        ctx.sound('lose');
      }

      // om de 3 dagen komen er kolonisten bij, zolang er plek is
      if (s.day % 3 === 0 && s.pop < s.cap) {
        const arriving = Math.min(2, s.cap - s.pop);
        s.pop += arriving;
        s.log.unshift('🚀 ' + arriving + ' nieuwe kolonist(en) gearriveerd.');
      }

      // willekeurige gebeurtenis, ~45% kans vanaf dag 2
      if (s.day >= 2 && Math.random() < 0.45) {
        const pool = EVENTS.filter((e) => s.day >= e.minDay);
        if (pool.length) {
          const ev = pool[Math.floor(Math.random() * pool.length)];
          ev.fn(s);
          s.log.unshift(ev.text);
        }
      }

      s.day++;
      ctx.sound('tap');

      if (s.pop <= 0) {
        s.alive = false;
        paint();
        ctx.after(() => ctx.onEnd({ score: (s.day - 1) * 10, won: false }), 700);
        return;
      }
      if (s.day > GOAL) {
        s.alive = false;
        paint();
        if (J) J.confetti({ count: 140, life: 2.6 });
        ctx.after(() => ctx.onEnd({ score: GOAL * 10 + s.pop * 5, won: true }), 700);
        return;
      }
      paint();
    }

    function init() {
      if (!wrap) {
        wrap = ctx.el('div', { class: 'sb-dom-game mn-wrap' });
        dayEl = ctx.el('div', { class: 'mn-day' });
        resEl = ctx.el('div', { class: 'mn-resources' });
        popEl = ctx.el('div', { class: 'mn-pop' });
        creditEl = ctx.el('div', { class: 'mn-credits' });
        gridEl = ctx.el('div', { class: 'mn-grid' });
        shopEl = ctx.el('div', { class: 'cl-shop' });
        logEl = ctx.el('ul', { class: 'mn-log' });
        nextBtn = ctx.el('button', { class: 'sb-btn sb-btn-primary', type: 'button', text: '🌅 Volgende dag' });
        nextBtn.onclick = nextDay;
        [dayEl, resEl, popEl, creditEl, gridEl, shopEl, nextBtn, logEl].forEach((n) => wrap.appendChild(n));
        ctx.stage.appendChild(wrap);
      }
      s = startState();
      paint();
    }

    return { init: init, reset: init, onAction() {} };
  };
})(typeof self !== 'undefined' ? self : globalThis);
