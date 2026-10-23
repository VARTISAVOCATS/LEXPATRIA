// Envoi des e-mails et SMS (Brevo, API transactionnelle). Sans clé : envoi simulé, inscrit au journal.
// Secret professionnel : aucun SMS ni WhatsApp ne contient de donnée du client (cahier des charges, 3).

import { valeur } from "./connexions";

export interface Envoi {
  canal: "EMAIL" | "SMS";
  destinataire: string;
  sujet?: string;
  texte: string;
}

export async function envoyer(e: Envoi): Promise<{ ok: boolean; simule: boolean }> {
  const cle = await valeur("BREVO_API_KEY");
  if (!cle) return { ok: true, simule: true };
  const expediteur = { name: "LEXPATRIA Avocats", email: (await valeur("EMAIL_EXPEDITEUR")) ?? "contact@lexpatria.fr" };
  const r =
    e.canal === "EMAIL"
      ? await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "api-key": cle, "content-type": "application/json" },
          body: JSON.stringify({ sender: expediteur, to: [{ email: e.destinataire }], subject: e.sujet, textContent: e.texte }),
        })
      : await fetch("https://api.brevo.com/v3/transactionalSMS/sms", {
          method: "POST",
          headers: { "api-key": cle, "content-type": "application/json" },
          body: JSON.stringify({ sender: "LEXPATRIA", recipient: e.destinataire.replace(/[^\d+]/g, ""), content: e.texte, type: "transactional" }),
        });
  // Échec consigné dans les journaux du serveur (statut et message de Brevo, sans la clé ni le contenu du message).
  if (!r.ok) console.error(`Envoi ${e.canal} refusé par Brevo : ${r.status} ${(await r.text().catch(() => "")).slice(0, 300)}`);
  return { ok: r.ok, simule: false };
}
