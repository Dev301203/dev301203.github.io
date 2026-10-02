// Generative river system drawn in manga ink: solid black water, hatched banks,
// cross-hatched uplands, halftone lowlands, and current lines that part around the cursor.
(function () {
  'use strict';

  var root = document.getElementById('river-art');
  if (!root) return;

  var panel = root.parentElement;
  var A = window.anime;
  var params = new URLSearchParams(window.location.search);
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canAnimate = !!A && !reduceMotion && !params.has('static');

  var STEP = 4;
  var TAU = Math.PI * 2;
  // Fraction of the intro spent running the water downstream; the rest inks the land.
  var WATER_END = 0.6;

  // ── Random + noise ─────────────────────────
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function makeNoise(rng) {
    var p = new Uint8Array(512), i, j, t;
    for (i = 0; i < 256; i++) p[i] = i;
    for (i = 255; i > 0; i--) { j = (rng() * (i + 1)) | 0; t = p[i]; p[i] = p[j]; p[j] = t; }
    for (i = 0; i < 256; i++) p[256 + i] = p[i];
    function lat(ix, iy) { return p[p[ix & 255] + (iy & 255)] / 255; }
    function n2(x, y) {
      var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      var a = lat(xi, yi), b = lat(xi + 1, yi), c = lat(xi, yi + 1), d = lat(xi + 1, yi + 1);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    }
    function fbm(x, y) {
      return n2(x, y) * 0.55 + n2(x * 2.03 + 11.7, y * 2.03 + 5.3) * 0.3 + n2(x * 4.1 + 3.1, y * 4.1 + 9.2) * 0.15;
    }
    return { n2: n2, fbm: fbm };
  }

  // ── Scene generation ───────────────────────
  function buildScene(seed, W, H) {
    var rng = mulberry32(seed);
    var noise = makeNoise(rng);
    var S = Math.max(0.55, Math.min(1.25, Math.sqrt(W * H) / 1140));
    var mouthW = Math.max(36, Math.min(116, W * 0.075));

    var cell = 32, grid = {};
    function gridAdd(x, y, id, i, r) {
      var key = Math.floor(x / cell) + ':' + Math.floor(y / cell);
      (grid[key] || (grid[key] = [])).push({ x: x, y: y, id: id, i: i, r: r });
    }

    function hits(x, y, spec, xs, ys) {
      var cx = Math.floor(x / cell), cy = Math.floor(y / cell), dx, dy, list, k, e, ddx, ddy;
      for (dx = -3; dx <= 3; dx++) {
        for (dy = -3; dy <= 3; dy++) {
          list = grid[(cx + dx) + ':' + (cy + dy)];
          if (!list) continue;
          for (k = 0; k < list.length; k++) {
            e = list[k];
            if (e.id === spec.parent && Math.abs(e.i - spec.attach) < spec.ignore) continue;
            ddx = e.x - x; ddy = e.y - y;
            if (ddx * ddx + ddy * ddy < e.r * e.r) return true;
          }
        }
      }
      var selfR = 14 * S;
      for (k = 0; k < xs.length - 26; k += 2) {
        ddx = xs[k] - x; ddy = ys[k] - y;
        if (ddx * ddx + ddy * ddy < selfR * selfR) return true;
      }
      return false;
    }

    // Streams are grown upstream from where they join, so index 0 is always the downstream end.
    function grow(spec) {
      var x = spec.x, y = spec.y, h = spec.heading, k = 0, len = 0;
      var xs = [], ys = [], exited = false;
      while (len < spec.maxLen) {
        xs.push(x); ys.push(y);
        k += (rng() - 0.5) * 2 * spec.wobble;
        k *= 0.94;
        h += k + spec.mA * Math.sin(len / spec.mL * TAU + spec.mP) + (spec.target - h) * 0.014;
        if (h > -0.14) h = -0.14;
        if (h < -Math.PI + 0.14) h = -Math.PI + 0.14;
        x += Math.cos(h) * STEP; y += Math.sin(h) * STEP; len += STEP;
        if (x < -50 || x > W + 50 || y < -50) { exited = true; break; }
        if (len > STEP * 10 && hits(x, y, spec, xs, ys)) break;
      }
      return { x: xs, y: ys, n: xs.length, exited: exited };
    }

    var branches = [];
    function addBranch(g, spec, depth) {
      var b = {
        id: branches.length, depth: depth, parent: spec.parent, attach: spec.attach,
        x: g.x, y: g.y, n: g.n, exited: g.exited, children: []
      };
      branches.push(b);
      return b;
    }

    var mouthX = W * (0.6 + 0.14 * rng());
    var trunkSpec = {
      x: mouthX, y: H + 30, heading: -Math.PI / 2 + (rng() - 0.5) * 0.3,
      target: -Math.PI / 2 - 0.1 - rng() * 0.16, wobble: 0.008,
      mA: 0.046, mL: (360 + rng() * 180) * S, mP: rng() * TAU,
      maxLen: (H + 120) * 1.8, parent: -1, attach: 0, ignore: 0
    };
    var trunk = addBranch(grow(trunkSpec), trunkSpec, 0);
    var i;
    for (i = 0; i < trunk.n; i++) {
      gridAdd(trunk.x[i], trunk.y[i], 0, i, mouthW * 0.5 + 18 * S);
    }

    var maxDepth = 3;
    var gapMin = [55, 50, 45], gapVar = [80, 80, 60];
    var lenMin = [0, 260, 110, 50], lenVar = [0, 600, 260, 130];
    var meanA = [0, 0.05, 0.06, 0.06], meanL = [0, 170, 110, 90], meanV = [0, 130, 80, 60];
    var queue = [trunk];
    while (queue.length) {
      var b = queue.shift();
      if (b.depth >= maxDepth) continue;
      var d = b.depth + 1;
      var s = (b.depth === 0 ? 56 : 30) * S + rng() * 60 * S;
      var side = rng() < 0.5 ? -1 : 1;
      while (s < (b.n - 1) * STEP - 30 * S) {
        var at = Math.round(s / STEP);
        var hp = Math.atan2(b.y[at + 1] - b.y[at], b.x[at + 1] - b.x[at]);
        var spec = {
          x: b.x[at], y: b.y[at],
          heading: hp + side * (0.55 + rng() * 0.6),
          target: Math.max(-Math.PI + 0.22, Math.min(-0.22, hp + side * (0.5 + rng() * 0.75))),
          wobble: d === 1 ? 0.02 : 0.025,
          mA: meanA[d], mL: (meanL[d] + rng() * meanV[d]) * S, mP: rng() * TAU,
          maxLen: (lenMin[d] + rng() * lenVar[d]) * S,
          parent: b.id, attach: at, ignore: b.depth === 0 ? 40 : 16
        };
        var g = grow(spec);
        if (g.n * STEP >= 44 * S) {
          var child = addBranch(g, spec, d);
          b.children.push(child);
          for (i = 0; i < child.n; i++) gridAdd(child.x[i], child.y[i], child.id, i, (22 - 3 * d) * S);
          queue.push(child);
        }
        side = rng() < 0.72 ? -side : side;
        s += (gapMin[b.depth] + rng() * gapVar[b.depth]) * S;
      }
    }

    // Flow accumulates downstream; width follows flow, so every confluence widens the river.
    var streamLen = 0;
    branches.forEach(function (b) { streamLen += b.n * STEP; });
    function calcFlow(b) {
      var f = new Array(b.n);
      // A stream that leaves the frame keeps going beyond it, so it arrives already carrying water.
      var acc = !b.exited ? 0 : b.depth === 0 ? streamLen * 0.5 : (140 + rng() * 320) * S;
      var kids = b.children.slice().sort(function (p, q) { return q.attach - p.attach; });
      var ki = 0, j;
      for (j = b.n - 1; j >= 0; j--) {
        while (ki < kids.length && kids[ki].attach >= j) { acc += calcFlow(kids[ki]); ki++; }
        f[j] = acc;
        acc += STEP;
      }
      b.flow = f;
      return f[0];
    }
    var total = calcFlow(trunk) || 1;

    var Dmax = 1;
    branches.forEach(function (b) {
      b.d0 = b.parent < 0 ? 0 : branches[b.parent].d0 + b.attach * STEP;
      Dmax = Math.max(Dmax, b.d0 + (b.n - 1) * STEP);
    });

    branches.forEach(function (b) {
      var n = b.n, raw = new Array(n), j, k, a, c;
      for (j = 0; j < n; j++) raw[j] = Math.max(0.45, 0.5 * mouthW * Math.pow(b.flow[j] / total, 0.7));
      b.hw = new Array(n); b.hl = new Array(n); b.hr = new Array(n);
      b.nx = new Array(n); b.ny = new Array(n); b.t = new Array(n);
      b.maxhw = 0;
      for (j = 0; j < n; j++) {
        a = 0; c = 0;
        for (k = Math.max(0, j - 5); k <= Math.min(n - 1, j + 5); k++) { a += raw[k]; c++; }
        b.hw[j] = a / c;
        b.maxhw = Math.max(b.maxhw, b.hw[j]);
        b.hl[j] = b.hw[j] * (1 + 0.44 * (noise.n2(j * STEP * 0.022, b.id * 3.7) - 0.5));
        b.hr[j] = b.hw[j] * (1 + 0.44 * (noise.n2(j * STEP * 0.022, b.id * 3.7 + 50) - 0.5));
        var j0 = Math.max(0, j - 1), j1 = Math.min(n - 1, j + 1);
        var tx = b.x[j1] - b.x[j0], ty = b.y[j1] - b.y[j0], tl = Math.sqrt(tx * tx + ty * ty) || 1;
        b.nx[j] = -ty / tl; b.ny[j] = tx / tl;
        b.t[j] = 1 - (b.d0 + j * STEP) / Dmax;
      }
    });

    var strokes = [];
    function field(x, y) { return noise.fbm(x / (240 * S), y / (240 * S)); }

    // Banks are lit from the top left. The shaded bank gets tapered hachures leaning
    // downstream; both banks get broken contour lines that follow the water's edge.
    function bankInk(b, strokes) {
      [1, -1].forEach(function (side) {
        var s = rng() * 4;
        while (s < (b.n - 1) * STEP) {
          var j = (s / STEP) | 0, w = b.hw[j];
          var ox = b.nx[j] * side, oy = b.ny[j] * side;
          var shade = ox * 0.6 + oy * 0.8;
          if (w >= 1.1 && (shade > -0.15 || rng() < 0.07)) {
            var hs = side > 0 ? b.hl[j] : b.hr[j];
            var bx = b.x[j] + ox * hs, by = b.y[j] + oy * hs;
            var lean = 0.25 + rng() * 0.4;
            // (-ny, nx) is the downstream tangent.
            var dx = ox * Math.cos(lean) - b.ny[j] * Math.sin(lean);
            var dy = oy * Math.cos(lean) + b.nx[j] * Math.sin(lean);
            var len = (4 + 30 * Math.pow(Math.min(1, noise.fbm(bx * 0.009, by * 0.009) * 1.25), 2.2)) *
              (0.5 + 0.9 * Math.min(1, w / (16 * S))) * S * (0.55 + rng() * 0.7) *
              (0.4 + 0.8 * Math.max(0, shade));
            strokes.push({
              k: 0, t: WATER_END * b.t[j] + 0.02 + rng() * 0.05,
              x0: bx, y0: by, x1: bx + dx * len, y1: by + dy * len, w: 0.9 + rng() * 0.9
            });
          }
          s += (2.4 + rng() * 2.6) * (w < 3 ? 1.8 : 1);
        }

        var rings = b.maxhw > 9 * S ? 3 : b.maxhw > 3 ? 2 : 1;
        for (var m = 1; m <= rings; m++) {
          var off = (2.5 + 5.5 * m + rng() * 2) * S, q = 3 + ((rng() * 6) | 0), run = null, left = 0;
          for (; q < b.n; q++) {
            if (left <= 0) {
              if (run && run.length >= 6) {
                strokes.push({ k: 2, t: WATER_END * b.t[q] + 0.04 + rng() * 0.05, p: run });
              }
              run = null;
              q += 2 + ((rng() * (6 + m * 5)) | 0);
              left = 6 + ((rng() * 26) | 0);
              if (q >= b.n) break;
            }
            left--;
            if (b.hw[q] < 1.6) { left = 0; continue; }
            var e = b.hw[q] + off + (noise.n2(q * 0.11, b.id * 2.3 + m * 9 + side) - 0.5) * 3 * S;
            (run || (run = [])).push(b.x[q] + b.nx[q] * side * e, b.y[q] + b.ny[q] * side * e);
          }
          if (run && run.length >= 6) {
            strokes.push({ k: 2, t: WATER_END * b.t[b.n - 1] + 0.04 + rng() * 0.05, p: run });
          }
        }
      });
    }
    branches.forEach(function (b) { bankInk(b, strokes); });

    // Upland cross-hatching: parallel line families clipped to the high parts of the field.
    var cx = W / 2, cy = H / 2, R = Math.sqrt(W * W + H * H) / 2 + 10;
    var sp = Math.max(4, 5.2 * S);
    [{ ang: -0.62, thr: 0.62, off: 0 }, { ang: 0.82, thr: 0.71, off: 0 }, { ang: -0.62, thr: 0.79, off: 0.5 }]
      .forEach(function (fam) {
        var ux = Math.cos(fam.ang), uy = Math.sin(fam.ang), vx = -uy, vy = ux;
        function flush(run) {
          if (run.length >= 6) {
            strokes.push({ k: 2, t: 0.46 + 0.3 * ((run[0] + run[1]) / (W + H)) + rng() * 0.05, p: run });
          }
        }
        for (var k = -R + fam.off * sp; k < R; k += sp) {
          var kk = k + (rng() - 0.5) * sp * 0.35, run = null;
          for (var a = -R; a <= R; a += 5) {
            var px = cx + ux * a + vx * kk, py = cy + uy * a + vy * kk;
            var inside = px > -4 && px < W + 4 && py > -4 && py < H + 4 &&
              field(px, py) > fam.thr + (rng() - 0.5) * 0.035;
            if (inside) {
              var wob = (noise.n2(px * 0.05, py * 0.05) - 0.5) * 1.6;
              (run || (run = [])).push(px + vx * wob, py + vy * wob);
            } else if (run) { flush(run); run = null; }
          }
          if (run) flush(run);
        }
      });

    // Lowland screentone: halftone dots on a 45 degree grid, sized by the field.
    var pitch = Math.max(5, 6.5 * S), c45 = Math.SQRT1_2, diag = Math.sqrt(W * W + H * H);
    for (var gk = -R; gk < R; gk += pitch) {
      for (var ga = -R; ga <= R; ga += pitch) {
        var qx = cx + c45 * ga - c45 * gk, qy = cy + c45 * ga + c45 * gk;
        if (qx < -2 || qx > W + 2 || qy < -2 || qy > H + 2) continue;
        var v = field(qx, qy);
        if (v < 0.37) {
          var rad = pitch * 0.4 * Math.min(1, (0.37 - v) / 0.16);
          if (rad > 0.5) {
            var dm = Math.sqrt((qx - mouthX) * (qx - mouthX) + (qy - H) * (qy - H)) / diag;
            strokes.push({ k: 1, t: 0.68 + 0.27 * dm + rng() * 0.02, x: qx, y: qy, r: rad });
          }
        }
      }
    }
    strokes.sort(function (p, q) { return p.t - q.t; });

    // Islands in the wide channels: lens shapes lying along the flow. The current parts
    // around them the same way it parts around the cursor.
    var islands = [], obstacles = [];
    branches.forEach(function (b) {
      if (b.depth > 1) return;
      var s = (70 + rng() * 90) * S;
      while (s < (b.n - 1) * STEP - 40) {
        var j = Math.round(s / STEP), w = b.hw[j];
        if (w > 13 * S && b.y[j] < H - 10 && b.y[j] > 10) {
          var half = Math.round(w * (1.1 + rng() * 1.6) / STEP);
          var j0 = Math.max(1, j - half), j1 = Math.min(b.n - 2, j + half);
          var u = (rng() - 0.5) * 0.9, iw = Math.min(w * 0.24, (4 + rng() * 6) * S);
          var left = [], right = [];
          for (var q = j0; q <= j1; q++) {
            var f = (q - j0) / (j1 - j0);
            var prof = Math.pow(Math.sin(f * Math.PI), 0.7) * iw * (0.8 + 0.4 * noise.n2(q * 0.3, j));
            var mx = b.x[q] + b.nx[q] * u * b.hw[q] * 0.5, my = b.y[q] + b.ny[q] * u * b.hw[q] * 0.5;
            left.push(mx + b.nx[q] * prof, my + b.ny[q] * prof);
            right.push(my - b.ny[q] * prof, mx - b.nx[q] * prof);
            if (q === j || q === Math.round(j0 + (j1 - j0) * 0.25) || q === Math.round(j0 + (j1 - j0) * 0.75)) {
              obstacles.push({ x: mx, y: my, R: iw * 2.4 + 5 });
            }
          }
          islands.push({ poly: left.concat(right.reverse()), t: WATER_END * b.t[j] + 0.02 });
        }
        s += (150 + rng() * 220) * S;
      }
    });

    // Current lines: lanes at fixed offsets from the centreline, so the middle of the
    // channel carries lines far upstream and the outer lanes exist only where it is wide.
    var dashes = [];
    var laneGap = 7 * S;
    function laneDashes(b, dashes) {
      var J = Math.floor(b.maxhw * 0.72 / laneGap);
      for (var j = -J; j <= J; j++) {
        var o = j * laneGap + (rng() - 0.5) * laneGap * 0.4;
        var need = Math.max(Math.abs(o), 2.3);
        var lo = -1, hi = -1;
        for (var q = 0; q < b.n; q++) {
          if (b.hw[q] * 0.72 > need) { if (lo < 0) lo = q; hi = q; }
        }
        if (lo < 0 || (hi - lo) * STEP < 30) continue;
        var usable = (hi - lo) * STEP;
        var count = Math.max(1, Math.round(usable / (95 * S) * (0.6 + rng() * 0.8)));
        for (var c = 0; c < count; c++) {
          dashes.push({
            b: b, o: o, lo: lo * STEP, hi: hi * STEP,
            len: Math.min(usable * 0.6, (24 + rng() * rng() * (b.depth === 0 ? 240 : 120)) * S),
            v: (30 + 45 * rng()) * S * (1 - 0.4 * Math.abs(o) / b.maxhw),
            ph: rng() * 10000, wob: rng() * TAU
          });
        }
      }
    }
    branches.forEach(function (b) { laneDashes(b, dashes); });

    var mi = 0;
    while (mi < trunk.n - 1 && trunk.y[mi] > H) mi++;

    return {
      mouth: { x: trunk.x[mi], hw: trunk.hw[mi] },
      noise: noise, rng: rng, bankInk: bankInk, laneDashes: laneDashes,
      W: W, H: H, S: S, Dmax: Dmax, branches: branches, strokes: strokes,
      islands: islands, obstacles: obstacles, dashes: dashes
    };
  }

  // ── Canvas layers ──────────────────────────
  function makeLayer() {
    var el = document.createElement('canvas');
    root.appendChild(el);
    return { el: el, ctx: el.getContext('2d') };
  }
  var land = makeLayer(), userLand = makeLayer(), water = makeLayer(), flow = makeLayer();
  var scene = null, W = 0, H = 0, dpr = 1;
  var colors = { ink: '#131312', paper: '#f1f0ea' };
  var progress = { T: 0 };
  var drawn = 0, waterT = -1, intro = null;
  var pointer = { x: 0, y: 0, tx: 0, ty: 0, k: 0, tk: 0, seen: false };

  // Visitor drawings (see Draw mode below).
  var shapes = [], user = { streams: [], ponds: [], strokes: [], dashes: [] };
  var userDirty = false, flowDashes = null, stroke = null, drawing = false;

  function readColors() {
    var cs = getComputedStyle(document.documentElement);
    colors.ink = cs.getPropertyValue('--ink').trim() || colors.ink;
    colors.paper = cs.getPropertyValue('--paper').trim() || colors.paper;
  }

  function sizeLayers() {
    W = root.clientWidth; H = root.clientHeight;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    [land, userLand, water, flow].forEach(function (l) {
      l.el.width = Math.round(W * dpr); l.el.height = Math.round(H * dpr);
      l.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    });
  }

  function resetInk() {
    land.ctx.clearRect(0, 0, W, H);
    userLand.ctx.clearRect(0, 0, W, H);
    drawn = 0; waterT = -1; userDirty = true;
  }

  function renderLand(T) {
    var st = scene.strokes, from = drawn;
    while (drawn < st.length && st[drawn].t <= T) drawn++;
    if (drawn > from) paintStrokes(land.ctx, st, from, drawn);
    if (userDirty && T >= 1) {
      userDirty = false;
      userLand.ctx.clearRect(0, 0, W, H);
      // Drawn water gets a thin margin of bare paper, which also opens the bank where it joins.
      userLand.ctx.fillStyle = colors.paper;
      user.streams.concat(user.ponds).forEach(function (shape) {
        var h = shape.halo, c = userLand.ctx;
        c.beginPath();
        c.moveTo(h[0], h[1]);
        for (var q = 2; q < h.length; q += 2) c.lineTo(h[q], h[q + 1]);
        c.closePath();
        c.fill();
      });
      paintStrokes(userLand.ctx, user.strokes, 0, user.strokes.length);
    }
  }

  function paintStrokes(ctx, st, from, drawn) {
    var i, s, j;
    ctx.fillStyle = colors.ink; ctx.strokeStyle = colors.ink;
    ctx.beginPath();
    for (i = from; i < drawn; i++) {
      s = st[i];
      if (s.k === 0) {
        var dx = s.x1 - s.x0, dy = s.y1 - s.y0, l = Math.sqrt(dx * dx + dy * dy) || 1;
        var px = -dy / l * s.w * 0.5, py = dx / l * s.w * 0.5;
        ctx.moveTo(s.x0 + px, s.y0 + py); ctx.lineTo(s.x1, s.y1); ctx.lineTo(s.x0 - px, s.y0 - py);
        ctx.closePath();
      } else if (s.k === 1) {
        ctx.moveTo(s.x + s.r, s.y); ctx.arc(s.x, s.y, s.r, 0, TAU);
      }
    }
    ctx.fill();
    ctx.lineWidth = Math.max(0.8, 0.95 * scene.S); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (i = from; i < drawn; i++) {
      s = st[i];
      if (s.k !== 2) continue;
      ctx.moveTo(s.p[0], s.p[1]);
      for (j = 2; j < s.p.length; j += 2) ctx.lineTo(s.p[j], s.p[j + 1]);
    }
    ctx.stroke();
  }

  function renderWater(T) {
    if (T === waterT) return;
    waterT = T;
    var p = Math.min(1, T / WATER_END), ctx = water.ctx;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = colors.ink;
    function fillBranch(b) {
      var i0 = Math.max(0, Math.ceil(((1 - p) * scene.Dmax - b.d0) / STEP)), i;
      if (i0 >= b.n - 1) return;
      ctx.beginPath();
      ctx.moveTo(b.x[i0] + b.nx[i0] * b.hl[i0], b.y[i0] + b.ny[i0] * b.hl[i0]);
      for (i = i0 + 1; i < b.n; i++) ctx.lineTo(b.x[i] + b.nx[i] * b.hl[i], b.y[i] + b.ny[i] * b.hl[i]);
      for (i = b.n - 1; i >= i0; i--) ctx.lineTo(b.x[i] - b.nx[i] * b.hr[i], b.y[i] - b.ny[i] * b.hr[i]);
      ctx.closePath();
      ctx.fill();
    }
    scene.branches.forEach(fillBranch);
    // Visitor drawings join the picture once the river itself has finished inking in.
    if (T >= 1) {
      user.streams.forEach(fillBranch);
      // All the pond water first, then the ripple marks, so overlapping ponds read as one.
      user.ponds.forEach(function (pond) {
        ctx.beginPath();
        ctx.moveTo(pond.poly[0], pond.poly[1]);
        for (var q = 2; q < pond.poly.length; q += 2) ctx.lineTo(pond.poly[q], pond.poly[q + 1]);
        ctx.closePath();
        ctx.fill();
      });
      ctx.strokeStyle = colors.paper; ctx.lineWidth = Math.max(1.1, 1.3 * scene.S); ctx.lineCap = 'round';
      ctx.beginPath();
      user.ponds.forEach(function (pond) {
        pond.marks.forEach(function (m) {
          ctx.moveTo(m[0], m[1]);
          ctx.quadraticCurveTo((m[0] + m[2]) / 2, m[1] + m[3], m[2], m[1]);
        });
      });
      ctx.stroke();
    }
    ctx.fillStyle = colors.paper;
    scene.islands.forEach(function (isl) {
      if (isl.t > T) return;
      ctx.beginPath();
      ctx.moveTo(isl.poly[0], isl.poly[1]);
      for (var q = 2; q < isl.poly.length; q += 2) ctx.lineTo(isl.poly[q], isl.poly[q + 1]);
      ctx.closePath();
      ctx.fill();
    });
  }

  function renderFlow(time, T) {
    var ctx = flow.ctx, S = scene.S;
    ctx.clearRect(0, 0, W, H);
    var p = Math.min(1, T / WATER_END);
    if (p <= 0) return;
    var obs = scene.obstacles, cur = null;
    if (pointer.k > 0.01) cur = { x: pointer.x, y: pointer.y, R: 96 * S * pointer.k };

    ctx.strokeStyle = colors.paper; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1.1, 1.5 * S);
    ctx.beginPath();
    var ds = flowDashes || scene.dashes, n = ds.length, i, d, b, span, head, s0, s1, s, open, idx, f, x, y, hw, oo, k, o, ex, ey, dist, push;
    for (i = 0; i < n; i++) {
      d = ds[i]; b = d.b;
      span = d.hi - d.lo + d.len;
      head = d.hi - ((d.ph + d.v * time) % span);
      s0 = Math.max(head, d.lo); s1 = Math.min(head + d.len, d.hi);
      open = false;
      for (s = s0; s <= s1; s += 6) {
        idx = s / STEP; k = idx | 0; f = idx - k;
        if (k >= b.n - 1) { k = b.n - 2; f = 1; }
        hw = b.hw[k] + (b.hw[k + 1] - b.hw[k]) * f;
        oo = d.o + Math.sin(s * 0.03 + d.wob) * 1.6 * S;
        if (Math.abs(oo) > hw * 0.74 || b.t[k] > p) { open = false; continue; }
        x = b.x[k] + (b.x[k + 1] - b.x[k]) * f + (b.nx[k] + (b.nx[k + 1] - b.nx[k]) * f) * oo;
        y = b.y[k] + (b.y[k + 1] - b.y[k]) * f + (b.ny[k] + (b.ny[k + 1] - b.ny[k]) * f) * oo;
        for (o = -1; o < obs.length; o++) {
          var ob = o < 0 ? cur : obs[o];
          if (!ob) continue;
          ex = x - ob.x; ey = y - ob.y; dist = Math.sqrt(ex * ex + ey * ey);
          if (dist < ob.R && dist > 0.001) {
            push = (1 - dist / ob.R); push = push * push * ob.R * 0.6;
            x += ex / dist * push; y += ey / dist * push;
          }
        }
        if (open) ctx.lineTo(x, y); else { ctx.moveTo(x, y); open = true; }
      }
    }
    ctx.stroke();

    // The stroke being drawn right now, as a plain brush line until it is let go.
    if (stroke && stroke.length >= 4) {
      ctx.strokeStyle = colors.ink; ctx.lineWidth = Math.max(2.5, 4 * S);
      ctx.beginPath();
      ctx.moveTo(stroke[0], stroke[1]);
      for (i = 2; i < stroke.length; i += 2) ctx.lineTo(stroke[i], stroke[i + 1]);
      ctx.stroke();
    }
  }

  // ── Draw mode ──────────────────────────────
  // A stroke drawn on the hero becomes a stream; a stroke that closes on itself becomes a
  // pond. Drawings are kept in this browser, with the seed of the river they were drawn on.
  var STORE = 'ink-drawings';

  function hyp(dx, dy) { return Math.sqrt(dx * dx + dy * dy); }

  // Even spacing and a light smoothing, so a shaky stroke reads as a brush line.
  function tidy(pts, closed) {
    var x = [pts[0]], y = [pts[1]], carry = 0, count = pts.length / 2, i;
    var total = closed ? count : count - 1;
    for (i = 0; i < total; i++) {
      var a = i * 2, b = ((i + 1) % count) * 2;
      var seg = hyp(pts[b] - pts[a], pts[b + 1] - pts[a + 1]);
      if (!seg) continue;
      var d = STEP - carry;
      while (d <= seg) {
        x.push(pts[a] + (pts[b] - pts[a]) * d / seg); y.push(pts[a + 1] + (pts[b + 1] - pts[a + 1]) * d / seg);
        d += STEP;
      }
      carry = seg - (d - STEP);
    }
    var n = x.length;
    for (var pass = 0; pass < 9; pass++) {
      var sx = x.slice(), sy = y.slice();
      for (i = 0; i < n; i++) {
        if (!closed && (i === 0 || i === n - 1)) continue;
        var p = (i - 1 + n) % n, q = (i + 1) % n;
        x[i] = (sx[p] + sx[i] * 2 + sx[q]) / 4; y[i] = (sy[p] + sy[i] * 2 + sy[q]) / 4;
      }
    }
    return { x: x, y: y };
  }

  // The nearest water to a point: a channel whose bank is within reach, or a pond.
  function nearWater(x, y, reach, channelsOnly) {
    var best = null, bestGap = reach;
    scene.branches.concat(user.streams).forEach(function (b) {
      for (var i = 0; i < b.n; i += 2) {
        var gap = hyp(b.x[i] - x, b.y[i] - y) - b.hw[i];
        if (gap < bestGap) { bestGap = gap; best = { b: b, i: i, gap: gap }; }
      }
    });
    if (!channelsOnly) {
      user.ponds.forEach(function (p) {
        var gap = inPoly(p.poly, x, y) ? -1 : hyp.apply(null, shoreOffset(p, x, y));
        if (gap < bestGap) { bestGap = gap; best = { pond: p, gap: gap }; }
      });
    }
    return best;
  }

  function inPoly(poly, x, y) {
    var inside = false;
    for (var i = 0, j = poly.length - 2; i < poly.length; j = i, i += 2) {
      if ((poly[i + 1] > y) !== (poly[j + 1] > y) &&
          x < (poly[j] - poly[i]) * (y - poly[i + 1]) / (poly[j + 1] - poly[i + 1]) + poly[i]) inside = !inside;
    }
    return inside;
  }

  // From a point to the nearest spot on a pond's shore.
  function shoreOffset(pond, x, y) {
    var best = Infinity, bx = 0, by = 0;
    for (var i = 0; i < pond.poly.length; i += 2) {
      var d = hyp(pond.poly[i] - x, pond.poly[i + 1] - y);
      if (d < best) { best = d; bx = pond.poly[i] - x; by = pond.poly[i + 1] - y; }
    }
    return [bx, by];
  }

  // Where a stream reaching (x, y) meets that water: just inside a pond's shore, so nothing
  // is drawn across the pond, or on a channel's centreline. A stream flowing into a channel
  // is carried a little way downstream first, the way tributaries join.
  function meetingPoint(hit, flowingIn, x, y) {
    if (hit.pond) {
      var off = shoreOffset(hit.pond, x, y), sx = x + off[0], sy = y + off[1];
      var inward = hyp(hit.pond.cx - sx, hit.pond.cy - sy) || 1, step = Math.min(8 * scene.S, inward * 0.5);
      return [sx + (hit.pond.cx - sx) / inward * step, sy + (hit.pond.cy - sy) / inward * step];
    }
    var b = hit.b, i = hit.i;
    if (flowingIn) i = Math.max(0, i - Math.round((b.hw[i] * 1.6 + 8) / STEP));
    return [b.x[i], b.y[i]];
  }

  // A gently bowed run from a point to that water, listed downstream end first.
  function runTo(hit, x, y) {
    var to = meetingPoint(hit, true, x, y), at = meetingPoint(hit, false, x, y);
    var ux = x - at[0], uy = y - at[1], ul = hyp(ux, uy) || 1;
    var bow = (scene.rng() - 0.5) * Math.min(60 * scene.S, ul * 0.35);
    return [
      to[0], to[1],
      at[0] + ux * 0.3 - uy / ul * bow * 0.6, at[1] + uy * 0.3 + ux / ul * bow * 0.6,
      at[0] + ux * 0.65 - uy / ul * bow, at[1] + uy * 0.65 + ux / ul * bow
    ];
  }

  // Index 0 is the downstream end, as for the generated streams. The channel widens toward
  // it. An end that meets water opens into it; a loose end runs to a point.
  function makeStream(pts, meetsDown, meetsUp, k, minTop) {
    var c = tidy(pts, false), n = c.x.length;
    if (n < 6) return null;
    var S = scene.S, noise = scene.noise;
    var top = Math.max(minTop || 2.6, Math.min(10, (n - 1) * STEP / 38)) * S;
    var b = {
      id: 500 + k, depth: 2, d0: 0, n: n, x: c.x, y: c.y, maxhw: 0,
      nx: new Array(n), ny: new Array(n), hw: new Array(n), hl: new Array(n), hr: new Array(n), t: new Array(n)
    };
    var halo = [], far = [];
    for (var i = 0; i < n; i++) {
      var i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1);
      var tx = c.x[i1] - c.x[i0], ty = c.y[i1] - c.y[i0], tl = hyp(tx, ty) || 1;
      b.nx[i] = -ty / tl; b.ny[i] = tx / tl;
      var thin = meetsUp ? 0.5 : 0.16;
      var w = top * (thin + (1 - thin) * Math.pow(1 - i / (n - 1), 0.75));
      if (meetsDown) w *= 1 + 0.6 * Math.max(0, 1 - i / 12);
      else w *= Math.min(1, (i + 1) / 7);
      w = Math.max(0.45, w);
      b.hw[i] = w;
      b.hl[i] = w * (1 + 0.4 * (noise.n2(i * STEP * 0.022, b.id * 3.7) - 0.5));
      b.hr[i] = w * (1 + 0.4 * (noise.n2(i * STEP * 0.022, b.id * 3.7 + 50) - 0.5));
      b.t[i] = 1;
      b.maxhw = Math.max(b.maxhw, w);
      halo.push(c.x[i] + b.nx[i] * (b.hl[i] + 5 * S), c.y[i] + b.ny[i] * (b.hl[i] + 5 * S));
      far.unshift(c.x[i] - b.nx[i] * (b.hr[i] + 5 * S), c.y[i] - b.ny[i] * (b.hr[i] + 5 * S));
    }
    b.halo = halo.concat(far);
    return b;
  }

  function makePond(pts, k) {
    var c = tidy(pts, true), n = c.x.length, S = scene.S, noise = scene.noise, rng = scene.rng, i;
    var cx = 0, cy = 0, reach = 0;
    for (i = 0; i < n; i++) { cx += c.x[i]; cy += c.y[i]; }
    cx /= n; cy /= n;
    var poly = [], halo = [], minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (i = 0; i < n; i++) {
      var ragged = 1 + 0.07 * (noise.n2(i * 0.09, k * 5.1) - 0.5);
      var px = cx + (c.x[i] - cx) * ragged, py = cy + (c.y[i] - cy) * ragged;
      var radius = hyp(px - cx, py - cy) || 1;
      poly.push(px, py);
      reach += radius / n;
      halo.push(px + (px - cx) / radius * 5 * S, py + (py - cy) / radius * 5 * S);
      minX = Math.min(minX, px); maxX = Math.max(maxX, px); minY = Math.min(minY, py); maxY = Math.max(maxY, py);

      // Shore hachures on the shaded side, as on the river banks.
      var p = (i - 1 + n) % n, q = (i + 1) % n;
      var tx = c.x[q] - c.x[p], ty = c.y[q] - c.y[p], tl = hyp(tx, ty) || 1;
      var ox = -ty / tl, oy = tx / tl;
      if (ox * (px - cx) + oy * (py - cy) < 0) { ox = -ox; oy = -oy; }
      var shade = ox * 0.6 + oy * 0.8;
      if (shade > -0.15 || rng() < 0.07) {
        var len = (4 + 22 * Math.pow(Math.min(1, noise.fbm(px * 0.009, py * 0.009) * 1.25), 2.2)) *
          S * (0.55 + rng() * 0.7) * (0.4 + 0.8 * Math.max(0, shade));
        var lean = (rng() - 0.5) * 0.5;
        var dx = ox * Math.cos(lean) - oy * Math.sin(lean), dy = oy * Math.cos(lean) + ox * Math.sin(lean);
        user.strokes.push({ k: 0, t: 0, x0: px, y0: py, x1: px + dx * len, y1: py + dy * len, w: 0.9 + rng() * 0.9 });
      }
    }
    // Broken contour lines just outside the shore.
    for (var m = 1; m <= 2; m++) {
      var run = null, keep = 0, off = (3 + 5.5 * m) * S;
      for (i = 0; i < n; i++) {
        if (keep <= 0) {
          if (run && run.length >= 6) user.strokes.push({ k: 2, t: 0, p: run });
          run = null;
          i += 2 + ((rng() * 6) | 0);
          keep = 5 + ((rng() * 20) | 0);
          if (i >= n) break;
        }
        keep--;
        var ex = poly[i * 2] - cx, ey = poly[i * 2 + 1] - cy, el = hyp(ex, ey) || 1;
        (run || (run = [])).push(poly[i * 2] + ex / el * off, poly[i * 2 + 1] + ey / el * off);
      }
      if (run && run.length >= 6) user.strokes.push({ k: 2, t: 0, p: run });
    }
    // Ripple marks: short strokes scattered over the water, kept clear of the shore and of
    // each other. They work for any outline, however knotted the stroke was.
    var marks = [], want = Math.max(1, Math.min(60, Math.round((maxX - minX) * (maxY - minY) / (2600 * S * S))));
    for (var tries = 0; tries < want * 14 && marks.length < want; tries++) {
      var mx = minX + rng() * (maxX - minX), my = minY + rng() * (maxY - minY), half = (6 + rng() * 11) * S;
      var clear = inPoly(poly, mx, my) && inPoly(poly, mx - half - 6 * S, my) && inPoly(poly, mx + half + 6 * S, my) &&
        inPoly(poly, mx, my - 7 * S) && inPoly(poly, mx, my + 7 * S);
      for (var e = 0; clear && e < marks.length; e++) {
        if (Math.abs(marks[e][1] - my) < 9 * S && Math.abs((marks[e][0] + marks[e][2]) / 2 - mx) < half * 2 + 10 * S) clear = false;
      }
      if (clear) marks.push([mx - half, my, mx + half, (rng() - 0.5) * 5 * S]);
    }
    return { poly: poly, marks: marks, halo: halo, cx: cx, cy: cy, reach: reach };
  }

  function addStream(b) {
    if (!b) return;
    user.streams.push(b);
    scene.bankInk(b, user.strokes);
    scene.laneDashes(b, user.dashes);
  }

  // Drawings are stored as bare strokes and joined to the water afresh on every build, so
  // they stay attached when the hero is resized.
  function buildUser() {
    user = { streams: [], ponds: [], strokes: [], dashes: [] };
    var S = scene.S;
    shapes.forEach(function (shape, k) {
      var pts = shape.p.map(function (v, i) { return v * (i % 2 ? H : W); });
      var last = pts.length - 2;
      if (shape.k === 'p') {
        var pond = makePond(pts, k);
        // A pond near a channel drains into it.
        // A pond near a channel drains into it, from the shore nearest that channel. One drawn
        // over a channel or over another pond is already part of that water.
        var drain = nearWater(pond.cx, pond.cy, pond.reach + 230 * S, true);
        var joined = user.ponds.some(function (other) { return hyp(other.cx - pond.cx, other.cy - pond.cy) < other.reach + pond.reach; });
        user.ponds.push(pond);
        if (drain && !joined && drain.gap > pond.reach * 0.8) {
          var out = meetingPoint({ pond: pond }, false, drain.b.x[drain.i], drain.b.y[drain.i]);
          addStream(makeStream(runTo(drain, out[0], out[1]).concat(out), true, true, k + 0.5, 5));
        }
        return;
      }
      var down = nearWater(pts[0], pts[1], 44 * S), up = nearWater(pts[last], pts[last + 1], 44 * S);
      if (up) pts = pts.concat(meetingPoint(up, false, pts[last], pts[last + 1]));
      if (down) pts = meetingPoint(down, true, pts[0], pts[1]).concat(pts);
      if (!down && !up) {
        // A stroke left in open land runs on to the nearest water, from whichever end is closer.
        var a = nearWater(pts[0], pts[1], 300 * S), z = nearWater(pts[last], pts[last + 1], 300 * S);
        if (z && (!a || z.gap < a.gap)) {
          var turned = [];
          for (var q = last; q >= 0; q -= 2) turned.push(pts[q], pts[q + 1]);
          pts = turned; a = z;
        }
        if (a) { pts = runTo(a, pts[0], pts[1]).concat(pts); down = a; }
      }
      addStream(makeStream(pts, !!down, !!up, k));
    });
    flowDashes = scene.dashes.concat(user.dashes);
    userDirty = true; waterT = -1;
    syncDrawUi();
  }

  function saveShapes() {
    try {
      if (shapes.length) localStorage.setItem(STORE, JSON.stringify({ seed: seed, shapes: shapes }));
      else localStorage.removeItem(STORE);
    } catch (e) {}
  }

  function finishStroke() {
    var pts = stroke;
    stroke = null;
    kick();
    if (!pts || pts.length < 8) return;
    var count = pts.length / 2, length = 0, area = 0, i, last = pts.length - 2;
    for (i = 1; i < count; i++) length += hyp(pts[i * 2] - pts[i * 2 - 2], pts[i * 2 + 1] - pts[i * 2 - 1]);
    for (i = 0; i < count; i++) {
      var j = (i + 1) % count;
      area += pts[i * 2] * pts[j * 2 + 1] - pts[j * 2] * pts[i * 2 + 1];
    }
    if (length < 30) return;

    var shape;
    if (length > 90 && hyp(pts[0] - pts[last], pts[1] - pts[last + 1]) < Math.max(26, length * 0.14) && Math.abs(area) / 2 > 500) {
      shape = { k: 'p' };
    } else {
      // The end that meets water is downstream; failing that, the lower end.
      var startWet = !!nearWater(pts[0], pts[1], 44 * scene.S), endWet = !!nearWater(pts[last], pts[last + 1], 44 * scene.S);
      var endIsDown = startWet === endWet ? pts[last + 1] > pts[1] : endWet;
      if (endIsDown) {
        var flipped = [];
        for (i = count - 1; i >= 0; i--) flipped.push(pts[i * 2], pts[i * 2 + 1]);
        pts = flipped;
      }
      shape = { k: 's' };
    }
    var every = Math.ceil(count / 400);
    shape.p = [];
    for (i = 0; i < count; i += every) shape.p.push(+(pts[i * 2] / W).toFixed(4), +(pts[i * 2 + 1] / H).toFixed(4));
    shapes.push(shape);
    if (shapes.length > 40) shapes.shift();
    saveShapes();
    buildUser();
  }

  var drawBtn = document.getElementById('draw');
  var undoBtn = document.getElementById('undo');
  var drawHint = document.getElementById('draw-hint');

  function syncDrawUi() {
    panel.classList.toggle('is-drawing', drawing);
    if (drawBtn) { drawBtn.textContent = drawing ? 'Done' : 'Draw'; drawBtn.setAttribute('aria-pressed', String(drawing)); }
    if (undoBtn) undoBtn.hidden = !drawing || !shapes.length;
    if (drawHint) drawHint.hidden = !drawing;
  }

  if (drawBtn) {
    drawBtn.addEventListener('click', function () {
      drawing = !drawing;
      stroke = null;
      // Drawing needs the finished river, so skip whatever is left of the intro.
      if (drawing && progress.T < 1) { if (intro && intro.pause) intro.pause(); progress.T = 1; }
      syncDrawUi(); kick();
    });
  }
  if (undoBtn) {
    undoBtn.addEventListener('click', function () {
      shapes.pop(); saveShapes(); buildUser(); kick();
    });
  }
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && drawing) { drawing = false; stroke = null; syncDrawUi(); kick(); }
  });

  panel.addEventListener('pointerdown', function (e) {
    if (!drawing || e.button !== 0 || progress.T < 1) return;
    if (e.target.closest && e.target.closest('button, a')) return;
    e.preventDefault();
    var rect = root.getBoundingClientRect();
    stroke = [e.clientX - rect.left, e.clientY - rect.top];
    pointer.tk = 0;
    try { panel.setPointerCapture(e.pointerId); } catch (err) {}
  });
  panel.addEventListener('pointerup', function () { if (stroke) finishStroke(); });
  panel.addEventListener('pointercancel', function () { stroke = null; kick(); });

  // ── Frame loop ─────────────────────────────
  var visible = true, rafId = 0, clock = 0, last = 0;

  function frame(now) {
    rafId = 0;
    if (!scene) return;
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now; clock += dt;
    pointer.k += (pointer.tk - pointer.k) * 0.09;
    pointer.x += (pointer.tx - pointer.x) * 0.22;
    pointer.y += (pointer.ty - pointer.y) * 0.22;
    renderWater(progress.T);
    renderLand(progress.T);
    renderFlow(clock, progress.T);
    if (visible && canAnimate) rafId = requestAnimationFrame(frame);
  }

  function kick() {
    if (!rafId) { last = 0; rafId = requestAnimationFrame(frame); }
  }

  function playInk() {
    if (intro && intro.pause) intro.pause();
    resetInk();
    if (!canAnimate) { progress.T = 1; kick(); return; }
    progress.T = 0;
    intro = A.animate(progress, { T: 1, duration: 3600, ease: 'inOutSine' });
    kick();
  }

  // ── Scene lifecycle ────────────────────────
  var seed = parseInt(params.get('seed'), 10);
  // A visitor who has drawn on a river comes back to that same river and their drawings.
  try {
    var saved = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (saved && saved.seed > 0 && Array.isArray(saved.shapes) && (!(seed > 0) || seed === saved.seed)) {
      seed = saved.seed;
      shapes = saved.shapes.filter(function (s) { return s && Array.isArray(s.p) && s.p.length >= 4; });
    }
  } catch (e) {}
  if (!(seed > 0)) seed = Math.floor(Math.random() * 999999) + 1;

  function rebuild() {
    sizeLayers();
    readColors();
    scene = buildScene(seed, W, H);
    buildUser();
    // The page river picks up where the hero's main channel leaves the frame.
    api.seed = seed;
    api.mouth = scene.mouth;
    window.dispatchEvent(new Event('ink:scene'));
  }

  var api = window.InkRiver = { mulberry32: mulberry32, makeNoise: makeNoise, art: root, seed: 0, mouth: null };

  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (root.clientWidth === W && root.clientHeight === H) return;
      if (intro && intro.pause) intro.pause();
      rebuild(); resetInk(); progress.T = 1; kick();
    }, 180);
  });

  var themeBtn = document.getElementById('theme');
  function syncTheme() {
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (themeBtn) { themeBtn.textContent = dark ? 'Day' : 'Night'; themeBtn.setAttribute('aria-pressed', String(dark)); }
  }
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('ink-theme', next); } catch (e) {}
      syncTheme(); readColors(); resetInk(); kick();
      window.dispatchEvent(new Event('ink:theme'));
    });
  }
  syncTheme();

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) kick();
    }).observe(root);
  }

  panel.addEventListener('pointermove', function (e) {
    var rect = root.getBoundingClientRect();
    if (stroke) {
      var sx = e.clientX - rect.left, sy = e.clientY - rect.top, sl = stroke.length;
      if (hyp(sx - stroke[sl - 2], sy - stroke[sl - 1]) >= 3) { stroke.push(sx, sy); kick(); }
      return;
    }
    pointer.tx = e.clientX - rect.left; pointer.ty = e.clientY - rect.top; pointer.tk = 1;
    if (!pointer.seen) { pointer.x = pointer.tx; pointer.y = pointer.ty; pointer.seen = true; }
  });
  panel.addEventListener('pointerleave', function () { pointer.tk = 0; });

  var redraw = document.getElementById('redraw');
  if (redraw) {
    redraw.addEventListener('click', function () {
      seed = Math.floor(Math.random() * 999999) + 1;
      params.set('seed', seed);
      window.history.replaceState(null, '', '?' + params.toString());
      // A new river starts clean.
      shapes = []; stroke = null; saveShapes();
      rebuild(); playInk();
    });
  }

  // ── Title ──────────────────────────────────
  function setupTitle() {
    var data = window.__SITE_CONTENT__ && window.__SITE_CONTENT__.hero;
    var nameEl = document.getElementById('hero-name');
    var lines = nameEl ? Array.prototype.slice.call(nameEl.querySelectorAll('.name-line')) : [];
    if (data) {
      var parts = String(data.name || '').split(' ');
      if (parts.length >= 2 && lines.length === 2) {
        lines[0].textContent = parts[0]; lines[1].textContent = parts.slice(1).join(' ');
        nameEl.setAttribute('aria-label', data.name);
      }
      var role = document.getElementById('hero-role'), degree = document.getElementById('hero-degree');
      if (role && data.role) role.textContent = data.role;
      if (degree && data.degree) degree.textContent = data.degree + (data.school ? ', ' + data.school : '');
    }
    var chars = [];
    lines.forEach(function (line) {
      var text = line.textContent;
      line.setAttribute('data-text', text);
      line.textContent = '';
      text.split('').forEach(function (ch) {
        var span = document.createElement('span');
        span.className = 'ch'; span.setAttribute('aria-hidden', 'true');
        span.textContent = ch;
        line.appendChild(span); chars.push(span);
      });
    });
    return { nameEl: nameEl, chars: chars };
  }

  function playTitle(title) {
    if (!canAnimate || !title.nameEl) return;
    var captions = document.querySelectorAll('.caption');
    var chrome = document.querySelectorAll('.nav, .controls');
    var seal = document.querySelector('.seal');
    var hide = function (el) { el.style.opacity = '0'; };
    title.chars.forEach(hide);
    Array.prototype.forEach.call(captions, hide);
    Array.prototype.forEach.call(chrome, hide);
    if (seal) hide(seal);
    title.nameEl.style.setProperty('--halo', '0');

    var halo = { v: 0 };
    A.animate(halo, {
      v: 1, duration: 500, delay: 850, ease: 'outQuad',
      onUpdate: function () { title.nameEl.style.setProperty('--halo', halo.v.toFixed(3)); }
    });
    A.animate(title.chars, {
      opacity: [0, 1], y: ['0.32em', '0em'],
      duration: 700, delay: A.stagger(36, { start: 900 }), ease: 'outExpo'
    });
    A.animate(captions, {
      opacity: [0, 1], x: [-16, 0],
      duration: 600, delay: A.stagger(130, { start: 1650 }), ease: 'outExpo'
    });
    if (seal) {
      A.animate(seal, { opacity: [0, 1], scale: [1.9, 1], duration: 520, delay: 2100, ease: 'outBack(2.2)' });
    }
    A.animate(chrome, { opacity: [0, 1], duration: 500, delay: 2300, ease: 'outQuad' });
  }

  var title = setupTitle();
  rebuild();
  playInk();
  playTitle(title);
})();
