import type { MatchRow, World } from "./db";
import { START_ELO } from "./elo";
import { DAY, addWeeks, berlinHour, dayKey, weekEndIso, weekKey } from "./time";

// Abzeichen und Wochenaufgaben. Alles wird aus den gespeicherten Spielen
// berechnet (auch rückwirkend) – es gibt dafür keine eigene Tabelle.

const MIN_RANKED = 3; // wie in progress.ts: erst ab 3 Spielen in der Elo-Rangliste

// Wochenaufgaben gibt es ab dieser Woche (Montag der Uni-Öffnung).
export const QUEST_START = "2026-10-19";
export const QUEST_BONUS = 50;

// XP für Platz 1–3 im Wochenzocker (abgeschlossene Wochen ab QUEST_START).
// Gleich viele Spiele = gleicher Platz.
export const PODIUM_XP = [250, 150, 75];

// ---------------------------------------------------------------------------
// Abzeichen

export type Metal = "bronze" | "silver" | "gold" | "secret";

export type BadgeDef = {
  id: string;
  name: string;
  icon: string;
  desc: string; // Bedingung (bei gestuften: mit {n})
  secret?: boolean;
  metal?: Metal; // für einstufige
  xp?: number; // für einstufige
  tiers?: number[]; // Schwellen Bronze/Silber/Gold
  unit?: string; // für die Fortschrittsanzeige, z. B. "Spiele"
};

export const TIER_XP = [50, 150, 400];
export const TIER_METAL: Metal[] = ["bronze", "silver", "gold"];
export const TIER_NAME = ["Bronze", "Silber", "Gold"];

export const BADGES: BadgeDef[] = [
  { id: "stammgast", name: "Stammgast", icon: "🎱", desc: "{n} Spiele", tiers: [10, 50, 150], unit: "Spiele" },
  { id: "siegertyp", name: "Siegertyp", icon: "🏆", desc: "{n} Siege", tiers: [5, 25, 75], unit: "Siege" },
  { id: "heisser-lauf", name: "Heißer Lauf", icon: "⚡", desc: "{n} Siege in Folge", tiers: [3, 5, 10], unit: "in Folge" },
  { id: "dauerbrenner", name: "Dauerbrenner", icon: "📅", desc: "{n} Wochen Aktivität in Folge", tiers: [4, 10, 20], unit: "Wochen" },
  { id: "netzwerker", name: "Netzwerker", icon: "🤝", desc: "gegen {n} verschiedene Gegner", tiers: [5, 10, 20], unit: "Gegner" },
  { id: "aufsteiger", name: "Aufsteiger", icon: "📈", desc: "Elo {n} erreicht", tiers: [1600, 1700, 1800], unit: "Elo" },
  { id: "buce-spirit", name: "Buce-Spirit", icon: "🎓", desc: "Spiel gegen Spieler aus {n} verschiedenen Jahrgängen", tiers: [3, 4, 5], unit: "Jahrgänge" },

  { id: "erster-sieg", name: "Erster Sieg", icon: "✨", desc: "Der allererste Sieg", metal: "bronze", xp: 25 },
  { id: "revanche", name: "Revanche", icon: "🔁", desc: "Jemanden direkt nach einer Niederlage gegen ihn geschlagen", metal: "bronze", xp: 75 },
  { id: "underdog", name: "Underdog", icon: "🗡️", desc: "Sieg gegen jemanden mit mindestens 200 Elo mehr", metal: "silver", xp: 100 },
  { id: "comeback", name: "Comeback", icon: "🔄", desc: "Sieg nach 5 Niederlagen in Folge", metal: "silver", xp: 100 },
  { id: "fluch-gebrochen", name: "Fluch gebrochen", icon: "🧿", desc: "Erster Sieg gegen jemanden nach mindestens 3 Niederlagen gegen ihn", metal: "silver", xp: 100 },
  { id: "koenigstoeter", name: "Königstöter", icon: "👑", desc: "Die aktuelle Nr. 1 geschlagen", metal: "gold", xp: 150 },
  { id: "gipfelsturm", name: "Gipfelsturm", icon: "⛰️", desc: "Platz 1 erreicht", metal: "gold", xp: 200 },
  { id: "thronhalter", name: "Thronhalter", icon: "🏰", desc: "4 Wochen am Stück auf Platz 1", metal: "gold", xp: 300 },

  { id: "suechtiger", name: "Süchtiger", icon: "🤯", desc: "5 Spiele an einem Tag", secret: true, metal: "secret", xp: 100 },
  { id: "nachteule", name: "Nachteule", icon: "🦉", desc: "Spiel nach Mitternacht", secret: true, metal: "secret", xp: 100 },
  { id: "fruehaufsteher", name: "Frühaufsteher", icon: "🌅", desc: "Spiel vor 9 Uhr", secret: true, metal: "secret", xp: 100 },
  { id: "wochenzocker", name: "Wochenzocker", icon: "📊", desc: "Einmal die meisten Spiele einer Woche", secret: true, metal: "secret", xp: 100 },
  { id: "perfekte-woche", name: "Perfekte Woche", icon: "💯", desc: "Mindestens 5 Siege in einer Woche ohne Niederlage", secret: true, metal: "secret", xp: 100 },
  { id: "sechs-sieben", name: "6?-7!", icon: "♟️", desc: "Mindestens 6 Niederlagen in Folge, direkt danach mindestens 7 Siege in Folge", secret: true, metal: "secret", xp: 500 },
];

export const BADGE_TOTAL = BADGES.reduce((n, b) => n + (b.tiers ? b.tiers.length : 1), 0); // 35

export type EarnedBadge = {
  key: string; // "stammgast:1" bzw. "underdog"
  id: string;
  tier: number | null; // 0 Bronze, 1 Silber, 2 Gold
  at: string; // Zeitpunkt (ISO)
  xp: number;
};

export function badgeLabel(e: { id: string; tier: number | null }): { name: string; icon: string; desc: string; metal: Metal } {
  const def = BADGES.find((b) => b.id === e.id)!;
  if (def.tiers && e.tier !== null) {
    return {
      name: `${def.name} ${["I", "II", "III"][e.tier]}`,
      icon: def.icon,
      desc: def.desc.replace("{n}", def.tiers[e.tier].toLocaleString("de-DE")),
      metal: TIER_METAL[e.tier],
    };
  }
  return { name: def.name, icon: def.icon, desc: def.desc, metal: def.metal ?? "bronze" };
}

// ---------------------------------------------------------------------------
// Wochenaufgaben

export type QuestTier = "leicht" | "mittel" | "schwer";
export const QUEST_XP: Record<QuestTier, number> = { leicht: 40, mittel: 50, schwer: 75 };

type QuestKind =
  | "games"
  | "distinctOpp"
  | "days"
  | "newOpp"
  | "wins"
  | "beatLastLoss"
  | "beatAbove"
  | "defendTop"
  | "winStreak"
  | "beatTop3"
  | "beat100"
  | "distinctWins"
  | "beatNemesis";

export type Quest = {
  key: string;
  kind: QuestKind;
  tier: QuestTier;
  title: string;
  goal: number;
  progress: number;
  done: boolean;
  xp: number;
  target?: string; // Angstgegner
  note?: string; // z. B. offene Gegner bei "neuer Gegner"
};

// Zufall, der für denselben Spieler in derselben Woche immer gleich ist.
function seeded(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

type PlayerState = {
  elo: number;
  games: number;
  wins: number;
  winStreak: number;
  lossStreak: number;
  lossRunBeforeWins: number; // Niederlagen in Folge direkt vor der aktuellen Siegesserie
  bestWinStreak: number;
  peakElo: number;
  opponents: Set<string>;
  oppCohorts: Set<string>; // Jahrgänge der Gegner
  // Bilanz gegen einzelne Gegner
  vs: Map<string, { w: number; l: number; last: "w" | "l" }>;
  days: Map<string, number>;
  weeks: Set<string>;
  leaderSince: number | null;
};

export type PlayerAchievements = {
  badges: EarnedBadge[];
  badgeXp: number;
  questXp: number;
  podiumXp: number; // Wochenzocker Platz 1–3
  quests: Quest[]; // laufende Woche
  questBonus: boolean; // alle drei geschafft
  questWeek: string;
  // Fortschritt der gestuften Abzeichen: aktueller Wert + nächste Schwelle
  progress: Record<string, { value: number; nextTier: number | null; next: number | null }>;
};

export function computeAchievements(world: World, now = new Date()): Record<string, PlayerAchievements> {
  const visible = new Set(world.players.filter((p) => !p.hidden).map((p) => p.id));
  const cohortOf = new Map(world.players.filter((p) => p.cohort).map((p) => [p.id, p.cohort as string]));
  const st: Record<string, PlayerState> = {};
  const S = (id: string): PlayerState =>
    (st[id] ??= {
      elo: START_ELO,
      games: 0,
      wins: 0,
      winStreak: 0,
      lossStreak: 0,
      lossRunBeforeWins: 0,
      bestWinStreak: 0,
      peakElo: START_ELO,
      opponents: new Set(),
      oppCohorts: new Set(),
      vs: new Map(),
      days: new Map(),
      weeks: new Set(),
      leaderSince: null,
    });
  for (const p of world.players) S(p.id);

  const earned: Record<string, Map<string, EarnedBadge>> = {};
  const give = (id: string, badgeId: string, tier: number | null, at: string) => {
    if (!visible.has(id)) return;
    const key = tier === null ? badgeId : `${badgeId}:${tier}`;
    const m = (earned[id] ??= new Map());
    if (m.has(key)) return;
    const def = BADGES.find((b) => b.id === badgeId)!;
    const xp = tier === null ? def.xp ?? 0 : TIER_XP[tier];
    m.set(key, { key, id: badgeId, tier, at, xp });
  };
  const giveTiers = (id: string, badgeId: string, value: number, at: string) => {
    const def = BADGES.find((b) => b.id === badgeId)!;
    def.tiers!.forEach((n, i) => {
      if (value >= n) give(id, badgeId, i, at);
    });
  };

  // Rangliste zum jeweiligen Zeitpunkt
  const ranked = () =>
    [...visible].filter((id) => S(id).games >= MIN_RANKED).sort((a, b) => S(b).elo - S(a).elo);
  const leaders = (): Set<string> => {
    const r = ranked();
    if (r.length === 0) return new Set();
    const top = S(r[0]).elo;
    return new Set(r.filter((id) => S(id).elo === top));
  };
  const rankOf = (id: string): number | null => {
    if (!visible.has(id) || S(id).games < MIN_RANKED) return null;
    const e = S(id).elo;
    return 1 + ranked().filter((o) => S(o).elo > e).length;
  };
  const THRONE_MS = 28 * DAY;
  const checkThrone = (t: number) => {
    for (const id of visible) {
      const since = S(id).leaderSince;
      if (since !== null && t - since >= THRONE_MS) give(id, "thronhalter", null, new Date(since + THRONE_MS).toISOString());
    }
  };
  const updateLeaders = (t: number) => {
    const L = leaders();
    for (const id of visible) {
      const s = S(id);
      if (L.has(id)) {
        if (s.leaderSince === null) s.leaderSince = t;
      } else s.leaderSince = null;
    }
    return L;
  };

  // ---- Wochenaufgaben: Zustand zu Wochenbeginn -------------------------
  const thisWeek = weekKey(now);
  type Snap = {
    elo: Record<string, number>;
    rank: Record<string, number | null>;
    leaders: Set<string>;
    rankedCount: number;
    vs: Record<string, Map<string, { w: number; l: number; last: "w" | "l" }>>;
    active: Set<string>; // in den 4 Wochen davor gespielt
  };
  const snaps: Record<string, Snap> = {};
  const lastPlayed: Record<string, number> = {};
  const takeSnap = (wk: string) => {
    const startMs = new Date(`${wk}T00:00:00+01:00`).getTime();
    const elo: Record<string, number> = {};
    const rank: Record<string, number | null> = {};
    const vs: Snap["vs"] = {};
    for (const id of visible) {
      elo[id] = S(id).elo;
      rank[id] = rankOf(id);
      vs[id] = new Map([...S(id).vs].map(([k, v]) => [k, { ...v }]));
    }
    const active = new Set([...visible].filter((id) => (lastPlayed[id] ?? -Infinity) >= startMs - 28 * DAY));
    snaps[wk] = { elo, rank, leaders: leaders(), rankedCount: ranked().length, vs, active };
  };

  const quests: Record<string, Quest[]> = {}; // key: `${id}|${wk}`
  const questState: Record<string, { opp: Set<string>; days: Set<string>; beaten: Set<string>; streak: number; games: number; wins: number }> = {};

  const nameOf = (id: string) => world.players.find((p) => p.id === id)?.name ?? id;

  const assign = (id: string, wk: string): Quest[] => {
    const k = `${id}|${wk}`;
    if (quests[k]) return quests[k];
    const sn = snaps[wk];
    const others = [...sn.active].filter((o) => o !== id);
    const myVs = sn.vs[id] ?? new Map();
    const myRank = sn.rank[id];
    const myElo = sn.elo[id] ?? START_ELO;

    const mk = (kind: QuestKind, tier: QuestTier, title: string, goal = 1, extra: Partial<Quest> = {}): Quest => ({
      key: `${kind}`,
      kind,
      tier,
      title,
      goal,
      progress: 0,
      done: false,
      xp: QUEST_XP[tier],
      ...extra,
    });

    const pools: Record<QuestTier, Quest[]> = { leicht: [], mittel: [], schwer: [] };
    pools.leicht.push(mk("games", "leicht", "Spiel 3 Partien", 3));
    if (others.length >= 3) pools.leicht.push(mk("distinctOpp", "leicht", "Spiel gegen 3 verschiedene Gegner", 3));
    pools.leicht.push(mk("days", "leicht", "Spiel an 2 verschiedenen Tagen", 2));

    pools.mittel.push(mk("games", "mittel", "Spiel 5 Partien", 5));
    pools.mittel.push(mk("wins", "mittel", "Gewinne 2 Spiele", 2));
    pools.mittel.push(mk("days", "mittel", "Spiel an 3 verschiedenen Tagen", 3));
    if ([...myVs.values()].some((r) => r.last === "l"))
      pools.mittel.push(mk("beatLastLoss", "mittel", "Schlag jemanden, gegen den du zuletzt verloren hast"));

    if (sn.leaders.has(id)) pools.schwer.push(mk("defendTop", "schwer", "Verteidige Platz 1 bis Sonntag"));
    else if (sn.rankedCount > 0) pools.schwer.push(mk("beatAbove", "schwer", "Schlag jemanden, der über dir steht"));
    pools.schwer.push(mk("winStreak", "schwer", "Gewinne 3 Spiele in Folge", 3));
    if (Object.values(sn.rank).some((r, i) => r !== null && r <= 3 && Object.keys(sn.rank)[i] !== id))
      pools.schwer.push(mk("beatTop3", "schwer", "Schlag jemanden aus den Top 3"));
    if (Object.entries(sn.elo).some(([o, e]) => o !== id && e >= myElo + 100))
      pools.schwer.push(mk("beat100", "schwer", "Schlag jemanden mit mindestens 100 Elo mehr"));
    if (others.length >= 3) pools.schwer.push(mk("distinctWins", "schwer", "Gewinne gegen 3 verschiedene Gegner", 3));
    // Angstgegner: schlechteste Bilanz ab 3 Spielen (unter 50 %)
    const nemesis = [...myVs.entries()]
      .filter(([o, r]) => visible.has(o) && r.w + r.l >= 3 && r.w / (r.w + r.l) < 0.5)
      .sort((a, b) => a[1].w / (a[1].w + a[1].l) - b[1].w / (b[1].w + b[1].l) || b[1].w + b[1].l - (a[1].w + a[1].l))[0];
    if (nemesis)
      pools.schwer.push(mk("beatNemesis", "schwer", `Schlage deinen Angstgegner ${nameOf(nemesis[0])}`, 1, { target: nemesis[0] }));

    // Neuer Gegner: Schwierigkeit je nach Anteil unbekannter aktiver Spieler
    const unknown = others.filter((o) => !myVs.has(o));
    if (unknown.length > 0 && others.length > 0) {
      const share = unknown.length / others.length;
      const tier: QuestTier = share > 0.5 ? "leicht" : share >= 0.2 ? "mittel" : "schwer";
      const note = tier === "schwer" ? `noch offen: ${unknown.slice(0, 3).map(nameOf).join(", ")}` : undefined;
      pools[tier].push(mk("newOpp", tier, "Spiel gegen jemanden, gegen den du noch nie gespielt hast", 1, { note }));
    }
    // Für Rangliste ohne Platz: "über dir" heißt dann jeder aus der Rangliste.
    void myRank;

    const pick = (tier: QuestTier) => {
      const pool = pools[tier];
      return pool[Math.floor(seeded(`${id}:${wk}:${tier}`) * pool.length)];
    };
    const list = [pick("leicht"), pick("mittel"), pick("schwer")].filter(Boolean);
    list.forEach((q, i) => (q.key = `${wk}:${i}:${q.kind}`));
    quests[k] = list;
    questState[k] = { opp: new Set(), days: new Set(), beaten: new Set(), streak: 0, games: 0, wins: 0 };
    return list;
  };

  // Fortschritt einer Aufgabe nach einem Spiel
  const advance = (id: string, wk: string, m: MatchRow, ctx: { oppRankBefore: number | null; myRankBefore: number | null; lastVsBefore: "w" | "l" | undefined; knewBefore: boolean }) => {
    const qs = assign(id, wk);
    const q = questState[`${id}|${wk}`];
    const won = m.winner_id === id;
    const opp = won ? m.loser_id : m.winner_id;
    const myElo = won ? m.winner_elo_before : m.loser_elo_before;
    const oppElo = won ? m.loser_elo_before : m.winner_elo_before;
    q.games++;
    q.opp.add(opp);
    q.days.add(dayKey(m.created_at));
    if (won) {
      q.wins++;
      q.streak++;
      q.beaten.add(opp);
    } else q.streak = 0;
    for (const quest of qs) {
      if (quest.done) continue;
      switch (quest.kind) {
        case "games":
          quest.progress = q.games;
          break;
        case "distinctOpp":
          quest.progress = q.opp.size;
          break;
        case "days":
          quest.progress = q.days.size;
          break;
        case "wins":
          quest.progress = q.wins;
          break;
        case "winStreak":
          quest.progress = Math.max(quest.progress, q.streak);
          break;
        case "distinctWins":
          quest.progress = q.beaten.size;
          break;
        case "newOpp":
          if (!ctx.knewBefore) quest.progress = 1;
          break;
        case "beatLastLoss":
          if (won && ctx.lastVsBefore === "l") quest.progress = 1;
          break;
        case "beatAbove":
          if (won && ctx.oppRankBefore !== null && (ctx.myRankBefore === null || ctx.oppRankBefore < ctx.myRankBefore))
            quest.progress = 1;
          break;
        case "beatTop3":
          if (won && ctx.oppRankBefore !== null && ctx.oppRankBefore <= 3) quest.progress = 1;
          break;
        case "beat100":
          if (won && oppElo - myElo >= 100) quest.progress = 1;
          break;
        case "beatNemesis":
          if (won && opp === quest.target) quest.progress = 1;
          break;
        case "defendTop":
          break;
      }
      if (quest.progress >= quest.goal) {
        quest.progress = quest.goal;
        quest.done = true;
      }
    }
  };

  // Spiele pro Woche (für Wochenzocker / Perfekte Woche)
  const weekStats: Record<string, Record<string, { g: number; w: number; l: number }>> = {};

  // ---- Durchlauf durch alle Spiele --------------------------------------
  let nextWeek = QUEST_START;
  const flushWeeksUntil = (wk: string) => {
    while (nextWeek <= wk && nextWeek <= thisWeek) {
      // Ende der Vorwoche: "Verteidige Platz 1" auswerten
      const prev = addWeeks(nextWeek, -1);
      if (prev >= QUEST_START) {
        const L = leaders();
        for (const [k, qs] of Object.entries(quests)) {
          const [pid, w] = k.split("|");
          if (w !== prev) continue;
          for (const quest of qs) if (quest.kind === "defendTop" && L.has(pid)) {
            quest.progress = 1;
            quest.done = true;
          }
        }
      }
      takeSnap(nextWeek);
      nextWeek = addWeeks(nextWeek, 1);
    }
  };

  let L = new Set<string>();
  for (const m of world.matches) {
    const t = new Date(m.created_at).getTime();
    const wk = weekKey(m.created_at);
    checkThrone(t);
    flushWeeksUntil(wk);

    const w = S(m.winner_id);
    const l = S(m.loser_id);
    const beforeLeaders = L;
    const ctxFor = (id: string, opp: string) => ({
      oppRankBefore: rankOf(opp),
      myRankBefore: rankOf(id),
      lastVsBefore: S(id).vs.get(opp)?.last,
      knewBefore: S(id).vs.has(opp),
    });
    const ctxW = ctxFor(m.winner_id, m.loser_id);
    const ctxL = ctxFor(m.loser_id, m.winner_id);

    // --- Abzeichen, die den Zustand vor dem Spiel brauchen
    const recW = w.vs.get(m.loser_id);
    if (w.wins === 0) give(m.winner_id, "erster-sieg", null, m.created_at);
    if (recW?.last === "l") give(m.winner_id, "revanche", null, m.created_at);
    if (recW && recW.w === 0 && recW.l >= 3) give(m.winner_id, "fluch-gebrochen", null, m.created_at);
    if (m.loser_elo_before - m.winner_elo_before >= 200) give(m.winner_id, "underdog", null, m.created_at);
    if (w.lossStreak >= 5) give(m.winner_id, "comeback", null, m.created_at);
    if (beforeLeaders.has(m.loser_id) && !beforeLeaders.has(m.winner_id)) give(m.winner_id, "koenigstoeter", null, m.created_at);

    // --- Zustand aktualisieren
    for (const [s, id, opp, won, after] of [
      [w, m.winner_id, m.loser_id, true, m.winner_elo_after],
      [l, m.loser_id, m.winner_id, false, m.loser_elo_after],
    ] as const) {
      s.games++;
      s.elo = after;
      s.peakElo = Math.max(s.peakElo, after);
      s.opponents.add(opp);
      const oc = cohortOf.get(opp);
      if (oc) s.oppCohorts.add(oc);
      const r = s.vs.get(opp) ?? { w: 0, l: 0, last: "w" as const };
      if (won) {
        r.w++;
        r.last = "w";
        s.wins++;
        if (s.winStreak === 0) s.lossRunBeforeWins = s.lossStreak;
        s.winStreak++;
        s.lossStreak = 0;
        s.bestWinStreak = Math.max(s.bestWinStreak, s.winStreak);
      } else {
        r.l++;
        r.last = "l";
        s.lossStreak++;
        s.winStreak = 0;
      }
      s.vs.set(opp, r);
      const day = dayKey(m.created_at);
      s.days.set(day, (s.days.get(day) ?? 0) + 1);
      s.weeks.add(wk);
      lastPlayed[id] = t;
      const ws = ((weekStats[wk] ??= {})[id] ??= { g: 0, w: 0, l: 0 });
      ws.g++;
      if (won) ws.w++;
      else ws.l++;

      // Abzeichen nach dem Spiel
      giveTiers(id, "stammgast", s.games, m.created_at);
      giveTiers(id, "siegertyp", s.wins, m.created_at);
      giveTiers(id, "heisser-lauf", s.bestWinStreak, m.created_at);
      giveTiers(id, "netzwerker", s.opponents.size, m.created_at);
      giveTiers(id, "aufsteiger", s.peakElo, m.created_at);
      giveTiers(id, "buce-spirit", s.oppCohorts.size, m.created_at);
      if ((s.days.get(day) ?? 0) >= 5) give(id, "suechtiger", null, m.created_at);
      const h = berlinHour(m.created_at);
      if (h < 5) give(id, "nachteule", null, m.created_at);
      else if (h < 9) give(id, "fruehaufsteher", null, m.created_at);
      if (won && s.winStreak >= 7 && s.lossRunBeforeWins >= 6) give(id, "sechs-sieben", null, m.created_at);
    }

    L = updateLeaders(t);
    for (const id of [m.winner_id, m.loser_id]) if (L.has(id)) give(id, "gipfelsturm", null, m.created_at);

    // Wochenaufgaben
    if (wk >= QUEST_START) {
      if (visible.has(m.winner_id)) advance(m.winner_id, wk, m, ctxW);
      if (visible.has(m.loser_id)) advance(m.loser_id, wk, m, ctxL);
    }
  }
  checkThrone(now.getTime());
  flushWeeksUntil(thisWeek);

  // Abgeschlossene Wochen: Wochenzocker, Podest-XP und Perfekte Woche
  const podiumXp: Record<string, number> = {};
  for (const [wk, stats] of Object.entries(weekStats)) {
    if (wk >= thisWeek) continue;
    const end = weekEndIso(wk);
    const rows = Object.entries(stats).filter(([id]) => visible.has(id) && stats[id].g > 0);
    const top = Math.max(0, ...rows.map(([, s]) => s.g));
    for (const [id, s] of rows) {
      if (top > 0 && s.g === top) give(id, "wochenzocker", null, end);
      if (s.w >= 5 && s.l === 0) give(id, "perfekte-woche", null, end);
      if (wk >= QUEST_START) {
        // Platz = 1 + Anzahl der Spieler mit mehr Spielen
        const place = 1 + rows.filter(([, o]) => o.g > s.g).length;
        if (place <= PODIUM_XP.length) podiumXp[id] = (podiumXp[id] ?? 0) + PODIUM_XP[place - 1];
      }
    }
  }

  // Dauerbrenner: längste Serie aktiver Wochen
  for (const id of visible) {
    const sorted = [...S(id).weeks].sort();
    let run = 0;
    let prev = "";
    for (const wkey of sorted) {
      run = prev && addWeeks(prev, 1) === wkey ? run + 1 : 1;
      prev = wkey;
      const at = new Date(`${wkey}T12:00:00+01:00`).toISOString();
      giveTiers(id, "dauerbrenner", run, at);
    }
  }

  // ---- Ergebnis je Spieler ----------------------------------------------
  const out: Record<string, PlayerAchievements> = {};
  for (const p of world.players) {
    const id = p.id;
    const s = S(id);
    const badges = [...(earned[id]?.values() ?? [])].sort((a, b) => b.at.localeCompare(a.at));
    let questXp = 0;
    for (const [k, qs] of Object.entries(quests)) {
      if (!k.startsWith(`${id}|`)) continue;
      const done = qs.filter((q) => q.done);
      questXp += done.reduce((n, q) => n + q.xp, 0);
      if (qs.length > 0 && done.length === qs.length) questXp += QUEST_BONUS;
    }
    const current = visible.has(id) && thisWeek >= QUEST_START ? assign(id, thisWeek) : [];

    // Fortschritt der gestuften Abzeichen
    let weekRun = 0;
    {
      const sorted = [...s.weeks].sort();
      let run = 0;
      let prev = "";
      for (const wkey of sorted) {
        run = prev && addWeeks(prev, 1) === wkey ? run + 1 : 1;
        prev = wkey;
        weekRun = Math.max(weekRun, run);
      }
    }
    const values: Record<string, number> = {
      stammgast: s.games,
      siegertyp: s.wins,
      "heisser-lauf": s.bestWinStreak,
      dauerbrenner: weekRun,
      netzwerker: s.opponents.size,
      aufsteiger: s.peakElo,
      "buce-spirit": s.oppCohorts.size,
    };
    const progress: PlayerAchievements["progress"] = {};
    for (const def of BADGES) {
      if (!def.tiers) continue;
      const v = values[def.id] ?? 0;
      const nextTier = def.tiers.findIndex((n) => v < n);
      progress[def.id] = { value: v, nextTier: nextTier < 0 ? null : nextTier, next: nextTier < 0 ? null : def.tiers[nextTier] };
    }

    out[id] = {
      badges,
      badgeXp: badges.reduce((n, b) => n + b.xp, 0),
      questXp,
      podiumXp: podiumXp[id] ?? 0,
      quests: current,
      questBonus: current.length > 0 && current.every((q) => q.done),
      questWeek: thisWeek,
      progress,
    };
  }
  return out;
}
