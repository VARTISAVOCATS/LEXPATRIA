# Mise en ligne chez OVHcloud

Tout est hébergé en France : serveur, base de données et pièces des clients.

## 1. À commander chez OVHcloud

1. **Un serveur VPS** en France (VPS-1 au départ : 2 vCores, 4 Go ; évolutif en un clic), Ubuntu 24.04, avec la sauvegarde automatique Premium. La base PostgreSQL tourne sur le serveur, sauvegardée chaque nuit.
2. **Un conteneur Object Storage** (Public Cloud, S3, région Gravelines « gra » ou Paris), nommé `lexpatria-pieces`, privé, avec un utilisateur S3 dédié : il reçoit les pièces des clients.
3. **Le nom de domaine** : enregistrements DNS `A` de `lexpatria.fr` et de `www.lexpatria.fr` vers l'adresse IP du serveur.

## 2. Récupérer le code sur le serveur (une seule fois)

Le dépôt GitHub est privé : le serveur y accède par une clé de déploiement en lecture seule.

```
ssh ubuntu@<adresse IP du serveur>
sudo apt-get update && sudo apt-get install -y git
sudo ssh-keygen -t ed25519 -N "" -f /root/.ssh/lexpatria_deploy -C lexpatria-vps
sudo cat /root/.ssh/lexpatria_deploy.pub
```

Copier la ligne affichée dans GitHub : dépôt LEXPATRIA › Settings › Deploy keys › Add deploy key (titre « VPS OVH », sans cocher « Allow write access »). Puis :

```
sudo GIT_SSH_COMMAND="ssh -i /root/.ssh/lexpatria_deploy -o StrictHostKeyChecking=accept-new" git clone git@github.com:VARTISAVOCATS/LEXPATRIA.git /opt/lexpatria
sudo git -C /opt/lexpatria config core.sshCommand "ssh -i /root/.ssh/lexpatria_deploy"
```

## 3. Installer et démarrer

```
sudo nano /opt/lexpatria/deploiement/equipe.exemple.json   # facultatif : adresses de l'équipe (XXX = ignoré)
sudo bash /opt/lexpatria/deploiement/installer.sh
```

Le script demande le domaine, l'adresse d'expédition et la clé Brevo (nécessaire aux codes de connexion), génère les secrets sur le serveur, démarre la base, l'application, le HTTPS et les tâches planifiées, crée les comptes de l'équipe et planifie la sauvegarde de la base. Les clés ne transitent jamais par message ni par e-mail ; `CLE_CHIFFREMENT` (dans `/opt/lexpatria/.env`) chiffre les clés saisies au back office : la conserver.
Contrôle : `https://lexpatria.fr/api/sante` doit répondre `{"ok":true}`.

## 4. Brancher les services

Les clés se saisissent au choix dans le fichier `.env` ou, plus simplement, au back office : Espace cabinet › Back office › Connexions (API), avec un bouton « Tester la connexion » pour Stripe, Brevo, Anthropic, le stockage OVH, Microsoft 365, Pennylane et Maileva. La date et le résultat de la dernière synchronisation de chaque intégration s'y affichent.


- **Stripe** : Développeurs > Webhooks > ajouter `https://<domaine>/api/stripe/webhook`, événement `payment_intent.succeeded` ; reporter la clé de signature dans `STRIPE_WEBHOOK_SECRET`. Vérifier Klarna, Apple Pay et Google Pay (domaine à enregistrer dans Stripe pour Apple Pay).
- **Brevo** : authentifier le domaine d'envoi (SPF, DKIM, DMARC), créer l'expéditeur `EMAIL_EXPEDITEUR`, activer le SMS.
- **Anthropic** : clé API dédiée à Lexpatria ; demander la non-conservation des données.
- **Pixels et Matomo** : renseigner les identifiants ; ils ne se chargent qu'après accord du visiteur.
- **Microsoft 365 (Outlook et SharePoint)** : portail Azure › Inscriptions d'applications › nouvelle application ; créer un secret client ; autorisations d'**application** Microsoft Graph `Calendars.ReadWrite` et `Sites.ReadWrite.All`, puis « Accorder le consentement administrateur ». Saisir l'adresse du site SharePoint qui recevra les dossiers. Les absences posées dans Outlook en « Absent du bureau » sont importées ; les échéances sont inscrites dans l'agenda de l'avocat avec la seule référence du dossier.
- **Microsoft Bookings (consultation en visio à 89 €)** : dans Bookings, créer une page de réservation « Lexpatria — Consultations » (distincte de celle de VARTIS), y ajouter les avocats, créer le service « Consultation en visio » (30 minutes, réunion Teams) et le **masquer de la page publique** : la réservation ne se fait qu'après paiement, depuis Lexpatria. Ajouter à l'application Azure les autorisations `Bookings.Read.All` et `BookingsAppointment.ReadWrite.All`. Saisir au back office l'adresse de la page Bookings et l'identifiant du service. Les avocats sont rapprochés par leur adresse e-mail.
- **Pennylane** : jeton d'API v2 (droits clients et factures clients). Chaque paiement crée une facture au nom et à l'adresse du client : TVA à 20 % pour un client résidant dans l'Union européenne ou en outre-mer ; ailleurs, même prix sans TVA, avec la mention de l'article 259 B du CGI (code TVA « extracom » dans Pennylane, à vérifier lors du premier essai).
- **Maileva** : identifiants de l'application et du compte. Laisser l'environnement vide pour les essais (aucun courrier réel), puis saisir `production`.
- **Télérecours** : aucune clé ; il n'existe pas d'interface de dépôt automatique. Le poste de travail fournit l'archive à déposer et enregistre le numéro de requête.
- **Tâche planifiée** : la tâche toutes les 15 minutes (`/api/taches/relances`) assure aussi les synchronisations Outlook, SharePoint, Pennylane et le suivi Maileva.

## 5. Mettre à jour

```
sudo bash /opt/lexpatria/deploiement/mettre-a-jour.sh
```

La base est sauvegardée avant chaque mise à jour ; les migrations s'appliquent au démarrage.

## 6. Avant d'ouvrir au public

- Paiement réel de 1 € puis remboursement, en carte et en Klarna.
- `AUTORISER_SIMULATION` vide dans `.env`.
- Pages de situation, relances et traductions relues par un avocat du cabinet.
- Adresses e-mail de l'équipe complétées dans `config/equipe.json` (les lignes « XXX » sont ignorées).
