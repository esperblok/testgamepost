/**
 * Space Blaster
 * Vijf golven aliens, elk met een eindbaas. Power-ups vallen uit neergeschoten
 * vijanden: spread-shot, schild en dubbele snelheid.
 */
(function (root) {
  'use strict';
  root.SBGames = root.SBGames || {};

  const WAVES = 5;

  root.SBGames.shooter = function (ctx) {
    const g = ctx.ctx2d;
    const W = ctx.logical.w;
    const H = ctx.logical.h;

    let player, shots, foes, bombs, drops, particles;
    let wave, waveLeft, spawnIn, score, lives, alive, fireCd, shake, stars;
    let spread, shield, rapid, powerT;

    function reset() {
      player = { x: W / 2, y: H - 56, w: 38, h: 26, vx: 0 };
      shots = [];
      foes = [];
      bombs = [];
      drops = [];
      particles = [];
      wave = 1;
      waveLeft = 8;
      spawnIn = 0.6;
      score = 0;
      lives = 3;
      alive = true;
      fireCd = 0;
      shake = 0;
      spread = 0;
      shield = 0;
      rapid = 0;
      powerT = 0;
      stars = [];
      for (let i = 0; i < 60; i++) {
        stars.push({ x: Math.random() * W, y: Math.random() * H, s: Math.random() * 1.6 + 0.4 });
      }
      paintHud();
      draw();
    }

    function paintHud() {
      ctx.hud([
        { icon: '⭐', label: 'Score', value: score },
        { icon: '❤️', label: 'Levens', value: lives },
        { icon: '🌊', label: 'Golf', value: wave + '/' + WAVES },
      ]);
    }

    function boom(x, y, color, n) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 40 + Math.random() * 160;
        particles.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.5, color: color });
      }
    }

    function spawnFoe() {
      const boss = waveLeft === 1;
      foes.push({
        x: 30 + Math.random() * (W - 60),
        y: -30,
        w: boss ? 62 : 32,
        h: boss ? 40 : 26,
        hp: boss ? 8 + wave * 2 : 1,
        boss: boss,
        vy: boss ? 34 : 58 + wave * 9 + Math.random() * 30,
        wob: Math.random() * Math.PI * 2,
        shootIn: 1 + Math.random() * 2,
      });
    }

    function fire() {
      const rate = rapid > 0 ? 0.1 : 0.19;
      if (fireCd > 0) return;
      fireCd = rate;
      shots.push({ x: player.x, y: player.y - 14, vx: 0, vy: -560 });
      if (spread > 0) {
        shots.push({ x: player.x - 10, y: player.y - 8, vx: -140, vy: -520 });
        shots.push({ x: player.x + 10, y: player.y - 8, vx: 140, vy: -520 });
      }
      ctx.sound('tap');
    }

    function hitPlayer() {
      if (shield > 0) {
        shield = 0;
        ctx.sound('hit');
        boom(player.x, player.y, '#00c8ff', 18);
        return;
      }
      lives--;
      shake = 0.4;
      boom(player.x, player.y, '#ff5252', 24);
      ctx.sound('lose');
      paintHud();
      if (lives <= 0) {
        alive = false;
        ctx.onEnd({ score: score });
      } else {
        player.x = W / 2;
        shield = 2;
      }
    }

    function update(dt) {
      if (!alive) { draw(); return; }

      fireCd -= dt;
      shake = Math.max(0, shake - dt);
      spread = Math.max(0, spread - dt);
      rapid = Math.max(0, rapid - dt);
      if (shield > 0) { shield = Math.max(0, shield - dt); }

      // speler bewegen
      player.x += player.vx * dt;
      player.x = Math.max(20, Math.min(W - 20, player.x));

      // automatisch vuren: op mobiel is mikken én tikken tegelijk niet te doen
      fire();

      // sterren scrollen
      stars.forEach((s) => {
        s.y += s.s * 90 * dt;
        if (s.y > H) { s.y = 0; s.x = Math.random() * W; }
      });

      // golven
      spawnIn -= dt;
      if (spawnIn <= 0 && waveLeft > 0) {
        spawnFoe();
        waveLeft--;
        spawnIn = Math.max(0.3, 1.1 - wave * 0.1);
      }
      if (waveLeft === 0 && foes.length === 0) {
        if (wave >= WAVES) {
          alive = false;
          ctx.onEnd({ score: score + 250, won: true });
          return;
        }
        wave++;
        waveLeft = 8 + wave * 3;
        spawnIn = 1.6;
        score += 50;
        ctx.sound('win');
        paintHud();
      }

      // kogels
      for (let i = shots.length - 1; i >= 0; i--) {
        const s = shots[i];
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        if (s.y < -20 || s.x < -20 || s.x > W + 20) shots.splice(i, 1);
      }

      // vijanden
      for (let i = foes.length - 1; i >= 0; i--) {
        const f = foes[i];
        f.wob += dt * 2;
        f.y += f.vy * dt;
        f.x += Math.sin(f.wob) * 40 * dt;
        f.shootIn -= dt;
        if (f.shootIn <= 0 && f.y > 0 && f.y < H - 140) {
          f.shootIn = f.boss ? 0.9 : 2 + Math.random() * 2;
          bombs.push({ x: f.x, y: f.y + f.h / 2, vy: 210 + wave * 14 });
        }
        if (f.y > H + 40) { foes.splice(i, 1); continue; }

        // botsing met de speler
        if (Math.abs(f.x - player.x) < (f.w + player.w) / 2 - 6 &&
            Math.abs(f.y - player.y) < (f.h + player.h) / 2 - 4) {
          foes.splice(i, 1);
          boom(f.x, f.y, '#ffab40', 14);
          hitPlayer();
          if (!alive) return;
          continue;
        }

        // geraakt door kogel
        for (let j = shots.length - 1; j >= 0; j--) {
          const s = shots[j];
          if (Math.abs(s.x - f.x) < f.w / 2 + 3 && Math.abs(s.y - f.y) < f.h / 2 + 5) {
            shots.splice(j, 1);
            f.hp--;
            boom(s.x, s.y, '#ffd200', 4);
            if (f.hp <= 0) {
              score += f.boss ? 100 : 10;
              boom(f.x, f.y, f.boss ? '#ff4081' : '#ffab40', f.boss ? 30 : 12);
              ctx.sound('hit');
              if (Math.random() < (f.boss ? 1 : 0.14)) {
                const kinds = ['spread', 'shield', 'rapid'];
                drops.push({ x: f.x, y: f.y, kind: kinds[Math.floor(Math.random() * kinds.length)] });
              }
              foes.splice(i, 1);
              paintHud();
            }
            break;
          }
        }
      }

      // vijandelijke bommen
      for (let i = bombs.length - 1; i >= 0; i--) {
        const b = bombs[i];
        b.y += b.vy * dt;
        if (b.y > H + 20) { bombs.splice(i, 1); continue; }
        if (Math.abs(b.x - player.x) < player.w / 2 && Math.abs(b.y - player.y) < player.h / 2 + 4) {
          bombs.splice(i, 1);
          hitPlayer();
          if (!alive) return;
        }
      }

      // power-ups
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i];
        d.y += 110 * dt;
        if (d.y > H + 20) { drops.splice(i, 1); continue; }
        if (Math.abs(d.x - player.x) < 26 && Math.abs(d.y - player.y) < 26) {
          drops.splice(i, 1);
          if (d.kind === 'spread') spread = 9;
          if (d.kind === 'rapid') rapid = 7;
          if (d.kind === 'shield') shield = 8;
          score += 5;
          ctx.sound('coin');
          paintHud();
        }
      }

      // deeltjes
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 220 * dt;
      }

      draw();
    }

    function draw() {
      g.fillStyle = '#07070f';
      g.fillRect(0, 0, W, H);

      g.save();
      if (shake > 0) g.translate((Math.random() - 0.5) * 8 * shake, (Math.random() - 0.5) * 8 * shake);

      g.fillStyle = 'rgba(255,255,255,0.5)';
      stars.forEach((s) => g.fillRect(s.x, s.y, s.s, s.s * 2));

      // speler
      g.fillStyle = shield > 0 ? '#4dd0e1' : '#00c8ff';
      g.beginPath();
      g.moveTo(player.x, player.y - 16);
      g.lineTo(player.x + 18, player.y + 12);
      g.lineTo(player.x, player.y + 5);
      g.lineTo(player.x - 18, player.y + 12);
      g.fill();
      g.fillStyle = '#ffab40';
      g.fillRect(player.x - 4, player.y + 12, 8, 6 + Math.random() * 5);
      if (shield > 0) {
        g.strokeStyle = 'rgba(77,208,225,0.6)';
        g.lineWidth = 2;
        g.beginPath();
        g.arc(player.x, player.y, 28, 0, Math.PI * 2);
        g.stroke();
      }

      // kogels
      g.fillStyle = '#ffd200';
      shots.forEach((s) => g.fillRect(s.x - 2, s.y - 8, 4, 12));

      // bommen
      g.fillStyle = '#ff5252';
      bombs.forEach((b) => { g.beginPath(); g.arc(b.x, b.y, 5, 0, Math.PI * 2); g.fill(); });

      // vijanden
      foes.forEach((f) => {
        g.fillStyle = f.boss ? '#ff4081' : '#b388ff';
        g.beginPath();
        if (g.roundRect) g.roundRect(f.x - f.w / 2, f.y - f.h / 2, f.w, f.h, 6);
        else g.rect(f.x - f.w / 2, f.y - f.h / 2, f.w, f.h);
        g.fill();
        g.fillStyle = '#0a0a12';
        g.fillRect(f.x - f.w / 4, f.y - 3, f.w / 2, 5);
        if (f.boss) {
          g.fillStyle = 'rgba(255,255,255,0.25)';
          g.fillRect(f.x - f.w / 2, f.y - f.h / 2 - 8, f.w * (f.hp / (8 + wave * 2)), 4);
        }
      });

      // power-ups
      drops.forEach((d) => {
        const icon = d.kind === 'spread' ? '🔱' : d.kind === 'shield' ? '🛡' : '⚡';
        g.font = '18px sans-serif';
        g.textAlign = 'center';
        g.fillText(icon, d.x, d.y + 6);
        g.textAlign = 'left';
      });

      // deeltjes
      particles.forEach((p) => {
        g.globalAlpha = Math.max(0, p.life * 2);
        g.fillStyle = p.color;
        g.fillRect(p.x - 2, p.y - 2, 4, 4);
      });
      g.globalAlpha = 1;

      g.restore();
    }

    return {
      init: reset,
      reset: reset,
      update: update,
      onDir(d) {
        if (d === 'left') player.x -= 26;
        if (d === 'right') player.x += 26;
      },
      onAxis(ax) {
        player.x += ax * 12;
      },
      onAction() {},
    };
  };
})(typeof self !== 'undefined' ? self : globalThis);
