import type { MatchRow, World } from "./db";
import { START_ELO } from "./elo";
import { DAY, addWeeks, berlinHour, dayKey, weekEndIso, weekKey } from "./time";
import { isDoubles, seats, sidesBefore } from "./match";

// Abzeichen und Wochenaufgaben. Alles wird aus den gespeicherten Spielen
// berechnet (auch rückwirkend) – es gibt dafür keine eigene Tabelle.

const MIN_RANKED = 3; // wie in progress.ts: erst ab 3 Spielen in der Elo-Rangliste

// Wochenaufgaben gibt es ab dieser Woche (Montag der Uni-Öffnung).
export const QUEST_START = "2026-10-19";
// Doppel-Aufgaben gibt es ab der ersten Woche nach dem 2v2-Update (vorher
// würden sich sonst die bereits verteilten Aufgaben der laufenden Woche ändern).
export const DOUBLES_QUEST_START = "2026-11-02";
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
  { id: "teamplayer", name: "Teamplayer", icon: "👥", desc: "{n} Doppel gespielt", tiers: [10, 30, 75], unit: "Doppel" },
  { id: "eingespielt", name: "Eingespielt", icon: "🔗", desc: "{n} Doppel-Siege mit demselben Partner", tiers: [3, 10, 25], unit: "Siege" },
  { id: "partnerboerse", name: "Partnerbörse", icon: "🔀", desc: "Doppel mit {n} verschiedenen Partnern", tiers: [3, 6, 12], unit: "Partner" },

  { id: "erster-sieg", name: "Erster Sieg", icon: "✨", desc: "Der allererste Sieg", metal: "bronze", xp: 25 },
  { id: "revanche", name: "Revanche", icon: "🔁", desc: "Jemanden direkt nach einer Niederlage gegen ihn geschlagen", metal: "bronze", xp: 75 },
  { id: "underdog", name: "Underdog", icon: "🗡️", desc: "Sieg gegen jemanden mit mindestens 200 Elo mehr", metal: "silver", xp: 100 },
  { id: "comeback", name: "Comeback", icon: "🔄", desc: "Sieg nach 5 Niederlagen in Folge", metal: "silver", xp: 100 },
  { id: "fluch-gebrochen", name: "Fluch gebrochen", icon: "🧿", desc: "Erster Sieg gegen jemanden nach mindestens 3 Niederlagen gegen ihn", metal: "silver", xp: 100 },
  { id: "koenigstoeter", name: "Königstöter", icon: "👑", desc: "Die aktuelle Nr. 1 geschlagen", metal: "gold", xp: 150 },
  { id: "gipfelsturm", name: "Gipfelsturm", icon: "⛰️", desc: "Platz 1 erreicht", metal: "gold", xp: 200 },
  { id: "thronhalter", name: "Thronhalter", icon: "🏰", desc: "4 Wochen am Stück auf Platz 1", metal: "gold", xp: 300 },
  { id: "doppelschlag", name: "Doppelschlag", icon: "⚔️", desc: "Zwei Doppel nacheinander gegen ein Team mit mindestens 100 Elo mehr im Schnitt gewonnen", metal: "gold", xp: 150 },

  { id: "suechtiger", name: "Süchtiger", icon: "🤯", desc: "5 Spiele an einem Tag", secret: true, metal: "secret", xp: 100 },
  { id: "nachteule", name: "Nachteule", icon: "🦉", desc: "Spiel nach Mitternacht", secret: true, metal: "secret", xp: 100 },
  { id: "fruehaufsteher", name: "Frühaufsteher", icon: "🌅", desc: "Spiel vor 9 Uhr", secret: true, metal: "secret", xp: 100 },
  { id: "wochenzocker", name: "Wochenzocker", icon: "📊", desc: "Einmal die meisten Spiele einer Woche", secret: true, metal: "secret", xp: 100 },
  { id: "perfekte-woche", name: "Perfekte Woche", icon: "💯", desc: "Mindestens 5 Siege in einer Woche ohne Niederlage", secret: true, metal: "secret", xp: 100 },
  { id: "sechs-sieben", name: "6?-7!", icon: "♟️", desc: "Mindestens 6 Niederlagen in Folge, direkt danach mindestens 7 Siege in Folge", secret: true, metal: "secret", xp: 500 },
  { id: "seitenwechsel", name: "Seitenwechsel", icon: "🎭", desc: "Am selben Tag mit jemandem und gegen ihn gewonnen", secret: true, metal: "secret", xp: 100 },
  { id: "brueckenbauer", name: "Brückenbauer", icon: "🌉", desc: "Mit einem Partner aus einem anderen Jahrgang gegen zwei aus dem eigenen Jahrgang gewonnen", secret: true, metal: "secret", xp: 100 },
];

export const BADGE_TOTAL = BADGES.reduce((n, b) => n + (b.tiers ? b.tiers.length : 1), 0); // 47

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
  | "beatNemesis"
  | "dblGames"
  | "dblWins"
  | "dblPartners"
  | "dblWinPartners"
  | "dblBeatStronger";

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
  // Bilanz gegen einzelne Gegner (nur Einzel)
  vs: Map<string, { w: number; l: number; last: "w" | "l" }>;
  // Doppel
  dGames: number;
  partners: Set<string>;
  winsWith: Map<string, number>; // Siege je Partner
  strongWinRun: number; // Doppel-Siege in Folge gegen ein Team mit 100+ Elo mehr
  dayWinsWith: Map<string, Set<string>>; // Tag → Partner, mit denen gewonnen
  dayBeaten: Map<string, Set<string>>; // Tag → geschlagene Gegner
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
      dGames: 0,
      partners: new Set(),
      winsWith: new Map(),
      strongWinRun: 0,
      dayWinsWith: new Map(),
      dayBeaten: new Map(),
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

  // Rangliste zum jeweiligen Zeitpunkt. Wird nur neu sortiert, wenn sich
  // seit der letzten Abfrage eine Elo geändert hat (sonst pro Spiel mehrfach).
  let rankCache: { list: string[]; rank: Map<string, number> } | null = null;
  const rankInfo = () => {
    if (!rankCache) {
      const list = [...visible].filter((id) => S(id).games >= MIN_RANKED).sort((a, b) => S(b).elo - S(a).elo);
      const rank = new Map<string, number>();
      list.forEach((id, i) => {
        const prev = list[i - 1];
        rank.set(id, prev !== undefined && S(prev).elo === S(id).elo ? rank.get(prev)! : i + 1);
      });
      rankCache = { list, rank };
    }
    return rankCache;
  };
  const ranked = () => rankInfo().list;
  const leaders = (): Set<string> => {
    const r = ranked();
    if (r.length === 0) return new Set();
    const top = S(r[0]).elo;
    return new Set(r.filter((id) => S(id).elo === top));
  };
  const rankOf = (id: string): number | null => rankInfo().rank.get(id) ?? null;
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
    met: Record<string, Set<string>>; // je schon mal gegen gespielt (Einzel oder Doppel)
    active: Set<string>; // in den 4 Wochen davor gespielt
  };
  const snaps: Record<string, Snap> = {};
  const lastPlayed: Record<string, number> = {};
  const takeSnap = (wk: string) => {
    const startMs = new Date(`${wk}T00:00:00+01:00`).getTime();
    const elo: Record<string, number> = {};
    const rank: Record<string, number | null> = {};
    const vs: Snap["vs"] = {};
    const met: Snap["met"] = {};
    for (const id of visible) {
      elo[id] = S(id).elo;
      rank[id] = rankOf(id);
      vs[id] = new Map([...S(id).vs].map(([k, v]) => [k, { ...v }]));
      met[id] = new Set(S(id).opponents);
    }
    const active = new Set([...visible].filter((id) => (lastPlayed[id] ?? -Infinity) >= startMs - 28 * DAY));
    snaps[wk] = { elo, rank, leaders: leaders(), rankedCount: ranked().length, vs, met, active };
  };

  const quests: Record<string, Quest[]> = {}; // key: `${id}|${wk}`
  const questState: Record<
    string,
    { opp: Set<string>; days: Set<string>; beaten: Set<string>; streak: number; games: number; wins: number; dGames: number; dWins: number; dPartners: Set<string>; dWinPartners: Set<string> }
  > = {};

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
      pools.mittel.push(mk("beatLastLoss", "mittel", "Schlag jemanden im Einzel, gegen den du zuletzt verloren hast"));

    if (sn.leaders.has(id)) pools.schwer.push(mk("defendTop", "schwer", "Verteidige Platz 1 bis Sonntag"));
    else if (sn.rankedCount > 0) pools.schwer.push(mk("beatAbove", "schwer", "Schlag jemanden im Einzel, der über dir steht"));
    pools.schwer.push(mk("winStreak", "schwer", "Gewinne 3 Spiele in Folge", 3));
    if (Object.values(sn.rank).some((r, i) => r !== null && r <= 3 && Object.keys(sn.rank)[i] !== id))
      pools.schwer.push(mk("beatTop3", "schwer", "Schlag jemanden aus den Top 3 im Einzel"));
    if (Object.entries(sn.elo).some(([o, e]) => o !== id && e >= myElo + 100))
      pools.schwer.push(mk("beat100", "schwer", "Schlag jemanden mit mindestens 100 Elo mehr im Einzel"));
    if (others.length >= 3) pools.schwer.push(mk("distinctWins", "schwer", "Gewinne gegen 3 verschiedene Gegner", 3));
    // Angstgegner: schlechteste Bilanz ab 3 Spielen (unter 50 %)
    const nemesis = [...myVs.entries()]
      .filter(([o, r]) => visible.has(o) && r.w + r.l >= 3 && r.w / (r.w + r.l) < 0.5)
      .sort((a, b) => a[1].w / (a[1].w + a[1].l) - b[1].w / (b[1].w + b[1].l) || b[1].w + b[1].l - (a[1].w + a[1].l))[0];
    if (nemesis)
      pools.schwer.push(mk("beatNemesis", "schwer", `Schlage deinen Angstgegner ${nameOf(nemesis[0])} im Einzel`, 1, { target: nemesis[0] }));

    // Doppel-Aufgaben (erst ab der Woche nach dem 2v2-Update)
    if (wk >= DOUBLES_QUEST_START && others.length >= 3) {
      pools.leicht.push(mk("dblGames", "leicht", "Spiel 2 Doppel", 2));
      pools.mittel.push(mk("dblWins", "mittel", "Gewinne ein Doppel"));
      pools.mittel.push(mk("dblPartners", "mittel", "Spiel Doppel mit 2 verschiedenen Partnern", 2));
      pools.schwer.push(mk("dblWinPartners", "schwer", "Gewinne 2 Doppel mit verschiedenen Partnern", 2));
      pools.schwer.push(mk("dblBeatStronger", "schwer", "Gewinne ein Doppel gegen ein Team mit höherem Elo-Schnitt"));
    }

    // Neuer Gegner: Schwierigkeit je nach Anteil unbekannter aktiver Spieler
    // (Einzel oder Doppel – im Doppel zählen beide Gegner, nicht der Partner)
    const known = sn.met[id] ?? new Set<string>();
    const unknown = others.filter((o) => !known.has(o));
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
    questState[k] = { opp: new Set(), days: new Set(), beaten: new Set(), streak: 0, games: 0, wins: 0, dGames: 0, dWins: 0, dPartners: new Set(), dWinPartners: new Set() };
    return list;
  };

  // Fortschritt einer Aufgabe nach einem Spiel. Aufgaben gegen einen
  // bestimmten Gegner zählen nur im Einzel; Mengen, Tage, Serien und
  // "verschiedene Gegner" zählen Doppel mit (dort beide Gegner, nicht der Partner).
  type Ctx = {
    won: boolean;
    opps: string[];
    partner: string | null;
    myElo: number; // Einzel: eigene Elo, Doppel: eigener Team-Schnitt
    oppElo: number; // Einzel: Elo des Gegners, Doppel: Schnitt der Gegner
    oppRankBefore: number | null; // nur Einzel
    myRankBefore: number | null;
    lastVsBefore: "w" | "l" | undefined; // nur Einzel
    newOppMet: boolean; // mindestens einer der Gegner war neu
  };
  const advance = (id: string, wk: string, m: MatchRow, ctx: Ctx) => {
    const qs = assign(id, wk);
    const q = questState[`${id}|${wk}`];
    const dbl = ctx.partner !== null;
    const { won } = ctx;
    const opp = ctx.opps[0];
    q.games++;
    for (const o of ctx.opps) q.opp.add(o);
    q.days.add(dayKey(m.created_at));
    if (won) {
      q.wins++;
      q.streak++;
      for (const o of ctx.opps) q.beaten.add(o);
    } else q.streak = 0;
    if (dbl) {
      q.dGames++;
      q.dPartners.add(ctx.partner!);
      if (won) {
        q.dWins++;
        q.dWinPartners.add(ctx.partner!);
      }
    }
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
          if (ctx.newOppMet) quest.progress = 1;
          break;
        case "beatLastLoss":
          if (!dbl && won && ctx.lastVsBefore === "l") quest.progress = 1;
          break;
        case "beatAbove":
          if (!dbl && won && ctx.oppRankBefore !== null && (ctx.myRankBefore === null || ctx.oppRankBefore < ctx.myRankBefore))
            quest.progress = 1;
          break;
        case "beatTop3":
          if (!dbl && won && ctx.oppRankBefore !== null && ctx.oppRankBefore <= 3) quest.progress = 1;
          break;
        case "beat100":
          if (!dbl && won && ctx.oppElo - ctx.myElo >= 100) quest.progress = 1;
          break;
        case "beatNemesis":
          if (!dbl && won && opp === quest.target) quest.progress = 1;
          break;
        case "dblGames":
          quest.progress = q.dGames;
          break;
        case "dblWins":
          quest.progress = q.dWins;
          break;
        case "dblPartners":
          quest.progress = q.dPartners.size;
          break;
        case "dblWinPartners":
          quest.progress = q.dWinPartners.size;
          break;
        case "dblBeatStronger":
          if (dbl && won && ctx.oppElo > ctx.myElo) quest.progress = 1;
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
    const day = dayKey(m.created_at);
    checkThrone(t);
    flushWeeksUntil(wk);

    const dbl = isDoubles(m);
    const sides = sidesBefore(m);
    const all = seats(m);
    const beforeLeaders = L;

    // Kontext für die Wochenaufgaben (Stand vor dem Spiel)
    const ctx: Record<string, Ctx> = {};
    for (const seat of all) {
      const me = S(seat.id);
      const single = !dbl ? seat.opps[0] : null;
      ctx[seat.id] = {
        won: seat.won,
        opps: seat.opps,
        partner: seat.partner,
        myElo: seat.won ? sides.win : sides.lose,
        oppElo: seat.won ? sides.lose : sides.win,
        oppRankBefore: single ? rankOf(single) : null,
        myRankBefore: rankOf(seat.id),
        lastVsBefore: single ? me.vs.get(single)?.last : undefined,
        newOppMet: seat.opps.some((o) => !me.opponents.has(o)),
      };
    }

    // --- Abzeichen, die den Zustand vor dem Spiel brauchen
    for (const seat of all) {
      if (!seat.won) continue;
      const me = S(seat.id);
      if (me.wins === 0) give(seat.id, "erster-sieg", null, m.created_at);
      if (me.lossStreak >= 5) give(seat.id, "comeback", null, m.created_at);
      if (!dbl) {
        // gegen einen bestimmten Gegner: nur im Einzel
        const opp = seat.opps[0];
        const rec = me.vs.get(opp);
        if (rec?.last === "l") give(seat.id, "revanche", null, m.created_at);
        if (rec && rec.w === 0 && rec.l >= 3) give(seat.id, "fluch-gebrochen", null, m.created_at);
        if (m.loser_elo_before - m.winner_elo_before >= 200) give(seat.id, "underdog", null, m.created_at);
        if (beforeLeaders.has(opp) && !beforeLeaders.has(seat.id)) give(seat.id, "koenigstoeter", null, m.created_at);
      }
    }

    // --- Zustand aktualisieren
    for (const seat of all) {
      const { id, won, after } = seat;
      const s = S(id);
      s.games++;
      s.elo = after;
      rankCache = null;
      s.peakElo = Math.max(s.peakElo, after);
      for (const opp of seat.opps) {
        s.opponents.add(opp);
        const oc = cohortOf.get(opp);
        if (oc) s.oppCohorts.add(oc);
      }
      if (!dbl) {
        const opp = seat.opps[0];
        const r = s.vs.get(opp) ?? { w: 0, l: 0, last: "w" as const };
        if (won) {
          r.w++;
          r.last = "w";
        } else {
          r.l++;
          r.last = "l";
        }
        s.vs.set(opp, r);
      }
      if (won) {
        s.wins++;
        if (s.winStreak === 0) s.lossRunBeforeWins = s.lossStreak;
        s.winStreak++;
        s.lossStreak = 0;
        s.bestWinStreak = Math.max(s.bestWinStreak, s.winStreak);
      } else {
        s.lossStreak++;
        s.winStreak = 0;
      }
      s.days.set(day, (s.days.get(day) ?? 0) + 1);
      s.weeks.add(wk);
      lastPlayed[id] = t;
      const ws = ((weekStats[wk] ??= {})[id] ??= { g: 0, w: 0, l: 0 });
      ws.g++;
      if (won) ws.w++;
      else ws.l++;

      // Doppel
      if (dbl && seat.partner) {
        const partner = seat.partner;
        s.dGames++;
        s.partners.add(partner);
        const c = ctx[id];
        if (won) {
          s.winsWith.set(partner, (s.winsWith.get(partner) ?? 0) + 1);
          s.strongWinRun = c.oppElo - c.myElo >= 100 ? s.strongWinRun + 1 : 0;
          if (s.strongWinRun >= 2) give(id, "doppelschlag", null, m.created_at);
          const mine = cohortOf.get(id);
          const pc = cohortOf.get(partner);
          if (mine && pc && pc !== mine && seat.opps.every((o) => cohortOf.get(o) === mine))
            give(id, "brueckenbauer", null, m.created_at);
          let ww = s.dayWinsWith.get(day);
          if (!ww) s.dayWinsWith.set(day, (ww = new Set()));
          ww.add(partner);
        } else {
          s.strongWinRun = 0;
        }
        giveTiers(id, "teamplayer", s.dGames, m.created_at);
        giveTiers(id, "eingespielt", Math.max(0, ...s.winsWith.values()), m.created_at);
        giveTiers(id, "partnerboerse", s.partners.size, m.created_at);
      }
      // Seitenwechsel: am selben Tag mit jemandem gewonnen und gegen ihn gewonnen
      if (won) {
        if (!dbl || seat.partner) {
          let bt = s.dayBeaten.get(day);
          if (!bt) s.dayBeaten.set(day, (bt = new Set()));
          for (const o of seat.opps) bt.add(o);
          const ww = s.dayWinsWith.get(day);
          if (ww && [...ww].some((p) => bt!.has(p))) give(id, "seitenwechsel", null, m.created_at);
        }
      }

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
    for (const seat of all) if (L.has(seat.id)) give(seat.id, "gipfelsturm", null, m.created_at);

    // Wochenaufgaben
    if (wk >= QUEST_START) {
      for (const seat of all) if (visible.has(seat.id)) advance(seat.id, wk, m, ctx[seat.id]);
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
      teamplayer: s.dGames,
      eingespielt: Math.max(0, ...s.winsWith.values()),
      partnerboerse: s.partners.size,
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
