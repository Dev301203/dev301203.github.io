// The river below the hero: one SVG channel that threads the lane each section keeps
// clear, inks itself in as the page scrolls, and ends in the sea behind the contact section.
(function () {
  'use strict';

  var layer = document.getElementById('page-river');
  var main = document.getElementById('main');
  var K = window.InkRiver;
  if (!layer || !main || !K) return;

  var A = window.anime;
  var params = new URLSearchParams(window.location.search);
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canAnimate = !!A && !reduceMotion && !params.has('static');

  var NS = 'http://www.w3.org/2000/svg';
  var STEP = 5;

  var svg = document.createElementNS(NS, 'svg');
  function addPath(cls, parent) {
    var p = document.createElementNS(NS, 'path');
    p.setAttribute('class', cls);
    (parent || svg).appendChild(p);
    return p;
  }
  var pHatch = addPath('hatch'), pLines = addPath('lines'), pWater = addPath('water'), pLakes = addPath('water'), pIsles = addPath('isles');
  var gProps = document.createElementNS(NS, 'g');
  svg.appendChild(gProps);
  var gCurrent = document.createElementNS(NS, 'g');
  svg.appendChild(gCurrent);
  var props = [], shown = 0;
  layer.classList.toggle('anim', canAnimate);
  layer.appendChild(svg);

  function f1(n) { return n.toFixed(1); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth(a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

  var height = 0, inked = 0, centre = null;

  // ── Ground texture ─────────────────────────
  // The hero's cross-hatching and halftone dots, carried down the whole page. It is built in
  // horizontal bands, each a pure function of position, so bands meet without a seam and
  // only new ones are generated when the page gets taller.
  var ground = document.createElement('div');
  ground.className = 'ground' + (canAnimate ? ' anim' : '');
  ground.setAttribute('aria-hidden', 'true');
  main.insertBefore(ground, layer);
  var gsvg = document.createElementNS(NS, 'svg');
  ground.appendChild(gsvg);
  // A paper-coloured veil below the ink front hides the texture the river has not reached yet.
  var veil = document.createElement('div');
  veil.className = 'ground__veil';
  ground.appendChild(veil);

  var BAND = 220, bands = [], groundKey = '', groundNoise = null, groundScale = 1;
  var FAMILIES = [{ ang: -0.62, thr: 0.62, off: 0 }, { ang: 0.82, thr: 0.71, off: 0 }, { ang: -0.62, thr: 0.79, off: 0.5 }];

  function hash(v) { var s = Math.sin(v * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }

  function makeBand(index, W) {
    var y0 = index * BAND, y1 = y0 + BAND, S = groundScale, noise = groundNoise;

    // The terrain field, sampled on a coarse grid and interpolated.
    var cell = 8, cols = Math.ceil(W / cell) + 3, rows = Math.ceil(BAND / cell) + 4;
    var grid = new Float32Array(cols * rows), reach = 280 * S, r, c;
    for (r = 0; r < rows; r++) {
      for (c = 0; c < cols; c++) grid[r * cols + c] = noise.fbm((c - 1) * cell / reach, (y0 + (r - 2) * cell) / reach);
    }
    function field(x, y) {
      var fx = x / cell + 1, fy = (y - y0) / cell + 2;
      var ci = Math.max(0, Math.min(cols - 2, Math.floor(fx))), ri = Math.max(0, Math.min(rows - 2, Math.floor(fy)));
      var u = Math.max(0, Math.min(1, fx - ci)), v = Math.max(0, Math.min(1, fy - ri)), i = ri * cols + ci;
      return (grid[i] * (1 - u) + grid[i + 1] * u) * (1 - v) + (grid[i + cols] * (1 - u) + grid[i + cols + 1] * u) * v;
    }

    // High ground: families of parallel lines, clipped to where the field is high.
    var sp = Math.max(4, 5.2 * S), step = 6, lines = '';
    FAMILIES.forEach(function (fam, fi) {
      var ux = Math.cos(fam.ang), uy = Math.sin(fam.ang), vx = -uy, vy = ux;
      var kMin = Infinity, kMax = -Infinity, aMin = Infinity, aMax = -Infinity;
      [[-4, y0 - step], [W + 4, y0 - step], [-4, y1], [W + 4, y1]].forEach(function (p) {
        var k = p[0] * vx + p[1] * vy, a = p[0] * ux + p[1] * uy;
        kMin = Math.min(kMin, k); kMax = Math.max(kMax, k); aMin = Math.min(aMin, a); aMax = Math.max(aMax, a);
      });
      for (var li = Math.ceil(kMin / sp - fam.off); (li + fam.off) * sp <= kMax; li++) {
        var kk = (li + fam.off) * sp + (hash(li * 3.7 + fi * 91.3) - 0.5) * sp * 0.35, run = [];
        for (var ai = Math.ceil(aMin / step); ai * step <= aMax; ai++) {
          var a = ai * step, x = ux * a + vx * kk, y = uy * a + vy * kk;
          // A band overlaps the one above by a step, so lines that cross the boundary join up.
          if (x > -4 && x < W + 4 && y >= y0 - step && y < y1 &&
              field(x, y) > fam.thr + (hash(li * 12.9 + ai * 78.2 + fi) - 0.5) * 0.035) {
            var wob = (noise.n2(x * 0.05, y * 0.05) - 0.5) * 1.6;
            run.push(f1(x + vx * wob) + ' ' + f1(y + vy * wob));
          } else {
            if (run.length >= 2) lines += 'M' + run.join('L');
            run = [];
          }
        }
        if (run.length >= 2) lines += 'M' + run.join('L');
      }
    });

    // Low ground: halftone dots on a 45 degree lattice, in four sizes.
    var pitch = Math.max(5, 6.5 * S), half = pitch / Math.SQRT2, dots = ['', '', '', ''];
    for (var n = Math.ceil(y0 / half); n * half < y1; n++) {
      for (var m = n & 1; m * half <= W + 2; m += 2) {
        var v = field(m * half, n * half);
        if (v >= 0.37) continue;
        var size = Math.min(1, (0.37 - v) / 0.16);
        if (size * pitch * 0.4 > 0.5) dots[Math.min(3, Math.floor(size * 4))] += 'M' + f1(m * half) + ' ' + f1(n * half) + 'h.1';
      }
    }

    var g = document.createElementNS(NS, 'g');
    if (lines) {
      var lp = addPath('', g);
      lp.setAttribute('d', lines);
      lp.setAttribute('stroke-width', Math.max(0.8, 0.95 * S).toFixed(2));
    }
    dots.forEach(function (d, k) {
      if (!d) return;
      var dp = addPath('', g);
      dp.setAttribute('d', d);
      dp.setAttribute('stroke-width', (pitch * 0.8 * (k + 0.6) / 4).toFixed(2));
    });
    gsvg.appendChild(g);
    return { el: g };
  }

  function updateGround(W, limit) {
    var key = K.seed + ':' + Math.round(W);
    if (key !== groundKey) {
      groundKey = key;
      bands.forEach(function (b) { gsvg.removeChild(b.el); });
      bands = [];
      groundNoise = K.makeNoise(K.mulberry32((K.seed || 1) * 13 + 5));
      groundScale = Math.max(0.6, Math.min(1.2, W / 1440));
    }
    var count = Math.ceil(limit / BAND);
    while (bands.length < count) bands.push(makeBand(bands.length, W));
    while (bands.length > count) gsvg.removeChild(bands.pop().el);
    gsvg.setAttribute('width', W);
    gsvg.setAttribute('height', count * BAND);
  }

  function showGround(above) {
    if (above === Infinity) { veil.style.display = 'none'; return; }
    veil.style.display = '';
    veil.style.transform = 'translateY(' + Math.round(above - 80) + 'px)';
  }

  function build() {
    var mr = main.getBoundingClientRect();
    var W = mr.width, H = main.offsetHeight;
    if (!W || !H) return;
    height = H;

    var rng = K.mulberry32((K.seed || 1) * 7 + 13), noise = K.makeNoise(rng);
    var small = W < 880;
    var sea = main.querySelector('.sea');
    var seaTop = sea ? sea.offsetTop : H;
    updateGround(W, seaTop);
    var baseHw = (small ? 10 : Math.max(26, Math.min(38, W * 0.027))) * (0.85 + rng() * 0.3);
    var flare = small ? 170 : 290;
    var artRect = K.art.getBoundingClientRect();
    var startX = artRect.left - mr.left + (K.mouth ? K.mouth.x : W * 0.6);
    var startHw = K.mouth ? K.mouth.hw : baseHw;

    while (gCurrent.firstChild) gCurrent.removeChild(gCurrent.firstChild);

    // Panels with their own water (see Sources below). Their tributaries join the channel in
    // page order, each below its source and below the one before, so none of them cross.
    var docks = [], lastJoin = -Infinity, gainTotal = 0;
    Array.prototype.forEach.call(main.querySelectorAll('[data-dock]'), function (dock) {
      var x0 = 0, y0 = 0, node = dock;
      while (node && node !== main) { x0 += node.offsetLeft; y0 += node.offsetTop; node = node.offsetParent; }
      if (!node) return;
      var d = { x: x0, y: y0, w: dock.offsetWidth, h: dock.offsetHeight, lake: dock.classList.contains('job--edu') };
      d.sy = d.y + (d.lake ? d.h * 0.5 : Math.min(d.h * 0.5, 64));
      d.joinY = Math.max(d.sy + (small ? 36 : 84) + rng() * (small ? 20 : 80), lastJoin + (small ? 30 : 58));
      d.gain = d.lake ? 1.5 : 1;
      lastJoin = d.joinY;
      gainTotal += d.gain;
      docks.push(d);
    });

    // Centreline: straight down each lane, S-bends across the gaps between sections.
    var raw = [[startX, 0]], spans = [], joins = [];
    function bend(x0, y0, x1, y1) {
      var dy = y1 - y0, c0 = y0 + dy * 0.55, c1 = y1 - dy * 0.55;
      for (var i = 1; i <= 48; i++) {
        var t = i / 48, u = 1 - t;
        raw.push([
          (u * u * u + 3 * u * u * t) * x0 + (3 * u * t * t + t * t * t) * x1,
          u * u * u * y0 + 3 * u * u * t * c0 + 3 * u * t * t * c1 + t * t * t * y1
        ]);
      }
    }
    var cur = { x: startX, y: 0 };
    Array.prototype.forEach.call(main.querySelectorAll('.lane'), function (lane, idx) {
      var r = lane.getBoundingClientRect();
      var cx = r.left - mr.left + r.width / 2, top = r.top - mr.top, bot = r.bottom - mr.top;
      var ease = Math.min(70, (bot - top) * 0.2);
      if (idx > 0) joins.push((cur.y + top + ease) / 2);
      bend(cur.x, cur.y, cx, top + ease);
      for (var y = top + ease + STEP; y <= bot - ease; y += STEP) raw.push([cx, y]);
      cur = { x: cx, y: bot - ease };
      // In a wide lane the channel keeps to the middle, leaving the edges for the sources.
      spans.push({
        y0: top, y1: bot, amp: Math.max(0, Math.min(r.width / 2 - baseHw - 8, r.width * 0.23)),
        wave: (small ? 42 : 80) * (0.7 + rng() * 0.7), phase: rng() * 6.283
      });
    });
    bend(cur.x, cur.y, W / 2, seaTop + 6);

    // Resample to even spacing, then let the channel wander inside its lane.
    var px = [raw[0][0]], py = [raw[0][1]], carry = 0, i;
    for (i = 1; i < raw.length; i++) {
      var ax = raw[i - 1][0], ay = raw[i - 1][1], bx = raw[i][0], by = raw[i][1];
      var seg = Math.sqrt((bx - ax) * (bx - ax) + (by - ay) * (by - ay));
      var d = STEP - carry;
      while (d <= seg) { px.push(lerp(ax, bx, d / seg)); py.push(lerp(ay, by, d / seg)); d += STEP; }
      carry = seg - (d - STEP);
    }
    var n = px.length;
    for (i = 0; i < n; i++) {
      var amp = 0, wave = 80, phase = 0;
      for (var k = 0; k < spans.length; k++) {
        var sp = spans[k];
        if (py[i] > sp.y0 && py[i] < sp.y1) {
          amp = sp.amp * smooth(sp.y0, sp.y0 + 140, py[i]) * (1 - smooth(sp.y1 - 140, sp.y1, py[i]));
          wave = sp.wave; phase = sp.phase;
        }
      }
      var s = i * STEP;
      px[i] += amp * (0.7 * Math.sin(s / wave + phase) + 0.6 * (noise.n2(s * 0.004, 3.1) - 0.5));
    }

    var nx = new Array(n), ny = new Array(n), tx = new Array(n), ty = new Array(n);
    var hl = new Array(n), hr = new Array(n), hw = new Array(n);
    for (i = 0; i < n; i++) {
      var i0 = Math.max(0, i - 2), i1 = Math.min(n - 1, i + 2);
      var dx = px[i1] - px[i0], dy = py[i1] - py[i0], dl = Math.sqrt(dx * dx + dy * dy) || 1;
      tx[i] = dx / dl; ty[i] = dy / dl; nx[i] = -ty[i]; ny[i] = tx[i];
      // The channel starts lean and takes on width below each tributary.
      var fed = 0;
      for (var dk = 0; dk < docks.length; dk++) fed += docks[dk].gain * smooth(docks[dk].joinY - 10, docks[dk].joinY + 120, py[i]);
      var full = docks.length ? baseHw * (0.66 + 0.42 * fed / gainTotal) : baseHw;
      hw[i] = lerp(startHw, full, smooth(0, 320, i * STEP));
      hl[i] = hw[i] * (1 + 0.34 * (noise.n2(i * STEP * 0.012, 1.7) - 0.5));
      hr[i] = hw[i] * (1 + 0.34 * (noise.n2(i * STEP * 0.012, 61.7) - 0.5));
    }

    var water = '', hatch = '', lines = '', wet = [];

    // Main channel, opening out to the full width where it meets the sea.
    var left = [], right = [];
    for (i = 0; i < n; i++) {
      var e = Math.pow(Math.max(0, Math.min(1, (py[i] - (seaTop - flare)) / flare)), 2.3);
      left.push(f1(lerp(px[i] + nx[i] * hl[i], -24, e)) + ' ' + f1(py[i] + ny[i] * hl[i] * (1 - e)));
      right.push(f1(lerp(px[i] - nx[i] * hr[i], W + 24, e)) + ' ' + f1(py[i] - ny[i] * hr[i] * (1 - e)));
    }
    water += 'M' + left.join('L') + 'L' + right.reverse().join('L') + 'Z';

    // Bank shading, same rules as the hero: lit from the top left.
    function hachures(X, Y, NX, NY, TX, TY, HL, HR, HW, count, limitY, scale) {
      for (var j = 0; j < count; j++) {
        if (Y[j] > limitY || HW[j] < 1.1) continue;
        for (var side = 1; side >= -1; side -= 2) {
          var ox = NX[j] * side, oy = NY[j] * side, shade = ox * 0.6 + oy * 0.8;
          if (!(shade > -0.15 || rng() < 0.07)) continue;
          var reps = rng() < 0.6 ? 2 : 1;
          for (var r = 0; r < reps; r++) {
            var slip = (rng() - 0.5) * STEP, hs = side > 0 ? HL[j] : HR[j];
            var bx = X[j] + ox * hs + TX[j] * slip, by = Y[j] + oy * hs + TY[j] * slip;
            var lean = 0.25 + rng() * 0.4;
            var dx = ox * Math.cos(lean) + TX[j] * Math.sin(lean), dy = oy * Math.cos(lean) + TY[j] * Math.sin(lean);
            var len = (4 + 26 * Math.pow(Math.min(1, noise.fbm(bx * 0.009, by * 0.009) * 1.25), 2.2)) *
              (0.5 + 0.9 * Math.min(1, HW[j] / 16)) * (0.55 + rng() * 0.7) * (0.4 + 0.8 * Math.max(0, shade)) * scale;
            var w = (0.9 + rng() * 0.9) * 0.5;
            hatch += 'M' + f1(bx - dy * w) + ' ' + f1(by + dx * w) + 'L' + f1(bx + dx * len) + ' ' + f1(by + dy * len) +
              'L' + f1(bx + dy * w) + ' ' + f1(by - dx * w) + 'Z';
          }
        }
      }
    }
    hachures(px, py, nx, ny, tx, ty, hl, hr, hw, n, seaTop - flare, small ? 0.6 : 1);

    // Broken contour lines following both banks.
    var rings = small ? 2 : 3;
    for (var side = 1; side >= -1; side -= 2) {
      for (var m = 1; m <= rings; m++) {
        var off = (2.5 + 5.5 * m + rng() * 2) * (small ? 0.6 : 1), q = (rng() * 6) | 0, run = [], keep = 0;
        for (; q < n; q++) {
          if (keep <= 0 || py[q] > seaTop - flare) {
            if (run.length >= 4) lines += 'M' + run.join('L');
            run = [];
            if (py[q] > seaTop - flare) break;
            q += 2 + ((rng() * (5 + m * 4)) | 0);
            keep = 5 + ((rng() * 22) | 0);
            if (q >= n) break;
          }
          keep--;
          var reach = hw[q] + off + (noise.n2(q * 0.11, m * 9 + side) - 0.5) * 3;
          run.push(f1(px[q] + nx[q] * side * reach) + ' ' + f1(py[q] + ny[q] * side * reach));
        }
        if (run.length >= 4) lines += 'M' + run.join('L');
      }
    }

    // Side streams: a tapering channel along a curve that ends on the main channel's centreline.
    function stream(c, w0, w1, wiggle, shadeScale, mouth) {
      var cnt = Math.max(12, Math.round((Math.abs(c[6] - c[0]) + Math.abs(c[7] - c[1])) / STEP));
      var X = [], Y = [], NX = [], NY = [], TX = [], TY = [], HW = [], a;
      var wig = rng() * 10;
      for (a = 0; a <= cnt; a++) {
        var t = a / cnt, u = 1 - t;
        X.push(u * u * u * c[0] + 3 * u * u * t * c[2] + 3 * u * t * t * c[4] + t * t * t * c[6]);
        Y.push(u * u * u * c[1] + 3 * u * u * t * c[3] + 3 * u * t * t * c[5] + t * t * t * c[7] +
          (noise.n2(t * 9, wig) - 0.5) * wiggle * Math.sin(t * Math.PI));
      }
      for (a = 0; a <= cnt; a++) {
        var a0 = Math.max(0, a - 1), a1 = Math.min(cnt, a + 1);
        var ddx = X[a1] - X[a0], ddy = Y[a1] - Y[a0], ddl = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
        TX.push(ddx / ddl); TY.push(ddy / ddl); NX.push(-ddy / ddl); NY.push(ddx / ddl);
        HW.push(lerp(w0, w1, Math.pow(a / cnt, 0.8)) * (1 + 0.3 * (noise.n2(a * 0.2, wig + 5) - 0.5)) *
          (1 + (mouth || 0) * smooth(0.72, 0.96, a / cnt)));
      }
      var l2 = [], r2 = [];
      for (a = 0; a <= cnt; a++) {
        l2.push(f1(X[a] + NX[a] * HW[a]) + ' ' + f1(Y[a] + NY[a] * HW[a]));
        r2.push(f1(X[a] - NX[a] * HW[a]) + ' ' + f1(Y[a] - NY[a] * HW[a]));
      }
      water += 'M' + l2.join('L') + 'L' + r2.reverse().join('L') + 'Z';
      hachures(X, Y, NX, NY, TX, TY, HW, HW, HW, cnt + 1, Infinity, shadeScale);
      for (a = 0; a <= cnt; a += 3) wet.push([X[a], Y[a], HW[a] + 16]);
      return { x: X, y: Y, n: cnt + 1 };
    }

    function currentLine(pts, speed) {
      if (pts.length < 2) return;
      var p = addPath('current', gCurrent);
      p.setAttribute('d', 'M' + pts.join('L'));
      var dash = [20 + rng() * 50, 70 + rng() * 110, 10 + rng() * 30, 90 + rng() * 120].map(Math.round);
      var cycle = dash[0] + dash[1] + dash[2] + dash[3];
      p.setAttribute('stroke-dasharray', dash.join(' '));
      p.style.setProperty('--cycle', cycle);
      p.style.setProperty('--dur', (cycle / (speed * (0.8 + rng() * 0.5))).toFixed(2) + 's');
    }

    // One runs through each gap between sections and joins the channel.
    joins.forEach(function (jy) {
      var j = 0;
      while (j < n - 1 && py[j] < jy) j++;
      var sx = px[j] > W / 2 ? -30 : W + 30, sy = py[j] - (30 + rng() * 50), ex = px[j], ey = py[j];
      stream([sx, sy, lerp(sx, ex, 0.45), sy - 14, lerp(sx, ex, 0.8), ey - 70, ex, ey],
        1.2, small ? 3.5 : 8, 22, small ? 0.5 : 0.8);
    });

    // Sources. Every docked panel has its own water, a lake for a school and a spring for a
    // job, lying half under the panel's river-side edge, and a tributary from it into the channel.
    var lakes = '';
    docks.forEach(function (d, k) {
      var j = 0;
      while (j < n - 1 && py[j] < d.joinY) j++;
      var ex = px[j], ey = py[j];
      var dir = d.x + d.w / 2 < ex ? 1 : -1;
      var edge = dir > 0 ? d.x + d.w : d.x;

      if (small) {
        // No room for a lake beside a full-width panel: a short stream from under its edge.
        var from = edge - dir * Math.min(50, d.w * 0.3);
        stream([from, d.sy, lerp(from, ex, 0.6), d.sy - 4, lerp(from, ex, 0.92), lerp(d.sy, ey, 0.2), ex, ey],
          2.4, 4.6, 6, 0.5, 0.5);
        return;
      }

      var rx = d.lake ? Math.min(d.h * 0.4, 46 + rng() * 14) : 25 + rng() * 7;
      var ry = rx * (d.lake ? 0.66 + rng() * 0.14 : 0.8 + rng() * 0.15);
      var cx = edge + dir * rx * 0.28, cy = d.sy;
      var shore = [], ripple = [], turns = d.lake ? 44 : 28, seedA = rng() * 40, a;
      for (a = 0; a < turns; a++) {
        var th = a / turns * 6.2832, cs = Math.cos(th), sn = Math.sin(th);
        var rag = 1 + 0.34 * (noise.n2(seedA + cs * 1.3, seedA + sn * 1.3) - 0.5);
        var sx = cx + cs * rx * rag, sy = cy + sn * ry * rag;
        shore.push(f1(sx) + ' ' + f1(sy));
        ripple.push(f1(cx + cs * rx * rag * 0.58) + ' ' + f1(cy + sn * ry * rag * 0.58));

        // Shore hachures on the shaded side, and a broken contour line outside it.
        var ol = Math.sqrt(cs * cs * ry * ry + sn * sn * rx * rx) || 1, ox = cs * ry / ol, oy = sn * rx / ol;
        var shade = ox * 0.6 + oy * 0.8;
        if (shade > -0.15 || rng() < 0.07) {
          for (var rep = 0; rep < 3; rep++) {
            var slip = (rng() - 0.5) * 7, lean = (rng() - 0.5) * 0.6;
            var hx = sx - oy * slip, hy = sy + ox * slip;
            var dx = ox * Math.cos(lean) - oy * Math.sin(lean), dy = oy * Math.cos(lean) + ox * Math.sin(lean);
            var len = (5 + 20 * Math.pow(Math.min(1, noise.fbm(hx * 0.009, hy * 0.009) * 1.25), 2.2)) *
              (0.55 + rng() * 0.7) * (0.4 + 0.8 * Math.max(0, shade));
            var w = (0.9 + rng() * 0.9) * 0.5;
            hatch += 'M' + f1(hx - dy * w) + ' ' + f1(hy + dx * w) + 'L' + f1(hx + dx * len) + ' ' + f1(hy + dy * len) +
              'L' + f1(hx + dy * w) + ' ' + f1(hy - dx * w) + 'Z';
          }
        }
      }
      lakes += 'M' + shore.join('L') + 'Z';
      wet.push([cx, cy, rx * 1.2 + 20]);
      for (var ring = 1; ring <= (d.lake ? 2 : 1); ring++) {
        var run = [], keep = 0;
        for (a = 0; a <= turns; a++) {
          if (keep <= 0) {
            if (run.length >= 3) lines += 'M' + run.join('L');
            run = [];
            a += 1 + ((rng() * 3) | 0);
            keep = 4 + ((rng() * 12) | 0);
          }
          keep--;
          var th2 = a / turns * 6.2832;
          run.push(f1(cx + Math.cos(th2) * (rx + 4 + ring * 6)) + ' ' + f1(cy + Math.sin(th2) * (ry + 4 + ring * 6)));
        }
        if (run.length >= 3) lines += 'M' + run.join('L');
      }
      if (d.lake) currentLine(ripple.concat(ripple[0]), 14);

      // The tributary leaves the lake toward the river and arrives leaning downstream.
      var tw = baseHw * (d.lake ? 0.3 : 0.22);
      var ox0 = cx + dir * rx * 0.7, oy0 = cy + ry * 0.25;
      var path = stream([
        ox0, oy0,
        lerp(ox0, ex, 0.5), oy0 + (ey - oy0) * 0.1,
        ex - dir * (hw[j] * 2.2 + 18), ey - Math.min(80, (ey - oy0) * 0.6),
        ex, ey
      ], tw * 0.7, tw, 26, 0.75, 0.7);
      var mid = [];
      for (a = 2; a < path.n; a++) {
        if (Math.abs(path.x[a] - ex) < hw[j] + 6 && Math.abs(path.y[a] - ey) < hw[j] * 2) break;
        mid.push(f1(path.x[a]) + ' ' + f1(path.y[a]));
      }
      currentLine(mid, 34);
    });

    // Islands in the lanes, where there is room for them.
    var isles = '';
    if (!small) {
      var at = Math.round((260 + rng() * 300) / STEP);
      while (at < n - 40) {
        var room = false;
        for (var si = 0; si < spans.length; si++) {
          if (py[at] > spans[si].y0 + 160 && py[at] < spans[si].y1 - 160) room = true;
        }
        if (room && py[at] < seaTop - flare - 120 && hw[at] >= 20) {
          var halfLen = Math.round(hw[at] * (1.3 + rng() * 1.3) / STEP);
          var q0 = Math.max(1, at - halfLen), q1 = Math.min(n - 2, at + halfLen);
          var lean = (rng() - 0.5) * 0.8, girth = hw[at] * (0.16 + rng() * 0.1), il = [], ir = [];
          for (var q = q0; q <= q1; q++) {
            var prof = Math.pow(Math.sin((q - q0) / (q1 - q0) * Math.PI), 0.7) * girth * (0.8 + 0.4 * noise.n2(q * 0.3, at));
            var mx = px[q] + nx[q] * lean * hw[q] * 0.5, my = py[q] + ny[q] * lean * hw[q] * 0.5;
            il.push(f1(mx + nx[q] * prof) + ' ' + f1(my + ny[q] * prof));
            ir.push(f1(mx - nx[q] * prof) + ' ' + f1(my - ny[q] * prof));
          }
          isles += 'M' + il.join('L') + 'L' + ir.reverse().join('L') + 'Z';
        }
        at += Math.round((420 + rng() * 620) / STEP);
      }
    }

    // Current lines: dashed lanes that drift downstream.
    (small ? [-0.4, 0.35] : [-0.58, -0.28, 0.02, 0.33, 0.62]).forEach(function (frac, li) {
      var pts = [];
      for (var j = 0; j < n; j++) {
        if (py[j] > seaTop - flare * 0.55) break;
        var o = frac * hw[j] + Math.sin(j * STEP * 0.03 + li * 1.7) * 1.4;
        pts.push(f1(px[j] + nx[j] * o) + ' ' + f1(py[j] + ny[j] * o));
      }
      currentLine(pts, 52);
    });

    // ── Scenery ──────────────────────────────
    // Small map symbols on the open ground: each section has its own mix, so the land
    // changes down the page. Nothing is placed under a panel or on water.
    while (gProps.firstChild) gProps.removeChild(gProps.firstChild);
    props = [];
    var unit = small ? 0.9 : 1.25;
    var blocks = Array.prototype.map.call(
      main.querySelectorAll('.slab, .card, .proj, .stamp, .bank, .resume, .about'),
      function (node) {
        var r = node.getBoundingClientRect();
        return [r.left - mr.left - 14, r.top - mr.top - 14, r.right - mr.left + 14, r.bottom - mr.top + 14];
      });

    function riverGap(x, y) {
      var lo = 0, hi = n - 1;
      while (lo < hi) { var mid = (lo + hi) >> 1; if (py[mid] < y) lo = mid + 1; else hi = mid; }
      var gap = Infinity;
      for (var q = Math.max(0, lo - 14); q <= Math.min(n - 1, lo + 14); q += 2) {
        gap = Math.min(gap, Math.sqrt((px[q] - x) * (px[q] - x) + (py[q] - y) * (py[q] - y)) - hw[q]);
      }
      return gap;
    }

    // (x, y) is where the symbol stands; it rises s above that point.
    function clearGround(x, y, s, nearWater) {
      var cy = y - s * 0.5, r = s * 0.5, q;
      if (x < r + 4 || x > W - r - 4 || y - s < 24 || y > seaTop - flare - 20) return false;
      for (q = 0; q < blocks.length; q++) {
        if (x + r > blocks[q][0] && x - r < blocks[q][2] && y > blocks[q][1] && y - s < blocks[q][3]) return false;
      }
      if (!nearWater && riverGap(x, cy) < 24 + r) return false;
      for (q = 0; q < wet.length; q++) {
        var dx = wet[q][0] - x, dy = wet[q][1] - cy;
        if (dx * dx + dy * dy < (wet[q][2] + r) * (wet[q][2] + r)) return false;
      }
      for (q = 0; q < props.length; q++) {
        var ex = props[q].x - x, ey = props[q].y - y, keep = (props[q].s + s) * 0.34;
        if (ex * ex + ey * ey < keep * keep) return false;
      }
      return true;
    }

    var draw = K.glyphs(rng);

    function plant(kind, x, y, s, nearWater) {
      if (!clearGround(x, y, s, nearWater)) return false;
      props.push({ kind: kind, x: x, y: y, s: s });
      return true;
    }

    // What grows where: [kind, smallest, largest, relative share].
    var BIOMES = [
      [['grass', 8, 13, 5], ['tree', 26, 38, 2], ['bush', 13, 19, 2]],
      [['pine', 24, 42, 6], ['rock', 12, 20, 1], ['grass', 8, 12, 2]],
      [['rock', 13, 28, 5], ['grass', 8, 12, 3], ['pine', 22, 32, 1]],
      [['tree', 26, 40, 5], ['bush', 13, 20, 3], ['grass', 8, 12, 2]]
    ];
    var bands = Array.prototype.map.call(main.querySelectorAll('.sec'), function (sec) {
      return [sec.offsetTop, sec.offsetTop + sec.offsetHeight];
    });
    bands.forEach(function (band, bi) {
      var mix = BIOMES[bi % BIOMES.length], share = 0;
      mix.forEach(function (m) { share += m[3]; });
      var from = bi ? (bands[bi - 1][1] + band[0]) / 2 : 20;
      var to = bi < bands.length - 1 ? (band[1] + bands[bi + 1][0]) / 2 : band[1] + 160;
      var groves = Math.round((to - from) / (small ? 120 : 62) * Math.max(0.7, Math.min(1.6, W / 1300)));
      for (var g = 0; g < groves; g++) {
        var pick = rng() * share, kind = mix[0];
        for (var m = 0; m < mix.length; m++) { pick -= mix[m][3]; if (pick <= 0) { kind = mix[m]; break; } }
        var gx = 0, gy = 0, found = false;
        for (var t = 0; t < 40 && !found; t++) {
          gx = rng() * W; gy = from + rng() * (to - from);
          found = clearGround(gx, gy, kind[2] * unit, false);
        }
        if (!found) continue;
        var members = kind[0] === 'grass' ? 4 + ((rng() * 6) | 0) : kind[0] === 'rock' ? 2 + ((rng() * 4) | 0) : 3 + ((rng() * 7) | 0);
        var spread = kind[2] * unit * (1.2 + rng() * 1.4);
        for (var k = 0; k < members; k++) {
          var ang = rng() * 6.2832, far = Math.sqrt(rng()) * spread;
          plant(kind[0], gx + Math.cos(ang) * far * 1.5, gy + Math.sin(ang) * far * 0.8,
            (kind[1] + rng() * (kind[2] - kind[1])) * unit, false);
        }
      }
    });

    // Reeds along the banks of the main channel.
    var reedAt = Math.round((120 + rng() * 200) / STEP);
    while (reedAt < n) {
      if (py[reedAt] > seaTop - flare - 60) break;
      var bank = rng() < 0.5 ? 1 : -1, clump = 1 + ((rng() * 3) | 0);
      for (var rc = 0; rc < clump; rc++) {
        var ri = Math.min(n - 1, reedAt + rc * 3), out = hw[ri] * 1.12 + 7 + rng() * 6;
        plant('reeds', px[ri] + nx[ri] * bank * out, py[ri] + ny[ri] * bank * out + 5, (15 + rng() * 9) * unit, true);
      }
      reedAt += Math.round((170 + rng() * 330) / STEP);
    }

    // Lower symbols overlap the ones behind them.
    props.sort(function (a, b) { return a.y - b.y; });
    props.forEach(function (p) {
      var shape = draw[p.kind](p.x, p.y, p.s);
      var g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'prop' + ((p.kind === 'tree' || p.kind === 'reeds') && rng() < 0.6 ? ' prop--sway' : ''));
      g.style.transformOrigin = f1(p.x) + 'px ' + f1(p.y) + 'px';
      g.style.setProperty('--sway', (2.6 + rng() * 2.4).toFixed(2) + 's');
      [['under', ''], ['body', 'body'], ['solid', 'solid'], ['over', ''], ['heads', 'heads']].forEach(function (part) {
        if (shape[part[0]]) addPath(part[1], g).setAttribute('d', shape[part[0]]);
      });
      gProps.appendChild(g);
      p.el = g;
    });
    shown = 0;

    pLakes.setAttribute('d', lakes);
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    pWater.setAttribute('d', water);
    pHatch.setAttribute('d', hatch);
    pLines.setAttribute('d', lines);
    pIsles.setAttribute('d', isles);
    centre = { x: px, y: py, hw: hw };
    applyReveal();
  }

  // ── Ink-in on scroll ───────────────────────
  // Everything above the ink front is shown; the channel itself runs on a little
  // further and tapers to a point, like the end of a brush stroke.
  var TIP = 120;
  function showProps(above) {
    while (shown < props.length && props[shown].y < above) props[shown++].el.classList.add('in');
  }

  function applyReveal() {
    if (!canAnimate || !centre || inked >= height - 2) { layer.style.clipPath = ''; showProps(Infinity); showGround(Infinity); return; }
    showProps(inked - TIP - 6);
    showGround(inked - TIP);
    var lo = 0, hi = centre.y.length - 1;
    while (lo < hi) { var mid = (lo + hi) >> 1; if (centre.y[mid] < inked) lo = mid + 1; else hi = mid; }
    var cx = centre.x[lo], reach = centre.hw[lo] + 14, y = inked.toFixed(0), y1 = (inked - TIP).toFixed(0);
    layer.style.clipPath = 'polygon(-60px 0, calc(100% + 60px) 0, calc(100% + 60px) ' + y1 + 'px, ' +
      f1(cx + reach) + 'px ' + y1 + 'px, ' + f1(cx) + 'px ' + y + 'px, ' + f1(cx - reach) + 'px ' + y1 + 'px, -60px ' + y1 + 'px)';
  }

  if (canAnimate) {
    var scroll = { p: 0 }, lastP = 0, front = 0;
    try {
      A.animate(scroll, {
        p: 1, duration: 1000, ease: 'linear',
        autoplay: A.onScroll({ target: main, enter: 'bottom top', leave: 'bottom bottom', sync: 0.35 }),
        onUpdate: function () {
          // The ink front sits a little above the bottom of the viewport and never retreats.
          var lead = window.innerHeight * 0.12 * (1 - smooth(0.9, 1, scroll.p));
          front = scroll.p * height - lead;
          if (front > inked) { inked = front; applyReveal(); }

          var delta = scroll.p - lastP;
          lastP = scroll.p;
          if (Math.abs(delta) > 0.0003) {
            document.documentElement.classList.toggle('nav-away', delta > 0 && scroll.p > 0.04);
          }
        }
      });
    } catch (err) {
      canAnimate = false;
      layer.classList.remove('anim');
      ground.classList.remove('anim');
      applyReveal();
    }
  }

  // ── The sea ────────────────────────────────
  var sea = document.getElementById('contact'), cv = document.getElementById('sea-waves');
  var ctx = cv ? cv.getContext('2d') : null;
  var seaW = 0, seaH = 0, seaVisible = false, seaRaf = 0, paper = '#f1f0ea';
  var ptr = { x: -999, y: -999, k: 0, tk: 0 };

  function sizeSea() {
    if (!ctx) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    seaW = sea.clientWidth; seaH = sea.clientHeight;
    cv.width = Math.round(seaW * dpr); cv.height = Math.round(seaH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paper = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim() || paper;
  }

  function drawSea(time) {
    seaRaf = 0;
    if (!ctx) return;
    var t = time / 1000;
    ptr.k += (ptr.tk - ptr.k) * 0.08;
    ctx.clearRect(0, 0, seaW, seaH);
    ctx.strokeStyle = paper; ctx.lineWidth = 1; ctx.globalAlpha = 0.42;
    var R = 130 * ptr.k;
    ctx.beginPath();
    for (var y0 = 30; y0 < seaH + 10; y0 += 19) {
      for (var x = -10; x <= seaW + 14; x += 14) {
        var y = y0 + Math.sin(x * 0.009 + t * 0.7 + y0 * 0.021) * 5 + Math.sin(x * 0.023 - t * 0.45 + y0 * 0.05) * 2.5;
        if (R > 1) {
          var dx = x - ptr.x, dy = y - ptr.y, d = Math.sqrt(dx * dx + dy * dy);
          if (d < R) { var f = 1 - d / R; y += (dy < 0 ? -1 : 1) * f * f * R * 0.4; }
        }
        if (x === -10) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    if (seaVisible && canAnimate) seaRaf = requestAnimationFrame(drawSea);
  }

  function kickSea() { if (!seaRaf) seaRaf = requestAnimationFrame(drawSea); }

  if (sea && ctx) {
    sea.addEventListener('pointermove', function (e) {
      var r = cv.getBoundingClientRect();
      ptr.x = e.clientX - r.left; ptr.y = e.clientY - r.top; ptr.tk = 1;
    });
    sea.addEventListener('pointerleave', function () { ptr.tk = 0; });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        seaVisible = entries[0].isIntersecting;
        if (seaVisible) kickSea();
      }).observe(sea);
    }
  }

  // ── Lifecycle ──────────────────────────────
  var timer = 0;
  function refresh() {
    clearTimeout(timer);
    timer = setTimeout(function () { build(); sizeSea(); kickSea(); }, 120);
  }
  var drawnSeed = K.seed;
  window.addEventListener('ink:scene', function () {
    // A redraw gives the whole river a new course, so it inks in again from where the reader is.
    if (K.seed !== drawnSeed) { drawnSeed = K.seed; inked = Math.min(inked, front || 0); }
    refresh();
  });
  window.addEventListener('ink:theme', function () { sizeSea(); kickSea(); });
  if ('ResizeObserver' in window) new ResizeObserver(refresh).observe(main);
  else window.addEventListener('resize', refresh);

  build(); sizeSea(); kickSea();
})();
