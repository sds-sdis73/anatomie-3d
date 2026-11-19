// Noms français des structures (nomenclature anatomique française usuelle).
import fs from 'fs';

const ORD = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12 };
const ordFr = n => (n === 1 ? '1re' : n + 'e');
const ordFrM = n => (n === 1 ? '1er' : n + 'e');
const DOIGT = { 1: 'du pouce', 2: "de l'index", 3: 'du majeur', 4: "de l'annulaire", 5: "de l'auriculaire" };
const ORTEIL = { 1: "de l'hallux", 2: 'du 2e orteil', 3: 'du 3e orteil', 4: 'du 4e orteil', 5: 'du 5e orteil' };
const PHAL = { Proximal: 'proximale', Middle: 'moyenne', Distal: 'distale' };

const DICO = {
  // ---------- Os ----------
  Patella: 'Patella (rotule)', Sesamoid_bones_of_foot: 'Os sésamoïdes du pied', Intermediate_cuneiform_bone: 'Cunéiforme intermédiaire',
  Lateral_cuneiform_bone: 'Cunéiforme latéral', Medial_cuneiform_bone: 'Cunéiforme médial', Hyoid_bone: 'Os hyoïde', Mandible: 'Mandibule',
  Major_alar_cartilage: 'Grand cartilage alaire', Nasal_septal_cartilage: 'Cartilage du septum nasal', Lateral_process_of_nasal_septal_cartilage: 'Cartilage nasal latéral',
  Parietal_bone: 'Os pariétal', Palatine_bone: 'Os palatin', Lacrimal_bone: 'Os lacrymal', Nasal_bone: 'Os nasal', Temporal_bone: 'Os temporal',
  Ethmoid_bone: 'Os ethmoïde', Maxilla: 'Maxillaire', Zygomatic_bone: 'Os zygomatique', Inferior_nasal_concha_bone: 'Cornet nasal inférieur',
  Vomer: 'Vomer', Frontal_bone: 'Os frontal', Sphenoid_bone: 'Os sphénoïde', Thyroid_cartilage: 'Cartilage thyroïde', Cricoid_cartilage: 'Cartilage cricoïde',
  Body_of_sternum: 'Corps du sternum', Ulna: 'Ulna (cubitus)', Radius: 'Radius', Scapula: 'Scapula (omoplate)', Lunate_bone: 'Os lunatum (semi-lunaire)',
  Triquetrum_bone: 'Os triquétrum (pyramidal)', Capitate_bone: 'Os capitatum (grand os)', Hamate_bone: 'Os hamatum (os crochu)', Fibula: 'Fibula (péroné)',
  Talus: 'Talus (astragale)', Navicular_bone: 'Os naviculaire', Cuboid_bone: 'Os cuboïde', Coccyx: 'Coccyx', Sacrum: 'Sacrum',
  'Atlas_(C1)': 'Atlas (C1)', 'Axis_(C2)': 'Axis (C2)', Hip_bone: 'Os coxal', Clavicle: 'Clavicule',
  // ---------- Muscles ----------
  Gluteus_medius_muscle: 'Moyen fessier', Gluteus_maximus_muscle: 'Grand fessier', Gluteus_minimus_muscle: 'Petit fessier', Iliotibial_tract: 'Tractus ilio-tibial (bandelette de Maissiat)',
  Tensor_fasciae_latae: 'Tenseur du fascia lata', Tendon_of_extensor_digitorum_longus: 'Tendons du long extenseur des orteils',
  Medial_head_of_flexor_hallucis_brevis: "Court fléchisseur de l'hallux (chef médial)", Lateral_head_of_flexor_hallucis_brevis: "Court fléchisseur de l'hallux (chef latéral)",
  Flexor_digiti_minimi_of_foot: 'Court fléchisseur du 5e orteil', Extensor_hallucis_brevis: "Court extenseur de l'hallux",
  Transverse_head_of_adductor_hallucis: "Adducteur de l'hallux (chef transverse)", Oblique_head_of_adductor_hallucis: "Adducteur de l'hallux (chef oblique)",
  '(Opponens_digiti_minimi_muscle_of_foot)': 'Opposant du 5e orteil', '(Adductor_minimus)': 'Petit adducteur', Obturator_externus: 'Obturateur externe',
  Obturator_internus: 'Obturateur interne', Semitendinosus_muscle: 'Semi-tendineux', Semimembranosus_muscle: 'Semi-membraneux',
  Lateral_head_of_gastrocnemius: 'Gastrocnémien latéral (jumeau externe)', Medial_head_of_gastrocnemius: 'Gastrocnémien médial (jumeau interne)',
  Calcaneal_tendon: "Tendon calcanéen (d'Achille)", Medial_patellar_retinaculum: 'Rétinaculum patellaire médial', Lateral_patellar_retinaculum: 'Rétinaculum patellaire latéral',
  Psoas_major: 'Grand psoas', Iliacus_muscle: 'Iliaque', Short_head_of_biceps_femoris: 'Biceps fémoral (chef court)', Long_head_of_biceps_femoris: 'Biceps fémoral (chef long)',
  Vastus_medialis_muscle: 'Vaste médial', Vastus_lateralis_muscle: 'Vaste latéral', Vastus_intermedius_muscle: 'Vaste intermédiaire', Rectus_femoris_muscle: 'Droit fémoral',
  Sartorius_muscle: 'Sartorius (couturier)', Superior_gemellus_muscle: 'Jumeau supérieur', Inferior_gemellus_muscle: 'Jumeau inférieur', Quadratus_femoris_muscle: 'Carré fémoral',
  Piriformis_muscle: 'Piriforme (pyramidal)', Occipitalis_muscle: 'Occipital', Frontalis_muscle: 'Frontal', Temporoparietalis_muscle: 'Temporo-pariétal',
  Epicranial_aponeurosis: 'Aponévrose épicrânienne (galéa)', Orbital_part_of_orbicularis_oculi: "Orbiculaire de l'œil (partie orbitaire)",
  Palpebral_part_of_orbicularis_oculi: "Orbiculaire de l'œil (partie palpébrale)", Levator_nasolabialis: "Releveur de la lèvre supérieure et de l'aile du nez",
  Temporalis_muscle: 'Temporal', Superficial_part_of_masseter: 'Masséter (partie superficielle)', Deep_part_of_masseter: 'Masséter (partie profonde)',
  Inferior_head_of_lateral_pterygoid_muscle: 'Ptérygoïdien latéral (chef inférieur)', Superior_head_of_lateral_pterygoid_muscle: 'Ptérygoïdien latéral (chef supérieur)',
  Medial_pterygoid_muscle: 'Ptérygoïdien médial', 'Pubo-analis_muscle': 'Pubo-anal', Pubococcygeus_muscle: 'Pubo-coccygien', Tendinous_arch_of_levator_ani: "Arc tendineux de l'élévateur de l'anus",
  Iliococcygeus_muscle: 'Ilio-coccygien', Coccygeus_muscle: 'Coccygien', External_anal_sphincter: "Sphincter externe de l'anus",
  Iliocostalis_thoracis_muscle: 'Ilio-costal du thorax', Iliocostalis_lumborum_muscle: 'Ilio-costal des lombes', Iliocostalis_colli_muscle: 'Ilio-costal du cou',
  Spinalis_capitis_muscle: 'Épineux de la tête', Spinalis_thoracis_muscle: 'Épineux du thorax', Spinalis_colli_muscle: 'Épineux du cou',
  Longissimus_colli_muscle: 'Longissimus du cou', Longissimus_capitis_muscle: 'Longissimus de la tête', Longissimus_thoracis_muscle: 'Longissimus du thorax',
  Semispinalis_colli_muscle: 'Semi-épineux du cou', Semispinalis_thoracis_muscle: 'Semi-épineux du thorax', Semispinalis_capitis_muscle: 'Semi-épineux de la tête',
  Multifidus_thoracis_muscle: 'Multifide du thorax', Multifidus_lumborum_muscle: 'Multifide des lombes', Multifidus_colli_muscle: 'Multifide du cou', Rotatores: 'Rotateurs',
  Interspinales_colli_muscles: 'Interépineux du cou', Interspinales_thoracis_muscles: 'Interépineux du thorax', Interspinales_lumborum_muscles: 'Interépineux des lombes',
  Ventral_parts_of_lateral_intertransversarii_lumborum_muscles: 'Intertransversaires latéraux des lombes (partie ventrale)',
  Dorsal_parts_of_lateral_intertransversarii_lumborum_muscles: 'Intertransversaires latéraux des lombes (partie dorsale)',
  Rectus_posterior_major_capitis_muscle: 'Grand droit postérieur de la tête', Rectus_posterior_minor_capitis_muscle: 'Petit droit postérieur de la tête',
  Obliquus_superior_capitis_muscle: 'Oblique supérieur de la tête', Obliquus_inferior_capitis_muscle: 'Oblique inférieur de la tête',
  Splenius_capitis_muscle: 'Splénius de la tête', Splenius_colli_muscle: 'Splénius du cou', Levator_scapulae: 'Élévateur de la scapula (angulaire)',
  Latissimus_dorsi_muscle: 'Grand dorsal', Rhomboid_minor_muscle: 'Petit rhomboïde', Rhomboid_major_muscle: 'Grand rhomboïde',
  Serratus_posterior_superior_muscle: 'Dentelé postérieur supérieur', Serratus_posterior_inferior_muscle: 'Dentelé postérieur inférieur',
  Transverse_part_of_trapezius_muscle: 'Trapèze (faisceau moyen)', Ascending_part_of_trapezius_muscle: 'Trapèze (faisceau inférieur)', Descending_part_of_trapezius_muscle: 'Trapèze (faisceau supérieur)',
  Brachialis_muscle: 'Brachial', Short_head_of_biceps_brachii: 'Biceps brachial (chef court)', Long_head_of_biceps_brachii: 'Biceps brachial (chef long)', Coracobrachialis_muscle: 'Coraco-brachial',
  Humeral_head_of_flexor_carpi_ulnaris: 'Fléchisseur ulnaire du carpe (chef huméral)', Ulnar_head_of_flexor_carpi_ulnaris: 'Fléchisseur ulnaire du carpe (chef ulnaire)',
  'Humero-ulnar_head_of_flexor_digitorum_superficialis': 'Fléchisseur superficiel des doigts (chef huméro-ulnaire)', Radial_head_of_flexor_digitorum_superficialis: 'Fléchisseur superficiel des doigts (chef radial)',
  Superficial_head_of_pronator_teres: 'Rond pronateur (chef superficiel)', Deep_head_of_pronator_teres: 'Rond pronateur (chef profond)',
  Humeral_head_of_extensor_carpi_ulnaris: 'Extenseur ulnaire du carpe (chef huméral)', Ulnar_head_of_extensor_carpi_ulnaris: 'Extenseur ulnaire du carpe (chef ulnaire)',
  Extensor_carpi_radialis_longus: 'Long extenseur radial du carpe', Extensor_carpi_radialis_brevis: 'Court extenseur radial du carpe',
  Clavicular_part_of_deltoid_muscle: 'Deltoïde (faisceau antérieur)', Scapular_spinal_part_of_deltoid_muscle: 'Deltoïde (faisceau postérieur)', Acromial_part_of_deltoid_muscle: 'Deltoïde (faisceau moyen)',
  Superficial_head_of_flexor_pollicis_brevis: 'Court fléchisseur du pouce (chef superficiel)', Deep_head_of_flexor_pollicis_brevis: 'Court fléchisseur du pouce (chef profond)',
  Oblique_head_of_adductor_pollicis: 'Adducteur du pouce (chef oblique)', Transverse_head_of_adductor_pollicis: 'Adducteur du pouce (chef transverse)',
  Medial_head_of_triceps_brachii: 'Triceps brachial (chef médial)', Lateral_head_of_triceps_brachii: 'Triceps brachial (chef latéral)', Long_head_of_triceps_brachii: 'Triceps brachial (chef long)',
  Diaphragm: 'Diaphragme', Clavicular_head_of_pectoralis_major_muscle: 'Grand pectoral (faisceau claviculaire)', Sternocostal_head_of_pectoralis_major_muscle: 'Grand pectoral (faisceau sterno-costal)',
  '(Abdominal_part_of_pectoralis_major_muscle)': 'Grand pectoral (faisceau abdominal)', Levatores_breves_costarum: 'Élévateurs courts des côtes', Levatores_longi_costarum: 'Élévateurs longs des côtes',
  Transversus_thoracis_muscle: 'Transverse du thorax', Sternocleidomastoid_muscle: 'Sterno-cléido-mastoïdien', Platysma: 'Platysma (peaucier du cou)', Stylohyoid_muscle: 'Stylo-hyoïdien',
  Mylohyoid_muscle: 'Mylo-hyoïdien', Anterior_belly_of_digastric_muscle: 'Digastrique (ventre antérieur)', Posterior_belly_of_digastric_muscle: 'Digastrique (ventre postérieur)',
  Intermediate_tendon_of_digastric_muscle: 'Tendon intermédiaire du digastrique', Geniohyoid_muscle: 'Génio-hyoïdien', Sternohyoid_muscle: 'Sterno-hyoïdien', Sternothyroid_muscle: 'Sterno-thyroïdien',
  Thyrohyoid_muscle: 'Thyro-hyoïdien', Omohyoid_muscle: 'Omo-hyoïdien', External_intercostal_muscles: 'Intercostaux externes', Internal_intercostal_muscles: 'Intercostaux internes',
  Innermost_intercostal_muscles: 'Intercostaux intimes', Serratus_anterior_muscle: 'Dentelé antérieur (grand dentelé)', Pectoralis_minor_muscle: 'Petit pectoral', Subclavius_muscle: 'Subclavier',
  External_abdominal_oblique_muscle: "Oblique externe de l'abdomen", Internal_abdominal_oblique_muscle: "Oblique interne de l'abdomen", Transversus_abdominis_muscle: "Transverse de l'abdomen",
  Rectus_abdominis_muscle: "Droit de l'abdomen (grand droit)", Pyramidalis_muscle: 'Pyramidal de l\'abdomen', Quadratus_lumborum_muscle: 'Carré des lombes',
  Scalenus_anterior_muscle: 'Scalène antérieur', Scalenus_medius_muscle: 'Scalène moyen', Scalenus_posterior_muscle: 'Scalène postérieur', Longus_colli_muscle: 'Long du cou', Longus_capitis_muscle: 'Long de la tête',
  Rectus_anterior_capitis_muscle: 'Droit antérieur de la tête', Rectus_lateralis_capitis_muscle: 'Droit latéral de la tête', Supraspinatus_muscle: 'Supra-épineux', Infraspinatus_muscle: 'Infra-épineux',
  Subscapularis_muscle: 'Subscapulaire', Teres_minor_muscle: 'Petit rond', Teres_major_muscle: 'Grand rond', Supinator: 'Supinateur', Brachioradialis_muscle: 'Brachio-radial (long supinateur)',
  Anconeus_muscle: 'Anconé', Palmaris_longus_muscle: 'Long palmaire', Flexor_carpi_radialis: 'Fléchisseur radial du carpe', Flexor_digitorum_profundus: 'Fléchisseur profond des doigts',
  Flexor_pollicis_longus: 'Long fléchisseur du pouce', Pronator_quadratus: 'Carré pronateur', Extensor_digitorum: 'Extenseur des doigts', Extensor_digiti_minimi: "Extenseur du petit doigt",
  Extensor_pollicis_longus: 'Long extenseur du pouce', Extensor_pollicis_brevis: 'Court extenseur du pouce', Abductor_pollicis_longus: 'Long abducteur du pouce', Extensor_indicis: "Extenseur de l'index",
  Abductor_pollicis_brevis: 'Court abducteur du pouce', Opponens_pollicis_muscle: 'Opposant du pouce', Abductor_digiti_minimi_of_hand: 'Abducteur du petit doigt', Flexor_digiti_minimi_of_hand: 'Court fléchisseur du petit doigt',
  Opponens_digiti_minimi_muscle_of_hand: 'Opposant du petit doigt', Lumbrical_muscles_of_hand: 'Lombricaux de la main', Palmar_interossei_muscles: 'Interosseux palmaires', Dorsal_interossei_muscles_of_hand: 'Interosseux dorsaux de la main',
  Soleus_muscle: 'Soléaire', Plantaris_muscle: 'Plantaire', Popliteus_muscle: 'Poplité', Tibialis_posterior_muscle: 'Tibial postérieur', Flexor_digitorum_longus: 'Long fléchisseur des orteils',
  Flexor_hallucis_longus: "Long fléchisseur de l'hallux", Pectineus_muscle: 'Pectiné', Gracilis_muscle: 'Gracile (droit interne)', Adductor_longus: 'Long adducteur', Adductor_brevis: 'Court adducteur',
  Adductor_magnus: 'Grand adducteur', Fibularis_longus_muscle: 'Long fibulaire', Fibularis_brevis_muscle: 'Court fibulaire', Fibularis_tertius_muscle: 'Troisième fibulaire', Tibialis_anterior_muscle: 'Tibial antérieur',
  Extensor_digitorum_longus: 'Long extenseur des orteils', Extensor_hallucis_longus: "Long extenseur de l'hallux", Extensor_digitorum_brevis: 'Court extenseur des orteils', Abductor_hallucis: "Abducteur de l'hallux",
  Abductor_digiti_minimi_of_foot: 'Abducteur du 5e orteil', Flexor_digitorum_brevis: 'Court fléchisseur des orteils', Quadratus_plantae_muscle: 'Carré plantaire', Lumbrical_muscles_of_foot: 'Lombricaux du pied',
  Plantar_interossei_muscles: 'Interosseux plantaires', Dorsal_interossei_muscles_of_foot: 'Interosseux dorsaux du pied',
  Zygomaticus_major_muscle: 'Grand zygomatique', Zygomaticus_minor_muscle: 'Petit zygomatique', Corrugator_supercilii: 'Corrugateur du sourcil', Procerus_muscle: 'Procérus', Nasalis_muscle: 'Nasal',
  Levator_labii_superioris: 'Releveur de la lèvre supérieure', Depressor_anguli_oris: "Abaisseur de l'angle de la bouche", Depressor_septi_nasi: 'Abaisseur du septum nasal', Orbicularis_oris_muscle: 'Orbiculaire de la bouche',
  Bucinator: 'Buccinateur', Risorius_muscle: 'Risorius', Mentalis_muscle: 'Mentonnier', Depressor_labii_inferioris: 'Abaisseur de la lèvre inférieure', Levator_anguli_oris: "Élévateur de l'angle de la bouche",
  // ---------- Fascias ----------
  Deltoid_fascia: 'Fascia deltoïdien', Antebrachial_fascia: 'Fascia antébrachial', Extensor_retinaculum_of_wrist: 'Rétinaculum des extenseurs du poignet', Brachial_fascia: 'Fascia brachial',
  Flexor_retinaculum_of_wrist: 'Rétinaculum des fléchisseurs (ligament annulaire du carpe)', Palmar_aponeurosis: 'Aponévrose palmaire', Dorsal_fascia_of_hand: 'Fascia dorsal de la main',
  Superficial_transverse_metacarpal_ligament: 'Ligament métacarpien transverse superficiel', Masseteric_fascia: 'Fascia massétérique', Superficial_layer_of_temporal_fascia: 'Fascia temporal (lame superficielle)',
  Clavipectoral_fascia: 'Fascia clavi-pectoral', Pectoral_fascia: 'Fascia pectoral', Transverse_intermuscular_septum_of_leg: 'Septum intermusculaire transverse de la jambe', Crural_fascia: 'Fascia crural',
  Anterior_intermuscular_septum_of_leg: 'Septum intermusculaire antérieur de la jambe', Posterior_intermuscular_septum_of_leg: 'Septum intermusculaire postérieur de la jambe',
  Superior_fibular_retinaculum: 'Rétinaculum supérieur des fibulaires', Inferior_fibular_retinaculum: 'Rétinaculum inférieur des fibulaires', Fascia_lata: 'Fascia lata',
  Superior_extensor_retinaculum_of_ankle: 'Rétinaculum supérieur des extenseurs', Inferior_extensor_retinaculum_of_ankle: 'Rétinaculum inférieur des extenseurs',
  Medial_femoral_intermuscular_septum: 'Septum intermusculaire fémoral médial', Lateral_femoral_intermuscular_septum: 'Septum intermusculaire fémoral latéral',
  Plantar_aponeurosis: 'Aponévrose plantaire', Popliteal_fascia: 'Fascia poplité', Piriformis_fascia: 'Fascia du piriforme', Superficial_transverse_metatarsal_ligament: 'Ligament métatarsien transverse superficiel',
  Flexor_retinaculum_of_ankle: 'Rétinaculum des fléchisseurs de la cheville', Iliopectineal_arch: 'Arcade ilio-pectinée', Middle_layer_of_thoracolumbar_fascia: 'Fascia thoraco-lombaire (feuillet moyen)',
  Anterior_layer_of_thoracolumbar_fascia: 'Fascia thoraco-lombaire (feuillet antérieur)', Posterior_layer_of_thoracolumbar_fascia: 'Fascia thoraco-lombaire (feuillet postérieur)',
  Investing_abdominal_fascia: "Fascia d'enveloppe de l'abdomen", Diaphragmatic_fascia: 'Fascia diaphragmatique', Iliopsoas_fascia: 'Fascia iliaque (du psoas)', Transversalis_fascia: 'Fascia transversalis',
  Superficial_investing_cervical_fascia: 'Fascia cervical superficiel', Lateral_intermuscular_septum_of_arm: "Septum intermusculaire latéral du bras", Medial_intermuscular_septum_of_arm: 'Septum intermusculaire médial du bras',
  // ---------- Ligaments, disques, capsules ----------
  Inguinal_ligament: 'Ligament inguinal', Linea_alba: 'Ligne blanche', Iliolumbar_ligament: 'Ligament ilio-lombaire', Inferior_pubic_ligament: 'Ligament pubien inférieur', Superior_pubic_ligament: 'Ligament pubien supérieur',
  Interpubic_disc: 'Disque interpubien', Pubic_symphysis: 'Symphyse pubienne', Triradiate_cartilage: 'Cartilage en Y (triradié)', Anterior_sacro_iliac_ligament: 'Ligament sacro-iliaque antérieur',
  'Anterior_sacro-iliac_ligament': 'Ligament sacro-iliaque antérieur', 'Interosseous_sacro-iliac_ligament': 'Ligament sacro-iliaque interosseux', 'Posterior_sacro-iliac_ligament': 'Ligament sacro-iliaque postérieur',
  Sacrospinous_ligament: 'Ligament sacro-épineux', Sacrotuberous_ligament: 'Ligament sacro-tubéral', Obturator_membrane: 'Membrane obturatrice',
  Transverse_tibiofibular_ligament: 'Ligament tibio-fibulaire transverse', Posterior_tibiofibular_ligament: 'Ligament tibio-fibulaire postérieur', Anterior_tibiofibular_ligament: 'Ligament tibio-fibulaire antérieur',
  Interosseous_membrane_of_leg: 'Membrane interosseuse de la jambe', Superficial_part_of_tibial_collateral_ligament: 'Ligament collatéral tibial (partie superficielle)',
  Deep_part_of_tibial_collateral_ligament: 'Ligament collatéral tibial (partie profonde)', Fibular_collateral_ligament: 'Ligament collatéral fibulaire', Meniscopatellar_ligament: 'Ligament ménisco-patellaire',
  Transverse_ligament_of_knee: 'Ligament transverse du genou', 'Anterior_meniscotibial_ligament_(Lateral_meniscus)': 'Ligament ménisco-tibial antérieur (ménisque latéral)',
  'Anterior_meniscotibial_ligament_(Medial_meniscus)': 'Ligament ménisco-tibial antérieur (ménisque médial)', 'Posterior_meniscotibial_ligament_(Medial_meniscus)': 'Ligament ménisco-tibial postérieur (ménisque médial)',
  'Posterior_meniscotibial_ligament_(Lateral_meniscus)': 'Ligament ménisco-tibial postérieur (ménisque latéral)', Popliteofibular_ligament: 'Ligament poplité-fibulaire',
  Lateral_meniscus: 'Ménisque latéral', Medial_meniscus: 'Ménisque médial', Articular_capsule_of_knee_joint: 'Capsule articulaire du genou', Anterior_cruciate_ligament: 'Ligament croisé antérieur (LCA)',
  Posterior_cruciate_ligament: 'Ligament croisé postérieur (LCP)', Patellar_ligament: 'Ligament patellaire (tendon rotulien)', Oblique_popliteal_ligament: 'Ligament poplité oblique', Arcuate_popliteal_ligament: 'Ligament poplité arqué',
  Posterior_meniscofemoral_ligament: 'Ligament ménisco-fémoral postérieur', Anterior_meniscofemoral_ligament: 'Ligament ménisco-fémoral antérieur',
  Metatarsal_interosseous_ligaments: 'Ligaments métatarsiens interosseux', Plantar_metatarsal_ligaments: 'Ligaments métatarsiens plantaires', Dorsal_metatarsal_ligaments: 'Ligaments métatarsiens dorsaux',
  Intersesamoid_ligament: 'Ligament intersésamoïdien', Collateral_interphalangeal_ligaments_of_foot: 'Ligaments collatéraux interphalangiens du pied',
  Articular_capsules_of_proximal_interphalangeal_joints_of_foot: 'Capsules interphalangiennes proximales du pied', Plantar_interphalangeal_ligaments: 'Ligaments interphalangiens plantaires',
  Articular_capsules_of_distal_interphalangeal_joints_of_foot: 'Capsules interphalangiennes distales du pied', Articular_capsule_of_interphalangeal_joint_of_great_toe: "Capsule interphalangienne de l'hallux",
  Plantar_metatarsophalangeal_ligaments: 'Ligaments métatarso-phalangiens plantaires', Collateral_metatarsophalangeal_ligaments: 'Ligaments collatéraux métatarso-phalangiens',
  Articular_capsules_of_metatarsophalangeal_joints: 'Capsules métatarso-phalangiennes', Deep_transverse_metatarsal_ligament: 'Ligament métatarsien transverse profond',
  Dorsal_tarsometatarsal_ligaments: 'Ligaments tarso-métatarsiens dorsaux', Cuneometatarsal_interosseous_ligaments: 'Ligaments cunéo-métatarsiens interosseux (Lisfranc)', Plantar_tarsometatarsal_ligaments: 'Ligaments tarso-métatarsiens plantaires',
  Intercuneiform_interosseous_ligaments: 'Ligaments intercunéiformes interosseux', Plantar_cuneocuboid_ligament: 'Ligament cunéo-cuboïdien plantaire', Plantar_cuneonavicular_ligaments: 'Ligaments cunéo-naviculaires plantaires',
  Calcaneonavicular_ligament: 'Ligament calcanéo-naviculaire', Medial_talocalcaneal_ligament: 'Ligament talo-calcanéen médial', Plantar_calcaneocuboid_ligament: 'Ligament calcanéo-cuboïdien plantaire',
  Lateral_talocalcaneal_ligament: 'Ligament talo-calcanéen latéral', Anterior_talocalcaneal_ligament: 'Ligament talo-calcanéen antérieur', Talocalcaneal_interosseous_ligament: 'Ligament talo-calcanéen interosseux',
  Calcaneocuboid_ligament: 'Ligament calcanéo-cuboïdien', Talonavicular_ligament: 'Ligament talo-naviculaire', Posterior_talocalcaneal_ligament: 'Ligament talo-calcanéen postérieur',
  Plantar_intercuneiform_ligaments: 'Ligaments intercunéiformes plantaires', Plantar_calcaneonavicular_ligament: 'Ligament calcanéo-naviculaire plantaire (glénoïdien)', Dorsal_intercuneiform_ligaments: 'Ligaments intercunéiformes dorsaux',
  Dorsal_cuneonavicular_ligaments: 'Ligaments cunéo-naviculaires dorsaux', Cuneocuboid_interosseous_ligament: 'Ligament cunéo-cuboïdien interosseux', Long_plantar_ligament: 'Ligament plantaire long',
  Dorsal_calcaneocuboid_ligament: 'Ligament calcanéo-cuboïdien dorsal', Bifurcate_ligament: 'Ligament bifurqué', Dorsal_talonavicular_ligament: 'Ligament talo-naviculaire dorsal',
  Articular_capsule_of_hip_joint: 'Capsule articulaire de la hanche', Frenula_capsulae: 'Freins capsulaires', Transverse_acetabular_ligament: "Ligament transverse de l'acétabulum", Pubofemoral_ligament: 'Ligament pubo-fémoral',
  Acetabular_labrum: 'Labrum acétabulaire', Transverse_part_of_iliofemoral_ligament: 'Ligament ilio-fémoral (faisceau transverse)', Descending_part_of_iliofemoral_ligament: 'Ligament ilio-fémoral (faisceau descendant)',
  Zona_orbicularis: 'Zone orbiculaire', Ligament_of_head_of_femur: 'Ligament de la tête fémorale (ligament rond)', Ischiofemoral_ligament: 'Ligament ischio-fémoral',
  Calcaneofibular_ligament: 'Ligament calcanéo-fibulaire', Posterior_talofibular_ligament: 'Ligament talo-fibulaire postérieur', Anterior_talofibular_ligament: 'Ligament talo-fibulaire antérieur (LTFA)',
  Posterior_tibiotalar_ligament: 'Ligament tibio-talien postérieur', Anterior_tibiotalar_ligament: 'Ligament tibio-talien antérieur', Tibiocalcaneal_ligament: 'Ligament tibio-calcanéen', Tibionavicular_ligament: 'Ligament tibio-naviculaire',
  Anterior_ligament_of_fibular_head: 'Ligament antérieur de la tête fibulaire', Articular_capsule_of_superior_tibiofibular_joint: 'Capsule tibio-fibulaire proximale', Posterior_ligament_of_fibular_head: 'Ligament postérieur de la tête fibulaire',
  Lateral_temporomandibular_ligament: 'Ligament latéral temporo-mandibulaire', Articular_capsule_of_temporomandibular_joint: "Capsule de l'ATM", Articular_disc_of_temporomandibular_joint: "Disque de l'ATM",
  Stylomandibular_ligament: 'Ligament stylo-mandibulaire', Sphenomandibular_ligament: 'Ligament sphéno-mandibulaire', Stylohyoid_ligament: 'Ligament stylo-hyoïdien',
  Interosseous_membrane_of_forearm: "Membrane interosseuse de l'avant-bras", Articular_capsule_of_elbow_joint: 'Capsule articulaire du coude', 'Articular_disc_of_distal_radio-ulnar_joint': 'Disque articulaire radio-ulnaire distal (TFCC)',
  'Palmar_radio-ulnar_ligament': 'Ligament radio-ulnaire palmaire', 'Dorsal_radio-ulnar_ligament': 'Ligament radio-ulnaire dorsal', Annular_ligament_of_radius: 'Ligament annulaire du radius',
  Ulnar_collateral_ligament_of_elbow_joint: 'Ligament collatéral ulnaire du coude', Radial_collateral_ligament_of_elbow_joint: 'Ligament collatéral radial du coude', Quadrate_ligament: 'Ligament carré',
  Articular_capsules_of_proximal_interphalangeal_joints: 'Capsules interphalangiennes proximales (main)', Articular_capsules_of_distal_interphalangeal_joints: 'Capsules interphalangiennes distales (main)',
  Palmar_interphalangeal_ligaments: 'Ligaments interphalangiens palmaires', Collateral_interphalangeal_ligaments_of_hand: 'Ligaments collatéraux interphalangiens (main)',
  Palmar_carpometacarpal_ligaments: 'Ligaments carpo-métacarpiens palmaires', Dorsal_carpometacarpal_ligaments: 'Ligaments carpo-métacarpiens dorsaux', Collateral_metacarpophalangeal_ligaments: 'Ligaments collatéraux métacarpo-phalangiens',
  Articular_capsules_of_metacarpophalangeal_joints: 'Capsules métacarpo-phalangiennes', Deep_transverse_metacarpal_ligament: 'Ligament métacarpien transverse profond', Palmar_metacarpal_ligaments: 'Ligaments métacarpiens palmaires',
  Dorsal_metacarpal_ligaments: 'Ligaments métacarpiens dorsaux', Interosseous_metacarpal_ligaments: 'Ligaments métacarpiens interosseux', Triquetrocapitate_ligament: 'Ligament triquétro-capital', Pisotriquetral_ligament: 'Ligament piso-triquétral',
  Pisohamate_ligament: 'Ligament piso-hamatal', Pisometacarpal_ligament: 'Ligament piso-métacarpien', Dorsal_ulnocarpal_ligament: 'Ligament ulno-carpien dorsal', Palmar_scaphotriquetral_ligament: 'Ligament scapho-triquétral palmaire',
  Dorsal_intercarpal_ligaments: 'Ligaments intercarpiens dorsaux', Dorsal_scaphotriquetral_ligament: 'Ligament scapho-triquétral dorsal', Scaphotrapeziotrapezoidal_ligament: 'Ligament scapho-trapézo-trapézoïdien',
  Radiate_carpal_ligament: 'Ligament radié du carpe', Ulnar_collateral_ligament_of_wrist_joint: 'Ligament collatéral ulnaire du poignet', Radial_collateral_ligament_of_wrist_joint: 'Ligament collatéral radial du poignet',
  Superior_glenohumeral_ligament: 'Ligament gléno-huméral supérieur', Middle_glenohumeral_ligament: 'Ligament gléno-huméral moyen', Inferior_glenohumeral_ligament: 'Ligament gléno-huméral inférieur',
  Glenoid_labrum: 'Labrum glénoïdal (bourrelet)', Coracohumeral_ligament: 'Ligament coraco-huméral', Transverse_humeral_ligament: 'Ligament huméral transverse', Articular_capsule_of_glenohumeral_joint: "Capsule de l'épaule (gléno-humérale)",
  Coracoacromial_ligament: 'Ligament coraco-acromial', Coracoclavicular_ligament: 'Ligament coraco-claviculaire', Trapezoid_ligament: 'Ligament trapézoïde', Conoid_ligament: 'Ligament conoïde',
  Superior_transverse_scapular_ligament: 'Ligament transverse supérieur de la scapula', Inferior_transverse_scapular_ligament: 'Ligament transverse inférieur de la scapula',
  Ulnocapitate_ligament: 'Ligament ulno-capital', Ulnotriquetral_ligament: 'Ligament ulno-triquétral', Ulnolunate_ligament: 'Ligament ulno-lunaire', Articular_capsule_of_radiocarpal_joint: 'Capsule radio-carpienne',
  Dorsal_radiocarpal_ligament: 'Ligament radio-carpien dorsal', Radioscaphocapitate_ligament: 'Ligament radio-scapho-capital', Long_radiolunate_ligament: 'Ligament radio-lunaire long', Short_radiolunate_ligament: 'Ligament radio-lunaire court',
  Anterior_sternoclavicular_ligament: 'Ligament sterno-claviculaire antérieur', Posterior_sternoclavicular_ligament: 'Ligament sterno-claviculaire postérieur', Articular_disc_of_sternoclavicular_joint: 'Disque sterno-claviculaire',
  Articular_capsule_of_sternoclavicular_joint: 'Capsule sterno-claviculaire', Articular_capsule_of_acromioclavicular_joint: 'Capsule acromio-claviculaire', Acromioclavicular_ligament: 'Ligament acromio-claviculaire',
  Articular_disc_of_acromioclavicular_joint: 'Disque acromio-claviculaire', Interclavicular_ligament: 'Ligament interclaviculaire', Costoclavicular_ligament: 'Ligament costo-claviculaire',
  Intercornual_ligament: 'Ligament intercornual', Supraspinous_ligament: 'Ligament supra-épineux', Nuchal_ligament: 'Ligament nucal', Interspinous_ligaments: 'Ligaments interépineux',
  Anterior_longitudinal_ligament: 'Ligament longitudinal antérieur', Posterior_longitudinal_ligament: 'Ligament longitudinal postérieur', Ligamenta_flava: 'Ligaments jaunes', Intertransverse_ligaments: 'Ligaments intertransversaires',
  Sacrococcygeal_symphysis: 'Symphyse sacro-coccygienne', 'Intra-articular_ligament_of_head_of_rib': 'Ligament intra-articulaire de la tête costale', Internal_intercostal_membrane: 'Membrane intercostale interne',
  External_intercostal_membrane: 'Membrane intercostale externe', Radiate_ligament_of_head_of_rib: 'Ligament radié de la tête costale', Costotransverse_ligament: 'Ligament costo-transversaire',
  Superior_costotransverse_ligament: 'Ligament costo-transversaire supérieur', Lateral_costotransverse_ligament: 'Ligament costo-transversaire latéral', Radiate_sternocostal_ligaments: 'Ligaments sterno-costaux radiés',
  Anterior_atlanto_occipital_membrane: 'Membrane atlanto-occipitale antérieure', 'Anterior_atlanto-occipital_membrane': 'Membrane atlanto-occipitale antérieure', 'Posterior_atlanto-occipital_membrane': 'Membrane atlanto-occipitale postérieure',
  Alar_ligaments: 'Ligaments alaires', Cruciate_ligament_of_atlas: "Ligament cruciforme de l'atlas", Transverse_ligament_of_atlas: "Ligament transverse de l'atlas", Tectorial_membrane: 'Membrane tectoriale',
  Apical_ligament_of_dens: "Ligament de l'apex de la dent", Anterior_sacrococcygeal_ligament: 'Ligament sacro-coccygien antérieur',
  // ---------- Nerfs ----------
  White_matter_of_spinal_cord: 'Moelle spinale', Sympathetic_nerves: 'Nerfs sympathiques', Sympathetic_trunk: 'Tronc sympathique', Ganglia_of_sympathetic_trunk: 'Ganglions du tronc sympathique',
  'Hypoglossal_nerve_(XII)': 'Nerf hypoglosse (XII)', 'Accessory_nerve_(XI)': 'Nerf accessoire (XI)', 'Vagus_nerve_(X)': 'Nerf vague (X)', 'Facial_nerve_(VII)': 'Nerf facial (VII)', 'Trigeminal_nerve_(V)': 'Nerf trijumeau (V)',
  Radial_nerve: 'Nerf radial', Inferior_lateral_brachial_cutaneous_nerve: 'Nerf cutané latéral inférieur du bras', Superficial_branch_of_radial_nerve: 'Branche superficielle du nerf radial',
  Dorsal_digital_branches_of_radial_nerve: 'Nerfs digitaux dorsaux (radial)', Deep_branch_of_radial_nerve: 'Branche profonde du nerf radial', Posterior_interosseous_nerve_of_forearm: "Nerf interosseux postérieur",
  Posterior_antebrachial_cutaneous_nerve: "Nerf cutané postérieur de l'avant-bras", Muscular_branches_of_radial_nerve: 'Branches musculaires du nerf radial', Inferior_subscapular_nerve: 'Nerf subscapulaire inférieur',
  Superior_subscapular_nerve: 'Nerf subscapulaire supérieur', Axillary_nerve: 'Nerf axillaire', Superior_lateral_brachial_cutaneous_nerve: 'Nerf cutané latéral supérieur du bras', Muscular_branches_of_axillary_nerve: 'Branches musculaires du nerf axillaire',
  Thoracodorsal_nerve: 'Nerf thoraco-dorsal', Median_nerve: 'Nerf médian', Anterior_interosseous_nerve_of_forearm: 'Nerf interosseux antérieur', '(Communicating_branch_of_median_nerve_with_ulnar_nerve)': 'Anastomose médian-ulnaire',
  Palmar_branch_of_median_nerve: 'Branche palmaire du nerf médian', Muscular_branches_of_median_nerve: 'Branches musculaires du nerf médian', Common_palmar_digital_branches_of_median_nerve: 'Nerfs digitaux palmaires communs (médian)',
  Proper_palmar_digital_branches_of_median_nerve: 'Nerfs digitaux palmaires propres (médian)', Medial_pectoral_nerve: 'Nerf pectoral médial', Lateral_pectoral_nerve: 'Nerf pectoral latéral', Medial_antebrachial_cutaneous_nerve: "Nerf cutané médial de l'avant-bras",
  Posterior_branch_of_medial_antebrachial_cutaneous_nerve: "Nerf cutané médial de l'avant-bras (branche postérieure)", Anterior_branch_of_medial_antebrachial_cutaneous_nerve: "Nerf cutané médial de l'avant-bras (branche antérieure)",
  Medial_brachial_cutaneous_nerve: 'Nerf cutané médial du bras', Ulnar_nerve: 'Nerf ulnaire (cubital)', Deep_branch_of_ulnar_nerve: 'Branche profonde du nerf ulnaire', Palmar_branch_of_ulnar_nerve: 'Branche palmaire du nerf ulnaire',
  Dorsal_branch_of_ulnar_nerve: 'Branche dorsale du nerf ulnaire', Dorsal_digital_branches_of_ulnar_nerve: 'Nerfs digitaux dorsaux (ulnaire)', Superficial_branch_of_ulnar_nerve: 'Branche superficielle du nerf ulnaire',
  Common_palmar_digital_branches_of_ulnar_nerve: 'Nerfs digitaux palmaires communs (ulnaire)', Proper_palmar_digital_branches_of_ulnar_nerve: 'Nerfs digitaux palmaires propres (ulnaire)', Muscular_branches_of_ulnar_nerve: 'Branches musculaires du nerf ulnaire',
  Posterior_cord_of_brachial_plexus: 'Faisceau postérieur du plexus brachial', Lateral_cord_of_brachial_plexus: 'Faisceau latéral du plexus brachial', Medial_cord_of_brachial_plexus: 'Faisceau médial du plexus brachial',
  Suprascapular_nerve: 'Nerf suprascapulaire', Subclavian_nerve: 'Nerf du muscle subclavier', Long_thoracic_nerve: 'Nerf thoracique long', Dorsal_scapular_nerve: 'Nerf dorsal de la scapula',
  Middle_trunk_of_brachial_plexus: 'Tronc moyen du plexus brachial', Posterior_division_of_middle_trunk_of_brachial_plexus: 'Tronc moyen du plexus brachial (division postérieure)',
  Anterior_division_of_middle_trunk_of_brachial_plexus: 'Tronc moyen du plexus brachial (division antérieure)', Inferior_trunk_of_brachial_plexus: 'Tronc inférieur du plexus brachial',
  Anterior_division_of_inferior_trunk_of_brachial_plexus: 'Tronc inférieur du plexus brachial (division antérieure)', Posterior_division_of_inferior_trunk_of_brachial_plexus: 'Tronc inférieur du plexus brachial (division postérieure)',
  Superior_trunk_of_brachial_plexus: 'Tronc supérieur du plexus brachial', Posterior_division_of_superior_trunk_of_brachial_plexus: 'Tronc supérieur du plexus brachial (division postérieure)',
  Anterior_division_of_superior_trunk_of_brachial_plexus: 'Tronc supérieur du plexus brachial (division antérieure)', Roots_of_brachial_plexus: 'Racines du plexus brachial', Musculocutaneous_nerve: 'Nerf musculo-cutané',
  Lateral_antebrachial_cutaneous_nerve: "Nerf cutané latéral de l'avant-bras", Posterior_root_of_spinal_nerve: 'Racines postérieures des nerfs spinaux', Anterior_root_of_spinal_nerve: 'Racines antérieures des nerfs spinaux',
  'Ilio-inguinal_nerve': 'Nerf ilio-inguinal', Iliohypogastric_nerve: 'Nerf ilio-hypogastrique', Lateral_femoral_cutaneous_nerve: 'Nerf cutané latéral de la cuisse', Femoral_nerve: 'Nerf fémoral (crural)',
  Anterior_cutaneous_branches_of_femoral_nerve: 'Branches cutanées antérieures du nerf fémoral', Saphenous_nerve: 'Nerf saphène', Medial_crural_cutaneous_branches_of_saphenous_nerve: 'Branches cutanées crurales médiales du nerf saphène',
  Infrapatellar_branch_of_saphenous_nerve: 'Branche infrapatellaire du nerf saphène', Genitofemoral_nerve: 'Nerf génito-fémoral', Genital_branch_of_genitofemoral_nerve: 'Branche génitale du nerf génito-fémoral',
  Femoral_branch_of_genitofemoral_nerve: 'Branche fémorale du nerf génito-fémoral', Obturator_nerve: 'Nerf obturateur', Posterior_branch_of_obturator_nerve: 'Branche postérieure du nerf obturateur', Anterior_branch_of_obturator_nerve: 'Branche antérieure du nerf obturateur',
  Posterior_root_of_posterior_femoral_cutaneous_nerve: 'Nerf cutané postérieur de la cuisse (racine postérieure)', Anterior_root_of_posterior_femoral_cutaneous_nerve: 'Nerf cutané postérieur de la cuisse (racine antérieure)',
  Posterior_femoral_cutaneous_nerve: 'Nerf cutané postérieur de la cuisse', Nerve_to_quadratus_femoris_muscle: 'Nerf du carré fémoral', Nerve_to_piriformis_muscle: 'Nerf du piriforme', Superior_gluteal_nerve: 'Nerf glutéal supérieur',
  Inferior_gluteal_nerve: 'Nerf glutéal inférieur', Sciatic_nerve: 'Nerf sciatique', Tibial_nerve: 'Nerf tibial', Lateral_plantar_nerve: 'Nerf plantaire latéral', Common_plantar_digital_branches_of_lateral_plantar_nerve: 'Nerfs digitaux plantaires communs (plantaire latéral)',
  Proper_plantar_digital_branches_of_lateral_plantar_nerve: 'Nerfs digitaux plantaires propres (plantaire latéral)', Medial_plantar_nerve: 'Nerf plantaire médial', Common_plantar_digital_branches_of_medial_plantar_nerve: 'Nerfs digitaux plantaires communs (plantaire médial)',
  Common_plantar_digital_branches_of_medial_plantar_nervel: 'Nerfs digitaux plantaires communs (plantaire médial)', Proper_plantar_digital_branches_of_medial_plantar_nerve: 'Nerfs digitaux plantaires propres (plantaire médial)',
  Medial_sural_cutaneous_nerve: 'Nerf cutané sural médial', Lateral_sural_cutaneous_nerve: 'Nerf cutané sural latéral', Sural_nerve: 'Nerf sural', Common_fibular_nerve: 'Nerf fibulaire commun (sciatique poplité externe)',
  Superficial_fibular_nerve: 'Nerf fibulaire superficiel', Intermediate_dorsal_cutaneous_nerve_of_foot: 'Nerf cutané dorsal intermédiaire du pied', Medial_dorsal_cutaneous_nerve_of_foot: 'Nerf cutané dorsal médial du pied',
  Lateral_dorsal_cutaneous_nerve_of_foot: 'Nerf cutané dorsal latéral du pied', Dorsal_digital_branches_of_superficial_fibular_nerve: 'Nerfs digitaux dorsaux (fibulaire superficiel)', Sural_communicating_branch_of_common_fibular_nerve: 'Rameau communicant sural',
  Deep_fibular_nerve: 'Nerf fibulaire profond', Muscular_branches_of_deep_fibular_nerve: 'Branches musculaires du nerf fibulaire profond', Dorsal_digital_branches_of_deep_fibular_nerve: 'Nerfs digitaux dorsaux (fibulaire profond)',
  Pudendal_nerve: 'Nerf pudendal', Intercostal_nerves: 'Nerfs intercostaux', Cauda_equina: 'Queue de cheval', Subcostal_nerve: 'Nerf subcostal', Phrenic_nerve: 'Nerf phrénique',
  Greater_occipital_nerve: "Nerf grand occipital (d'Arnold)", Lesser_occipital_nerve: 'Nerf petit occipital', Peau: 'Peau',
};

DICO.Iliocostalis_colli_muscler = DICO.Iliocostalis_colli_muscle;
DICO['Intra-articular_ligament_of_head_of_ribr'] = DICO['Intra-articular_ligament_of_head_of_rib'];

const DENTS = { incisor: 'incisive', canine: 'canine', premolar: 'prémolaire', molar_tooth: 'molaire', molar: 'molaire' };

function regles(b) {
  let m;
  if ((m = b.match(/^Vertebra_([CTL])(\d+)$/))) return 'Vertèbre ' + m[1].replace('T', 'T') + m[2];
  if ((m = b.match(/^Intervertebral_disc_(.+)$/))) return 'Disque intervertébral ' + m[1];
  if ((m = b.match(/^Nucleus_pulposus_(.+)$/))) return 'Noyau pulpeux ' + m[1];
  if ((m = b.match(/^Costal_cartilage_of_(\w+?)_rib$/))) return 'Cartilage costal (' + ordFr(ORD[m[1]]) + ' côte)';
  if ((m = b.match(/^(\w+?)_rib$/)) && ORD[m[1].toLowerCase()]) return ordFr(ORD[m[1].toLowerCase()]) + ' côte';
  if ((m = b.match(/^(Proximal|Middle|Distal)_phalanx_of_(\w+?)_finger_of_(hand|foot)$/))) {
    const n = ORD[m[2]]; return 'Phalange ' + PHAL[m[1]] + ' ' + (m[3] === 'hand' ? DOIGT[n] : ORTEIL[n]);
  }
  if ((m = b.match(/^(\w+?)_(metatarsal|metacarpal)_bone$/))) return ordFrM(ORD[m[1].toLowerCase()]) + (m[2] === 'metatarsal' ? ' métatarsien' : ' métacarpien');
  if ((m = b.match(/^(Upper|Lower)_(?:(first|second|medial|lateral)_)?(incisor|canine|premolar|molar_tooth|molar)$/))) {
    const q = { first: '1re ', second: '2e ', medial: '', lateral: '' }[m[2]] || '';
    const pos = m[2] === 'medial' ? ' centrale' : m[2] === 'lateral' ? ' latérale' : '';
    return (q + DENTS[m[3]] + pos + (m[1] === 'Upper' ? ' supérieure' : ' inférieure')).replace(/^./, c => c.toUpperCase());
  }
  if ((m = b.match(/^(Upper|Lower)_third_molar/))) return '3e molaire ' + (m[1] === 'Upper' ? 'supérieure' : 'inférieure');
  return null;
}

// Fiches Z-Anatomy (CC BY-SA, issues de Wikipédia)
const DDEF = '../sources-za/repo/Resources/Descriptions/French definitions/';
const norm = s => s.toLowerCase().replace(/-fr\.txt$/, '').replace(/[()]/g, '').replace(/_/g, ' ').replace(/ muscles?$/, '').replace(/^muscle /, '').trim();
const fiches = new Map();
for (const fn of fs.readdirSync(DDEF)) fiches.set(norm(fn), fn);

function propre(t) {
  t = t.trim().toLowerCase().replace(/^muscles? /, '');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function fiche(base) {
  const fn = fiches.get(norm(base));
  if (!fn) return null;
  const brut = fs.readFileSync(DDEF + fn, 'utf8').replace(/\r/g, '').trim();
  const lignes = brut.split('\n');
  const titre = lignes.shift();
  let source = '';
  const corps = [];
  for (const l of lignes) { if (/^https?:\/\//.test(l.trim())) source = l.trim(); else corps.push(l); }
  const texte = corps.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return { titre: propre(titre), texte, source };
}

export function nomFr(base) {
  if (DICO[base]) return DICO[base];
  const r = regles(base); if (r) return r;
  const f = fiche(base); if (f) return f.titre;
  return null;
}
