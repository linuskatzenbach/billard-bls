import Link from "next/link";
import type { World } from "@/lib/db";
import { MIN_GAMES_RANKED, gamesOf, wreathName, type Overview, type PlayerSummary } from "@/lib/progress";
import { START_ELO } from "@/lib/elo";
import { formatRelativeDay } from "@/lib/stats";
import { DISPUTE_HOURS } from "@/lib/server";
import EloChart, { type EloPoint } from "./spieler/[id]/EloChart";
import Wreath from "./Wreath";
import CtaTrack from "./CtaTrack";
import DisputeButton from "./DisputeButton";
import { cohortLong } from "@/lib/names";
import { BADGES, QUEST_BONUS, badgeLabel } from "@/lib/achievements";
import Medal from "./Medal";

const fmt = (n: number) => n.toLocaleString("de-DE");
const time = (iso: string) =>
  new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

export default function ProfileView({
  s,
  world,
  ov,
  own = false,
  viewerId = null,
  seenAt = null,
}: {
  s: PlayerSummary;
  world: World;
  ov: Overview;
  own?: boolean;
  viewerId?: string | null;
  seenAt?: string | null;
}) {
  const nameOf = (id: string) => ov.byId[id]?.name ?? id;
  const games = gamesOf(world, s.id);
  const now = Date.now();
  const winRate = s.games > 0 ? Math.round((s.wins / s.games) * 100) : null;

  // Elo-Verlauf
  const chart: EloPoint[] =
    games.length > 0
      ? [{ t: games[0].createdAt, elo: START_ELO }, ...games.map((g) => ({ t: g.createdAt, elo: g.eloAfter }))]
      : [];

  // Bester Tag: Kalendertag (Berlin) mit dem größten Elo-Gewinn netto.
  const dayKey = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "numeric", month: "numeric" });
  const perDay = new Map<string, { gain: number; label: string }>();
  for (const g of games) {
    const d = new Date(g.createdAt);
    const key = d.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }); // YYYY-MM-DD
    const e = perDay.get(key) ?? { gain: 0, label: dayKey.format(d) };
    e.gain += g.eloAfter - g.eloBefore;
    perDay.set(key, e);
  }
  let bestDay: { gain: number; label: string } | null = null;
  for (const e of perDay.values()) if (e.gain > 0 && (!bestDay || e.gain >= bestDay.gain)) bestDay = e;

  // Kopf an Kopf: nur Einzel (im Doppel hängt das Ergebnis am Partner)
  const rec = new Map<string, { w: number; l: number }>();
  for (const g of games) {
    if (g.doubles) continue;
    const r = rec.get(g.opponentId) ?? { w: 0, l: 0 };
    if (g.won) r.w++;
    else r.l++;
    rec.set(g.opponentId, r);
  }
  const opps = [...rec.entries()]
    .filter(([id]) => !ov.byId[id]?.hidden)
    .map(([id, r]) => ({ id, ...r, n: r.w + r.l, rate: r.w / (r.w + r.l) }));
  const qualified = opps.filter((o) => o.n >= 3);
  const fav = [...qualified].filter((o) => o.rate > 0.5).sort((a, b) => b.rate - a.rate || b.n - a.n)[0];
  const nemesis = [...qualified].filter((o) => o.rate < 0.5).sort((a, b) => a.rate - b.rate || b.n - a.n)[0];

  // Doppel: Bilanz und Partner
  const dbl = games.filter((g) => g.doubles);
  const dblWins = dbl.filter((g) => g.won).length;
  const prec = new Map<string, { w: number; l: number }>();
  for (const g of dbl) {
    const r = prec.get(g.partnerId!) ?? { w: 0, l: 0 };
    if (g.won) r.w++;
    else r.l++;
    prec.set(g.partnerId!, r);
  }
  const partners = [...prec.entries()]
    .filter(([id]) => !ov.byId[id]?.hidden)
    .map(([id, r]) => ({ id, ...r, n: r.w + r.l, rate: r.w / (r.w + r.l) }));
  const bestPartner = partners.filter((o) => o.n >= 3).sort((a, b) => b.rate - a.rate || b.n - a.n)[0];
  const both = (a: string, b: string) => `${nameOf(a)} und ${nameOf(b)}`;

  const recent = games.slice(-10).reverse();
  const ach = ov.ach[s.id];
  // Auf fremden Profilen bleiben die geheimen Abzeichen unsichtbar.
  const shownDefs = BADGES.filter((d) => own || !d.secret);
  const shownBadges = ach.badges.filter((b) => shownDefs.some((d) => d.id === b.id));
  const badgeTotal = shownDefs.reduce((n, d) => n + (d.tiers ? d.tiers.length : 1), 0);
  // Tage bis zu den neuen Aufgaben (Montag)
  const berlinDow = (new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Berlin" })).getDay() + 6) % 7;
  const daysLeft = 7 - berlinDow;
  const ranked = ov.ranked.length;
  const missing = Math.max(0, MIN_GAMES_RANKED - s.games);

  // Neue Spiele, die jemand anderes mit mir eingetragen hat (eigenes Profil).
  const windowMs = DISPUTE_HOURS * 3600_000;
  const fresh = own
    ? games
        .filter((g) => now - new Date(g.createdAt).getTime() < windowMs)
        .filter((g) => g.enteredBy && g.enteredBy !== s.id)
        .reverse()
    : [];

  return (
    <>
      {!own && (
        <Link href="/" className="back-link">
          ← Rangliste
        </Link>
      )}

      {fresh.length > 0 && (
        <div className="card news">
          <div className="news-title">Neu für dich</div>
          {fresh.map((g) => {
            const isNew = seenAt ? new Date(g.createdAt) > new Date(seenAt) : true;
            return (
              <div className="news-row" key={g.id}>
                {isNew && <span className="news-dot" aria-label="neu" />}
                <span className="news-text">
                  <b>{nameOf(g.enteredBy!)}</b> hat eingetragen:{" "}
                  {g.doubles
                    ? g.won
                      ? `Du hast mit ${nameOf(g.partnerId!)} gegen ${both(g.opponentIds[0], g.opponentIds[1])} gewonnen`
                      : `${both(g.opponentIds[0], g.opponentIds[1])} haben gegen dich und ${nameOf(g.partnerId!)} gewonnen`
                    : g.won
                      ? `Du hast gegen ${nameOf(g.opponentId)} gewonnen`
                      : `${nameOf(g.opponentId)} hat gegen dich gewonnen`}{" "}
                  ·{" "}
                  {formatRelativeDay(g.createdAt)}, {time(g.createdAt)}
                </span>
                <DisputeButton matchId={g.id} own={false} />
              </div>
            );
          })}
        </div>
      )}

      <div className="profile-head">
        <Link href={`/kraenze${own ? "" : `?spieler=${s.id}`}`} className="profile-wreath" aria-label="Alle Kränze ansehen">
          <Wreath level={s.level} rank={s.rank} size="132px" label={`Level ${s.level}`} />
          <span className="lvl-plaque">{s.level}</span>
        </Link>
        <h1 className={`profile-name${s.isLeader ? " leader" : ""}`}>
          {s.name}
          {s.isLeader && (
            <span className="profile-crown" aria-label="Platz 1">
              👑
            </span>
          )}
        </h1>
        <p className="profile-chip">
          {s.rank ? `Platz ${s.rank}` : "Vorläufig"} · {wreathName(s.level)}
          {s.cohort && ` · ${cohortLong(s.cohort)}`}
        </p>
      </div>

      <div className="xp">
        <div className="xp-row">
          <span>
            <b>Level {s.level}</b>
            {s.levelNeed > 0 ? ` · noch ${fmt(s.levelNeed - s.levelInto)} XP bis Level ${s.level + 1}` : " · Höchstes Level!"}
          </span>
          <Link href={`/kraenze${own ? "" : `?spieler=${s.id}`}`}>alle Kränze ›</Link>
        </div>
        <div className="bar">
          <span style={{ width: `${s.levelNeed > 0 ? Math.round((s.levelInto / s.levelNeed) * 100) : 100}%` }} />
        </div>
      </div>

      <div className="kpis">
        <div className="kpi card">
          <span className="kpi-l">Elo</span>
          <span className="kpi-v">{fmt(s.elo)}</span>
          <span className={`kpi-s ${s.trend7 > 0 ? "up" : s.trend7 < 0 ? "down" : ""}`}>
            {s.trend7 === 0 ? "diese Woche ±0" : `${s.trend7 > 0 ? "▲" : "▼"} ${Math.abs(s.trend7)} / Woche`}
          </span>
        </div>
        <div className="kpi card">
          <span className="kpi-l">Platz</span>
          <span className="kpi-v">{s.rank ? `#${s.rank}` : "–"}</span>
          <span className="kpi-s">{s.rank ? `von ${ranked}` : `noch ${missing} ${missing === 1 ? "Spiel" : "Spiele"}`}</span>
        </div>
        <div className="kpi card">
          <span className="kpi-l">Siegquote</span>
          <span className="kpi-v">{winRate === null ? "–" : `${winRate} %`}</span>
          <span className="kpi-s">
            {s.games} {s.games === 1 ? "Spiel" : "Spiele"}
          </span>
        </div>
      </div>

      <div className="activity card">
        <span className="activity-icon" aria-hidden="true">
          📅
        </span>
        <div className="activity-body">
          <div className="activity-title">
            {s.activity.streak > 0
              ? `Aktivität: ${s.activity.streak} ${s.activity.streak === 1 ? "Woche" : "Wochen"} in Folge`
              : "Aktivität: noch keine Serie"}
          </div>
          <div className="activity-sub">
            {s.activity.thisWeek
              ? "Diese Woche gespielt ✓"
              : s.activity.atRisk
                ? "⏳ Diese Woche noch offen – läuft So ab"
                : "Diese Woche noch nicht gespielt"}{" "}
            · letzte 8 Wochen
          </div>
          <span className="wk big" aria-hidden="true">
            {s.activity.weeks8.map((w, i) => (
              <i key={i} className={w ? "on" : i === 7 && s.activity.atRisk ? "open" : ""} />
            ))}
          </span>
        </div>
      </div>

      {own && ach.quests.length > 0 && (
        <>
          <div className="section-h">
            <h2>Aufgaben der Woche</h2>
            <span>neu {daysLeft <= 1 ? "morgen" : `in ${daysLeft} Tagen`}</span>
          </div>
          <div className="card quests">
            {ach.quests.map((q) => (
              <div className={`quest${q.done ? " done" : ""}`} key={q.key}>
                <span className={`q-ico q-${q.tier}`}>{q.done ? "✓" : q.tier === "leicht" ? "1" : q.tier === "mittel" ? "2" : "3"}</span>
                <span className="q-body">
                  <span className="q-title">{q.title}</span>
                  {q.note && !q.done && <span className="q-note">{q.note}</span>}
                  {!q.done && q.goal > 1 && (
                    <span className="q-prog">
                      <span className="bar thin">
                        <span style={{ width: `${Math.round((q.progress / q.goal) * 100)}%` }} />
                      </span>
                      {q.progress}/{q.goal}
                    </span>
                  )}
                  {!q.done && q.kind === "defendTop" && (
                    <span className="q-note">{s.isLeader ? "Stand jetzt: Platz 1 ✓" : "Stand jetzt: nicht Platz 1"}</span>
                  )}
                </span>
                <span className="q-xp">+{q.xp} XP</span>
              </div>
            ))}
            <div className={`quest bonus${ach.questBonus ? " done" : ""}`}>
              <span className="q-ico">★</span>
              <span className="q-body">
                <span className="q-title">Bonus: alle drei geschafft</span>
              </span>
              <span className="q-xp">+{QUEST_BONUS} XP</span>
            </div>
          </div>
        </>
      )}

      <div className="section-h">
        <h2>Abzeichen</h2>
        <Link href={`/abzeichen${own ? "" : `?spieler=${s.id}`}`} className="section-link">
          {shownBadges.length} von {badgeTotal} ›
        </Link>
      </div>
      {shownBadges.length === 0 ? (
        <p className="empty small">Noch keine – das erste gibt&apos;s für den ersten Sieg.</p>
      ) : (
        <Link href={`/abzeichen${own ? "" : `?spieler=${s.id}`}`} className="badge-strip">
          {shownBadges.slice(0, 6).map((b) => {
            const l = badgeLabel(b);
            return (
              <span className="strip-badge" key={b.key}>
                <Medal metal={l.metal} icon={l.icon} size="2.6rem" />
                <span className="strip-name">{l.name}</span>
              </span>
            );
          })}
        </Link>
      )}

      {own && (
        <Link href="/eintragen" className="cta">
          <span className="cta-felt">
            <span className="cta-label">Spiel eintragen</span>
            <CtaTrack />
          </span>
        </Link>
      )}

      {games.length === 0 ? (
        <p className="empty">Noch keine Spiele gespielt.</p>
      ) : (
        <>
          <EloChart history={chart} />

          <div className="section-h">
            <h2>Bilanz</h2>
            <span>
              {s.games} {s.games === 1 ? "Spiel" : "Spiele"}
              {s.doubles > 0 && <span className="muted"> · davon {s.doubles} Doppel</span>}
            </span>
          </div>
          <div className="wl">
            {s.wins > 0 && (
              <span className="w" style={{ flex: `${s.wins} 1 0` }}>
                {s.wins} {s.wins === 1 ? "Sieg" : "Siege"}
              </span>
            )}
            {s.losses > 0 && (
              <span className="l" style={{ flex: `${s.losses} 1 0` }}>
                {s.losses} {s.losses === 1 ? "Niederlage" : "Niederlagen"}
              </span>
            )}
          </div>
          <div className="kpis small">
            <div className="kpi card">
              <span className="kpi-l">Beste Serie</span>
              <span className="kpi-v">
                {s.bestWinStreak} {s.bestWinStreak === 1 ? "Sieg" : "Siege"}
              </span>
            </div>
            <div className="kpi card">
              <span className="kpi-l">Bester Tag</span>
              <span className="kpi-v">{bestDay ? `+${bestDay.gain} Elo` : "–"}</span>
              {bestDay && <span className="kpi-s">{bestDay.label}</span>}
            </div>
            <div className="kpi card">
              <span className="kpi-l">Aktuell</span>
              <span className="kpi-v">
                {s.winStreak >= 3 && "🔥 "}
                {s.winStreak} {s.winStreak === 1 ? "Sieg" : "Siege"}
              </span>
            </div>
          </div>

          {(fav || nemesis) && (
            <>
              <div className="section-h">
                <h2>Kopf an Kopf</h2>
                <span>Einzel · ab 3 Spielen</span>
              </div>
              <div className="h2h">
                <div className="card">
                  <span className="kpi-l">😎 Lieblingsgegner</span>
                  {fav ? (
                    <>
                      <Link href={`/spieler/${fav.id}`} className="h2h-name">
                        {nameOf(fav.id)}
                      </Link>
                      <span className="h2h-rec">
                        <span className="up">
                          {fav.w} : {fav.l}
                        </span>{" "}
                        · {Math.round(fav.rate * 100)} %
                      </span>
                    </>
                  ) : (
                    <span className="h2h-rec muted">noch keiner</span>
                  )}
                </div>
                <div className="card">
                  <span className="kpi-l">😬 Angstgegner</span>
                  {nemesis ? (
                    <>
                      <Link href={`/spieler/${nemesis.id}`} className="h2h-name">
                        {nameOf(nemesis.id)}
                      </Link>
                      <span className="h2h-rec">
                        <span className="down">
                          {nemesis.w} : {nemesis.l}
                        </span>{" "}
                        · {Math.round(nemesis.rate * 100)} %
                      </span>
                    </>
                  ) : (
                    <span className="h2h-rec muted">noch keiner</span>
                  )}
                </div>
              </div>
            </>
          )}

          {opps.length > 0 && (
            <details className="all-opps">
              <summary>Gegen alle Gegner ({opps.length})</summary>
              {opps
                .sort((a, b) => b.n - a.n)
                .map((o) => (
                  <Link href={`/spieler/${o.id}`} className="opponent-row" key={o.id}>
                    <span className="opponent-name">{nameOf(o.id)}</span>
                    <span className="opponent-record">
                      <span className="rec-win">{o.w} S</span>
                      <span className="rec-sep">–</span>
                      <span className="rec-loss">{o.l} N</span>
                    </span>
                  </Link>
                ))}
            </details>
          )}

          {dbl.length > 0 && (
            <>
              <div className="section-h">
                <h2>Doppel</h2>
                <span>
                  {dbl.length} {dbl.length === 1 ? "Spiel" : "Spiele"}
                </span>
              </div>
              <div className="h2h">
                <div className="card">
                  <span className="kpi-l">⚖️ Doppel-Bilanz</span>
                  <span className="h2h-name">
                    {dblWins} : {dbl.length - dblWins}
                  </span>
                  <span className="h2h-rec">{Math.round((dblWins / dbl.length) * 100)} % Siege</span>
                </div>
                <div className="card">
                  <span className="kpi-l">🤝 Bester Partner</span>
                  {bestPartner ? (
                    <>
                      <Link href={`/spieler/${bestPartner.id}`} className="h2h-name">
                        {nameOf(bestPartner.id)}
                      </Link>
                      <span className="h2h-rec">
                        <span className="up">
                          {bestPartner.w} : {bestPartner.l}
                        </span>{" "}
                        · {Math.round(bestPartner.rate * 100)} %
                      </span>
                    </>
                  ) : (
                    <span className="h2h-rec muted">ab 3 gemeinsamen Spielen</span>
                  )}
                </div>
              </div>
              {partners.length > 0 && (
                <details className="all-opps">
                  <summary>Mit allen Partnern ({partners.length})</summary>
                  {[...partners]
                    .sort((a, b) => b.n - a.n)
                    .map((o) => (
                      <Link href={`/spieler/${o.id}`} className="opponent-row" key={o.id}>
                        <span className="opponent-name">{nameOf(o.id)}</span>
                        <span className="opponent-record">
                          <span className="rec-win">{o.w} S</span>
                          <span className="rec-sep">–</span>
                          <span className="rec-loss">{o.l} N</span>
                        </span>
                      </Link>
                    ))}
                </details>
              )}
            </>
          )}

          <div className="section-h">
            <h2>Letzte Spiele</h2>
          </div>
          <div className="games">
            {recent.map((g) => {
              const canFix =
                own &&
                now - new Date(g.createdAt).getTime() < windowMs &&
                (g.enteredBy === s.id || g.enteredBy === null || viewerId === s.id);
              return (
                <div className="game" key={g.id}>
                  <span className={`res ${g.won ? "s" : "n"}`}>{g.won ? "S" : "N"}</span>
                  <span className="game-main">
                    {g.doubles && <span className="chip-2v2">2v2</span>}
                    vs. <Link href={`/spieler/${g.opponentId}`}>{nameOf(g.opponentId)}</Link>
                    {g.doubles && (
                      <>
                        {" "}
                        &amp; <Link href={`/spieler/${g.opponentIds[1]}`}>{nameOf(g.opponentIds[1])}</Link>
                      </>
                    )}
                    <span className="when">
                      {g.doubles && `mit ${nameOf(g.partnerId!)} · `}
                      {formatRelativeDay(g.createdAt)}, {time(g.createdAt)}
                      {g.upset && " · Upset!"}
                    </span>
                    {canFix && g.enteredBy === s.id && <DisputeButton matchId={g.id} own />}
                  </span>
                  <span className="xpg">+{g.xp} XP</span>
                  <span className={`de ${g.eloAfter >= g.eloBefore ? "up" : "down"}`}>
                    {g.eloAfter >= g.eloBefore ? "+" : "−"}
                    {Math.abs(g.eloAfter - g.eloBefore)}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
