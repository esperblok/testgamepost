/**
 * Neon Snake
 * Eet appels, word langer, raak jezelf of de muur niet.
 * Snelheid loopt op naarmate je groeit — dat is de hele uitdaging.
 *
 * De regels zijn precies hetzelfde als altijd; wat er anders uitziet zit in
 * draw(): gloeiende segmenten, een appel die ademt, deeltjes bij elke hap en
 * een scherm dat schudt als je crasht (via assets/js/juice.js).
 */
(function (root) {
  'use strict';
  root.SBGames = root.SBGames || {};

  const COLS = 24;
  const ROWS = 24;
  const START_DELAY = 0.16;   // seconden per stap
  const MIN_DELAY = 0.055;

  root.SBGames.snake = function (ctx) {
    const g = ctx.ctx2d;
    const J = root.SBJuice;
    const W = ctx.logical.w;
    const H = ctx.logical.h;
    const CELL = W / COLS;

    const fx = J.fx(g, { w: W, h: H });

    let snake, dir, nextDir, food, bonus, delay, timer, score, alive;
    let pulse = 0;
    let tongue = 0;
    let eatenFlash = 0;
    let smooth = [];      // zachte tussenposities, puur voor het oog

    function reset() {
      snake = [
        { x: 5, y: 12 }, { x: 4, y: 12 }, { x: 3, y: 12 },
      ];
      dir = { x: 1, y: 0 };
      nextDir = dir;
      score = 0;
      delay = START_DELAY;
      timer = 0;
      alive = true;
      bonus = null;
      eatenFlash = 0;
      smooth = snake.map((s) => ({ x: s.x, y: s.y }));
      fx.clear();
      spawnFood();
      paintHud();
      draw();
    }

    function freeCells() {
      const taken = new Set(snake.map((s) => s.x + ',' + s.y));
      const out = [];
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          if (!taken.has(x + ',' + y)) out.push({ x: x, y: y });
        }
      }
      return out;
    }

    function spawnFood() {
      const free = freeCells();
      if (!free.length) {
        ctx.onEnd({ score: score, won: true });
        return;
      }
      food = free[Math.floor(Math.random() * free.length)];
      // Elke 5e appel komt er een bonusappel bij die meer waard is.
      if (score > 0 && score % 5 === 0 && !bonus) {
        const rest = free.filter((c) => c !== food);
        if (rest.length) {
          bonus = rest[Math.floor(Math.random() * rest.length)];
          fx.ring(bonus.x * CELL + CELL / 2, bonus.y * CELL + CELL / 2,
            { color: '#ffd200', r1: 34, life: 0.5 });
        }
      }
    }

    function paintHud() {
      ctx.hud([
        { icon: '🍎', label: 'Appels', value: score },
        { icon: '📏', label: 'Lengte', value: snake.length },
        { icon: '⚡', label: 'Snelheid', value: Math.round((START_DELAY / delay) * 10) / 10 + 'x' },
      ]);
    }

    function step() {
      dir = nextDir;
      const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

      const hitWall = head.x < 0 || head.y < 0 || head.x >= COLS || head.y >= ROWS;
      // De staart schuift weg, dus het laatste segment mag wel betreden worden.
      const hitSelf = snake.slice(0, -1).some((s) => s.x === head.x && s.y === head.y);
      if (hitWall || hitSelf) {
        alive = false;
        ctx.sound('lose');
        const hx = J.clamp(head.x, 0, COLS - 1) * CELL + CELL / 2;
        const hy = J.clamp(head.y, 0, ROWS - 1) * CELL + CELL / 2;
        fx.shake(16);
        fx.burst(hx, hy, { colors: ['#00e676', '#00c853', '#ffffff'], count: 34, speed: 260, life: 0.8, size: 4.5 });
        fx.pop(hx, hy - 12, '💥', { size: 24 });
        ctx.onEnd({ score: score });
        return;
      }

      snake.unshift(head);

      const cx = head.x * CELL + CELL / 2;
      const cy = head.y * CELL + CELL / 2;

      if (head.x === food.x && head.y === food.y) {
        score += 1;
        delay = Math.max(MIN_DELAY, START_DELAY - score * 0.004);
        ctx.sound('eat');
        eatenFlash = 0.25;
        fx.burst(cx, cy, { colors: ['#ff5252', '#ff8a80', '#ffffff'], count: 16, speed: 190, life: 0.5, size: 3.6 });
        fx.pop(cx, cy - 8, '+1', { color: '#ff8a80' });
        fx.ring(cx, cy, { color: 'rgba(255,82,82,0.85)', r1: 30, life: 0.32 });
        spawnFood();
      } else if (bonus && head.x === bonus.x && head.y === bonus.y) {
        score += 5;
        ctx.sound('coin');
        eatenFlash = 0.35;
        fx.shake(5);
        fx.burst(cx, cy, { colors: ['#ffd200', '#fff59d', '#ffffff'], count: 26, speed: 230, life: 0.6, size: 4 });
        fx.pop(cx, cy - 10, '+5', { color: '#ffd200', size: 22 });
        bonus = null;
      } else {
        snake.pop();
      }

      // houd de zachte lijst even lang als de slang
      while (smooth.length < snake.length) smooth.push({ x: head.x, y: head.y });
      smooth.length = snake.length;

      paintHud();
    }

    /* ───────────────────── tekenen ───────────────────── */

    function apple(x, y, r, color, shine) {
      const cx = x * CELL + CELL / 2;
      const cy = y * CELL + CELL / 2;
      J.glow(g, color, 16, () => {
        g.fillStyle = color;
        g.beginPath();
        g.arc(cx, cy, r, 0, Math.PI * 2);
        g.fill();
      });
      // glimmertje
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.beginPath();
      g.arc(cx - r * 0.32, cy - r * 0.34, Math.max(1, r * 0.22), 0, Math.PI * 2);
      g.fill();
      if (shine) {
        g.fillStyle = '#4caf50';
        g.fillRect(cx - 1, cy - r - 4, 2, 5);
      }
    }

    function draw() {
      // 1) achtergrond wissen (vóór het schudden, anders zie je randen)
      g.fillStyle = J.vgrad(g, 0, H, '#0c1020', '#070a12');
      g.fillRect(0, 0, W, H);

      fx.begin();

      // 2) raster met zachte gloed in het midden
      g.strokeStyle = 'rgba(0,230,118,0.06)';
      g.lineWidth = 1;
      g.beginPath();
      for (let i = 1; i < COLS; i++) {
        g.moveTo(i * CELL, 0); g.lineTo(i * CELL, H);
        g.moveTo(0, i * CELL); g.lineTo(W, i * CELL);
      }
      g.stroke();
      J.blob(g, W / 2, H / 2, W * 0.55, 'rgba(0,230,118,0.10)', 1);

      // 3) appel (ademt) en bonus (draait)
      pulse += 0.12;
      const pr = 1 + Math.sin(pulse) * 0.1;
      apple(food.x, food.y, (CELL / 2 - 3) * pr, '#ff5252', true);

      if (bonus) {
        const cx = bonus.x * CELL + CELL / 2;
        const cy = bonus.y * CELL + CELL / 2;
        const a = pulse * 1.6;
        J.glow(g, '#ffd200', 18, () => {
          g.fillStyle = '#ffd200';
          g.save();
          g.translate(cx, cy);
          g.rotate(a);
          g.beginPath();
          for (let i = 0; i < 10; i++) {
            const r = i % 2 === 0 ? CELL / 2 - 1 : CELL / 5;
            const ang = (Math.PI * 2 * i) / 10;
            g.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
          }
          g.closePath();
          g.fill();
          g.restore();
        });
      }

      // 4) slang — zachte tussenposities maken hem vloeiend
      const k = J.clamp(timer / delay, 0, 1);
      for (let i = 0; i < smooth.length; i++) {
        const target = snake[i];
        const s = smooth[i];
        s.x = J.lerp(s.x, target.x, alive ? Math.min(1, k * 1.6 + 0.35) : 1);
        s.y = J.lerp(s.y, target.y, alive ? Math.min(1, k * 1.6 + 0.35) : 1);
      }

      for (let i = snake.length - 1; i >= 0; i--) {
        const t = i / Math.max(1, snake.length - 1);
        const s = smooth[i];
        const px = s.x * CELL;
        const py = s.y * CELL;
        const green = Math.round(230 - t * 90);
        const col = i === 0 ? '#00e676' : 'rgb(0,' + green + ',110)';
        const pad = i === 0 ? 1 : 2 + t * 1.6;

        if (i === 0 || i % 3 === 0) {
          J.glow(g, '#00e676', i === 0 ? 18 : 9, () => {
            g.fillStyle = col;
            J.roundRect(g, px + pad, py + pad, CELL - pad * 2, CELL - pad * 2, 6);
          });
        } else {
          g.fillStyle = col;
          J.roundRect(g, px + pad, py + pad, CELL - pad * 2, CELL - pad * 2, 6);
        }
        // lichtstreepje bovenop elk segment
        g.fillStyle = 'rgba(255,255,255,0.12)';
        g.fillRect(px + pad + 2, py + pad + 1, CELL - pad * 2 - 4, 2);
      }

      // 5) kop: ogen met pupil en een tong die af en toe fladdert
      const head = smooth[0];
      const cxp = head.x * CELL + CELL / 2;
      const cyp = head.y * CELL + CELL / 2;
      const ox = dir.x * 3.5;
      const oy = dir.y * 3.5;
      const px = dir.y * 4.5;
      const py = dir.x * 4.5;

      g.fillStyle = '#ffffff';
      g.beginPath();
      g.arc(cxp + ox + px, cyp + oy + py, 3.4, 0, Math.PI * 2);
      g.arc(cxp + ox - px, cyp + oy - py, 3.4, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#04150c';
      g.beginPath();
      g.arc(cxp + ox * 1.5 + px, cyp + oy * 1.5 + py, 1.7, 0, Math.PI * 2);
      g.arc(cxp + ox * 1.5 - px, cyp + oy * 1.5 - py, 1.7, 0, Math.PI * 2);
      g.fill();

      tongue += 0.08;
      if (alive && Math.sin(tongue) > 0.72) {
        g.strokeStyle = '#ff4081';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(cxp + dir.x * 8, cyp + dir.y * 8);
        g.lineTo(cxp + dir.x * 16, cyp + dir.y * 16);
        g.stroke();
      }

      // 6) flits als je net gegeten hebt
      if (eatenFlash > 0) {
        g.globalAlpha = eatenFlash * 0.5;
        g.fillStyle = '#ffffff';
        g.fillRect(0, 0, W, H);
        g.globalAlpha = 1;
      }

      if (!alive) {
        g.fillStyle = 'rgba(255,82,82,0.2)';
        g.fillRect(0, 0, W, H);
      }

      fx.vignette(0.5);
      fx.end();
    }

    return {
      init: reset,
      reset: reset,
      update(dt) {
        fx.update(dt);
        if (eatenFlash > 0) eatenFlash = Math.max(0, eatenFlash - dt);
        if (!alive) { draw(); return; }
        timer += dt;
        while (timer >= delay) {
          timer -= delay;
          step();
          if (!alive) break;
        }
        draw();
      },
      onDir(d) {
        if (!alive) return;
        const map = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
        const want = map[d];
        if (!want) return;
        // Niet in één beweging omdraaien, anders vlieg je in je eigen nek.
        if (want.x === -dir.x && want.y === -dir.y) return;
        nextDir = want;
      },
      onAction(t) {
        if (t === 'down') ctx.sound('tap');
      },
    };
  };
})(typeof self !== 'undefined' ? self : globalThis);
