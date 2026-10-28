#!/bin/sh
# Sauvegarde quotidienne : base de données (option base-locale) et copie hors du serveur dans le stockage objet OVHcloud.
# Planification sur le serveur (faite par installer.sh) : 30 2 * * * /opt/lexpatria/deploiement/sauvegarde-base.sh
set -eu
cd "$(dirname "$0")/.."
mkdir -p sauvegardes
nom="lexpatria-$(date +%Y%m%d-%H%M).sql.gz"
fichier="sauvegardes/$nom"
docker compose exec -T base pg_dump -U lexpatria lexpatria | gzip > "$fichier"
# Conservation sur le serveur : 30 jours.
find sauvegardes -name 'lexpatria-*.sql.gz' -mtime +30 -delete
echo "Sauvegarde : $fichier"
# Copie externe (ignorée tant que le stockage objet n'est pas configuré au back office).
docker compose exec -T app node outils/sauvegarde-externe.mjs base "$nom" < "$fichier" || echo "Copie externe de la base impossible."
docker compose exec -T app node outils/sauvegarde-externe.mjs pieces || echo "Copie externe des pièces impossible."
