import { exportAll, lastBackupAt, logBackup } from "./db";
import { ADMIN_MAIL, sendMail, wrapMail } from "./mail";
import { reportError } from "./alert";

// Sicherung als JSON-Datei. Enthält alles, was man braucht, um die App bei
// Datenverlust wiederherzustellen (Spieler, Spiele, Widersprüche).
export async function buildBackup() {
  const data = await exportAll();
  const createdAt = new Date().toISOString();
  const day = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date());
  const json = JSON.stringify(
    {
      app: "Billard BLS",
      version: 1,
      created_at: createdAt,
      counts: {
        players: data.players.length,
        matches: data.matches.length,
        disputes: data.disputes.length,
      },
      ...data,
    },
    null,
    1
  );
  return { json, filename: `billard-bls-sicherung-${day}.json`, counts: { players: data.players.length, matches: data.matches.length } };
}

// Wöchentliche Sicherung per Mail – höchstens alle 6 Tage.
export async function runWeeklyBackup() {
  const last = await lastBackupAt();
  if (last && Date.now() - new Date(last).getTime() < 6 * 24 * 3600_000) {
    return { skipped: true as const, last };
  }

  const { json, filename, counts } = await buildBackup();
  const subject = `Sicherung Billard BLS – ${counts.matches} Spiele, ${counts.players} Spieler`;
  const text = `Die wöchentliche Sicherung liegt im Anhang (${filename}).

Stand: ${counts.players} Spieler, ${counts.matches} Spiele.

Einfach in diesem Postfach liegen lassen. Im Notfall lässt sich die App damit wiederherstellen.`;
  const html = wrapMail(`<p style="margin:0 0 10px;font-size:15px;line-height:1.5">Die wöchentliche Sicherung liegt im Anhang.</p>
<p style="margin:0 0 10px;font-size:15px;line-height:1.5"><b>${counts.players}</b> Spieler · <b>${counts.matches}</b> Spiele</p>
<p style="margin:0;font-size:13px;line-height:1.5;opacity:.8">Einfach in diesem Postfach liegen lassen. Im Notfall lässt sich die App damit wiederherstellen.</p>`);

  try {
    await sendMail(ADMIN_MAIL, subject, text, html, {
      bcc: false,
      attachments: [{ filename, content: json, contentType: "application/json" }],
    });
  } catch (err) {
    await reportError("Wöchentliche Sicherung", err);
    return { error: true as const };
  }
  await logBackup(counts.matches);
  return { success: true as const, matches: counts.matches };
}
