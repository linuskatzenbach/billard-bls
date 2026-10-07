import type { MatchRecord } from "./db";
import { PLAYERS } from "./players";
import { START_ELO } from "./elo";

// Wer weniger Spiele hat, zählt bei der Siegesquote nicht mit –
// sonst führt jemand mit 1 Spiel und 1 Sieg dauerhaft mit 100 %.
export const MIN_GAMES_FOR_WIN_RATE = 5;

export type StatEntry = {
  playerIds: string[]; // mehrere bei Gleichstand
  value: number;
};

export type Stats = {
  mostGames: StatEntry | null;
  bestWinRate: StatEntry | null; // value in Prozent (gerundet)
  longestAtTop: StatEntry | null; // value in Tagen (mit Nachkommastellen)
};

const DAY_MS = 24 * 60 * 60 * 1000;

// Ermittelt alle Spieler mit dem höchsten Wert (Gleichstand → mehrere).
function best(values: Record<string, number>): StatEntry | null {
  let top = -Infinity;
  let ids: string[] = [];
  for (const [id, v] of Object.entries(values)) {
    if (v > top) {
      top = v;
      ids = [id];
    } else if (v === top) {
      ids.push(id);
    }
  }
  if (ids.length === 0 || top <= 0) return null;
  return { playerIds: ids, value: top };
}

// Erwartet die Spiele chronologisch sortiert (älteste zuerst).
export function computeStats(matches: MatchRecord[], now = new Date()): Stats {
  const visible = PLAYERS.filter((p) => !p.hidden).map((p) => p.id);
  const visibleSet = new Set(visible);

  const games: Record<string, number> = {};
  const wins: Record<string, number> = {};
  const elo: Record<string, number> = {};
  const msAtTop: Record<string, number> = {};
  for (const id of visible) {
    games[id] = 0;
    wins[id] = 0;
    elo[id] = START_ELO;
    msAtTop[id] = 0;
  }

  // Platz 1 = alleiniger Höchstwert unter den sichtbaren Spielern.
  // Bei Gleichstand an der Spitze hat niemand Platz 1.
  const currentLeader = (): string | null => {
    let leader: string | null = null;
    let top = -Infinity;
    let tie = false;
    for (const id of visible) {
      if (elo[id] > top) {
        top = elo[id];
        leader = id;
        tie = false;
      } else if (elo[id] === top) {
        tie = true;
      }
    }
    return tie ? null : leader;
  };

  let leader: string | null = null;
  let leaderSince = 0;

  for (const m of matches) {
    const t = new Date(m.created_at).getTime();

    if (leader) msAtTop[leader] += t - leaderSince;

    for (const [id, after, won] of [
      [m.winner_id, m.winner_elo_after, true],
      [m.loser_id, m.loser_elo_after, false],
    ] as const) {
      if (!visibleSet.has(id)) continue;
      games[id] += 1;
      if (won) wins[id] += 1;
      elo[id] = after;
    }

    leader = currentLeader();
    leaderSince = t;
  }

  if (leader) msAtTop[leader] += now.getTime() - leaderSince;

  const winRates: Record<string, number> = {};
  for (const id of visible) {
    if (games[id] >= MIN_GAMES_FOR_WIN_RATE) {
      winRates[id] = Math.round((wins[id] / games[id]) * 100);
    }
  }

  const daysAtTop: Record<string, number> = {};
  for (const id of visible) {
    daysAtTop[id] = msAtTop[id] / DAY_MS;
  }

  return {
    mostGames: best(games),
    bestWinRate: best(winRates),
    longestAtTop: best(daysAtTop),
  };
}
