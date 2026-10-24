import type { MatchRow, World } from "./db";
import { computeOverview, gameXp, UPSET_GAP, XP } from "./progress";
import { badgeLabel, QUEST_BONUS, type Metal } from "./achievements";

// Was ein Spiel einem Spieler gebracht hat – für den Belohnungsbildschirm.
export type Reward = {
  won: boolean;
  opponent: string;
  eloBefore: number;
  eloAfter: number;
  rankBefore: number | null;
  rankAfter: number | null;
  passed: string[]; // an diesen Spielern vorbeigezogen
  levelBefore: number;
  levelAfter: number;
  xp: number;
  lines: { label: string; xp: number }[];
  badges: { name: string; icon: string; desc: string; metal: Metal }[];
  leader: boolean;
};

export function computeReward(world: World, match: MatchRow, playerId: string): Reward {
  const before = computeOverview(world);
  const after = computeOverview({ players: world.players, matches: [...world.matches, match] });
  const b = before.byId[playerId];
  const a = after.byId[playerId];
  const won = match.winner_id === playerId;
  const oppId = won ? match.loser_id : match.winner_id;

  const lines: Reward["lines"] = [{ label: "Spiel gespielt", xp: XP.game }];
  if (won) lines.push({ label: "Sieg", xp: XP.win });
  if (won && match.loser_elo_before - match.winner_elo_before >= UPSET_GAP)
    lines.push({ label: `Upset-Bonus (${after.byId[oppId]?.name ?? ""} +${match.loser_elo_before - match.winner_elo_before})`, xp: XP.upset });

  // neu geschaffte Wochenaufgaben
  const doneBefore = new Set(before.ach[playerId]?.quests.filter((q) => q.done).map((q) => q.key));
  for (const q of after.ach[playerId]?.quests ?? []) {
    if (q.done && !doneBefore.has(q.key)) lines.push({ label: `Aufgabe „${q.title}“`, xp: q.xp });
  }
  if (after.ach[playerId]?.questBonus && !before.ach[playerId]?.questBonus)
    lines.push({ label: "Alle Wochenaufgaben geschafft", xp: QUEST_BONUS });

  // neue Abzeichen
  const had = new Set(before.ach[playerId]?.badges.map((x) => x.key));
  const fresh = (after.ach[playerId]?.badges ?? []).filter((x) => !had.has(x.key));
  for (const x of fresh) lines.push({ label: `Abzeichen „${badgeLabel(x).name}“`, xp: x.xp });

  const passed =
    a?.rank && b
      ? before.ranked.filter((o) => o.id !== playerId && (b.rank === null || o.rank! < b.rank) && (after.byId[o.id].rank ?? 99) > a.rank!).map((o) => o.name)
      : [];

  void gameXp;
  return {
    won,
    opponent: after.byId[oppId]?.name ?? "",
    eloBefore: won ? match.winner_elo_before : match.loser_elo_before,
    eloAfter: won ? match.winner_elo_after : match.loser_elo_after,
    rankBefore: b?.rank ?? null,
    rankAfter: a?.rank ?? null,
    passed,
    levelBefore: b?.level ?? 1,
    levelAfter: a?.level ?? 1,
    xp: (a?.xp ?? 0) - (b?.xp ?? 0),
    lines,
    badges: fresh.map((x) => badgeLabel(x)),
    leader: Boolean(a?.isLeader),
  };
}
