// Classement des muscles par plan, pour le curseur « éplucher » :
// 3 = superficiel, 2 = moyen, 1 = profond (tout ce qui n'est pas listé).
const SUPERFICIELS = [
  // tête et cou
  'Platysma', 'Sternocleidomastoid', 'Frontalis', 'Occipitalis', 'Temporoparietalis', 'Epicranial_aponeurosis',
  'Orbicularis', 'Procerus', 'Corrugator', 'Zygomaticus', 'Nasalis', 'Levator_labii', 'Levator_nasolabialis',
  'Depressor_', 'Risorius', 'Mentalis', 'Levator_anguli_oris', 'Superficial_part_of_masseter', 'Temporalis',
  // tronc
  'trapezius', 'Latissimus_dorsi', 'pectoralis_major', 'Pectoralis_major', 'External_abdominal_oblique', 'Rectus_abdominis',
  'Pyramidalis', 'Serratus_anterior', 'External_anal_sphincter',
  // membre supérieur
  'deltoid', 'biceps_brachii', 'triceps_brachii', 'Brachioradialis', 'Teres_major', 'Palmaris_longus',
  'Flexor_carpi_radialis', 'flexor_carpi_ulnaris', 'Superficial_head_of_pronator_teres', 'Extensor_carpi_radialis',
  'Extensor_digitorum$', 'Extensor_digiti_minimi', 'extensor_carpi_ulnaris', 'Anconeus', 'Abductor_pollicis_longus',
  'Extensor_pollicis_brevis', 'Abductor_pollicis_brevis', 'Abductor_digiti_minimi_of_hand', 'Flexor_digiti_minimi_of_hand',
  'Superficial_head_of_flexor_pollicis_brevis',
  // membre inférieur
  'Gluteus_maximus', 'Tensor_fasciae_latae', 'Iliotibial_tract', 'Sartorius', 'Rectus_femoris', 'Vastus_lateralis',
  'Vastus_medialis', 'Gracilis', 'Adductor_longus', 'Pectineus', 'Long_head_of_biceps_femoris', 'Semitendinosus',
  'gastrocnemius', 'Calcaneal_tendon', 'Tibialis_anterior', 'Extensor_digitorum_longus', 'Tendon_of_extensor_digitorum_longus',
  'Fibularis_longus', 'Fibularis_tertius', 'Extensor_hallucis_longus', 'Abductor_hallucis', 'Abductor_digiti_minimi_of_foot',
  'Extensor_digitorum_brevis', 'Extensor_hallucis_brevis',
];
const MOYENS = [
  'Deep_part_of_masseter', 'Bucinator', 'Splenius', 'Levator_scapulae', 'Rhomboid', 'Serratus_posterior', 'Semispinalis_capitis',
  'Infraspinatus', 'Teres_minor', 'Supraspinatus', 'Internal_abdominal_oblique', 'Pectoralis_minor', 'Subclavius',
  'External_intercostal', 'Iliocostalis', 'Longissimus', 'Spinalis', 'Sternohyoid', 'Omohyoid', 'Sternothyroid', 'Thyrohyoid',
  'digastric', 'Stylohyoid', 'Mylohyoid', 'Scalenus', 'Brachialis', 'Coracobrachialis', 'flexor_digitorum_superficialis',
  'Deep_head_of_pronator_teres', 'Extensor_pollicis_longus', 'Extensor_indicis', 'Supinator', 'Opponens', 'Deep_head_of_flexor_pollicis_brevis',
  'adductor_pollicis', 'Palmar_aponeurosis', 'Soleus', 'Plantaris', 'Fibularis_brevis', 'Semimembranosus', 'Short_head_of_biceps_femoris',
  'Adductor_brevis', 'Adductor_magnus', 'Adductor_minimus', 'Vastus_intermedius', 'Flexor_digitorum_brevis', 'Flexor_digiti_minimi_of_foot',
  'Quadratus_plantae', 'flexor_hallucis_brevis', 'Gluteus_medius',
];
const re = l => new RegExp('(' + l.join('|') + ')');
const RS = re(SUPERFICIELS), RM = re(MOYENS);
export function couche(base) {
  if (/Gluteus_minimus|Piriformis/.test(base)) return 1;
  if (RS.test(base)) return 3;
  if (RM.test(base)) return 2;
  return 1;
}
