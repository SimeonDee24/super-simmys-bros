// Tiny 3x5 pixel font drawn in code (canvas text would be blurry at 480x270).
// Each glyph is 5 rows; each digit is a 3-bit row (4 = left, 2 = middle, 1 = right).
const G = {
  A: '25755', B: '65656', C: '34443', D: '65556', E: '74647', F: '74644', G: '34553',
  H: '55755', I: '72227', J: '11152', K: '55655', L: '44447', M: '57755', N: '65555',
  O: '25552', P: '65644', Q: '25563', R: '65655', S: '34216', T: '72222', U: '55557',
  V: '55552', W: '55775', X: '55255', Y: '55222', Z: '71247',
  0: '75557', 1: '26227', 2: '61247', 3: '61216', 4: '55711', 5: '74616', 6: '34757',
  7: '71222', 8: '75757', 9: '75716',
  '.': '00002', ',': '00024', ':': '02020', '%': '51245', '!': '22202', '?': '61202',
  '-': '00700', '+': '02720', '/': '11244', "'": '22000', '(': '12221', ')': '42224',
  '<': '12421', '>': '42124', '=': '07070', '_': '00007', '#': '57575', ' ': '00000',
};

export function textWidth(text, scale = 1) {
  return text.length * 4 * scale - scale;
}

// align: 'left' | 'center' | 'right'
export function drawText(ctx, text, x, y, color = '#fff', scale = 1, align = 'left', shadow = null) {
  text = String(text).toUpperCase();
  const w = textWidth(text, scale);
  if (align === 'center') x -= w >> 1;
  else if (align === 'right') x -= w;
  // At the smallest size the shadow only drops straight down, so the 1px gaps
  // between letters stay clear and the text remains readable.
  if (shadow) drawText(ctx, text, x + (scale > 1 ? scale : 0), y + scale, shadow, scale);
  ctx.fillStyle = color;
  for (let i = 0; i < text.length; i++) {
    const g = G[text[i]] || G['?'];
    for (let r = 0; r < 5; r++) {
      const bits = g.charCodeAt(r) - 48;
      for (let c = 0; c < 3; c++) {
        if (bits & (4 >> c)) ctx.fillRect(x + (i * 4 + c) * scale, y + r * scale, scale, scale);
      }
    }
  }
}
