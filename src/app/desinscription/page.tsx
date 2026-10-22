import { EnteteParcours } from "../composants/Entete";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { db, schema } from "@/db";
import { tServeur } from "@/i18n/serveur";
import { verifier } from "@/lib/jeton";
import { journaliser } from "@/lib/journal";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

export default async function Desinscription({ searchParams }: { searchParams: Promise<{ jeton?: string }> }) {
  const { t } = await tServeur();
  const id = verifier((await searchParams).jeton ?? "");
  if (id) {
    const d = await db();
    const [dos] = await d.select().from(schema.dossiers).where(eq(schema.dossiers.id, id));
    if (dos) {
      await d.update(schema.clients).set({ consentRelances: false }).where(eq(schema.clients.id, dos.clientId));
      await journaliser(d, { dossierId: id, acteur: "CLIENT", action: "DESINSCRIPTION_RELANCES" });
    }
  }
  return (
    <>
      <EnteteParcours />
      <main>
        <div className="wrap" style={{ maxWidth: 820 }}>
        <div className="card">
        <h1>{id ? t("Vous ne recevrez plus de relance.") : t("Lien expiré ou invalide")}</h1>
              </div>
        </div>
      </main>
    </>
  );
}
