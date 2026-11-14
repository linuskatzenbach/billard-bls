import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { getWorld } from "@/lib/db";
import { jsonError } from "@/lib/server";
import { TOURNAMENT, TournamentError, getTeams, saveDraw } from "@/lib/tournament";
import { drawGroups, eloAt, seedTeams } from "@/lib/tournament-draw";

// Gruppen auslosen (bzw. neu auslosen, solange nicht veröffentlicht). Nur Admin.
export async function POST() {
  if (!(await isAdmin())) return jsonError("Nur für den Admin.", 403);
  try {
    const [world, teams] = await Promise.all([getWorld(), getTeams()]);
    const seeded = seedTeams(teams, (id) => eloAt(world.matches, id, TOURNAMENT.deadline));
    const groups = drawGroups(seeded);
    await saveDraw(groups, seeded.map(({ teamId, elo, seed, pot }) => ({ teamId, elo, seed, pot })));
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof TournamentError || /genau \d+ Teams/.test(String((err as Error)?.message))) {
      return jsonError((err as Error).message);
    }
    throw err;
  }
}
