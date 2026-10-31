// Collecte de tous les textes français à traduire (clés des dictionnaires).
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { apresPaiement, CONTENUS, SUGGESTIONS } from "../src/lib/contenus";
import { piecesDemandees, questions } from "../src/lib/questionnaire";
import { PROCEDURES, type CodeProcedure } from "../src/lib/procedures";
import { SITUATIONS } from "../src/lib/situations";
import { LIBELLES_STATUT } from "../src/lib/statuts";

const cles = new Set<string>();
const ajouter = (x: unknown) => {
  if (typeof x === "string" && /[A-Za-zÀ-ÿ]{2,}/.test(x)) cles.add(x);
  else if (Array.isArray(x)) x.forEach(ajouter);
  else if (x && typeof x === "object") Object.values(x).forEach(ajouter);
};

function parcourir(d: string) {
  for (const f of readdirSync(d)) {
    const p = path.join(d, f);
    if (statSync(p).isDirectory()) parcourir(p);
    else if (/\.tsx?$/.test(f) && !p.includes("__tests__")) {
      const s = readFileSync(p, "utf8");
      for (const m of s.matchAll(/\bt\(\s*"((?:[^"\\]|\\.)*)"/g)) cles.add(JSON.parse(`"${m[1]}"`));
      for (const m of s.matchAll(/\bt\(\s*(?:[^"()]*\?\s*)"((?:[^"\\]|\\.)*)"\s*:\s*"((?:[^"\\]|\\.)*)"/g)) {
        cles.add(JSON.parse(`"${m[1]}"`));
        cles.add(JSON.parse(`"${m[2]}"`));
      }
    }
  }
}
parcourir("src");

Object.values(CONTENUS).forEach(ajouter);
ajouter(apresPaiement(true));
ajouter(apresPaiement(false));
ajouter(SUGGESTIONS);
Object.values(PROCEDURES).forEach((p) => cles.add(p.libelle));
SITUATIONS.forEach((s) => cles.add(s.nav));
const reponsesTypes = [{}, { titreAnt: "oui", famille: "marie", enfants: "2", activite: "cdi", decisionRecue: "oui", rapoForme: "oui", scolarises: "oui", entree: "2018-01-01" }, { famille: "pacs" }, { famille: "concubinage" }];
for (const proc of Object.keys(PROCEDURES) as CodeProcedure[])
  for (const algerien of [true, false])
    for (const r of reponsesTypes) {
      const c = { procedure: proc, algerien, avisOuDiagnostic: true };
      questions(c, r).forEach((q) => {
        ajouter([q.libelle, q.aide, q.brut ? [] : q.options?.map((o) => o[1])]);
        if (q.avec) ajouter([q.avec.libelle, q.avec.aide, q.avec.brut ? [] : q.avec.options?.map((o) => o[1])]);
      });
      piecesDemandees(c, r).forEach((p) => ajouter([p.libelle, p.pourquoi]));
    }
// Textes présents dans des tableaux de la page d'accueil et du parcours
for (const f of ["src/lib/accueil.ts", "src/app/depot/Parcours.tsx"]) {
  const s = readFileSync(f, "utf8");
  for (const m of s.matchAll(/\b(?:titre|q|r|l):\s*"((?:[^"\\]|\\.)*)"/g)) cles.add(JSON.parse(`"${m[1]}"`));
}
// Textes composés dans le code (titres calculés, ternaires) :
[
  "Recours devant la commission de recours contre les refus de visa",
  "Recours préalable auprès du sous-directeur des visas",
  "Recours préalable contre un ajournement de naturalisation",
  "Demande restée sans réponse",
  "Avis écrit d'un avocat",
  "L'étude de votre dossier par un avocat du cabinet",
  "69 € non déduits si la procédure est engagée ensuite",
  "L'avis d'un avocat",
  "Votre diagnostic",
  "Quelle situation correspond à la vôtre ?",
  "Votre avocat vérifiera ensuite votre dossier et votre décision.",
  "Votre recours",
  "Date limite estimée",
  "Engager la procédure",
  "Madame",
  "Monsieur",
  "48 heures ouvrées",
  "10 heures ouvrées",
  "C'est trop cher",
  "Je veux réfléchir",
  "Je souhaite m'entretenir avec un avocat",
  "Date limite estimée : {date}.",
  "Votre dépôt de dossier n'est pas terminé",
  "Bonjour, votre dépôt de dossier sur LEXPATRIA Avocats n'est pas terminé. Vous pouvez le reprendre là où vous l'avez laissé : {lien}{echeance} Pour ne plus recevoir ces messages : {desinscription}",
  // Espace client (lot 2) : rubriques, échéances, paiements, connexion
  "Suivi",
  "Échanges",
  "Pièces",
  "Documents",
  "Paiements",
  "Date limite du recours",
  "Mémoire complémentaire",
  "Audience",
  "Clôture de l'instruction",
  "Date limite d'appel",
  "Réponse attendue de l'administration",
  "Payé",
  "Remboursé",
  "Échoué",
  "En attente",
  "Votre avocat",
  "Mon espace",
  "Retrouvez le suivi de votre recours, vos pièces et les messages de votre avocat. Indiquez l'adresse e-mail donnée lors de votre dépôt : vous recevrez un code de connexion.",
  "Envoi…",
  "Format non accepté : photo ou PDF uniquement.",
  "Fichier trop lourd (20 Mo au plus).",
  "10 fichiers au plus par envoi.",
  "Aucun fichier.",
  "Dossier {ref}",
].forEach((k) => cles.add(k));
Object.values(LIBELLES_STATUT).forEach((k) => cles.add(k));
const liste = [...cles].filter((k) => k.trim() && !/^(LEXPATRIA|Me |https?:)/.test(k)).sort();
writeFileSync("src/i18n/cles.json", JSON.stringify(liste, null, 1));
console.log(liste.length, "clés");
