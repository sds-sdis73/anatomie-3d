// Correspondance entre un muscle et ses zones d'insertion (noms Z-Anatomy).
// Partagé par ao.mjs (champ des fibres) et construire.mjs (choix des insertions d'une région).
export const norm = s => s.toLowerCase().replace(/[()]/g, '').replace(/_muscles?r?$/, '').replace(/_muscles?_/g, '_');

const GROUPES = [
  [/gastrocnemius|^soleus|calcaneal_tendon/, ['triceps_surae']], [/rectus_femoris|^vastus_/, ['quadriceps_femoris', 'patellar_ligament']],
  [/^psoas_major|^iliacus/, ['iliopsoas']], [/^iliocostalis|^longissimus|^spinalis/, ['erector_spinae']],
  [/pubo-analis|pubococcygeus|iliococcygeus/, ['levator_ani']], [/flexor_carpi|palmaris_longus|pronator_teres|flexor_digitorum_superficialis/, ['common_flexor_tendon']],
  [/extensor_carpi_radialis_brevis|^extensor_digitorum$|extensor_digiti_minimi|extensor_carpi_ulnaris/, ['common_extensor_tendon']],
];

// Clés d'insertion d'un muscle : son nom, le muscle dont il est un chef, et le groupe commun éventuel
export function cles(en) {
  const k = norm(en), c = new Set([k]);
  const m = k.match(/^(?:.*?_)?(?:head|part|belly)_of_(.+)$/); if (m) c.add(m[1]);
  GROUPES.forEach(([re, l]) => { if (re.test(k)) l.forEach(x => c.add(x)); });
  return c;
}
