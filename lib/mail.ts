import nodemailer from "nodemailer";

// Mail-Versand über das Gmail-Konto bls.billard@gmail.com.
// In Vercel setzen:
//   GMAIL_USER          = bls.billard@gmail.com
//   GMAIL_APP_PASSWORD  = 16-stelliges App-Passwort von Google
// Ohne diese Variablen werden Mails nur ins Server-Log geschrieben
// (praktisch zum lokalen Testen).

export const ADMIN_MAIL = process.env.ADMIN_MAIL ?? "bls.billard@gmail.com";

export function mailConfigured(): boolean {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

export async function sendMail(to: string, subject: string, text: string, html: string): Promise<void> {
  if (!mailConfigured()) {
    console.log(`[mail] an ${to}: ${subject}\n${text}`);
    if (process.env.LOCAL_MAIL_LOG) {
      const fs = await import("fs");
      fs.appendFileSync(process.env.LOCAL_MAIL_LOG, JSON.stringify({ to, subject, text }) + "\n");
    }
    return;
  }
  transporter ??= nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD!.replace(/\s+/g, "") },
  });
  await transporter.sendMail({
    from: `"Billard BLS" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    text,
    html,
  });
}

const wrap = (inner: string) => `<!doctype html><html><body style="margin:0;background:#f1e9d8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1b1b1b">
<div style="max-width:440px;margin:0 auto;padding:28px 20px">
<div style="background:#1f4a3d;border:6px solid #5a3219;border-radius:14px;padding:22px 20px;color:#f1e9d8">
<div style="font-family:Georgia,serif;font-size:22px;font-weight:bold;margin-bottom:12px">🎱 Billard BLS</div>
${inner}
</div>
<p style="font-size:12px;color:#6b6252;text-align:center;margin-top:14px">Billard-Rangliste der Bucerius Law School</p>
</div></body></html>`;

export function loginMail(link: string, code: string) {
  const subject = `Dein Anmeldelink für Billard BLS (Code ${code})`;
  const text = `Hallo!

Tippe auf diesen Link, um dich bei Billard BLS anzumelden:
${link}

Oder gib diesen Code in der App ein: ${code}

Link und Code sind 15 Minuten gültig. Wenn du das nicht angefordert hast, kannst du diese Mail ignorieren.`;
  const html = wrap(`
<p style="margin:0 0 16px;font-size:15px;line-height:1.5">Tippe auf den Knopf, um dich anzumelden:</p>
<p style="margin:0 0 20px"><a href="${link}" style="display:inline-block;background:#e0bc4a;color:#1b1405;text-decoration:none;font-weight:bold;padding:13px 22px;border-radius:10px;font-size:16px">Jetzt anmelden</a></p>
<p style="margin:0 0 6px;font-size:14px;opacity:.85">Oder diesen Code in der App eingeben:</p>
<p style="margin:0 0 18px;font-family:Menlo,Consolas,monospace;font-size:30px;letter-spacing:6px;font-weight:bold;color:#e0bc4a">${code}</p>
<p style="margin:0;font-size:12px;opacity:.7;line-height:1.5">Link und Code sind 15 Minuten gültig. Wenn du das nicht angefordert hast, kannst du diese Mail ignorieren.</p>`);
  return { subject, text, html };
}

export function disputeMail(p: {
  winner: string;
  loser: string;
  enteredBy: string;
  disputedBy: string;
  playedAt: string;
  adminLink: string;
}) {
  const subject = `Billard BLS: Spiel ${p.winner} gegen ${p.loser} wurde widersprochen`;
  const text = `${p.disputedBy} hat „Stimmt nicht“ gedrückt.

Spiel: ${p.winner} hat gegen ${p.loser} gewonnen
Eingetragen von: ${p.enteredBy}
Eingetragen am: ${p.playedAt}

Das Spiel wurde gelöscht und die Elo neu berechnet.
Admin-Bereich: ${p.adminLink}`;
  const html = wrap(`
<p style="margin:0 0 12px;font-size:15px;line-height:1.5"><b>${p.disputedBy}</b> hat bei einem Spiel „Stimmt nicht“ gedrückt.</p>
<table style="font-size:14px;line-height:1.6;color:#f1e9d8">
<tr><td style="opacity:.7;padding-right:10px">Spiel</td><td>${p.winner} schlägt ${p.loser}</td></tr>
<tr><td style="opacity:.7;padding-right:10px">Eingetragen von</td><td>${p.enteredBy}</td></tr>
<tr><td style="opacity:.7;padding-right:10px">Am</td><td>${p.playedAt}</td></tr>
</table>
<p style="margin:14px 0 16px;font-size:14px;opacity:.85">Das Spiel wurde gelöscht und die Elo neu berechnet.</p>
<p style="margin:0"><a href="${p.adminLink}" style="color:#e0bc4a">Zum Admin-Bereich</a></p>`);
  return { subject, text, html };
}
