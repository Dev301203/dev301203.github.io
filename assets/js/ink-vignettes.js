(function () {
  'use strict';

  if (!window.InkScape) return;

  var stroke = window.InkScape.stroke;
  var blob = window.InkScape.blob;

  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function Perlin2D(rng) {
    var perm = [];
    for (var i = 0; i < 256; i++) perm[i] = i;
    for (var i = 255; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var tmp = perm[i]; perm[i] = perm[j]; perm[j] = tmp;
    }
    for (var i = 0; i < 256; i++) perm[256 + i] = perm[i];
    function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
    function lerp(a, b, t) { return a + t * (b - a); }
    function grad(hash, x, y) {
      var h = hash & 3;
      var u = h < 2 ? x : y;
      var v = h < 2 ? y : x;
      return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
    }
    this.noise = function (x, y) {
      var xi = Math.floor(x) & 255, yi = Math.floor(y) & 255;
      var xf = x - Math.floor(x), yf = y - Math.floor(y);
      var u = fade(xf), v = fade(yf);
      var aa = perm[perm[xi] + yi], ab = perm[perm[xi] + yi + 1];
      var ba = perm[perm[xi + 1] + yi], bb = perm[perm[xi + 1] + yi + 1];
      return lerp(lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u), lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u), v);
    };
  }

  function wrap(inner, w, h) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '">' + inner + '</svg>';
  }

  // ── Mountain cluster ───────────────────────
  function mountainCluster() {
    var rng = mulberry32(137);
    var p = new Perlin2D(rng);
    var w = 180, h = 60;
    var svg = '';
    var peaks = [
      { cx: 50, bw: 60, ph: 35, a: 0.45 },
      { cx: 90, bw: 70, ph: 45, a: 0.3 },
      { cx: 130, bw: 55, ph: 30, a: 0.5 }
    ];
    peaks.forEach(function (pk) {
      var pts = [];
      var steps = 20;
      for (var i = 0; i <= steps; i++) {
        var t = i / steps;
        var x = pk.cx - pk.bw / 2 + t * pk.bw;
        var y = h - Math.sin(t * Math.PI) * pk.ph * (0.8 + p.noise(x * 0.1, pk.cx) * 0.4);
        pts.push([x, y]);
      }
      var color = 'rgba(45,38,32,' + pk.a.toFixed(2) + ')';
      svg += stroke(pts, { col: color, wid: 1.5 });
      var filled = pts.slice();
      filled.push([pk.cx + pk.bw / 2, h]);
      filled.push([pk.cx - pk.bw / 2, h]);
      var d = 'M' + filled[0][0].toFixed(1) + ',' + filled[0][1].toFixed(1);
      for (var i = 1; i < filled.length; i++) d += 'L' + filled[i][0].toFixed(1) + ',' + filled[i][1].toFixed(1);
      d += 'Z';
      svg += '<path d="' + d + '" fill="rgba(45,38,32,' + (pk.a * 0.3).toFixed(2) + ')" />';
    });
    return wrap(svg, w, h);
  }

  // ── Lone pine ──────────────────────────────
  function lonePine() {
    var rng = mulberry32(42);
    var p = new Perlin2D(rng);
    var w = 80, h = 80;
    var svg = '';
    var trunk = [];
    for (var i = 0; i <= 10; i++) {
      var t = i / 10;
      trunk.push([40 + p.noise(t * 5, 0) * 1.5, h - t * 55]);
    }
    svg += stroke(trunk, { col: 'rgba(45,38,32,0.7)', wid: 1.8 });
    for (var i = 0; i < 5; i++) {
      var cy = h - 30 - i * 8;
      var r = 10 - i * 1.2;
      svg += blob(40 + (rng() - 0.5) * 6, cy, {
        len: r * 2, wid: 8,
        col: 'rgba(45,38,32,' + (0.15 + rng() * 0.15).toFixed(2) + ')'
      });
    }
    return wrap(svg, w, h);
  }

  // ── Water ripples ──────────────────────────
  function waterRipples() {
    var rng = mulberry32(73);
    var p = new Perlin2D(rng);
    var w = 160, h = 30;
    var svg = '';
    for (var r = 0; r < 3; r++) {
      var y = 8 + r * 8;
      var segs = 2 + Math.floor(rng() * 3);
      for (var s = 0; s < segs; s++) {
        var sx = 10 + rng() * (w - 40);
        var len = 25 + rng() * 40;
        var pts = [];
        for (var i = 0; i <= 6; i++) {
          var t = i / 6;
          pts.push([sx + t * len, y + Math.sin(t * Math.PI * 2) * 1.5 + p.noise(sx + t * 8, y) * 1]);
        }
        svg += stroke(pts, { col: 'rgba(45,38,32,' + (0.12 + rng() * 0.1).toFixed(2) + ')', wid: 0.6 });
      }
    }
    return wrap(svg, w, h);
  }

  // ── Bamboo ─────────────────────────────────
  function bamboo() {
    var rng = mulberry32(201);
    var p = new Perlin2D(rng);
    var w = 80, h = 90;
    var svg = '';
    var stalks = 3;
    for (var s = 0; s < stalks; s++) {
      var bx = 25 + s * 15 + (rng() - 0.5) * 6;
      var pts = [];
      for (var i = 0; i <= 12; i++) {
        var t = i / 12;
        pts.push([bx + p.noise(t * 4 + s, 0) * 2, h - t * 75]);
      }
      svg += stroke(pts, { col: 'rgba(45,38,32,0.55)', wid: 2.5 });
      for (var n = 1; n < 5; n++) {
        var ny = h - n * 16;
        var npts = [[bx - 3, ny], [bx + 3, ny]];
        svg += stroke(npts, { col: 'rgba(45,38,32,0.4)', wid: 1.5 });
      }
      var leafCount = 2 + Math.floor(rng() * 3);
      for (var l = 0; l < leafCount; l++) {
        var ly = h - 30 - rng() * 40;
        var side = rng() > 0.5 ? 1 : -1;
        var leafPts = [];
        for (var i = 0; i <= 6; i++) {
          var t = i / 6;
          leafPts.push([bx + side * t * 18 + p.noise(t * 3, ly) * 2, ly - Math.sin(t * Math.PI) * 6]);
        }
        svg += stroke(leafPts, { col: 'rgba(45,38,32,' + (0.2 + rng() * 0.15).toFixed(2) + ')', wid: 0.8 });
      }
    }
    return wrap(svg, w, h);
  }

  // ── Cloud wisp ─────────────────────────────
  function cloudWisp() {
    var rng = mulberry32(99);
    var p = new Perlin2D(rng);
    var w = 150, h = 40;
    var svg = '';
    for (var c = 0; c < 3; c++) {
      var cx = 30 + c * 35 + (rng() - 0.5) * 15;
      var cy = 18 + (rng() - 0.5) * 8;
      var r = 10 + rng() * 8;
      svg += blob(cx, cy, {
        len: r * 2, wid: 10,
        col: 'rgba(45,38,32,' + (0.05 + rng() * 0.06).toFixed(2) + ')'
      });
    }
    var pts = [];
    for (var i = 0; i <= 20; i++) {
      var t = i / 20;
      pts.push([10 + t * (w - 20), 20 + p.noise(t * 5, 0) * 4]);
    }
    svg += stroke(pts, { col: 'rgba(45,38,32,0.08)', wid: 0.5 });
    return wrap(svg, w, h);
  }

  window.InkVignettes = {
    mountainCluster: mountainCluster,
    lonePine: lonePine,
    waterRipples: waterRipples,
    bamboo: bamboo,
    cloudWisp: cloudWisp
  };
})();
