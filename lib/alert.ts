import { logError } from "./db";
import { ADMIN_MAIL, sendMail, wrapMail } from "./mail";
import { berlinDateTime } from "./server";

// Meldet einen Fehler: ins Server-Log, ins Fehlerprotokoll und – höchstens
// alle 30 Minuten – per Mail an den Admin. Wirft selbst nie einen Fehler.
export async function reportError(place: string, err: unknown): Promise<void> {
  const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  console.error(`[${place}]`, err);
  try {
    const { mail, recent } = await logError(place, message);
    if (!mail) return;
    const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
    const lines = recent.map((r) => `• ${berlinDateTime(r.at)} – ${r.place}: ${r.message}`);
    const subject = `⚠️ Fehler in Billard BLS (${recent.length})`;
    const text = `In der App ist etwas schiefgegangen:\n\n${lines.join("\n")}\n\nWeitere Fehler in der nächsten halben Stunde kommen gesammelt in der nächsten Mail.`;
    const html = wrapMail(`<p style="margin:0 0 10px;font-size:15px;line-height:1.5">In der App ist etwas schiefgegangen:</p>
<ul style="margin:0 0 10px;padding-left:18px;font-size:13px;line-height:1.5">${recent
      .map((r) => `<li><b>${esc(berlinDateTime(r.at))}</b> – ${esc(r.place)}: ${esc(r.message)}</li>`)
      .join("")}</ul>
<p style="margin:0;font-size:12px;opacity:.75">Weitere Fehler in der nächsten halben Stunde kommen gesammelt in der nächsten Mail.</p>`);
    await sendMail(ADMIN_MAIL, subject, text, html, { bcc: false });
  } catch (e) {
    console.error("Fehlermeldung konnte nicht verschickt werden", e);
  }
}
