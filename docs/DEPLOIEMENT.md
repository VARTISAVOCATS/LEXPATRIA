# Mise en ligne chez OVHcloud

Tout est hébergé en France : serveur, base de données et pièces des clients.

## 1. À commander chez OVHcloud

1. **Un serveur VPS** (2 vCPU, 4 Go de mémoire au minimum), centre de données en France, système Ubuntu 24.04.
2. **Une base PostgreSQL gérée** (Public Cloud > Databases > PostgreSQL 16), même région. OVH en assure les sauvegardes quotidiennes.
   À défaut, la base peut tourner sur le serveur lui-même (option « base-locale » ci-dessous, sauvegardes par `deploiement/sauvegarde-base.sh`).
3. **Un conteneur Object Storage** (S3, région Gravelines « gra » ou Paris), nommé `lexpatria-pieces`, privé, avec un utilisateur S3 dédié.
4. **Le nom de domaine** : enregistrement DNS `A` du domaine et de `www` vers l'adresse IP du serveur.

## 2. Préparer le serveur (une seule fois)

```
sudo apt update && sudo apt install -y docker.io docker-compose-v2 git
sudo ufw allow 22,80,443/tcp && sudo ufw enable
sudo git clone https://github.com/<compte>/lexpatria.git /opt/lexpatria
cd /opt/lexpatria
cp .env.example .env && nano .env      # renseigner les clés, directement sur le serveur
mkdir -p config && cp deploiement/equipe.exemple.json config/equipe.json && nano config/equipe.json
```

Les clés ne transitent jamais par message ni par e-mail : elles sont saisies dans le fichier `.env` du serveur, qui n'est pas versionné.
`SECRET_JETONS`, `SECRET_TACHES` et `CLE_CHIFFREMENT` se génèrent avec `openssl rand -hex 32`. `CLE_CHIFFREMENT` chiffre les clés d'API saisies au back office : la conserver précieusement (sa perte impose de ressaisir les clés).

## 3. Démarrer

```
docker compose up -d --build                         # base gérée OVH
docker compose --profile base-locale up -d --build   # ou : base sur le serveur
docker compose run --rm app node outils/equipe.mjs /config/equipe.json
```

Au démarrage, l'application applique les migrations de la base, puis le certificat HTTPS est obtenu automatiquement.
Contrôle : `https://<domaine>/api/sante` doit répondre `{"ok":true}`.

## 4. Brancher les services

Les clés se saisissent au choix dans le fichier `.env` ou, plus simplement, au back office : Espace cabinet › Back office › Connexions (API), avec un bouton « Tester la connexion » pour Stripe, Brevo, Anthropic, le stockage OVH et Microsoft 365.


- **Stripe** : Développeurs > Webhooks > ajouter `https://<domaine>/api/stripe/webhook`, événement `payment_intent.succeeded` ; reporter la clé de signature dans `STRIPE_WEBHOOK_SECRET`. Vérifier Klarna, Apple Pay et Google Pay (domaine à enregistrer dans Stripe pour Apple Pay).
- **Brevo** : authentifier le domaine d'envoi (SPF, DKIM, DMARC), créer l'expéditeur `EMAIL_EXPEDITEUR`, activer le SMS.
- **Anthropic** : clé API dédiée à Lexpatria ; demander la non-conservation des données.
- **Pixels et Matomo** : renseigner les identifiants ; ils ne se chargent qu'après accord du visiteur.

## 5. Mettre à jour

```
cd /opt/lexpatria && git pull && docker compose up -d --build
```

## 6. Avant d'ouvrir au public

- Paiement réel de 1 € puis remboursement, en carte et en Klarna.
- `AUTORISER_SIMULATION` vide dans `.env`.
- Pages de situation, relances et traductions relues par un avocat du cabinet.
- Adresses e-mail de l'équipe complétées dans `config/equipe.json` (les lignes « XXX » sont ignorées).
