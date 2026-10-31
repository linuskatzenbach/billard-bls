import { NextRequest, NextResponse } from "next/server";
import { buildBackup } from "@/lib/backup";
import { lastBackupAt, logBackup } from "@/lib/db";
import { ADMIN_MAIL, sendMail, wrapMail } from "@/lib/mail";
import { jsonError } from "@/lib/server";
import { reportError } from "@/lib/alert";

// Wöchentliche Sicherung per Mail an den Admin. Wird von Vercel automatisch
// aufgerufen (siehe vercel.json, sonntags früh).
//
// Schutz: Ist in Vercel CRON_SECRET gesetzt, schickt Vercel ihn mit und nur
// dann läuft die Sicherung. Unabhängig davon wird höchstens alle 6 Tage eine
// Mail verschickt – selbst wenn jemand die Adresse von Hand aufruft.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return jsonError("Nicht erlaubt.", 401);
  }

  const last = await lastBackupAt();
  if (last && Date.now() - new Date(last).getTime() < 6 * 24 * 3600_000) {
    return NextResponse.json({ skipped: true, last });
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
    return jsonError("Sicherung konnte nicht verschickt werden.", 500);
  }
  await logBackup(counts.matches);
  return NextResponse.json({ success: true, matches: counts.matches });
}
