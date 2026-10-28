import { meta } from "@/lib/seo";
import PageJuridique, { type SectionJuridique } from "../composants/PageJuridique";

export const metadata = meta(
  "Politique de confidentialité — LEXPATRIA Avocats",
  "Données personnelles traitées sur lexpatria.fr : finalités, durées de conservation, destinataires, droits et cookies.",
  "/confidentialite",
);

const SECTIONS: SectionJuridique[] = [
  {
    titre: "Responsable du traitement",
    paragraphes: [
      "La SELARL VARTIS Avocats, 222 boulevard Saint-Germain, 75007 Paris, exerçant sous le nom commercial LEXPATRIA Avocats, est responsable des traitements de données réalisés sur la plateforme.",
      "Pour toute question relative à vos données : XXX (adresse e-mail).",
    ],
  },
  {
    titre: "Données traitées",
    paragraphes: [
      [
        "Identité et coordonnées : civilité, nom, prénom, adresse e-mail, téléphone, adresse postale, pays de résidence, nationalité algérienne ou non.",
        "Éléments du dossier : votre récit, vos réponses au questionnaire, la décision contestée et les pièces que vous transmettez.",
        "Paiement : montant, date et statut du règlement. Les données de carte bancaire sont saisies et conservées par le prestataire de paiement et ne sont jamais transmises au cabinet.",
        "Données techniques : journal des connexions et des actions sur le dossier, adresse IP lors de l'acceptation de la convention.",
      ],
      "Votre dossier peut contenir des informations sensibles, par exemple sur votre santé ou votre situation familiale. Elles ne sont traitées que dans la mesure nécessaire à la défense de vos droits.",
    ],
  },
  {
    titre: "Finalités et bases légales",
    paragraphes: [
      [
        "Étude de votre situation, rédaction et dépôt des actes, suivi de la procédure : exécution de la convention d'honoraires.",
        "Constatation, exercice ou défense de vos droits en justice, pour les données sensibles du dossier.",
        "Facturation, comptabilité et lutte contre le blanchiment des capitaux : obligations légales du cabinet.",
        "Rappel par e-mail d'un dépôt de dossier non terminé : intérêt légitime du cabinet. Chaque message comporte un lien pour ne plus en recevoir.",
        "Mesure de l'efficacité des annonces : votre consentement, recueilli par le bandeau cookies.",
      ],
    ],
  },
  {
    titre: "Intelligence artificielle",
    paragraphes: [
      "Des outils d'intelligence artificielle aident à orienter votre demande, à lire la décision et à préparer les projets d'actes. Aucune décision n'est prise de manière automatisée : chaque acte et chaque avis sont relus et validés par un avocat du cabinet.",
      "Les données transmises au modèle d'intelligence artificielle sont limitées au strict nécessaire et ne sont pas réutilisées pour l'entraînement des modèles. Le prestataire est établi aux États-Unis ; ce transfert est encadré par les clauses contractuelles types de la Commission européenne.",
    ],
  },
  {
    titre: "Destinataires",
    paragraphes: [
      "Vos données sont accessibles aux seuls avocats et collaborateurs du cabinet chargés de votre dossier. Elles sont transmises à l'administration ou à la juridiction dans la mesure nécessaire à la procédure.",
      "Le cabinet fait appel aux prestataires suivants, qui agissent sur ses instructions :",
      [
        "OVH SAS (France) : hébergement de la plateforme et des pièces.",
        "Stripe Payments Europe (Irlande) : paiement en ligne.",
        "Brevo (France) : envoi des e-mails.",
        "Anthropic (États-Unis) : outils d'intelligence artificielle.",
        "Microsoft (Union européenne) : prise de rendez-vous et visioconférence pour les consultations.",
        "XXX : facturation, le cas échéant.",
      ],
      "Vos données ne sont ni vendues ni cédées.",
    ],
  },
  {
    titre: "Durées de conservation",
    paragraphes: [
      [
        "Dépôt de dossier non réglé : 30 jours, puis suppression avec les pièces transmises.",
        "Dossier traité : 5 ans à compter de la fin de la mission, durée de prescription de l'action en responsabilité contre l'avocat.",
        "Factures et pièces comptables : 10 ans.",
        "Documents d'identification exigés au titre de la lutte contre le blanchiment : 5 ans à compter de la fin de la relation.",
        "Choix relatif aux cookies : 6 mois.",
      ],
    ],
  },
  {
    titre: "Sécurité",
    paragraphes: [
      "La plateforme est hébergée en France et accessible uniquement en connexion chiffrée. L'accès aux dossiers est réservé aux personnes habilitées et toute action est enregistrée dans un journal. Le texte de la convention acceptée est conservé avec son empreinte numérique.",
    ],
  },
  {
    titre: "Vos droits",
    paragraphes: [
      "Vous disposez d'un droit d'accès, de rectification, d'effacement, de limitation, d'opposition et de portabilité de vos données, ainsi que du droit de définir des directives relatives à leur sort après votre décès. Vous pouvez retirer à tout moment votre consentement aux cookies par le lien « Gérer les cookies » en bas de page.",
      "Pour exercer ces droits : XXX (adresse e-mail), ou par courrier au siège du cabinet. Certaines données doivent être conservées malgré une demande d'effacement lorsque la loi l'impose.",
      "Vous pouvez adresser une réclamation à la Commission nationale de l'informatique et des libertés (CNIL), 3 place de Fontenoy, 75007 Paris, cnil.fr.",
    ],
  },
  {
    titre: "Cookies",
    paragraphes: [
      "Le site dépose des cookies nécessaires à son fonctionnement : session de connexion à votre espace, langue choisie, mémorisation de votre choix relatif aux cookies. Ils ne nécessitent pas votre accord.",
      "Avec votre accord seulement, des cookies de mesure publicitaire (Google Ads, Meta, TikTok) permettent de mesurer l'efficacité des annonces du cabinet. Le refus est sans incidence sur l'utilisation du site.",
    ],
  },
];

export default function Confidentialite() {
  return <PageJuridique surtitre="Données personnelles" titre="Politique de confidentialité" sections={SECTIONS} maj="28 octobre 2026" />;
}
