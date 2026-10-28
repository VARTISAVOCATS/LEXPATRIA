// Microsoft Bookings (Microsoft Graph) : consultation en visio à 89 €.
// Le service « Consultation » est masqué sur la page publique de Bookings : on ne peut réserver qu'après paiement,
// depuis Lexpatria, qui lit les disponibilités des avocats et crée le rendez-vous (lien Teams envoyé par Bookings).
// Autorisations d'application Graph : Bookings.Read.All et BookingsAppointment.ReadWrite.All.
// Sans configuration (développement) : créneaux simulés, aucun rendez-vous n'est créé chez Microsoft.

import { eq } from "drizzle-orm";
import type { Base } from "@/db";
import { clients, dossiers, utilisateurs } from "@/db/schema";
import { estOuvre, instantParis, versJour } from "@/lib/calendrier";
import { journaliser } from "@/lib/journal";
import { DUREE_CONSULTATION_MIN } from "@/lib/procedures";
import { valeur } from "../connexions";
import type { Dossier } from "../dossiers";
import { envoyer } from "../notifications";
import { graph, graphConfigure } from "./graph";

export interface Creneau {
  debut: string; // ISO UTC
  fin: string;
  staffId: string;
}

export interface RendezVous {
  id: string;
  debut: string;
  fin: string;
  lienVisio: string | null;
  avocatEmail: string | null;
  simule?: boolean;
}

const PAS_MIN = 30;
const OUVERTURE = 9 * 60;
const FERMETURE = 19 * 60;
const DELAI_MIN_H = 4; // pas de créneau dans les 4 prochaines heures

async function config() {
  const [entreprise, service] = await Promise.all([valeur("BOOKINGS_ENTREPRISE"), valeur("BOOKINGS_SERVICE")]);
  if (!entreprise || !service || !(await graphConfigure())) return null;
  return { entreprise: encodeURIComponent(entreprise), service };
}

export const bookingsConfigure = async () => !!(await config());

/** L'offre de consultation n'est proposée en production qu'une fois Microsoft Bookings configuré (sinon, rendez-vous fictif). */
export const consultationOuverte = async () => process.env.NODE_ENV !== "production" || (await bookingsConfigure());

/** Heure de Paris « AAAA-MM-JJTHH:MM:SS » → instant UTC. */
function depuisParis(local: string): Date {
  const [j, h] = local.split("T");
  const [hh, mm] = h.split(":").map(Number);
  return instantParis(new Date(`${j}T00:00:00Z`), hh * 60 + mm);
}
const versParis = (d: Date) =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
    .format(d)
    .replace(" ", "T");

/** Découpe une plage disponible en créneaux de 30 minutes. */
function decouper(debut: Date, fin: Date, staffId: string, apres: Date): Creneau[] {
  const res: Creneau[] = [];
  const pas = PAS_MIN * 60_000;
  const duree = DUREE_CONSULTATION_MIN * 60_000;
  let t = Math.ceil(debut.getTime() / pas) * pas;
  while (t + duree <= fin.getTime()) {
    if (t >= apres.getTime()) res.push({ debut: new Date(t).toISOString(), fin: new Date(t + duree).toISOString(), staffId });
    t += pas;
  }
  return res;
}

/** Créneaux simulés (développement) : jours ouvrés, 9 h–19 h, toutes les 30 minutes. */
function creneauxSimules(depuis: Date, jours: number): Creneau[] {
  const res: Creneau[] = [];
  const apres = new Date(depuis.getTime() + DELAI_MIN_H * 3_600_000);
  let j = versJour(depuis);
  for (let n = 0; n < jours; n++, j = new Date(j.getTime() + 86_400_000)) {
    if (!estOuvre(j)) continue;
    res.push(...decouper(instantParis(j, OUVERTURE), instantParis(j, FERMETURE), "simulation", apres));
  }
  return res;
}

/** Créneaux libres des 14 prochains jours, tous avocats confondus (un créneau par horaire). */
export async function creneaux(depuis = new Date(), jours = 14): Promise<Creneau[]> {
  const c = await config();
  if (!c) return creneauxSimules(depuis, jours);
  const staff = await graph<{ value: { id: string }[] }>(`/solutions/bookingBusinesses/${c.entreprise}/staffMembers`);
  const fin = new Date(depuis.getTime() + jours * 86_400_000);
  const r = await graph<{ value: { staffId: string; availabilityItems: { status: string; startDateTime: { dateTime: string }; endDateTime: { dateTime: string } }[] }[] }>(
    `/solutions/bookingBusinesses/${c.entreprise}/getStaffAvailability`,
    {
      method: "POST",
      body: JSON.stringify({
        staffIds: staff.value.map((s) => s.id),
        startDateTime: { dateTime: versParis(depuis), timeZone: "Europe/Paris" },
        endDateTime: { dateTime: versParis(fin), timeZone: "Europe/Paris" },
      }),
    },
  );
  const apres = new Date(depuis.getTime() + DELAI_MIN_H * 3_600_000);
  const tous = r.value.flatMap((s) =>
    s.availabilityItems
      .filter((a) => a.status === "available" || a.status === "slotsAvailable")
      .flatMap((a) => decouper(depuisParis(a.startDateTime.dateTime.slice(0, 19)), depuisParis(a.endDateTime.dateTime.slice(0, 19)), s.staffId, apres)),
  );
  // Un seul créneau par horaire ; l'avocat est choisi parmi ceux qui sont libres.
  const parHeure = new Map<string, Creneau>();
  for (const x of tous) if (!parHeure.has(x.debut)) parHeure.set(x.debut, x);
  return [...parHeure.values()].sort((a, b) => a.debut.localeCompare(b.debut));
}

/** Réserve le créneau choisi après paiement ; le dossier passe à « Pris en charge » avec l'avocat du rendez-vous. */
export async function reserver(d: Base, dos: Dossier, debut: string): Promise<{ ok: true; rdv: RendezVous } | { ok: false; erreur: string }> {
  if (dos.procedure !== "CONSULTATION") return { ok: false, erreur: "Ce dossier n'est pas une consultation." };
  if (dos.statut !== "PAYE") return { ok: false, erreur: dos.rendezVous ? "Votre rendez-vous est déjà fixé." : "Le paiement n'est pas encore confirmé." };
  const libres = await creneaux();
  const choisi = libres.find((x) => x.debut === debut);
  if (!choisi) return { ok: false, erreur: "Ce créneau vient d'être pris. Choisissez-en un autre." };
  const [cli] = await d.select().from(clients).where(eq(clients.id, dos.clientId));
  const c = await config();
  let rdv: RendezVous;
  if (!c) {
    if (process.env.NODE_ENV === "production" && !process.env.AUTORISER_SIMULATION) return { ok: false, erreur: "La prise de rendez-vous n'est pas encore ouverte." };
    rdv = { id: `simulation-${dos.reference}`, debut: choisi.debut, fin: choisi.fin, lienVisio: null, avocatEmail: null, simule: true };
  } else {
    const fin = new Date(new Date(choisi.debut).getTime() + DUREE_CONSULTATION_MIN * 60_000);
    const a = await graph<{ id: string; joinWebUrl?: string; staffMemberIds?: string[] }>(`/solutions/bookingBusinesses/${c.entreprise}/appointments`, {
      method: "POST",
      body: JSON.stringify({
        "@odata.type": "#microsoft.graph.bookingAppointment",
        serviceId: c.service,
        staffMemberIds: [choisi.staffId],
        startDateTime: { "@odata.type": "#microsoft.graph.dateTimeTimeZone", dateTime: versParis(new Date(choisi.debut)), timeZone: "Europe/Paris" },
        endDateTime: { "@odata.type": "#microsoft.graph.dateTimeTimeZone", dateTime: versParis(fin), timeZone: "Europe/Paris" },
        isLocationOnline: true,
        customerTimeZone: "Europe/Paris",
        // Seule la référence figure dans l'agenda : la question du client reste dans Lexpatria (secret professionnel).
        serviceNotes: `Dossier Lexpatria ${dos.reference}`,
        customers: [
          {
            "@odata.type": "#microsoft.graph.bookingCustomerInformation",
            name: `${cli?.prenom ?? ""} ${(cli?.nom ?? "").toUpperCase()}`.trim(),
            emailAddress: cli?.email ?? "",
            phone: cli?.telephone ?? "",
          },
        ],
      }),
    });
    const membre = await graph<{ emailAddress?: string }>(`/solutions/bookingBusinesses/${c.entreprise}/staffMembers/${choisi.staffId}`).catch(() => null);
    rdv = { id: a.id, debut: choisi.debut, fin: fin.toISOString(), lienVisio: a.joinWebUrl ?? null, avocatEmail: membre?.emailAddress ?? null };
  }
  // L'avocat du rendez-vous devient l'avocat du dossier (rapprochement par adresse e-mail).
  const [av] = rdv.avocatEmail ? await d.select().from(utilisateurs).where(eq(utilisateurs.email, rdv.avocatEmail.toLowerCase())) : [];
  await d
    .update(dossiers)
    .set({ rendezVous: rdv, statut: "PRIS_EN_CHARGE", avocatId: av?.id ?? dos.avocatId, accepteLe: new Date(), majLe: new Date() })
    .where(eq(dossiers.id, dos.id));
  await journaliser(d, { dossierId: dos.id, acteur: "CLIENT", action: "RENDEZ_VOUS_RESERVE", details: { debut: rdv.debut, bookings: rdv.id, simule: !!rdv.simule } });
  if (av)
    await envoyer({
      canal: "EMAIL",
      destinataire: av.email,
      sujet: `Consultation en visio — dossier ${dos.reference}`,
      texte: `Rendez-vous le ${new Date(rdv.debut).toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "full", timeStyle: "short" })}.\n${process.env.URL_PUBLIQUE ?? "https://lexpatria.fr"}/avocat/dossiers/${dos.reference}`,
    });
  return { ok: true, rdv };
}
