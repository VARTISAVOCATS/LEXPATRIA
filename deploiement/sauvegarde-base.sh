#!/bin/sh
# Sauvegarde quotidienne de la base (option base-locale uniquement ; la base gérée OVH est sauvegardée par OVH).
# Planification sur le serveur : crontab -e  puis  30 2 * * * /opt/lexpatria/deploiement/sauvegarde-base.sh
set -eu
cd "$(dirname "$0")/.."
mkdir -p sauvegardes
fichier="sauvegardes/lexpatria-$(date +%Y%m%d-%H%M).sql.gz"
docker compose exec -T base pg_dump -U lexpatria lexpatria | gzip > "$fichier"
# Conservation : 30 jours.
find sauvegardes -name 'lexpatria-*.sql.gz' -mtime +30 -delete
echo "Sauvegarde : $fichier"
