import type { MatchRow, PlayerRow, World } from "./db";
import { START_ELO } from "./elo";
import { computeAchievements, type PlayerAchievements } from "./achievements";

// Alles, was sich aus den Spielen ableiten lässt: Rangliste, XP, Level,
// Aktivität, Wochenwertung. Wird bei jedem Seitenaufruf aus dem
// zwischengespeicherten "World"-Paket berechnet (geht schnell, keine
// Datenbankabfrage).

export { TIME_ZONE } from "./time";
export const MIN_GAMES_RANKED = 3; // erst ab 3 Spielen in der Elo-Rangliste
export const MAX_LEVEL = 18;
export const UPSET_GAP = 150; // Upset-Bonus ab so viel Elo Unterschied

export const XP = { game: 10, win: 5, upset: 15 } as const;

// XP, die man insgesamt braucht, um ein Level zu erreichen (Index = Level).
// Grobe Richtwerte für sehr aktive Spieler (~15 Spiele pro Woche plus die
// meisten Wochenaufgaben, rund 350 XP pro Woche):
//   Bronze (Level 4) nach ca. 3 Wochen, Silber (7) nach ca. 2 Monaten,
//   Gold (10) nach ca. 5 Monaten, Champion (16) erst nach über einem Jahr.
export const LEVEL_XP: number[] = [
  0, // (Level 0 gibt es nicht)
  0, // Level 1 – Olivenzweig
  100,
  300,
  1_000, // Level 4 – Bronze
  1_600,
  2_400,
  3_400, // Level 7 – Silber
  4_600,
  6_000,
  8_000, // Level 10 – Gold
  10_000,
  12_500,
  15_000, // Level 13 – Gold mit Rubinen
  17_500,
  20_000,
  24_000, // Level 16 – Champion
  30_000,
  38_000,
];

export function levelFor(xp: number): { level: number; into: number; need: number; next: number | null } {
  let level = 1;
  while (level < MAX_LEVEL && xp >= LEVEL_XP[level + 1]) level++;
  if (level === MAX_LEVEL) return { level, into: 0, need: 0, next: null };
  return { level, into: xp - LEVEL_XP[level], need: LEVEL_XP[level + 1] - LEVEL_XP[level], next: level + 1 };
}

export const TIERS = [
  { name: "Olivenzweig", color: "#8fb35f" },
  { name: "Bronze", color: "#c07a3d" },
  { name: "Silber", color: "#cfd3d8" },
  { name: "Gold", color: "#e0bc4a" },
  { name: "Gold mit Rubinen", color: "#d2233a" },
  { name: "Champion", color: "#ffe27a" },
];

export function tierOf(level: number) {
  const t = Math.min(Math.floor((level - 1) / 3), 5);
  return { ...TIERS[t], index: t, stage: ((level - 1) % 3) + 1 };
}

// Kurzer Name des Kranzes, z. B. "Silberkranz" oder "Olivenzweig".
export function wreathName(level: number): string {
  const t = tierOf(level);
  if (t.index === 0) return "Olivenzweig";
  if (t.index === 1) return "Bronzekranz";
  if (t.index === 2) return "Silberkranz";
  if (t.index === 3) return "Goldkranz";
  if (t.index === 4) return "Rubinkranz";
  return "Championkranz";
}

export { dayKey, weekKey, addWeeks } from "./time";
import { dayKey, weekKey, addWeeks, DAY } from "./time";

// ---------------------------------------------------------------------------

export type PlayerSummary = {
  id: string;
  name: string;
  hidden: boolean;
  founder: boolean;
  isAdmin: boolean;
  cohort: string | null;
  elo: number;
  peakElo: number;
  games: number;
  wins: number;
  losses: number;
  rank: number | null; // Platz in der Elo-Rangliste (null = vorläufig)
  isLeader: boolean; // aktueller Platz 1 → goldener Name
  xp: number;
  gameXp: number;
  badgeXp: number;
  questXp: number;
  level: number;
  levelInto: number;
  levelNeed: number;
  winStreak: number; // aktuelle Siege in Folge
  bestWinStreak: number;
  trend7: number; // Elo-Veränderung der letzten 7 Tage
  weekGames: number; // Spiele in der laufenden Woche
  weekXp: number;
  activity: {
    streak: number; // Wochen in Folge mit mindestens einem Spiel
    thisWeek: boolean; // in der laufenden Woche schon gespielt
    atRisk: boolean; // Serie läuft, aber diese Woche noch nicht gespielt
    weeks8: boolean[]; // letzte 8 Wochen, älteste zuerst, laufende zuletzt
  };
};

export type Overview = {
  byId: Record<string, PlayerSummary>;
  ranked: PlayerSummary[]; // Elo-Rangliste
  provisional: PlayerSummary[]; // weniger als 3 Spiele
  visible: PlayerSummary[];
  week: string; // Montag der laufenden Woche
  activityRecord: { playerId: string; weeks: number; from: string; to: string } | null;
  ach: Record<string, PlayerAchievements>;
};

export function gameXp(m: MatchRow, playerId: string): number {
  const won = m.winner_id === playerId;
  let xp = XP.game;
  if (won) {
    xp += XP.win;
    if (m.loser_elo_before - m.winner_elo_before >= UPSET_GAP) xp += XP.upset;
  }
  return xp;
}

export function computeOverview(world: World, now = new Date()): Overview {
  const thisWeek = weekKey(now);
  const cutoff7 = now.getTime() - 7 * DAY;

  const base = (p: PlayerRow): PlayerSummary => ({
    id: p.id,
    name: p.name,
    hidden: p.hidden,
    founder: p.founder,
    isAdmin: p.is_admin,
    cohort: p.cohort,
    elo: START_ELO,
    peakElo: START_ELO,
    games: 0,
    wins: 0,
    losses: 0,
    rank: null,
    isLeader: false,
    xp: 0,
    gameXp: 0,
    badgeXp: 0,
    questXp: 0,
    level: 1,
    levelInto: 0,
    levelNeed: LEVEL_XP[2],
    winStreak: 0,
    bestWinStreak: 0,
    trend7: 0,
    weekGames: 0,
    weekXp: 0,
    activity: { streak: 0, thisWeek: false, atRisk: false, weeks8: [] },
  });

  const byId: Record<string, PlayerSummary> = {};
  for (const p of world.players) byId[p.id] = base(p);
  const weeks: Record<string, Set<string>> = {};
  const eloBefore7: Record<string, number> = {};

  for (const m of world.matches) {
    const wk = weekKey(m.created_at);
    const t = new Date(m.created_at).getTime();
    for (const [id, won, before, after] of [
      [m.winner_id, true, m.winner_elo_before, m.winner_elo_after],
      [m.loser_id, false, m.loser_elo_before, m.loser_elo_after],
    ] as const) {
      const s = byId[id];
      if (!s) continue;
      s.games++;
      s.elo = after;
      s.peakElo = Math.max(s.peakElo, after);
      const xp = gameXp(m, id);
      s.xp += xp;
      if (won) {
        s.wins++;
        s.winStreak++;
        s.bestWinStreak = Math.max(s.bestWinStreak, s.winStreak);
      } else {
        s.losses++;
        s.winStreak = 0;
      }
      (weeks[id] ??= new Set()).add(wk);
      if (wk === thisWeek) {
        s.weekGames++;
        s.weekXp += xp;
      }
      if (t >= cutoff7 && !(id in eloBefore7)) eloBefore7[id] = before;
    }
  }

  // Abzeichen und Wochenaufgaben bringen zusätzliche XP.
  const ach = computeAchievements(world, now);
  for (const s of Object.values(byId)) {
    s.gameXp = s.xp;
    s.badgeXp = ach[s.id]?.badgeXp ?? 0;
    s.questXp = ach[s.id]?.questXp ?? 0;
    s.xp += s.badgeXp + s.questXp;
  }

  // Aktivität: Wochen in Folge mit mindestens einem Spiel.
  let record: Overview["activityRecord"] = null;
  for (const s of Object.values(byId)) {
    const set = weeks[s.id] ?? new Set<string>();
    const played = set.has(thisWeek);
    let streak = 0;
    let wk = played ? thisWeek : addWeeks(thisWeek, -1);
    while (set.has(wk)) {
      streak++;
      wk = addWeeks(wk, -1);
    }
    s.activity = {
      streak,
      thisWeek: played,
      atRisk: !played && streak > 0,
      weeks8: Array.from({ length: 8 }, (_, i) => set.has(addWeeks(thisWeek, i - 7))),
    };
    if (!s.hidden) {
      // längste Serie aller Zeiten
      const sorted = [...set].sort();
      let run = 0;
      let start = "";
      let prev = "";
      for (const w of sorted) {
        if (prev && addWeeks(prev, 1) === w) run++;
        else {
          run = 1;
          start = w;
        }
        prev = w;
        if (!record || run > record.weeks) record = { playerId: s.id, weeks: run, from: start, to: w };
      }
    }
    const lv = levelFor(s.xp);
    s.level = lv.level;
    s.levelInto = lv.into;
    s.levelNeed = lv.need;
    s.trend7 = s.id in eloBefore7 ? s.elo - eloBefore7[s.id] : 0;
  }

  const visible = world.players.filter((p) => !p.hidden).map((p) => byId[p.id]);
  const ranked = visible
    .filter((s) => s.games >= MIN_GAMES_RANKED)
    .sort((a, b) => b.elo - a.elo || b.games - a.games || a.name.localeCompare(b.name, "de"));
  ranked.forEach((s, i) => {
    s.rank = i + 1;
  });
  if (ranked.length > 0) {
    const top = ranked[0].elo;
    for (const s of ranked) if (s.elo === top) s.isLeader = true;
  }
  const provisional = visible
    .filter((s) => s.games < MIN_GAMES_RANKED)
    .sort((a, b) => b.games - a.games || b.elo - a.elo || a.name.localeCompare(b.name, "de"));

  return { byId, ranked, provisional, visible, week: thisWeek, activityRecord: record, ach };
}

// Spiele eines Spielers (älteste zuerst) aus Sicht dieses Spielers.
export type PlayerGame = {
  id: number;
  opponentId: string;
  won: boolean;
  eloBefore: number;
  eloAfter: number;
  createdAt: string;
  enteredBy: string | null;
  xp: number;
  upset: boolean;
};

export function gamesOf(world: World, playerId: string): PlayerGame[] {
  return world.matches
    .filter((m) => m.winner_id === playerId || m.loser_id === playerId)
    .map((m) => {
      const won = m.winner_id === playerId;
      return {
        id: m.id,
        opponentId: won ? m.loser_id : m.winner_id,
        won,
        eloBefore: won ? m.winner_elo_before : m.loser_elo_before,
        eloAfter: won ? m.winner_elo_after : m.loser_elo_after,
        createdAt: m.created_at,
        enteredBy: m.entered_by,
        xp: gameXp(m, playerId),
        upset: won && m.loser_elo_before - m.winner_elo_before >= UPSET_GAP,
      };
    });
}
