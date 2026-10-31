import { connection } from "next/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { countErrors, getDisputes, getUnseenSignups, lastBackupAt } from "@/lib/db";
import { berlinDateTime, getOverview } from "@/lib/server";
import { ADMIN_MAIL, mailConfigured } from "@/lib/mail";
import AdminPlayers from "./AdminPlayers";
import MailList from "./MailList";
import { COHORTS } from "@/lib/names";
import MarkDisputesSeen from "./MarkDisputesSeen";

export default async function AdminPage() {
  await connection();
  const session = await getSession();
  if (!session?.admin) redirect("/profil");
  const [{ world, ov, nameOf }, disputes, signups, lastBackup, errors] = await Promise.all([
    getOverview(),
    getDisputes(),
    getUnseenSignups(),
    lastBackupAt(),
    countErrors(7),
  ]);
  const unseen = disputes.some((d) => !d.seen) || signups.length > 0;

  const players = world.players.map((p) => ({
    id: p.id,
    name: p.name,
    email: p.email ?? "",
    hidden: p.hidden,
    games: ov.byId[p.id]?.games ?? 0,
    founder: p.founder,
    cohort: p.cohort ?? "",
  }));

  return (
    <>
      <Link href="/profil" className="back-link">
        ← Mein Profil
      </Link>
      <h1>Admin-Bereich</h1>
      <p className="subtitle">
        {world.players.length} Spieler · {world.matches.length} Spiele
      </p>
      {!mailConfigured() && (
        <p className="message error">
          Mail-Versand ist noch nicht eingerichtet (GMAIL_USER / GMAIL_APP_PASSWORD fehlen in Vercel). Anmeldelinks
          werden nicht verschickt.
        </p>
      )}

      {errors > 0 && (
        <p className="message error">
          {errors === 1 ? "1 Fehler" : `${errors} Fehler`} in den letzten 7 Tagen – Details kamen per Mail an {ADMIN_MAIL}.
        </p>
      )}
      <MarkDisputesSeen needed={unseen} />
      {signups.length > 0 && (
        <p className="message success">
          Neu angemeldet: {signups.map((p) => p.name).join(", ")}
        </p>
      )}
      <div className="section-h">
        <h2>Widersprüche</h2>
        <span>gelöschte Spiele</span>
      </div>
      {disputes.length === 0 ? (
        <p className="empty small">Noch keine.</p>
      ) : (
        <div className="card disputes">
          {disputes.map((d) => (
            <div className={`dispute-row${d.seen ? "" : " new"}`} key={d.id}>
              <div>
                <b>{nameOf(d.winner_id)}{d.winner2_id && ` & ${nameOf(d.winner2_id)}`}</b> schlägt{" "}
                <b>{nameOf(d.loser_id)}{d.loser2_id && ` & ${nameOf(d.loser2_id)}`}</b>
                {d.winner2_id && <span className="muted small"> (Doppel)</span>}
              </div>
              <div className="muted small">
                eingetragen von {d.entered_by ? nameOf(d.entered_by) : "–"} am {berlinDateTime(d.played_at)}
              </div>
              <div className="small">
                {d.disputed_by === d.entered_by ? "selbst gelöscht" : `widersprochen von ${nameOf(d.disputed_by)}`} am{" "}
                {berlinDateTime(d.created_at)}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="section-h">
        <h2>Spieler</h2>
        <span>Name, Uni-Mail, sichtbar</span>
      </div>
      <p className="hint-left">
        Uni-Mail eintragen, speichern und dann „Einladung schicken“ tippen – die Mail ist 7 Tage gültig. Wer sich mit
        dieser Adresse anmeldet, übernimmt seinen bestehenden Spieler.
      </p>
      <AdminPlayers players={players} cohorts={COHORTS} />

      <div className="section-h">
        <h2>Mail-Adressen</h2>
        <span>für BCC · ohne ausgeblendete</span>
      </div>
      <MailList emails={world.players.filter((p) => p.email && !p.hidden).map((p) => p.email!)} />

      <div className="section-h">
        <h2>Sicherung</h2>
        <span>{lastBackup ? `zuletzt per Mail: ${berlinDateTime(lastBackup)}` : "noch keine per Mail"}</span>
      </div>
      <p className="hint-left">
        Jeden Sonntag früh geht automatisch eine Sicherung aller Spieler und Spiele an {ADMIN_MAIL}. Hier kannst du
        jederzeit eine aktuelle herunterladen.
      </p>
      <a href="/api/admin/backup" className="nav-link" download>
        Sicherung herunterladen →
      </a>

      <Link href="/profil/test" className="cta cta-test">
        <span className="cta-felt">
          <span className="cta-label">Testspiel eintragen</span>
        </span>
      </Link>
      <p className="me-note">Testspiele laufen mit der kompletten Animation, werden aber nicht gespeichert.</p>
      <Link href="/profil/animation" className="nav-link">
        Sieges-Animation ansehen (1 gegen 1 / 2 gegen 2) →
      </Link>
    </>
  );
}
