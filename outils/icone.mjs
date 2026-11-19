import fs from 'fs'; import zlib from 'zlib';
const S = 180, img = Buffer.alloc(S * S * 4);
const mix = (a, b, t) => a + (b - a) * t;
function rr(px, py, cx, cy, hw, hh, r) { const dx = Math.max(Math.abs(px - cx) - hw + r, 0), dy = Math.max(Math.abs(py - cy) - hh + r, 0); return Math.hypot(dx, dy) - r; }
for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
  let t = Math.hypot(x - 90, y - 75) / 130; let c = [mix(44, 20, t), mix(52, 24, t), mix(62, 29, t)];
  // vertèbres
  for (let i = 0; i < 7; i++) {
    const cy = 30 + i * 19, w = 15 + i * 2.2, h = 6.5;
    const cx = 90 + Math.sin(i * 0.55 - 1.2) * 6;
    const d = rr(x + .5, y + .5, cx, cy, w, h, 4);
    const ep = rr(x + .5, y + .5, cx, cy, w + 9, 2.2, 2); // apophyses transverses
    const dd = Math.min(d, ep);
    if (dd < 1) { const a = Math.min(1, 1 - dd); c = c.map((v, k) => mix(v, [238, 226, 204][k], a)); }
  }
  // disques
  for (let i = 0; i < 6; i++) {
    const cy = 39.5 + i * 19, cx = 90 + Math.sin((i + .5) * 0.55 - 1.2) * 6, w = 13 + i * 2.2;
    const d = rr(x + .5, y + .5, cx, cy, w, 1.6, 1.5);
    if (d < 1) { const a = Math.min(1, 1 - d); c = c.map((v, k) => mix(v, [120, 175, 215][k], a)); }
  }
  const o = (y * S + x) * 4; img[o] = c[0]; img[o + 1] = c[1]; img[o + 2] = c[2]; img[o + 3] = 255;
}
const raw = Buffer.alloc((S * 4 + 1) * S); for (let y = 0; y < S; y++) { raw[y * (S * 4 + 1)] = 0; img.copy(raw, y * (S * 4 + 1) + 1, y * S * 4, (y + 1) * S * 4); }
const crc = (b) => { let c, crc = 0xffffffff; for (const x of b) { c = (crc ^ x) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xffffffff) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4); ihdr[8] = 8; ihdr[9] = 6;
fs.writeFileSync('../docs/icone-180.png', Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
