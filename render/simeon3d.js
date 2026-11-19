// Simeon's 3D model: low-poly, built from simple shapes. Sizes follow his 2D
// skeleton (characters/simeon.js: legs 10 + 9, torso 13, arms 6 + 5) and the
// colours come from his palettes, so both skins work. He is built facing +x,
// with +z toward the camera (the near arm and leg are the "front" ones).

const LEG_Z = 2.25, ARM_Z = 5.1;

export const SIMEON_MODEL = {
  build(S, M) {
    const { box, tube, ball, torus, moved } = S, m = M.mul, D = Math.PI / 180;
    const G = {};
    // body
    G.pelvis = moved(tube(4, 1, 1, 10, false), m(M.t(0, -3.2, 0), M.s(2.9, 1, 4.4)));
    G.belt = moved(tube(1.2, 1, 1, 10, false), M.s(3.1, 1, 4.6));
    G.buckle = moved(box(0.5, 1.0, 1.4), M.t(3.05, 0.1, 0.6));
    G.torso = moved(tube(12.2, 1, 1.18, 10), M.s(2.85, 1, 4.35));
    G.hem = moved(tube(1.3, 1, 1, 10, false), m(M.t(0, 0.1, 0), M.s(3.0, 1, 4.5)));
    G.collar = moved(torus(2.0, 0.55, 12, 4), M.t(0.2, 12.9, 0));
    G.chain = moved(torus(2.7, 0.28, 20, 4), m(M.t(0.9, 12.3, 0), M.rz(-24 * D)));
    G.pendant = moved(box(0.45, 1.3, 0.9), M.t(3.25, 10.1, 0));
    G.neck = tube(2.6, 1.45, 1.35, 8, false);
    // legs (hang down from the joint), jeans cuff, sneakers
    G.upperLeg = moved(tube(10, 2.2, 2.45), M.rz(Math.PI));
    G.lowerLeg = moved(tube(9, 2.05, 2.15), M.rz(Math.PI));
    G.cuff = moved(tube(1.4, 2.35, 2.3, 8, false), M.t(0, -8.6, 0));
    G.shoe = moved(box(6.2, 2.4, 3.6, 5.0, 3.2), M.t(1.1, -1.1, 0));
    G.toe = moved(ball(1.8, 1.0, 0.75, 1.0, 8, 5), M.t(3.6, 0.0, 0));
    G.sole = moved(box(6.6, 0.8, 3.9), M.t(1.3, -1.6, 0));
    G.stripe = moved(box(0.7, 2.0, 3.75), m(M.t(0.8, 0.0, 0), M.rz(-30 * D)));
    // arms
    G.sleeve = moved(tube(3.6, 1.95, 1.75, 8, false), m(M.rz(Math.PI), M.t(0, -0.6, 0)));
    G.upperArm = moved(tube(6, 1.5, 1.4), M.rz(Math.PI));
    G.lowerArm = moved(tube(5, 1.35, 1.25), M.rz(Math.PI));
    G.hand = moved(ball(1.55, 1.0, 1.15, 0.85, 8, 6), M.t(0, -1.2, 0));
    // head, centred on the middle of the skull
    G.skull = ball(4.2, 1.05, 1.08, 0.98, 12, 9);
    G.jaw = moved(ball(3.5, 1.05, 0.8, 1.0, 10, 7), M.t(0.5, -2.6, 0));
    G.chin = moved(ball(1.2, 1.0, 0.9, 1.5, 8, 5), M.t(2.9, -4.1, 0));
    G.nose = moved(box(1.2, 1.8, 0.9, 0.4, 0.7), M.t(4.25, -1.8, 0));
    G.ear = ball(1.2, 0.55, 1.15, 0.6, 8, 5);
    G.eyeW = moved(box(0.4, 0.75, 1.15), M.t(3.95, 0.1, 0));
    G.eye = moved(box(0.5, 0.95, 0.65), M.t(4.02, 0.05, 0));
    G.squint = moved(box(0.5, 0.3, 1.2), M.t(4.0, 0.3, 0));
    G.brow = moved(box(0.7, 0.55, 1.9, 0.7, 2.0), M.t(3.95, 0.95, 0));
    G.mouth = moved(box(0.35, 0.3, 1.5), M.t(4.12, -3.0, 0));
    G.yell = moved(box(0.4, 1.5, 1.7, 0.4, 1.9), M.t(4.02, -3.7, 0));
    // messy wavy dark hair: a cap and lots of tufts, a fringe over the
    // forehead, falling over the back of the head and the tops of the ears
    const hair = [...moved(ball(4.6, 1.04, 0.86, 1.04, 12, 8), M.t(-0.9, 1.7, 0))];
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const tufts = [];
    for (let i = 0; i < 26; i++) { const a = rnd() * Math.PI * 2, up = 0.35 + rnd() * 0.65; tufts.push([Math.cos(a) * 4.0 * (1 - up * 0.55) - 0.5, 2.0 + up * 3.1, Math.sin(a) * 4.0 * (1 - up * 0.55), 1.3 + rnd() * 0.8]); }
    for (let i = 0; i < 9; i++) tufts.push([-3.4 - rnd() * 0.6, -0.3 - rnd() * 2.0, -3.6 + i * 0.9, 1.35 + rnd() * 0.5]);
    for (let i = 0; i < 5; i++) tufts.push([2.6 + rnd() * 0.6, 2.4 + rnd() * 0.6, -2.4 + i * 1.2, 1.25 + rnd() * 0.4]);
    for (const z of [-3.9, 3.9]) tufts.push([0.4, 1.0, z * 0.98, 1.35], [-1.6, 0.3, z * 0.97, 1.4]);
    for (const [x, y, z, r] of tufts) hair.push(...moved(ball(r, 1.0, 0.8 + rnd() * 0.3, 1.0, 7, 5), m(M.t(x, y, z), M.rz((rnd() - 0.5) * 0.9))));
    G.hair = hair;
    const fr = [];
    for (const [z, l, a] of [[-1.9, 2.6, 22], [-0.6, 3.1, 32], [0.7, 2.7, 18], [1.9, 2.2, 28]]) fr.push(...moved(tube(l, 0.9, 0.3, 6), m(M.t(3.2, 2.9, z), M.rz(Math.PI - (90 + a) * D + Math.PI / 2))));
    G.fringe = fr;
    return G;
  },

  // put(mesh, matrix, colour, outlined); s = the solved 2D pose; P turns a
  // joint into world pixels (y up); C = palette colours.
  draw(put, s, P, C, M, D) {
    const m = M.mul;
    const at = (p, z, deg) => { const q = P(p); return m(M.t(q[0], q[1], z), M.rz(deg * D)); };

    // back arm and leg first (depth sorts it anyway; order only matters for ties)
    const arm = (l, z, hand) => {
      const sh = at(l.a, z, l.up);
      put('sleeve', sh, C.t); put('upperArm', sh, C.k);
      put('lowerArm', at(l.b, z, l.low), C.k);
      const fist = hand === 'fist';
      put('hand', m(at(l.c, z, l.low), M.s(fist ? 1.12 : 0.92, fist ? 0.88 : 1.12, fist ? 1.1 : 0.85)), C.k);
    };
    const leg = (l, z, foot, near) => {
      put('upperLeg', at(l.a, z, l.up), C.j);
      const knee = at(l.b, z, l.low);
      put('lowerLeg', knee, C.j); put('cuff', knee, C.j);
      const shoe = m(at(l.c, z, foot), M.t(0, -0.9, 0));
      put('sole', shoe, C.W); put('shoe', shoe, C.w); put('toe', shoe, C.w);
      put('stripe', m(shoe, M.t(0, 0, near ? 0.12 : -0.12)), C.g, false);
    };
    arm(s.armB, -ARM_Z, s.handB);
    leg(s.legB, -LEG_Z, s.footB, false);
    leg(s.legF, LEG_Z, s.footF, true);

    // hips and torso, leaning with the pose
    const h = P(s.hip);
    const body = m(M.t(h[0], h[1], 0), M.rz(-s.torso * D));
    put('pelvis', body, C.j); put('belt', body, C.B); put('buckle', body, C.c, false);
    put('torso', body, C.t); put('hem', body, C.T); put('collar', body, C.T);
    put('chain', body, C.c); put('pendant', body, C.c);

    // head on the neck
    const n = P(s.neck), tilt = M.rz(-s.head * D);
    put('neck', m(M.t(n[0], n[1], 0), m(tilt, M.t(0.25, -1.3, 0))), C.K);
    const head = m(M.t(n[0], n[1], 0), m(tilt, m(M.t(0.5, 4.6, 0), M.s(0.9, 0.9, 0.9))));
    put('skull', head, C.k); put('jaw', head, C.k); put('chin', head, C.k); put('nose', head, C.K);
    const face = s.face;
    for (const z of [-1, 1]) {
      const side = (dz, extra) => m(head, extra ? m(M.t(0, 0, z * dz), extra) : M.t(0, 0, z * dz));
      put('ear', m(head, M.t(-0.4, -0.6, z * 4.05)), C.K);
      if (face === 'hurt') put('squint', side(1.6), C.e, false);
      else { put('eyeW', side(1.55), C.m, false); put('eye', side(1.7), C.e, false); }
      // brows: angry when yelling, raised when hurt
      const bt = face === 'yell' ? M.mul(M.t(0, -0.15, 0), M.rx(-z * 14 * D)) : face === 'hurt' ? M.mul(M.t(0, 0.25, 0), M.rx(z * 12 * D)) : null;
      put('brow', side(1.6, bt), C.h, false);
    }
    if (face === 'yell') put('yell', head, C.r, false);
    else put('mouth', face === 'smile' ? m(head, M.s(1, 1, 1.2)) : head, face === 'hurt' ? C.r : C.p, false);
    put('hair', head, C.h); put('fringe', head, C.H);

    // near arm last
    arm(s.armF, ARM_Z, s.handF);
  },
};
