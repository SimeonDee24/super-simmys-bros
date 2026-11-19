// 3D character models. A fighter that has a model here is drawn in 3D instead
// of as a pixel paper doll: the same 2D animation pose (engine/skeleton.js)
// drives the model's joints, so moves, hurtboxes and timing are unchanged.
// The model is rendered with WebGL into a work canvas (low-poly, two-band
// toon shading, a dark outline like the sprites), then copied into the game
// canvas exactly where the doll would have gone. Rendering only.
import { solve } from '../engine/skeleton.js';
import { FX } from '../engine/fixed.js';
import { SIMEON_MODEL } from './simeon3d.js';

const MODELS = { simeon: SIMEON_MODEL };

const SIZE = 128, OX = 64, OY = 96;   // same work area as the doll: feet at (OX, OY), in world pixels
const RES = 5;                        // canvas pixels per world pixel
const YAW = 20, PITCH = 9;            // camera: turned a little toward his front, and a little from above
const D = Math.PI / 180;

// ---- matrix maths (column-major 4x4) ----
export const M = {
  id: () => [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1],
  mul(a, b) { const o = new Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k*4+r] * b[c*4+k]; o[c*4+r] = s; } return o; },
  t: (x, y, z) => [1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1],
  s: (x, y, z) => [x,0,0,0, 0,y,0,0, 0,0,z,0, 0,0,0,1],
  rx(a) { const c = Math.cos(a), s = Math.sin(a); return [1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]; },
  ry(a) { const c = Math.cos(a), s = Math.sin(a); return [c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]; },
  rz(a) { const c = Math.cos(a), s = Math.sin(a); return [c,s,0,0, -s,c,0,0, 0,0,1,0, 0,0,0,1]; },
  ortho(l, r, b, t, n, f) { return [2/(r-l),0,0,0, 0,2/(t-b),0,0, 0,0,-2/(f-n),0, -(r+l)/(r-l),-(t+b)/(t-b),-(f+n)/(f-n),1]; },
};

// ---- triangle soup builders. A shape is a list of [a, b, c] corners. ----
export const SHAPES = {
  // box w (x) by h (y, upward from 0) by d (z); the top can be narrower
  box(w, h, d, topW = w, topD = d) {
    const b = [[-w/2,0,-d/2],[w/2,0,-d/2],[w/2,0,d/2],[-w/2,0,d/2]], t = [[-topW/2,h,-topD/2],[topW/2,h,-topD/2],[topW/2,h,topD/2],[-topW/2,h,topD/2]];
    const q = (a, b2, c, e) => [[a, b2, c], [a, c, e]];
    return [...q(b[0],b[1],b[2],b[3]), ...q(t[3],t[2],t[1],t[0]), ...q(b[0],t[0],t[1],b[1]), ...q(b[1],t[1],t[2],b[2]), ...q(b[2],t[2],t[3],b[3]), ...q(b[3],t[3],t[0],b[0])];
  },
  // cylinder along +y (radius r0 at the bottom, r1 at the top), rounded ends
  tube(len, r0, r1, seg = 8, cap = true) {
    const tris = [], ring = (y, r) => Array.from({ length: seg }, (_, i) => { const a = i / seg * Math.PI * 2; return [Math.cos(a) * r, y, Math.sin(a) * r]; });
    const rings = [ring(0, r0), ring(len, r1)];
    if (cap) { rings.unshift(ring(-r0 * 0.55, r0 * 0.7)); rings.push(ring(len + r1 * 0.55, r1 * 0.7)); }
    for (let k = 0; k < rings.length - 1; k++) for (let i = 0; i < seg; i++) { const j = (i + 1) % seg, A = rings[k], B = rings[k + 1]; tris.push([A[i], B[i], B[j]], [A[i], B[j], A[j]]); }
    const lo = cap ? [0, -r0 * 0.9, 0] : [0, 0, 0], hi = cap ? [0, len + r1 * 0.9, 0] : [0, len, 0], f = rings[0], l = rings[rings.length - 1];
    for (let i = 0; i < seg; i++) { const j = (i + 1) % seg; tris.push([lo, f[j], f[i]], [hi, l[i], l[j]]); }
    return tris;
  },
  ball(r, sx = 1, sy = 1, sz = 1, seg = 10, rows = 7) {
    const p = (i, j) => { const th = j / rows * Math.PI, ph = i / seg * Math.PI * 2; return [Math.sin(th) * Math.cos(ph) * r * sx, Math.cos(th) * r * sy, Math.sin(th) * Math.sin(ph) * r * sz]; };
    const tris = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i < seg; i++) { const a = p(i, j), b = p(i + 1, j), c = p(i + 1, j + 1), d = p(i, j + 1); if (j > 0) tris.push([a, b, c]); if (j < rows - 1) tris.push([a, c, d]); }
    return tris;
  },
  torus(R, r, seg = 18, side = 5) {
    const p = (i, j) => { const a = i / seg * Math.PI * 2, b = j / side * Math.PI * 2; return [(R + r * Math.cos(b)) * Math.cos(a), r * Math.sin(b), (R + r * Math.cos(b)) * Math.sin(a)]; };
    const tris = [];
    for (let i = 0; i < seg; i++) for (let j = 0; j < side; j++) { const a = p(i, j), b = p(i + 1, j), c = p(i + 1, j + 1), d = p(i, j + 1); tris.push([a, b, c], [a, c, d]); }
    return tris;
  },
  // move a shape by a matrix
  moved(tris, m) { return tris.map((t) => t.map(([x, y, z]) => [m[0]*x+m[4]*y+m[8]*z+m[12], m[1]*x+m[5]*y+m[9]*z+m[13], m[2]*x+m[6]*y+m[10]*z+m[14]])); },
};

const VS = `
attribute vec3 aPos; attribute vec3 aNor; attribute vec3 aSmo;
uniform mat4 uModel, uView, uProj; uniform float uGrow;
varying vec3 vN;
void main() {
  vec4 w = uModel * vec4(aPos, 1.0);
  w.xyz += normalize(mat3(uModel) * aSmo) * uGrow;
  vN = normalize(mat3(uView) * mat3(uModel) * aNor);
  gl_Position = uProj * uView * w;
}`;
const FS = `
precision mediump float;
uniform vec3 uColor; uniform vec4 uTint; uniform float uFlat;
varying vec3 vN;
void main() {
  vec3 col = uColor;
  if (uFlat < 0.5) {
    vec3 n = normalize(vN);
    float d = dot(n, normalize(vec3(0.35, 0.85, 0.6)));
    float band = d > 0.3 ? 1.0 : d > -0.2 ? 0.8 : 0.64;
    float rim = pow(1.0 - max(n.z, 0.0), 3.0) * 0.3 * step(0.0, -n.x * 0.6 + n.y * 0.4 + 0.2);
    col = col * band + vec3(0.62, 0.75, 1.0) * rim;
    col = mix(col, uTint.rgb, uTint.a);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

export class ModelRenderer {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = SIZE * RES; this.canvas.height = SIZE * RES;
    let gl = null;
    try { gl = this.canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: true, preserveDrawingBuffer: true }); } catch (e) { gl = null; }
    this.gl = gl;
    this.enabled = true;
    this.models = new Map();
    this.colors = new Map();
    if (!gl) return;
    try { this.setup(); } catch (e) { console.warn('3D models off:', e); this.gl = null; }
  }

  setup() {
    const gl = this.gl;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    this.A = { pos: gl.getAttribLocation(prog, 'aPos'), nor: gl.getAttribLocation(prog, 'aNor'), smo: gl.getAttribLocation(prog, 'aSmo') };
    this.U = {}; for (const n of ['uModel', 'uView', 'uProj', 'uGrow', 'uColor', 'uTint', 'uFlat']) this.U[n] = gl.getUniformLocation(prog, n);
    for (const k in this.A) gl.enableVertexAttribArray(this.A[k]);
    gl.uniformMatrix4fv(this.U.uProj, false, M.ortho(-OX, SIZE - OX, -(SIZE - OY), OY, -80, 80));
  }

  // Can this character be drawn in 3D right now?
  has(id) { return !!(this.gl && this.enabled && MODELS[id]); }

  // Upload a shape: flat normals for shading, smoothed ones to push the outline out.
  mesh(tris) {
    const gl = this.gl, pos = [], nor = [], smo = [], acc = new Map(), key = (p) => p.map((v) => v.toFixed(3)).join(',');
    for (const [a, b, c] of tris) {
      const u = [b[0]-a[0], b[1]-a[1], b[2]-a[2]], v = [c[0]-a[0], c[1]-a[1], c[2]-a[2]];
      let n = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]]; const l = Math.hypot(...n) || 1; n = n.map((x) => x / l);
      for (const p of [a, b, c]) { pos.push(...p); nor.push(...n); const k = key(p), s = acc.get(k) || [0, 0, 0]; acc.set(k, [s[0]+n[0], s[1]+n[1], s[2]+n[2]]); }
    }
    for (let i = 0; i < pos.length; i += 3) { const s = acc.get(key(pos.slice(i, i + 3))), l = Math.hypot(...s) || 1; smo.push(s[0]/l, s[1]/l, s[2]/l); }
    const buf = (d) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(d), gl.STATIC_DRAW); return b; };
    return { pos: buf(pos), nor: buf(nor), smo: buf(smo), n: pos.length / 3 };
  }

  // The model's meshes, built on first use.
  model(id) {
    let m = this.models.get(id);
    if (!m) {
      const def = MODELS[id], meshes = {};
      for (const [name, tris] of Object.entries(def.build(SHAPES, M))) meshes[name] = this.mesh(tris);
      m = { def, meshes };
      this.models.set(id, m);
    }
    return m;
  }

  rgb(hex) { let c = this.colors.get(hex); if (!c) { c = hexRgb(hex); this.colors.set(hex, c); } return c; }

  // Draw a posed character with its feet at (x, y) on the destination context,
  // the same as DollRenderer.draw.
  draw(dest, ch, altIndex, poseObj, x, y, facing, opts = {}) {
    const gl = this.gl, { def, meshes } = this.model(ch.id);
    const s = solve(ch.skeleton, poseObj);
    // facing left is the mirror image (so the near arm and leg stay the near
    // ones), turned a little toward the camera the other way
    const left = facing < 0;
    const view = left ? M.mul(M.rx(PITCH * D), M.mul(M.ry(YAW * D), M.s(-1, 1, 1))) : M.mul(M.rx(PITCH * D), M.ry(-YAW * D));
    gl.frontFace(left ? gl.CW : gl.CCW);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE);
    gl.uniformMatrix4fv(this.U.uView, false, view);
    const tint = opts.flash ? [...this.rgb(opts.flash), 0.58] : [0, 0, 0, 0];
    gl.uniform4fv(this.U.uTint, tint);
    const outline = this.rgb(ch.outline || '#100d16');
    // one part: mesh name, model matrix, colour (hex), outlined?
    const put = (name, model, hex, ol = true) => {
      const mesh = meshes[name];
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.pos); gl.vertexAttribPointer(this.A.pos, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.nor); gl.vertexAttribPointer(this.A.nor, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.smo); gl.vertexAttribPointer(this.A.smo, 3, gl.FLOAT, false, 0, 0);
      gl.uniformMatrix4fv(this.U.uModel, false, model);
      if (ol) {
        gl.cullFace(gl.FRONT); gl.uniform1f(this.U.uGrow, 0.42); gl.uniform1f(this.U.uFlat, 1); gl.uniform3fv(this.U.uColor, outline);
        gl.drawArrays(gl.TRIANGLES, 0, mesh.n);
      }
      gl.cullFace(gl.BACK); gl.uniform1f(this.U.uGrow, 0); gl.uniform1f(this.U.uFlat, 0); gl.uniform3fv(this.U.uColor, this.rgb(hex));
      gl.drawArrays(gl.TRIANGLES, 0, mesh.n);
    };
    // joints from the 2D solve, as world pixels with y up
    const P = (p) => [p[0] / FX, -p[1] / FX];
    def.draw(put, s, P, ch.palettes[altIndex].colors, M, D);

    dest.save();
    dest.imageSmoothingEnabled = true;
    if (opts.alpha !== undefined) dest.globalAlpha = opts.alpha;
    dest.translate(x, y);
    // a twirl squashes him (and flips him when negative), as with the doll
    if (opts.squash !== undefined) dest.scale(opts.squash || 0.05, 1);
    dest.drawImage(this.canvas, -OX, -OY, SIZE, SIZE);
    dest.restore();
  }
}
