/**
 * Space Blaster
 * Vijf golven aliens, elk met een eindbaas. Power-ups vallen uit neergeschoten
 * vijanden: spread-shot, schild en dubbele snelheid.
 *
 * Regels en scores zijn onveranderd. Nieuw: drie lagen sterren, gloeiende
 * kogels met spoor, explosies en schermschudden uit juice.js, en een
 * eindbaas-balk die leegloopt.
 */
(function (root) {
  'use strict';
  root.SBGames = root.SBGames || {};

  const WAVES = 5;

  root.SBGames.shooter = function (ctx) {
    const g = ctx.ctx2d;
    const J = root.SBJuice;
    const W = ctx.logical.w;
    const H = ctx.logical.h;

    const fx = J.fx(g, { w: W, h: H });
    const stars = J.starfield(g, { w: W, h: H, count: 90, dir: 'down' });

    let player, shots, foes, bombs, drops;
    let wave, waveLeft, spawnIn, score, lives, alive, fireCd, combo;
    let spread, shield, rapid, muzzle, waveBanner;

    function reset() {
      player = { x: W / 2, y: H - 56, w: 38, h: 26, vx: 0, tilt: 0 };
      shots = [];
      foes = [];
      bombs = [];
      drops = [];
      wave = 1;
      waveLeft = 8;
      spawnIn = 0.6;
      score = 0;
      lives = 3;
      alive = true;
      fireCd = 0;
      combo = 0;
      spread = 0;
      shield = 0;
      rapid = 0;
      muzzle = 0;
      waveBanner = 0;
      fx.clear();
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

    function spawnFoe() {
      const boss = waveLeft === 1;
      foes.push({
        x: 30 + Math.random() * (W - 60),
        y: -30,
        w: boss ? 62 : 32,
        h: boss ? 40 : 26,
        hp: boss ? 8 + wave * 2 : 1,
        hpMax: boss ? 8 + wave * 2 : 1,
        boss: boss,
        vy: boss ? 34 : 58 + wave * 9 + Math.random() * 30,
        wob: Math.random() * Math.PI * 2,
        shootIn: 1 + Math.random() * 2,
        hit: 0,
      });
    }

    function fire() {
      const rate = rapid > 0 ? 0.1 : 0.19;
      if (fireCd > 0) return;
      fireCd = rate;
      muzzle = 0.07;
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
        fx.shake(7);
        fx.ring(player.x, player.y, { color: '#4dd0e1', r1: 56, life: 0.4 });
        fx.burst(player.x, player.y, { colors: ['#00c8ff', '#4dd0e1', '#ffffff'], count: 18, speed: 200 });
        return;
      }
      lives--;
      combo = 0;
      fx.shake(14);
      fx.burst(player.x, player.y, { colors: ['#ff5252', '#ffab40', '#ffffff'], count: 26, speed: 250, life: 0.7 });
      fx.pop(player.x, player.y - 20, '-1 ❤️', { color: '#ff8a80', size: 19 });
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
      fx.update(dt);
      stars.update(dt, 90);
      muzzle = Math.max(0, muzzle - dt);
      if (waveBanner > 0) waveBanner = Math.max(0, waveBanner - dt);

      if (!alive) { draw(); return; }

      fireCd -= dt;
      spread = Math.max(0, spread - dt);
      rapid = Math.max(0, rapid - dt);
      if (shield > 0) { shield = Math.max(0, shield - dt); }

      // speler bewegen
      player.x += player.vx * dt;
      player.x = Math.max(20, Math.min(W - 20, player.x));
      player.tilt = J.lerp(player.tilt, J.clamp(player.vx / 260, -1, 1), 0.2);

      // automatisch vuren: op mobiel is mikken én tikken tegelijk niet te doen
      fire();

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
          fx.shake(12);
          ctx.onEnd({ score: score + 250, won: true });
          return;
        }
        wave++;
        waveLeft = 8 + wave * 3;
        spawnIn = 1.6;
        score += 50;
        waveBanner = 1.8;
        fx.pop(W / 2, H / 2 - 40, 'GOLF ' + wave, { color: '#ffffff', size: 30 });
        ctx.sound('win');
        paintHud();
      }

      // kogels
      for (let i = shots.length - 1; i >= 0; i--) {
        const s = shots[i];
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        fx.trail(s.x, s.y + 6, { color: rapid > 0 ? '#4dd0e1' : '#ffd200', size: 3.4, life: 0.18 });
        if (s.y < -20 || s.x < -20 || s.x > W + 20) shots.splice(i, 1);
      }

      // vijanden
      for (let i = foes.length - 1; i >= 0; i--) {
        const f = foes[i];
        f.wob += dt * 2;
        f.hit = Math.max(0, f.hit - dt);
        f.y += f.vy * dt;
        f.x += Math.sin(f.wob) * 40 * dt;
        f.shootIn -= dt;
        if (f.shootIn <= 0 && f.y > 0 && f.y < H - 140) {
          f.shootIn = f.boss ? 0.9 : 2 + Math.random() * 2;
          bombs.push({ x: f.x, y: f.y + f.h / 2, vy: 210 + wave * 14 });
          fx.spark(f.x, f.y + f.h / 2, { colors: ['#ff5252'], count: 4, speed: 90 });
        }
        if (f.y > H + 40) { foes.splice(i, 1); continue; }

        // botsing met de speler
        if (Math.abs(f.x - player.x) < (f.w + player.w) / 2 - 6 &&
            Math.abs(f.y - player.y) < (f.h + player.h) / 2 - 4) {
          foes.splice(i, 1);
          fx.burst(f.x, f.y, { colors: ['#ffab40', '#ffffff'], count: 16, speed: 210 });
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
            f.hit = 0.09;
            fx.spark(s.x, s.y, { colors: ['#ffd200', '#ffffff'], count: 6, speed: 200 });
            if (f.hp <= 0) {
              combo++;
              const gain = f.boss ? 100 : 10 + Math.min(20, combo);
              score += gain;
              fx.burst(f.x, f.y, {
                colors: f.boss ? ['#ff4081', '#ffd200', '#ffffff'] : ['#ffab40', '#ffd200'],
                count: f.boss ? 34 : 14, speed: f.boss ? 300 : 210, life: f.boss ? 0.9 : 0.55, size: f.boss ? 5 : 3.4,
              });
              fx.ring(f.x, f.y, { color: f.boss ? '#ff4081' : '#ffd200', r1: f.boss ? 90 : 40, life: 0.4 });
              fx.pop(f.x, f.y - 12, '+' + gain, { color: '#ffd200', size: f.boss ? 24 : 15 });
              if (f.boss) fx.shake(12);
              ctx.sound('hit');
              if (Math.random() < (f.boss ? 1 : 0.14)) {
                const kinds = ['spread', 'shield', 'rapid'];
                drops.push({ x: f.x, y: f.y, kind: kinds[Math.floor(Math.random() * kinds.length)], t: 0 });
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
        fx.trail(b.x, b.y - 5, { color: '#ff5252', size: 3, life: 0.16 });
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
        d.t += dt;
        if (d.y > H + 20) { drops.splice(i, 1); continue; }
        if (Math.abs(d.x - player.x) < 26 && Math.abs(d.y - player.y) < 26) {
          drops.splice(i, 1);
          if (d.kind === 'spread') spread = 9;
          if (d.kind === 'rapid') rapid = 7;
          if (d.kind === 'shield') shield = 8;
          score += 5;
          const label = d.kind === 'spread' ? 'SPREAD!' : d.kind === 'rapid' ? 'SNEL!' : 'SCHILD!';
          fx.pop(player.x, player.y - 30, label, { color: '#4dd0e1', size: 21 });
          fx.ring(player.x, player.y, { color: '#4dd0e1', r1: 60, life: 0.45 });
          ctx.sound('coin');
          paintHud();
        }
      }

      draw();
    }

    function draw() {
      g.fillStyle = J.vgrad(g, 0, H, '#0a0a1c', '#05050c');
      g.fillRect(0, 0, W, H);

      fx.begin();

      // sterren in drie dieptelagen
      stars.draw(g);

      // speler (kantelt een beetje mee met de stuurrichting)
      g.save();
      g.translate(player.x, player.y);
      g.rotate(player.tilt * 0.28);
      if (muzzle > 0) {
        J.blob(g, 0, -18, 20, 'rgba(255,210,0,0.85)', 0.9);
      }
      // vlam
      const flame = 8 + Math.random() * 7;
      J.blob(g, 0, 16 + flame / 2, flame, 'rgba(255,138,61,0.9)', 0.85);
      // romp
      J.glow(g, shield > 0 ? '#4dd0e1' : '#00c8ff', 16, () => {
        g.fillStyle = shield > 0 ? '#4dd0e1' : '#00c8ff';
        g.beginPath();
        g.moveTo(0, -16);
        g.lineTo(18, 12);
        g.lineTo(0, 5);
        g.lineTo(-18, 12);
        g.closePath();
        g.fill();
      });
      // cockpit
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.beginPath();
      g.ellipse(0, -2, 4.5, 7, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();

      if (shield > 0) {
        g.strokeStyle = 'rgba(77,208,225,' + (0.35 + Math.sin(fx.t * 8) * 0.2) + ')';
        g.lineWidth = 2.5;
        g.beginPath();
        g.arc(player.x, player.y, 30, 0, Math.PI * 2);
        g.stroke();
      }

      // kogels als lichtstreepjes
      shots.forEach((s) => {
        J.glow(g, '#ffd200', 10, () => {
          g.fillStyle = '#fff3b0';
          J.roundRect(g, s.x - 2.5, s.y - 10, 5, 14, 2.5);
        });
      });

      // bommen
      bombs.forEach((b) => {
        J.glow(g, '#ff5252', 12, () => {
          g.fillStyle = '#ff5252';
          g.beginPath();
          g.arc(b.x, b.y, 5.5, 0, Math.PI * 2);
          g.fill();
        });
      });

      // vijanden
      foes.forEach((f) => {
        const col = f.boss ? '#ff4081' : '#b388ff';
        J.glow(g, col, f.boss ? 20 : 10, () => {
          g.fillStyle = f.hit > 0 ? '#ffffff' : col;
          J.roundRect(g, f.x - f.w / 2, f.y - f.h / 2, f.w, f.h, 7);
        });
        // oog
        g.fillStyle = '#0a0a12';
        J.roundRect(g, f.x - f.w / 4, f.y - 3, f.w / 2, 5, 2);
        g.fillStyle = f.hit > 0 ? '#ff5252' : 'rgba(255,255,255,0.9)';
        g.beginPath();
        g.arc(f.x, f.y - 0.5, 2.2, 0, Math.PI * 2);
        g.fill();

        if (f.boss) {
          const bw = f.w + 16;
          g.fillStyle = 'rgba(0,0,0,0.55)';
          J.roundRect(g, f.x - bw / 2, f.y - f.h / 2 - 12, bw, 6, 3);
          g.fillStyle = '#ff4081';
          J.roundRect(g, f.x - bw / 2, f.y - f.h / 2 - 12, bw * J.clamp(f.hp / f.hpMax, 0, 1), 6, 3);
        }
      });

      // power-ups (wiebelen en gloeien)
      drops.forEach((d) => {
        const icon = d.kind === 'spread' ? '🔱' : d.kind === 'shield' ? '🛡' : '⚡';
        J.blob(g, d.x, d.y, 20, 'rgba(77,208,225,0.5)', 0.7);
        g.save();
        g.translate(d.x, d.y + Math.sin(d.t * 5) * 3);
        g.font = '19px sans-serif';
        g.textAlign = 'center';
        g.fillText(icon, 0, 7);
        g.restore();
        g.textAlign = 'left';
      });

      if (waveBanner > 0) {
        g.globalAlpha = J.clamp(waveBanner, 0, 1);
        g.fillStyle = '#ffffff';
        g.font = "800 34px 'Hanken Grotesk', system-ui, sans-serif";
        g.textAlign = 'center';
        g.fillText('GOLF ' + wave, W / 2, H / 2 - 30);
        g.font = "600 14px 'Hanken Grotesk', system-ui, sans-serif";
        g.fillStyle = 'rgba(255,255,255,0.7)';
        g.fillText('en dan de eindbaas…', W / 2, H / 2 - 6);
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
        if (d === 'left') { player.x -= 26; player.vx = -260; }
        if (d === 'right') { player.x += 26; player.vx = 260; }
      },
      onAxis(ax) {
        player.x += ax * 12;
        player.vx = ax * 300;
      },
      onAction() {},
    };
  };
})(typeof self !== 'undefined' ? self : globalThis);
