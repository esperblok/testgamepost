/**
 * Neon Rush
 * Eindeloze snelweg met steeds drukker verkeer. Score = afgelegde meters.
 * Eén aanraking is einde, dus het draait om anticiperen.
 */
(function (root) {
  'use strict';
  root.SBGames = root.SBGames || {};

  root.SBGames.racer = function (ctx) {
    const g = ctx.ctx2d;
    const J = root.SBJuice;
    const W = ctx.logical.w;
    const H = ctx.logical.h;

    const LANES = 3;
    const ROAD_L = 54;
    const ROAD_R = W - 54;
    const LANE_W = (ROAD_R - ROAD_L) / LANES;
    const CAR_W = 42;
    const CAR_H = 74;

    const fx = J.fx(g, { w: W, h: H });

    let x, targetX, traffic, dist, speed, alive, spawnIn, stripe, boost, boostT, nearMiss;

    function laneX(i) {
      return ROAD_L + LANE_W * i + LANE_W / 2;
    }

    function reset() {
      x = laneX(1);
      targetX = x;
      traffic = [];
      dist = 0;
      speed = 280;
      alive = true;
      spawnIn = 0.8;
      stripe = 0;
      boost = [];
      boostT = 0;
      nearMiss = 0;
      fx.clear();
      paintHud();
      draw();
    }

    function paintHud() {
      ctx.hud([
        { icon: '📏', label: 'Meter', value: Math.floor(dist) },
        { icon: '⚡', label: 'Snelheid', value: Math.round(speed / 20) + ' km/u' },
        { icon: '😅', label: 'Glippers', value: nearMiss },
      ]);
    }

    function move(dir) {
      if (!alive) return;
      const cur = Math.round((targetX - ROAD_L - LANE_W / 2) / LANE_W);
      const next = dir === 'left' ? cur - 1 : cur + 1;
      if (next < 0 || next >= LANES) return;
      targetX = laneX(next);
      ctx.sound('tap');
    }

    function update(dt) {
      fx.update(dt);
      if (!alive) { draw(); return; }

      speed = Math.min(760, 280 + dist * 0.22);
      dist += speed * dt * 0.1;
      stripe = (stripe + speed * dt) % 60;

      // soepel naar de doellane glijden
      x += (targetX - x) * Math.min(1, dt * 14);

      spawnIn -= dt;
      if (spawnIn <= 0) {
        const lane = Math.floor(Math.random() * LANES);
        // Nooit alle lanes tegelijk blokkeren: minstens één moet vrij blijven.
        const blocked = traffic.filter((c) => c.y < 120).map((c) => c.lane);
        const free = [0, 1, 2].filter((l) => !blocked.includes(l));
        if (free.length > 1 || !blocked.length) {
          traffic.push({
            lane: lane,
            x: laneX(lane),
            y: -CAR_H,
            v: speed * (0.45 + Math.random() * 0.25),
            hue: Math.floor(Math.random() * 360),
          });
        }
        spawnIn = Math.max(0.32, (0.95 - dist * 0.0004)) * (0.7 + Math.random() * 0.6);
      }

      // boost-pad
      boostT -= dt;
      if (boostT <= 0 && Math.random() < 0.4) {
        boost.push({ lane: Math.floor(Math.random() * LANES), y: -30 });
        boostT = 3.5;
      }

      const playerTop = H - CAR_H - 26;
      const playerBox = { x: x - CAR_W / 2 + 5, y: playerTop + 6, w: CAR_W - 10, h: CAR_H - 12 };

      for (let i = traffic.length - 1; i >= 0; i--) {
        const c = traffic[i];
        c.y += (speed - c.v) * dt;
        if (c.y > H + 40) {
          traffic.splice(i, 1);
          continue;
        }
        const box = { x: c.x - CAR_W / 2 + 5, y: c.y + 6, w: CAR_W - 10, h: CAR_H - 12 };
        const hit = playerBox.x < box.x + box.w && playerBox.x + playerBox.w > box.x &&
                    playerBox.y < box.y + box.h && playerBox.y + playerBox.h > box.y;
        if (hit) {
          alive = false;
          ctx.sound('lose');
          fx.shake(18);
          fx.burst(x, H - CAR_H / 2 - 26, {
            colors: ['#00c8ff', '#ff5252', '#ffd200', '#ffffff'],
            count: 40, speed: 320, life: 0.9, size: 5,
          });
          fx.ring(x, H - CAR_H / 2 - 26, { color: '#ff5252', r1: 110, life: 0.5 });
          ctx.onEnd({ score: Math.floor(dist) + nearMiss * 5 });
          return;
        }
        // rakelings langs = bonuspunt, beloont dicht op elkaar rijden
        const gap = Math.abs(c.x - x);
        if (!c.counted && c.y > playerTop && gap < LANE_W * 0.95 && gap > CAR_W * 0.6) {
          c.counted = true;
          nearMiss++;
          ctx.sound('coin');
          fx.spark(x, playerTop + 20, { colors: ['#ffd200', '#ffffff'], count: 12, speed: 260 });
          fx.pop(x, playerTop - 12, 'GLIPPER +5', { color: '#ffd200', size: 17 });
          paintHud();
        }
      }

      for (let i = boost.length - 1; i >= 0; i--) {
        const b = boost[i];
        b.y += speed * dt;
        if (b.y > H + 30) { boost.splice(i, 1); continue; }
        if (Math.abs(laneX(b.lane) - x) < LANE_W * 0.5 && b.y > playerTop - 10 && b.y < playerTop + CAR_H) {
          boost.splice(i, 1);
          dist += 25;
          ctx.sound('coin');
          fx.burst(laneX(b.lane), b.y, { colors: ['#ffd200', '#ffffff'], count: 22, speed: 240, life: 0.6 });
          fx.pop(x, playerTop - 30, 'BOOST +25 m', { color: '#ffd200', size: 20 });
          fx.shake(4);
          paintHud();
        }
      }

      // uitlaat van de eigen auto
      fx.trail(x - 12, H - 22, { color: 'rgba(160,220,255,0.8)', size: 4, life: 0.22 });
      fx.trail(x + 12, H - 22, { color: 'rgba(160,220,255,0.8)', size: 4, life: 0.22 });

      paintHud();
      draw();
    }

    function car(cxp, top, color, glow) {
      g.fillStyle = color;
      if (glow) { g.shadowColor = color; g.shadowBlur = 14; }
      g.beginPath();
      if (g.roundRect) g.roundRect(cxp - CAR_W / 2, top, CAR_W, CAR_H, 9);
      else g.rect(cxp - CAR_W / 2, top, CAR_W, CAR_H);
      g.fill();
      g.shadowBlur = 0;
      // raam
      g.fillStyle = 'rgba(10,10,18,0.75)';
      g.fillRect(cxp - CAR_W / 2 + 6, top + 14, CAR_W - 12, 18);
      // koplampen
      g.fillStyle = 'rgba(255,255,220,0.85)';
      g.fillRect(cxp - CAR_W / 2 + 4, top + CAR_H - 6, 8, 4);
      g.fillRect(cxp + CAR_W / 2 - 12, top + CAR_H - 6, 8, 4);
    }

    function draw() {
      g.fillStyle = J.vgrad(g, 0, H, '#0b0b16', '#050509');
      g.fillRect(0, 0, W, H);

      fx.begin();

      // berm
      g.fillStyle = '#12121c';
      g.fillRect(0, 0, ROAD_L, H);
      g.fillRect(ROAD_R, 0, W - ROAD_R, H);
      g.fillStyle = 'rgba(255,255,255,0.22)';
      g.fillRect(ROAD_L - 3, 0, 3, H);
      g.fillRect(ROAD_R, 0, 3, H);

      // lane-strepen
      g.fillStyle = 'rgba(255,255,255,0.18)';
      for (let l = 1; l < LANES; l++) {
        const lx = ROAD_L + LANE_W * l - 2;
        for (let y = -60 + stripe; y < H; y += 60) g.fillRect(lx, y, 4, 32);
      }

      // boost-pads
      boost.forEach((b) => {
        g.fillStyle = 'rgba(255,210,0,0.28)';
        g.beginPath();
        const bx = laneX(b.lane);
        g.moveTo(bx, b.y - 14);
        g.lineTo(bx + 16, b.y + 14);
        g.lineTo(bx - 16, b.y + 14);
        g.fill();
      });

      // verkeer
      traffic.forEach((c) => car(c.x, c.y, 'hsl(' + c.hue + ',55%,48%)', false));

      // speler
      car(x, H - CAR_H - 26, '#00c8ff', true);

      // lantaarns in de berm schieten voorbij
      g.fillStyle = 'rgba(255,199,0,0.5)';
      for (let y = -60 + stripe * 2; y < H; y += 120) {
        g.fillRect(ROAD_L - 12, y, 4, 12);
        g.fillRect(ROAD_R + 8, y, 4, 12);
      }

      if (!alive) {
        g.fillStyle = 'rgba(255,82,82,0.16)';
        g.fillRect(0, 0, W, H);
      }

      fx.speedLines(J.clamp((speed - 280) / 480, 0, 1), 'rgba(180,230,255,0.4)');
      fx.vignette(0.5);
      fx.end();
    }

    return {
      init: reset,
      reset: reset,
      update: update,
      onDir(d) {
        if (d === 'left') move('left');
        if (d === 'right') move('right');
      },
      onAction(t) {
        if (t === 'down') ctx.sound('tap');
      },
    };
  };
})(typeof self !== 'undefined' ? self : globalThis);
