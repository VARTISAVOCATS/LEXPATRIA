// Fin d'article : l'invitation à agir, en deux gestes au choix.
import Link from "next/link";

export default function AppelAction({ titre }: { titre?: string }) {
  return (
    <aside className="art-cta">
      <h2>{titre ?? "Vous êtes dans cette situation ?"}</h2>
      <p>Exposez votre situation en ligne : la procédure et votre date limite vous sont indiquées, puis un avocat du cabinet prend votre dossier sous 48 heures ouvrées.</p>
      <div className="art-cta-b">
        <Link className="btn cta" href="/depot">
          Engager la procédure
        </Link>
        <Link className="btn ghost" href="/depot?mode=photo">
          Confier mon dossier à nos avocats
        </Link>
      </div>
    </aside>
  );
}
