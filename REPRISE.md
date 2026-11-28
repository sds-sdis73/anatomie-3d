# Anatomie 3D — notes de reprise

Atlas d'anatomie 3D en page web, conçu pour l'iPad mini 2 (iOS 12, Safari 12) du cabinet d'ostéopathie.
S'ouvre en plein écran depuis l'écran d'accueil et fonctionne hors connexion après le premier chargement.

## Arborescence
- `docs/` : l'application publiée (GitHub Pages sert ce dossier).
  - `index.html`, `style.css`, `app.js` : interface et logique.
  - `sw.js` : service worker (mise en cache pour le hors connexion).
  - `vendor/` : three.js r128 + OrbitControls (dernière version compatible Safari 12 sans transpilation).
  - `donnees/` : modèles convertis (`*.bin`), `manifeste.json` (liste des pièces), `fiches.json` (fiches françaises) — corps entier.
  - `donnees/<region>/` : mêmes fichiers, plus détaillés, pour `tete-cou`, `tronc`, `membre-superieur`, `membre-inferieur`
    (le manifeste d'une région porte en plus `region`, `nom` et `boite` = boîte englobante en cm).
- `outils/` : chaîne de conversion (Node).
  - `construire.mjs` : lit les FBX Z-Anatomy, sélectionne, allège (meshoptimizer), quantifie, écrit `docs/donnees/`.
  - `couches.mjs` : classement des muscles en plans superficiel (3) / moyen (2) / profond (1).
  - `fr.mjs` : noms français (dictionnaire + règles + terminologie TA2 + titres des fiches Z-Anatomy).
  - `ta2.mjs` : Terminologia Anatomica 2 (anglais → latin, français), fichier `sources-za/TA2.csv`.
  - `descriptions-muscles.mjs` : fiche courte de chaque muscle (origine, terminaison, innervation, action), rédaction propre à faire relire.
  - `regions.mjs` : définition des régions (os de chaque région, groupes Z-Anatomy permis, marges, budgets).
  - `sources.mjs` : emplacement des sources Z-Anatomy (variable `SOURCES_ZA`).
  - `captures-regions.mjs` : captures de contrôle des régions avec le prototype → `conception/regions/`.
  - `test-ecran.mjs` : tests visuels avec Chrome sans fenêtre (`node test-ecran.mjs shot:nom` → capture dans le dossier temporaire).
  - `icone.mjs` : génère l'icône 180 px.
- `sources-za/`, `sources-bp3d/` : données brutes téléchargées (non versionnées, ~600 Mo).

## Reconstruire les données
```
cd outils
npm install            # three@0.160 (lecture FBX côté Node), meshoptimizer, puppeteer-core
# si sources-za/ est absent :
#   git clone --depth 1 --filter=blob:none --sparse -b PC-Version https://github.com/LluisV/Z-Anatomy.git ../sources-za/repo
#   cd ../sources-za/repo && git sparse-checkout set --no-cone "/Resources/Descriptions/French definitions/" "/Resources/Models/FBX/SkeletalSystem100.fbx" "/Resources/Models/FBX/MuscularSystem100.fbx" "/Resources/Models/FBX/Joints100.fbx" "/Resources/Models/FBX/NervousSystem100.fbx" "/Resources/Models/FBX/Regions of human body100.fbx"
node construire.mjs
node ao.mjs          # ombres de contact + fibres musculaires (~35 s), À relancer après chaque construire.mjs
```
Taux d'allègement par couche : constante `RATIO` dans `construire.mjs`.
Sources : `SOURCES_ZA=/chemin/vers/sources-za node construire.mjs` (par défaut `../sources-za`, sinon `~/Downloads/atlas-anatomie/sources-za`).

### Régions détaillées (`docs/donnees/<region>/`)
```
cd outils
node construire.mjs --regions          # les quatre régions (≈ 1 min) ; --regions tronc,tete-cou pour en refaire certaines
node ao.mjs --regions                  # ombres + fibres de chaque région (≈ 2 à 3 min) ; ou node ao.mjs ../docs/donnees/tronc
node captures-regions.mjs              # captures de contrôle dans conception/regions/ (à regarder)
cd ../tests && node lancer.mjs --rapide   # budgets (620 k triangles, 9 Mo au démarrage) et cache hors connexion
```
- Appartenance : chaque sommet est rattaché à la région de l'os le plus proche (grille de 1 cm) ; les ceintures scapulaire
  et pelvienne sont à la fois dans le tronc et dans le membre. Os : liste explicite (`regionsOs`). Muscles, ligaments, organes :
  groupe Z-Anatomy permis (`regionsPermises`) puis pièce gardée entière si au moins la moitié de ses sommets est dans la région.
  Peau, nerfs et vaisseaux : découpés net au bord (marge de contexte 2,5 cm pour la peau, 0,5 cm pour nerfs et vaisseaux).
- Niveau de détail : calculé automatiquement pour remplir le budget du démarrage (`BUDGET_DEMARRAGE`) ; les paquets à la demande
  sont limités à `BUDGET_DEMANDE` triangles.
- `node construire.mjs` sans option ne touche qu'au corps entier (résultat identique octet pour octet à la version 1.2.1).
- Les fichiers des régions sont listés dans `docs/sw.js` (objet `REGIONS`) : à tenir à jour si un paquet apparaît ou disparaît
  (le test des données le signale).

## Publier une nouvelle version
1. Incrémenter `VERSION` dans `docs/app.js`.
2. Dans `docs/sw.js` : changer `CACHE` et les `?v=` de la liste des fichiers.
3. Dans `docs/index.html` : changer les `?v=` de `style.css` et `app.js` (et dans `sw.js`).
4. `git commit` puis `git push` : GitHub Pages republie en une minute environ.
5. Sur l'iPad : ouvrir l'appli deux fois (la 1re ouverture télécharge la nouvelle version, la 2e l'affiche).

## Contraintes Safari 12 (à respecter dans `app.js` / `style.css`)
- Pas de `?.`, `??`, `Object.fromEntries`, `replaceAll`, `matchAll`, `Promise.allSettled`.
- Pas d'événements `pointer` sur iOS 12 : les gestes passent par `touchstart/touchmove/touchend`.
- CSS : pas de `gap` en flexbox (marges à la place), pas de `inset`, pas d'`aspect-ratio`.
- three.js : ne pas dépasser r128 sans vérifier la syntaxe du fichier compilé.

## Paquets de données
- Chargés au démarrage : os, muscles, articulations, nerfs, peau.
- Chargés à la demande (bascule « Systèmes » ou recherche) : insertions, cardio, visceres (respiratoire, digestif, urinaire, génital, endocrinien), lymphatique, encephale, sens (œil, oreille).
- Le service worker met tout en cache dès l'installation (≈ 15 Mo) pour le hors connexion complet.

## Fonctions (v1.1.0, alignées sur « Anatomie – Atlas 3D » de Catfish Animation Studio)
Couches à éplucher, systèmes, toucher pour nommer, sélection multiple, isoler / masquer / transparent, recherche (français, latin, anglais),
fiches muscles + descriptions, vues mémorisées, nom secondaire (latin / anglais), lumière d'endoscope, dessin, quiz (« Où est… ? », « Qu'est-ce que c'est ? »).
Non reproductible : la réalité augmentée (pas d'ARKit ni de WebXR dans Safari 12). Pas de modèle génital féminin dans Z-Anatomy.

## Rendu (v1.2.0)
- Matériau unique `tissu()` dans `app.js` : éclairage studio précalculé (matcap généré au démarrage), ombres de contact (attribut `ao`, fichiers `ao-os.bin` / `ao-muscles.bin`) et fibres musculaires (attribut `fs`, fichier `fibres-s.bin`).
- `fs` = position « en travers des fibres » : angle autour du point de convergence pour les muscles en éventail, distance latérale à l'axe sinon. Les attaches sont regroupées par position (les étiquettes origine/terminaison de la source sont parfois inversées).
- Le rendu des fibres exige `OES_standard_derivatives` (WebGL 1) ; sans elle, muscles lisses. Interrupteur « Fibres musculaires détaillées » dans Couches.
- Prototype de réglage du rendu : `prototype/index.html` (paramètres dans l'adresse : `cible`, `dir`, `dist`, `niveau`, `cote`, `fond=clair`,
  `donnees=../docs/donnees/tronc/` pour un autre jeu, `extra=peau,nerfs,cardio` pour afficher d'autres paquets).

## Repères du modèle
- Unités : cm ; Y vers le haut (pieds à 0, tête à ~171) ; avant du corps vers +Z ; côté gauche du patient vers +X.
- Les pièces gauches de Z-Anatomy sont des copies en miroir : l'ordre des sommets est rétabli à la conversion.
- Insertions (origine orange / terminaison verte) : 174 muscles sur 216 en ont dans les données sources.

## Licences
- Modèles : Z-Anatomy, d'après BodyParts3D (DBCLS) — CC BY-SA 4.0. Les fichiers de `docs/donnees/` en sont dérivés et restent sous CC BY-SA 4.0.
- Fiches : Z-Anatomy d'après Wikipédia — CC BY-SA.
- three.js : MIT (`docs/vendor/three-LICENSE.txt`).
