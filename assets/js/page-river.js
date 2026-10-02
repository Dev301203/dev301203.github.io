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
  var pHatch = addPath('hatch'), pLines = addPath('lines'), pWater = addPath('water'), pIsles = addPath('isles');
  var gCurrent = document.createElementNS(NS, 'g');
  svg.appendChild(gCurrent);
  layer.appendChild(svg);

  function f1(n) { return n.toFixed(1); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth(a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

  var height = 0, inked = 0, centre = null;

  function build() {
    var mr = main.getBoundingClientRect();
    var W = mr.width, H = main.offsetHeight;
    if (!W || !H) return;
    height = H;

    var rng = K.mulberry32((K.seed || 1) * 7 + 13), noise = K.makeNoise(rng);
    var small = W < 880;
    var sea = main.querySelector('.sea');
    var seaTop = sea ? sea.offsetTop : H;
    var baseHw = (small ? 10 : Math.max(26, Math.min(38, W * 0.027))) * (0.85 + rng() * 0.3);
    var flare = small ? 170 : 290;
    var artRect = K.art.getBoundingClientRect();
    var startX = artRect.left - mr.left + (K.mouth ? K.mouth.x : W * 0.6);
    var startHw = K.mouth ? K.mouth.hw : baseHw;

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
      spans.push({ y0: top, y1: bot, amp: Math.max(0, r.width / 2 - baseHw - 8) });
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
    var n = px.length, wave = (small ? 42 : 80) * (0.75 + rng() * 0.6), phase = rng() * 6.283;
    for (i = 0; i < n; i++) {
      var amp = 0;
      for (var k = 0; k < spans.length; k++) {
        var sp = spans[k];
        if (py[i] > sp.y0 && py[i] < sp.y1) {
          amp = sp.amp * smooth(sp.y0, sp.y0 + 140, py[i]) * (1 - smooth(sp.y1 - 140, sp.y1, py[i]));
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
      hw[i] = lerp(startHw, baseHw, smooth(0, 320, i * STEP));
      hl[i] = hw[i] * (1 + 0.34 * (noise.n2(i * STEP * 0.012, 1.7) - 0.5));
      hr[i] = hw[i] * (1 + 0.34 * (noise.n2(i * STEP * 0.012, 61.7) - 0.5));
    }

    var water = '', hatch = '', lines = '';

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
    function stream(c, w0, w1, wiggle, shadeScale) {
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
        HW.push(lerp(w0, w1, Math.pow(a / cnt, 0.8)) * (1 + 0.3 * (noise.n2(a * 0.2, wig + 5) - 0.5)));
      }
      var l2 = [], r2 = [];
      for (a = 0; a <= cnt; a++) {
        l2.push(f1(X[a] + NX[a] * HW[a]) + ' ' + f1(Y[a] + NY[a] * HW[a]));
        r2.push(f1(X[a] - NX[a] * HW[a]) + ' ' + f1(Y[a] - NY[a] * HW[a]));
      }
      water += 'M' + l2.join('L') + 'L' + r2.reverse().join('L') + 'Z';
      hachures(X, Y, NX, NY, TX, TY, HW, HW, HW, cnt + 1, Infinity, shadeScale);
    }

    // One runs through each gap between sections and joins the channel.
    joins.forEach(function (jy) {
      var j = 0;
      while (j < n - 1 && py[j] < jy) j++;
      var sx = px[j] > W / 2 ? -30 : W + 30, sy = py[j] - (30 + rng() * 50), ex = px[j], ey = py[j];
      stream([sx, sy, lerp(sx, ex, 0.45), sy - 14, lerp(sx, ex, 0.8), ey - 70, ex, ey],
        1.2, small ? 3.5 : 8, 22, small ? 0.5 : 0.8);
    });

    // One flows out from under every docked panel (each job and school) into the channel,
    // so the panels stay tied to the river wherever a redraw sends it.
    Array.prototype.forEach.call(main.querySelectorAll('[data-dock]'), function (dock) {
      var x0 = 0, y0 = 0, node = dock;
      while (node && node !== main) { x0 += node.offsetLeft; y0 += node.offsetTop; node = node.offsetParent; }
      if (!node) return;
      var w = dock.offsetWidth, h = dock.offsetHeight;
      var sy = y0 + Math.min(h * 0.5, 60 + rng() * 30);
      var j = 0, drop = (small ? 34 : 56) + rng() * (small ? 20 : 44);
      while (j < n - 1 && py[j] < sy + drop) j++;
      var fromLeft = x0 + w / 2 < px[j];
      var sx = fromLeft ? x0 + w - Math.min(60, w * 0.3) : x0 + Math.min(60, w * 0.3);
      var ex = px[j], ey = py[j];
      stream([sx, sy, lerp(sx, ex, 0.6), sy - 6, lerp(sx, ex, 0.92), lerp(sy, ey, 0.15), ex, ey],
        1.6, small ? 3 : 6.5, 8, small ? 0.5 : 0.7);
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
    while (gCurrent.firstChild) gCurrent.removeChild(gCurrent.firstChild);
    (small ? [-0.4, 0.35] : [-0.58, -0.28, 0.02, 0.33, 0.62]).forEach(function (frac, li) {
      var pts = [];
      for (var j = 0; j < n; j++) {
        if (py[j] > seaTop - flare * 0.55) break;
        var o = frac * hw[j] + Math.sin(j * STEP * 0.03 + li * 1.7) * 1.4;
        pts.push(f1(px[j] + nx[j] * o) + ' ' + f1(py[j] + ny[j] * o));
      }
      if (pts.length < 2) return;
      var p = addPath('current', gCurrent);
      p.setAttribute('d', 'M' + pts.join('L'));
      var dash = [20 + rng() * 50, 70 + rng() * 110, 10 + rng() * 30, 90 + rng() * 120].map(Math.round);
      var cycle = dash[0] + dash[1] + dash[2] + dash[3];
      p.setAttribute('stroke-dasharray', dash.join(' '));
      p.style.setProperty('--cycle', cycle);
      p.style.setProperty('--dur', (cycle / (46 + rng() * 30)).toFixed(2) + 's');
    });

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
  function applyReveal() {
    if (!canAnimate || !centre || inked >= height - 2) { layer.style.clipPath = ''; return; }
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
