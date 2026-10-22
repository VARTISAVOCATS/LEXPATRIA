// Lot 2 : dossier dans l'espace client — suivi, échanges, pièces, documents, paiements.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { tServeur } from "@/i18n/serveur";
import { formatEuros, PROCEDURES, type CodeProcedure } from "@/lib/procedures";
import { accesClient, detailDossier, marquerLus } from "@/lib/serveur/dossiers";
import { clientConnecte } from "@/lib/serveur/session";
import type { FichierStocke } from "@/lib/serveur/stockage";
import { etapesSuivi, frDate, frDateHeure, LIBELLES_STATUT, rang, type Statut } from "@/lib/statuts";
import { EnteteEspace } from "../../composants/Entete";
import { FormMessage, FormPiece } from "./Formulaires";

export const metadata = { title: "Mon dossier — LEXPATRIA Avocats", robots: { index: false } };

const ONGLETS = [
  ["suivi", "Suivi"],
  ["echanges", "Échanges"],
  ["pieces", "Pièces"],
  ["documents", "Documents"],
  ["paiements", "Paiements"],
] as const;
type Onglet = (typeof ONGLETS)[number][0];

const LIBELLES_ECHEANCE: Record<string, string> = {
  DATE_LIMITE: "Date limite du recours",
  MEMOIRE_COMPLEMENTAIRE: "Mémoire complémentaire",
  AUDIENCE: "Audience",
  CLOTURE: "Clôture de l'instruction",
  APPEL: "Date limite d'appel",
  REPONSE_MOTIFS: "Réponse attendue de l'administration",
};

export default async function DossierClient({ params, searchParams }: { params: Promise<{ reference: string }>; searchParams: Promise<{ onglet?: string }> }) {
  const { reference } = await params;
  const { onglet: o } = await searchParams;
  const onglet: Onglet = (ONGLETS.find(([k]) => k === o)?.[0] ?? "suivi") as Onglet;
  const email = await clientConnecte();
  if (!email) redirect("/espace");
  const d = await db();
  const dos = await accesClient(d, email, reference);
  if (!dos) notFound();
  const x = await detailDossier(d, dos);
  const { t } = await tServeur();
  const statut = dos.statut as Statut;
  const nomAvocat = x.avocat ? `${x.avocat.prenom} ${x.avocat.nom}` : null;
  const nonLus = onglet === "echanges" ? 0 : x.messages.filter((m) => m.auteur !== "CLIENT" && !m.luLe).length;
  if (onglet === "echanges") await marquerLus(d, dos.id, "CLIENT");
  const manquantes = x.pieces.filter((p) => p.manquante).length;

  return (
    <>
      <EnteteEspace espace="CLIENT" sousTitre="Mon espace" accueil="/espace" connecte nom={x.cli.prenom ?? undefined} />
      <main className="esp">
        <div className="wrap" style={{ maxWidth: 900 }}>
          <section className="card esp-tete">
            <span className="esp-ref">{t("Dossier {ref} · déposé le {date}", { ref: dos.reference, date: frDateHeure(dos.creeLe).split(" ")[0] })}</span>
            <h1>{t(PROCEDURES[dos.procedure as CodeProcedure]?.libelle ?? dos.procedure)}</h1>
            <div className="esp-etat">
              <span className={`pill ${statut === "PAYE" ? "warn" : rang(statut) >= rang("CLOS") ? "n" : "ok"}`}>{t(LIBELLES_STATUT[statut])}</span>
              {nomAvocat && <span>{t("Votre avocat : Maître {nom}", { nom: nomAvocat })}</span>}
            </div>
            {statut === "PAYE" && (
              <p className="note">
                {nomAvocat
                  ? t("Maître {nom} prend connaissance de votre dossier et vous écrit sous 48 heures ouvrées.", { nom: nomAvocat })
                  : t("Un avocat du cabinet prend votre dossier en charge sous 48 heures ouvrées.")}
              </p>
            )}
            {dos.dateLimite && (
              <p className="esp-dl">
                {dos.dateLimiteVerifiee
                  ? t("Date limite du recours : {date} (vérifiée par votre avocat)", { date: frDate(dos.dateLimite) })
                  : t("Date limite estimée : {date} (votre avocat la vérifie)", { date: frDate(dos.dateLimite) })}
              </p>
            )}
            {manquantes > 0 && (
              <Link className="esp-alerte" href={`/espace/${dos.reference}?onglet=pieces`}>
                {t("{n} pièce(s) à transmettre à votre avocat", { n: manquantes })}
              </Link>
            )}
          </section>

          <nav className="tabs esp-tabs" aria-label={t("Rubriques du dossier")}>
            {ONGLETS.map(([k, l]) => (
              <Link key={k} href={`/espace/${dos.reference}?onglet=${k}`} className={k === onglet ? "on" : ""} aria-current={k === onglet ? "page" : undefined}>
                {t(l)}
                {k === "echanges" && nonLus > 0 && <span className="cnt">{nonLus}</span>}
              </Link>
            ))}
          </nav>

          {onglet === "suivi" && (
            <section className="card">
              <h2>{t("Suivi de votre recours")}</h2>
              <ol className="esp-etapes">
                {etapesSuivi(dos.procedure).map((s) => {
                  const fait = rang(statut) > rang(s) || (s === "CLOS" && rang(statut) >= rang("CLOS"));
                  const encours = s === statut;
                  return (
                    <li key={s} className={fait ? "fait" : encours ? "encours" : ""}>
                      <span className="pt" aria-hidden />
                      <span>{t(LIBELLES_STATUT[s])}</span>
                      {encours && <span className="pill ai">{t("Étape actuelle")}</span>}
                    </li>
                  );
                })}
              </ol>
              {x.echeances.length > 0 && (
                <>
                  <h3>{t("Prochaines dates")}</h3>
                  <ul className="esp-lignes">
                    {x.echeances.map((e) => (
                      <li key={e.id}>
                        <span>{t(LIBELLES_ECHEANCE[e.type] ?? e.type)}</span>
                        <b>{frDate(e.date)}</b>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}

          {onglet === "echanges" && (
            <section className="card">
              <h2>{t("Échanges avec votre avocat")}</h2>
              <p className="note">{t("Vos échanges sont couverts par le secret professionnel. Vous êtes prévenu(e) par e-mail de chaque nouveau message, sans son contenu.")}</p>
              <div className="fil">
                {x.messages.length === 0 && <p className="vide">{t("Aucun message pour le moment.")}</p>}
                {x.messages.map((m) => (
                  <div key={m.id} className={`bulle ${m.auteur === "CLIENT" ? "moi" : ""}`}>
                    <span className="qui">
                      {m.auteur === "CLIENT" ? t("Vous") : m.auteur === "SECRETARIAT" ? t("Secrétariat du cabinet") : nomAvocat ? t("Maître {nom}", { nom: nomAvocat }) : t("Votre avocat")}
                      {" · "}
                      {frDateHeure(m.creeLe)}
                    </span>
                    <p>{m.contenu}</p>
                  </div>
                ))}
              </div>
              <FormMessage reference={dos.reference} />
            </section>
          )}

          {onglet === "pieces" && (
            <section className="card">
              <h2>{t("Vos pièces")}</h2>
              <ul className="esp-pieces">
                {x.pieces.map((p) => {
                  const fichiers = (p.fichiers as FichierStocke[]) ?? [];
                  return (
                    <li key={p.id}>
                      <div>
                        <b>{t(p.libelle)}</b>
                        {p.manquante ? (
                          <span className="pill warn">{t("À transmettre")}</span>
                        ) : p.verifiee ? (
                          <span className="pill ok">{t("Vérifiée par votre avocat")}</span>
                        ) : (
                          <span className="pill n">{t("Reçue")}</span>
                        )}
                      </div>
                      <div className="esp-fichiers">
                        {fichiers.map((f, i) => (
                          <a key={f.cle} href={`/api/fichier?piece=${p.id}&i=${i}`} target="_blank" rel="noreferrer">
                            {f.nom}
                          </a>
                        ))}
                      </div>
                      {p.manquante && <FormPiece reference={dos.reference} pieceId={p.id} libelleFixe={p.libelle} />}
                    </li>
                  );
                })}
                {x.pieces.length === 0 && <li className="vide">{t("Aucune pièce pour le moment.")}</li>}
              </ul>
              <FormPiece reference={dos.reference} />
            </section>
          )}

          {onglet === "documents" && (
            <section className="card">
              <h2>{t("Vos documents")}</h2>
              {x.attestations.length > 0 ? (
                <p className="box">
                  {t("Votre avocat a vérifié et signé l'acte déposé pour vous le {date}.", { date: frDateHeure(x.attestations[0].le) })}
                </p>
              ) : (
                <p className="note">{t("L'attestation de votre avocat sera disponible dès qu'il aura vérifié et signé l'acte.")}</p>
              )}
              {x.conventions.map((c) => (
                <details key={c.id} className="esp-conv">
                  <summary>
                    {t("Convention d'honoraires acceptée le {date}", { date: frDateHeure(c.accepteeLe) })} · {t("version {v}", { v: c.version })}
                  </summary>
                  <pre>{c.texte}</pre>
                  <p className="note">
                    {t("Empreinte du texte accepté (SHA-256) :")} <code>{c.empreinte.slice(0, 16)}…</code>
                  </p>
                </details>
              ))}
            </section>
          )}

          {onglet === "paiements" && (
            <section className="card">
              <h2>{t("Vos paiements")}</h2>
              <ul className="esp-lignes">
                {x.paiements.map((p) => (
                  <li key={p.id}>
                    <span>
                      {frDateHeure(p.creeLe).split(" ")[0]} · {p.moyen === "klarna" ? t("Klarna, en 3 fois") : p.moyen ? t("Carte bancaire") : ""}
                      {p.parTiers ? ` · ${t("réglé par un proche")}` : ""}
                    </span>
                    <b>
                      {formatEuros(p.montant)}{" "}
                      <span className={`pill ${p.statut === "PAYE" ? "ok" : p.statut === "REMBOURSE" ? "n" : "warn"}`}>
                        {t(p.statut === "PAYE" ? "Payé" : p.statut === "REMBOURSE" ? "Remboursé" : p.statut === "ECHOUE" ? "Échoué" : "En attente")}
                      </span>
                    </b>
                  </li>
                ))}
              </ul>
              <p className="note">{t("Le reçu de chaque paiement vous a été envoyé par e-mail. La facture est établie par la SELARL VARTIS Avocats.")}</p>
            </section>
          )}
        </div>
      </main>
    </>
  );
}
