// Régions détaillées (jeux de données dans docs/donnees/<region>/).
// Chaque région est définie par ses os : un sommet appartient à la région s'il est plus proche (à MARGE près)
// des os de la région que des autres os. Les ceintures appartiennent à la fois au tronc et au membre.
export const REGIONS = {
  'tete-cou': 'Tête et cou',
  'tronc': 'Tronc',
  'membre-superieur': 'Membre supérieur',
  'membre-inferieur': 'Membre inférieur',
};

// Régions d'un os d'après son nom de base et son chemin Z-Anatomy ; null si l'os n'est pas classé.
export function regionsOs(base, chemin) {
  if (/Bones_of_free_part_of_lower_limb/.test(chemin)) return ['membre-inferieur'];
  if (/Bones_of_pelvic_girdle/.test(chemin) || /^(Sacrum|Coccyx)$/.test(base)) return ['tronc', 'membre-inferieur'];
  if (/Bones_of_free_part_of_upper_limb/.test(chemin)) return ['membre-superieur'];
  if (/Bones_of_pectoral_girdle/.test(chemin)) return /^Clavicle/.test(base) ? ['tete-cou', 'tronc', 'membre-superieur'] : ['tronc', 'membre-superieur'];
  // bas du cou : repères communs à la tête-cou et au tronc
  if (/^(Vertebra_C7|Vertebra_T1|Manubrium_of_sternum|First_rib)$/.test(base)) return ['tete-cou', 'tronc'];
  if (/Cervical_vertebrae/.test(chemin)) return ['tete-cou'];
  if (/Thoracic_skeleton|Thoracic_vertebrae|Lumbar_vertebrae/.test(chemin)) return ['tronc'];
  if (/Cranium|Teeth|Extracranial_bones_of_head|Nasal_cartilages|Laryngeal_cartilages|Skull|Bones_of_head/.test(chemin)) return ['tete-cou'];
  return null;
}

// Régions où une pièce (autre qu'un os) peut figurer, d'après son groupe Z-Anatomy ; null = toutes.
// La géométrie tranche ensuite (part des sommets dans la région, ou découpe au bord).
const TC = 'tete-cou', T = 'tronc', MS = 'membre-superieur', MI = 'membre-inferieur';
const GROUPES = [
  [/Muscles_of_head|Muscles_of_neck|Cervical_fasciae|Fasciae_of_head|Joints_of_skull|Cranial_nerves/, [TC]],
  [/Epaxial_muscles|Joints_of_vertebral_column|Spinal_cord|Autonomic_division|Roots_of_nerves/, [TC, T]],
  [/Hypaxial_muscles_of_back/, [TC, T, MS]],
  [/Muscles_of_thorax|Joints_of_pectoral_girdle/, [T, MS]],
  [/Thoracic_part_of_muscular_system|Fasciae_of_thorax|Thoracolumbar_fascia|Thoracic_joints|Muscles_of_abdomen|Fasciae_of_abdomen/, [T]],
  [/Muscles_of_pelvis|Joints_of_pelvic_girdle/, [T, MI]],
  [/Muscles_of_upper_limb|Fasciae_of_upper_limb|Joints_of_upper_limb/, [MS, T]],
  [/Muscles_of_lower_limb|Fasciae_of_lower_limb|Joints_of_lower_limb/, [MI, T]],
];
const ORGANES = new Set(['respiratoire', 'digestif', 'urinaire', 'genital', 'endocrinien', 'encephale', 'sens']);
export function regionsPermises(p) {
  if (ORGANES.has(p.couche)) return [TC, T]; // pas d'organes dans les membres
  if (p.couche === 'peau' || p.couche === 'cardio') return null;
  if (p.couche === 'muscles' && /colli|capitis|cervicis/i.test(p.nom)) return [TC]; // muscles du cou (épineux, splénius…) : pas de lanières dans le tronc
  for (const [re, l] of GROUPES) if (re.test(p.chemin)) return l;
  return null;
}

export const MARGE = 2.5;      // cm de contexte au-delà de la frontière entre régions (découpe de la peau)
export const MARGE_DECOUPE = { peau: MARGE, nerfs: 0.5, cardio: 0.5 }; // nerfs et vaisseaux : presque à la frontière
export const SEUIL = 0.5;      // part des sommets dans la région (sans marge) pour garder une pièce entière
export const DECOUPE = new Set(['peau', 'nerfs', 'cardio']); // couches découpées au bord de la région (pièces longues)
// Budgets visés avant contrôle (tests/t-donnees.mjs : 620 k triangles et 9 Mo au démarrage)
export const BUDGET_DEMARRAGE = 600000;
export const BUDGET_DEMANDE = 500000; // paquets chargés à la demande : pas plus que le corps entier (≈ 585 k)
