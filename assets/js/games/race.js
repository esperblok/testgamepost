/**
 * Kart Race
 * Top-down racer: drie ronden, drie rivalen, één beker.
 *
 * Het circuit is een gesloten lus die wiskundig is opgebouwd (zie trackPoint),
 * dus er hoeft geen afbeelding of leveldata mee. Rondetijden en positie worden
 * bijgehouden via checkpoints, zodat achteruit rijden geen ronde oplevert.
 */
(function (root) {
  'use strict';
  root.SBGames = root.SBGames || {};

  const LAPS = 3;
  const TRACK_W = 78;         // halve breedte van de baan
  const CHECKPOINTS = 12;

  // Baan: een uitgerekte, wat wiebelige lus in wereldcoördinaten.
  function trackPoint(t) {
    const a = t * Math.PI * 2;
    return {
      x: 400 + 300 * Math.cos(a) + 34 * Math.cos(3 * a),
      y: 300 + 210 * Math.sin(a) + 26 * Math.sin(2 * a),
    };
  }

  root.SBGames.race = function (ctx) {
    const g = ctx.ctx2d;
    const J = root.SBJuice;
    const W = ctx.logical.w;
    const H = ctx.logical.h;

    const fx = J.fx(g, { w: W, h: H });

    const SAMPLES = 480;
    let path = [];
    let karts = [];
    let raceTime = 0;
    let countdown = 3;
    let finished = false;
    let place = 1;
    let bestLap = 0;
    let lastLapAt = 0;

    function buildTrack() {
      path = [];
      for (let i = 0; i < SAMPLES; i++) path.push(trackPoint(i / SAMPLES));
    }

    /** Index van het dichtstbijzijnde baanpunt — de "voortgang" van een kart. */
    function nearest(x, y, hint) {
      let best = -1;
      let bestD = Infinity;
      // Zoek eerst rond de vorige positie (snel), daarna pas globaal.
      const windows = hint === undefined
        ? [[0, SAMPLES]]
        : [[hint - 40, hint + 40]];
      for (const [from, to] of windows) {
        for (let k = from; k < to; k++) {
          const i = ((k % SAMPLES) + SAMPLES) % SAMPLES;
          const dx = path[i].x - x;
          const dy = path[i].y - y;
          const d = dx * dx + dy * dy;
          if (d < bestD) { bestD = d; best = i; }
        }
      }
      return { index: best, dist: Math.sqrt(bestD) };
    }

    function makeKart(i, isPlayer) {
      const start = trackPoint((i * 0.012) % 1);
      const ahead = trackPoint((i * 0.012 + 0.01) % 1);
      return {
        name: isPlayer ? 'Jij' : ['Nova', 'Pip', 'Rex'][i] || 'Rivaal',
        emoji: isPlayer ? '🏎️' : ['🚙', '🚕', '🚓'][i] || '🚗',
        color: isPlayer ? '#ff6a00' : ['#00c8ff', '#ff4081', '#00e676'][i] || '#fff',
        x: start.x,
        y: start.y,
        angle: Math.atan2(ahead.y - start.y, ahead.x - start.x),
        speed: 0,
        lap: 0,
        nextCp: 1,
        idx: 0,
        isPlayer: !!isPlayer,
        skill: isPlayer ? 0 : 0.86 + Math.random() * 0.12,
        wobble: Math.random() * 10,
        done: false,
        finishAt: 0,
      };
    }

    function reset() {
      buildTrack();
      karts = [makeKart(0, true), makeKart(1, false), makeKart(2, false), makeKart(3, false)];
      raceTime = 0;
      countdown = 3;
      finished = false;
      place = 1;
      bestLap = 0;
      lastLapAt = 0;
      paintHud();
      draw();
    }

    function paintHud() {
      const me = karts[0];
      ctx.hud([
        { icon: '🏁', label: 'Ronde', value: Math.min(LAPS, me.lap + 1) + '/' + LAPS },
        { icon: '🥇', label: 'Positie', value: place + '/4' },
        { icon: '⏱️', label: 'Tijd', value: raceTime.toFixed(1) + 's' },
        { icon: '⚡', label: 'Snelheid', value: Math.round(Math.abs(me.speed) / 2.2) + ' km/u' },
      ]);
    }

    function cpIndex(i) {
      return Math.floor((i / SAMPLES) * CHECKPOINTS);
    }

    function drive(k, dt, throttle, steer) {
      const MAX = k.isPlayer ? 250 : 250 * k.skill;
      // Buiten de baan rijdt het stroperig: dat is de straf voor afsnijden.
      const near = nearest(k.x, k.y, k.idx);
      k.idx = near.index;
      const offTrack = near.dist > TRACK_W;

      const accel = offTrack ? 90 : 210;
      k.speed += throttle * accel * dt;
      k.speed *= offTrack ? Math.pow(0.25, dt) : Math.pow(0.6, dt);
      k.speed = Math.max(-90, Math.min(MAX, k.speed));

      // Sturen werkt alleen als je rijdt, zoals bij een echte kart.
      const grip = Math.min(1, Math.abs(k.speed) / 90);
      k.angle += steer * 2.7 * dt * grip * Math.sign(k.speed || 1);

      k.x += Math.cos(k.angle) * k.speed * dt;
      k.y += Math.sin(k.angle) * k.speed * dt;

      // ── Rondetelling via checkpoints ──
      // nextCp telt op van 0 naar CHECKPOINTS. Pas als je ze allemaal in
      // volgorde bent geweest en de startlijn weer passeert, telt de ronde.
      // Anders zou achteruit over de lijn rijden ook een ronde opleveren.
      const ci = cpIndex(k.idx);
      const wantCp = k.nextCp % CHECKPOINTS;
      if (ci === wantCp) {
        if (k.nextCp > 0 && wantCp === 0) {
          k.lap++;
          if (k.isPlayer) {
            const lapTime = raceTime - lastLapAt;
            lastLapAt = raceTime;
            if (k.lap > 1 && (!bestLap || lapTime < bestLap)) bestLap = lapTime;
            ctx.sound('coin');
            fx.pop(W / 2, H / 2 - 40, 'RONDE ' + Math.min(k.lap, LAPS), { color: '#ffd200', size: 24 });
            fx.ring(W / 2, H * 0.68, { color: 'rgba(255,210,0,0.8)', r1: 70, life: 0.4 });
          }
          if (k.lap > LAPS && !k.done) {
            k.done = true;
            k.finishAt = raceTime;
            finishRace();
          }
        }
        k.nextCp++;
      }
    }

    function driveAI(k, dt) {
      // Kijk een paar punten vooruit en stuur daarheen.
      const look = path[(k.idx + 14) % SAMPLES];
      let want = Math.atan2(look.y - k.y, look.x - k.x);
      let diff = want - k.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const steer = Math.max(-1, Math.min(1, diff * 2.4));
      // In scherpe bochten iets minderen, anders vliegen ze eruit.
      const throttle = Math.abs(diff) > 0.55 ? 0.55 : 1;
      drive(k, dt, throttle, steer);
    }

    function separate() {
      for (let i = 0; i < karts.length; i++) {
        for (let j = i + 1; j < karts.length; j++) {
          const a = karts[i];
          const b = karts[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d = Math.hypot(dx, dy);
          const min = 30;
          if (d > 0 && d < min) {
            const push = (min - d) / 2;
            const nx = dx / d;
            const ny = dy / d;
            a.x -= nx * push; a.y -= ny * push;
            b.x += nx * push; b.y += ny * push;
            a.speed *= 0.86; b.speed *= 0.86;
          }
        }
      }
    }

    function standings() {
      return karts.slice().sort((a, b) => {
        if (a.done && b.done) return a.finishAt - b.finishAt;
        if (a.done) return -1;
        if (b.done) return 1;
        if (b.lap !== a.lap) return b.lap - a.lap;
        if (b.nextCp !== a.nextCp) return b.nextCp - a.nextCp;
        return b.idx - a.idx;
      });
    }

    function finishRace() {
      if (finished) return;
      finished = true;
      place = standings().findIndex((k) => k.isPlayer) + 1;
      fx.shake(place === 1 ? 10 : 5);
      fx.burst(W / 2, H / 2, {
        colors: place === 1 ? ['#ffd200', '#ffffff', '#00e676'] : ['#ffffff', '#00c8ff'],
        count: 44, speed: 320, life: 1.1, size: 5,
      });
      const base = [180, 120, 80, 50][place - 1] || 40;
      const lapBonus = bestLap ? Math.max(0, Math.round(60 - bestLap * 2)) : 0;
      ctx.after(() => ctx.onEnd({ score: base + lapBonus, won: place === 1 }), 600);
    }

    function update(dt) {
      fx.update(dt);
      if (finished) { draw(); return; }

      if (countdown > 0) {
        countdown -= dt;
        draw();
        return;
      }
      raceTime += dt;

      const me = karts[0];
      drive(me, dt, throttleInput, steerInput);

      // stof achter de eigen kart (in schermcoördinaten: de camera volgt jou)
      if (Math.abs(me.speed) > 60) {
        fx.dust(W / 2, H * 0.68 + 22, { count: 2, size: 3 });
        fx.speedLines(J.clamp((Math.abs(me.speed) - 60) / 220, 0, 1), 'rgba(255,255,255,0.22)');
      }
      for (let i = 1; i < karts.length; i++) driveAI(karts[i], dt);
      separate();

      place = standings().findIndex((k) => k.isPlayer) + 1;
      paintHud();
      draw();
    }

    let throttleInput = 0;
    let steerInput = 0;

    function draw() {
      const me = karts[0];

      g.fillStyle = J.vgrad(g, 0, H, '#123024', '#0a1a13');
      g.fillRect(0, 0, W, H);

      fx.begin();

      g.save();
      // Camera volgt de speler en draait mee, zodat je altijd "vooruit" kijkt.
      g.translate(W / 2, H * 0.68);
      g.rotate(-me.angle - Math.PI / 2);
      g.translate(-me.x, -me.y);

      // gras met stippen voor snelheidsgevoel
      g.fillStyle = 'rgba(255,255,255,0.035)';
      for (let i = 0; i < path.length; i += 4) {
        const p = path[i];
        g.fillRect(p.x - TRACK_W - 90 + ((i * 37) % 180), p.y - TRACK_W - 90 + ((i * 53) % 180), 3, 3);
      }

      // baan: dikke donkere strook met witte rand
      g.lineJoin = 'round';
      g.lineCap = 'round';
      g.strokeStyle = '#f5f5f5';
      g.lineWidth = TRACK_W * 2 + 10;
      strokePath();
      g.strokeStyle = '#3a3a44';
      g.lineWidth = TRACK_W * 2;
      strokePath();
      // middenschijf
      g.strokeStyle = 'rgba(255,255,255,0.16)';
      g.lineWidth = 3;
      g.setLineDash([16, 20]);
      strokePath();
      g.setLineDash([]);

      // start/finish
      const s0 = path[0];
      const s1 = path[1];
      const ang = Math.atan2(s1.y - s0.y, s1.x - s0.x) + Math.PI / 2;
      g.save();
      g.translate(s0.x, s0.y);
      g.rotate(ang);
      for (let i = -TRACK_W; i < TRACK_W; i += 14) {
        g.fillStyle = ((i / 14) | 0) % 2 ? '#111' : '#fff';
        g.fillRect(i, -8, 14, 16);
      }
      g.restore();

      // karts, speler laatst zodat die bovenop ligt
      standings().slice().reverse().forEach((k) => drawKart(k));

      g.restore();

      // countdown
      if (countdown > 0) {
        g.fillStyle = 'rgba(0,0,0,0.45)';
        g.fillRect(0, 0, W, H);
        g.fillStyle = '#ffd200';
        g.font = "700 84px 'Hanken Grotesk', system-ui, sans-serif";
        g.textAlign = 'center';
        g.fillText(String(Math.ceil(countdown)), W / 2, H / 2 + 26);
        g.textAlign = 'left';
      }

      if (finished) {
        g.fillStyle = 'rgba(0,0,0,0.5)';
        g.fillRect(0, 0, W, H);
        g.fillStyle = place === 1 ? '#ffd200' : '#fff';
        g.font = "700 40px 'Hanken Grotesk', system-ui, sans-serif";
        g.textAlign = 'center';
        g.fillText(place === 1 ? '🏆 Gewonnen!' : 'P' + place + ' — gefinisht', W / 2, H / 2);
        g.textAlign = 'left';
      }

      fx.vignette(0.42);
      fx.end();
    }

    function strokePath() {
      g.beginPath();
      g.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length; i++) g.lineTo(path[i].x, path[i].y);
      g.closePath();
      g.stroke();
    }

    function drawKart(k) {
      g.save();
      g.translate(k.x, k.y);
      g.rotate(k.angle + Math.PI / 2);
      // schaduw
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.beginPath();
      g.ellipse(2, 3, 14, 19, 0, 0, Math.PI * 2);
      g.fill();
      // body
      g.fillStyle = k.color;
      g.beginPath();
      if (g.roundRect) g.roundRect(-11, -17, 22, 34, 6);
      else g.rect(-11, -17, 22, 34);
      g.fill();
      // cockpit
      g.fillStyle = 'rgba(10,10,18,0.8)';
      g.beginPath();
      if (g.roundRect) g.roundRect(-7, -8, 14, 14, 4);
      else g.rect(-7, -8, 14, 14);
      g.fill();
      // bestuurder: geel Roblox-blokhoofdje met helm in de kartkleur
      g.fillStyle = '#ffd23c';
      g.beginPath();
      if (g.roundRect) g.roundRect(-5, -6, 10, 10, 2);
      else g.rect(-5, -6, 10, 10);
      g.fill();
      g.fillStyle = k.color;
      g.fillRect(-5, -8, 10, 3);
      g.fillStyle = '#1c1e20';
      g.fillRect(-2, -3, 2, 2);
      g.fillRect(2, -3, 2, 2);
      // wielen
      g.fillStyle = '#111';
      [[-12, -12], [8, -12], [-12, 8], [8, 8]].forEach(([wx, wy]) => g.fillRect(wx, wy, 5, 10));
      g.restore();

      // naamlabel boven de kart
      g.fillStyle = k.isPlayer ? '#ffd200' : 'rgba(255,255,255,0.6)';
      g.font = '600 12px Fredoka, sans-serif';
      g.textAlign = 'center';
      g.fillText(k.name, k.x, k.y - 26);
      g.textAlign = 'left';
    }

    return {
      init: reset,
      reset: reset,
      update: update,
      onKey(d, down) {
        if (d === 'left') steerInput = down ? -1 : (steerInput < 0 ? 0 : steerInput);
        if (d === 'right') steerInput = down ? 1 : (steerInput > 0 ? 0 : steerInput);
        if (d === 'up') throttleInput = down ? 1 : Math.max(0, throttleInput);
        if (d === 'down') throttleInput = down ? -0.7 : Math.min(0, throttleInput);
      },
      // Pijltjes/WASD sturen ook zonder "ingedrukt" te volgen, voor spellen
      // die alleen één tik verwachten — hier is het een herinnering.
      onDir(d) {
        if (d === 'left') steerInput = -1;
        if (d === 'right') steerInput = 1;
        if (d === 'up') throttleInput = 1;
      },
      onAxis(ax) {
        if (Math.abs(ax) > 0.15) steerInput = Math.max(-1, Math.min(1, ax * 1.6));
      },
      onAction(t) {
        throttleInput = t === 'down' ? 1 : 0;
      },
    };
  };
})(typeof self !== 'undefined' ? self : globalThis);
