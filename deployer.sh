#!/bin/sh
# Mise en ligne contrôlée : tests complets → vérification de version → publication → contrôle de la version en ligne.
set -e
cd "$(dirname "$0")"
URL=https://sds-sdis73.github.io/anatomie-3d/
V=$(grep -o "var VERSION = '[0-9.]*'" docs/app.js | grep -o "[0-9.]*")
EN_LIGNE=$(curl -s "${URL}app.js?nocache=$(date +%s)" | grep -o "var VERSION = '[0-9.]*'" | grep -o "[0-9.]*" || true)
echo "Version locale : $V — version en ligne : ${EN_LIGNE:-aucune}"
[ "$V" = "$EN_LIGNE" ] && { echo "La version n'a pas été incrémentée : l'iPad garderait l'ancienne en cache. Arrêt."; exit 1; }
[ -n "$(git status --porcelain)" ] && { echo "Des modifications ne sont pas enregistrées (git commit). Arrêt."; exit 1; }
echo "1/3 Contrôles complets…"
(cd tests && node lancer.mjs) | tail -1
echo "2/3 Publication…"
TESTS_DEJA_PASSES=1 git push -q
printf "   attente de GitHub Pages"
for i in $(seq 1 40); do
  sleep 15; printf "."
  curl -s "${URL}app.js?nocache=$(date +%s)" | grep -q "var VERSION = '$V'" && break
done
echo
echo "3/3 Contrôle de la version en ligne…"
(cd tests && node lancer.mjs --en-ligne "$URL") | tail -1
echo "Version $V en ligne et vérifiée."
