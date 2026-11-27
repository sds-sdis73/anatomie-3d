// Compatibilité iPad mini 2 (iOS 12, Safari 12, WebGL 1) : syntaxe JS, API et CSS.
import fs from 'fs';
import path from 'path';
import * as acorn from 'acorn';
import { DOCS, Rapport } from './commun.mjs';

const r = new Rapport('Compatibilité iOS 12 / Safari 12');
const fichiersJS = fs.readdirSync(DOCS).filter(f => f.endsWith('.js'));

// API absentes de Safari 12 (ou à n'utiliser que derrière un test d'existence)
const API_INTERDITES = [
  [/\bObject\.fromEntries\b/, 'Object.fromEntries (Safari 12.1)'],
  [/\.matchAll\(/, 'String.matchAll (Safari 13)'],
  [/\.replaceAll\(/, 'String.replaceAll (Safari 13.1)'],
  [/\bPromise\.allSettled\b/, 'Promise.allSettled (Safari 13)'],
  [/\bPromise\.any\b/, 'Promise.any (Safari 14)'],
  [/\bglobalThis\b/, 'globalThis (Safari 12.1)'],
  [/\bstructuredClone\b/, 'structuredClone (Safari 15.4)'],
  [/\bnew ResizeObserver\b/, 'ResizeObserver (Safari 13.1)'],
  [/\bnew IntersectionObserver\b/, 'IntersectionObserver (Safari 12.1)'],
  [/\bnew AbortController\b/, 'AbortController (Safari 12.1)'],
  [/\.at\(-?\d/, 'Array.at (Safari 15.4)'],
  [/\(\?<[=!]/, 'regex lookbehind (Safari 16.4)'],
  [/\bqueueMicrotask\b/, 'queueMicrotask (Safari 12.1)'],
  [/\bscrollIntoView\(\s*\{/, 'scrollIntoView avec options (Safari 14)'],
];

for (const f of fichiersJS) {
  const src = fs.readFileSync(path.join(DOCS, f), 'utf8');
  let erreur = null;
  try { acorn.parse(src, { ecmaVersion: 2018, sourceType: 'script' }); } catch (e) { erreur = e.message; }
  r.ok(!erreur, f + ' : syntaxe acceptée par Safari 12 (ES2018, sans ?. ni ??)', erreur);
  const sansCommentaires = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const [re, nom] of API_INTERDITES) {
    const m = sansCommentaires.match(re);
    r.ok(!m, f + ' : pas de ' + nom, m ? 'trouvé : « ' + m[0] + ' »' : '');
  }
  // événements « pointer » : seulement derrière window.PointerEvent
  const pointeurs = (sansCommentaires.match(/['"]pointer(down|move|up)['"]/g) || []).length;
  r.ok(pointeurs === 0 || /window\.PointerEvent\s*\?/.test(sansCommentaires), f + ' : événements pointer protégés (absents sur iOS 12)');
}

// three.js : version r128 maximum
const three = fs.readFileSync(path.join(DOCS, 'vendor/three.min.js'), 'utf8');
const rev = (three.match(/const e="(\d+)"/) || [])[1];
r.ok(rev && +rev <= 128, 'three.js r' + rev + ' (r128 au plus, dernière version compatible sans transpilation)');

// CSS
const css = fs.readFileSync(path.join(DOCS, 'style.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const regles = css.split('}').map(b => b.split('{')).filter(x => x.length === 2);
const flexAvecGap = regles.filter(([sel, corps]) => /display\s*:\s*(inline-)?flex/.test(corps) && /(^|;|\s)(row-|column-)?gap\s*:/.test(corps)).map(([s]) => s.trim());
r.ok(!flexAvecGap.length, 'CSS : pas de « gap » sur un conteneur flex (Safari 14.1)', flexAvecGap.join(', '));
for (const [re, nom] of [[/(^|[;\s{])inset\s*:/, 'inset (Safari 14.1)'], [/aspect-ratio\s*:/, 'aspect-ratio (Safari 15)'], [/:is\(|:where\(/, ':is() / :where() (Safari 14)'],
  [/color-mix\(/, 'color-mix (Safari 16.2)'], [/\bclamp\(/, 'clamp() (Safari 13.1)'], [/\d+(cqw|cqh|svh|dvh|lvh)\b/, 'unités cq/svh/dvh (Safari 15.4+)'],
  [/:has\(/, ':has() (Safari 15.4)']]) {
  const m = css.match(re);
  r.ok(!m, 'CSS : pas de ' + nom, m ? 'trouvé : « ' + m[0] + ' »' : '');
}
const backdrop = (css.match(/[^-]backdrop-filter\s*:/g) || []).length, backdropW = (css.match(/-webkit-backdrop-filter\s*:/g) || []).length;
r.ok(backdrop <= backdropW, 'CSS : backdrop-filter toujours doublé de -webkit-backdrop-filter (Safari 12)');

// HTML : appli plein écran
const html = fs.readFileSync(path.join(DOCS, 'index.html'), 'utf8');
r.ok(/apple-mobile-web-app-capable" content="yes"/.test(html), 'HTML : mode plein écran depuis l’écran d’accueil');
r.ok(/user-scalable=no/.test(html), 'HTML : zoom de page désactivé');

export default r;
