// Catalogue des services externes que le cabinet peut brancher depuis le back office (rubrique « Connexions »).
// Chaque champ correspond à une variable de configuration : la valeur saisie au back office prime
// sur celle du fichier .env du serveur. Les champs secrets ne sont jamais réaffichés.

export interface ChampConnecteur {
  nom: string; // nom de la variable (ex. STRIPE_SECRET_KEY)
  libelle: string;
  secret: boolean;
  aide?: string;
  requis?: boolean;
}

export interface Connecteur {
  id: string;
  nom: string;
  usage: string;
  ou: string; // où trouver les informations
  champs: ChampConnecteur[];
  test: boolean; // un essai de connexion automatique existe
  lot?: string; // intégration utilisée par un lot à venir
}

export const CONNECTEURS: Connecteur[] = [
  {
    id: "stripe",
    nom: "Stripe — paiement en ligne",
    usage: "Carte, Apple Pay, Google Pay et Klarna (paiement en trois fois).",
    ou: "Tableau de bord Stripe › Développeurs › Clés API ; Webhooks pour la clé de signature.",
    champs: [
      { nom: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", libelle: "Clé publiable (pk_live_…)", secret: false, requis: true },
      { nom: "STRIPE_SECRET_KEY", libelle: "Clé secrète (sk_live_… ou clé restreinte rk_live_…)", secret: true, requis: true },
      { nom: "STRIPE_WEBHOOK_SECRET", libelle: "Clé de signature du webhook (whsec_…)", secret: true, requis: true },
    ],
    test: true,
  },
  {
    id: "brevo",
    nom: "Brevo — e-mails et SMS",
    usage: "Codes de connexion, avis de nouveaux messages, relances (avec consentement).",
    ou: "Brevo › SMTP et API › Clés API.",
    champs: [
      { nom: "BREVO_API_KEY", libelle: "Clé API", secret: true, requis: true },
      { nom: "EMAIL_EXPEDITEUR", libelle: "Adresse d'expédition (domaine authentifié)", secret: false, requis: true },
    ],
    test: true,
  },
  {
    id: "anthropic",
    nom: "Anthropic — intelligence artificielle",
    usage: "Lecture des décisions, orientation, assistant du back office, projets d'actes.",
    ou: "console.anthropic.com › API Keys. Demander la non-conservation des données.",
    champs: [
      { nom: "ANTHROPIC_API_KEY", libelle: "Clé API", secret: true, requis: true },
      { nom: "ANTHROPIC_MODEL", libelle: "Modèle (facultatif)", secret: false },
      { nom: "ANTHROPIC_MODEL_TRIAGE", libelle: "Modèle d'orientation (facultatif)", secret: false },
    ],
    test: true,
  },
  {
    id: "stockage",
    nom: "OVHcloud Object Storage — pièces des clients",
    usage: "Stockage chiffré des pièces, en France.",
    ou: "OVHcloud › Public Cloud › Object Storage › Utilisateurs S3.",
    champs: [
      { nom: "S3_ENDPOINT", libelle: "Adresse (ex. https://s3.gra.io.cloud.ovh.net)", secret: false, requis: true },
      { nom: "S3_REGION", libelle: "Région (ex. gra)", secret: false, requis: true },
      { nom: "S3_BUCKET", libelle: "Nom du conteneur", secret: false, requis: true },
      { nom: "S3_ACCESS_KEY", libelle: "Clé d'accès", secret: true, requis: true },
      { nom: "S3_SECRET_KEY", libelle: "Clé secrète", secret: true, requis: true },
    ],
    test: true,
  },
  {
    id: "mesure",
    nom: "Mesure d'audience et publicités",
    usage: "Matomo (sans cookie) ; pixels Meta, TikTok et Google Ads chargés seulement après accord du visiteur.",
    ou: "Identifiants fournis par chaque régie.",
    champs: [
      { nom: "NEXT_PUBLIC_MATOMO_URL", libelle: "Matomo : adresse", secret: false },
      { nom: "NEXT_PUBLIC_MATOMO_SITE_ID", libelle: "Matomo : numéro du site", secret: false },
      { nom: "NEXT_PUBLIC_META_PIXEL_ID", libelle: "Pixel Meta", secret: false },
      { nom: "NEXT_PUBLIC_TIKTOK_PIXEL_ID", libelle: "Pixel TikTok", secret: false },
      { nom: "NEXT_PUBLIC_GOOGLE_ADS_ID", libelle: "Google Ads (AW-…)", secret: false },
    ],
    test: false,
  },
  {
    id: "microsoft365",
    nom: "Microsoft 365 — Outlook et SharePoint",
    usage: "Agendas Outlook des avocats (absences importées, échéances inscrites) et classement des dossiers dans SharePoint.",
    ou: "Portail Azure › Inscriptions d'applications : identifiant du locataire, de l'application, secret client. Autorisations d'application à accorder (consentement administrateur) : Calendars.ReadWrite et Sites.ReadWrite.All.",
    champs: [
      { nom: "MS_TENANT_ID", libelle: "Identifiant du locataire (tenant)", secret: false, requis: true },
      { nom: "MS_CLIENT_ID", libelle: "Identifiant de l'application", secret: false, requis: true },
      { nom: "MS_CLIENT_SECRET", libelle: "Secret client", secret: true, requis: true },
      { nom: "SHAREPOINT_SITE", libelle: "Site SharePoint (adresse, ex. https://vartis.sharepoint.com/sites/Lexpatria)", secret: false },
    ],
    test: true,
  },
  {
    id: "pennylane",
    nom: "Pennylane — comptabilité",
    usage: "Une facture par paiement reçu, au nom et à l'adresse du client : TVA à 20 % dans l'Union européenne et en outre-mer ; ailleurs, même prix sans TVA (article 259 B du CGI).",
    ou: "Pennylane › Paramètres › Connectivité › Développeurs : jeton d'API v2 avec les droits clients et factures clients.",
    champs: [{ nom: "PENNYLANE_API_KEY", libelle: "Jeton d'API", secret: true, requis: true }],
    test: true,
  },
  {
    id: "maileva",
    nom: "Maileva — courriers recommandés",
    usage: "Envoi en lettre recommandée avec avis de réception des recours préalables, recours gracieux et mises en demeure attestés.",
    ou: "Espace développeur Maileva : identifiants de l'application.",
    champs: [
      { nom: "MAILEVA_CLIENT_ID", libelle: "Identifiant client", secret: false, requis: true },
      { nom: "MAILEVA_CLIENT_SECRET", libelle: "Secret client", secret: true, requis: true },
      { nom: "MAILEVA_LOGIN", libelle: "Identifiant du compte", secret: false, requis: true },
      { nom: "MAILEVA_MOT_DE_PASSE", libelle: "Mot de passe du compte", secret: true, requis: true },
      { nom: "MAILEVA_ENVIRONNEMENT", libelle: "Environnement : « production » pour les envois réels (sinon environnement de test)", secret: false },
    ],
    test: true,
  },
  {
    id: "signature",
    nom: "Signature électronique (Yousign)",
    usage: "Signature des avenants et documents par le client.",
    ou: "Yousign › Paramètres › Clés API.",
    champs: [{ nom: "YOUSIGN_API_KEY", libelle: "Clé API", secret: true, requis: true }],
    test: false,
    lot: "Lot 5",
  },
  {
    id: "autre",
    nom: "Autre API",
    usage: "Tout autre service que le cabinet souhaite brancher (l'agent de développement s'en sert pour l'intégrer).",
    ou: "Documentation du service.",
    champs: [
      { nom: "AUTRE_API_NOM", libelle: "Nom du service", secret: false },
      { nom: "AUTRE_API_URL", libelle: "Adresse de l'API", secret: false },
      { nom: "AUTRE_API_CLE", libelle: "Clé ou jeton", secret: true },
    ],
    test: true,
  },
];

export const CHAMPS_CONNUS = new Set(CONNECTEURS.flatMap((c) => c.champs.map((x) => x.nom)));
export const connecteur = (id: string) => CONNECTEURS.find((c) => c.id === id);
