/**
 * Neon Snake
 * Eet appels, word langer, raak jezelf of de muur niet.
 * Snelheid loopt op naarmate je groeit — dat is de hele uitdaging.
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
    const W = ctx.logical.w;
    const H = ctx.logical.h;
    const CELL = W / COLS;

    let snake, dir, nextDir, food, bonus, delay, timer, score, alive;
    let pulse = 0;

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
        if (rest.length) bonus = rest[Math.floor(Math.random() * rest.length)];
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
        ctx.onEnd({ score: score });
        return;
      }

      snake.unshift(head);

      if (head.x === food.x && head.y === food.y) {
        score += 1;
        delay = Math.max(MIN_DELAY, START_DELAY - score * 0.004);
        ctx.sound('eat');
        spawnFood();
      } else if (bonus && head.x === bonus.x && head.y === bonus.y) {
        score += 5;
        ctx.sound('coin');
        bonus = null;
      } else {
        snake.pop();
      }
      paintHud();
    }

    function roundRect(x, y, w, h, r) {
      g.beginPath();
      if (g.roundRect) g.roundRect(x, y, w, h, r);
      else g.rect(x, y, w, h);
      g.fill();
    }

    function draw() {
      g.fillStyle = '#0a0a12';
      g.fillRect(0, 0, W, H);

      // subtiel raster
      g.strokeStyle = 'rgba(255,255,255,0.035)';
      g.lineWidth = 1;
      g.beginPath();
      for (let i = 1; i < COLS; i++) {
        g.moveTo(i * CELL, 0); g.lineTo(i * CELL, H);
        g.moveTo(0, i * CELL); g.lineTo(W, i * CELL);
      }
      g.stroke();

      // appel
      pulse += 0.12;
      const pr = 1 + Math.sin(pulse) * 0.08;
      g.fillStyle = '#ff5252';
      g.beginPath();
      g.arc(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, (CELL / 2 - 3) * pr, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#4caf50';
      g.fillRect(food.x * CELL + CELL / 2 - 1, food.y * CELL + 3, 2, 4);

      if (bonus) {
        g.fillStyle = '#ffd200';
        g.beginPath();
        g.arc(bonus.x * CELL + CELL / 2, bonus.y * CELL + CELL / 2, CELL / 2 - 2, 0, Math.PI * 2);
        g.fill();
      }

      // slang: kleur verloopt van kop naar staart
      for (let i = snake.length - 1; i >= 0; i--) {
        const t = i / Math.max(1, snake.length - 1);
        const green = Math.round(230 - t * 90);
        g.fillStyle = i === 0 ? '#00e676' : 'rgb(0,' + green + ',110)';
        const pad = i === 0 ? 1 : 2;
        roundRect(snake[i].x * CELL + pad, snake[i].y * CELL + pad, CELL - pad * 2, CELL - pad * 2, 5);
      }

      // oogjes op de kop
      const head = snake[0];
      g.fillStyle = '#04150c';
      const cxp = head.x * CELL + CELL / 2;
      const cyp = head.y * CELL + CELL / 2;
      const ox = dir.x * 3;
      const oy = dir.y * 3;
      const px = dir.y * 4;
      const py = dir.x * 4;
      g.beginPath();
      g.arc(cxp + ox + px, cyp + oy + py, 2, 0, Math.PI * 2);
      g.arc(cxp + ox - px, cyp + oy - py, 2, 0, Math.PI * 2);
      g.fill();

      if (!alive) {
        g.fillStyle = 'rgba(255,82,82,0.18)';
        g.fillRect(0, 0, W, H);
      }
    }

    return {
      init: reset,
      reset: reset,
      update(dt) {
        if (!alive) return;
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
