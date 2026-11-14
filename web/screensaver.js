"use strict";

/* =========================================================================
   ASCII Animals Screensaver
   Adapted from "ASCII Animals New Tab" by Pawan-webdeveloper (MIT):
   https://github.com/Pawan-webdeveloper/Ascii-Animals-extension

   Animals are procedural shapes sampled onto a coarse cell grid. Solid parts
   become tinted square cells, wispy parts (tentacles, antennae, trails)
   become monospace glyphs.

   The page runs in one of two modes, chosen by the launcher (or by
   ?mode=saver in a browser):
   - "saver":    fullscreen animals and a big clock, no UI at all.
   - "settings": the same scene, plus the animal picker and settings panel.
   ========================================================================= */

// ---------- small math helpers ----------

const TAU = Math.PI * 2;
const sq = (x) => x * x;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const ell = (u, v, cu, cv, ru, rv) => sq((u - cu) / ru) + sq((v - cv) / rv);
const angleDiff = (a, b) => {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
};

function hash2(i, j, s) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(s, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function vnoise(x, y, s) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const sx = xf * xf * (3 - 2 * xf);
  const sy = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s);
  const b = hash2(xi + 1, yi, s);
  const c = hash2(xi, yi + 1, s);
  const d = hash2(xi + 1, yi + 1, s);
  return lerp(lerp(a, b, sx), lerp(c, d, sx), sy);
}

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

// ---------- sampler output (reused to avoid allocations) ----------

const out = { r: 0, g: 0, b: 0, a: 1, ch: null, shine: 0 };

function hit(c, a = 1, shine = 0, k = 1) {
  out.r = c[0] * k;
  out.g = c[1] * k;
  out.b = c[2] * k;
  out.a = a;
  out.ch = null;
  out.shine = shine;
  return true;
}

function glyph(chars, c, a = 1, k = 1) {
  out.r = c[0] * k;
  out.g = c[1] * k;
  out.b = c[2] * k;
  out.a = a;
  out.ch = chars;
  out.shine = 0;
  return true;
}

const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
const WHITE = [240, 244, 255];

/* =========================================================================
   Animals
   Each sampler works in sprite units: +u points the way the animal faces,
   v is lateral. `prep` runs once per frame per animal.
   ========================================================================= */

const ANIMALS = [
  {
    id: "butterflies",
    label: "Butterfly",
    swatch: [50, 135, 255],
    radius: 10,
    count: 14,
    speed: 5.2,
    turn: 3.2,
    phaseRate: 9,
    mode: "flow",
    hoverShy: true,
    hint: "Tap to scatter the butterflies",
    direction: 30,
    spread: 0.3,
    trail: { chars: ".'`·", color: [90, 150, 255], life: 1.1, at: [[-4, 0]] },
    variants: [
      { wing: [50, 135, 255], inner: [24, 64, 170], edge: [12, 22, 56] },
      { wing: [92, 176, 255], inner: [38, 92, 200], edge: [16, 30, 70] },
      { wing: [42, 96, 236], inner: [20, 46, 140], edge: [10, 15, 46] },
    ],
    prep(e) {
      const c = 0.5 + 0.5 * Math.cos(e.phase);
      e.f = 0.14 + 0.86 * Math.pow(c, 0.75);
    },
    wobble(e, t) {
      return 0.55 * Math.sin(t * 1.7 + e.seed * 5) + 0.25 * Math.sin(t * 3.3 + e.seed);
    },
    sample(u, v, e) {
      const av = Math.abs(v);
      const P = e.pal;
      if (ell(u, v, 5.0, 0, 1.15, 1.0) < 1) return hit([30, 40, 72]);
      if (av < 0.7 && u > -5.2 && u < 4.4) return hit([38, 50, 88]);
      if (u > 5.8 && u < 9.3) {
        const cv = 0.45 + (u - 5.8) * 0.5;
        if (Math.abs(av - cv) < 0.5) return glyph(u > 8.4 ? "o" : ".", [150, 180, 240], 0.9);
      }
      if (av < 0.6) return false;
      const w = (av - 0.6) / e.f;
      const d1 = sq((u - 0.8 - 0.42 * w) / 3.7) + sq((w - 4.4) / 4.7);
      const d2 = sq((u + 3.1 + 0.15 * w) / 3.1) + sq((w - 3.3) / 3.7);
      const d = Math.min(d1, d2);
      if (d >= 1) return false;
      const shade = 0.58 + 0.42 * e.f;
      if (d > 0.7) {
        if (vnoise(u * 1.1 + 3, w * 1.1, e.seed) > 0.7) return hit(WHITE, 1, 0, shade);
        return hit(P.edge, 1, 0, shade);
      }
      const c = w < 1.3 ? P.inner : mix(P.inner, P.wing, clamp((w - 1.3) / 2.4, 0, 1));
      return hit(c, 1, 0.35, shade);
    },
  },
  {
    id: "koi",
    label: "Koi",
    swatch: [244, 196, 44],
    radius: 13,
    count: 12,
    speed: 4.4,
    turn: 1.1,
    phaseRate: 5,
    mode: "wander",
    feeds: true,
    hint: "Click the water to feed the koi",
    retarget: [2.5, 6],
    direction: 0,
    spread: 0.9,
    trail: { chars: "~-~=", color: [150, 175, 210], life: 1.8, at: [[-10, 0]] },
    variants: [
      { base: [236, 232, 226], patch: [214, 48, 36], thr: 0.5 },
      { base: [236, 232, 226], patch: [205, 45, 35], thr: 0.55, dark: [30, 30, 34] },
      { base: [244, 196, 44], patch: [250, 150, 30], thr: 0.72 },
      { base: [240, 118, 38], patch: [255, 172, 72], thr: 0.68 },
      { base: [214, 220, 228], patch: [176, 186, 202], thr: 0.6 },
    ],
    prep(e, sway) {
      e.amp = 1.3 * (0.35 + sway);
    },
    sample(u, v, e) {
      if (u < -12.6 || u > 8.4) return false;
      const P = e.pal;
      const tw = clamp((8 - u) / 20, 0, 1);
      const vv = v - e.amp * Math.sin(e.phase - u * 0.34) * tw * tw * 1.6;
      const av = Math.abs(vv);
      let hw = 0;
      if (u > 3.6) hw = 3.0 * Math.sqrt(Math.max(0, 1 - sq((u - 3.6) / 4.7)));
      else if (u > -8) hw = 0.75 + 2.25 * Math.pow((u + 8) / 11.6, 1.25);
      if (av < hw) {
        if (u > 5.5 && u < 6.9 && av > hw - 1.15 && av < hw - 0.2) return hit([22, 22, 26]);
        const n = vnoise(u * 0.3 + e.seed * 7, vv * 0.42, e.seed);
        let c = n > P.thr ? P.patch : P.base;
        if (P.dark && vnoise(u * 0.45, vv * 0.5 + 9, e.seed + 3) > 0.68) c = P.dark;
        const k = hw - av < 0.65 ? 0.78 : av < 0.5 ? 1.05 : 1;
        return hit(c, 1, 0.2, k);
      }
      const fin = mix(P.base, WHITE, 0.25);
      if (u > 0.2 && u < 3.4 && ell(u + (av - hw) * 0.45, av, 1.6, hw + 1.1, 1.3, 1.3) < 1) return hit(fin, 0.55);
      if (u <= -7.4) {
        const t = -7.4 - u;
        const fw = 0.55 + t * 0.72;
        if (av < fw && !(t > 3.7 && av < (t - 3.7) * 1.1)) return hit(fin, 0.62);
      }
      return false;
    },
  },
  {
    id: "jellyfish",
    label: "Jellyfish",
    swatch: [232, 56, 182],
    scale: 1.35,
    radius: 17,
    count: 9,
    speed: 3.2,
    turn: 0.6,
    phaseRate: 2.6,
    mode: "flow",
    rippleChars: "°",
    hint: "Tap to make the jellyfish pulse away",
    onScare(e) {
      // start a fresh contraction right away
      e.phase = Math.floor(e.phase / TAU) * TAU + TAU + 0.1;
    },
    direction: 0,
    spread: 0.12,
    trail: { chars: "°.o", color: [220, 120, 210], life: 1.4, at: [[-15, -2], [-15, 2]] },
    variants: [
      { bell: [232, 56, 182], core: [255, 172, 230], arm: [240, 112, 202] },
      { bell: [168, 78, 240], core: [226, 182, 255], arm: [190, 122, 250] },
      { bell: [255, 96, 142], core: [255, 192, 208], arm: [255, 132, 172] },
    ],
    prep(e) {
      const c = Math.pow(Math.max(0, Math.sin(e.phase)), 2);
      e.c = c;
      e.Rw = 5.4 * (1 - 0.2 * c);
      e.H = 4.6 * (1 + 0.18 * c);
      e.speedMod = 0.35 + 1.4 * c;
    },
    wobble(e, t) {
      return 0.18 * Math.sin(t * 0.4 + e.seed * 3);
    },
    sample(u, v, e) {
      const av = Math.abs(v);
      const P = e.pal;
      if (u >= -0.5) {
        const d = sq(Math.max(u, 0) / e.H) + sq(v / e.Rw);
        if (d < 1) {
          if (u < 0 && ((Math.floor((v + 40) * 0.8) & 1) === 1)) return false;
          const glow = 1 + 0.35 * e.c;
          if (d < 0.32) return hit(P.core, 0.95, 0.2, glow);
          if (d > 0.78) return hit(P.bell, 0.95, 0, 0.72 * glow);
          return hit(P.bell, 0.95, 0.15, glow);
        }
        return false;
      }
      const depth = -u;
      if (depth > 16) return false;
      const armW = 1.5 + 0.5 * Math.sin(e.phase * 0.8 + depth * 0.6);
      if (depth < 8.5 && av < armW * (1 - depth / 12)) return glyph("$§%&", P.arm, 0.95 - depth * 0.05);
      const pull = 1 - 0.12 * e.c;
      for (let k = -4.3; k <= 4.4; k += 2.15) {
        if (Math.abs(k) < 1) continue;
        const cx = k * pull + 0.9 * Math.sin(e.phase * 0.7 + depth * 0.42 + k) * (depth / 12);
        if (Math.abs(v - cx) < 0.6) return glyph("()|:", P.arm, 0.85 * (1 - depth / 16), 0.8);
      }
      return false;
    },
  },
  {
    id: "dragonflies",
    label: "Dragonfly",
    swatch: [50, 220, 120],
    radius: 13,
    count: 11,
    speed: 8,
    turn: 4,
    phaseRate: 38,
    mode: "wander",
    hoverShy: true,
    hint: "Tap to send the dragonflies darting",
    retarget: [0.8, 2.6],
    direction: 60,
    spread: 0.55,
    trail: { chars: ".·", color: [120, 230, 170], life: 0.9, at: [[-12, 0]] },
    variants: [
      { body: [50, 220, 120], band: [24, 118, 90], eye: [30, 150, 110] },
      { body: [56, 200, 150], band: [20, 96, 80], eye: [24, 130, 100] },
      { body: [62, 170, 255], band: [24, 70, 150], eye: [40, 110, 200] },
    ],
    prep(e, sway, t) {
      e.beat = 0.8 + 0.2 * Math.cos(e.phase);
      const dart = 0.5 + 0.5 * Math.sin(t * 1.3 + e.seed * 9);
      e.speedMod = 0.12 + 1.7 * dart * dart;
    },
    sample(u, v, e) {
      const av = Math.abs(v);
      const P = e.pal;
      if (ell(u, v, 2.6, 0, 1.0, 1.5) < 1) return av > 0.5 ? hit(P.eye) : hit(P.body, 1, 0, 0.8);
      if (ell(u, v, 0.4, 0, 1.9, 1.15) < 1) return hit(P.body, 1, 0.2, 0.9);
      if (u < -1 && u > -12.5 && av < (u > -3 ? 0.62 : 0.5)) {
        return hit(((-u * 0.75) | 0) & 1 ? P.band : P.body, 1, 0.15);
      }
      if (av > 0.6) {
        const w = (av - 0.6) / e.beat;
        for (let k = 0; k < 2; k++) {
          const base = k ? -0.3 : 1.1;
          const tilt = k ? -0.12 : 0.22;
          const len = k ? 5.8 : 6.4;
          const perp = u - base - tilt * w;
          const d = sq((w - len * 0.5 - 0.2) / (len * 0.55)) + sq(perp / 1.15);
          if (d < 1) {
            if (w > len * 0.86 && Math.abs(perp) < 0.6) return hit([70, 84, 98], 0.9);
            return hit([196, 232, 255], d > 0.6 ? 0.55 : 0.38);
          }
        }
      }
      return false;
    },
  },
  {
    id: "frogs",
    label: "Frog",
    swatch: [104, 184, 76],
    radius: 11,
    count: 10,
    speed: 3.4,
    turn: 2,
    phaseRate: 3.2,
    mode: "wander",
    rippleChars: "o°",
    hint: "Tap to make the frogs leap",
    onScare(e) {
      // kick off a leap immediately
      e.phase = Math.floor(e.phase / TAU) * TAU + TAU + 0.05;
    },
    retarget: [2, 5],
    direction: 0,
    spread: 1,
    trail: { chars: "o°.", color: [120, 190, 150], life: 1.5, at: [[-6, 0]] },
    variants: [
      { skin: [104, 184, 76], spot: [52, 110, 40], eye: [196, 224, 112] },
      { skin: [150, 170, 70], spot: [82, 96, 36], eye: [214, 214, 120] },
      { skin: [72, 170, 130], spot: [30, 100, 80], eye: [170, 226, 160] },
    ],
    prep(e) {
      const s = Math.max(0, Math.sin(e.phase));
      e.ext = 0.5 + 0.5 * Math.sin(e.phase - 0.5);
      e.speedMod = 0.08 + 2.6 * s * s * s;
    },
    sample(u, v, e) {
      const av = Math.abs(v);
      const P = e.pal;
      if (ell(u, av, 3.1, 1.85, 1.0, 1.0) < 1) {
        if (ell(u, av, 3.25, 2.0, 0.48, 0.48) < 1) return hit([16, 22, 16]);
        return hit(P.eye);
      }
      const rv = 3.0 * (1 - 0.28 * Math.max(0, (u - 0.4) / 4.6));
      if (ell(u, v, 0.4, 0, 4.6, rv) < 1) {
        if (vnoise(u * 0.55 + 4, v * 0.55, e.seed) > 0.68) return hit(P.spot);
        return hit(P.skin, 1, 0.15, av < 0.6 ? 1.08 : 1);
      }
      const x = e.ext;
      const kx = lerp(-1.2, -5.2, x);
      const ky = lerp(4.8, 3.4, x);
      const fx = lerp(-4.4, -9.8, x);
      const fy = lerp(4.6, 2.9, x);
      if (segDist(u, av, -2.6, 2.0, kx, ky) < 0.95 || segDist(u, av, kx, ky, fx, fy) < 0.7) return hit(P.skin, 1, 0, 0.84);
      if (ell(u, av, fx - 0.6, fy, 1.3, 1.1) < 1) return hit(P.skin, 0.9, 0, 0.72);
      const hx = lerp(3.8, 3.2, x);
      const hy = lerp(4.2, 4.4, x);
      if (segDist(u, av, 2.0, 2.3, hx, hy) < 0.55) return hit(P.skin, 1, 0, 0.84);
      return false;
    },
  },
  {
    id: "cranes",
    label: "Crane",
    swatch: [214, 220, 238],
    scale: 1.15,
    radius: 15,
    count: 8,
    speed: 5.5,
    turn: 0.5,
    phaseRate: 3.4,
    mode: "flow",
    hint: "Tap to turn the flock",
    direction: 315,
    spread: 0.12,
    trail: { chars: "'`.", color: [190, 200, 225], life: 1.0, at: [[-9, 0]] },
    variants: [
      { white: [226, 230, 240], black: [44, 46, 54], feather: [78, 82, 96], crown: [222, 42, 42] },
      { white: [214, 220, 238], black: [50, 54, 62], feather: [88, 92, 106], crown: [210, 52, 52] },
      { white: [172, 180, 196], black: [64, 68, 78], feather: [98, 104, 120], crown: [200, 56, 56] },
    ],
    prep(e) {
      e.f = 0.55 + 0.45 * Math.cos(e.phase);
      e.span = 3.5 + 9.5 * e.f;
    },
    wobble(e, t) {
      return 0.08 * Math.sin(t * 0.5 + e.seed * 2);
    },
    sample(u, v, e) {
      const av = Math.abs(v);
      const P = e.pal;
      if (u > 9.0 && u < 10.8 && av < 0.34) return hit([196, 186, 136]);
      if (ell(u, v, 8.3, 0, 0.95, 0.78) < 1) return u > 8.3 && av < 0.42 ? hit(P.crown) : hit(P.black);
      if (u > 2.3 && u <= 8.3 && av < 0.5) return hit(u > 4.6 ? P.black : P.white);
      if (ell(u, v, -1, 0, 3.8, 1.45) < 1) return hit(P.white, 1, 0.1);
      if (u < -4.4 && u > -6.0 && av < 0.9) return hit(P.black);
      if (u <= -5.6 && u > -10.5 && Math.abs(av - 0.45) < 0.32) return glyph(":|", [130, 130, 136], 0.8);
      if (av >= 1.1 && av < 1.1 + e.span) {
        const w = av - 1.1;
        const s = w / e.span;
        const uf = 1.5 - 1.7 * s - (s > 0.82 ? sq((s - 0.82) * 9) * 0.5 : 0);
        const ub = -2.5 - 1.0 * s + (s > 0.74 ? sq((s - 0.74) * 6.5) : 0);
        if (u < uf && u > ub) {
          if (u - ub < 0.55 && ((w * 1.4) | 0) & 1) return false;
          const shade = 0.72 + 0.28 * e.f;
          if (s > 0.84 || (s < 0.74 && u - ub < (uf - ub) * 0.4)) return hit(P.feather, 1, 0, shade);
          return hit(P.white, 1, 0.1, shade);
        }
      }
      return false;
    },
  },
  {
    id: "crabs",
    label: "Crab",
    swatch: [204, 82, 52],
    scale: 1.2,
    radius: 11,
    count: 10,
    speed: 2.8,
    turn: 2,
    phaseRate: 14,
    mode: "wander",
    hoverShy: true,
    rippleChars: ":.",
    hint: "Tap near the crabs to startle them",
    retarget: [2, 6],
    direction: 90,
    spread: 1,
    facing: Math.PI / 2,
    trail: { chars: ":.;", color: [200, 160, 120], life: 1.6, at: [[0, -5], [0, 5]] },
    variants: [
      { shell: [204, 82, 52], dark: [120, 40, 26], claw: [226, 110, 70] },
      { shell: [226, 124, 48], dark: [140, 64, 26], claw: [240, 150, 80] },
      { shell: [170, 56, 50], dark: [96, 28, 26], claw: [200, 84, 70] },
    ],
    prep(e, sway, t) {
      const walk = 0.5 + 0.5 * Math.sin(t * 0.7 + e.seed * 11);
      e.walk = e.scared > 0 ? 1 : walk > 0.3 ? walk : 0;
      e.speedMod = 1.3 * e.walk;
      e.phaseMod = e.walk;
      e.open = 0.5 + 0.5 * Math.sin(t * 1.7 + e.seed * 4);
    },
    sample(u, v, e) {
      const av = Math.abs(v);
      const P = e.pal;
      const d = ell(u, v, 0, 0, 3.0, 5.0);
      if (d < 1 && u < 3.0) {
        if (vnoise(u * 0.7, v * 0.7 + 5, e.seed) > 0.72) return hit(P.dark);
        if (d > 0.75) return hit(mix(P.shell, P.dark, 0.45));
        return hit(P.shell, 1, 0.15, u > 1 && av < 2 ? 1.15 : 1);
      }
      if (u >= 3.0 && u < 4.4 && Math.abs(av - 1.3) < 0.4) return u > 3.8 ? hit([20, 20, 20]) : hit(P.dark);
      if (segDist(u, av, 2.2, 3.0, 4.2, 4.0) < 0.7) return hit(P.claw, 1, 0, 0.9);
      if (ell(u, av, 5.6, 4.1, 1.9, 1.5) < 1) {
        if (u > 5.9 && Math.abs(av - 4.1) < 0.5 * e.open) return false;
        return hit(P.claw, 1, 0.2);
      }
      const side = v > 0 ? 0 : Math.PI;
      for (let i = 0; i < 4; i++) {
        const ub = 1.0 - i * 1.2;
        const ab = 4.5 - Math.abs(i - 1.5) * 0.2;
        const jig = 0.6 * Math.sin(e.phase + i * 1.9 + side);
        const ku = ub * 1.3 + 0.3 + jig * 0.5;
        const ut = ub * 1.85 - 0.6 + jig;
        if (segDist(u, av, ub, ab, ku, 7.3) < 0.5) return hit(P.shell, 1, 0, 0.85);
        if (segDist(u, av, ku, 7.3, ut, 9.8) < 0.45) return hit(P.dark, 1, 0, 1.15);
      }
      return false;
    },
  },
];

const ANIMAL_BY_ID = Object.fromEntries(ANIMALS.map((a) => [a.id, a]));

/* =========================================================================
   Host bridge
   The Linux launcher (src/ascii-animals-screensaver) injects
   window.SAVER_HOST = { mode, settings, ... } before this script runs, and
   receives JSON messages on window.webkit.messageHandlers.saver.
   Opened straight in a browser there is no host: settings live in
   localStorage and the mode comes from ?mode=saver|settings.
   ========================================================================= */

const HOST = window.SAVER_HOST || null;
const MODE = HOST ? HOST.mode : new URLSearchParams(location.search).get("mode") === "saver" ? "saver" : "settings";
const IS_SAVER = MODE === "saver";
document.documentElement.dataset.mode = MODE;

function postToHost(msg) {
  if (!HOST) return;
  try {
    window.webkit.messageHandlers.saver.postMessage(JSON.stringify(msg));
  } catch {
    /* no handler registered: nothing to tell */
  }
}

/* =========================================================================
   Settings
   ========================================================================= */

const STORAGE_KEY = "asciiScreensaver.v1";
const LAST_SHOWN_KEY = "asciiScreensaver.lastShown";

function defaultTune() {
  return Object.fromEntries(ANIMALS.map((a) => [a.id, { direction: a.direction, spread: a.spread }]));
}

// 24-hour clock unless the system locale uses AM/PM
const LOCALE_24H = (() => {
  try {
    const hc = new Intl.DateTimeFormat(undefined, { hour: "numeric" }).resolvedOptions().hourCycle;
    return hc !== "h11" && hc !== "h12";
  } catch {
    return true;
  }
})();

const DEFAULTS = {
  // screensaver (the launcher reads `enabled` and `idleMinutes` too)
  enabled: true,
  idleMinutes: 3,
  rotate: 5,
  random: true,
  animal: "butterflies",
  // clock
  lang: "auto",
  clock24: LOCALE_24H,
  greeting: true,
  name: "",
  // movement and look
  density: 1,
  speed: 1,
  size: 1,
  depth: 0.6,
  sway: 0.5,
  cell: 9,
  trails: true,
  bokeh: true,
  // clicks in the settings window
  reach: 220,
  scare: 1,
  tune: defaultTune(),
};

// what "Reset" leaves alone: only the movement and look sliders go back
const KEEP_ON_RESET = ["enabled", "idleMinutes", "rotate", "random", "animal", "lang", "clock24", "greeting", "name"];

let settings = structuredClone(DEFAULTS);

function loadSettings() {
  let saved = null;
  if (HOST) {
    saved = HOST.settings;
  } else {
    try {
      saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    } catch {
      saved = null;
    }
  }
  if (saved && typeof saved === "object") {
    settings = { ...structuredClone(DEFAULTS), ...saved, tune: { ...defaultTune(), ...(saved.tune || {}) } };
  }
  if (!ANIMAL_BY_ID[settings.animal]) settings.animal = DEFAULTS.animal;
}

let saveTimer = 0;
function saveSettings(now = false) {
  if (IS_SAVER) return; // the screensaver only ever reads settings
  clearTimeout(saveTimer);
  const write = () => {
    if (HOST) {
      postToHost({ type: "save", settings });
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      /* storage is best effort */
    }
  };
  if (now) write();
  else saveTimer = setTimeout(write, 200);
}

/* =========================================================================
   Text (English and French)
   ========================================================================= */

const STRINGS = {
  en: {
    animals: Object.fromEntries(ANIMALS.map((a) => [a.id, { label: a.label, hint: a.hint }])),
    greeting(h, name) {
      if (h < 5 || h >= 22) return name ? `Still up, ${name}?` : "Still up?";
      const part = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
      return name ? `${part}, ${name}` : part;
    },
    settings: "Settings",
    reset: "Reset",
    close: "Close settings",
    sec_saver: "Screensaver",
    enabled: "Enabled",
    idleMinutes: "Start after",
    rotate: "Change animal every",
    random: "Random animal",
    preview: "Preview",
    sec_clock: "Clock",
    lang: "Language",
    lang_auto: "Auto",
    clock24: "24-hour clock",
    greeting_on: "Greeting",
    name: "Your name",
    namePlaceholder: "Shown in the greeting",
    sec_movement: "Movement",
    density: "Density",
    speed: "Speed",
    direction: "Direction",
    spread: "Spread",
    sway: "Sway",
    sec_look: "Look",
    size: "Size",
    depth: "Depth",
    cell: "Cell size",
    trails: "ASCII trails",
    bokeh: "Foreground blur",
    never: "Never",
    minutes: (v) => `${v} min`,
    noteNever: "GNOME never turns the screen off, so the animals stay until you come back.",
    noteOk: (m) => `GNOME turns the screen off after ${m} min idle. You can change that in Settings › Power.`,
    noteTooLate: (m) =>
      `GNOME turns the screen off after ${m} min idle, before the screensaver gets to start. Pick a shorter delay here, or a longer one in Settings › Power.`,
  },
  fr: {
    animals: {
      butterflies: { label: "Papillon", hint: "Cliquez pour disperser les papillons" },
      koi: { label: "Koï", hint: "Cliquez sur l'eau pour nourrir les koïs" },
      jellyfish: { label: "Méduse", hint: "Cliquez pour faire fuir les méduses" },
      dragonflies: { label: "Libellule", hint: "Cliquez pour faire filer les libellules" },
      frogs: { label: "Grenouille", hint: "Cliquez pour faire sauter les grenouilles" },
      cranes: { label: "Grue", hint: "Cliquez pour faire virer la nuée" },
      crabs: { label: "Crabe", hint: "Cliquez près des crabes pour les effrayer" },
    },
    greeting(h, name) {
      const n = name ? `, ${name}` : "";
      if (h < 5 || h >= 22) return `Encore debout${n} ?`;
      return (h < 18 ? "Bonjour" : "Bonsoir") + n;
    },
    settings: "Réglages",
    reset: "Réinitialiser",
    close: "Fermer les réglages",
    sec_saver: "Écran de veille",
    enabled: "Activé",
    idleMinutes: "Démarrer après",
    rotate: "Changer d'animal toutes les",
    random: "Animal au hasard",
    preview: "Aperçu",
    sec_clock: "Horloge",
    lang: "Langue",
    lang_auto: "Auto",
    clock24: "Format 24 heures",
    greeting_on: "Message d'accueil",
    name: "Votre prénom",
    namePlaceholder: "Affiché dans le message d'accueil",
    sec_movement: "Mouvement",
    density: "Densité",
    speed: "Vitesse",
    direction: "Direction",
    spread: "Dispersion",
    sway: "Ondulation",
    sec_look: "Apparence",
    size: "Taille",
    depth: "Profondeur",
    cell: "Taille des cellules",
    trails: "Traînées ASCII",
    bokeh: "Flou de premier plan",
    never: "Jamais",
    minutes: (v) => `${v} min`,
    noteNever: "GNOME n'éteint jamais l'écran : les animaux restent jusqu'à votre retour.",
    noteOk: (m) => `GNOME éteint l'écran après ${m} min d'inactivité. Modifiable dans Paramètres › Énergie.`,
    noteTooLate: (m) =>
      `GNOME éteint l'écran après ${m} min d'inactivité, avant que l'écran de veille ait pu démarrer. Choisissez un délai plus court ici, ou plus long dans Paramètres › Énergie.`,
  },
};

function lang() {
  if (settings.lang === "fr" || settings.lang === "en") return settings.lang;
  return (navigator.language || "en").toLowerCase().startsWith("fr") ? "fr" : "en";
}

const t = (key) => STRINGS[lang()][key] ?? STRINGS.en[key];

// undefined = the system locale
const locale = () => (settings.lang === "fr" ? "fr-FR" : settings.lang === "en" ? "en-US" : undefined);

/* =========================================================================
   Renderer
   ========================================================================= */

const world = document.getElementById("world");
const bokehCanvas = document.getElementById("bokeh");
const ctx = world.getContext("2d", { alpha: false });
const bctx = bokehCanvas.getContext("2d");

const BG = [13, 16, 22];
const BG_PACKED = (255 << 24) | (BG[2] << 16) | (BG[1] << 8) | BG[0];
const GRID_LINE = "rgba(5, 6, 9, 0.94)";

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const R = {
  dpr: 1,
  W: 0,
  H: 0,
  cell: 9,
  cols: 0,
  rows: 0,
  line: 1,
  lo: document.createElement("canvas"),
  loCtx: null,
  img: null,
  buf: null,
  blo: document.createElement("canvas"),
  bloCtx: null,
  bimg: null,
  bbuf: null,
  overlay: document.createElement("canvas"),
  occ: null,
  tLife: null,
  tChar: null,
  tCol: null,
  font: "",
};
R.loCtx = R.lo.getContext("2d");
R.bloCtx = R.blo.getContext("2d");

function resize() {
  R.dpr = window.devicePixelRatio || 1;
  R.W = Math.round(window.innerWidth * R.dpr);
  R.H = Math.round(window.innerHeight * R.dpr);
  R.cell = Math.max(4, Math.round(settings.cell * R.dpr));
  R.line = Math.max(1, Math.round(R.dpr));
  R.cols = Math.ceil(R.W / R.cell) + 1;
  R.rows = Math.ceil(R.H / R.cell) + 1;

  for (const c of [world, bokehCanvas]) {
    c.width = R.W;
    c.height = R.H;
  }

  R.lo.width = R.blo.width = R.cols;
  R.lo.height = R.blo.height = R.rows;
  R.img = R.loCtx.createImageData(R.cols, R.rows);
  R.buf = new Uint32Array(R.img.data.buffer);
  R.bimg = R.bloCtx.createImageData(R.cols, R.rows);
  R.bbuf = new Uint32Array(R.bimg.data.buffer);

  const n = R.cols * R.rows;
  R.occ = new Int16Array(n);
  R.tLife = new Float32Array(n);
  R.tChar = new Uint8Array(n);
  R.tCol = new Uint8Array(n * 3);

  R.font = `600 ${Math.round(R.cell * 1.02)}px "Geist Mono", ui-monospace, monospace`;
  drawOverlay();
}

function drawOverlay() {
  const o = R.overlay;
  o.width = R.W;
  o.height = R.H;
  const g = o.getContext("2d");
  g.clearRect(0, 0, R.W, R.H);
  g.fillStyle = GRID_LINE;
  for (let i = 0; i <= R.cols; i++) g.fillRect(i * R.cell, 0, R.line, R.H);
  for (let j = 0; j <= R.rows; j++) g.fillRect(0, j * R.cell, R.W, R.line);
  const rg = g.createRadialGradient(R.W / 2, R.H * 0.45, Math.min(R.W, R.H) * 0.2, R.W / 2, R.H * 0.5, Math.hypot(R.W, R.H) * 0.62);
  rg.addColorStop(0, "rgba(0,0,0,0)");
  rg.addColorStop(1, "rgba(0,0,0,0.55)");
  g.fillStyle = rg;
  g.fillRect(0, 0, R.W, R.H);
}

/* ---------- entities ---------- */

let entities = [];
let bokehs = [];
let seedCounter = 1;
let simTime = 0;
let current = DEFAULTS.animal; // the animal shown in this tab (can differ from the saved pick in random mode)
const pointer = { x: -1e9, y: -1e9, active: false };
const foods = []; // koi pellets: { x, y, vx, vy, age, life, tint }
const ripples = []; // tap feedback: { x, y, age, dur, maxR, chars, color }

function scaleFor(e) {
  const far = 1 - settings.depth * 0.62;
  return settings.size * (e.A.scale || 1) * lerp(far, 1.12, e.z) * (e.bokeh ? 1.7 : 1);
}

function makeEntity(A, opts = {}) {
  const tune = settings.tune[A.id];
  const dirRad = ((tune.direction - 90) * Math.PI) / 180;
  const e = {
    A,
    x: opts.x ?? rand(0, R.W),
    y: opts.y ?? rand(0, R.H),
    z: opts.z ?? Math.pow(Math.random(), 0.85),
    seed: (seedCounter++ * 2654435761) >>> 16,
    pal: pick(A.variants),
    phase: rand(0, TAU),
    rateMul: rand(0.85, 1.15),
    speedMul: rand(0.75, 1.25),
    baseOff: rand(-1, 1),
    heading: 0,
    target: 0,
    retargetAt: 0,
    fade: opts.fade ?? 0,
    leaving: false,
    bokeh: !!opts.bokeh,
    speedMod: 1,
    phaseMod: 1,
    lastTrail: -1,
    trailFlip: 0,
    scared: 0,
    scareX: 0,
    scareY: 0,
  };
  e.heading = e.target = dirRad + (A.mode === "flow" ? e.baseOff * Math.PI * tune.spread * 0.35 : rand(-1, 1) * Math.PI * tune.spread);
  return e;
}

function desiredCount(A) {
  const area = (window.innerWidth * window.innerHeight) / (1440 * 900);
  return Math.max(1, Math.round(A.count * settings.density * clamp(area, 0.35, 2.2)));
}

function syncPopulation(initial = false) {
  const A = ANIMAL_BY_ID[current];
  const live = entities.filter((e) => !e.leaving && e.A === A);
  const want = desiredCount(A);
  if (live.length < want) {
    for (let i = live.length; i < want; i++) entities.push(makeEntity(A, { fade: initial ? 1 : 0 }));
  } else if (live.length > want) {
    live.slice(want).forEach((e) => (e.leaving = true));
  }
  const bWant = settings.bokeh && !reducedMotion.matches ? 2 : 0;
  bokehs = bokehs.filter((b) => b.A === A || b.fade > 0);
  bokehs.forEach((b) => {
    if (b.A !== A) b.leaving = true;
  });
  const liveB = bokehs.filter((b) => !b.leaving);
  for (let i = liveB.length; i < bWant; i++) bokehs.push(makeEntity(A, { bokeh: true, z: 1, fade: initial ? 1 : 0 }));
  liveB.slice(bWant).forEach((b) => (b.leaving = true));
}

function showAnimal(id) {
  if (!ANIMAL_BY_ID[id] || id === current) return false;
  current = id;
  entities.forEach((e) => (e.leaving = true));
  bokehs.forEach((b) => (b.leaving = true));
  foods.length = 0;
  syncPopulation();
  showHint();
  return true;
}

/* ---------- taps: feeding and startling ---------- */

function tapReach() {
  return settings.reach * R.dpr;
}

function addRipple(x, y, opts = {}) {
  ripples.push({ x, y, age: 0, dur: opts.dur ?? 0.9, maxR: opts.maxR ?? 6, chars: opts.chars ?? "·", color: opts.color ?? [200, 210, 230] });
  if (ripples.length > 24) ripples.shift();
}

function tap(x, y) {
  const A = ANIMAL_BY_ID[current];
  const pale = mix(A.swatch, WHITE, 0.55);
  hideHint();

  if (A.feeds) {
    const n = 6 + ((Math.random() * 4) | 0);
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      const r = Math.sqrt(Math.random()) * 2.6 * R.cell;
      const s = rand(0.3, 1.2) * R.cell;
      foods.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, vx: Math.cos(a) * s, vy: Math.sin(a) * s, age: 0, life: rand(14, 18), tint: rand(0.85, 1.12) });
    }
    while (foods.length > 80) foods.shift();
    addRipple(x, y, { dur: 1.3, maxR: 7, chars: "~", color: [150, 185, 220] });
    return;
  }

  const reach = tapReach();
  for (const e of entities) {
    if (e.leaving) continue;
    const dx = e.x - x;
    const dy = e.y - y;
    const d = Math.hypot(dx, dy) || 1;
    const lim = reach + A.radius * scaleFor(e) * R.cell;
    if (d > lim) continue;
    const s = 0.45 + 0.55 * (1 - d / lim);
    e.scared = Math.max(e.scared, s);
    e.scareX = dx / d;
    e.scareY = dy / d;
    if (A.onScare) A.onScare(e);
  }
  addRipple(x, y, { dur: 0.75, maxR: Math.max(4, (reach / R.cell) * 0.45), chars: A.rippleChars || "·", color: pale });
}

/* ---------- simulation ---------- */

function step(dt) {
  const motion = reducedMotion.matches ? 0.3 : 1;
  const sp = settings.speed * motion;
  simTime += dt * motion;
  const t = simTime;
  const all = entities.concat(bokehs);
  const reachPx = tapReach();

  // pellets drift apart a little, then sit and slowly dissolve
  for (const f of foods) {
    f.age += dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.vx *= Math.pow(0.12, dt);
    f.vy *= Math.pow(0.12, dt);
  }
  for (let i = foods.length - 1; i >= 0; i--) if (foods[i].age > foods[i].life || foods[i].eaten) foods.splice(i, 1);

  for (const r of ripples) r.age += dt;
  while (ripples.length && ripples[0].age > ripples[0].dur) ripples.shift();

  for (const e of all) {
    const A = e.A;
    const tune = settings.tune[A.id];
    const dirRad = ((tune.direction - 90) * Math.PI) / 180;

    e.fade = e.leaving ? Math.max(0, e.fade - dt / 0.6) : Math.min(1, e.fade + dt / 0.9);
    if (e.scared > 0) e.scared = Math.max(0, e.scared - dt / 1.4);
    const scare = e.scared * settings.scare;

    e.speedMod = 1;
    e.phaseMod = 1;
    A.prep(e, settings.sway, t);
    if (scare > 0) {
      e.speedMod = Math.max(e.speedMod, 0.9);
      e.phaseMod = Math.max(e.phaseMod, 1) * (1 + scare * 1.6);
    }
    e.phase += dt * A.phaseRate * e.rateMul * e.phaseMod * (0.55 + 0.45 * sp);

    // where does it want to go?
    if (A.mode === "flow") {
      e.target = dirRad + e.baseOff * Math.PI * tune.spread * 0.35 + (A.wobble ? A.wobble(e, t) * (0.4 + settings.sway * 1.2) : 0);
    } else if (t >= e.retargetAt) {
      e.target = dirRad + rand(-1, 1) * Math.PI * tune.spread;
      e.retargetAt = t + rand(A.retarget[0], A.retarget[1]);
    }

    let dx = Math.cos(e.target);
    let dy = Math.sin(e.target);
    const k = scaleFor(e);
    const reach = A.radius * k * R.cell;
    let boost = 1;
    let turnMul = 1;
    let crowd = 1.6;

    // koi: find the nearest pellet in range and go for it
    if (A.feeds && foods.length && !e.bokeh && !e.leaving) {
      const hx = e.x + Math.cos(e.heading) * 6.5 * k * R.cell;
      const hy = e.y + Math.sin(e.heading) * 6.5 * k * R.cell;
      // close koi rush in; koi further out notice more slowly and drift over
      const sense = reachPx * 2.6;
      let best = null;
      let bestD = sense;
      for (const f of foods) {
        if (f.eaten) continue;
        const d = Math.hypot(f.x - hx, f.y - hy);
        if (d < bestD) {
          bestD = d;
          best = f;
        }
      }
      if (best) {
        const close = clamp(1 - bestD / reachPx, 0, 1);
        const far = bestD > reachPx;
        const fx = (best.x - hx) / (bestD || 1);
        const fy = (best.y - hy) / (bestD || 1);
        const pull = far ? 2.2 : 3 + 5 * close;
        dx += fx * pull;
        dy += fy * pull;
        boost = far ? 3.2 : 3.6 + 3.0 * close;
        turnMul = far ? 2.2 : 2.6 + 3.5 * close;
        crowd = far ? 0.8 : 0.35;
        if (bestD < 3.5 * k * R.cell) boost *= 0.45;
        if (bestD < (1.3 * k + 0.8) * R.cell && best.age > 0.4 && t >= (e.nextBite || 0)) {
          best.eaten = true;
          e.nextBite = t + rand(0.5, 0.9);
          addRipple(best.x, best.y, { dur: 0.7, maxR: 2.5, chars: "°", color: [170, 200, 230] });
          e.retargetAt = t + rand(0.4, 1.4);
        }
      }
    }

    if (!e.bokeh) {
      for (const o of entities) {
        if (o === e || o.leaving || Math.abs(o.z - e.z) > 0.35) continue;
        const ox = e.x - o.x;
        const oy = e.y - o.y;
        const d = Math.hypot(ox, oy);
        const lim = (reach + o.A.radius * scaleFor(o) * R.cell) * 0.75;
        if (d > 0 && d < lim) {
          const w = (1 - d / lim) * crowd;
          dx += (ox / d) * w;
          dy += (oy / d) * w;
        }
      }
    }

    if (scare > 0 && !e.bokeh) {
      dx += e.scareX * 7 * scare;
      dy += e.scareY * 7 * scare;
      boost *= 1 + 2.2 * scare;
      turnMul *= 1 + 4 * scare;
    }

    if (A.hoverShy && pointer.active && !e.bokeh) {
      const px = e.x - pointer.x;
      const py = e.y - pointer.y;
      const d = Math.hypot(px, py);
      const lim = reach + 70 * R.dpr;
      if (d > 0 && d < lim) {
        const w = (1 - d / lim) * 2.5;
        dx += (px / d) * w;
        dy += (py / d) * w;
        boost *= 1 + (1 - d / lim) * 0.9;
        turnMul *= 1.8;
      }
    }

    const desired = Math.atan2(dy, dx);
    const turn = A.turn * turnMul * dt;
    e.heading += clamp(angleDiff(desired, e.heading), -turn, turn);

    const parallax = e.bokeh ? 0.55 : 0.55 + 0.45 * e.z;
    const v = A.speed * e.speedMul * e.speedMod * sp * parallax * boost * R.cell * k * 0.6;
    e.x += Math.cos(e.heading) * v * dt;
    e.y += Math.sin(e.heading) * v * dt;

    // wrap around, re-entering at a fresh spot along the far edge
    const m = reach + 4 * R.cell;
    if (e.x < -m) {
      e.x = R.W + m;
      e.y = rand(0, R.H);
    } else if (e.x > R.W + m) {
      e.x = -m;
      e.y = rand(0, R.H);
    }
    if (e.y < -m) {
      e.y = R.H + m;
      e.x = rand(0, R.W);
    } else if (e.y > R.H + m) {
      e.y = -m;
      e.x = rand(0, R.W);
    }
  }

  entities = entities.filter((e) => !(e.leaving && e.fade <= 0));
  bokehs = bokehs.filter((e) => !(e.leaving && e.fade <= 0));
}

/* ---------- drawing ---------- */

const glyphs = [];

function rasterize(e, order, buf, transparentBg) {
  const A = e.A;
  const k = scaleFor(e);
  const cx = e.x / R.cell;
  const cy = e.y / R.cell;
  const rad = A.radius * k;
  const i0 = Math.max(0, Math.floor(cx - rad));
  const i1 = Math.min(R.cols - 1, Math.ceil(cx + rad));
  const j0 = Math.max(0, Math.floor(cy - rad));
  const j1 = Math.min(R.rows - 1, Math.ceil(cy + rad));
  if (i0 > i1 || j0 > j1) return;

  const ang = e.heading + (A.facing || 0);
  const cs = Math.cos(ang) / k;
  const sn = Math.sin(ang) / k;
  const bright = e.bokeh ? 1 : lerp(0.38, 1, e.z);
  const fade = e.fade;
  const tick = (simTime * 5) | 0;
  const cols = R.cols;
  const occ = R.occ;

  for (let j = j0; j <= j1; j++) {
    const dy = j + 0.5 - cy;
    for (let i = i0; i <= i1; i++) {
      const dx = i + 0.5 - cx;
      const u = dx * cs + dy * sn;
      const v = -dx * sn + dy * cs;
      if (!A.sample(u, v, e)) continue;
      const idx = j * cols + i;
      const a = out.a * fade;
      if (a <= 0.01) continue;

      if (out.ch) {
        if (transparentBg) continue;
        const set = out.ch;
        const ch = set.length > 1 ? set[(hash2(i, j, e.seed + tick) * set.length) | 0] : set;
        glyphs.push(i, j, order, out.r * bright, out.g * bright, out.b * bright, a * (0.45 + 0.55 * bright), ch);
        continue;
      }

      const jit = 0.86 + 0.28 * hash2(i, j, e.seed);
      let r = out.r * jit;
      let g = out.g * jit;
      let b = out.b * jit;
      if (out.shine && hash2(i, j, e.seed ^ 77) < out.shine * 0.18) {
        r = lerp(r, 245, 0.65);
        g = lerp(g, 248, 0.65);
        b = lerp(b, 255, 0.65);
      }

      if (transparentBg) {
        const al = clamp(a * 255, 0, 255) | 0;
        buf[idx] = (al << 24) | (clamp(b, 0, 255) << 16) | (clamp(g, 0, 255) << 8) | clamp(r, 0, 255);
        continue;
      }

      const p = buf[idx];
      const t = a * bright;
      const pr = p & 255;
      const pg = (p >>> 8) & 255;
      const pb = (p >>> 16) & 255;
      r = clamp(lerp(pr, r, t), 0, 255) | 0;
      g = clamp(lerp(pg, g, t), 0, 255) | 0;
      b = clamp(lerp(pb, b, t), 0, 255) | 0;
      buf[idx] = (255 << 24) | (b << 16) | (g << 8) | r;
      if (a > 0.5) occ[idx] = order;
    }
  }
}

function emitTrails(e, dt) {
  if (!settings.trails || e.bokeh || e.fade < 0.5) return;
  const A = e.A;
  const tr = A.trail;
  const k = scaleFor(e);
  const ang = e.heading + (A.facing || 0);
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  e.trailFlip = (e.trailFlip + 1) % tr.at.length;
  const [tu, tv] = tr.at[e.trailFlip];
  const wx = e.x / R.cell + (tu * c - tv * s) * k;
  const wy = e.y / R.cell + (tu * s + tv * c) * k;
  const i = Math.floor(wx);
  const j = Math.floor(wy);
  if (i < 0 || j < 0 || i >= R.cols || j >= R.rows) return;
  const idx = j * R.cols + i;
  if (idx === e.lastTrail) return;
  e.lastTrail = idx;
  if (Math.random() > 0.75) return;
  const bright = lerp(0.35, 0.9, e.z);
  R.tLife[idx] = bright;
  R.tChar[idx] = (Math.random() * tr.chars.length) | 0;
  R.tCol[idx * 3] = tr.color[0];
  R.tCol[idx * 3 + 1] = tr.color[1];
  R.tCol[idx * 3 + 2] = tr.color[2];
}

let trailChars = ".";

function render(dt) {
  const buf = R.buf;
  buf.fill(BG_PACKED);
  R.occ.fill(-1);
  glyphs.length = 0;

  const sorted = entities.slice().sort((a, b) => a.z - b.z);
  for (let n = 0; n < sorted.length; n++) {
    rasterize(sorted[n], n, buf, false);
    emitTrails(sorted[n], dt);
  }
  drawFood(buf);

  R.loCtx.putImageData(R.img, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(R.lo, 0, 0, R.cols * R.cell, R.rows * R.cell);
  ctx.drawImage(R.overlay, 0, 0);

  ctx.font = R.font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const half = R.cell / 2 + R.line / 2;

  // trails fade out underneath the animals
  const A = ANIMAL_BY_ID[current];
  trailChars = A.trail.chars;
  const life = R.tLife;
  const decay = dt / A.trail.life;
  const occ = R.occ;
  for (let idx = 0; idx < life.length; idx++) {
    const l = life[idx];
    if (l <= 0) continue;
    const nl = l - decay;
    life[idx] = nl;
    if (nl <= 0.02 || occ[idx] >= 0) continue;
    const i = idx % R.cols;
    const j = (idx / R.cols) | 0;
    ctx.fillStyle = `rgba(${R.tCol[idx * 3]},${R.tCol[idx * 3 + 1]},${R.tCol[idx * 3 + 2]},${(nl * 0.55).toFixed(3)})`;
    ctx.fillText(trailChars[R.tChar[idx] % trailChars.length], i * R.cell + half, j * R.cell + half);
  }

  for (let g = 0; g < glyphs.length; g += 8) {
    const i = glyphs[g];
    const j = glyphs[g + 1];
    const order = glyphs[g + 2];
    if (occ[j * R.cols + i] > order) continue;
    ctx.fillStyle = `rgba(${glyphs[g + 3] | 0},${glyphs[g + 4] | 0},${glyphs[g + 5] | 0},${glyphs[g + 6].toFixed(3)})`;
    ctx.fillText(glyphs[g + 7], i * R.cell + half, j * R.cell + half);
  }

  drawRipples(half);

  // out-of-focus foreground animals
  bctx.clearRect(0, 0, R.W, R.H);
  if (bokehs.length) {
    R.bbuf.fill(0);
    for (const b of bokehs) rasterize(b, 0, R.bbuf, true);
    R.bloCtx.putImageData(R.bimg, 0, 0);
    bctx.imageSmoothingEnabled = false;
    bctx.drawImage(R.blo, 0, 0, R.cols * R.cell, R.rows * R.cell);
  }
}

// pellets float on the surface, so they sit above the koi
const FOOD = [204, 126, 58];
function drawFood(buf) {
  const occ = R.occ;
  for (const f of foods) {
    const i = Math.floor(f.x / R.cell);
    const j = Math.floor(f.y / R.cell);
    if (i < 0 || j < 0 || i >= R.cols || j >= R.rows) continue;
    const pop = clamp(f.age / 0.18, 0, 1);
    const a = pop * clamp((f.life - f.age) / 2.5, 0, 1);
    if (a <= 0.02) continue;
    const idx = j * R.cols + i;
    const p = buf[idx];
    const r = clamp(lerp(p & 255, FOOD[0] * f.tint, a), 0, 255) | 0;
    const g = clamp(lerp((p >>> 8) & 255, FOOD[1] * f.tint, a), 0, 255) | 0;
    const b = clamp(lerp((p >>> 16) & 255, FOOD[2] * f.tint, a), 0, 255) | 0;
    buf[idx] = (255 << 24) | (b << 16) | (g << 8) | r;
    occ[idx] = 32000;
  }
}

function drawRipples(half) {
  for (const rp of ripples) {
    const p = clamp(rp.age / rp.dur, 0, 1);
    const radius = 0.6 + rp.maxR * (1 - Math.pow(1 - p, 2.2));
    const alpha = Math.pow(1 - p, 1.3) * 0.8;
    if (alpha <= 0.02) continue;
    const ci = rp.x / R.cell;
    const cj = rp.y / R.cell;
    const n = Math.max(8, Math.ceil(TAU * radius * 1.15));
    const seen = new Set();
    ctx.fillStyle = `rgba(${rp.color[0] | 0},${rp.color[1] | 0},${rp.color[2] | 0},${alpha.toFixed(3)})`;
    for (let q = 0; q < n; q++) {
      const a = (q / n) * TAU;
      const i = Math.floor(ci + Math.cos(a) * radius);
      const j = Math.floor(cj + Math.sin(a) * radius);
      const key = i * 65536 + j;
      if (seen.has(key) || i < 0 || j < 0 || i >= R.cols || j >= R.rows) continue;
      seen.add(key);
      ctx.fillText(rp.chars[q % rp.chars.length], i * R.cell + half, j * R.cell + half);
    }
  }
}

let last = 0;
function frame(now) {
  const dt = last ? clamp((now - last) / 1000, 0, 0.05) : 0.016;
  last = now;
  step(dt);
  render(dt);
  requestAnimationFrame(frame);
}

/* =========================================================================
   Clock
   ========================================================================= */

const $ = (id) => document.getElementById(id);

let clockKey = "";
function updateClock() {
  const now = new Date();
  const loc = locale();
  // the AM/PM marker is split out so it can be set smaller
  const parts = new Intl.DateTimeFormat(loc, {
    hour: "numeric",
    minute: "2-digit",
    hourCycle: settings.clock24 ? "h23" : "h12",
  }).formatToParts(now);
  let time = "";
  let period = "";
  for (const p of parts) {
    if (p.type === "dayPeriod") period = p.value;
    else time += p.value;
  }
  time = time.trim();
  const date = now.toLocaleDateString(loc, { weekday: "long", day: "numeric", month: "long" });
  const greet = settings.greeting ? t("greeting")(now.getHours(), settings.name.trim()) : "";

  const key = `${time}|${period}|${date}|${greet}`;
  if (key === clockKey) return;
  clockKey = key;

  const timeEl = $("time");
  timeEl.textContent = time;
  if (period) {
    const span = document.createElement("span");
    span.className = "period";
    span.textContent = period;
    timeEl.append(span);
  }
  $("date").textContent = date;
  $("greeting").textContent = greet;
  $("greeting").hidden = !greet;
}

/* =========================================================================
   Screensaver mode
   ========================================================================= */

// Order the animals appear in during one run. Every monitor gets the same
// seed from the launcher, so all screens show the same animal.
function animalOrder(seed, last) {
  const ids = ANIMALS.map((a) => a.id);
  if (!settings.random) {
    const i = Math.max(0, ids.indexOf(settings.animal));
    return ids.slice(i).concat(ids.slice(0, i));
  }
  let s = seed >>> 0;
  const rnd = () => {
    // mulberry32
    s = (s + 0x6d2b79f5) >>> 0;
    let x = Math.imul(s ^ (s >>> 15), 1 | s);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = ids.length - 1; i > 0; i--) {
    const j = (rnd() * (i + 1)) | 0;
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  // never the same animal twice in a row
  if (ids[0] === last) ids.push(ids.shift());
  return ids;
}

function readLastShown() {
  if (HOST) return HOST.last || null;
  try {
    return localStorage.getItem(LAST_SHOWN_KEY);
  } catch {
    return null;
  }
}

function noteShown(id) {
  if (HOST) {
    if (HOST.primary) postToHost({ type: "shown", animal: id });
    return;
  }
  try {
    localStorage.setItem(LAST_SHOWN_KEY, id);
  } catch {
    /* best effort */
  }
}

function startRotation(order) {
  noteShown(order[0]);
  if (!(settings.rotate > 0)) return;
  let n = 0;
  setInterval(() => {
    n = (n + 1) % order.length;
    showAnimal(order[n]);
    noteShown(order[n]);
  }, settings.rotate * 60_000);
}

// In a browser there is no launcher to close the screensaver, so any input
// goes back to the settings page. (Under the launcher, GTK handles this.)
function exitOnInput(leave) {
  const armedAt = performance.now() + 1500;
  let origin = null;
  const go = () => {
    if (performance.now() > armedAt) leave();
  };
  window.addEventListener("keydown", go);
  window.addEventListener("pointerdown", go);
  window.addEventListener("wheel", go, { passive: true });
  window.addEventListener("pointermove", (ev) => {
    if (performance.now() < armedAt) return;
    if (!origin) origin = [ev.clientX, ev.clientY];
    else if (Math.hypot(ev.clientX - origin[0], ev.clientY - origin[1]) > 16) leave();
  });
}

/* =========================================================================
   Settings mode: animal picker
   ========================================================================= */

function switchAnimal(id) {
  if (!showAnimal(id)) return;
  settings.animal = id;
  saveSettings();
}

let pickerButtons = [];

function setupPicker() {
  const picker = $("picker");
  const thumb = picker.querySelector(".thumb");
  pickerButtons = ANIMALS.map((A) => {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("role", "radio");
    b.dataset.value = A.id;
    const dot = document.createElement("span");
    dot.className = "dot";
    dot.style.setProperty("--swatch", `rgb(${A.swatch.join(",")})`);
    dot.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    b.append(dot, label);
    b.addEventListener("click", () => {
      switchAnimal(A.id);
      sync();
    });
    picker.append(b);
    return b;
  });

  function sync(animate = true) {
    pickerButtons.forEach((b) => {
      const on = b.dataset.value === current;
      b.setAttribute("aria-checked", String(on));
      b.tabIndex = on ? 0 : -1;
    });
    const active = pickerButtons.find((b) => b.dataset.value === current);
    if (!active) return;
    if (!animate) thumb.style.transition = "none";
    thumb.style.translate = `${active.offsetLeft}px 0`;
    thumb.style.width = `${active.offsetWidth}px`;
    if (!animate) {
      thumb.getBoundingClientRect();
      thumb.style.transition = "";
    }
    syncTweaks();
  }

  picker.addEventListener("keydown", (ev) => {
    const idx = ANIMALS.findIndex((a) => a.id === current);
    let next = -1;
    if (ev.key === "ArrowRight" || ev.key === "ArrowDown") next = (idx + 1) % ANIMALS.length;
    if (ev.key === "ArrowLeft" || ev.key === "ArrowUp") next = (idx - 1 + ANIMALS.length) % ANIMALS.length;
    if (ev.key === "Home") next = 0;
    if (ev.key === "End") next = ANIMALS.length - 1;
    if (next < 0) return;
    ev.preventDefault();
    switchAnimal(ANIMALS[next].id);
    sync();
    pickerButtons[next].focus();
  });

  new ResizeObserver(() => sync(false)).observe(picker);
  return sync;
}

function labelPicker() {
  const names = t("animals");
  pickerButtons.forEach((b, n) => {
    const label = names[b.dataset.value].label;
    b.lastChild.textContent = label;
    b.title = `${label} (${n + 1})`;
  });
}

/* =========================================================================
   Settings mode: settings panel
   ========================================================================= */

const CONTROLS = [
  { section: "sec_saver" },
  { key: "enabled", type: "switch" },
  { key: "idleMinutes", type: "range", min: 1, max: 60, step: 1, fmt: (v) => t("minutes")(v) },
  { type: "note", key: "idleNote" },
  { key: "rotate", type: "range", min: 0, max: 30, step: 1, fmt: (v) => (v ? t("minutes")(v) : t("never")) },
  { key: "random", type: "switch" },
  { type: "action", key: "preview" },
  { section: "sec_clock" },
  { key: "lang", type: "choice", options: ["auto", "fr", "en"] },
  { key: "clock24", type: "switch" },
  { key: "greeting", label: "greeting_on", type: "switch" },
  { key: "name", type: "text" },
  { section: "sec_movement" },
  { key: "density", type: "range", min: 0.2, max: 2.5, step: 0.05, fmt: (v) => v.toFixed(2) },
  { key: "speed", type: "range", min: 0.1, max: 3, step: 0.05, fmt: (v) => v.toFixed(2) },
  { key: "direction", type: "range", min: 0, max: 359, step: 1, tune: true, fmt: (v) => `${v | 0}°` },
  { key: "spread", type: "range", min: 0, max: 1, step: 0.01, tune: true, fmt: (v) => v.toFixed(2) },
  { key: "sway", type: "range", min: 0, max: 1, step: 0.01, fmt: (v) => v.toFixed(2) },
  { section: "sec_look" },
  { key: "size", type: "range", min: 0.5, max: 2.2, step: 0.05, fmt: (v) => v.toFixed(2) },
  { key: "depth", type: "range", min: 0, max: 1, step: 0.01, fmt: (v) => v.toFixed(2) },
  { key: "cell", type: "range", min: 6, max: 16, step: 1, fmt: (v) => `${v | 0}px` },
  { key: "trails", type: "switch" },
  { key: "bokeh", type: "switch" },
];

const LANG_NAMES = { fr: "Français", en: "English" };

let controlEls = {};

function getValue(c) {
  return c.tune ? settings.tune[current][c.key] : settings[c.key];
}

function setValue(c, v) {
  if (c.tune) settings.tune[current][c.key] = v;
  else settings[c.key] = v;
  saveSettings();
  onSettingChanged(c.key);
}

function onSettingChanged(key) {
  if (key === "density" || key === "bokeh") syncPopulation();
  if (key === "cell") resize();
  if (key === "name" || key === "clock24" || key === "greeting") updateClock();
  if (key === "idleMinutes") updateIdleNote();
  if (key === "lang") applyLanguage();
}

function preview() {
  if (HOST) {
    saveSettings(true);
    postToHost({ type: "preview" });
    return;
  }
  saveSettings(true);
  location.search = "?mode=saver";
}

// Builds the panel body. Runs again when the language changes.
function buildTweaks() {
  const body = $("tweaksBody");
  const focusedId = body.contains(document.activeElement) ? document.activeElement.id : "";
  body.replaceChildren();
  controlEls = {};

  for (const c of CONTROLS) {
    if (c.section) {
      const h = document.createElement("div");
      h.className = "tweaks-section";
      h.textContent = t(c.section);
      body.append(h);
      continue;
    }
    const id = `tw-${c.key}`;

    if (c.type === "note") {
      const p = document.createElement("p");
      p.className = "note";
      p.id = id;
      body.append(p);
      controlEls[c.key] = { c, input: p };
      continue;
    }
    if (c.type === "action") {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "action";
      b.id = id;
      b.textContent = t(c.key);
      b.addEventListener("click", preview);
      body.append(b);
      continue;
    }

    const row = document.createElement("div");
    row.className = "control" + (c.type === "switch" ? " switch" : "");
    const text = t(c.label || c.key);
    let label;
    if (c.type === "choice") {
      label = document.createElement("span");
      label.className = "label";
      label.id = `${id}-label`;
    } else {
      label = document.createElement("label");
      label.htmlFor = id;
    }
    label.textContent = text;
    row.append(label);

    if (c.type === "range") {
      const o = document.createElement("output");
      o.htmlFor = id;
      const input = document.createElement("input");
      input.type = "range";
      input.id = id;
      input.min = c.min;
      input.max = c.max;
      input.step = c.step;
      input.addEventListener("input", () => {
        setValue(c, parseFloat(input.value));
        paintRange(c);
      });
      row.append(o, input);
      controlEls[c.key] = { c, input, o };
    } else if (c.type === "switch") {
      const b = document.createElement("button");
      b.type = "button";
      b.id = id;
      b.className = "toggle";
      b.setAttribute("role", "switch");
      b.addEventListener("click", () => {
        setValue(c, !getValue(c));
        paintSwitch(c);
      });
      row.append(b);
      controlEls[c.key] = { c, input: b };
    } else if (c.type === "choice") {
      const group = document.createElement("div");
      group.className = "choice";
      group.setAttribute("role", "radiogroup");
      group.setAttribute("aria-labelledby", label.id);
      for (const opt of c.options) {
        const b = document.createElement("button");
        b.type = "button";
        b.id = `${id}-${opt}`;
        b.dataset.value = opt;
        b.setAttribute("role", "radio");
        b.textContent = opt === "auto" ? t("lang_auto") : LANG_NAMES[opt];
        b.addEventListener("click", () => setValue(c, opt));
        group.append(b);
      }
      row.append(group);
      controlEls[c.key] = { c, input: group };
    } else {
      const input = document.createElement("input");
      input.type = "text";
      input.id = id;
      input.maxLength = 40;
      input.placeholder = t("namePlaceholder");
      input.spellcheck = false;
      input.addEventListener("input", () => setValue(c, input.value));
      row.append(input);
      controlEls[c.key] = { c, input };
    }
    body.append(row);
  }

  syncTweaks();
  if (focusedId && $(focusedId)) $(focusedId).focus();
}

function setupTweaksPanel(syncPicker) {
  const panel = $("tweaks");
  const toggle = $("tweaksToggle");
  const setOpen = (open) => {
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    document.documentElement.classList.toggle("tweaks-open", open);
    if (open) syncTweaks();
    syncPicker(false);
  };
  toggle.addEventListener("click", () => setOpen(panel.hidden));
  $("tweaksClose").addEventListener("click", (ev) => {
    setOpen(false);
    // return focus only for keyboard users, so mouse users don't get a stray focus ring
    if (ev.detail === 0) toggle.focus();
  });
  $("tweaksReset").addEventListener("click", () => {
    const keep = Object.fromEntries(KEEP_ON_RESET.map((k) => [k, settings[k]]));
    settings = { ...structuredClone(DEFAULTS), ...keep };
    saveSettings();
    resize();
    syncPopulation();
    updateClock();
    syncTweaks();
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && !panel.hidden) setOpen(false);
  });
  return setOpen;
}

function paintRange(c) {
  const { input, o } = controlEls[c.key];
  const v = getValue(c);
  input.value = v;
  o.textContent = c.fmt(v);
  input.style.setProperty("--p", `${((v - c.min) / (c.max - c.min)) * 100}%`);
}

function paintSwitch(c) {
  controlEls[c.key].input.setAttribute("aria-checked", String(!!getValue(c)));
}

function paintChoice(c) {
  const v = getValue(c);
  for (const b of controlEls[c.key].input.children) {
    const on = b.dataset.value === v;
    b.setAttribute("aria-checked", String(on));
    b.tabIndex = on ? 0 : -1;
  }
}

function syncTweaks() {
  for (const key in controlEls) {
    const { c, input } = controlEls[key];
    if (c.type === "range") paintRange(c);
    else if (c.type === "switch") paintSwitch(c);
    else if (c.type === "choice") paintChoice(c);
    else if (c.type === "note") updateIdleNote();
    else if (document.activeElement !== input) input.value = getValue(c);
  }
}

// What GNOME does with the screen, so the delay can be set to win the race.
function updateIdleNote() {
  const el = controlEls.idleNote && controlEls.idleNote.input;
  if (!el) return;
  const sys = HOST ? HOST.systemIdleSeconds : null;
  let text = "";
  let warn = false;
  if (sys === 0) {
    text = t("noteNever");
  } else if (typeof sys === "number" && sys > 0) {
    const m = Math.max(1, Math.round(sys / 60));
    warn = settings.idleMinutes >= m;
    text = warn ? t("noteTooLate")(m) : t("noteOk")(m);
  }
  el.textContent = text;
  el.classList.toggle("warn", warn);
}

function applyLanguage() {
  document.documentElement.lang = lang();
  for (const el of document.querySelectorAll("[data-i18n]")) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll("[data-i18n-aria]")) el.setAttribute("aria-label", t(el.dataset.i18nAria));
  if (!IS_SAVER) {
    labelPicker();
    buildTweaks();
    if ($("hint").classList.contains("show")) $("hint").textContent = t("animals")[current].hint;
  }
  clockKey = "";
  updateClock();
}

/* =========================================================================
   Boot
   ========================================================================= */

let hintTimer = 0;
function showHint() {
  if (IS_SAVER) return;
  const el = $("hint");
  el.textContent = t("animals")[current].hint || "";
  el.classList.add("show");
  clearTimeout(hintTimer);
  hintTimer = setTimeout(hideHint, 3800);
}

function hideHint() {
  $("hint").classList.remove("show");
}

function isTyping(el) {
  return el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
}

function setupSettingsMode() {
  const syncPicker = setupPicker();
  const setOpen = setupTweaksPanel(syncPicker);
  applyLanguage();
  setOpen(true);
  showHint();

  // clicks on empty space feed or startle the animals, like in the extension
  window.addEventListener("pointerdown", (ev) => {
    if (ev.button !== 0 || !ev.isPrimary) return;
    if (ev.target.closest(".glass, .tweaks, a, button, input, label")) return;
    if (document.activeElement && isTyping(document.activeElement)) document.activeElement.blur();
    tap(ev.clientX * R.dpr, ev.clientY * R.dpr);
  });

  window.addEventListener("pointermove", (ev) => {
    pointer.x = ev.clientX * R.dpr;
    pointer.y = ev.clientY * R.dpr;
    pointer.active = true;
  });
  document.addEventListener("pointerleave", () => (pointer.active = false));
  window.addEventListener("blur", () => (pointer.active = false));

  document.addEventListener("keydown", (ev) => {
    if (isTyping(document.activeElement) || ev.metaKey || ev.ctrlKey || ev.altKey) return;
    const n = parseInt(ev.key, 10);
    if (n >= 1 && n <= ANIMALS.length) {
      switchAnimal(ANIMALS[n - 1].id);
      syncPicker();
    }
  });
}

async function boot() {
  loadSettings();
  try {
    await Promise.all([document.fonts.load('600 12px "Geist Mono"'), document.fonts.load('300 16px "Geist"')]);
  } catch {
    /* fall back to system fonts */
  }

  let order = null;
  if (IS_SAVER) {
    const seed = HOST && Number.isInteger(HOST.seed) ? HOST.seed : (Math.random() * 2 ** 31) | 0;
    order = animalOrder(seed, readLastShown());
    current = order[0];
  } else {
    current = settings.animal;
  }

  resize();
  syncPopulation(true);

  if (IS_SAVER) {
    applyLanguage();
    startRotation(order);
    if (!HOST) exitOnInput(() => (location.search = ""));
  } else {
    setupSettingsMode();
  }
  setInterval(updateClock, 1000);

  window.addEventListener("resize", () => {
    resize();
    syncPopulation();
  });

  requestAnimationFrame(frame);
}

boot();
