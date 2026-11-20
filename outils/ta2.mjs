// Terminologia Anatomica 2 (via Z-Anatomy) : anglais → { la, fr }
import fs from 'fs';
const lignes = fs.readFileSync('../sources-za/TA2.csv', 'utf8').replace(/^﻿/, '').split(/\r?\n/);
const TA = new Map();
const cle = s => s.toLowerCase().replace(/[()]/g, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
for (const l of lignes.slice(1)) {
  const c = l.replace(/^"|"$/g, '').split(';');
  if (c.length < 4 || !c[1]) continue;
  const v = { la: c[2], fr: c[3] };
  for (const k of [cle(c[1]), cle(c[1]).replace(/ muscles?$/, ''), cle(c[1]).replace(/^muscle /, '')]) if (!TA.has(k)) TA.set(k, v);
}
export function ta2(base) {
  const k = cle(base);
  return TA.get(k) || TA.get(k.replace(/ muscles?$/, '')) || TA.get(k + ' muscle') || TA.get(k.replace(/ bone$/, '')) || null;
}
