// Shan-shui-inf landscape engine — adapted from github.com/LingDong-/shan-shui-inf (MIT)
(function () {
  'use strict';

  // ── PRNG ───────────────────────────────────
  var Prng = {
    s: 1234,
    p: 999979,
    q: 999983,
    m: 999979 * 999983,
    hash: function (x) {
      var y = window.btoa(JSON.stringify(x));
      var z = 0;
      for (var i = 0; i < y.length; i++) {
        z += y.charCodeAt(i) * Math.pow(128, i);
      }
      return z;
    },
    seed: function (x) {
      if (x == undefined) x = new Date().getTime();
      var y = 0, z = 0;
      function redo() { y = (Prng.hash(x) + z) % Prng.m; z += 1; }
      while (y % Prng.p == 0 || y % Prng.q == 0 || y == 0 || y == 1) redo();
      Prng.s = y;
      for (var i = 0; i < 10; i++) Prng.next();
    },
    next: function () {
      Prng.s = (Prng.s * Prng.s) % Prng.m;
      return Prng.s / Prng.m;
    }
  };
  var _origRandom = Math.random;
  function usePrng() { Math.random = function () { return Prng.next(); }; }
  function restoreRandom() { Math.random = _origRandom; }

  // ── Perlin Noise (p5.js port) ──────────────
  var Noise = new function () {
    var PERLIN_YWRAPB = 4, PERLIN_YWRAP = 1 << 4;
    var PERLIN_ZWRAPB = 8, PERLIN_ZWRAP = 1 << 8;
    var PERLIN_SIZE = 4095;
    var perlin_octaves = 4, perlin_amp_falloff = 0.5;
    var scaled_cosine = function (i) { return 0.5 * (1.0 - Math.cos(i * Math.PI)); };
    var perlin;
    this.noise = function (x, y, z) {
      y = y || 0; z = z || 0;
      if (perlin == null) {
        perlin = new Array(PERLIN_SIZE + 1);
        for (var i = 0; i < PERLIN_SIZE + 1; i++) perlin[i] = Math.random();
      }
      if (x < 0) x = -x; if (y < 0) y = -y; if (z < 0) z = -z;
      var xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
      var xf = x - xi, yf = y - yi, zf = z - zi;
      var rxf, ryf, r = 0, ampl = 0.5, n1, n2, n3;
      for (var o = 0; o < perlin_octaves; o++) {
        var of_ = xi + (yi << PERLIN_YWRAPB) + (zi << PERLIN_ZWRAPB);
        rxf = scaled_cosine(xf); ryf = scaled_cosine(yf);
        n1 = perlin[of_ & PERLIN_SIZE];
        n1 += rxf * (perlin[(of_ + 1) & PERLIN_SIZE] - n1);
        n2 = perlin[(of_ + PERLIN_YWRAP) & PERLIN_SIZE];
        n2 += rxf * (perlin[(of_ + PERLIN_YWRAP + 1) & PERLIN_SIZE] - n2);
        n1 += ryf * (n2 - n1);
        of_ += PERLIN_ZWRAP;
        n2 = perlin[of_ & PERLIN_SIZE];
        n2 += rxf * (perlin[(of_ + 1) & PERLIN_SIZE] - n2);
        n3 = perlin[(of_ + PERLIN_YWRAP) & PERLIN_SIZE];
        n3 += rxf * (perlin[(of_ + PERLIN_YWRAP + 1) & PERLIN_SIZE] - n3);
        n2 += ryf * (n3 - n2);
        n1 += scaled_cosine(zf) * (n2 - n1);
        r += n1 * ampl; ampl *= perlin_amp_falloff;
        xi <<= 1; xf *= 2; yi <<= 1; yf *= 2; zi <<= 1; zf *= 2;
        if (xf >= 1.0) { xi++; xf--; }
        if (yf >= 1.0) { yi++; yf--; }
        if (zf >= 1.0) { zi++; zf--; }
      }
      return r;
    };
    this.noiseDetail = function (lod, falloff) {
      if (lod > 0) perlin_octaves = lod;
      if (falloff > 0) perlin_amp_falloff = falloff;
    };
  }();

  // ── PolyTools ──────────────────────────────
  var PolyTools = {
    midPt: function () {
      var plist = arguments.length == 1 ? arguments[0] : Array.apply(null, arguments);
      return plist.reduce(function (acc, v) {
        return [v[0] / plist.length + acc[0], v[1] / plist.length + acc[1]];
      }, [0, 0]);
    },
    triangulate: function (plist, args) {
      args = args != undefined ? args : {};
      var area = args.area != undefined ? args.area : 100;
      var convex = args.convex != undefined ? args.convex : false;
      var optimize = args.optimize != undefined ? args.optimize : true;
      function lineExpr(pt0, pt1) {
        var den = pt1[0] - pt0[0];
        var m = den == 0 ? Infinity : (pt1[1] - pt0[1]) / den;
        return [m, pt0[1] - m * pt0[0]];
      }
      function intersect(ln0, ln1) {
        var le0 = lineExpr(ln0[0], ln0[1]), le1 = lineExpr(ln1[0], ln1[1]);
        var den = le0[0] - le1[0];
        if (den == 0) return false;
        var x = (le1[1] - le0[1]) / den, y = le0[0] * x + le0[1];
        function onSeg(p, ln) {
          return Math.min(ln[0][0], ln[1][0]) <= p[0] && p[0] <= Math.max(ln[0][0], ln[1][0]) &&
                 Math.min(ln[0][1], ln[1][1]) <= p[1] && p[1] <= Math.max(ln[0][1], ln[1][1]);
        }
        return (onSeg([x, y], ln0) && onSeg([x, y], ln1)) ? [x, y] : false;
      }
      function ptInPoly(pt, pl) {
        var sc = 0;
        for (var i = 0; i < pl.length; i++) {
          var np = pl[i != pl.length - 1 ? i + 1 : 0];
          if (intersect([pl[i], np], [pt, [pt[0] + 999, pt[1] + 999]]) !== false) sc++;
        }
        return sc % 2 == 1;
      }
      function lnInPoly(ln, pl) {
        var ep = 0.01;
        var lnc = [
          [ln[0][0] * (1 - ep) + ln[1][0] * ep, ln[0][1] * (1 - ep) + ln[1][1] * ep],
          [ln[0][0] * ep + ln[1][0] * (1 - ep), ln[0][1] * ep + ln[1][1] * (1 - ep)]
        ];
        for (var i = 0; i < pl.length; i++) {
          if (intersect(lnc, [pl[i], pl[i != pl.length - 1 ? i + 1 : 0]]) !== false) return false;
        }
        return ptInPoly(PolyTools.midPt(ln), pl);
      }
      function sidesOf(pl) {
        var s = [];
        for (var i = 0; i < pl.length; i++) {
          var np = pl[i != pl.length - 1 ? i + 1 : 0];
          s.push(Math.sqrt(Math.pow(np[0] - pl[i][0], 2) + Math.pow(np[1] - pl[i][1], 2)));
        }
        return s;
      }
      function areaOf(pl) { var s = sidesOf(pl); var a = s[0], b = s[1], c = s[2], sp = (a + b + c) / 2; return Math.sqrt(sp * (sp - a) * (sp - b) * (sp - c)); }
      function sliverRatio(pl) { return areaOf(pl) / sidesOf(pl).reduce(function (m, n) { return m + n; }, 0); }
      function bestEar(pl) {
        var cuts = [];
        for (var i = 0; i < pl.length; i++) {
          var lp = pl[i != 0 ? i - 1 : pl.length - 1], np = pl[i != pl.length - 1 ? i + 1 : 0];
          var ql = pl.slice(); ql.splice(i, 1);
          if (convex || lnInPoly([lp, np], pl)) {
            var c = [[lp, pl[i], np], ql]; if (!optimize) return c; cuts.push(c);
          }
        }
        var best = [pl, []], bestR = 0;
        for (var i = 0; i < cuts.length; i++) { var r = sliverRatio(cuts[i][0]); if (r >= bestR) { best = cuts[i]; bestR = r; } }
        return best;
      }
      function shatter(pl, a) {
        if (pl.length == 0) return [];
        if (areaOf(pl) < a) return [pl];
        var sl = sidesOf(pl);
        var ind = sl.reduce(function (iMax, x, i, arr) { return x > arr[iMax] ? i : iMax; }, 0);
        var nind = (ind + 1) % pl.length, lind = (ind + 2) % pl.length;
        try { var mid = PolyTools.midPt([pl[ind], pl[nind]]); } catch (e) { return []; }
        return shatter([pl[ind], mid, pl[lind]], a).concat(shatter([pl[lind], pl[nind], mid], a));
      }
      if (plist.length <= 3) return shatter(plist, area);
      var cut = bestEar(plist);
      return shatter(cut[0], area).concat(PolyTools.triangulate(cut[1], args));
    }
  };

  // ── Utility functions ──────────────────────
  function distance(p0, p1) { return Math.sqrt(Math.pow(p0[0] - p1[0], 2) + Math.pow(p0[1] - p1[1], 2)); }
  function mapval(value, istart, istop, ostart, ostop) { return ostart + (ostop - ostart) * ((value - istart) / (istop - istart)); }
  function loopNoise(nslist) {
    var dif = nslist[nslist.length - 1] - nslist[0];
    var bds = [100, -100];
    for (var i = 0; i < nslist.length; i++) {
      nslist[i] += (dif * (nslist.length - 1 - i)) / (nslist.length - 1);
      if (nslist[i] < bds[0]) bds[0] = nslist[i];
      if (nslist[i] > bds[1]) bds[1] = nslist[i];
    }
    for (var i = 0; i < nslist.length; i++) nslist[i] = mapval(nslist[i], bds[0], bds[1], 0, 1);
  }
  function randChoice(arr) { return arr[Math.floor(arr.length * Math.random())]; }
  function normRand(m, M) { return mapval(Math.random(), 0, 1, m, M); }
  function wtrand(func) { var x = Math.random(), y = Math.random(); return y < func(x) ? x : wtrand(func); }
  function randGaussian() { return wtrand(function (x) { return Math.pow(Math.E, -24 * Math.pow(x - 0.5, 2)); }) * 2 - 1; }

  function bezmh(P, w) {
    w = w == undefined ? 1 : w;
    if (P.length == 2) P = [P[0], PolyTools.midPt(P[0], P[1]), P[1]];
    var plist = [];
    for (var j = 0; j < P.length - 2; j++) {
      var p0 = j == 0 ? P[j] : PolyTools.midPt(P[j], P[j + 1]);
      var p1 = P[j + 1];
      var p2 = j == P.length - 3 ? P[j + 2] : PolyTools.midPt(P[j + 1], P[j + 2]);
      var pl = 20;
      for (var i = 0; i < pl + (j == P.length - 3); i++) {
        var t = i / pl;
        var u = Math.pow(1 - t, 2) + 2 * t * (1 - t) * w + t * t;
        plist.push([
          (Math.pow(1 - t, 2) * p0[0] + 2 * t * (1 - t) * p1[0] * w + t * t * p2[0]) / u,
          (Math.pow(1 - t, 2) * p0[1] + 2 * t * (1 - t) * p1[1] * w + t * t * p2[1]) / u
        ]);
      }
    }
    return plist;
  }

  function poly(plist, args) {
    args = args != undefined ? args : {};
    var xof = args.xof || 0, yof = args.yof || 0;
    var fil = args.fil != undefined ? args.fil : "rgba(0,0,0,0)";
    var str = args.str != undefined ? args.str : fil;
    var wid = args.wid != undefined ? args.wid : 0;
    var canv = "<polyline points='";
    for (var i = 0; i < plist.length; i++) {
      canv += " " + (plist[i][0] + xof).toFixed(1) + "," + (plist[i][1] + yof).toFixed(1);
    }
    canv += "' style='fill:" + fil + ";stroke:" + str + ";stroke-width:" + wid + "'/>";
    return canv;
  }

  function div(plist, reso) {
    var tl = (plist.length - 1) * reso;
    var lx = 0, ly = 0, rlist = [];
    for (var i = 0; i < tl; i++) {
      var lastp = plist[Math.floor(i / reso)], nextp = plist[Math.ceil(i / reso)];
      var p = (i % reso) / reso;
      var nx = lastp[0] * (1 - p) + nextp[0] * p;
      var ny = lastp[1] * (1 - p) + nextp[1] * p;
      rlist.push([nx, ny]); lx = nx; ly = ny;
    }
    if (plist.length > 0) rlist.push(plist[plist.length - 1]);
    return rlist;
  }

  // ── stroke ─────────────────────────────────
  function stroke(ptlist, args) {
    args = args != undefined ? args : {};
    var xof = args.xof || 0, yof = args.yof || 0;
    var wid = args.wid != undefined ? args.wid : 2;
    var col = args.col != undefined ? args.col : "rgba(200,200,200,0.9)";
    var noi = args.noi != undefined ? args.noi : 0.5;
    var out = args.out != undefined ? args.out : 1;
    var fun = args.fun != undefined ? args.fun : function (x) { return Math.sin(x * Math.PI); };
    if (ptlist.length == 0) return "";
    var vtxlist0 = [], vtxlist1 = [];
    var n0 = Math.random() * 10;
    for (var i = 1; i < ptlist.length - 1; i++) {
      var w = wid * fun(i / ptlist.length);
      w = w * (1 - noi) + w * noi * Noise.noise(i * 0.5, n0);
      var a1 = Math.atan2(ptlist[i][1] - ptlist[i - 1][1], ptlist[i][0] - ptlist[i - 1][0]);
      var a2 = Math.atan2(ptlist[i][1] - ptlist[i + 1][1], ptlist[i][0] - ptlist[i + 1][0]);
      var a = (a1 + a2) / 2;
      if (a < a2) a += Math.PI;
      vtxlist0.push([ptlist[i][0] + w * Math.cos(a), ptlist[i][1] + w * Math.sin(a)]);
      vtxlist1.push([ptlist[i][0] - w * Math.cos(a), ptlist[i][1] - w * Math.sin(a)]);
    }
    var vtxlist = [ptlist[0]].concat(vtxlist0.concat(vtxlist1.concat([ptlist[ptlist.length - 1]]).reverse())).concat([ptlist[0]]);
    return poly(vtxlist.map(function (x) { return [x[0] + xof, x[1] + yof]; }), { fil: col, str: col, wid: out });
  }

  // ── blob ───────────────────────────────────
  function blob(x, y, args) {
    args = args != undefined ? args : {};
    var len = args.len != undefined ? args.len : 20;
    var wid = args.wid != undefined ? args.wid : 5;
    var ang = args.ang != undefined ? args.ang : 0;
    var col = args.col != undefined ? args.col : "rgba(200,200,200,0.9)";
    var noi = args.noi != undefined ? args.noi : 0.5;
    var ret = args.ret != undefined ? args.ret : 0;
    var fun = args.fun != undefined ? args.fun : function (x) {
      return x <= 1 ? Math.pow(Math.sin(x * Math.PI), 0.5) : -Math.pow(Math.sin((x + 1) * Math.PI), 0.5);
    };
    var reso = 20.0, lalist = [];
    for (var i = 0; i < reso + 1; i++) {
      var p = (i / reso) * 2;
      var xo = len / 2 - Math.abs(p - 1) * len;
      var yo = (fun(p) * wid) / 2;
      var a = Math.atan2(yo, xo);
      var l = Math.sqrt(xo * xo + yo * yo);
      lalist.push([l, a]);
    }
    var nslist = [], n0 = Math.random() * 10;
    for (var i = 0; i < reso + 1; i++) nslist.push(Noise.noise(i * 0.05, n0));
    loopNoise(nslist);
    var plist = [];
    for (var i = 0; i < lalist.length; i++) {
      var ns = nslist[i] * noi + (1 - noi);
      plist.push([x + Math.cos(lalist[i][1] + ang) * lalist[i][0] * ns, y + Math.sin(lalist[i][1] + ang) * lalist[i][0] * ns]);
    }
    return ret == 0 ? poly(plist, { fil: col, str: col, wid: 0 }) : plist;
  }

  // ── texture ────────────────────────────────
  var texture = function (ptlist, args) {
    args = args != undefined ? args : {};
    var xof = args.xof || 0, yof = args.yof || 0;
    var tex = args.tex != undefined ? args.tex : 400;
    var wid = args.wid != undefined ? args.wid : 1.5;
    var len = args.len != undefined ? args.len : 0.2;
    var sha = args.sha != undefined ? args.sha : 0;
    var noi = args.noi != undefined ? args.noi : function (x) { return 30 / x; };
    var col = args.col != undefined ? args.col : function () { return "rgba(100,100,100," + (Math.random() * 0.3).toFixed(3) + ")"; };
    var dis = args.dis != undefined ? args.dis : function () {
      return Math.random() > 0.5 ? (1 / 3) * Math.random() : 2 / 3 + (1 / 3) * Math.random();
    };
    var reso = [ptlist.length, ptlist[0].length];
    var texlist = [];
    for (var i = 0; i < tex; i++) {
      var mid = (dis() * reso[1]) | 0;
      var hlen = Math.floor(Math.random() * (reso[1] * len));
      var start = Math.min(Math.max(mid - hlen, 0), reso[1]);
      var end = Math.min(Math.max(mid + hlen, 0), reso[1]);
      var layer = (i / tex) * (reso[0] - 1);
      texlist.push([]);
      for (var j = start; j < end; j++) {
        var p = layer - Math.floor(layer);
        var x = ptlist[Math.floor(layer)][j][0] * p + ptlist[Math.ceil(layer)][j][0] * (1 - p);
        var y = ptlist[Math.floor(layer)][j][1] * p + ptlist[Math.ceil(layer)][j][1] * (1 - p);
        var ns = [noi(layer + 1) * (Noise.noise(x, j * 0.5) - 0.5), noi(layer + 1) * (Noise.noise(y, j * 0.5) - 0.5)];
        texlist[texlist.length - 1].push([x + ns[0], y + ns[1]]);
      }
    }
    var canv = "";
    if (sha) {
      for (var j = 0; j < texlist.length; j += 2) {
        canv += stroke(texlist[j].map(function (x) { return [x[0] + xof, x[1] + yof]; }), { col: "rgba(100,100,100,0.1)", wid: sha });
      }
    }
    for (var j = 0 + (sha ? 1 : 0); j < texlist.length; j += 1 + (sha ? 1 : 0)) {
      canv += stroke(texlist[j].map(function (x) { return [x[0] + xof, x[1] + yof]; }), { col: col(j / texlist.length), wid: wid });
    }
    return canv;
  };

  // ── Tree ───────────────────────────────────
  var Tree = {};

  Tree.tree01 = function (x, y, args) {
    args = args != undefined ? args : {};
    var hei = args.hei != undefined ? args.hei : 50;
    var wid = args.wid != undefined ? args.wid : 3;
    var col = args.col != undefined ? args.col : "rgba(100,100,100,0.5)";
    var leafcol = col.includes("rgba(") ? col.replace("rgba(", "").replace(")", "").split(",") : ["100", "100", "100", "0.5"];
    var reso = 10, nslist = [];
    for (var i = 0; i < reso; i++) nslist.push([Noise.noise(i * 0.5), Noise.noise(i * 0.5, 0.5)]);
    var canv = "", line1 = [], line2 = [];
    for (var i = 0; i < reso; i++) {
      var nx = x, ny = y - (i * hei) / reso;
      if (i >= reso / 4) {
        for (var j = 0; j < (reso - i) / 5; j++) {
          canv += blob(nx + (Math.random() - 0.5) * wid * 1.2 * (reso - i), ny + (Math.random() - 0.5) * wid, {
            len: Math.random() * 20 * (reso - i) * 0.2 + 10, wid: Math.random() * 6 + 3,
            ang: ((Math.random() - 0.5) * Math.PI) / 6,
            col: "rgba(" + leafcol[0] + "," + leafcol[1] + "," + leafcol[2] + "," + (Math.random() * 0.2 + parseFloat(leafcol[3])).toFixed(1) + ")"
          });
        }
      }
      line1.push([nx + (nslist[i][0] - 0.5) * wid - wid / 2, ny]);
      line2.push([nx + (nslist[i][1] - 0.5) * wid + wid / 2, ny]);
    }
    canv += poly(line1, { fil: "none", str: col, wid: 1.5 }) + poly(line2, { fil: "none", str: col, wid: 1.5 });
    return canv;
  };

  Tree.tree02 = function (x, y, args) {
    args = args != undefined ? args : {};
    var hei = args.hei != undefined ? args.hei : 16;
    var wid = args.wid != undefined ? args.wid : 8;
    var clu = args.clu != undefined ? args.clu : 5;
    var col = args.col != undefined ? args.col : "rgba(100,100,100,0.5)";
    var canv = "";
    for (var i = 0; i < clu; i++) {
      canv += blob(x + randGaussian() * clu * 4, y + randGaussian() * clu * 4, {
        ang: Math.PI / 2,
        fun: function (x) { return x <= 1 ? Math.pow(Math.sin(x * Math.PI) * x, 0.5) : -Math.pow(Math.sin((x - 2) * Math.PI * (x - 2)), 0.5); },
        wid: Math.random() * wid * 0.75 + wid * 0.5,
        len: Math.random() * hei * 0.75 + hei * 0.5,
        col: col
      });
    }
    return canv;
  };

  Tree.tree03 = function (x, y, args) {
    args = args != undefined ? args : {};
    var hei = args.hei != undefined ? args.hei : 50;
    var wid = args.wid != undefined ? args.wid : 5;
    var ben = args.ben != undefined ? args.ben : function () { return 0; };
    var col = args.col != undefined ? args.col : "rgba(100,100,100,0.5)";
    var leafcol = col.includes("rgba(") ? col.replace("rgba(", "").replace(")", "").split(",") : ["100", "100", "100", "0.5"];
    var reso = 10, nslist = [];
    for (var i = 0; i < reso; i++) nslist.push([Noise.noise(i * 0.5), Noise.noise(i * 0.5, 0.5)]);
    var canv = "", blobs = "", line1 = [], line2 = [];
    for (var i = 0; i < reso; i++) {
      var nx = x + ben(i / reso) * 100;
      var ny = y - (i * hei) / reso;
      if (i >= reso / 5) {
        for (var j = 0; j < (reso - i) * 2; j++) {
          var shape = function (x) { return Math.log(50 * x + 1) / 3.95; };
          var ox = Math.random() * wid * 2 * shape((reso - i) / reso);
          blobs += blob(nx + ox * randChoice([-1, 1]), ny + (Math.random() - 0.5) * wid * 2, {
            len: ox * 2, wid: Math.random() * 6 + 3, ang: ((Math.random() - 0.5) * Math.PI) / 6,
            col: "rgba(" + leafcol[0] + "," + leafcol[1] + "," + leafcol[2] + "," + (Math.random() * 0.2 + parseFloat(leafcol[3])).toFixed(3) + ")"
          });
        }
      }
      line1.push([nx + (((nslist[i][0] - 0.5) * wid - wid / 2) * (reso - i)) / reso, ny]);
      line2.push([nx + (((nslist[i][1] - 0.5) * wid + wid / 2) * (reso - i)) / reso, ny]);
    }
    canv += poly(line1.concat(line2.reverse()), { fil: "white", str: col, wid: 1.5 });
    canv += blobs;
    return canv;
  };

  // tree04 — large branching tree with bark and twigs
  var branch = function (args) {
    args = args != undefined ? args : {};
    var hei = args.hei != undefined ? args.hei : 300;
    var wid = args.wid != undefined ? args.wid : 6;
    var ang = args.ang != undefined ? args.ang : 0;
    var det = args.det != undefined ? args.det : 10;
    var ben = args.ben != undefined ? args.ben : Math.PI * 0.2;
    var nx = 0, ny = 0, tlist = [[nx, ny]];
    var a0 = 0, g = 3;
    for (var i = 0; i < g; i++) {
      a0 += (ben / 2 + (Math.random() * ben) / 2) * randChoice([-1, 1]);
      nx += (Math.cos(a0) * hei) / g; ny -= (Math.sin(a0) * hei) / g;
      tlist.push([nx, ny]);
    }
    var ta = Math.atan2(tlist[tlist.length - 1][1], tlist[tlist.length - 1][0]);
    for (var i = 0; i < tlist.length; i++) {
      var a = Math.atan2(tlist[i][1], tlist[i][0]);
      var d = Math.sqrt(tlist[i][0] * tlist[i][0] + tlist[i][1] * tlist[i][1]);
      tlist[i][0] = d * Math.cos(a - ta + ang);
      tlist[i][1] = d * Math.sin(a - ta + ang);
    }
    var trlist1 = [], trlist2 = [];
    var span = det, tl = (tlist.length - 1) * span;
    var lx = 0, ly = 0;
    for (var i = 0; i < tl; i++) {
      var lastp = tlist[Math.floor(i / span)], nextp = tlist[Math.ceil(i / span)];
      var p = (i % span) / span;
      nx = lastp[0] * (1 - p) + nextp[0] * p;
      ny = lastp[1] * (1 - p) + nextp[1] * p;
      var bAng = Math.atan2(ny - ly, nx - lx);
      var woff = ((Noise.noise(i * 0.3) - 0.5) * wid * hei) / 80;
      var b = p == 0 ? Math.random() * wid : 0;
      var nw = wid * (((tl - i) / tl) * 0.5 + 0.5);
      trlist1.push([nx + Math.cos(bAng + Math.PI / 2) * (nw + woff + b), ny + Math.sin(bAng + Math.PI / 2) * (nw + woff + b)]);
      trlist2.push([nx + Math.cos(bAng - Math.PI / 2) * (nw - woff + b), ny + Math.sin(bAng - Math.PI / 2) * (nw - woff + b)]);
      lx = nx; ly = ny;
    }
    return [trlist1, trlist2];
  };

  var twig = function (tx, ty, dep, args) {
    args = args != undefined ? args : {};
    var dir = args.dir != undefined ? args.dir : 1;
    var sca = args.sca != undefined ? args.sca : 1;
    var wid = args.wid != undefined ? args.wid : 1;
    var ang = args.ang != undefined ? args.ang : 0;
    var lea = args.lea != undefined ? args.lea : [true, 12];
    var canv = "", twlist = [], tl = 10;
    var hs = Math.random() * 0.5 + 0.5;
    var tfun = function (x) { return -1 / Math.pow(x + 1, 5) + 1; };
    var a0 = ((Math.random() * Math.PI) / 6) * dir + ang;
    for (var i = 0; i < tl; i++) {
      var mx = dir * tfun(i / tl) * 50 * sca * hs;
      var my = -i * 5 * sca;
      var aT = Math.atan2(my, mx), dT = Math.sqrt(mx * mx + my * my);
      var nx = Math.cos(aT + a0) * dT, ny = Math.sin(aT + a0) * dT;
      twlist.push([nx + tx, ny + ty]);
      if ((i == ((tl / 3) | 0) || i == (((tl * 2) / 3) | 0)) && dep > 0) {
        canv += twig(nx + tx, ny + ty, dep - 1, { ang: ang, sca: sca * 0.8, wid: wid, dir: dir * randChoice([-1, 1]), lea: lea });
      }
      if (i == tl - 1 && lea[0]) {
        for (var j = 0; j < 5; j++) {
          var dj = (j - 2.5) * 5;
          canv += blob(nx + tx + Math.cos(ang) * dj * wid, ny + ty + (Math.sin(ang) * dj - lea[1] / (dep + 1)) * wid, {
            wid: (6 + 3 * Math.random()) * wid, len: (15 + 12 * Math.random()) * wid,
            ang: ang / 2 + Math.PI / 2 + Math.PI * 0.2 * (Math.random() - 0.5),
            col: "rgba(100,100,100," + (0.5 + dep * 0.2).toFixed(3) + ")",
            fun: function (x) { return x <= 1 ? Math.pow(Math.sin(x * Math.PI) * x, 0.5) : -Math.pow(Math.sin((x - 2) * Math.PI * (x - 2)), 0.5); }
          });
        }
      }
    }
    canv += stroke(twlist, { wid: 1, fun: function (x) { return Math.cos((x * Math.PI) / 2); }, col: "rgba(100,100,100,0.5)" });
    return canv;
  };

  var barkify = function (x, y, trlist) {
    var canv = "";
    for (var i = 2; i < trlist[0].length - 1; i++) {
      var a0 = Math.atan2(trlist[0][i][1] - trlist[0][i - 1][1], trlist[0][i][0] - trlist[0][i - 1][0]);
      var a1 = Math.atan2(trlist[1][i][1] - trlist[1][i - 1][1], trlist[1][i][0] - trlist[1][i - 1][0]);
      var p = Math.random();
      var nx = trlist[0][i][0] * (1 - p) + trlist[1][i][0] * p;
      var ny = trlist[0][i][1] * (1 - p) + trlist[1][i][1] * p;
      if (Math.random() < 0.2) {
        canv += blob(nx + x, ny + y, { noi: 1, len: 15, wid: 6 - Math.abs(p - 0.5) * 10, ang: (a0 + a1) / 2, col: "rgba(100,100,100,0.6)" });
      }
    }
    var trflist = trlist[0].concat(trlist[1].slice().reverse());
    var rglist = [[]];
    for (var i = 0; i < trflist.length; i++) {
      if (Math.random() < 0.5) rglist.push([]); else rglist[rglist.length - 1].push(trflist[i]);
    }
    for (var i = 0; i < rglist.length; i++) {
      rglist[i] = div(rglist[i], 4);
      for (var j = 0; j < rglist[i].length; j++) {
        rglist[i][j][0] += (Noise.noise(i, j * 0.1, 1) - 0.5) * (15 + 5 * randGaussian());
        rglist[i][j][1] += (Noise.noise(i, j * 0.1, 2) - 0.5) * (15 + 5 * randGaussian());
      }
      canv += stroke(rglist[i].map(function (v) { return [v[0] + x, v[1] + y]; }), { wid: 1.5, col: "rgba(100,100,100,0.7)", out: 0 });
    }
    return canv;
  };

  Tree.tree04 = function (x, y, args) {
    args = args != undefined ? args : {};
    var hei = args.hei != undefined ? args.hei : 300;
    var wid = args.wid != undefined ? args.wid : 6;
    var col = args.col != undefined ? args.col : "rgba(100,100,100,0.5)";
    var canv = "", txcanv = "", twcanv = "";
    var trlist = branch({ hei: hei, wid: wid, ang: -Math.PI / 2 });
    txcanv += barkify(x, y, trlist);
    trlist = trlist[0].concat(trlist[1].reverse());
    var trmlist = [];
    for (var i = 0; i < trlist.length; i++) {
      if ((i >= trlist.length * 0.3 && i <= trlist.length * 0.7 && Math.random() < 0.1) || i == trlist.length / 2 - 1) {
        var ba = Math.PI * 0.2 - Math.PI * 1.4 * (i > trlist.length / 2);
        var brlist = branch({ hei: hei * (Math.random() + 1) * 0.3, wid: wid * 0.5, ang: ba });
        brlist[0].splice(0, 1); brlist[1].splice(0, 1);
        var foff = function (v) { return [v[0] + trlist[i][0], v[1] + trlist[i][1]]; };
        txcanv += barkify(x, y, [brlist[0].map(foff), brlist[1].map(foff)]);
        for (var j = 0; j < brlist[0].length; j++) {
          if (Math.random() < 0.2 || j == brlist[0].length - 1) {
            twcanv += twig(brlist[0][j][0] + trlist[i][0] + x, brlist[0][j][1] + trlist[i][1] + y, 1, {
              wid: hei / 300, ang: ba > -Math.PI / 2 ? ba : ba + Math.PI, sca: (0.5 * hei) / 300, dir: ba > -Math.PI / 2 ? 1 : -1
            });
          }
        }
        brlist = brlist[0].concat(brlist[1].reverse());
        trmlist = trmlist.concat(brlist.map(function (v) { return [v[0] + trlist[i][0], v[1] + trlist[i][1]]; }));
      } else {
        trmlist.push(trlist[i]);
      }
    }
    canv += poly(trmlist, { xof: x, yof: y, fil: "white", str: col, wid: 0 });
    trmlist.splice(0, 1); trmlist.splice(trmlist.length - 1, 1);
    canv += stroke(trmlist.map(function (v) { return [v[0] + x, v[1] + y]; }), {
      col: "rgba(100,100,100," + (0.4 + Math.random() * 0.1).toFixed(3) + ")", wid: 2.5,
      fun: function () { return Math.sin(1); }, noi: 0.9, out: 0
    });
    canv += txcanv + twcanv;
    return canv;
  };

  Tree.tree08 = function (x, y, args) {
    args = args != undefined ? args : {};
    var hei = args.hei != undefined ? args.hei : 80;
    var wid = args.wid != undefined ? args.wid : 1;
    var col = args.col != undefined ? args.col : "rgba(100,100,100,0.5)";
    var canv = "", twcanv = "";
    var ang = normRand(-1, 1) * Math.PI * 0.2;
    var trlist = branch({ hei: hei, wid: wid, ang: -Math.PI / 2 + ang, ben: Math.PI * 0.2, det: hei / 20 });
    trlist = trlist[0].concat(trlist[1].reverse());
    function fracTree(xoff, yoff, dep, fargs) {
      fargs = fargs != undefined ? fargs : {};
      var fang = fargs.ang != undefined ? fargs.ang : -Math.PI / 2;
      var flen = fargs.len != undefined ? fargs.len : 15;
      var fben = fargs.ben != undefined ? fargs.ben : 0;
      var ffun = dep == 0 ? function (x) { return Math.cos(0.5 * Math.PI * x); } : function () { return 1; };
      var spt = [xoff, yoff];
      var ept = [xoff + Math.cos(fang) * flen, yoff + Math.sin(fang) * flen];
      var trmlist = [[xoff, yoff], [xoff + flen, yoff]];
      var bfun = randChoice([function (x) { return Math.sin(x * Math.PI); }, function (x) { return -Math.sin(x * Math.PI); }]);
      trmlist = div(trmlist, 10);
      for (var i = 0; i < trmlist.length; i++) trmlist[i][1] += bfun(i / trmlist.length) * 2;
      for (var i = 0; i < trmlist.length; i++) {
        var d = distance(trmlist[i], spt);
        var a = Math.atan2(trmlist[i][1] - spt[1], trmlist[i][0] - spt[0]);
        trmlist[i][0] = spt[0] + d * Math.cos(a + fang); trmlist[i][1] = spt[1] + d * Math.sin(a + fang);
      }
      var tcanv = stroke(trmlist, { fun: ffun, wid: 0.8, col: "rgba(100,100,100,0.5)" });
      if (dep != 0) {
        var nben = fben + randChoice([-1, 1]) * Math.PI * 0.001 * dep * dep;
        if (Math.random() < 0.5) {
          tcanv += fracTree(ept[0], ept[1], dep - 1, { ang: fang + fben + Math.PI * randChoice([normRand(-1, 0.5), normRand(0.5, 1)]) * 0.2, len: flen * normRand(0.8, 0.9), ben: nben });
          tcanv += fracTree(ept[0], ept[1], dep - 1, { ang: fang + fben + Math.PI * randChoice([normRand(-1, -0.5), normRand(0.5, 1)]) * 0.2, len: flen * normRand(0.8, 0.9), ben: nben });
        } else {
          tcanv += fracTree(ept[0], ept[1], dep - 1, { ang: fang + fben, len: flen * normRand(0.8, 0.9), ben: nben });
        }
      }
      return tcanv;
    }
    for (var i = 0; i < trlist.length; i++) {
      if (Math.random() < 0.2) {
        twcanv += fracTree(x + trlist[i][0], y + trlist[i][1], Math.floor(4 * Math.random()), { hei: 20, ang: -Math.PI / 2 - ang * Math.random() });
      } else if (i == Math.floor(trlist.length / 2)) {
        twcanv += fracTree(x + trlist[i][0], y + trlist[i][1], 3, { hei: 25, ang: -Math.PI / 2 + ang });
      }
    }
    canv += poly(trlist, { xof: x, yof: y, fil: "white", str: col, wid: 0 });
    canv += stroke(trlist.map(function (v) { return [v[0] + x, v[1] + y]; }), {
      col: "rgba(100,100,100," + (0.6 + Math.random() * 0.1).toFixed(3) + ")", wid: 2.5, fun: function () { return Math.sin(1); }, noi: 0.9, out: 0
    });
    canv += twcanv;
    return canv;
  };

  // ── Mount ──────────────────────────────────
  var Mount = {};

  var foot = function (ptlist, args) {
    args = args != undefined ? args : {};
    var xof = args.xof || 0, yof = args.yof || 0;
    var ftlist = [], span = 10, ni = 0;
    for (var i = 0; i < ptlist.length - 2; i++) {
      if (i == ni) {
        ni = Math.min(ni + randChoice([1, 2]), ptlist.length - 1);
        ftlist.push([]); ftlist.push([]);
        for (var j = 0; j < Math.min(ptlist[i].length / 8, 10); j++) {
          ftlist[ftlist.length - 2].push([ptlist[i][j][0] + Noise.noise(j * 0.1, i) * 10, ptlist[i][j][1]]);
          ftlist[ftlist.length - 1].push([ptlist[i][ptlist[i].length - 1 - j][0] - Noise.noise(j * 0.1, i) * 10, ptlist[i][ptlist[i].length - 1 - j][1]]);
        }
        ftlist[ftlist.length - 2] = ftlist[ftlist.length - 2].reverse();
        ftlist[ftlist.length - 1] = ftlist[ftlist.length - 1].reverse();
        for (var j = 0; j < span; j++) {
          var p = j / span;
          var x1 = ptlist[i][0][0] * (1 - p) + ptlist[ni][0][0] * p;
          var y1 = ptlist[i][0][1] * (1 - p) + ptlist[ni][0][1] * p;
          var x2 = ptlist[i][ptlist[i].length - 1][0] * (1 - p) + ptlist[ni][ptlist[i].length - 1][0] * p;
          var y2 = ptlist[i][ptlist[i].length - 1][1] * (1 - p) + ptlist[ni][ptlist[i].length - 1][1] * p;
          var vib = -1.7 * (p - 1) * Math.pow(p, 1 / 5);
          y1 += vib * 5 + Noise.noise(xof * 0.05, i) * 5;
          y2 += vib * 5 + Noise.noise(xof * 0.05, i) * 5;
          ftlist[ftlist.length - 2].push([x1, y1]);
          ftlist[ftlist.length - 1].push([x2, y2]);
        }
      }
    }
    var canv = "";
    for (var i = 0; i < ftlist.length; i++) canv += poly(ftlist[i], { xof: xof, yof: yof, fil: "white", str: "none" });
    for (var j = 0; j < ftlist.length; j++) {
      canv += stroke(ftlist[j].map(function (x) { return [x[0] + xof, x[1] + yof]; }), { col: "rgba(100,100,100," + (0.1 + Math.random() * 0.1).toFixed(3) + ")", wid: 1 });
    }
    return canv;
  };

  Mount.rock = function (xoff, yoff, seed, args) {
    args = args != undefined ? args : {};
    var hei = args.hei != undefined ? args.hei : 80;
    var wid = args.wid != undefined ? args.wid : 100;
    var tex = args.tex != undefined ? args.tex : 40;
    var sha = args.sha != undefined ? args.sha : 10;
    seed = seed != undefined ? seed : 0;
    var canv = "", reso = [10, 50], ptlist = [];
    for (var i = 0; i < reso[0]; i++) {
      ptlist.push([]);
      var nslist = [];
      for (var j = 0; j < reso[1]; j++) nslist.push(Noise.noise(i, j * 0.2, seed));
      loopNoise(nslist);
      for (var j = 0; j < reso[1]; j++) {
        var a = (j / reso[1]) * Math.PI * 2 - Math.PI / 2;
        var l = (wid * hei) / Math.sqrt(Math.pow(hei * Math.cos(a), 2) + Math.pow(wid * Math.sin(a), 2));
        l *= 0.7 + 0.3 * nslist[j];
        var p = 1 - i / reso[0];
        var nx = Math.cos(a) * l * p, ny = -Math.sin(a) * l * p;
        if (Math.PI < a || a < 0) ny *= 0.2;
        ny += hei * (i / reso[0]) * 0.2;
        ptlist[ptlist.length - 1].push([nx, ny]);
      }
    }
    canv += poly(ptlist[0].concat([[0, 0]]), { xof: xoff, yof: yoff, fil: "white", str: "none" });
    canv += stroke(ptlist[0].map(function (x) { return [x[0] + xoff, x[1] + yoff]; }), { col: "rgba(100,100,100,0.3)", noi: 1, wid: 3 });
    canv += texture(ptlist, { xof: xoff, yof: yoff, tex: tex, wid: 3, sha: sha,
      col: function () { return "rgba(180,180,180," + (0.3 + Math.random() * 0.3).toFixed(3) + ")"; },
      dis: function () { return Math.random() > 0.5 ? 0.15 + 0.15 * Math.random() : 0.85 - 0.15 * Math.random(); }
    });
    return canv;
  };

  Mount.mountain = function (xoff, yoff, seed, args) {
    args = args != undefined ? args : {};
    var hei = args.hei != undefined ? args.hei : 100 + Math.random() * 400;
    var wid = args.wid != undefined ? args.wid : 400 + Math.random() * 200;
    var tex = args.tex != undefined ? args.tex : 200;
    var veg = args.veg != undefined ? args.veg : true;
    seed = seed != undefined ? seed : 0;
    var canv = "", ptlist = [], h = hei, w = wid, reso = [10, 50];
    var hoff = 0;
    for (var j = 0; j < reso[0]; j++) {
      hoff += (Math.random() * yoff) / 100;
      ptlist.push([]);
      for (var i = 0; i < reso[1]; i++) {
        var x = (i / reso[1] - 0.5) * Math.PI;
        var y = Math.cos(x);
        y *= Noise.noise(x + 10, j * 0.15, seed);
        var p = 1 - j / reso[0];
        ptlist[ptlist.length - 1].push([(x / Math.PI) * w * p, -y * h * p + hoff]);
      }
    }
    function vegetate(treeFunc, growthRule, proofRule) {
      var veglist = [];
      for (var i = 0; i < ptlist.length; i++) {
        for (var j = 0; j < ptlist[i].length; j++) {
          if (growthRule(i, j)) veglist.push([ptlist[i][j][0], ptlist[i][j][1]]);
        }
      }
      for (var i = 0; i < veglist.length; i++) {
        if (proofRule(veglist, i)) canv += treeFunc(veglist[i][0], veglist[i][1]);
      }
    }
    // Rim bushes
    vegetate(function (x, y) {
      return Tree.tree02(x + xoff, y + yoff - 5, {
        col: "rgba(100,100,100," + (Noise.noise(0.01 * x, 0.01 * y) * 0.15 + 0.5).toFixed(3) + ")", clu: 2
      });
    }, function (i, j) { var ns = Noise.noise(j * 0.1, seed); return i == 0 && ns * ns * ns < 0.1 && Math.abs(ptlist[i][j][1]) / h > 0.2; },
    function () { return true; });

    // White bg
    canv += poly(ptlist[0].concat([[0, reso[0] * 4]]), { xof: xoff, yof: yoff, fil: "white", str: "none" });
    // Outline
    canv += stroke(ptlist[0].map(function (x) { return [x[0] + xoff, x[1] + yoff]; }), { col: "rgba(100,100,100,0.3)", noi: 1, wid: 3 });
    canv += foot(ptlist, { xof: xoff, yof: yoff });
    canv += texture(ptlist, { xof: xoff, yof: yoff, tex: tex, sha: randChoice([0, 0, 0, 0, 5]) });

    // Top bushes
    vegetate(function (x, y) {
      return Tree.tree02(x + xoff, y + yoff, {
        col: "rgba(100,100,100," + (Noise.noise(0.01 * x, 0.01 * y) * 0.15 + 0.5).toFixed(3) + ")"
      });
    }, function (i, j) { var ns = Noise.noise(i * 0.1, j * 0.1, seed + 2); return ns * ns * ns < 0.1 && Math.abs(ptlist[i][j][1]) / h > 0.5; },
    function () { return true; });

    if (veg) {
      // Middle trees
      vegetate(function (x, y) {
        var ht = ((h + y) / h) * 70;
        ht = ht * 0.3 + Math.random() * ht * 0.7;
        return Tree.tree01(x + xoff, y + yoff, {
          hei: ht, wid: Math.random() * 3 + 1,
          col: "rgba(100,100,100," + (Noise.noise(0.01 * x, 0.01 * y) * 0.15 + 0.3).toFixed(3) + ")"
        });
      }, function (i, j) {
        var ns = Noise.noise(i * 0.2, j * 0.05, seed);
        return j % 2 && ns * ns * ns * ns < 0.012 && Math.abs(ptlist[i][j][1]) / h < 0.3;
      }, function (veglist, i) {
        var counter = 0;
        for (var j = 0; j < veglist.length; j++) {
          if (i != j && Math.pow(veglist[i][0] - veglist[j][0], 2) + Math.pow(veglist[i][1] - veglist[j][1], 2) < 900) counter++;
          if (counter > 2) return true;
        }
        return false;
      });

      // Bottom trees
      vegetate(function (x, y) {
        var ht = ((h + y) / h) * 120;
        ht = ht * 0.5 + Math.random() * ht * 0.5;
        var bc = Math.random() * 0.1, bp = 1;
        return Tree.tree03(x + xoff, y + yoff, {
          hei: ht, ben: function (xb) { return Math.pow(xb * bc, bp); },
          col: "rgba(100,100,100," + (Noise.noise(0.01 * x, 0.01 * y) * 0.15 + 0.3).toFixed(3) + ")"
        });
      }, function (i, j) {
        var ns = Noise.noise(i * 0.2, j * 0.05, seed);
        return (j == 0 || j == ptlist[i].length - 1) && ns * ns * ns * ns < 0.012;
      }, function () { return true; });
    }

    // Bottom rocks
    vegetate(function (x, y) {
      return Mount.rock(x + xoff, y + yoff, seed, { wid: 20 + Math.random() * 20, hei: 20 + Math.random() * 20, sha: 2 });
    }, function (i, j) { return (j == 0 || j == ptlist[i].length - 1) && Math.random() < 0.1; },
    function () { return true; });

    return canv;
  };

  Mount.flatMount = function (xoff, yoff, seed, args) {
    args = args != undefined ? args : {};
    var hei = args.hei != undefined ? args.hei : 40 + Math.random() * 400;
    var wid = args.wid != undefined ? args.wid : 400 + Math.random() * 200;
    var tex = args.tex != undefined ? args.tex : 80;
    var cho = args.cho != undefined ? args.cho : 0.5;
    seed = seed != undefined ? seed : 0;
    var canv = "", ptlist = [], reso = [5, 50], hoff = 0, flat = [];
    for (var j = 0; j < reso[0]; j++) {
      hoff += (Math.random() * yoff) / 100;
      ptlist.push([]); flat.push([]);
      for (var i = 0; i < reso[1]; i++) {
        var x = (i / reso[1] - 0.5) * Math.PI;
        var y = (Math.cos(x * 2) + 1) * Noise.noise(x + 10, j * 0.1, seed);
        var p = 1 - (j / reso[0]) * 0.6;
        var nx = (x / Math.PI) * wid * p;
        var ny = -y * hei * p + hoff;
        var hc = 100;
        if (ny < -hc * cho + hoff) {
          ny = -hc * cho + hoff;
          if (flat[flat.length - 1].length % 2 == 0) flat[flat.length - 1].push([nx, ny]);
        } else {
          if (flat[flat.length - 1].length % 2 == 1) flat[flat.length - 1].push(ptlist[ptlist.length - 1][ptlist[ptlist.length - 1].length - 1]);
        }
        ptlist[ptlist.length - 1].push([nx, ny]);
      }
    }
    canv += poly(ptlist[0].concat([[0, reso[0] * 4]]), { xof: xoff, yof: yoff, fil: "white", str: "none" });
    canv += stroke(ptlist[0].map(function (x) { return [x[0] + xoff, x[1] + yoff]; }), { col: "rgba(100,100,100,0.3)", noi: 1, wid: 3 });
    canv += texture(ptlist, { xof: xoff, yof: yoff, tex: tex, wid: 2,
      dis: function () { return Math.random() > 0.5 ? 0.1 + 0.4 * Math.random() : 0.9 - 0.4 * Math.random(); }
    });
    var grlist1 = [], grlist2 = [];
    for (var i = 0; i < flat.length; i += 2) {
      if (flat[i].length >= 2) { grlist1.push(flat[i][0]); grlist2.push(flat[i][flat[i].length - 1]); }
    }
    if (grlist1.length == 0) return canv;
    var wb = [grlist1[0][0], grlist2[0][0]];
    for (var i = 0; i < 3; i++) { var p = 0.8 - i * 0.2; grlist1.unshift([wb[0] * p, grlist1[0][1] - 5]); grlist2.unshift([wb[1] * p, grlist2[0][1] - 5]); }
    wb = [grlist1[grlist1.length - 1][0], grlist2[grlist2.length - 1][0]];
    for (var i = 0; i < 3; i++) { var p = 0.6 - i * i * 0.1; grlist1.push([wb[0] * p, grlist1[grlist1.length - 1][1] + 1]); grlist2.push([wb[1] * p, grlist2[grlist2.length - 1][1] + 1]); }
    var d = 5;
    grlist1 = div(grlist1, d); grlist2 = div(grlist2, d);
    var grlist = grlist1.reverse().concat(grlist2.concat([grlist1[0]]));
    for (var i = 0; i < grlist.length; i++) {
      var v = (1 - Math.abs((i % d) - d / 2) / (d / 2)) * 0.12;
      grlist[i][0] *= 1 - v + Noise.noise(grlist[i][1] * 0.5) * v;
    }
    canv += poly(grlist, { xof: xoff, yof: yoff, str: "none", fil: "white", wid: 2 });
    canv += stroke(grlist.map(function (x) { return [x[0] + xoff, x[1] + yoff]; }), { wid: 3, col: "rgba(100,100,100,0.2)" });
    // Flat decorations (simplified — rocks and tree08 only, no Arch)
    var bound = function (pl) {
      var xmin, xmax, ymin, ymax;
      for (var i = 0; i < pl.length; i++) {
        if (xmin == undefined || pl[i][0] < xmin) xmin = pl[i][0];
        if (xmax == undefined || pl[i][0] > xmax) xmax = pl[i][0];
        if (ymin == undefined || pl[i][1] < ymin) ymin = pl[i][1];
        if (ymax == undefined || pl[i][1] > ymax) ymax = pl[i][1];
      }
      return { xmin: xmin, xmax: xmax, ymin: ymin, ymax: ymax };
    };
    var grbd = bound(grlist);
    for (var j = 0; j < Math.random() * 5; j++) {
      canv += Mount.rock(xoff + normRand(grbd.xmin, grbd.xmax), yoff + (grbd.ymin + grbd.ymax) / 2 + normRand(-10, 10) + 10, Math.random() * 100, { wid: 10 + Math.random() * 20, hei: 10 + Math.random() * 20, sha: 2 });
    }
    for (var j = 0; j < randChoice([0, 0, 1, 2]); j++) {
      var xr = xoff + normRand(grbd.xmin, grbd.xmax);
      var yr = yoff + (grbd.ymin + grbd.ymax) / 2 + normRand(-5, 5) + 20;
      for (var k = 0; k < 2 + Math.random() * 3; k++) {
        canv += Tree.tree08(xr + Math.min(Math.max(normRand(-30, 30), grbd.xmin), grbd.xmax), yr, { hei: 60 + Math.random() * 40 });
      }
    }
    for (var i = 0; i < 50 * Math.random(); i++) {
      canv += Tree.tree02(xoff + normRand(grbd.xmin, grbd.xmax), yoff + normRand(grbd.ymin, grbd.ymax));
    }
    return canv;
  };

  Mount.distMount = function (xoff, yoff, seed, args) {
    args = args != undefined ? args : {};
    var hei = args.hei != undefined ? args.hei : 300;
    var len = args.len != undefined ? args.len : 2000;
    var seg = args.seg != undefined ? args.seg : 5;
    seed = seed != undefined ? seed : 0;
    var canv = "", span = 10, ptlist = [];
    for (var i = 0; i < len / span / seg; i++) {
      ptlist.push([]);
      for (var j = 0; j < seg + 1; j++) {
        var k = i * seg + j;
        ptlist[ptlist.length - 1].push([xoff + k * span, yoff - hei * Noise.noise(k * 0.05, seed) * Math.pow(Math.sin((Math.PI * k) / (len / span)), 0.5)]);
      }
      for (var j = 0; j < seg / 2 + 1; j++) {
        var k = i * seg + j * 2;
        ptlist[ptlist.length - 1].unshift([xoff + k * span, yoff + 24 * Noise.noise(k * 0.05, 2, seed) * Math.pow(Math.sin((Math.PI * k) / (len / span)), 1)]);
      }
    }
    for (var i = 0; i < ptlist.length; i++) {
      var getCol = function (cx, cy) {
        var c = (Noise.noise(cx * 0.02, cy * 0.02, yoff) * 55 + 200) | 0;
        return "rgb(" + c + "," + c + "," + c + ")";
      };
      canv += poly(ptlist[i], { fil: getCol(ptlist[i][ptlist[i].length - 1][0], ptlist[i][ptlist[i].length - 1][1]), str: "none", wid: 1 });
      var T = PolyTools.triangulate(ptlist[i], { area: 100, convex: true, optimize: false });
      for (var k = 0; k < T.length; k++) {
        var m = PolyTools.midPt(T[k]);
        var co = getCol(m[0], m[1]);
        canv += poly(T[k], { fil: co, str: co, wid: 1 });
      }
    }
    return canv;
  };

  // ── water ──────────────────────────────────
  function water(xoff, yoff, seed, args) {
    args = args != undefined ? args : {};
    var hei = args.hei != undefined ? args.hei : 2;
    var len = args.len != undefined ? args.len : 800;
    var clu = args.clu != undefined ? args.clu : 10;
    var canv = "", ptlist = [], yk = 0;
    for (var i = 0; i < clu; i++) {
      ptlist.push([]);
      var xk = (Math.random() - 0.5) * (len / 8);
      yk += Math.random() * 5;
      var lk = len / 4 + Math.random() * (len / 4);
      var reso = 5;
      for (var j = -lk; j < lk; j += reso) {
        ptlist[ptlist.length - 1].push([j + xk, Math.sin(j * 0.2) * hei * Noise.noise(j * 0.1) - 20 + yk]);
      }
    }
    for (var j = 1; j < ptlist.length; j++) {
      canv += stroke(ptlist[j].map(function (x) { return [x[0] + xoff, x[1] + yoff]; }), {
        col: "rgba(100,100,100," + (0.3 + Math.random() * 0.3).toFixed(3) + ")", wid: 1
      });
    }
    return canv;
  }

  // ── mountplanner ───────────────────────────
  function mountplanner(xmin, xmax) {
    function locmax(x, y, f, r) {
      var z0 = f(x, y);
      if (z0 <= 0.3) return false;
      for (var i = x - r; i < x + r; i++) {
        for (var j = y - r; j < y + r; j++) {
          if (f(i, j) > z0) return false;
        }
      }
      return true;
    }
    function chadd(r, mind) {
      mind = mind == undefined ? 10 : mind;
      for (var k = 0; k < reg.length; k++) {
        if (Math.abs(reg[k].x - r.x) < mind) return false;
      }
      reg.push(r);
      return true;
    }
    var reg = [];
    var samp = 0.03;
    var ns = function (x, y) { return Math.max(Noise.noise(x * samp) - 0.55, 0) * 2; };
    var yr = function (x) { return Noise.noise(x * 0.01, Math.PI); };
    var xstep = 5, mwid = 200;
    for (var i = xmin; i < xmax; i += xstep) {
      var i1 = Math.floor(i / xstep);
      MEM.planmtx[i1] = MEM.planmtx[i1] || 0;
    }
    for (var i = xmin; i < xmax; i += xstep) {
      for (var j = 0; j < yr(i) * 480; j += 30) {
        if (locmax(i, j, ns, 2)) {
          var xof = i + 2 * (Math.random() - 0.5) * 500;
          var yof = j + 300;
          var r = { tag: "mount", x: xof, y: yof, h: ns(i, j) };
          var res = chadd(r);
          if (res) {
            for (var k = Math.floor((xof - mwid) / xstep); k < (xof + mwid) / xstep; k++) MEM.planmtx[k] = (MEM.planmtx[k] || 0) + 1;
          }
        }
      }
      if (Math.abs(i) % 1000 < Math.max(1, xstep - 1)) {
        chadd({ tag: "distmount", x: i, y: 280 - Math.random() * 50, h: ns(i, 0) });
      }
    }
    for (var i = xmin; i < xmax; i += xstep) {
      if ((MEM.planmtx[Math.floor(i / xstep)] || 0) == 0) {
        if (Math.random() < 0.01) {
          for (var j = 0; j < 4 * Math.random(); j++) {
            chadd({ tag: "flatmount", x: i + 2 * (Math.random() - 0.5) * 700, y: 700 - j * 50, h: ns(i, j) });
          }
        }
      }
    }
    return reg;
  }

  // ── MEM / chunkloader / render ─────────────
  var MEM = { canv: "", chunks: [], xmin: 0, xmax: 0, cwid: 512, cursx: 0, windx: 3000, windy: 800, planmtx: [] };

  function chunkloader(xmin, xmax) {
    var add = function (nch) {
      if (nch.canv.includes("NaN")) nch.canv = nch.canv.replace(/NaN/g, "-1000");
      if (MEM.chunks.length == 0) { MEM.chunks.push(nch); return; }
      if (nch.y <= MEM.chunks[0].y) { MEM.chunks.unshift(nch); return; }
      if (nch.y >= MEM.chunks[MEM.chunks.length - 1].y) { MEM.chunks.push(nch); return; }
      for (var j = 0; j < MEM.chunks.length - 1; j++) {
        if (MEM.chunks[j].y <= nch.y && nch.y <= MEM.chunks[j + 1].y) { MEM.chunks.splice(j + 1, 0, nch); return; }
      }
    };
    while (xmax > MEM.xmax - MEM.cwid || xmin < MEM.xmin + MEM.cwid) {
      var plan;
      if (xmax > MEM.xmax - MEM.cwid) {
        plan = mountplanner(MEM.xmax, MEM.xmax + MEM.cwid);
        MEM.xmax = MEM.xmax + MEM.cwid;
      } else {
        plan = mountplanner(MEM.xmin - MEM.cwid, MEM.xmin);
        MEM.xmin = MEM.xmin - MEM.cwid;
      }
      for (var i = 0; i < plan.length; i++) {
        if (plan[i].tag == "mount") {
          add({ tag: plan[i].tag, x: plan[i].x, y: plan[i].y, canv: Mount.mountain(plan[i].x, plan[i].y, i * 2 * Math.random()) });
          add({ tag: plan[i].tag, x: plan[i].x, y: plan[i].y - 10000, canv: water(plan[i].x, plan[i].y, i * 2) });
        } else if (plan[i].tag == "flatmount") {
          add({ tag: plan[i].tag, x: plan[i].x, y: plan[i].y,
            canv: Mount.flatMount(plan[i].x, plan[i].y, 2 * Math.random() * Math.PI, { wid: 600 + Math.random() * 400, hei: 100, cho: 0.5 + Math.random() * 0.2 })
          });
        } else if (plan[i].tag == "distmount") {
          add({ tag: plan[i].tag, x: plan[i].x, y: plan[i].y,
            canv: Mount.distMount(plan[i].x, plan[i].y, Math.random() * 100, { hei: 150, len: randChoice([500, 1000, 1500]) })
          });
        }
      }
    }
  }

  function chunkrender(xmin, xmax) {
    MEM.canv = "";
    for (var i = 0; i < MEM.chunks.length; i++) {
      if (xmin - MEM.cwid < MEM.chunks[i].x && MEM.chunks[i].x < xmax + MEM.cwid) {
        MEM.canv += MEM.chunks[i].canv;
      }
    }
  }

  function calcViewBox() {
    var zoom = 1.142;
    return MEM.cursx + " 0 " + (MEM.windx / zoom) + " " + (MEM.windy / zoom);
  }

  function update(svgEl) {
    chunkloader(MEM.cursx, MEM.cursx + MEM.windx);
    chunkrender(MEM.cursx, MEM.cursx + MEM.windx);
    svgEl.setAttribute("viewBox", calcViewBox());
    svgEl.querySelector("g").innerHTML = MEM.canv;
  }

  function xcroll(v, svgEl) {
    MEM.cursx += v;
    update(svgEl);
  }

  // ── Paper texture ──────────────────────────
  function paperTexture(w, h) {
    var canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    var ctx = canvas.getContext('2d');
    var img = ctx.createImageData(w, h);
    var d = img.data;
    // Use a separate small PRNG for paper so it doesn't affect landscape
    var ps = 42, pn = function () { ps = (ps * ps) % (999979 * 999983); return ps / (999979 * 999983); };
    for (var i = 0; i < 10; i++) pn();
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var idx = (y * w + x) * 4;
        var n = Noise.noise(x * 0.05, y * 0.05);
        var c = 245 + n * 10 - pn() * 20;
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

  // ── Public API ─────────────────────────────
  function generate(container, width, height, seed) {
    usePrng();
    Prng.seed(seed);

    MEM.windx = width;
    MEM.windy = 800;
    MEM.cursx = 0;
    MEM.xmin = 0;
    MEM.xmax = 0;
    MEM.chunks = [];
    MEM.planmtx = [];
    MEM.canv = "";

    var svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svgEl.setAttribute('width', '100%');
    svgEl.setAttribute('height', '100%');
    svgEl.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    svgEl.style.mixBlendMode = 'multiply';
    var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    svgEl.appendChild(g);
    container.appendChild(svgEl);

    update(svgEl);

    // Auto-scroll
    var scrollSpeed = 0.5;
    var lastTime = 0;
    function autoScroll(time) {
      if (lastTime) {
        var dt = time - lastTime;
        MEM.cursx += scrollSpeed * (dt / 16.67);
        chunkloader(MEM.cursx, MEM.cursx + MEM.windx);
        chunkrender(MEM.cursx, MEM.cursx + MEM.windx);
        svgEl.setAttribute('viewBox', calcViewBox());
        g.innerHTML = MEM.canv;
      }
      lastTime = time;
      requestAnimationFrame(autoScroll);
    }
    requestAnimationFrame(autoScroll);

    restoreRandom();
  }

  window.InkScape = {
    generate: generate,
    paperTexture: paperTexture,
    stroke: stroke,
    blob: blob
  };
})();
