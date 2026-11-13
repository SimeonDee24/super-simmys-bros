// Paper-doll renderer. Draws a character from its separate pixel-art parts:
// each part is rotated around its pivot with nearest-neighbour sampling (so
// pixels stay crisp), snapped to the pixel grid, layered, and then the whole
// figure gets a dark outline. Rendering only: nothing here feeds the simulation.
import { samplePose, solve } from '../engine/skeleton.js';
import { toPx } from '../engine/fixed.js';

const SIZE = 128, OX = 64, OY = 96; // work canvas; feet sit at (OX, OY)

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export class DollRenderer {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = SIZE; this.canvas.height = SIZE;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.cache = new Map();
  }

  // A part image rotated by `deg`, in the given palette. Cached.
  sprite(ch, altIndex, back, partName, deg) {
    deg = ((Math.round(deg) % 360) + 360) % 360;
    const key = ch.id + '|' + altIndex + '|' + (back ? 1 : 0) + '|' + partName + '|' + deg;
    let s = this.cache.get(key);
    if (s) return s;
    const part = ch.parts[partName];
    const colors = ch.palettes[altIndex].colors;
    const rows = part.px, h = rows.length, w = rows[0].length;
    const [pvx, pvy] = part.pivot;
    let R = 0;
    for (const cx of [0, w - 1]) for (const cy of [0, h - 1]) R = Math.max(R, Math.hypot(cx - pvx, cy - pvy));
    R = Math.ceil(R) + 1;
    const size = 2 * R + 1;
    const cv = document.createElement('canvas');
    cv.width = size; cv.height = size;
    const cx = cv.getContext('2d');
    const img = cx.createImageData(size, size);
    const a = (deg * Math.PI) / 180, c = Math.cos(a), sn = Math.sin(a);
    const shade = back ? 0.82 : 1; // far-side limbs are drawn darker
    for (let v = 0; v < size; v++) {
      for (let u = 0; u < size; u++) {
        const X = u - R, Y = v - R;
        const sx = Math.round(X * c - Y * sn) + pvx;
        const sy = Math.round(X * sn + Y * c) + pvy;
        if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
        const ch2 = rows[sy][sx];
        if (ch2 === '.') continue;
        const rgb = hexToRgb(colors[ch2] || '#ff00ff');
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
    const s = this.sprite(ch, altIndex, back, partName, deg);
    this.ctx.drawImage(s.canvas, OX + toPx(pos[0]) - s.R, OY + toPx(pos[1]) - s.R);
  }

  // Draw a posed character with its feet at (x, y) on the destination context.
  // opts: { flash: css colour to tint the whole figure, alpha }
  draw(dest, ch, altIndex, poseObj, x, y, facing, opts = {}) {
    const s = solve(ch.skeleton, poseObj);
    const ctx = this.ctx;
    ctx.clearRect(0, 0, SIZE, SIZE);
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

    // Outline: every empty pixel touching a filled one becomes the outline colour.
    const img = ctx.getImageData(0, 0, SIZE, SIZE);
    const d = img.data;
    const ol = hexToRgb(ch.outline);
    const solid = new Uint8Array(SIZE * SIZE);
    for (let i = 0; i < SIZE * SIZE; i++) solid[i] = d[i * 4 + 3] > 0 ? 1 : 0;
    const tint = opts.flash ? hexToRgb(opts.flash) : null;
    for (let py = 1; py < SIZE - 1; py++) {
      for (let pxx = 1; pxx < SIZE - 1; pxx++) {
        const i = py * SIZE + pxx, o = i * 4;
        if (solid[i]) {
          if (tint) { d[o] = (d[o] + tint[0]) >> 1; d[o + 1] = (d[o + 1] + tint[1]) >> 1; d[o + 2] = (d[o + 2] + tint[2]) >> 1; }
        } else if (solid[i - 1] || solid[i + 1] || solid[i - SIZE] || solid[i + SIZE]) {
          d[o] = ol[0]; d[o + 1] = ol[1]; d[o + 2] = ol[2]; d[o + 3] = 255;
        }
      }
    }
    ctx.putImageData(img, 0, 0);

    dest.save();
    if (opts.alpha !== undefined) dest.globalAlpha = opts.alpha;
    if (facing >= 0) dest.drawImage(this.canvas, x - OX, y - OY);
    else { dest.scale(-1, 1); dest.drawImage(this.canvas, -x - OX - 1, y - OY); }
    dest.restore();
  }

  drawAnim(dest, ch, altIndex, animName, frame, x, y, facing, opts) {
    const a = ch.animations[animName] || ch.animations.idle;
    this.draw(dest, ch, altIndex, samplePose(a, frame), x, y, facing, opts);
  }
}
