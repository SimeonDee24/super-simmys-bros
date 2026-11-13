// Paper-doll renderer for pixel-art characters. Each body part is a small
// pixel grid. It is rotated around its pivot using the RotSprite trick
// (enlarge the art 8x with an edge-preserving filter, rotate, then sample
// back down), which keeps lines clean instead of jagged. The parts are layered
// back to front, then the whole figure gets a dark 1-pixel outline.
// Characters are drawn at `artScale` art pixels per world pixel (2 = twice
// the detail of the collision size). Rendering only: nothing here feeds the
// simulation.
import { samplePose, solve } from '../engine/skeleton.js';

const SIZE = 128, OX = 64, OY = 96;   // work area in world pixels; feet sit at (OX, OY)
const UP = 8;                         // RotSprite enlargement

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Scale2x on a grid of letters: doubles it, rounding staircase edges.
function scale2x(g) {
  const h = g.length, w = g[0].length, out = [];
  for (let y = 0; y < h; y++) {
    const r0 = [], r1 = [];
    for (let x = 0; x < w; x++) {
      const P = g[y][x];
      const A = y > 0 ? g[y - 1][x] : P, D = y < h - 1 ? g[y + 1][x] : P;
      const C = x > 0 ? g[y][x - 1] : P, B = x < w - 1 ? g[y][x + 1] : P;
      r0.push(C === A && C !== D && A !== B ? A : P, A === B && A !== C && B !== D ? B : P);
      r1.push(D === C && D !== B && C !== A ? C : P, B === D && B !== A && D !== C ? D : P);
    }
    out.push(r0, r1);
  }
  return out;
}

export class DollRenderer {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.k = 0;
    this.cache = new Map();
    this.big = new Map();
    this.heads = new Map();
  }

  // Work canvas sized for this character's art scale.
  setScale(k) {
    if (this.k === k) return;
    this.k = k;
    this.canvas.width = SIZE * k; this.canvas.height = SIZE * k;
  }

  // A part's grid enlarged 8x (cached per part).
  enlarged(ch, partName) {
    const key = ch.id + '|' + partName;
    let g = this.big.get(key);
    if (!g) {
      const rows = ch.parts[partName].px;
      const w = Math.max(...rows.map((r) => r.length));
      g = rows.map((r) => r.padEnd(w, '.').split(''));
      for (let s = UP; s > 1; s >>= 1) g = scale2x(g);
      this.big.set(key, g);
    }
    return g;
  }

  // A part image rotated by `deg`, in the given palette. Cached.
  sprite(ch, altIndex, back, partName, deg) {
    deg = ((Math.round(deg) % 360) + 360) % 360;
    const key = ch.id + '|' + altIndex + '|' + (back ? 1 : 0) + '|' + partName + '|' + deg;
    let s = this.cache.get(key);
    if (s) return s;
    const part = ch.parts[partName];
    const colors = ch.palettes[altIndex].colors;
    const g = this.enlarged(ch, partName);
    const h = g.length / UP, w = g[0].length / UP;
    const [pvx, pvy] = part.pivot;
    let R = 0;
    for (const cx of [0, w]) for (const cy of [0, h]) R = Math.max(R, Math.hypot(cx - pvx, cy - pvy));
    R = Math.ceil(R) + 1;
    const size = 2 * R + 1;
    const cv = document.createElement('canvas');
    cv.width = size; cv.height = size;
    const cx = cv.getContext('2d');
    const img = cx.createImageData(size, size);
    const a = (deg * Math.PI) / 180, c = Math.cos(a), sn = Math.sin(a);
    const shade = back ? 0.8 : 1; // far-side limbs are drawn darker
    const rgbCache = {};
    for (let v = 0; v < size; v++) {
      for (let u = 0; u < size; u++) {
        // centre of the output pixel, relative to the pivot, turned back into the part
        const X = u - R, Y = v - R;
        const sx = Math.floor((X * c - Y * sn + pvx + 0.5) * UP), sy = Math.floor((X * sn + Y * c + pvy + 0.5) * UP);
        if (sx < 0 || sy < 0 || sx >= w * UP || sy >= h * UP) continue;
        const ch2 = g[sy][sx];
        if (ch2 === '.') continue;
        const rgb = rgbCache[ch2] || (rgbCache[ch2] = hexToRgb(colors[ch2] || '#ff00ff'));
        const o = (v * size + u) * 4;
        img.data[o] = rgb[0] * shade; img.data[o + 1] = rgb[1] * shade; img.data[o + 2] = rgb[2] * shade; img.data[o + 3] = 255;
      }
    }
    cx.putImageData(img, 0, 0);
    s = { canvas: cv, R };
    this.cache.set(key, s);
    return s;
  }

  put(ch, altIndex, back, partName, deg, pos) {
    const k = this.k, s = this.sprite(ch, altIndex, back, partName, deg);
    // world fixed-point position -> art pixels
    this.ctx.drawImage(s.canvas, OX * k + Math.round((pos[0] * k) / 256) - s.R, OY * k + Math.round((pos[1] * k) / 256) - s.R);
  }

  // Outline every empty pixel that touches a filled one, and tint if asked.
  outline(ctx, size, col, flash) {
    const img = ctx.getImageData(0, 0, size, size);
    const d = img.data;
    const ol = hexToRgb(col);
    const solid = new Uint8Array(size * size);
    for (let i = 0; i < size * size; i++) solid[i] = d[i * 4 + 3] > 0 ? 1 : 0;
    const tint = flash ? hexToRgb(flash) : null;
    for (let py = 1; py < size - 1; py++) {
      for (let px = 1; px < size - 1; px++) {
        const i = py * size + px, o = i * 4;
        if (solid[i]) {
          if (tint) { d[o] = (d[o] + tint[0] * 1.4) / 2.4; d[o + 1] = (d[o + 1] + tint[1] * 1.4) / 2.4; d[o + 2] = (d[o + 2] + tint[2] * 1.4) / 2.4; }
        } else if (solid[i - 1] || solid[i + 1] || solid[i - size] || solid[i + size]) {
          d[o] = ol[0]; d[o + 1] = ol[1]; d[o + 2] = ol[2]; d[o + 3] = 255;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  // Draw a posed character with its feet at (x, y) on the destination context
  // (in world pixels; the destination's own transform decides the real size).
  // opts: { flash: css colour to tint the whole figure, alpha }
  draw(dest, ch, altIndex, poseObj, x, y, facing, opts = {}) {
    this.setScale(ch.artScale || 1);
    const s = solve(ch.skeleton, poseObj);
    const ctx = this.ctx, k = this.k;
    ctx.clearRect(0, 0, SIZE * k, SIZE * k);
    const limb = (l, back, upper, lower, end, endDeg) => {
      this.put(ch, altIndex, back, upper, l.up, l.a);
      this.put(ch, altIndex, back, lower, l.low, l.b);
      this.put(ch, altIndex, back, end, endDeg, l.c);
    };
    limb(s.armB, true, 'upperArm', 'lowerArm', 'hand_' + s.handB, s.armB.low);
    limb(s.legB, true, 'upperLeg', 'lowerLeg', 'foot', s.footB);
    limb(s.legF, false, 'upperLeg', 'lowerLeg', 'foot', s.footF);
    this.put(ch, altIndex, false, 'torso', -s.torso, s.hip);
    this.put(ch, altIndex, false, 'head_' + s.face, -s.head, s.neck);
    this.put(ch, altIndex, false, 'hair', -s.head, s.neck);
    limb(s.armF, false, 'upperArm', 'lowerArm', 'hand_' + s.handF, s.armF.low);
    this.outline(ctx, SIZE * k, ch.outline, opts.flash);

    dest.save();
    dest.imageSmoothingEnabled = false;
    if (opts.alpha !== undefined) dest.globalAlpha = opts.alpha;
    if (facing >= 0) dest.drawImage(this.canvas, x - OX, y - OY, SIZE, SIZE);
    else { dest.scale(-1, 1); dest.drawImage(this.canvas, -x - OX, y - OY, SIZE, SIZE); }
    dest.restore();
  }

  drawAnim(dest, ch, altIndex, animName, frame, x, y, facing, opts) {
    const a = ch.animations[animName] || ch.animations.idle;
    this.draw(dest, ch, altIndex, samplePose(a, frame), x, y, facing, opts);
  }

  // Just the head and hair, centred on (x, y), `size` world pixels across.
  // For stock icons.
  drawHead(dest, ch, altIndex, x, y, size, face = 'neutral') {
    const key = ch.id + '|' + altIndex + '|' + face;
    let c = this.heads.get(key);
    if (!c) {
      const N = 24;
      c = document.createElement('canvas'); c.width = N; c.height = N;
      const cx = c.getContext('2d');
      const neck = [11, 20];   // where the neck point goes on the icon
      for (const part of ['head_' + face, 'hair']) {
        const s = this.sprite(ch, altIndex, false, part, 0);
        cx.drawImage(s.canvas, neck[0] - s.R, neck[1] - s.R);
      }
      this.outline(cx, N, ch.outline, null);
      this.heads.set(key, c);
    }
    const w = size * 1.45;
    dest.save();
    dest.imageSmoothingEnabled = false;
    dest.drawImage(c, x - w / 2, y - w * 0.52, w, w);
    dest.restore();
  }
}
