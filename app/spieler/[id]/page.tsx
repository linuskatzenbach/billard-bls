import Link from "next/link";
import { notFound } from "next/navigation";
import { PLAYERS, getPlayerName } from "@/lib/players";
import { getLeaderboard, getMatchesForPlayer } from "@/lib/db";
import { START_ELO } from "@/lib/elo";
import EloChart, { type EloPoint } from "./EloChart";
import RankBall from "../../RankBall";

export const dynamic = "force-dynamic";

function formatMatchDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}.${d.getMonth() + 1}.`;
}

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const player = PLAYERS.find((p) => p.id === id);

  if (!player) {
    notFound();
  }

  const [matches, leaderboard] = await Promise.all([
    getMatchesForPlayer(id),
    getLeaderboard(),
  ]);

  const wins = matches.filter((m) => m.won).length;
  const losses = matches.length - wins;

  const rankIndex = leaderboard.findIndex((e) => e.id === id);
  const currentElo = rankIndex >= 0 ? leaderboard[rankIndex].elo : START_ELO;
  const rank = rankIndex >= 0 ? rankIndex + 1 : null;

  // Elo-Verlauf: Start-Elo, dann Elo nach jedem Spiel in chronologischer Reihenfolge.
  const eloHistory = [START_ELO, ...matches.map((m) => m.elo_after)];
  const highestElo = Math.max(...eloHistory);

  // Aufschlüsselung nach Gegner
  const opponentMap = new Map<string, { wins: number; losses: number }>();
  for (const m of matches) {
    const stat = opponentMap.get(m.opponent_id) ?? { wins: 0, losses: 0 };
    if (m.won) stat.wins += 1;
    else stat.losses += 1;
    opponentMap.set(m.opponent_id, stat);
  }
  const opponents = Array.from(opponentMap.entries())
    .map(([opponentId, stat]) => ({ opponentId, ...stat }))
    .sort((a, b) => b.wins + b.losses - (a.wins + a.losses));

  // Elo-Verlauf fürs Diagramm: Start-Elo zum Zeitpunkt des ersten Spiels,
  // danach die Elo nach jedem Spiel.
  const chartHistory: EloPoint[] =
    matches.length > 0
      ? [
          { t: matches[0].created_at, elo: START_ELO },
          ...matches.map((m) => ({ t: m.created_at, elo: m.elo_after })),
        ]
      : [];

  return (
    <>
      <Link href="/" className="back-link">
        ← Rangliste
      </Link>

      <h1>{player.name}</h1>
      <p className="subtitle profile-subtitle">
        {rank && <RankBall rank={rank} />}
        <span>Elo {currentElo}</span>
      </p>

      <div className="stat-grid">
        <div className="stat">
          <span className="stat-value">{wins}</span>
          <span className="stat-label">Siege</span>
        </div>
        <div className="stat">
          <span className="stat-value">{losses}</span>
          <span className="stat-label">Niederlagen</span>
        </div>
        <div className="stat">
          <span className="stat-value">{highestElo}</span>
          <span className="stat-label">Höchste Elo</span>
        </div>
      </div>

      {matches.length > 0 && <EloChart history={chartHistory} />}

      {opponents.length > 0 && (
        <div className="opponents">
          <h2>Gegen einzelne Gegner</h2>
          {opponents.map((o) => (
            <div className="opponent-row" key={o.opponentId}>
              <span className="opponent-name">{getPlayerName(o.opponentId)}</span>
              <span className="opponent-record">
                <span className="rec-win">{o.wins} S</span>
                <span className="rec-sep">–</span>
                <span className="rec-loss">{o.losses} N</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {matches.length === 0 && (
        <p className="empty">Noch keine Spiele gespielt.</p>
      )}

      {matches.length > 0 && (
        <div className="history">
          <h2>Letzte Spiele</h2>
          {matches
            .slice()
            .reverse()
            .slice(0, 10)
            .map((m, i) => (
              <div className="match-line" key={i}>
                <span className="opponent-name">
                  {m.won ? "Sieg gegen " : "Niederlage gegen "}
                  {getPlayerName(m.opponent_id)}
                </span>
                <span className={`delta ${m.won ? "win" : "loss"}`}>
                  {m.won ? "▲" : "▼"}
                  {Math.abs(m.elo_after - m.elo_before)}
                </span>
                <span className="match-date-inline">{formatMatchDate(m.created_at)}</span>
              </div>
            ))}
        </div>
      )}
    </>
  );
}
