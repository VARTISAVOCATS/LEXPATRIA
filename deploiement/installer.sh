#!/usr/bin/env bash
# Installation de Lexpatria sur le VPS (Ubuntu 24.04), en une fois :
#   sudo bash /opt/lexpatria/deploiement/installer.sh
# Le script installe Docker et le pare-feu, crée le fichier .env avec des secrets générés sur le serveur,
# démarre la base, l'application, le serveur web (HTTPS automatique) et les tâches planifiées,
# crée les comptes de l'équipe et planifie la sauvegarde quotidienne de la base.
# Rien de secret n'est affiché ni transmis : les clés sont saisies sur le serveur et restent dans .env (droits 600).
set -euo pipefail
cd "$(dirname "$0")/.."
[ "$(id -u)" -eq 0 ] || { echo "Lancez ce script avec sudo."; exit 1; }

echo "== 1/6 Paquets système, pare-feu et mises à jour de sécurité automatiques"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq docker.io docker-compose-v2 ufw fail2ban unattended-upgrades openssl >/dev/null
systemctl enable --now docker >/dev/null
ufw allow OpenSSH >/dev/null && ufw allow 80/tcp >/dev/null && ufw allow 443 >/dev/null && ufw --force enable >/dev/null
dpkg-reconfigure -f noninteractive unattended-upgrades >/dev/null 2>&1 || true

echo "== 2/6 Fichier de configuration (.env)"
if [ ! -f .env ]; then
  read -rp "Nom de domaine [lexpatria.fr] : " DOMAINE; DOMAINE=${DOMAINE:-lexpatria.fr}
  read -rp "Adresse d'expédition des e-mails (domaine authentifié dans Brevo, ex. contact@${DOMAINE}) : " EXPEDITEUR
  read -rsp "Clé API Brevo (la saisie ne s'affiche pas) : " BREVO; echo
  PG=$(openssl rand -hex 24)
  umask 077
  cat > .env <<FIN
COMPOSE_PROFILES=base-locale
DOMAINE=${DOMAINE}
URL_PUBLIQUE=https://${DOMAINE}
DATABASE_URL=postgresql://lexpatria:${PG}@base:5432/lexpatria
POSTGRES_PASSWORD=${PG}
SECRET_JETONS=$(openssl rand -hex 32)
SECRET_TACHES=$(openssl rand -hex 32)
CLE_CHIFFREMENT=$(openssl rand -hex 32)
BREVO_API_KEY=${BREVO}
EMAIL_EXPEDITEUR=${EXPEDITEUR}
AUTORISER_SIMULATION=
FIN
  chmod 600 .env
  echo "   .env créé. Les autres clés (Stripe, Anthropic, stockage, Microsoft 365, Pennylane, Maileva) se saisissent au back office."
else
  echo "   .env déjà présent : conservé."
fi

echo "== 3/6 Équipe"
mkdir -p config
[ -f config/equipe.json ] || cp deploiement/equipe.exemple.json config/equipe.json
echo "   Comptes lus dans config/equipe.json (les lignes dont l'e-mail vaut XXX sont ignorées)."

echo "== 4/6 Construction et démarrage (quelques minutes)"
docker compose up -d base
sleep 8
docker compose up -d --build
sleep 15
docker compose run --rm app node outils/equipe.mjs /config/equipe.json

echo "== 5/6 Sauvegarde quotidienne de la base (2 h 30, conservation 30 jours)"
chmod +x deploiement/sauvegarde-base.sh deploiement/mettre-a-jour.sh
LIGNE="30 2 * * * $(pwd)/deploiement/sauvegarde-base.sh >> /var/log/lexpatria-sauvegarde.log 2>&1"
( crontab -l 2>/dev/null | grep -v sauvegarde-base.sh; echo "$LIGNE" ) | crontab -

echo "== 6/6 Contrôle"
DOMAINE=$(grep '^DOMAINE=' .env | cut -d= -f2)
for i in 1 2 3 4 5 6; do
  if curl -fsS "https://${DOMAINE}/api/sante" >/dev/null 2>&1; then echo "   https://${DOMAINE} répond : installation terminée."; exit 0; fi
  sleep 10
done
echo "   Le site ne répond pas encore en HTTPS : vérifiez que le DNS de ${DOMAINE} pointe vers ce serveur,"
echo "   puis relancez :  docker compose restart caddy"
