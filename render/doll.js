// Paper-doll renderer, smooth version. The character is drawn from its
// skeleton as shaded vector shapes (rounded limbs, a lit head, hair, shoes)
// in the colours of its palette, with light coming from the upper left.
// It is drawn into a high-resolution work canvas first, so the whole figure
// can be tinted or faded as one, then copied to the screen.
// Rendering only: nothing here feeds the simulation.
import { samplePose, solve } from '../engine/skeleton.js';

const SIZE = 128, OX = 64, OY = 96;   // work area in world pixels; feet sit at (OX, OY)
const RES = 6;                        // work canvas pixels per world pixel
const FXS = 1 / 256;
const LX = -0.38, LY = -0.42;         // highlight offset: light from the upper left

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function scaleHex(hex, k) {
  const [r, g, b] = hexToRgb(hex);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

export class DollRenderer {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = SIZE * RES; this.canvas.height = SIZE * RES;
    this.ctx = this.canvas.getContext('2d');
    this.pals = new Map();
  }

  // Palette colours, plus a darker copy for the far-side limbs.
  colors(ch, altIndex, back) {
    const key = ch.id + '|' + altIndex + '|' + (back ? 1 : 0);
    let c = this.pals.get(key);
    if (!c) {
      const src = ch.palettes[altIndex].colors;
      c = {};
      for (const k of Object.keys(src)) c[k] = back ? scaleHex(src[k], 0.8) : src[k];
      c.outline = ch.outline;
      this.pals.set(key, c);
    }
    return c;
  }

  // A rounded line with a shadow side and a highlight streak: reads as a lit tube.
  tube(ctx, pts, r, dark, base, light) {
    const path = (dx, dy) => {
      ctx.beginPath();
      ctx.moveTo(pts[0][0] + dx, pts[0][1] + dy);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] + dx, pts[i][1] + dy);
      ctx.stroke();
    };
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = dark; ctx.lineWidth = r * 2; path(0, 0);
    ctx.strokeStyle = base; ctx.lineWidth = r * 2 - 0.9; path(LX, LY);
    ctx.strokeStyle = light; ctx.lineWidth = r * 0.55; ctx.globalAlpha = 0.75; path(LX * 1.9, LY * 1.9);
    ctx.globalAlpha = 1;
  }
  outlineTube(ctx, pts, r, col) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = col; ctx.lineWidth = r * 2 + 0.8;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
  }

  arm(ctx, l, hand, c) {
    const A = [l.a[0] * FXS, l.a[1] * FXS], B = [l.b[0] * FXS, l.b[1] * FXS], C = [l.c[0] * FXS, l.c[1] * FXS];
    // sleeve ends a little under halfway down the upper arm
    const S = [A[0] + (B[0] - A[0]) * 0.5, A[1] + (B[1] - A[1]) * 0.5];
    const len = Math.hypot(C[0] - B[0], C[1] - B[1]) || 1;
    const ux = (C[0] - B[0]) / len, uy = (C[1] - B[1]) / len;
    const fist = hand === 'fist';
    const H = [C[0] + ux * (fist ? 1.1 : 1.7), C[1] + uy * (fist ? 1.1 : 1.7)];
    const hr = fist ? 1.9 : 1.45;
    this.outlineTube(ctx, [A, B, C], 1.55, c.outline);
    this.outlineTube(ctx, fist ? [H, H] : [C, H], hr, c.outline);
    this.tube(ctx, [S, B, C], 1.4, c.K, c.k, c.l);
    this.tube(ctx, [A, S], 1.7, c.T, c.t, c.u);
    this.tube(ctx, fist ? [H, H] : [C, H], hr, c.K, c.k, c.l);
  }

  leg(ctx, l, footDeg, c) {
    const A = [l.a[0] * FXS, l.a[1] * FXS], B = [l.b[0] * FXS, l.b[1] * FXS], C = [l.c[0] * FXS, l.c[1] * FXS];
    this.outlineTube(ctx, [A, B, C], 2.0, c.outline);
    // sneaker: drawn pointing right, turned by the foot angle (positive = toes up)
    const shoe = (grow, fill) => {
      ctx.beginPath();
      ctx.moveTo(-1.7 - grow, 1.9 + grow);
      ctx.lineTo(-1.7 - grow, -0.6);
      ctx.quadraticCurveTo(-1.6 - grow, -1.9 - grow, 0.2, -1.7 - grow);
      ctx.quadraticCurveTo(2.2, -1.4 - grow, 3.6, 0.0 - grow);
      ctx.quadraticCurveTo(5.3 + grow, 0.6 - grow, 5.1 + grow, 1.9 + grow);
      ctx.closePath();
      ctx.fillStyle = fill; ctx.fill();
    };
    this.tube(ctx, [A, B], 2.05, c.J, c.j, c.i);
    this.tube(ctx, [B, C], 1.75, c.J, c.j, c.i);
    ctx.save();
    ctx.translate(C[0], C[1]);
    ctx.rotate((-footDeg * Math.PI) / 180);
    shoe(0.4, c.outline);
    shoe(0, c.w);
    // sole, toe shine, coloured stripe and heel tab
    ctx.fillStyle = c.W; ctx.fillRect(-1.7, 1.25, 6.8, 0.65);
    ctx.fillStyle = c.g;
    ctx.beginPath(); ctx.moveTo(0.9, -1.2); ctx.lineTo(1.9, -1.0); ctx.lineTo(1.3, 1.2); ctx.lineTo(0.3, 1.2); ctx.closePath(); ctx.fill();
    ctx.fillRect(-1.7, -0.9, 0.8, 1.3);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath(); ctx.ellipse(3.3, 0.35, 0.9, 0.35, 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  torso(ctx, s, c) {
    const H = [s.hip[0] * FXS, s.hip[1] * FXS], N = [s.neck[0] * FXS, s.neck[1] * FXS];
    const dx = N[0] - H[0], dy = N[1] - H[1], len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;           // along the spine, hip to neck
    const at = (t) => [H[0] + dx * t, H[1] + dy * t];
    const waist = at(0.06), belt = at(0.2), chest = at(0.74), top = at(0.86);
    this.outlineTube(ctx, [waist, chest], 3.0, c.outline);
    this.outlineTube(ctx, [chest, top], 3.3, c.outline);
    // jeans at the hips, shirt above, a little wider at the chest and shoulders
    this.tube(ctx, [waist, belt], 2.85, c.J, c.j, c.i);
    this.tube(ctx, [belt, chest], 2.9, c.T, c.t, c.u);
    this.tube(ctx, [chest, top], 3.2, c.T, c.t, c.u);
    // neck
    const nk = [N[0] + ux * 1.6, N[1] + uy * 1.6];
    this.outlineTube(ctx, [top, nk], 1.35, c.outline);
    this.tube(ctx, [top, nk], 1.3, c.K, c.k, c.l);
    // collar and chain
    const px = -uy, py = ux;                      // across the body
    const cb = at(0.97);
    ctx.strokeStyle = c.T; ctx.lineWidth = 0.9; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cb[0] - px * 1.9, cb[1] - py * 1.9);
    ctx.quadraticCurveTo(cb[0] - ux * 1.3, cb[1] - uy * 1.3, cb[0] + px * 1.9, cb[1] + py * 1.9); ctx.stroke();
    ctx.strokeStyle = c.c; ctx.lineWidth = 0.55;
    ctx.beginPath(); ctx.moveTo(cb[0] - px * 1.5, cb[1] - py * 1.5);
    ctx.quadraticCurveTo(cb[0] - ux * 3.4, cb[1] - uy * 3.4, cb[0] + px * 1.5, cb[1] + py * 1.5); ctx.stroke();
  }

  // Head centred on (0, 0) facing right, in head-local coordinates.
  headShape(ctx, face, c) {
    const R = 3.75;
    ctx.fillStyle = c.outline;
    ctx.beginPath(); ctx.arc(0, 0, R + 0.4, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createRadialGradient(-1.3, -1.5, 0.4, 0, 0, R + 0.4);
    g.addColorStop(0, c.l); g.addColorStop(0.5, c.k); g.addColorStop(1, c.K);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
    // ear and nose
    ctx.fillStyle = c.K; ctx.beginPath(); ctx.ellipse(-0.9, 0.5, 0.75, 1.05, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = c.k; ctx.beginPath(); ctx.ellipse(3.75, 0.75, 0.8, 0.65, 0, 0, Math.PI * 2); ctx.fill();
    // eye and brow
    ctx.strokeStyle = c.e; ctx.fillStyle = c.e; ctx.lineCap = 'round';
    if (face === 'hurt') {
      ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(1.3, -0.6); ctx.lineTo(2.3, -0.1); ctx.lineTo(1.3, 0.4); ctx.stroke();
    } else {
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(1.95, -0.15, 0.85, 0.95, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = c.e; ctx.beginPath(); ctx.ellipse(2.2, -0.1, 0.5, 0.7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 0.55;
      ctx.beginPath();
      if (face === 'yell') { ctx.moveTo(1.0, -1.7); ctx.lineTo(3.0, -1.05); }
      else { ctx.moveTo(1.1, -1.45); ctx.lineTo(3.0, -1.35); }
      ctx.stroke();
    }
    // mouth
    if (face === 'yell') {
      ctx.fillStyle = c.r; ctx.beginPath(); ctx.ellipse(2.2, 2.05, 0.95, 0.85, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = c.m; ctx.fillRect(1.6, 1.3, 1.3, 0.35);
    } else if (face === 'smile') {
      ctx.fillStyle = c.m; ctx.beginPath(); ctx.moveTo(1.2, 1.7); ctx.quadraticCurveTo(2.3, 3.0, 3.3, 1.6); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = c.r; ctx.lineWidth = 0.3; ctx.stroke();
    } else if (face === 'hurt') {
      ctx.strokeStyle = c.r; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(1.5, 2.4); ctx.quadraticCurveTo(2.3, 1.7, 3.1, 2.3); ctx.stroke();
    } else {
      ctx.strokeStyle = c.r; ctx.lineWidth = 0.45;
      ctx.beginPath(); ctx.moveTo(1.7, 2.1); ctx.lineTo(3.0, 2.0); ctx.stroke();
    }
    // hair: a cap over the top and back with a swept-up front
    const hair = (grow, fill) => {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(3.3 + grow, -1.9);
      ctx.quadraticCurveTo(4.6 + grow, -4.6 - grow, 2.0, -5.0 - grow);       // quiff
      ctx.quadraticCurveTo(-1.6, -6.2 - grow, -3.9 - grow, -3.4);            // top
      ctx.quadraticCurveTo(-5.3 - grow, -0.6, -3.7 - grow, 2.3 + grow);      // back of the head
      ctx.quadraticCurveTo(-2.6, 2.2, -2.1, 0.6);                            // nape, behind the ear
      ctx.quadraticCurveTo(-1.9, -0.9, -0.4, -1.2);                          // over the ear
      ctx.quadraticCurveTo(0.2, -2.3, 2.0, -2.4);                            // hairline
      ctx.closePath(); ctx.fill();
    };
    hair(0.4, c.outline);
    hair(0, c.h);
    ctx.strokeStyle = c.H; ctx.lineWidth = 0.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-2.9, -3.3); ctx.quadraticCurveTo(-0.6, -5.1, 2.3, -4.2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-3.6, -1.2); ctx.quadraticCurveTo(-2.6, -3.0, -0.8, -3.5); ctx.stroke();
  }

  head(ctx, s, c) {
    const a = (s.head * Math.PI) / 180;
    ctx.save();
    ctx.translate(s.neck[0] * FXS + Math.sin(a) * 3.3, s.neck[1] * FXS - Math.cos(a) * 3.3);
    ctx.rotate(a);
    this.headShape(ctx, s.face, c);
    ctx.restore();
  }

  // Draw a posed character with its feet at (x, y) on the destination context
  // (in world pixels; the destination's own transform decides the real size).
  // opts: { flash: css colour to tint the whole figure, alpha }
  draw(dest, ch, altIndex, poseObj, x, y, facing, opts = {}) {
    const s = solve(ch.skeleton, poseObj);
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, SIZE * RES, SIZE * RES);
    ctx.setTransform(RES, 0, 0, RES, OX * RES, OY * RES);
    const front = this.colors(ch, altIndex, false), back = this.colors(ch, altIndex, true);
    this.arm(ctx, s.armB, s.handB, back);
    this.leg(ctx, s.legB, s.footB, back);
    this.leg(ctx, s.legF, s.footF, front);
    this.torso(ctx, s, front);
    this.head(ctx, s, front);
    this.arm(ctx, s.armF, s.handF, front);
    if (opts.flash) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'source-atop';
      ctx.globalAlpha = 0.55; ctx.fillStyle = opts.flash;
      ctx.fillRect(0, 0, SIZE * RES, SIZE * RES);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    dest.save();
    dest.imageSmoothingEnabled = true;
    dest.imageSmoothingQuality = 'high';
    if (opts.alpha !== undefined) dest.globalAlpha = opts.alpha;
    if (facing >= 0) dest.drawImage(this.canvas, x - OX, y - OY, SIZE, SIZE);
    else { dest.scale(-1, 1); dest.drawImage(this.canvas, -x - OX, y - OY, SIZE, SIZE); }
    dest.restore();
  }

  drawAnim(dest, ch, altIndex, animName, frame, x, y, facing, opts) {
    const a = ch.animations[animName] || ch.animations.idle;
    this.draw(dest, ch, altIndex, samplePose(a, frame), x, y, facing, opts);
  }

  // Just the head, centred on (x, y), `size` world pixels across. For stock icons.
  drawHead(dest, ch, altIndex, x, y, size, face = 'neutral') {
    dest.save();
    dest.translate(x, y);
    dest.scale(size / 10, size / 10);
    dest.translate(0.3, 0.9);
    this.headShape(dest, face, this.colors(ch, altIndex, false));
    dest.restore();
  }
}
