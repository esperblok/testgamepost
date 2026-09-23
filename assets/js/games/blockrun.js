/**
 * Block Run
 * Platformer: ren, spring, verzamel kristallen en haal de vlag.
 * Vijf levels die vastzitten in dit bestand, dus geen losse leveldata nodig.
 *
 * Een platform is [x, y, breedte, hoogte]. Kristallen zijn [x, y].
 * De levels en de regels zijn onveranderd; de aankleding (parallax, vonken,
 * stofwolken bij het landen, gloeiende kristallen) komt uit juice.js.
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
    const J = root.SBJuice;
    const W = ctx.logical.w;
    const H = ctx.logical.h;
    const GRAVITY = 1500;
    const JUMP_V = -520;
    const RUN = 210;

    const fx = J.fx(g, { w: W, h: H });
    const stars = J.starfield(g, { w: W, h: H, count: 46, dir: 'left', size: 1.3 });

    // shirt in jouw avatar-kleur (uit de winkel); regenboog/ontbrekend -> blauw
    const shirt = (function () {
      try {
        const it = root.SB.itemById(root.SB.getProfile(root.localStorage).skin);
        if (it && it.color && it.color !== 'rainbow') return it.color;
      } catch (e) {}
      return '#00a2ff';
    })();

    let level, p, platforms, crystals, flag, total, done, lives;
    let squash = 0;      // -1 = plat gedrukt, +1 = uitgerekt
    let levelFlash = 0;
    // Ingedrukte toetsen bijhouden: loslaten moet laten stilstaan, anders
    // schuift de speler oneindig door.
    const held = { left: false, right: false };

    function load(i) {
      const L = LEVELS[i];
      level = i;
      p = { x: L.spawn[0], y: L.spawn[1], w: 24, h: 30, vx: 0, vy: 0, onGround: false, face: 1, run: 0 };
      platforms = L.platforms.map((r) => ({ x: r[0], y: r[1], w: r[2], h: r[3] }));
      crystals = L.crystals.map((c) => ({ x: c[0], y: c[1], got: false }));
      flag = { x: L.flag[0], y: L.flag[1] };
      done = false;
      levelFlash = 1.2;
      fx.pop(W / 2, H / 2 - 30, 'LEVEL ' + (i + 1), { color: '#69f0ae', size: 30 });
      paintHud();
      draw();
    }

    function reset() {
      total = 0;
      lives = 3;
      fx.clear();
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
      fx.shake(12);
      fx.burst(p.x + p.w / 2, p.y + p.h / 2, { colors: ['#ff8a3d', '#ff5252', '#ffffff'], count: 24, speed: 240, life: 0.7 });
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
      squash = 1;
      ctx.sound('jump');
      fx.dust(p.x + p.w / 2, p.y + p.h, { count: 9 });
    }

    function update(dt) {
      fx.update(dt);
      stars.update(dt, 16);
      if (levelFlash > 0) levelFlash = Math.max(0, levelFlash - dt);
      squash = J.lerp(squash, 0, Math.min(1, dt * 10));

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
      p.run += Math.abs(p.vx) * dt * 0.05;

      // wanden
      if (p.x < 0) p.x = 0;
      if (p.x + p.w > W) p.x = W - p.w;

      // uit beeld gevallen
      if (p.y > H + 60) { die(); if (lives <= 0) return; }

      // platformbotsing: alleen landen als je van boven komt
      const wasGround = p.onGround;
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
      // net geland: stofwolkje en een klein deukje
      if (p.onGround && !wasGround) {
        squash = -1;
        fx.dust(p.x + p.w / 2, p.y + p.h, { count: 8 });
      }
      // renstof
      if (p.onGround && Math.abs(p.vx) > 120 && Math.random() < 0.35) {
        fx.dust(p.x + p.w / 2 - p.face * 8, p.y + p.h, { count: 1, size: 2.4 });
      }

      // kristallen
      crystals.forEach((c) => {
        if (c.got) return;
        if (Math.abs(c.x - (p.x + p.w / 2)) < 18 && Math.abs(c.y - (p.y + p.h / 2)) < 20) {
          c.got = true;
          total += 10;
          ctx.sound('coin');
          fx.burst(c.x, c.y, { colors: ['#4dd0e1', '#b2ebf2', '#ffffff'], count: 16, speed: 180, life: 0.55, size: 3.4 });
          fx.ring(c.x, c.y, { color: 'rgba(77,208,225,0.9)', r1: 34, life: 0.35 });
          fx.pop(c.x, c.y - 14, '+10 💎', { color: '#4dd0e1', size: 16 });
          paintHud();
        }
      });

      // vlag
      if (Math.abs(flag.x - (p.x + p.w / 2)) < 22 && Math.abs(flag.y + 16 - (p.y + p.h / 2)) < 34) {
        if (level + 1 < LEVELS.length) {
          total += 25;
          ctx.sound('win');
          fx.burst(flag.x + 10, flag.y + 8, { colors: ['#ffd200', '#ffffff', '#69f0ae'], count: 28, speed: 240, life: 0.8 });
          fx.shake(5);
          load(level + 1);
        } else {
          total += 50;
          done = true;
          fx.burst(flag.x + 10, flag.y + 8, { colors: ['#ffd200', '#ffffff', '#69f0ae'], count: 40, speed: 300, life: 1 });
          ctx.onEnd({ score: total, won: true });
        }
        return;
      }

      draw();
    }

    function draw() {
      // lucht verloopt per level
      g.fillStyle = J.vgrad(g, 0, H, '#141433', '#0d0d1c');
      g.fillRect(0, 0, W, H);

      fx.begin();

      stars.draw(g);

      // heuvels op de achtergrond, schuiven zachtjes mee
      const drift = (p ? p.x : 0) * 0.12;
      g.fillStyle = 'rgba(105,240,174,0.07)';
      for (let i = 0; i < 5; i++) {
        const bx = ((i * 180) - drift) % (W + 180);
        g.beginPath();
        g.arc(bx, H - 40, 90, Math.PI, 0);
        g.fill();
      }

      // platforms met een lichtrand bovenop
      platforms.forEach((pl) => {
        g.fillStyle = '#3a3a55';
        J.roundRect(g, pl.x, pl.y, pl.w, pl.h, 3);
        J.glow(g, '#69f0ae', 10, () => {
          g.fillStyle = '#69f0ae';
          J.roundRect(g, pl.x, pl.y, pl.w, 4, 2);
        });
        J.studs(g, pl.x, pl.y, pl.w, 'rgba(255,255,255,0.28)');
        // blokjes-textuur
        g.fillStyle = 'rgba(255,255,255,0.05)';
        for (let x = pl.x + 6; x < pl.x + pl.w - 6; x += 16) g.fillRect(x, pl.y + 7, 8, 3);
      });

      // kristallen: zweven, draaien en gloeien
      const t = fx.t;
      crystals.forEach((c) => {
        if (c.got) return;
        const bob = Math.sin(t * 2.6 + c.x * 0.05) * 3.5;
        const wob = Math.abs(Math.cos(t * 1.7 + c.x * 0.03));
        J.blob(g, c.x, c.y + bob, 18, 'rgba(77,208,225,0.4)', 0.6);
        J.glow(g, '#4dd0e1', 14, () => {
          g.fillStyle = '#4dd0e1';
          g.beginPath();
          g.moveTo(c.x, c.y - 10 + bob);
          g.lineTo(c.x + 8 * wob + 2, c.y + bob);
          g.lineTo(c.x, c.y + 10 + bob);
          g.lineTo(c.x - 8 * wob - 2, c.y + bob);
          g.closePath();
          g.fill();
        });
        g.fillStyle = 'rgba(255,255,255,0.7)';
        g.fillRect(c.x - 1, c.y - 6 + bob, 2, 5);
      });

      // vlag wappert
      const wave = Math.sin(t * 5) * 3;
      g.fillStyle = '#bdbdbd';
      g.fillRect(flag.x, flag.y, 3, 34);
      J.glow(g, '#ffd200', 14, () => {
        g.fillStyle = '#ffd200';
        g.beginPath();
        g.moveTo(flag.x + 3, flag.y);
        g.lineTo(flag.x + 24, flag.y + 8 + wave);
        g.lineTo(flag.x + 3, flag.y + 16);
        g.closePath();
        g.fill();
      });

      // speler: een blokje met gezicht, dat meevert met springen en landen
      if (p) {
        const sw = p.w * (1 - squash * 0.14);
        const sh = p.h * (1 + squash * 0.16);
        const px = p.x + (p.w - sw) / 2;
        const py = p.y + (p.h - sh);
        const cx = px + sw / 2;
        const cy = py + sh / 2;

        // schaduw op de grond
        g.fillStyle = 'rgba(0,0,0,0.28)';
        g.beginPath();
        g.ellipse(cx, p.y + p.h + 4, sw * 0.5, 4, 0, 0, Math.PI * 2);
        g.fill();

        // jouw eigen avatar rent door het level: gele kop, shirt in jouw kleur
        J.glow(g, shirt, 12, () => {
          J.minifig(g, cx, p.y + p.h, {
            h: sh,
            shirt: shirt,
            facing: p.face,
            walk: Math.abs(p.vx) > 20 ? p.run * 6 : 0,
            jump: !p.onGround,
          });
        });
      }

      if (levelFlash > 0) {
        g.globalAlpha = J.clamp(levelFlash, 0, 1);
        g.fillStyle = '#ffffff';
        g.font = "800 32px 'Hanken Grotesk', system-ui, sans-serif";
        g.textAlign = 'center';
        g.fillText('LEVEL ' + (level + 1), W / 2, H / 2 - 30);
        g.textAlign = 'left';
        g.globalAlpha = 1;
      }

      fx.vignette(0.45);
      fx.end();
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
