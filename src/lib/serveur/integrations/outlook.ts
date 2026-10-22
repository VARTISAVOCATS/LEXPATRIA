// Agendas Outlook des avocats (Microsoft Graph).
// 1. Les absences posées dans Outlook (statut « Absent du bureau ») deviennent des absences de la plateforme :
//    aucune attribution automatique pendant l'absence ni dans les 2 jours ouvrés qui la précèdent.
// 2. Les échéances des dossiers (audiences, mémoires, dates limites) sont inscrites dans l'agenda de l'avocat,
//    avec la seule référence du dossier : ni nom du client, ni contenu du dossier (secret professionnel).

import { and, eq, gte, inArray, isNull, notInArray, sql } from "drizzle-orm";
import type { Base } from "@/db";
import { dossiers, echeances, indisponibilites, utilisateurs } from "@/db/schema";
import { journaliser } from "@/lib/journal";
import { LIBELLES_ECHEANCE } from "../agenda";
import { graph, graphConfigure } from "./graph";
import { messageErreur, tracer } from "./commun";

const ORIGINE = () => process.env.URL_PUBLIQUE ?? "https://lexpatria.fr";
const plusUnJour = (j: string) => {
  const x = new Date(`${j}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + 1);
  return x.toISOString().slice(0, 10);
};

interface Evenement {
  id: string;
  showAs?: string;
  isCancelled?: boolean;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
}

/** Lit les absences des 90 prochains jours dans l'agenda de chaque avocat actif. */
export async function synchroniserAbsences(d: Base, maintenant = new Date()) {
  const avocats = await d
    .select()
    .from(utilisateurs)
    .where(and(eq(utilisateurs.actif, true), inArray(utilisateurs.role, ["AVOCAT", "ASSOCIE"])));
  const fin = new Date(maintenant.getTime() + 90 * 86_400_000);
  let ajoutees = 0;
  for (const u of avocats) {
    const q = new URLSearchParams({
      startDateTime: maintenant.toISOString(),
      endDateTime: fin.toISOString(),
      $select: "id,showAs,isCancelled,start,end",
      $top: "250",
    });
    const r = await graph<{ value: Evenement[] }>(`/users/${encodeURIComponent(u.email)}/calendarView?${q}`, { headers: { prefer: 'outlook.timezone="UTC"' } });
    const absences = r.value.filter((e) => e.showAs === "oof" && !e.isCancelled);
    const ids = absences.map((e) => e.id);
    // Absences supprimées ou déplacées dans Outlook : retirées de la plateforme.
    await d
      .delete(indisponibilites)
      .where(
        and(
          eq(indisponibilites.avocatId, u.id),
          eq(indisponibilites.source, "OUTLOOK"),
          gte(indisponibilites.fin, maintenant),
          ids.length ? notInArray(indisponibilites.outlookId, ids) : sql`true`,
        ),
      );
    for (const e of absences) {
      const debut = new Date(`${e.start.dateTime.slice(0, 19)}Z`);
      const finAbs = new Date(`${e.end.dateTime.slice(0, 19)}Z`);
      const [existe] = await d.select().from(indisponibilites).where(eq(indisponibilites.outlookId, e.id));
      if (existe) await d.update(indisponibilites).set({ debut, fin: finAbs }).where(eq(indisponibilites.id, existe.id));
      else {
        await d.insert(indisponibilites).values({ avocatId: u.id, debut, fin: finAbs, source: "OUTLOOK", motif: "INDISPONIBLE", outlookId: e.id });
        ajoutees++;
      }
    }
  }
  return ajoutees;
}

/** Inscrit dans l'agenda de l'avocat les échéances qui n'y sont pas encore (journée entière, rappel la veille). */
export async function publierEcheances(d: Base) {
  const aPublier = await d
    .select({ e: echeances, ref: dossiers.reference, email: utilisateurs.email })
    .from(echeances)
    .innerJoin(dossiers, eq(dossiers.id, echeances.dossierId))
    .innerJoin(utilisateurs, eq(utilisateurs.id, dossiers.avocatId))
    .where(and(isNull(echeances.outlookId), eq(echeances.faite, false), sql`${echeances.date} >= to_char(now(), 'YYYY-MM-DD')`))
    .limit(50);
  for (const x of aPublier) {
    const ev = await graph<{ id: string }>(`/users/${encodeURIComponent(x.email)}/events`, {
      method: "POST",
      body: JSON.stringify({
        subject: `${LIBELLES_ECHEANCE[x.e.type] ?? x.e.type} — dossier ${x.ref}`,
        body: { contentType: "text", content: `Dossier ${x.ref} : ${ORIGINE()}/avocat/dossiers/${x.ref}` },
        start: { dateTime: `${x.e.date}T00:00:00`, timeZone: "Europe/Paris" },
        end: { dateTime: `${plusUnJour(x.e.date)}T00:00:00`, timeZone: "Europe/Paris" },
        isAllDay: true,
        showAs: "free",
        isReminderOn: true,
        reminderMinutesBeforeStart: 1080, // la veille à 6 h
        categories: ["Lexpatria"],
      }),
    });
    await d.update(echeances).set({ outlookId: ev.id }).where(eq(echeances.id, x.e.id));
    await journaliser(d, { dossierId: x.e.dossierId, acteur: "SYSTEME", action: "ECHEANCE_OUTLOOK", details: { echeanceId: x.e.id } });
  }
  return aPublier.length;
}

export async function synchroniserOutlook(d: Base) {
  if (!(await graphConfigure())) return { outlook: "non configuré" };
  try {
    const absences = await synchroniserAbsences(d);
    const echeancesPubliees = await publierEcheances(d);
    await tracer(d, "outlook", true, `${absences} absence(s) importée(s), ${echeancesPubliees} échéance(s) inscrite(s) dans les agendas.`);
    return { outlook: { absences, echeances: echeancesPubliees } };
  } catch (e) {
    await tracer(d, "outlook", false, messageErreur(e));
    return { outlook: "erreur" };
  }
}
