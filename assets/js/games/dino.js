/**
 * Dino Runner
 * Eindeloze renner: spring over cactussen, buk onder vogels.
 * Snelheid en hindernisafstand lopen op met de afstand.
 */
(function (root) {
  'use strict';
  root.SBGames = root.SBGames || {};

  root.SBGames.dino = function (ctx) {
    const g = ctx.ctx2d;
    const W = ctx.logical.w;
    const H = ctx.logical.h;

    const GROUND = H - 46;
    const GRAVITY = 2600;
    const JUMP_V = -900;
    const DUCK_H = 26;
    const RUN_H = 44;
    const DINO_W = 34;

    let dino, obstacles, clouds, speed, dist, alive, spawnIn, legPhase, started;

    function reset() {
      dino = { y: GROUND - RUN_H, vy: 0, duck: false, onGround: true };
      obstacles = [];
      clouds = [
        { x: 120, y: 40 }, { x: 340, y: 70 }, { x: 540, y: 30 },
      ];
      speed = 320;
      dist = 0;
      alive = true;
      started = false;
      spawnIn = 1.2;
      legPhase = 0;
      paintHud();
      draw();
    }

    function paintHud() {
      ctx.hud([
        { icon: '📏', label: 'Meter', value: Math.floor(dist) },
        { icon: '⚡', label: 'Snelheid', value: Math.round(speed / 40) },
      ]);
    }

    function spawn() {
      const r = Math.random();
      // Pas vanaf 200 meter komen er vogels, anders is het niet te doen.
      if (dist > 200 && r < 0.3) {
        const heights = [GROUND - 70, GROUND - 46, GROUND - 26];
        obstacles.push({
          kind: 'bird',
          x: W + 30,
          y: heights[Math.floor(Math.random() * heights.length)],
          w: 40, h: 26,
        });
      } else {
        const n = 1 + Math.floor(Math.random() * Math.min(3, 1 + dist / 250));
        for (let i = 0; i < n; i++) {
          const tall = Math.random() < 0.35;
          obstacles.push({
            kind: 'cactus',
            x: W + 30 + i * 26,
            y: GROUND - (tall ? 52 : 34),
            w: tall ? 20 : 16,
            h: tall ? 52 : 34,
          });
        }
      }
    }

    function jump() {
      if (!alive) return;
      if (!dino.onGround) return;
      dino.vy = JUMP_V;
      dino.onGround = false;
      dino.duck = false;
      ctx.sound('jump');
    }

    function setDuck(on) {
      if (!alive || !dino.onGround) return;
      dino.duck = on;
    }

    function overlaps(a, b) {
      return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }

    function dinoBox() {
      const h = dino.duck ? DUCK_H : RUN_H;
      // Kleinere hitbox dan de tekening: voelt eerlijker.
      return { x: 8, y: dino.y + (dino.duck ? RUN_H - DUCK_H : 0) + 5, w: DINO_W - 10, h: h - 8 };
    }

    function update(dt) {
      if (!alive) return;
      if (!started) { draw(); return; }

      speed = Math.min(760, 320 + dist * 0.28);
      dist += speed * dt * 0.1;
      legPhase += dt * (dino.onGround ? 14 : 0);

      dino.vy += GRAVITY * dt;
      dino.y += dino.vy * dt;
      const floorY = GROUND - (dino.duck ? DUCK_H : RUN_H);
      if (dino.y >= floorY) {
        dino.y = floorY;
        dino.vy = 0;
        dino.onGround = true;
      }

      spawnIn -= dt;
      if (spawnIn <= 0) {
        spawn();
        // Afstand tussen groepen: hoe sneller, hoe meer ruimte nodig.
        spawnIn = (0.75 + Math.random() * 0.6) * (520 / speed) + 0.15;
      }

      for (let i = obstacles.length - 1; i >= 0; i--) {
        const o = obstacles[i];
        o.x -= speed * dt * (o.kind === 'bird' ? 1.25 : 1);
        if (o.x + o.w < -20) obstacles.splice(i, 1);
      }

      clouds.forEach((c) => {
        c.x -= speed * dt * 0.15;
        if (c.x < -60) { c.x = W + 60; c.y = 20 + Math.random() * 60; }
      });

      const db = dinoBox();
      for (const o of obstacles) {
        if (overlaps(db, o)) {
          alive = false;
          ctx.sound('lose');
          ctx.onEnd({ score: Math.floor(dist) });
          break;
        }
      }
      paintHud();
      draw();
    }

    function draw() {
      g.fillStyle = '#0a0a12';
      g.fillRect(0, 0, W, H);

      // wolken
      g.fillStyle = 'rgba(255,255,255,0.09)';
      clouds.forEach((c) => {
        g.beginPath();
        g.arc(c.x, c.y, 13, 0, Math.PI * 2);
        g.arc(c.x + 15, c.y + 4, 10, 0, Math.PI * 2);
        g.arc(c.x - 14, c.y + 5, 9, 0, Math.PI * 2);
        g.fill();
      });

      // grond
      g.strokeStyle = 'rgba(255,255,255,0.28)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(0, GROUND);
      g.lineTo(W, GROUND);
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.12)';
      const scroll = (dist * 6) % 40;
      for (let x = -scroll; x < W; x += 40) g.fillRect(x, GROUND + 8, 16, 2);

      // hindernissen
      obstacles.forEach((o) => {
        if (o.kind === 'cactus') {
          g.fillStyle = '#00c853';
          g.fillRect(o.x, o.y, o.w, o.h);
          g.fillRect(o.x - 6, o.y + o.h * 0.3, 6, o.h * 0.35);
          g.fillRect(o.x + o.w, o.y + o.h * 0.45, 6, o.h * 0.3);
        } else {
          const flap = Math.sin(legPhase * 2) > 0;
          g.fillStyle = '#ffab40';
          g.fillRect(o.x + 8, o.y + 8, 24, 12);
          g.fillRect(o.x + 28, o.y + 10, 10, 6);
          g.beginPath();
          if (flap) { g.moveTo(o.x + 12, o.y + 8); g.lineTo(o.x + 24, o.y - 6); g.lineTo(o.x + 26, o.y + 8); }
          else { g.moveTo(o.x + 12, o.y + 20); g.lineTo(o.x + 24, o.y + 32); g.lineTo(o.x + 26, o.y + 20); }
          g.fill();
        }
      });

      // dino
      const h = dino.duck ? DUCK_H : RUN_H;
      const bodyY = dino.duck ? GROUND - DUCK_H : dino.y;
      g.fillStyle = alive ? '#00e676' : '#ff5252';
      if (dino.duck) {
        g.fillRect(6, GROUND - DUCK_H + 4, DINO_W + 6, DUCK_H - 4);
        g.fillRect(DINO_W - 2, GROUND - DUCK_H - 6, 18, 14);
      } else {
        g.fillRect(10, bodyY + 12, DINO_W - 8, 22);
        g.fillRect(20, bodyY, 20, 16);
        g.fillRect(36, bodyY + 4, 6, 6);
        // poten wisselen tijdens het rennen
        const legUp = Math.sin(legPhase) > 0;
        g.fillRect(14, bodyY + 34, 6, dino.onGround ? (legUp ? 6 : 10) : 8);
        g.fillRect(26, bodyY + 34, 6, dino.onGround ? (legUp ? 10 : 6) : 8);
      }
      g.fillStyle = '#04150c';
      g.fillRect(dino.duck ? DINO_W + 8 : 32, (dino.duck ? GROUND - DUCK_H - 2 : bodyY + 5), 3, 3);

      if (!started) {
        g.fillStyle = 'rgba(255,255,255,0.75)';
        g.font = '600 16px Fredoka, sans-serif';
        g.textAlign = 'center';
        g.fillText('Druk op spatie of tik om te rennen', W / 2, H / 2 - 20);
        g.textAlign = 'left';
      }
    }

    return {
      init: reset,
      reset: reset,
      update: update,
      onAction(t) {
        if (t === 'down') {
          if (!started) started = true;
          jump();
        }
        if (t === 'up') setDuck(false);
      },
      onDir(d) {
        if (d === 'down') { if (!started) started = true; setDuck(true); }
        if (d === 'up') { if (!started) started = true; jump(); }
      },
    };
  };
})(typeof self !== 'undefined' ? self : globalThis);
