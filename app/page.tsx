import { connection } from "next/server";
import type React from "react";
import Link from "next/link";
import {
  computeStats,
  FORM_GAMES,
  formatRelativeDay,
  MIN_GAMES_FOR_WIN_RATE,
  type RankRow,
  type StatEntry,
} from "@/lib/stats";
import { MIN_GAMES_RANKED, type PlayerSummary } from "@/lib/progress";
import { getOverview } from "@/lib/server";
import { getSession } from "@/lib/auth";
import { cohortShort } from "@/lib/names";
import StatTile, { type TopRow } from "./StatTile";
import RankBall from "./RankBall";
import Wreath from "./Wreath";
import CtaTrack from "./CtaTrack";

function formatDays(days: number): string {
  if (days < 1) return "unter 1 Tag";
  const rounded = Math.round(days);
  return rounded === 1 ? "1 Tag" : `${rounded} Tage`;
}

function gamesText(n: number): string {
  return n === 1 ? "1 Spiel" : `${n} Spiele`;
}

function daysText(n: number): string {
  return n === 1 ? "1 Tag" : `${n} Tage`;
}

function streakText(n: number): string {
  return n === 1 ? "1 Sieg in Folge" : `${n} Siege in Folge`;
}

const fmtElo = (n: number) => n.toLocaleString("de-DE");

const TABS = [
  { key: "elo", label: "Elo" },
  { key: "woche", label: "Wochenzocker" },
  { key: "level", label: "Level" },
  { key: "aktiv", label: "Aktivität" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

// Sonntag einer Woche (wk = Montag)
const weekEnd = (wk: string) => {
  const [y, m, d] = wk.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 6)).toISOString().slice(0, 10);
};

const shortDate = (wk: string) => {
  const [, m, d] = wk.split("-").map(Number);
  return `${d}.${m}.`;
};

// Name (Zeile 1, mit Extras wie der Flamme) und Jahrgang (Zeile 2).
function NameBlock({ s, children }: { s: PlayerSummary; children?: React.ReactNode }) {
  return (
    <span className="name">
      <span className="nline">
        <PlayerName s={s} />
        {children}
      </span>
      {s.cohort && <span className="cohort">{cohortShort(s.cohort)}</span>}
    </span>
  );
}

// Name mit goldener Farbe und Krone für die aktuelle Nr. 1.
function PlayerName({ s, me }: { s: PlayerSummary; me?: boolean }) {
  return (
    <>
      <span className={`pname${s.isLeader ? " leader" : ""}${me ? " me" : ""}`}>{s.name}</span>
      <span className="lvl-pill" title={`Level ${s.level}`}>
        {s.level}
      </span>
      {s.isLeader && (
        <span className="crown" aria-label="Platz 1">
          👑
        </span>
      )}
    </>
  );
}

function WinFlame({ n }: { n: number }) {
  if (n < 3) return null;
  return (
    <span className="streak" title={`${n} Siege in Folge`}>
      <span className="flame" aria-hidden="true">
        🔥
      </span>
      {n}
    </span>
  );
}

function TableFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="pool-table">
      {[25, 50, 75].map((x) => (
        <span key={`t${x}`} className="diamond" style={{ top: 6, left: `calc(${x}% - 3px)` }} />
      ))}
      {[25, 50, 75].map((x) => (
        <span key={`b${x}`} className="diamond" style={{ bottom: 6, left: `calc(${x}% - 3px)` }} />
      ))}
      {[33, 66].map((y) => (
        <span key={`l${y}`} className="diamond" style={{ left: 6, top: `calc(${y}% - 3px)` }} />
      ))}
      {[33, 66].map((y) => (
        <span key={`r${y}`} className="diamond" style={{ right: 6, top: `calc(${y}% - 3px)` }} />
      ))}
      <div className="felt">{children}</div>
    </div>
  );
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const sp = await searchParams;
  const tab: TabKey = (TABS.find((t) => t.key === sp.tab)?.key ?? "elo") as TabKey;
  const [{ world, ov, nameOf }, session] = await Promise.all([getOverview(), getSession()]);
  const myId = session?.playerId ?? null;
  const hiddenOf = (id: string) => ov.byId[id]?.hidden ?? false;
  const names = (entry: StatEntry) => entry.playerIds.map(nameOf).join(" & ");
  const topRows = (rows: RankRow[], format: (value: number) => string): TopRow[] =>
    rows.map((r) => ({ rank: r.rank, name: r.playerIds.map(nameOf).join(" & "), value: format(r.value) }));

  const allMatches = world.matches;
  const matches = allMatches.slice(-10).reverse();
  const stats = computeStats(
    allMatches,
    ov.visible.map((s) => s.id),
    nameOf
  );

  return (
    <>
      <h1>Billard-Rangliste</h1>
      <p className="subtitle">Jetzt wird gezockt!</p>

      <nav className="rank-tabs" aria-label="Ranglisten">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "elo" ? "/" : `/?tab=${t.key}`}
            scroll={false}
            replace
            className={`rank-tab${t.key === tab ? " active" : ""}`}
            aria-current={t.key === tab ? "page" : undefined}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "elo" && (
        <>
          {ov.ranked.length === 0 && ov.provisional.length === 0 ? (
            <p className="empty">Noch keine Spieler eingetragen.</p>
          ) : (
            <TableFrame>
              <div className="leaderboard">
                {ov.ranked.map((s) => (
                  <Link href={`/spieler/${s.id}`} className={`row wrow${s.id === myId ? " is-me" : ""}`} key={s.id}>
                    <Wreath level={s.level} rank={s.rank} label={`Platz ${s.rank}, Level ${s.level}`} />
                    <NameBlock s={s}>
                      <WinFlame n={s.winStreak} />
                    </NameBlock>
                    <span className="elo">
                      {s.trend7 !== 0 && (
                        <span className={`trend ${s.trend7 > 0 ? "up" : "down"}`} title="Veränderung in den letzten 7 Tagen">
                          {s.trend7 > 0 ? "▲" : "▼"}
                          {Math.abs(s.trend7)}
                        </span>
                      )}
                      {s.elo}
                    </span>
                  </Link>
                ))}
                {ov.ranked.length === 0 && <p className="empty small">Ab {MIN_GAMES_RANKED} Spielen geht&apos;s hier los.</p>}
              </div>
            </TableFrame>
          )}

          {ov.provisional.length > 0 && (
            <div className="provisional">
              <h2 className="centered">Neu dabei</h2>
              <p className="form-hint">In der Elo-Rangliste ab {MIN_GAMES_RANKED} Spielen</p>
              {ov.provisional.map((s) => (
                <Link href={`/spieler/${s.id}`} className={`row wrow${s.id === myId ? " is-me" : ""}`} key={s.id}>
                  <Wreath level={s.level} rank={null} label={`Level ${s.level}`} />
                  <NameBlock s={s} />
                  <span className="prov-left">
                    noch {MIN_GAMES_RANKED - s.games} {MIN_GAMES_RANKED - s.games === 1 ? "Spiel" : "Spiele"}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "woche" && <WeekBoard rows={ov.visible} myId={myId} />}
      {tab === "level" && <LevelBoard rows={ov.visible} myId={myId} />}
      {tab === "aktiv" && (
        <ActivityBoard rows={ov.visible} myId={myId} record={ov.activityRecord} nameOf={nameOf} />
      )}

      <Link href="/eintragen" className="cta">
        <span className="cta-felt">
          <span className="cta-label">Ergebnis eintragen</span>
          {/* Queue stößt die weiße Kugel an, sie rollt ins Loch */}
          <CtaTrack />
        </span>
      </Link>

      {tab === "elo" && (
        <>
      {matches.length > 0 && (
        <div className="history">
          <h2 className="centered">Letzte Spiele</h2>
          {matches.map((m, i) => {
            const winnerGain = m.winner_elo_after - m.winner_elo_before;
            const loserLoss = m.loser_elo_after - m.loser_elo_before;
            const winnerHidden = hiddenOf(m.winner_id);
            const loserHidden = hiddenOf(m.loser_id);
            return (
              <div className="history-row" key={i}>
                <span className="player-name winner">{nameOf(m.winner_id)}</span>
                <span className="vs">vs</span>
                <span className="player-name loser">{nameOf(m.loser_id)}</span>

                <span className="player-meta winner">
                  {winnerHidden ? (
                    <span className="elo-before">???</span>
                  ) : (
                    <>
                      <span className="elo-before">{m.winner_elo_before}</span>
                      <span className="delta win">▲{Math.abs(winnerGain)}</span>
                    </>
                  )}
                </span>
                <span className="match-date">{formatRelativeDay(m.created_at)}</span>
                <span className="player-meta loser">
                  {loserHidden ? (
                    <span className="elo-before">???</span>
                  ) : (
                    <>
                      <span className="delta loss">▼{Math.abs(loserLoss)}</span>
                      <span className="elo-before">{m.loser_elo_before}</span>
                    </>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {allMatches.length > 0 && (
        <div className="stats">
          <h2 className="centered">Statistiken</h2>
          <div className="stat-grid">
            {(
              [
                {
                  label: "Meiste Spiele",
                  title: "Meiste Spiele",
                  entry: stats.mostGames,
                  rows: stats.top.mostGames,
                  format: gamesText,
                },
                {
                  label: "Höchste Siegesquote",
                  title: "Höchste Siegesquote",
                  entry: stats.bestWinRate,
                  rows: stats.top.bestWinRate,
                  format: (v: number) => `${v}% Siege`,
                  empty: `ab ${MIN_GAMES_FOR_WIN_RATE} Spielen`,
                },
                {
                  label: <>Meiste Tage<br />auf Platz 1</>,
                  title: "Meiste Tage auf Platz 1",
                  entry: stats.mostDaysAtTop,
                  rows: stats.top.mostDaysAtTop,
                  format: daysText,
                },
                {
                  label: <>Am Stück<br />auf Platz 1</>,
                  title: "Längste Zeit am Stück auf Platz 1",
                  entry: stats.longestAtTop,
                  rows: stats.top.longestAtTop,
                  format: formatDays,
                },
                {
                  label: <>Längste Serie<br />aller Zeiten</>,
                  title: "Längste Serie aller Zeiten",
                  entry: stats.longestStreak,
                  rows: stats.top.longestStreak,
                  format: streakText,
                },
                {
                  label: <>Höchste Elo<br />aller Zeiten</>,
                  title: "Höchste Elo aller Zeiten",
                  entry: stats.highestElo,
                  rows: stats.top.highestElo,
                  format: (v: number) => `${v} Elo`,
                },
              ] as {
                label: React.ReactNode;
                title: string;
                entry: StatEntry | null;
                rows: RankRow[];
                format: (v: number) => string;
                empty?: string;
              }[]
            ).map((s) => (
              <StatTile
                key={s.title}
                label={s.label}
                title={s.title}
                name={s.entry ? names(s.entry) : "–"}
                value={s.entry ? s.format(s.entry.value) : s.empty ?? ""}
                top={topRows(s.rows, s.format)}
              />
            ))}
          </div>
        </div>
      )}

      {stats.form.length > 0 && (
        <div className="form-table">
          <h2 className="centered">Formtabelle</h2>
          <p className="form-hint">Letzte {FORM_GAMES} Spiele · neuestes rechts</p>
          {stats.form.map((row) => {
            // Wer weniger als 10 Spiele hat, bekommt links leere Plätze,
            // damit das neueste Spiel bei allen ganz rechts steht.
            const slots = [
              ...Array(FORM_GAMES - row.results.length).fill(null),
              ...row.results,
            ] as (boolean | null)[];
            return (
              <Link
                href={`/spieler/${row.playerId}`}
                className="form-row"
                key={row.playerId}
              >
                <RankBall rank={row.rank} />
                <span className="form-name">{nameOf(row.playerId)}</span>
                <span className="form-dots" aria-label={`${row.wins} Siege aus ${row.results.length} Spielen`}>
                  {slots.map((r, i) => (
                    <span
                      key={i}
                      className={`form-dot ${r === null ? "none" : r ? "win" : "loss"}`}
                    />
                  ))}
                </span>
                <span className="form-sum" title={`Siege in den letzten ${FORM_GAMES} Spielen`}>
                  {row.wins}/{row.results.length}
                </span>
              </Link>
            );
          })}
        </div>
      )}
        </>
      )}
    </>
  );
}

// Platz innerhalb einer Liste; gleiche Werte teilen sich den Platz.
function places<T>(rows: T[], value: (r: T) => number): number[] {
  const out: number[] = [];
  rows.forEach((r, i) => {
    out.push(i > 0 && value(rows[i - 1]) === value(r) ? out[i - 1] : i + 1);
  });
  return out;
}

function WeekBoard({ rows, myId }: { rows: PlayerSummary[]; myId: string | null }) {
  const list = rows
    .filter((s) => s.weekGames > 0)
    .sort((a, b) => b.weekGames - a.weekGames || b.weekXp - a.weekXp || a.name.localeCompare(b.name, "de"));
  const pl = places(list, (s) => s.weekGames);
  const podium = list.slice(0, 3);
  return (
    <section>
      <p className="board-hint">Wer diese Woche am meisten spielt · Wertung endet So, 23:59</p>
      {list.length === 0 ? (
        <p className="empty">Diese Woche wurde noch nicht gespielt. Sei der Erste!</p>
      ) : (
        <>
          {podium.length >= 2 && (
            <div className="podium">
              {[1, 0, 2].map((i) =>
                podium[i] ? (
                  <Link href={`/spieler/${podium[i].id}`} key={podium[i].id} className={`pod pod-${i + 1}`}>
                    <RankBall rank={pl[i]} />
                    <span className="pod-name">{podium[i].name}</span>
                    <span className="pod-val">{gamesText(podium[i].weekGames)}</span>
                    <span className="pod-base" />
                  </Link>
                ) : (
                  <span key={i} />
                )
              )}
            </div>
          )}
          <div className="board">
            {list.map((s, i) => (
              <Link href={`/spieler/${s.id}`} key={s.id} className={`row brow${s.id === myId ? " is-me" : ""}`}>
                <RankBall rank={pl[i]} />
                <NameBlock s={s} />
                <span className="bval">
                  {s.weekGames}
                  <small>+{s.weekXp} XP</small>
                </span>
              </Link>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function LevelBoard({ rows, myId }: { rows: PlayerSummary[]; myId: string | null }) {
  const list = rows
    .filter((s) => s.games > 0)
    .sort((a, b) => b.xp - a.xp || a.name.localeCompare(b.name, "de"));
  const pl = places(list, (s) => s.xp);
  return (
    <section>
      <p className="board-hint">Gesammelte XP – jedes Spiel zählt · <Link href="/kraenze">alle Kränze ›</Link></p>
      {list.length === 0 ? (
        <p className="empty">Noch keine Spiele.</p>
      ) : (
        <div className="board">
          {list.map((s, i) => (
            <Link href={`/spieler/${s.id}`} key={s.id} className={`row brow wrow${s.id === myId ? " is-me" : ""}`}>
              <Wreath level={s.level} rank={pl[i]} label={`Platz ${pl[i]}, Level ${s.level}`} />
              <NameBlock s={s} />
              <span className="bval">
                Lvl {s.level}
                <small>{fmtElo(s.xp)} XP</small>
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function WeekBars({ weeks, open }: { weeks: boolean[]; open: boolean }) {
  return (
    <span className="wk" aria-hidden="true">
      {weeks.map((w, i) => (
        <i key={i} className={w ? "on" : i === weeks.length - 1 && open ? "open" : ""} />
      ))}
    </span>
  );
}

function ActivityBoard({
  rows,
  myId,
  record,
  nameOf,
}: {
  rows: PlayerSummary[];
  myId: string | null;
  record: { playerId: string; weeks: number; from: string; to: string } | null;
  nameOf: (id: string) => string;
}) {
  const list = rows
    .filter((s) => s.activity.streak > 0)
    .sort(
      (a, b) =>
        b.activity.streak - a.activity.streak ||
        Number(b.activity.thisWeek) - Number(a.activity.thisWeek) ||
        a.name.localeCompare(b.name, "de")
    );
  const pl = places(list, (s) => s.activity.streak);
  return (
    <section>
      {record && (
        <div className="record card">
          <span className="record-icon" aria-hidden="true">
            🏆
          </span>
          <div>
            <div className="record-title">
              Rekord: {nameOf(record.playerId)} · {record.weeks} {record.weeks === 1 ? "Woche" : "Wochen"}
            </div>
            <div className="record-sub">
              Längste Serie aller Zeiten ({shortDate(record.from)} – {shortDate(weekEnd(record.to))})
            </div>
          </div>
        </div>
      )}
      <p className="board-hint">Mindestens 1 Spiel pro Woche hält die Flamme am Leben · letzte 8 Wochen</p>
      {list.length === 0 ? (
        <p className="empty">Noch keine laufenden Serien.</p>
      ) : (
        <div className="board">
          {list.map((s, i) => (
            <Link href={`/spieler/${s.id}`} key={s.id} className={`row arow${s.id === myId ? " is-me" : ""}`}>
              <RankBall rank={pl[i]} />
              <span className="name">
                <span className="aname">
                  <PlayerName s={s} />
                  {s.cohort && <span className="cohort inline">{cohortShort(s.cohort)}</span>}
                </span>
                <WeekBars weeks={s.activity.weeks8} open={s.activity.atRisk} />
                {s.activity.atRisk && <span className="risk">⏳ diese Woche noch offen – läuft So ab</span>}
              </span>
              <span className="bval">
                <span className={`wflame${s.activity.atRisk ? " dim" : ""}`} aria-hidden="true">
                  🔥
                </span>
                <b>{s.activity.streak}</b>
                <small>{s.activity.streak === 1 ? "Woche" : "Wochen"}</small>
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
