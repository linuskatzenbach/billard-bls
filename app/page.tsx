import type React from "react";
import Link from "next/link";
import {
  getLeaderboard,
  getRecentMatches,
  getCurrentStreaks,
  getAllMatches,
} from "@/lib/db";
import {
  computeStats,
  MIN_GAMES_FOR_WIN_RATE,
  type RankRow,
  type StatEntry,
} from "@/lib/stats";
import StatTile, { type TopRow } from "./StatTile";
import { getPlayerName, isPlayerHidden } from "@/lib/players";

export const dynamic = "force-dynamic";

function formatMatchDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}.${d.getMonth() + 1}.`;
}

function names(entry: StatEntry): string {
  return entry.playerIds.map(getPlayerName).join(" & ");
}

function formatDays(days: number): string {
  if (days < 1) return "unter 1 Tag";
  const rounded = Math.round(days);
  return rounded === 1 ? "1 Tag" : `${rounded} Tage`;
}

function topRows(rows: RankRow[], format: (value: number) => string): TopRow[] {
  return rows.map((r) => ({
    rank: r.rank,
    name: r.playerIds.map(getPlayerName).join(" & "),
    value: format(r.value),
  }));
}

function gamesText(n: number): string {
  return n === 1 ? "1 Spiel" : `${n} Spiele`;
}

function streakText(n: number): string {
  return n === 1 ? "1 Sieg in Folge" : `${n} Siege in Folge`;
}

export default async function HomePage() {
  const [leaderboard, matches, streaks, allMatches] = await Promise.all([
    getLeaderboard(),
    getRecentMatches(10),
    getCurrentStreaks(),
    getAllMatches(),
  ]);
  const stats = computeStats(allMatches);

  return (
    <>
      <h1>Billard-Rangliste</h1>
      <p className="subtitle">Jetzt wird gezockt!</p>

      {leaderboard.length === 0 ? (
        <p className="empty">Noch keine Spieler eingetragen.</p>
      ) : (
        <div className="leaderboard">
          {leaderboard.map((entry, index) => {
            const streak = streaks[entry.id] ?? 0;
            return (
              <Link
                href={`/spieler/${entry.id}`}
                className="row"
                key={entry.id}
              >
                <span className={`rank ${index === 0 ? "gold" : ""}`}>
                  {index + 1}
                </span>
                <span className="name">
                  {getPlayerName(entry.id)}
                  {streak >= 3 && <span className="streak"> 🔥{streak}</span>}
                </span>
                <span className="elo">{entry.elo}</span>
              </Link>
            );
          })}
        </div>
      )}

      <Link href="/eintragen" className="nav-link">
        Ergebnis eintragen →
      </Link>

      {matches.length > 0 && (
        <div className="history">
          <h2 className="centered">Letzte Spiele</h2>
          {matches.map((m, i) => {
            const winnerGain = m.winner_elo_after - m.winner_elo_before;
            const loserLoss = m.loser_elo_after - m.loser_elo_before;
            const winnerHidden = isPlayerHidden(m.winner_id);
            const loserHidden = isPlayerHidden(m.loser_id);
            return (
              <div className="history-row" key={i}>
                <span className="player-name winner">{getPlayerName(m.winner_id)}</span>
                <span className="vs">vs</span>
                <span className="player-name loser">{getPlayerName(m.loser_id)}</span>

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
                <span className="match-date">{formatMatchDate(m.created_at)}</span>
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
                  label: <>Längste Zeit<br />auf Platz 1</>,
                  title: "Längste Zeit auf Platz 1",
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
            <StatTile
              label="Größter Zocktag"
              title="Größter Zocktag"
              name={stats.matchDayRecord?.date ?? "–"}
              value={stats.matchDayRecord ? gamesText(stats.matchDayRecord.count) : ""}
              top={stats.top.matchDays.map((d) => ({
                rank: d.rank,
                name: d.date,
                value: gamesText(d.count),
              }))}
            />
          </div>
        </div>
      )}
    </>
  );
}
