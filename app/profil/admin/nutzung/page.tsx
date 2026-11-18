import { connection } from "next/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getWorld } from "@/lib/db";
import { computeUsage } from "@/lib/usage";

const de = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });
const dateDe = (k: string) => {
  const [y, m, d] = k.split("-");
  return `${d}.${m}.${y}`;
};
const shortDe = (k: string) => {
  const [, m, d] = k.split("-");
  return `${d}.${m}.`;
};

function Bars({ items, unit }: { items: { label: string; value: number }[]; unit: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="card usage-bars">
      {items.map((i) => (
        <div className="usage-bar-row" key={i.label}>
          <span className="usage-bar-label">{i.label}</span>
          <span className="usage-bar-track">
            <span className="usage-bar" style={{ width: `${(i.value / max) * 100}%` }} />
          </span>
          <span className="usage-bar-value">
            {i.value} <span className="muted">{unit}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

export default async function UsagePage() {
  await connection();
  const session = await getSession();
  if (!session?.admin) redirect("/profil");
  const u = computeUsage(await getWorld());

  const tiles: [string, string][] = [
    [de.format(u.players), "Spieler"],
    [de.format(u.games), "Spiele seit Öffnung"],
    [de.format(u.active30), "aktiv (30 Tage)"],
    [de.format(u.games30), "Spiele (30 Tage)"],
    [de.format(u.active7), "aktiv (7 Tage)"],
    [de.format(u.games7), "Spiele (7 Tage)"],
  ];

  return (
    <>
      <Link href="/profil/admin" className="back-link">
        ← Admin-Bereich
      </Link>
      <h1>Nutzung</h1>
      <p className="subtitle">
        {u.firstDay ? `seit der Uni-Öffnung am ${dateDe(u.firstDay)} · ${u.daysRunning} Tage` : "noch keine Daten"}
      </p>

      <div className="usage-tiles">
        {tiles.map(([v, l]) => (
          <div className="card usage-tile" key={l}>
            <b>{v}</b>
            <span>{l}</span>
          </div>
        ))}
      </div>

      <div className="card usage-facts">
        <div>
          <span>Neu dazugekommen seit Öffnung</span>
          <b>{u.newPlayers}</b>
        </div>
        <div>
          <span>Mit eigenem Konto (Uni-Mail)</span>
          <b>{u.withAccount}</b>
        </div>
        <div>
          <span>Haben seit Öffnung gespielt</span>
          <b>{u.activeEver}</b>
        </div>
        <div>
          <span>Jahrgänge vertreten</span>
          <b>{u.cohorts}</b>
        </div>
        <div>
          <span>Ø Spiele pro Tag</span>
          <b>{de.format(u.avgPerDay)}</b>
        </div>
        <div>
          <span>Tage mit Spielen</span>
          <b>
            {u.playDays} von {u.daysRunning}
          </b>
        </div>
        {u.bestDay && (
          <div>
            <span>Stärkster Tag</span>
            <b>
              {u.bestDay.games} Spiele ({dateDe(u.bestDay.day)})
            </b>
          </div>
        )}
        {u.doubles > 0 && (
          <div>
            <span>davon Doppel</span>
            <b>{u.doubles}</b>
          </div>
        )}
        {u.tournamentTeams > 0 && (
          <div>
            <span>Turnier-Teams</span>
            <b>{u.tournamentTeams}</b>
          </div>
        )}
      </div>

      <div className="section-h">
        <h2>Spiele pro Woche</h2>
        <span>Mo–So</span>
      </div>
      <Bars items={u.weeks.map((w) => ({ label: shortDe(u.firstDay && w.start < u.firstDay ? u.firstDay : w.start), value: w.games }))} unit="Spiele" />

      <div className="section-h">
        <h2>Aktive Spieler pro Woche</h2>
        <span>mind. 1 Spiel</span>
      </div>
      <Bars items={u.weeks.map((w) => ({ label: shortDe(u.firstDay && w.start < u.firstDay ? u.firstDay : w.start), value: w.activePlayers }))} unit="Spieler" />

      <div className="section-h">
        <h2>Letzte 14 Tage</h2>
        <span>Spiele pro Tag</span>
      </div>
      <Bars items={u.days.slice(-14).map((d) => ({ label: shortDe(d.day), value: d.games }))} unit="Spiele" />

      <a href="/api/admin/nutzung" className="nav-link" download>
        Alle Tageswerte als Tabelle (CSV) herunterladen →
      </a>
      <p className="hint-left">
        Gezählt werden echte, gespeicherte Spiele ab der Uni-Öffnung (Spiele aus der Zeit davor, Testspiele und
        widersprochene Spiele nicht). Seitenaufrufe
        misst ab jetzt Vercel unter „Analytics“.
      </p>
    </>
  );
}
