/**
 * SpaceBlox — juice (effectenlaag)
 *
 * Alles wat een spel "lekker" maakt zit hier: deeltjes, schermschudden,
 * zwevende scoretekst, schokgolven, sterrenvelden en gloed. Eén module,
 * gedeeld door alle canvas-spellen, zodat elk spel hetzelfde gevoel heeft
 * en geen enkel spel zijn eigen deeltjessysteem opnieuw hoeft te schrijven.
 *
 * Gebruik in een spel:
 *
 *   const fx = SBJuice.fx(ctx.ctx2d, { w: W, h: H });
 *   ...
 *   // in update(dt):
 *   fx.update(dt);
 *   // in render():
 *   g.fillStyle = '#000'; g.fillRect(0, 0, W, H);   // eerst wissen
 *   fx.begin();                                     // schudden
 *   ... teken de wereld ...
 *   fx.end();                                       // deeltjes eroverheen
 *
 * Triggers:
 *   fx.burst(x, y, { colors: ['#ffd200'], count: 16 })
 *   fx.pop(x, y, '+1', { color: '#ffd200' })
 *   fx.ring(x, y, { color: '#00e676' })
 *   fx.shake(6)
 *   fx.trail(x, y, { color: '#fff' })
 *
 * De module heeft geen DOM en geen canvas nodig om geladen te worden, dus hij
 * doet ook gewoon mee in de Node-tests.
 */
(function (root) {
  'use strict';

  /* ───────────────────────── helpers ───────────────────────── */

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function randInt(a, b) { return Math.floor(rand(a, b + 1)); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function ease(t) { return 1 - Math.pow(1 - clamp(t, 0, 1), 3); }

  /** Afgeronde rechthoek; valt terug op arcTo als roundRect er niet is. */
  function roundRect(g, x, y, w, h, r) {
    const rr = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
    g.beginPath();
    if (g.roundRect) {
      g.roundRect(x, y, w, h, rr);
    } else {
      g.moveTo(x + rr, y);
      g.arcTo(x + w, y, x + w, y + h, rr);
      g.arcTo(x + w, y + h, x, y + h, rr);
      g.arcTo(x, y + h, x, y, rr);
      g.arcTo(x, y, x + w, y, rr);
      g.closePath();
    }
    g.fill();
  }

  /** Teken iets met gloed eromheen en zet de schaduw daarna netjes terug. */
  function glow(g, color, blur, fn) {
    const b = g.shadowBlur;
    const c = g.shadowColor;
    g.shadowColor = color;
    g.shadowBlur = blur;
    fn();
    g.shadowBlur = b;
    g.shadowColor = c;
  }

  /**
   * Verticale kleurverloop. jsdom (in de tests) geeft een namaakobject terug
   * zonder addColorStop-problemen, dus dit werkt overal.
   */
  function vgrad(g, y0, y1, c0, c1) {
    const grd = g.createLinearGradient(0, y0, 0, y1);
    grd.addColorStop(0, c0);
    grd.addColorStop(1, c1);
    return grd;
  }

  function hgrad(g, x0, x1, c0, c1) {
    const grd = g.createLinearGradient(x0, 0, x1, 0);
    grd.addColorStop(0, c0);
    grd.addColorStop(1, c1);
    return grd;
  }

  /** Zachte radiale lichtvlek — de goedkope truc voor "neon". */
  function blob(g, x, y, r, color, alpha) {
    const grd = g.createRadialGradient(x, y, 0, x, y, Math.max(0.01, r));
    grd.addColorStop(0, color);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    const old = g.globalAlpha;
    g.globalAlpha = alpha === undefined ? 1 : alpha;
    g.fillStyle = grd;
    g.beginPath();
    g.arc(x, y, Math.max(0.01, r), 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = old;
  }

  /* ───────────────────────── sterrenveld ───────────────────── */

  /**
   * Drie lagen sterren die op verschillende snelheden voorbij schuiven.
   * Zorgt in vijf regels code voor diepte in elk ruimtespel.
   */
  function starfield(g, opts) {
    const o = opts || {};
    const W = o.w || 480;
    const H = o.h || 480;
    const dir = o.dir || 'down';       // 'down' | 'left' | 'up'
    const count = o.count || 70;
    const colors = o.colors || ['#ffffff', '#bfe9ff', '#ffd6f5', '#fff3b0'];
    const stars = [];

    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        z: 0.35 + Math.random() * 0.9,          // diepte: groter = dichterbij
        c: pick(colors),
      });
    }

    return {
      stars: stars,
      update(dt, speed) {
        const v = (speed === undefined ? 26 : speed);
        for (let i = 0; i < stars.length; i++) {
          const s = stars[i];
          if (dir === 'down') s.y += v * s.z * dt;
          else if (dir === 'up') s.y -= v * s.z * dt;
          else s.x -= v * s.z * dt;
          if (s.y > H) { s.y = -2; s.x = Math.random() * W; }
          if (s.y < -2) { s.y = H; s.x = Math.random() * W; }
          if (s.x < -2) { s.x = W; s.y = Math.random() * H; }
          if (s.x > W + 2) { s.x = -2; s.y = Math.random() * H; }
        }
      },
      draw(g2) {
        const c = g2 || g;
        for (let i = 0; i < stars.length; i++) {
          const s = stars[i];
          const r = s.z * (o.size || 1.5);
          c.globalAlpha = 0.25 + s.z * 0.6;
          c.fillStyle = s.c;
          c.fillRect(s.x, s.y, r, r * (dir === 'left' ? 2.2 : 1));
        }
        c.globalAlpha = 1;
      },
    };
  }

  /* ───────────────────────── de effectenmotor ──────────────── */

  const MAX_PARTS = 420;

  function fx(g, opts) {
    const o = opts || {};
    const W = o.w || 480;
    const H = o.h || 480;

    let parts = [];
    let pops = [];
    let rings = [];
    let shakeMag = 0;
    let shakeDecay = 0;
    let time = 0;

    function push(p) {
      if (parts.length >= MAX_PARTS) parts.shift();
      parts.push(p);
    }

    /**
     * Een wolk deeltjes. Vorm 'square' past bij de blokkenwereld,
     * 'spark' tekent een kort streepje in de bewegingsrichting.
     */
    function burst(x, y, conf) {
      const c = conf || {};
      const n = Math.round(c.count || 14);
      const speed = c.speed || 170;
      const life = c.life || 0.55;
      const colors = c.colors || ['#ffffff'];
      for (let i = 0; i < n; i++) {
        const a = c.angle === undefined
          ? Math.random() * Math.PI * 2
          : c.angle + rand(-(c.spread || 0.6), (c.spread || 0.6));
        const sp = speed * rand(0.35, 1.15);
        push({
          x: x, y: y,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: life * rand(0.7, 1.25), max: life * 1.25,
          size: (c.size || 3.4) * rand(0.6, 1.5),
          color: pick(colors),
          shape: c.shape || 'square',
          grav: c.grav === undefined ? 240 : c.grav,
          drag: c.drag === undefined ? 0.9 : c.drag,
          rot: Math.random() * Math.PI,
          vr: rand(-9, 9),
          glow: c.glow !== false,
        });
      }
      if (c.shake) shake(c.shake);
      return n;
    }

    /** Kleine, snelle vonken — voor botsingen en rakelinge passes. */
    function spark(x, y, conf) {
      return burst(x, y, Object.assign({
        count: 8, speed: 220, life: 0.28, size: 2.2,
        shape: 'spark', grav: 60, glow: true,
      }, conf || {}));
    }

    /** Kort stofwolkje op de grond. */
    function dust(x, y, conf) {
      return burst(x, y, Object.assign({
        count: 7, speed: 60, life: 0.4, size: 3.2, colors: ['rgba(255,255,255,0.55)'],
        shape: 'circle', grav: -40, glow: false,
      }, conf || {}));
    }

    /** Zwevende tekst ("+1", "COMBO x3") die omhoog zweeft en uitdooft. */
    function pop(x, y, text, conf) {
      const c = conf || {};
      pops.push({
        x: x, y: y, text: String(text),
        vy: c.vy === undefined ? -46 : c.vy,
        vx: c.vx || 0,
        life: c.life || 0.85, max: c.life || 0.85,
        size: c.size || 17,
        color: c.color || '#ffffff',
        outline: c.outline === undefined ? 'rgba(0,0,0,0.55)' : c.outline,
        weight: c.weight || 800,
      });
      if (pops.length > 40) pops.shift();
    }

    /** Uitdijende ring — het "impact"-effect. */
    function ring(x, y, conf) {
      const c = conf || {};
      rings.push({
        x: x, y: y,
        r: c.r0 || 4,
        r1: c.r1 || 46,
        life: c.life || 0.4, max: c.life || 0.4,
        color: c.color || '#ffffff',
        width: c.width || 3,
      });
      if (rings.length > 24) rings.shift();
    }

    /** Spoor-puntje: blijft even hangen en dooft uit. */
    function trail(x, y, conf) {
      const c = conf || {};
      push({
        x: x, y: y, vx: 0, vy: 0,
        life: c.life || 0.28, max: c.life || 0.28,
        size: c.size || 5, color: c.color || '#ffffff',
        shape: 'circle', grav: 0, drag: 1, rot: 0, vr: 0,
        glow: true,
      });
    }

    /** Schermschudden: hoe groter het getal, hoe heftiger. */
    function shake(mag) {
      shakeMag = Math.min(26, Math.max(shakeMag, mag || 0));
      shakeDecay = 0;
    }

    function update(dt) {
      time += dt;

      if (shakeMag > 0.05) {
        shakeDecay += dt;
        shakeMag *= Math.pow(0.0016, dt);   // ~e-folding in 1/6 s
      } else {
        shakeMag = 0;
      }

      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life -= dt;
        if (p.life <= 0) { parts.splice(i, 1); continue; }
        p.vy += p.grav * dt;
        const d = Math.pow(p.drag, dt * 60);
        p.vx *= d; p.vy *= d;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
      }

      for (let i = pops.length - 1; i >= 0; i--) {
        const t = pops[i];
        t.life -= dt;
        if (t.life <= 0) { pops.splice(i, 1); continue; }
        t.y += t.vy * dt;
        t.x += t.vx * dt;
        t.vy *= Math.pow(0.35, dt);
      }

      for (let i = rings.length - 1; i >= 0; i--) {
        rings[i].life -= dt;
        if (rings[i].life <= 0) rings.splice(i, 1);
      }
    }

    /** Zet de schud-transformatie klaar. Eerst het scherm wissen, dan dit. */
    function begin() {
      g.save();
      if (shakeMag > 0.05) {
        const a = Math.random() * Math.PI * 2;
        g.translate(Math.cos(a) * shakeMag, Math.sin(a) * shakeMag * 0.7);
      }
    }

    /** Herstelt de transformatie en tekent deeltjes, ringen en tekst. */
    function end() {
      g.restore();

      // ringen
      for (let i = 0; i < rings.length; i++) {
        const r = rings[i];
        const t = 1 - r.life / r.max;
        g.globalAlpha = 1 - t;
        g.strokeStyle = r.color;
        g.lineWidth = r.width * (1 - t * 0.6);
        g.beginPath();
        g.arc(r.x, r.y, lerp(r.r, r.r1, ease(t)), 0, Math.PI * 2);
        g.stroke();
      }
      g.globalAlpha = 1;

      // deeltjes
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        const t = clamp(p.life / p.max, 0, 1);
        g.globalAlpha = t;
        g.fillStyle = p.color;
        if (p.glow) { g.shadowColor = p.color; g.shadowBlur = 8; }
        if (p.shape === 'circle') {
          g.beginPath();
          g.arc(p.x, p.y, p.size * (0.4 + t * 0.6), 0, Math.PI * 2);
          g.fill();
        } else if (p.shape === 'spark') {
          const len = Math.min(14, Math.hypot(p.vx, p.vy) * 0.035 + 3);
          const a = Math.atan2(p.vy, p.vx);
          g.strokeStyle = p.color;
          g.lineWidth = Math.max(1, p.size * 0.7);
          g.beginPath();
          g.moveTo(p.x, p.y);
          g.lineTo(p.x - Math.cos(a) * len, p.y - Math.sin(a) * len);
          g.stroke();
        } else {
          g.save();
          g.translate(p.x, p.y);
          g.rotate(p.rot);
          const s = p.size * (0.4 + t * 0.6);
          g.fillRect(-s / 2, -s / 2, s, s);
          g.restore();
        }
        g.shadowBlur = 0;
      }
      g.globalAlpha = 1;

      // zwevende tekst
      for (let i = 0; i < pops.length; i++) {
        const t = pops[i];
        const k = clamp(t.life / t.max, 0, 1);
        g.globalAlpha = k > 0.7 ? 1 : k / 0.7;
        g.font = t.weight + ' ' + t.size + "px 'Hanken Grotesk', system-ui, sans-serif";
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        const sc = 1 + (1 - k) * 0.25;
        g.save();
        g.translate(t.x, t.y);
        g.scale(sc, sc);
        if (t.outline) {
          g.strokeStyle = t.outline;
          g.lineWidth = 3.5;
          g.lineJoin = 'round';
          g.strokeText(t.text, 0, 0);
        }
        g.fillStyle = t.color;
        g.fillText(t.text, 0, 0);
        g.restore();
      }
      g.globalAlpha = 1;
      g.textAlign = 'start';
      g.textBaseline = 'alphabetic';
    }

    /** Witte flits over het hele scherm (level gehaald, power-up). */
    function flash(alpha) {
      g.save();
      g.globalAlpha = clamp(alpha === undefined ? 0.35 : alpha, 0, 1);
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, W, H);
      g.restore();
    }

    /** Donkere randen: maakt elk speelveld meteen "af". */
    function vignette(strength) {
      const s = strength === undefined ? 0.42 : strength;
      const grd = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.32, W / 2, H / 2, Math.max(W, H) * 0.72);
      grd.addColorStop(0, 'rgba(0,0,0,0)');
      grd.addColorStop(1, 'rgba(0,0,0,' + s + ')');
      g.fillStyle = grd;
      g.fillRect(0, 0, W, H);
    }

    /** Versnellingsstrepen langs de randen — voor racespellen. */
    function speedLines(speed, color) {
      const n = Math.round(clamp(speed, 0, 1) * 16);
      g.strokeStyle = color || 'rgba(255,255,255,0.35)';
      g.lineWidth = 2;
      for (let i = 0; i < n; i++) {
        const edge = i % 2 ? 0 : 1;
        const x = edge ? W - rand(2, 26) : rand(2, 26);
        const y = Math.random() * H;
        const len = rand(18, 70) * (0.4 + speed);
        g.globalAlpha = rand(0.15, 0.5);
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x, y + len);
        g.stroke();
      }
      g.globalAlpha = 1;
    }

    function clear() {
      parts = [];
      pops = [];
      rings = [];
      shakeMag = 0;
    }

    return {
      burst: burst, spark: spark, dust: dust, pop: pop, ring: ring,
      trail: trail, shake: shake, update: update, begin: begin, end: end,
      flash: flash, vignette: vignette, speedLines: speedLines, clear: clear,
      get count() { return parts.length; },
      get shaking() { return shakeMag > 0.05; },
      get t() { return time; },
    };
  }

  /* ──────────────── Roblox-minifig (voor canvas-spellen) ─────── */

  /**
   * Tekent een Roblox-achtige blokjespop, verankerd op de voeten.
   * Gele kop met gezicht, gekleurd shirt, broek, en armen/benen die
   * meebewegen met `walk`. Werkt met alleen fillRect/translate/rotate.
   *
   * o: { h, shirt, pants, head, walk, facing(1|-1), jump, tilt }
   */
  function minifig(g, x, feetY, o) {
    o = o || {};
    const h = o.h || 44;
    const legH = h * 0.34;
    const torsoH = h * 0.34;
    const headH = h * 0.26;
    const torsoW = h * 0.42;
    const legW = h * 0.17;
    const armW = h * 0.13;
    const armL = torsoH * 0.92;
    const walk = o.walk || 0;
    const face = o.facing || 1;
    const swing = Math.sin(walk) * (o.jump ? 0.2 : 0.5);

    const shirt = o.shirt || '#00a2ff';
    const pants = o.pants || '#2b3a52';
    const headC = o.head || '#ffd23c';

    const hipY = feetY - legH;
    const torsoTop = hipY - torsoH;

    g.save();
    g.translate(x, 0);
    if (o.tilt) g.rotate(o.tilt * face);

    // armen (achter de romp) — zwaaien tegenovergesteld aan de benen
    const armY = torsoTop + torsoH * 0.12;
    g.fillStyle = shirt;
    g.save();
    g.translate(-torsoW / 2 - armW / 2, armY);
    g.rotate(swing);
    roundRect(g, -armW / 2, 0, armW, armL, armW / 2.4);
    g.restore();
    g.save();
    g.translate(torsoW / 2 + armW / 2, armY);
    g.rotate(-swing);
    roundRect(g, -armW / 2, 0, armW, armL, armW / 2.4);
    g.restore();

    // benen
    g.fillStyle = pants;
    g.save();
    g.translate(-legW * 0.6, hipY);
    g.rotate(-swing * 0.8);
    roundRect(g, -legW / 2, 0, legW, legH, legW / 3);
    g.restore();
    g.save();
    g.translate(legW * 0.6, hipY);
    g.rotate(swing * 0.8);
    roundRect(g, -legW / 2, 0, legW, legH, legW / 3);
    g.restore();

    // romp met licht randje
    g.fillStyle = shirt;
    roundRect(g, -torsoW / 2, torsoTop, torsoW, torsoH, torsoW / 6);
    g.fillStyle = 'rgba(255,255,255,0.16)';
    g.fillRect(-torsoW / 2 + 2, torsoTop + 2, torsoW - 4, 3);

    // kop (geel, klassiek Roblox) met gezicht dat meekijkt
    const headW = h * 0.3;
    const headTop = torsoTop - headH - 1;
    g.fillStyle = headC;
    roundRect(g, -headW / 2, headTop, headW, headH, headW / 4);
    // ogen + glimlach
    const ex = face * headW * 0.14;
    g.fillStyle = '#1c1e20';
    g.fillRect(-headW * 0.2 + ex, headTop + headH * 0.32, headW * 0.12, headH * 0.2);
    g.fillRect(headW * 0.1 + ex, headTop + headH * 0.32, headW * 0.12, headH * 0.2);
    g.fillRect(-headW * 0.12 + ex, headTop + headH * 0.66, headW * 0.28, headH * 0.1);

    g.restore();
  }

  /**
   * Roblox-"studs": een rij bolletjes bovenop een blok, zodat elk platform
   * eruitziet als een bouwsteen.
   */
  function studs(g, x, y, w, color) {
    const step = 14;
    g.fillStyle = color || 'rgba(255,255,255,0.18)';
    for (let sx = x + 7; sx < x + w - 4; sx += step) {
      g.beginPath();
      g.arc(sx, y, 2.6, Math.PI, 0);
      g.fill();
    }
  }

  /* ───────────────── DOM-effecten (voor niet-canvas spellen) ─ */

  /**
   * Confetti-regen over de hele pagina. Bouwt zelf een canvas-overlay en
   * ruimt die weer op. Doet niets als er geen document is (Node-tests).
   */
  function confetti(opts) {
    const o = opts || {};
    if (typeof document === 'undefined' || !document.body) return null;
    const dpr = Math.min(root.devicePixelRatio || 1, 2);
    const cv = document.createElement('canvas');
    cv.className = 'sb-confetti';
    cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999';
    cv.width = Math.round(root.innerWidth * dpr);
    cv.height = Math.round(root.innerHeight * dpr);
    document.body.appendChild(cv);
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    const colors = o.colors || ['#00b06f', '#00a2ff', '#ffd200', '#ff4081', '#7c4dff', '#ffffff'];
    const pieces = [];
    const n = o.count || 130;
    for (let i = 0; i < n; i++) {
      pieces.push({
        x: Math.random() * root.innerWidth,
        y: -20 - Math.random() * root.innerHeight * 0.6,
        vx: rand(-60, 60), vy: rand(120, 340),
        w: rand(6, 12), h: rand(8, 16),
        rot: Math.random() * Math.PI, vr: rand(-8, 8),
        c: pick(colors),
      });
    }

    let raf = null;
    let last = 0;
    let life = o.life || 2.6;

    function frame(ts) {
      const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0.016;
      last = ts;
      life -= dt;
      g.clearRect(0, 0, root.innerWidth, root.innerHeight);
      for (let i = 0; i < pieces.length; i++) {
        const p = pieces[i];
        p.vy += 260 * dt;
        p.x += (p.vx + Math.sin((ts / 300) + i) * 22) * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.rot);
        g.fillStyle = p.c;
        g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.rot)));
        g.restore();
      }
      if (life > 0 && cv.isConnected) raf = root.requestAnimationFrame(frame);
      else if (cv.parentNode) cv.parentNode.removeChild(cv);
    }
    raf = root.requestAnimationFrame(frame);
    return { stop() { if (raf) root.cancelAnimationFrame(raf); if (cv.parentNode) cv.parentNode.removeChild(cv); } };
  }

  /**
   * Laat een DOM-element even "springen". Puur CSS-klasse; de animatie zelf
   * staat in app.css, dus zonder stylesheet gebeurt er gewoon niets.
   */
  function bounce(node) {
    if (!node || !node.classList) return;
    node.classList.remove('sb-bounce');
    // reflow afdwingen, anders pakt de browser de herstart van de animatie niet
    void node.offsetWidth;
    node.classList.add('sb-bounce');
  }

  function ripple(node) {
    if (!node || !node.classList) return;
    node.classList.remove('sb-ripple');
    void node.offsetWidth;
    node.classList.add('sb-ripple');
  }

  /* ───────────────────────── export ────────────────────────── */

  const api = {
    fx: fx,
    starfield: starfield,
    minifig: minifig,
    studs: studs,
    confetti: confetti,
    bounce: bounce,
    ripple: ripple,
    roundRect: roundRect,
    glow: glow,
    blob: blob,
    vgrad: vgrad,
    hgrad: hgrad,
    clamp: clamp,
    lerp: lerp,
    rand: rand,
    randInt: randInt,
    pick: pick,
    ease: ease,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SBJuice = api;
})(typeof self !== 'undefined' ? self : globalThis);
