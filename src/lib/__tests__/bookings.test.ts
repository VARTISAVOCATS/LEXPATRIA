// Consultation en visio : paiement, puis réservation du créneau (Microsoft Bookings simulé, puis Graph remplacé).
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { db, prochainCodeClient, prochaineReference, schema } from "@/db";
import { texteConvention } from "@/lib/convention";
import { viderCacheConnexions } from "@/lib/serveur/connexions";
import { creneaux, reserver } from "@/lib/serveur/integrations/bookings";
import { accepterConvention, charger, creerIntention, marquerPaye, offre } from "@/lib/serveur/paiement";

const relire = async (id: string) => (await (await db()).select().from(schema.dossiers).where(eq(schema.dossiers.id, id)))[0];

async function consultationPayee(email: string) {
  const d = await db();
  const [c] = await d
    .insert(schema.clients)
    .values({ code: await prochainCodeClient(d), email, prenom: "Lina", nom: "Test", civilite: "MADAME", telephone: "0600000000", adresse: "1 rue de Rivoli", codePostal: "75001", ville: "Paris", pays: "FR" })
    .returning();
  const [dos] = await d.insert(schema.dossiers).values({ reference: await prochaineReference(d), clientId: c.id, procedure: "CONSULTATION", traitement: "DIRECT" }).returning();
  const x = (await charger(d, dos.id))!;
  await accepterConvention(d, x.dos, x.cli, "127.0.0.1");
  const i = await creerIntention(d, x.dos, x.cli, false);
  if ("simulation" in i && i.simulation) await marquerPaye(d, dos.id, { paiementId: i.paiementId, moyen: "simulation" });
  return relire(dos.id);
}

afterEach(() => {
  vi.unstubAllGlobals();
  for (const k of ["MS_TENANT_ID", "MS_CLIENT_ID", "MS_CLIENT_SECRET", "BOOKINGS_ENTREPRISE", "BOOKINGS_SERVICE"]) delete process.env[k];
  viderCacheConnexions();
});

describe("consultation en visio", () => {
  it("se règle 89 €, sans attribution, avec une convention propre à la consultation", async () => {
    const d = await db();
    const dos = await consultationPayee("visio1@exemple.invalid");
    expect(dos.statut).toBe("PAYE");
    expect(dos.avocatId).toBeNull();
    expect((await offre(d, dos)).total).toBe(8_900);
    const [conv] = await d.select().from(schema.conventions).where(eq(schema.conventions.dossierId, dos.id));
    expect(conv.texte).toContain("entretien de trente minutes en visioconférence");
    expect(conv.texte).not.toContain("délai de recours était déjà expiré");
    expect(texteConvention({ reference: "D1", procedureLibelle: "x", recoursPrealable: false, consultation: true, lignes: [] })).toContain("la consultation est due");
  });

  it("réserve un créneau simulé, puis refuse une seconde réservation", async () => {
    const d = await db();
    const dos = await consultationPayee("visio2@exemple.invalid");
    const libres = await creneaux(new Date("2026-11-02T07:00:00Z"));
    expect(libres.length).toBeGreaterThan(20);
    const [premier] = await creneaux();
    const r = await reserver(d, dos, premier.debut);
    expect(r.ok).toBe(true);
    const apres = await relire(dos.id);
    expect(apres.statut).toBe("PRIS_EN_CHARGE");
    expect((apres.rendezVous as { simule: boolean }).simule).toBe(true);
    expect((await reserver(d, apres, premier.debut)).ok).toBe(false);
  });

  it("avec Bookings configuré : lit les disponibilités, crée le rendez-vous Teams et confie le dossier à l'avocat du créneau", async () => {
    const d = await db();
    Object.assign(process.env, { MS_TENANT_ID: "t", MS_CLIENT_ID: "c", MS_CLIENT_SECRET: "s", BOOKINGS_ENTREPRISE: "consult@vartis.law", BOOKINGS_SERVICE: "svc-1" });
    viderCacheConnexions();
    const kachi = (await d.select().from(schema.utilisateurs).where(eq(schema.utilisateurs.email, "boualem.kachi@exemple.invalid")))[0];
    const corps: Record<string, unknown>[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.includes("login.microsoftonline.com")) return new Response(JSON.stringify({ access_token: "j", expires_in: 3600 }));
        if (init?.body) corps.push(JSON.parse(String(init.body)));
        if (url.endsWith("/staffMembers")) return new Response(JSON.stringify({ value: [{ id: "st1" }] }));
        if (url.includes("/staffMembers/st1")) return new Response(JSON.stringify({ emailAddress: kachi.email }));
        if (url.endsWith("/getStaffAvailability"))
          return new Response(
            JSON.stringify({
              value: [{ staffId: "st1", availabilityItems: [{ status: "available", startDateTime: { dateTime: "2099-03-02T10:00:00" }, endDateTime: { dateTime: "2099-03-02T11:00:00" } }] }],
            }),
          );
        if (url.endsWith("/appointments")) return new Response(JSON.stringify({ id: "apt-9", joinWebUrl: "https://teams.microsoft.com/l/meetup-join/x" }));
        return new Response("{}", { status: 404 });
      }),
    );
    const libres = await creneaux(new Date("2099-03-01T00:00:00Z"));
    expect(libres.map((c) => c.debut)).toEqual(["2099-03-02T09:00:00.000Z", "2099-03-02T09:30:00.000Z"]); // 10 h et 10 h 30 à Paris (UTC+1)
    const dos = await consultationPayee("visio3@exemple.invalid");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2099-03-01T00:00:00Z"));
    const r = await reserver(d, dos, "2099-03-02T09:30:00.000Z");
    vi.useRealTimers();
    expect(r.ok).toBe(true);
    const rdv = corps.find((b) => b.serviceId === "svc-1") as { startDateTime: { dateTime: string }; staffMemberIds: string[]; isLocationOnline: boolean; serviceNotes: string };
    expect(rdv.startDateTime.dateTime).toBe("2099-03-02T10:30:00");
    expect(rdv.staffMemberIds).toEqual(["st1"]);
    expect(rdv.isLocationOnline).toBe(true);
    expect(rdv.serviceNotes).toBe(`Dossier Lexpatria ${dos.reference}`);
    const apres = await relire(dos.id);
    expect(apres.avocatId).toBe(kachi.id);
    expect((apres.rendezVous as { lienVisio: string }).lienVisio).toContain("teams.microsoft.com");
  });
});
