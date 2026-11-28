# Refonte 1.3 — cahier des charges

Référence visuelle validée par l'utilisateur : `conception/maquette.html` (ouvrir dans un navigateur, images dans `conception/img/`).
Le rendu réaliste (v1.2) est validé : ne pas le modifier, sauf l'ajout du plan de coupe.

## Règles communes à tout le travail
- Lire d'abord `REPRISE.md` (contraintes Safari 12 / iPad mini 2, arborescence, publication).
- **Les tests sont la porte d'entrée** : `cd tests && npm install && node lancer.mjs` doit être vert avant de déclarer un travail fini.
  `node lancer.mjs --rapide` (1 s) à chaque modification ; la batterie complète (≈ 40 s) à chaque étape.
- Quand l'interface change, adapter **uniquement** `tests/interface.mjs` (correspondance action → élément) ; ne jamais affaiblir un contrôle existant pour le faire passer.
- Toute nouvelle fonction reçoit au moins un contrôle dans `tests/t-parcours.mjs`.
- Ne jamais publier (`git push`, `deployer.sh`) : l'intégrateur s'en charge.
- Tout le texte visible est en français correct (accents compris).
- Compatibilité : pas de `?.`, `??`, flex `gap`, `inset`, `clamp()`, unités `cq*`, événements `pointer` non protégés — `tests/t-compat.mjs` le vérifie.

## Contrat des jeux de données (entre les deux chantiers)
- `docs/donnees/` = corps entier (existant, inchangé).
- `docs/donnees/<region>/` = même format de fichiers (manifeste.json, os.bin, muscles.bin, articulations.bin, nerfs.bin, peau.bin,
  insertions.bin, cardio.bin, visceres.bin, lymphatique.bin, encephale.bin, sens.bin, ao-os.bin, ao-muscles.bin, fibres-s.bin, fiches.json),
  pour les régions : `tete-cou`, `tronc`, `membre-superieur`, `membre-inferieur`.
  Un paquet sans pièce dans la région peut être absent ; le manifeste ne référence alors aucune pièce de ce paquet.
- Repères (cm, Y vers le haut, pieds à 0, avant vers +Z, gauche du patient vers +X) : mandibule y≈152, C7 y≈145, clavicules y≈141,
  humérus x≈±20 y≈124, os coxaux y≈89, fémurs y≈66.

## Chantier A — modèles détaillés par région (dossier `outils/`, sortie `docs/donnees/<region>/`)
- Pour chaque région, sélectionner les pièces qui lui appartiennent (avec une marge pour le contexte) et les alléger **moins** que le corps entier,
  en restant dans le budget iPad mini 2 contrôlé par `tests/t-donnees.mjs` (≤ 620 k triangles et ≤ 9 Mo au démarrage par jeu).
- Membres : les deux côtés. Tronc : du bas du cou au bas du bassin, avec les ceintures scapulaire et pelvienne.
- Mêmes noms français, mêmes fiches, mêmes plans musculaires, ombres de contact et fibres recalculées (`ao.mjs` paramétré par dossier).
- Les FBX sources sont dans `/Users/toutoune/Downloads/atlas-anatomie/sources-za/` (lecture seule) ; rendre le chemin paramétrable.
- Ajouter les fichiers des régions dans la liste du service worker (`docs/sw.js`, chemin `donnees/<region>/...`).
- Documenter la commande de reconstruction dans `REPRISE.md`.

## Chantier B — disposition, gestes, accueil, coupe (dossier `docs/`, hors `docs/donnees/`)
Conforme à la maquette :
1. **Écran d'accueil** : vignettes Corps entier, Tête et cou, Tronc, Membre supérieur, Membre inférieur, Squelette ; puces des systèmes ;
   « Mes vues ». Choisir une région charge `donnees/<region>/` ; **si ce dossier n'existe pas (404), retomber sur le corps entier**
   et cadrer la caméra sur la région. « Squelette » = corps entier au niveau squelette.
2. **Barre du haut** en verre fumé : « ‹ Accueil », nom de la région, recherche, signets (vues), réglages (langue secondaire, endoscope, fibres, à propos).
3. **Règle des couches** à droite : Peau, Fascias, Muscles superficiels, moyens, profonds, Ligaments, Os ; un seul geste de glisser le doigt
   sur la règle enlève / remet les couches ; un œil par couche pour la montrer / cacher seule ; appui long sur une couche = n'afficher qu'elle
   (second appui long = tout rétablir) ; systèmes (nerfs, cœur et vaisseaux, organes, encéphale…) sous un séparateur ; choix du côté
   Droit / Les deux / Gauche en bas.
4. **Étiquette accrochée** à la structure touchée (trait vers le point touché), nom, nom secondaire (latin/anglais), boutons Fiche / Isoler / Masquer ;
   la carte actuelle disparaît.
5. **Barre d'outils** en bas : Nommer, Plusieurs, Transparent, Isoler, Masquer, Tout voir, Dessiner, Coupe.
6. **Gestes** : appui long sur une structure = petit menu (masquer, isoler, transparent, fiche) ; double toucher = centrer et rapprocher.
   Les gestes existants (un doigt tourne, deux doigts déplacent, pincer zoome vers les doigts) ne doivent pas régresser — tests existants.
7. **Coupe** : plan de coupe réglable (sagittal, frontal, transversal) avec un curseur de position ; les fragments au-delà du plan sont écartés
   dans le shader `tissu()` ; le toucher et le dessin ignorent la partie coupée.
8. Garder toutes les fonctions existantes : recherche, fiches, insertions, sélection multiple, transparence, vues mémorisées, dessin,
   quiz (accessible depuis l'accueil et la barre d'outils ou les réglages), endoscope, fibres, langue secondaire.
9. Version 1.3.0 (app.js, index.html ?v=, sw.js).
10. Images de référence : après validation visuelle de ses propres captures, régénérer avec `node lancer.mjs --maj-references`
    et le signaler dans le compte rendu (l'intégrateur les relit).
