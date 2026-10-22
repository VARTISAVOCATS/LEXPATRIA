import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db, prochainCodeClient, prochaineReference, schema } from "@/db";

describe("base de données (PGlite)", () => {
  it("crée un client et un pré-dossier numérotés", async () => {
    const d = await db();
    const code = await prochainCodeClient(d);
    const ref = await prochaineReference(d);
    expect(code).toBe("C100001");
    expect(ref).toBe("D1001");
    const [c] = await d.insert(schema.clients).values({ code }).returning();
    const [dos] = await d
      .insert(schema.dossiers)
      .values({ reference: ref, clientId: c.id, procedure: "OQTF" })
      .returning();
    const lu = await d.select().from(schema.dossiers).where(eq(schema.dossiers.id, dos.id));
    expect(lu[0].statut).toBe("PRE_DOSSIER");
  });
});
