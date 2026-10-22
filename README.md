# Lexpatria

Plateforme de dépôt de recours en ligne de LEXPATRIA Avocats (dénomination commerciale de la SELARL VARTIS Avocats).
Référence fonctionnelle : cahier des charges « Plateforme LEXPATRIA Avocats » et démonstration cliquable.

## Socle

- Next.js 15 (TypeScript), PostgreSQL (Drizzle ; PGlite embarqué en développement), hébergement OVHcloud en France.
- Pièces chiffrées dans un stockage objet OVH (S3 compatible).
- IA : API Anthropic, avec minimisation (coordonnées et numéros d'identification masqués avant envoi).
- Paiement : Stripe (carte, Apple Pay, Google Pay, Klarna pour le paiement en trois fois).
- Polices auto-hébergées, aucun appel à Google Fonts.

## Lots

1. Socle et parcours public jusqu'au paiement (fait, prêt à la mise en ligne)
2. Espace client (fait : connexion par code, suivi, échanges, pièces, documents, paiements)
3. Espace avocat et secrétariat (fait : ma journée, dossiers, acceptation, date limite vérifiée, étapes, pièces, échéances, journal, disponibilités, poste de travail avec projets d'actes et attestation, agenda avec rappels et absences, questions des clients avec réponse proposée, consultations à 48 heures ouvrées, espace appel avec avenant et règlement en ligne, indicateurs ; à venir : modèles d'actes du cabinet modifiables au back office)
4. Back office (fait : contenus et tarifs modifiables, équipe, historique avec retour arrière, assistant de modification validé par un associé)
5. Intégrations (SharePoint, Outlook, Pennylane, Maileva)
6. Sources juridiques

## Commandes

```
npm install
npm run dev            # sans DATABASE_URL : base embarquée, équipe fictive
npx vitest run         # tests des délais, tarifs et filtre déontologique
```

## Règles codées en dur (non paramétrables)

- Aucun dépôt ni envoi sans attestation de l'avocat liée à la version exacte de l'acte.
- Filtre déontologique sur tout texte publié ou généré pour le public (`src/lib/deontologie.ts`).
- Date limite toujours estimée au plus tôt ; l'avocat vérifie et fixe la date exacte.
- Rétention et détention refusées avant paiement (activables au back office).

## Mise en ligne

Voir `docs/DEPLOIEMENT.md` (OVHcloud, Docker, HTTPS automatique).
