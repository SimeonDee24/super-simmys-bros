// Makes a fighter's pixel-art body rounder: parts are widened by repeating
// columns of their art, and the torso gets a belly. Drawing only: the
// skeleton, hurtboxes and moves are unchanged.

// Repeat columns of a part's art. inserts: [[column, copies], ...]; each
// copy goes right after its column. The pivot stays on the same art, so a
// part widened on both sides of its pivot grows evenly. Rows listed in
// `keep` (a neck, say) are not stretched, only padded so they stay put.
export function widen(part, inserts, keep = []) {
  const w = Math.max(...part.px.map((r) => r.length));
  const left = inserts.reduce((a, [c, n]) => a + (c < part.pivot[0] ? n : 0), 0);
  const total = inserts.reduce((a, [, n]) => a + n, 0);
  const px = part.px.map((row, i) => {
    const r = row.padEnd(w, '.');
    if (keep.includes(i)) return '.'.repeat(left) + r + '.'.repeat(total - left);
    let out = '';
    for (let c = 0; c < w; c++) {
      out += r[c];
      for (const [ic, n] of inserts) if (ic === c) out += r[c].repeat(n);
    }
    return out;
  });
  return { ...part, pivot: [part.pivot[0] + left, part.pivot[1]], px };
}

// Push the front (right) edge of some rows further out: bulge[i] = extra
// pixels for row i. The edge pixel is repeated, so the shading follows.
export function belly(part, bulge) {
  const w = Math.max(...part.px.map((r) => r.length)) + Math.max(...bulge);
  const px = part.px.map((row, i) => {
    const n = bulge[i] || 0;
    let r = row.replace(/\.+$/, '');
    if (n && r.length) {
      // repeat the body colour just inside the edge, not the edge highlight
      const e = r[r.length - 1];
      let j = r.length - 1; while (j > 0 && r[j] === e) j--;
      r = r.slice(0, j + 1) + r[j].repeat(n) + r.slice(j + 1);
    }
    return r.padEnd(w, '.');
  });
  return { ...part, px };
}

// The whole treatment: a wide torso with a round belly, thick arms and legs,
// and fuller cheeks. `parts` is the character's finished parts table.
export function chubby(parts, { neckRows = 2 } = {}) {
  const out = { ...parts };
  const t = parts.torso;
  const n = t.px.length;
  // wider all round (more in front than behind)...
  let torso = widen(t, [[3, 3], [8, 5]], Array.from({ length: neckRows }, (_, i) => i));
  // ...and a belly that rounds out in the middle and tucks in at the waistband
  const bulge = t.px.map((_, i) => {
    const k = (i - neckRows) / (n - neckRows - 5);       // 0 at the shoulders, 1 at the waistband
    return i < neckRows + 2 || k > 1.05 ? 0 : Math.round(Math.sqrt(Math.sin(Math.min(1, Math.max(0, k)) * Math.PI)) * 6);
  });
  torso = belly(torso, bulge);
  out.torso = torso;
  // thick limbs: two more columns, one each side of the middle
  for (const k of ['upperArm', 'lowerArm']) out[k] = widen(parts[k], [[1, 2], [2, 2]]);
  for (const k of ['upperLeg', 'lowerLeg']) out[k] = widen(parts[k], [[2, 2], [3, 3]]);
  // rounder face: the head widened behind the eye, so the face itself is unchanged
  // and full cheeks and a soft double chin pushing the lower face forward
  for (const k of Object.keys(parts)) if (k.startsWith('head_')) {
    const h = widen(parts[k], [[3, 3]]);
    out[k] = belly(h, h.px.map((_, i) => (i >= 7 && i <= 12 ? (i === 12 ? 1 : 2) : 0)));
  }
  return out;
}
