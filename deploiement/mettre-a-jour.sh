#!/usr/bin/env bash
# Mise à jour de Lexpatria depuis GitHub (sauvegarde de la base avant, migrations appliquées au démarrage).
#   sudo bash /opt/lexpatria/deploiement/mettre-a-jour.sh
set -euo pipefail
cd "$(dirname "$0")/.."
./deploiement/sauvegarde-base.sh
git pull --ff-only
docker compose up -d --build
docker image prune -f >/dev/null
sleep 10
curl -fsS "https://$(grep '^DOMAINE=' .env | cut -d= -f2)/api/sante" && echo " : mise à jour terminée."
