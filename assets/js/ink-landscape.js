(function () {
  'use strict';

  // ── PRNG (mulberry32) ──────────────────────
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // ── Perlin 2D ──────────────────────────────
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
      var xi = Math.floor(x) & 255;
      var yi = Math.floor(y) & 255;
      var xf = x - Math.floor(x);
      var yf = y - Math.floor(y);
      var u = fade(xf);
      var v = fade(yf);
      var aa = perm[perm[xi] + yi];
      var ab = perm[perm[xi] + yi + 1];
      var ba = perm[perm[xi + 1] + yi];
      var bb = perm[perm[xi + 1] + yi + 1];
      return lerp(
        lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u),
        lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u),
        v
      );
    };
  }

  // ── Noise helpers ──────────────────────────
  function loopNoise(perlin, rng, count) {
    var pts = [];
    var off = rng() * 1000;
    for (var i = 0; i < count; i++) {
      var a = (i / count) * Math.PI * 2;
      var nx = Math.cos(a) * 2 + off;
      var ny = Math.sin(a) * 2 + off;
      pts.push(perlin.noise(nx, ny));
    }
    return pts;
  }

  // ── Stroke: variable-width ink brush ───────
  function stroke(points, color, width, rng, perlin) {
    if (points.length < 2) return '';
    color = color || 'rgba(45,38,32,0.85)';
    width = width || 3;
    var noiseAmp = width * 0.4;
    var nOff = rng() * 1000;
    var len = points.length;
    var left = [], right = [];

    for (var i = 0; i < len; i++) {
      var t = i / (len - 1);
      var taper = Math.sin(t * Math.PI);
      var w = width * taper * 0.5;
      var nx = perlin.noise(i * 0.15 + nOff, 0) * noiseAmp;
      var ny = perlin.noise(0, i * 0.15 + nOff) * noiseAmp;
      var dx, dy, perpX, perpY, mag;

      if (i === 0) {
        dx = points[1][0] - points[0][0];
        dy = points[1][1] - points[0][1];
      } else if (i === len - 1) {
        dx = points[len - 1][0] - points[len - 2][0];
        dy = points[len - 1][1] - points[len - 2][1];
      } else {
        dx = points[i + 1][0] - points[i - 1][0];
        dy = points[i + 1][1] - points[i - 1][1];
      }
      mag = Math.sqrt(dx * dx + dy * dy) || 1;
      perpX = -dy / mag;
      perpY = dx / mag;
      left.push([
        points[i][0] + perpX * w + nx,
        points[i][1] + perpY * w + ny
      ]);
      right.push([
        points[i][0] - perpX * w - nx,
        points[i][1] - perpY * w - ny
      ]);
    }

    right.reverse();
    var all = left.concat(right);
    var d = 'M' + all[0][0].toFixed(1) + ',' + all[0][1].toFixed(1);
    for (var i = 1; i < all.length; i++) {
      d += 'L' + all[i][0].toFixed(1) + ',' + all[i][1].toFixed(1);
    }
    d += 'Z';
    return '<path d="' + d + '" fill="' + color + '" />';
  }

  // ── Blob: organic filled shape ─────────────
  function blob(cx, cy, radius, pts, color, rng, perlin) {
    pts = pts || 12;
    color = color || 'rgba(45,38,32,0.7)';
    var noise = loopNoise(perlin, rng, pts);
    var d = '';
    for (var i = 0; i <= pts; i++) {
      var idx = i % pts;
      var a = (idx / pts) * Math.PI * 2;
      var r = radius * (0.8 + noise[idx] * 0.4);
      var x = cx + Math.cos(a) * r;
      var y = cy + Math.sin(a) * r;
      d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1);
    }
    d += 'Z';
    return '<path d="' + d + '" fill="' + color + '" />';
  }

  // ── Texture: ink-wash hatching ─────────────
  function texture(points, color, density, rng, perlin) {
    if (points.length < 3) return '';
    color = color || 'rgba(45,38,32,0.15)';
    density = density || 5;
    var svg = '';
    var minY = Infinity, maxY = -Infinity;
    for (var i = 0; i < points.length; i++) {
      if (points[i][1] < minY) minY = points[i][1];
      if (points[i][1] > maxY) maxY = points[i][1];
    }
    for (var y = minY; y < maxY; y += density) {
      var xs = [];
      for (var i = 0; i < points.length; i++) {
        var j = (i + 1) % points.length;
        var y0 = points[i][1], y1 = points[j][1];
        if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
          var t = (y - y0) / (y1 - y0);
          xs.push(points[i][0] + t * (points[j][0] - points[i][0]));
        }
      }
      xs.sort(function (a, b) { return a - b; });
      for (var k = 0; k + 1 < xs.length; k += 2) {
        if (rng() > 0.6) continue;
        var pts = [];
        var steps = Math.max(2, Math.floor((xs[k + 1] - xs[k]) / 8));
        for (var s = 0; s <= steps; s++) {
          var frac = s / steps;
          pts.push([
            xs[k] + frac * (xs[k + 1] - xs[k]),
            y + perlin.noise(xs[k] + frac * 20, y * 0.1) * 2
          ]);
        }
        svg += stroke(pts, color, 0.8 + rng() * 0.6, rng, perlin);
      }
    }
    return svg;
  }

  // ── Mountain profile ───────────────────────
  function mountainProfile(x0, x1, baseY, height, rng, perlin, envelope) {
    var count = 50;
    var pts = [];
    for (var i = 0; i <= count; i++) {
      var t = i / count;
      var x = x0 + t * (x1 - x0);
      var h = Math.cos(t * Math.PI - Math.PI / 2);
      h *= 0.5 + perlin.noise(x * 0.004, rng() * 100) * 0.5;
      if (envelope) h *= envelope(t);
      var y = baseY - h * height;
      pts.push([x, y]);
    }
    return pts;
  }

  // ── Mountain ───────────────────────────────
  function mountain(x0, x1, baseY, height, color, rng, perlin, envelope) {
    var svg = '';
    var profile = mountainProfile(x0, x1, baseY, height, rng, perlin, envelope);
    var closed = profile.slice();
    closed.push([x1, baseY]);
    closed.push([x0, baseY]);

    // Filled shape
    var d = 'M' + closed[0][0].toFixed(1) + ',' + closed[0][1].toFixed(1);
    for (var i = 1; i < closed.length; i++) {
      d += 'L' + closed[i][0].toFixed(1) + ',' + closed[i][1].toFixed(1);
    }
    d += 'Z';
    svg += '<path d="' + d + '" fill="' + color + '" />';

    // Texture hatching
    svg += texture(closed, color.replace(/[\d.]+\)$/, '0.12)'), 6, rng, perlin);

    // Outline stroke along ridgeline
    svg += stroke(profile, color.replace(/[\d.]+\)$/, '0.7)'), 1.5, rng, perlin);

    return { svg: svg, profile: profile };
  }

  // ── Tree ───────────────────────────────────
  function tree(x, y, h, rng, perlin) {
    var svg = '';
    var trunkPts = [];
    var steps = 8;
    for (var i = 0; i <= steps; i++) {
      var t = i / steps;
      trunkPts.push([
        x + perlin.noise(t * 5, rng() * 100) * 2,
        y - t * h * 0.6
      ]);
    }
    svg += stroke(trunkPts, 'rgba(45,38,32,0.75)', 1.5 + rng() * 1, rng, perlin);

    var top = y - h * 0.6;
    var canopyCount = 3 + Math.floor(rng() * 3);
    for (var i = 0; i < canopyCount; i++) {
      var cx = x + (rng() - 0.5) * h * 0.5;
      var cy = top - rng() * h * 0.35;
      var r = h * (0.12 + rng() * 0.12);
      svg += blob(cx, cy, r, 8 + Math.floor(rng() * 4), 'rgba(45,38,32,' + (0.15 + rng() * 0.2).toFixed(2) + ')', rng, perlin);
    }
    return svg;
  }

  // ── Water ripples ──────────────────────────
  function water(x0, x1, y, rng, perlin) {
    var svg = '';
    var rows = 4;
    for (var r = 0; r < rows; r++) {
      var wy = y + r * 12 + rng() * 6;
      var segments = 3 + Math.floor(rng() * 4);
      for (var s = 0; s < segments; s++) {
        var sx = x0 + rng() * (x1 - x0);
        var len = 30 + rng() * 80;
        var pts = [];
        var steps = 8;
        for (var i = 0; i <= steps; i++) {
          var t = i / steps;
          pts.push([
            sx + t * len,
            wy + Math.sin(t * Math.PI * 2) * 2 + perlin.noise(sx + t * 10, wy) * 1.5
          ]);
        }
        svg += stroke(pts, 'rgba(45,38,32,' + (0.08 + rng() * 0.08).toFixed(2) + ')', 0.5 + rng() * 0.5, rng, perlin);
      }
    }
    return svg;
  }

  // ── Paper texture ──────────────────────────
  function paperTexture(w, h) {
    var canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    var ctx = canvas.getContext('2d');
    var img = ctx.createImageData(w, h);
    var d = img.data;
    var rng = mulberry32(42);
    var perlin = new Perlin2D(rng);
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var idx = (y * w + x) * 4;
        var n = perlin.noise(x * 0.05, y * 0.05);
        var c = 245 + n * 10 - rng() * 20;
        c = Math.max(220, Math.min(255, c));
        d[idx] = c;
        d[idx + 1] = c * 0.95;
        d[idx + 2] = c * 0.85;
        d[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return canvas.toDataURL('image/png');
  }

  // ── Compose landscape ──────────────────────
  function generate(container, width, height, seed) {
    var rng = mulberry32(seed);
    var perlin = new Perlin2D(rng);

    // Envelope: reduce height in central 40% for text readability
    function envelope(t) {
      var center = 0.5;
      var d = Math.abs(t - center);
      if (d < 0.2) return 0.3 + (d / 0.2) * 0.7;
      return 1;
    }

    var svg = '';
    var baseY = height * 0.72;
    var layers = [
      { h: height * 0.28, alpha: 0.12, yOff: 0 },
      { h: height * 0.22, alpha: 0.2, yOff: height * 0.04 },
      { h: height * 0.18, alpha: 0.35, yOff: height * 0.08 },
      { h: height * 0.15, alpha: 0.55, yOff: height * 0.12 }
    ];

    for (var l = 0; l < layers.length; l++) {
      var layer = layers[l];
      var color = 'rgba(45,38,32,' + layer.alpha.toFixed(2) + ')';
      var by = baseY + layer.yOff;
      var m = mountain(0, width, by, layer.h, color, rng, perlin, envelope);
      svg += m.svg;

      // Trees on later layers
      if (l >= 2) {
        var profile = m.profile;
        var treeCount = 4 + Math.floor(rng() * 5);
        for (var ti = 0; ti < treeCount; ti++) {
          var idx = Math.floor(rng() * profile.length);
          var tx = profile[idx][0];
          var ty = profile[idx][1];
          var th = 15 + rng() * 25;
          svg += tree(tx, ty, th, rng, perlin);
        }
      }
    }

    // Water at the base
    svg += water(0, width, baseY + height * 0.14, rng, perlin);

    container.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + width + ' ' + height + '" preserveAspectRatio="xMidYMid slice">' +
      svg +
      '</svg>';
  }

  window.InkScape = {
    generate: generate,
    paperTexture: paperTexture,
    stroke: stroke,
    blob: blob
  };
})();
