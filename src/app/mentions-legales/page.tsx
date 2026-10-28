import { meta } from "@/lib/seo";
import PageJuridique, { type SectionJuridique } from "../composants/PageJuridique";

export const metadata = meta("Mentions légales — LEXPATRIA Avocats", "Éditeur, hébergeur et règles professionnelles applicables au site lexpatria.fr.", "/mentions-legales");

const SECTIONS: SectionJuridique[] = [
  {
    titre: "Éditeur du site",
    paragraphes: [
      "Le site lexpatria.fr est édité par la SELARL VARTIS Avocats, société d'exercice libéral à responsabilité limitée d'avocats au barreau de Paris, au capital de 5 000 euros, immatriculée au registre du commerce et des sociétés de Paris sous le numéro 937 773 885.",
      "Siège social : 222 boulevard Saint-Germain, 75007 Paris. Numéro de TVA intracommunautaire : FR15937773885.",
      "LEXPATRIA Avocats est le nom commercial de la SELARL VARTIS Avocats.",
      "Contact : contact@lexpatria.fr · 01 83 81 51 23.",
      "Directeur de la publication : Maître Rafik Rabia, en qualité de représentant légal de la SELARL VARTIS Avocats.",
    ],
  },
  {
    titre: "Hébergeur",
    paragraphes: ["OVH SAS, 2 rue Kellermann, 59100 Roubaix, France. Les données du site sont hébergées en France."],
  },
  {
    titre: "Profession réglementée",
    paragraphes: [
      "Les avocats du cabinet sont inscrits au barreau de Paris. Le titre d'avocat a été obtenu en France.",
      "La profession est régie par la loi n° 71-1130 du 31 décembre 1971, le décret n° 91-1197 du 27 novembre 1991, le décret n° 2005-790 du 12 juillet 2005 relatif aux règles de déontologie, le règlement intérieur national de la profession d'avocat et le règlement intérieur du barreau de Paris. Ces textes sont consultables sur les sites du Conseil national des barreaux et de l'Ordre des avocats de Paris.",
      "Assurance de responsabilité civile professionnelle : contrat collectif souscrit par l'Ordre des avocats de Paris auprès de MMA, par l'intermédiaire du courtier AON, couvrant l'activité exercée en France.",
    ],
  },
  {
    titre: "Honoraires et réclamations",
    paragraphes: [
      "Les honoraires sont fixés par une convention d'honoraires acceptée en ligne avant tout paiement. Aide juridictionnelle non acceptée.",
      "Toute contestation relative aux honoraires est portée devant le Bâtonnier de l'Ordre des avocats de Paris. Après une réclamation écrite adressée au cabinet, le client consommateur peut recourir au médiateur de la consommation de la profession d'avocat : 180 boulevard Haussmann, 75008 Paris, mediateur-consommation-avocat.fr.",
    ],
  },
  {
    titre: "Informations publiées",
    paragraphes: [
      "Les pages d'information et les articles sont rédigés par le cabinet à titre d'information générale. Ils ne constituent pas une consultation juridique et ne remplacent pas l'examen d'une situation particulière par un avocat.",
      "La plateforme utilise des outils d'intelligence artificielle pour orienter les demandes et préparer les projets d'actes. Chaque acte et chaque avis sont relus et validés par un avocat du cabinet.",
    ],
  },
  {
    titre: "Propriété intellectuelle",
    paragraphes: [
      "Les textes, le nom LEXPATRIA Avocats, le logo et la présentation du site sont la propriété de la SELARL VARTIS Avocats. Toute reproduction sans autorisation écrite est interdite.",
    ],
  },
  {
    titre: "Données personnelles et cookies",
    paragraphes: ["Le traitement des données personnelles et l'usage des cookies sont décrits dans la politique de confidentialité."],
  },
];

export default function MentionsLegales() {
  return <PageJuridique surtitre="Informations légales" titre="Mentions légales" sections={SECTIONS} maj="28 octobre 2026" />;
}
