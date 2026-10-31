#!/usr/bin/env bash
# Mise à jour de Lexpatria depuis GitHub (sauvegarde de la base avant, migrations appliquées au démarrage).
#   sudo bash /opt/lexpatria/deploiement/mettre-a-jour.sh
set -euo pipefail
cd "$(dirname "$0")/.."
sh ./deploiement/sauvegarde-base.sh
# Fichiers suivis modifiés directement sur le serveur : copie conservée dans sauvegardes/, puis retour à la version de GitHub.
if ! git diff --quiet; then
  git diff > "sauvegardes/modifs-serveur-$(date +%Y%m%d-%H%M).patch"
  git checkout -- .
fi
git pull --ff-only
chmod +x deploiement/*.sh
docker compose up -d --build
docker image prune -f >/dev/null
sleep 10
curl -fsS "https://$(grep '^DOMAINE=' .env | cut -d= -f2)/api/sante" && echo " : mise à jour terminée."
