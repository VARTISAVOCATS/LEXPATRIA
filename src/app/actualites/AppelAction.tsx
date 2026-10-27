// Fin d'article : l'invitation à agir, en deux gestes au choix, sous le regard des avocats du cabinet.
import Link from "next/link";
import { db } from "@/db";
import { contenusPublics } from "@/lib/serveur/parametres";
import { Visages } from "../composants/Vitrine";

export default async function AppelAction({ titre }: { titre?: string }) {
  const { avocats } = await contenusPublics(await db());
  return (
    <aside className="acc-fin art-fin">
      <Visages avocats={avocats} petit />
      <h2>{titre ?? "Vous êtes dans cette situation ?"}</h2>
      <p>Exposez votre situation en ligne : la procédure et votre date limite vous sont indiquées, puis un avocat du cabinet prend votre dossier sous 48 heures ouvrées.</p>
      <div className="art-cta-b">
        <Link className="btn cta" href="/depot">
          Engager la procédure
        </Link>
        <Link className="btn ghost" href="/depot?mode=photo">
          Confier mon dossier au cabinet
        </Link>
      </div>
    </aside>
  );
}
