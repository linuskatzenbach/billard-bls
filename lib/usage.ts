import type { World } from "./db";
import { DAY, dayKey } from "./time";

// Nutzungszahlen für den Admin-Bereich (z. B. für Sponsoren-Gespräche).
// Alles wird aus den gespeicherten Spielern und Spielen berechnet –
// Testspiele werden nie gespeichert und zählen daher nicht mit.

// Tag der Uni-Öffnung (deutsche Zeit). Die Nutzungszahlen zählen erst ab hier;
// Spiele aus der Testphase mit den Gründungsmitgliedern bleiben außen vor.
export const UNI_OPENING = "2026-10-24";

export type UsageDay = {
  day: string; // YYYY-MM-DD (deutsche Zeit)
  games: number;
  activePlayers: number; // verschiedene Spieler, die an dem Tag gespielt haben
  newPlayers: number; // an dem Tag angelegte Spieler
  totalPlayers: number; // Spieler insgesamt bis einschließlich diesem Tag
  totalGames: number; // Spiele insgesamt bis einschließlich diesem Tag
};

export type UsageWeek = {
  start: string; // Montag (YYYY-MM-DD)
  games: number;
  activePlayers: number;
};

export type Usage = {
  firstDay: string | null;
  daysRunning: number;
  players: number; // sichtbare Spieler (heute, inkl. Gründungsmitglieder)
  newPlayers: number; // seit der Uni-Öffnung dazugekommen
  withAccount: number; // davon mit hinterlegter Uni-Mail
  activeEver: number; // mind. ein Spiel gespielt
  games: number;
  doubles: number;
  games7: number;
  games30: number;
  active7: number;
  active30: number;
  avgPerDay: number;
  avgPerActiveDay: number;
  playDays: number; // Tage mit mindestens einem Spiel
  bestDay: { day: string; games: number } | null;
  cohorts: number;
  tournamentTeams: number;
  days: UsageDay[];
  weeks: UsageWeek[]; // Kalenderwochen Mo–So, älteste zuerst
};

const keyToMs = (k: string) => {
  const [y, m, d] = k.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
const msToKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const mondayOf = (k: string) => {
  const ms = keyToMs(k);
  return msToKey(ms - ((new Date(ms).getUTCDay() + 6) % 7) * DAY);
};

const participants = (m: World["matches"][number]) =>
  [m.winner_id, m.loser_id, m.winner2_id, m.loser2_id].filter((x): x is string => Boolean(x));

export function computeUsage(world: World, now = new Date(), from = UNI_OPENING): Usage {
  const allVisible = world.players.filter((p) => !p.hidden);
  const today = dayKey(now);
  const matches = world.matches.filter((m) => dayKey(m.created_at) >= from);
  // Spieler, die schon vor der Öffnung da waren, zählen am ersten Tag als Bestand.
  const before = allVisible.filter((p) => dayKey(p.created_at) < from).length;
  const visible = allVisible.filter((p) => dayKey(p.created_at) >= from);
  const firstDay = from <= today ? from : null;

  // Pro Tag sammeln
  const gamesByDay = new Map<string, number>();
  const activeByDay = new Map<string, Set<string>>();
  const activeByWeek = new Map<string, Set<string>>();
  const gamesByWeek = new Map<string, number>();
  const newByDay = new Map<string, number>();
  const everActive = new Set<string>();

  for (const m of matches) {
    const d = dayKey(m.created_at);
    const w = mondayOf(d);
    gamesByDay.set(d, (gamesByDay.get(d) ?? 0) + 1);
    gamesByWeek.set(w, (gamesByWeek.get(w) ?? 0) + 1);
    const ds = activeByDay.get(d) ?? new Set();
    const ws = activeByWeek.get(w) ?? new Set();
    for (const id of participants(m)) {
      ds.add(id);
      ws.add(id);
      everActive.add(id);
    }
    activeByDay.set(d, ds);
    activeByWeek.set(w, ws);
  }
  for (const p of visible) {
    const d = dayKey(p.created_at);
    newByDay.set(d, (newByDay.get(d) ?? 0) + 1);
  }

  const days: UsageDay[] = [];
  if (firstDay) {
    let totalPlayers = before;
    let totalGames = 0;
    for (let ms = keyToMs(firstDay); ms <= keyToMs(today); ms += DAY) {
      const day = msToKey(ms);
      const games = gamesByDay.get(day) ?? 0;
      const newPlayers = newByDay.get(day) ?? 0;
      totalPlayers += newPlayers;
      totalGames += games;
      days.push({
        day,
        games,
        activePlayers: activeByDay.get(day)?.size ?? 0,
        newPlayers,
        totalPlayers,
        totalGames,
      });
    }
  }

  const weeks: UsageWeek[] = [];
  if (firstDay) {
    for (let ms = keyToMs(mondayOf(firstDay)); ms <= keyToMs(today); ms += 7 * DAY) {
      const start = msToKey(ms);
      weeks.push({ start, games: gamesByWeek.get(start) ?? 0, activePlayers: activeByWeek.get(start)?.size ?? 0 });
    }
  }

  const since = (n: number) => {
    const from = msToKey(keyToMs(today) - (n - 1) * DAY);
    const recent = matches.filter((m) => dayKey(m.created_at) >= from);
    return { games: recent.length, active: new Set(recent.flatMap(participants)).size };
  };
  const last7 = since(7);
  const last30 = since(30);

  const playDays = gamesByDay.size;
  let bestDay: Usage["bestDay"] = null;
  for (const [day, games] of gamesByDay) if (!bestDay || games > bestDay.games) bestDay = { day, games };

  const tournamentTeams = (world.tournaments ?? []).reduce((n, t) => n + t.teams.length, 0);

  return {
    firstDay,
    daysRunning: days.length,
    players: allVisible.length,
    newPlayers: visible.length,
    withAccount: allVisible.filter((p) => p.email).length,
    activeEver: allVisible.filter((p) => everActive.has(p.id)).length,
    games: matches.length,
    doubles: matches.filter((m) => m.winner2_id).length,
    games7: last7.games,
    games30: last30.games,
    active7: last7.active,
    active30: last30.active,
    avgPerDay: days.length ? matches.length / days.length : 0,
    avgPerActiveDay: playDays ? matches.length / playDays : 0,
    playDays,
    bestDay,
    cohorts: new Set(allVisible.map((p) => p.cohort).filter(Boolean)).size,
    tournamentTeams,
    days,
    weeks,
  };
}

// Tageswerte als CSV (Semikolon, damit Excel/Numbers auf Deutsch es direkt öffnen).
export function usageCsv(u: Usage): string {
  const head = "Datum;Spiele;Aktive Spieler;Neue Spieler;Spieler gesamt;Spiele gesamt";
  const rows = u.days.map((d) =>
    [d.day, d.games, d.activePlayers, d.newPlayers, d.totalPlayers, d.totalGames].join(";")
  );
  return "﻿" + [head, ...rows].join("\n") + "\n";
}
