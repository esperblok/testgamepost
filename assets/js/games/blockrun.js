/**
 * Block Run
 * Platformer: ren, spring, verzamel kristallen en haal de vlag.
 * Vijf levels die vastzitten in dit bestand, dus geen losse leveldata nodig.
 *
 * Een platform is [x, y, breedte, hoogte]. Kristallen zijn [x, y].
 */
(function (root) {
  'use strict';
  root.SBGames = root.SBGames || {};

  const LEVELS = [
    {
      spawn: [40, 260],
      platforms: [[0, 320, 640, 40], [180, 250, 90, 14], [340, 190, 90, 14], [500, 130, 120, 14]],
      crystals: [[215, 220], [375, 160], [540, 100]],
      flag: [590, 96],
    },
    {
      spawn: [40, 260],
      platforms: [
        [0, 320, 140, 40], [200, 320, 100, 40], [360, 320, 90, 40], [500, 320, 140, 40],
        [150, 240, 80, 14], [300, 180, 80, 14], [450, 120, 90, 14],
      ],
      crystals: [[180, 210], [330, 150], [485, 90], [240, 290]],
      flag: [560, 86],
    },
    {
      spawn: [30, 120],
      platforms: [
        [0, 160, 90, 14], [140, 200, 70, 14], [250, 150, 70, 14], [360, 210, 70, 14],
        [470, 150, 70, 14], [570, 220, 70, 14], [0, 320, 640, 40],
      ],
      crystals: [[170, 170], [280, 120], [390, 180], [500, 120], [600, 190]],
      flag: [600, 300],
    },
    {
      spawn: [40, 260],
      platforms: [
        [0, 320, 120, 40], [520, 320, 120, 40],
        [170, 280, 60, 14], [270, 230, 60, 14], [370, 180, 60, 14], [250, 120, 60, 14],
        [470, 120, 60, 14], [110, 160, 60, 14],
      ],
      crystals: [[200, 250], [300, 200], [400, 150], [280, 90], [500, 90], [140, 130]],
      flag: [575, 286],
    },
    {
      spawn: [30, 100],
      platforms: [
        [0, 140, 70, 14], [110, 190, 60, 14], [210, 140, 60, 14], [310, 190, 60, 14],
        [410, 140, 60, 14], [510, 190, 60, 14], [600, 130, 40, 14],
        [60, 300, 80, 14], [200, 330, 80, 14], [340, 300, 80, 14], [480, 330, 80, 14],
        [0, 360, 640, 40],
      ],
      crystals: [[140, 160], [240, 110], [340, 160], [440, 110], [540, 160], [615, 100], [100, 270], [380, 270]],
      flag: [600, 326],
    },
  ];

  root.SBGames.blockrun = function (ctx) {
    const g = ctx.ctx2d;
    const W = ctx.logical.w;
    const H = ctx.logical.h;
    const GRAVITY = 1500;
    const JUMP_V = -520;
    const RUN = 210;

    let level, p, platforms, crystals, flag, total, done, lives;
    // Ingedrukte toetsen bijhouden: loslaten moet laten stilstaan, anders
    // schuift de speler oneindig door.
    const held = { left: false, right: false };

    function load(i) {
      const L = LEVELS[i];
      level = i;
      p = { x: L.spawn[0], y: L.spawn[1], w: 24, h: 30, vx: 0, vy: 0, onGround: false, face: 1 };
      platforms = L.platforms.map((r) => ({ x: r[0], y: r[1], w: r[2], h: r[3] }));
      crystals = L.crystals.map((c) => ({ x: c[0], y: c[1], got: false }));
      flag = { x: L.flag[0], y: L.flag[1] };
      done = false;
      paintHud();
      draw();
    }

    function reset() {
      total = 0;
      lives = 3;
      load(0);
    }

    function paintHud() {
      const got = crystals.filter((c) => c.got).length;
      ctx.hud([
        { icon: '💎', label: 'Kristallen', value: got + '/' + crystals.length },
        { icon: '🗺️', label: 'Level', value: (level + 1) + '/' + LEVELS.length },
        { icon: '❤️', label: 'Levens', value: lives },
      ]);
    }

    function die() {
      lives--;
      ctx.sound('lose');
      if (lives <= 0) {
        ctx.onEnd({ score: total });
        return;
      }
      const L = LEVELS[level];
      p.x = L.spawn[0];
      p.y = L.spawn[1];
      p.vx = 0;
      p.vy = 0;
    }

    function jump() {
      if (!p.onGround) return;
      p.vy = JUMP_V;
      p.onGround = false;
      ctx.sound('jump');
    }

    function update(dt) {
      if (done) { draw(); return; }

      p.vy += GRAVITY * dt;

      // horizontaal: stuurt terwijl ingedrukt, glijdt anders uit
      const want = (held.right ? 1 : 0) - (held.left ? 1 : 0);
      if (want !== 0) {
        p.vx += (want * RUN - p.vx) * Math.min(1, dt * 16);
        p.face = want;
      } else {
        p.vx *= Math.max(0, 1 - dt * 12);
        if (Math.abs(p.vx) < 4) p.vx = 0;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // wanden
      if (p.x < 0) p.x = 0;
      if (p.x + p.w > W) p.x = W - p.w;

      // uit beeld gevallen
      if (p.y > H + 60) { die(); if (lives <= 0) return; }

      // platformbotsing: alleen landen als je van boven komt
      p.onGround = false;
      for (const pl of platforms) {
        const overlapX = p.x + p.w > pl.x && p.x < pl.x + pl.w;
        if (!overlapX) continue;
        const prevBottom = p.y + p.h - p.vy * dt;
        if (p.vy >= 0 && prevBottom <= pl.y + 6 && p.y + p.h >= pl.y) {
          p.y = pl.y - p.h;
          p.vy = 0;
          p.onGround = true;
        }
      }

      // kristallen
      crystals.forEach((c) => {
        if (c.got) return;
        if (Math.abs(c.x - (p.x + p.w / 2)) < 18 && Math.abs(c.y - (p.y + p.h / 2)) < 20) {
          c.got = true;
          total += 10;
          ctx.sound('coin');
          paintHud();
        }
      });

      // vlag
      if (Math.abs(flag.x - (p.x + p.w / 2)) < 22 && Math.abs(flag.y + 16 - (p.y + p.h / 2)) < 34) {
        if (level + 1 < LEVELS.length) {
          total += 25;
          ctx.sound('win');
          load(level + 1);
        } else {
          total += 50;
          done = true;
          ctx.onEnd({ score: total, won: true });
        }
        return;
      }

      draw();
    }

    function draw() {
      // lucht verloopt per level
      const sky = g.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#101024');
      sky.addColorStop(1, '#1b1b33');
      g.fillStyle = sky;
      g.fillRect(0, 0, W, H);

      // platforms
      platforms.forEach((pl) => {
        g.fillStyle = '#3a3a55';
        g.fillRect(pl.x, pl.y, pl.w, pl.h);
        g.fillStyle = '#69f0ae';
        g.fillRect(pl.x, pl.y, pl.w, 4);
      });

      // kristallen
      crystals.forEach((c) => {
        if (c.got) return;
        const bob = Math.sin(Date.now() / 300 + c.x) * 3;
        g.fillStyle = '#4dd0e1';
        g.beginPath();
        g.moveTo(c.x, c.y - 9 + bob);
        g.lineTo(c.x + 8, c.y + bob);
        g.lineTo(c.x, c.y + 9 + bob);
        g.lineTo(c.x - 8, c.y + bob);
        g.fill();
      });

      // vlag
      g.fillStyle = '#bdbdbd';
      g.fillRect(flag.x, flag.y, 3, 34);
      g.fillStyle = '#ffd200';
      g.beginPath();
      g.moveTo(flag.x + 3, flag.y);
      g.lineTo(flag.x + 24, flag.y + 8);
      g.lineTo(flag.x + 3, flag.y + 16);
      g.fill();

      // speler
      g.fillStyle = '#ff8a3d';
      g.fillRect(p.x, p.y, p.w, p.h);
      g.fillStyle = '#0a0a12';
      g.fillRect(p.x + (p.face > 0 ? 15 : 4), p.y + 8, 5, 5);
    }

    return {
      init: reset,
      reset: reset,
      update: update,
      onDir(d) {
        if (d === 'left') held.left = true;
        if (d === 'right') held.right = true;
        if (d === 'up') jump();
      },
      onKey(d, down) {
        if (d === 'left') held.left = down;
        if (d === 'right') held.right = down;
      },
      onAction(t) {
        if (t === 'down') jump();
        if (t === 'up') { held.left = false; held.right = false; }
      },
    };
  };
})(typeof self !== 'undefined' ? self : globalThis);
