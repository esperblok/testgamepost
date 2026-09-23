/**
 * Pong Duo
 * Eerste tot 7 wint. Drie moeilijkheidsgraden; de computer mist vaker naarmate
 * hij makkelijker staat, zodat het eerlijk blijft voor jonge spelers.
 */
(function (root) {
  'use strict';
  root.SBGames = root.SBGames || {};

  const TARGET = 7;
  const LEVELS = {
    makkelijk: { speed: 0.55, react: 0.055, error: 46 },
    normaal:   { speed: 0.78, react: 0.085, error: 24 },
    knotsgek:  { speed: 1.0,  react: 0.13,  error: 8 },
  };

  root.SBGames.pong = function (ctx) {
    const g = ctx.ctx2d;
    const W = ctx.logical.w;
    const H = ctx.logical.h;
    const PAD_H = 74;
    const PAD_W = 11;

    let level, cfg, playerY, cpuY, ball, scoreP, scoreC, serveIn, rally, over, cpuTarget;

    function reset() {
      level = 'normaal';
      cfg = LEVELS[level];
      scoreP = 0;
      scoreC = 0;
      rally = 0;
      over = false;
      playerY = H / 2 - PAD_H / 2;
      cpuY = H / 2 - PAD_H / 2;
      cpuTarget = H / 2;
      serve(1);
      paintHud();
      draw();
    }

    function serve(dir) {
      rally = 0;
      serveIn = 0.9;
      ball = {
        x: W / 2,
        y: H / 2,
        vx: 250 * dir,
        vy: (Math.random() * 160 - 80),
        r: 7,
      };
    }

    function paintHud() {
      ctx.hud([
        { icon: '🙂', label: 'Jij', value: scoreP },
        { icon: '🤖', label: 'Computer', value: scoreC },
        { icon: '🔁', label: 'Rally', value: rally },
      ]);
    }

    function point(byPlayer) {
      if (byPlayer) { scoreP++; ctx.sound('win'); }
      else { scoreC++; ctx.sound('hit'); }
      paintHud();
      if (scoreP >= TARGET || scoreC >= TARGET) {
        over = true;
        // Score = winnend verschil × 10 + rally-punten, zodat verliezen ook telt.
        const margin = Math.abs(scoreP - scoreC);
        const score = scoreP * 20 + (scoreP >= TARGET ? margin * 10 : 0);
        ctx.onEnd({ score: score, won: scoreP >= TARGET });
        return;
      }
      serve(byPlayer ? -1 : 1);
    }

    function update(dt) {
      if (over) { draw(); return; }

      if (serveIn > 0) { serveIn -= dt; draw(); return; }

      // speler volgt muis/vinger of pijltjes
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      if (ball.y - ball.r < 0) { ball.y = ball.r; ball.vy = Math.abs(ball.vy); ctx.sound('tap'); }
      if (ball.y + ball.r > H) { ball.y = H - ball.r; ball.vy = -Math.abs(ball.vy); ctx.sound('tap'); }

      // computer richt zich op de bal maar mist bewust bij 'error'
      const wanted = ball.y + (cpuTarget - H / 2);
      cpuY += (wanted - (cpuY + PAD_H / 2)) * cfg.react * 60 * dt;
      cpuY = Math.max(0, Math.min(H - PAD_H, cpuY));

      // botsing met paddles
      const hitLeft = ball.x - ball.r < 22 + PAD_W && ball.x > 12 &&
        ball.y > playerY && ball.y < playerY + PAD_H && ball.vx < 0;
      const hitRight = ball.x + ball.r > W - 22 - PAD_W && ball.x < W - 12 &&
        ball.y > cpuY && ball.y < cpuY + PAD_H && ball.vx > 0;

      if (hitLeft || hitRight) {
        const padY = hitLeft ? playerY : cpuY;
        const offset = (ball.y - (padY + PAD_H / 2)) / (PAD_H / 2); // -1..1
        rally++;
        const base = Math.min(620, Math.abs(ball.vx) * 1.05 + 18);
        ball.vx = (hitLeft ? 1 : -1) * base;
        ball.vy = offset * 340;
        ball.x = hitLeft ? 22 + PAD_W + ball.r : W - 22 - PAD_W - ball.r;
        cpuTarget = H / 2 + (Math.random() * 2 - 1) * cfg.error * 4;
        ctx.sound('eat');
        paintHud();
      }

      if (ball.x < -20) point(false);
      else if (ball.x > W + 20) point(true);

      draw();
    }

    function draw() {
      g.fillStyle = '#0a0a12';
      g.fillRect(0, 0, W, H);

      // middenlijn
      g.strokeStyle = 'rgba(255,255,255,0.13)';
      g.lineWidth = 3;
      g.setLineDash([10, 12]);
      g.beginPath();
      g.moveTo(W / 2, 0);
      g.lineTo(W / 2, H);
      g.stroke();
      g.setLineDash([]);

      // paddles
      g.fillStyle = '#00c8ff';
      g.fillRect(12, playerY, PAD_W, PAD_H);
      g.fillStyle = '#ff4081';
      g.fillRect(W - 12 - PAD_W, cpuY, PAD_W, PAD_H);

      // bal
      g.fillStyle = '#fff';
      g.beginPath();
      g.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
      g.fill();

      // tussenstand groot in beeld
      g.fillStyle = 'rgba(255,255,255,0.08)';
      g.font = '700 72px Fredoka, sans-serif';
      g.textAlign = 'center';
      g.fillText(String(scoreP), W / 2 - 60, H / 2 + 24);
      g.fillText(String(scoreC), W / 2 + 60, H / 2 + 24);
      g.textAlign = 'left';

      if (serveIn > 0) {
        g.fillStyle = 'rgba(255,255,255,0.6)';
        g.font = '600 15px Fredoka, sans-serif';
        g.textAlign = 'center';
        g.fillText('Klaar?', W / 2, H - 26);
        g.textAlign = 'left';
      }
    }

    function setLevel(name) {
      if (!LEVELS[name]) return;
      level = name;
      cfg = LEVELS[name];
      picker.querySelectorAll('[data-level]').forEach((b) => {
        b.classList.toggle('on', b.dataset.level === name);
      });
      scoreP = 0;
      scoreC = 0;
      playerY = H / 2 - PAD_H / 2;
      cpuY = H / 2 - PAD_H / 2;
      serve(1);
      paintHud();
    }

    // Moeilijkheidskeuze onder in het veld; blijft zichtbaar tijdens het spel.
    const picker = ctx.el('div', { class: 'pong-picker' });
    Object.keys(LEVELS).forEach((name) => {
      const b = ctx.el('button', {
        class: 'pong-lvl' + (name === 'normaal' ? ' on' : ''),
        'data-level': name,
        text: name,
      });
      b.onclick = () => { ctx.sound('tap'); setLevel(name); };
      picker.appendChild(b);
    });
    ctx.stage.appendChild(picker);

    const api = {
      init: reset,
      reset: reset,
      update: update,
      setLevel: setLevel,
      onDir(d) {
        const step = 44;
        if (d === 'up') playerY = Math.max(0, playerY - step);
        if (d === 'down') playerY = Math.min(H - PAD_H, playerY + step);
      },
      onAxis(x, y) {
        if (Math.abs(y) > 0.1) playerY = Math.max(0, Math.min(H - PAD_H, playerY + y * 26));
      },
    };

    // muis/vinger bestuurt de paddle direct — voelt het fijnst
    ctx.stage.addEventListener('pointermove', (e) => {
      const rect = ctx.canvas.getBoundingClientRect();
      const rel = (e.clientY - rect.top) / (rect.height || 1);
      playerY = Math.max(0, Math.min(H - PAD_H, rel * H - PAD_H / 2));
    });

    return api;
  };
})(typeof self !== 'undefined' ? self : globalThis);
