// Rendu du texte d'un article : « ## » intertitre, « ### » sous-titre, « - » liste, **gras**, [lien](https://…).
// Composant sans état : utilisé sur le site et dans l'aperçu du back office.
import type { ReactNode } from "react";

export const dateFr = (d: Date) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" }).format(d);

function enLigne(t: string, cle: string): ReactNode[] {
  const res: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(((?:https?:\/\/|\/)[^\s)]+)\)/g;
  let i = 0;
  let m: RegExpExecArray | null;
  let n = 0;
  while ((m = re.exec(t))) {
    if (m.index > i) res.push(t.slice(i, m.index));
    if (m[1]) res.push(<strong key={`${cle}-${n++}`}>{m[1]}</strong>);
    else res.push(<a key={`${cle}-${n++}`} href={m[3]}>{m[2]}</a>);
    i = m.index + m[0].length;
  }
  if (i < t.length) res.push(t.slice(i));
  return res;
}

export type BlocArticle = { type: "h2" | "h3" | "p"; texte: string } | { type: "ul"; items: string[] };

export function analyser(contenu: string): BlocArticle[] {
  const blocs: BlocArticle[] = [];
  let para: string[] = [];
  let liste: string[] = [];
  const fermer = () => {
    if (para.length) blocs.push({ type: "p", texte: para.join(" ") });
    if (liste.length) blocs.push({ type: "ul", items: liste });
    para = [];
    liste = [];
  };
  for (const brute of contenu.replace(/\r/g, "").split("\n")) {
    const l = brute.trim();
    if (!l) fermer();
    else if (l.startsWith("### ")) (fermer(), blocs.push({ type: "h3", texte: l.slice(4) }));
    else if (l.startsWith("## ")) (fermer(), blocs.push({ type: "h2", texte: l.slice(3) }));
    else if (/^[-•]\s+/.test(l)) {
      if (para.length) fermer();
      liste.push(l.replace(/^[-•]\s+/, ""));
    } else {
      if (liste.length) fermer();
      para.push(l);
    }
  }
  fermer();
  return blocs;
}

export default function Contenu({ texte }: { texte: string }) {
  return (
    <div className="art-corps">
      {analyser(texte).map((b, i) =>
        b.type === "ul" ? (
          <ul key={i}>
            {b.items.map((x, j) => (
              <li key={j}>{enLigne(x, `${i}-${j}`)}</li>
            ))}
          </ul>
        ) : b.type === "h2" ? (
          <h2 key={i}>{b.texte}</h2>
        ) : b.type === "h3" ? (
          <h3 key={i}>{b.texte}</h3>
        ) : (
          <p key={i}>{enLigne(b.texte, String(i))}</p>
        ),
      )}
    </div>
  );
}
