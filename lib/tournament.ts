import { getSql, type Row } from "./sql";
import { ready } from "./db";
import { weekEndIso } from "./time";

// 2v2-Turnier (Herbst 2026). Ablauf:
//   Anmeldung bis Fr 13.11., 23:59 – man fragt einen Partner an, der nimmt an
//   (danach fest, nicht mehr änderbar). Dann zwei Tage Pause
//   (Paarungen entwerfen), Gruppenphase Mo 16.–Sa 21.11., wieder ein Tag Pause,
//   ab Mo 23.11. Viertelfinale, Halbfinale und Finale (bis ca. 2.12.).
// Turnierspiele zählen später ganz normal für Elo, Wochenzocker usw.
export const TOURNAMENT = {
  id: "2v2-herbst-2026",
  name: "2v2-Turnier",
  // Letzte Sekunde der Woche Sa 7.11.–Fr 13.11. (23:59:59 deutscher Zeit).
  deadline: weekEndIso("2026-11-07"),
  deadlineLabel: "Fr 13.11., 23:59",
  phases: [
    // from/until: erster und letzter Tag (deutsche Zeit). Zwischen den Phasen
    // liegen Pausentage – dann „läuft“ gerade keine Phase.
    { key: "anmeldung", label: "Anmeldung", detail: "im 2er-Team", when: "bis Fr 13.11.", from: "2026-11-07", until: "2026-11-13" },
    { key: "gruppen", label: "Gruppenphase", detail: "Spiele in Gruppen", when: "16.–21.11.", from: "2026-11-16", until: "2026-11-21" },
    { key: "ko", label: "K.O.-Runde", detail: "Viertel-, Halbfinale, Finale", when: "23.11. – ca. 2.12.", from: "2026-11-23", until: "2026-12-02" },
  ],
} as const;

export const registrationOpen = (now = new Date()) => now.getTime() <= new Date(TOURNAMENT.deadline).getTime();

export type TeamRow = { id: number; player1: string; player2: string; createdAt: string };
export type RequestRow = { id: number; from: string; to: string; createdAt: string };

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString());
const T = TOURNAMENT.id;

export async function getTeams(): Promise<TeamRow[]> {
  await ready();
  const rows = await getSql()`
    SELECT id, player1_id, player2_id, created_at FROM tournament_teams
    WHERE tournament = ${T} ORDER BY created_at ASC, id ASC
  `;
  return rows.map((r: Row) => ({ id: Number(r.id), player1: r.player1_id, player2: r.player2_id, createdAt: iso(r.created_at) }));
}

// Offene Anfragen, an denen dieser Spieler beteiligt ist (ohne solche, bei
// denen jemand inzwischen schon ein Team hat).
export async function getOpenRequests(playerId: string): Promise<{ incoming: RequestRow[]; outgoing: RequestRow | null }> {
  await ready();
  const rows = await getSql()`
    SELECT id, from_id, to_id, created_at FROM tournament_requests r
    WHERE tournament = ${T} AND status = 'pending' AND (from_id = ${playerId} OR to_id = ${playerId})
      AND NOT EXISTS (SELECT 1 FROM tournament_members m WHERE m.tournament = ${T} AND m.player_id IN (r.from_id, r.to_id))
    ORDER BY created_at ASC, id ASC
  `;
  const all = rows.map((r: Row) => ({ id: Number(r.id), from: r.from_id, to: r.to_id, createdAt: iso(r.created_at) }));
  return { incoming: all.filter((r) => r.to === playerId), outgoing: all.find((r) => r.from === playerId) ?? null };
}

// Für den roten Punkt am Turnier-Tab.
export async function countIncomingRequests(playerId: string): Promise<number> {
  if (!registrationOpen()) return 0;
  await ready();
  const rows = await getSql()`
    SELECT count(*)::int AS n FROM tournament_requests r
    WHERE tournament = ${T} AND status = 'pending' AND to_id = ${playerId}
      AND NOT EXISTS (SELECT 1 FROM tournament_members m WHERE m.tournament = ${T} AND m.player_id IN (r.from_id, r.to_id))
  `;
  return Number(rows[0]?.n ?? 0);
}

export class TournamentError extends Error {}

async function teamOf(playerId: string): Promise<number | null> {
  const rows = await getSql()`SELECT team_id FROM tournament_members WHERE tournament = ${T} AND player_id = ${playerId}`;
  return rows[0] ? Number(rows[0].team_id) : null;
}

function ensureOpen(now: Date) {
  if (!registrationOpen(now)) throw new TournamentError("Die Anmeldung ist geschlossen – die Teams stehen fest.");
}

// Anfrage verschicken. Gibt die neue Anfrage zurück.
export async function sendRequest(fromId: string, toId: string, now = new Date()): Promise<RequestRow> {
  ensureOpen(now);
  await ready();
  const sql = getSql();
  if (fromId === toId) throw new TournamentError("Du brauchst einen Partner – dich selbst kannst du nicht anfragen.");
  if (await teamOf(fromId)) throw new TournamentError("Du hast schon ein Team.");
  if (await teamOf(toId)) throw new TournamentError("Diese Person hat schon ein Team.");
  const reverse = await sql`
    SELECT 1 FROM tournament_requests
    WHERE tournament = ${T} AND status = 'pending' AND from_id = ${toId} AND to_id = ${fromId}
  `;
  if (reverse.length > 0) throw new TournamentError("Diese Person hat dich schon angefragt – nimm die Anfrage einfach an.");
  try {
    const rows = await sql`
      INSERT INTO tournament_requests (tournament, from_id, to_id) VALUES (${T}, ${fromId}, ${toId})
      RETURNING id, from_id, to_id, created_at
    `;
    const r = rows[0];
    return { id: Number(r.id), from: r.from_id, to: r.to_id, createdAt: iso(r.created_at) };
  } catch (err) {
    if (/unique|duplicate/i.test(String((err as Error)?.message ?? err))) {
      throw new TournamentError("Du hast schon eine offene Anfrage. Zieh sie zurück, um jemand anderen zu fragen.");
    }
    throw err;
  }
}

// Eigene offene Anfrage zurückziehen.
export async function withdrawRequest(fromId: string, now = new Date()): Promise<void> {
  ensureOpen(now);
  await ready();
  const rows = await getSql()`
    UPDATE tournament_requests SET status = 'withdrawn', decided_at = now()
    WHERE tournament = ${T} AND status = 'pending' AND from_id = ${fromId}
    RETURNING id
  `;
  if (rows.length === 0) throw new TournamentError("Diese Anfrage gibt es nicht mehr.");
}

// Eingehende Anfrage ablehnen.
export async function declineRequest(requestId: number, toId: string, now = new Date()): Promise<void> {
  ensureOpen(now);
  await ready();
  const rows = await getSql()`
    UPDATE tournament_requests SET status = 'declined', decided_at = now()
    WHERE tournament = ${T} AND status = 'pending' AND id = ${requestId} AND to_id = ${toId}
    RETURNING id
  `;
  if (rows.length === 0) throw new TournamentError("Diese Anfrage gibt es nicht mehr.");
}

const TEAM_LOCK = 724_002;

// Anfrage annehmen: Team steht fest. Alle anderen offenen Anfragen der
// beiden verfallen. Alles in einer Transaktion – bei gleichzeitigen Klicks
// gewinnt genau einer.
export async function acceptRequest(requestId: number, toId: string, now = new Date()): Promise<TeamRow> {
  ensureOpen(now);
  await ready();
  const sql = getSql();
  const rows = await sql`
    SELECT from_id FROM tournament_requests
    WHERE tournament = ${T} AND status = 'pending' AND id = ${requestId} AND to_id = ${toId}
  `;
  if (rows.length === 0) throw new TournamentError("Diese Anfrage gibt es nicht mehr.");
  const fromId: string = rows[0].from_id;
  if (await teamOf(toId)) throw new TournamentError("Du hast schon ein Team.");
  if (await teamOf(fromId)) throw new TournamentError("Diese Person hat inzwischen schon ein Team.");
  const both = [fromId, toId];
  try {
    const res = await sql.transaction([
      sql`SELECT pg_advisory_xact_lock(${TEAM_LOCK})`,
      // Abbruch (Division durch 0), falls die Anfrage inzwischen weg ist.
      sql`SELECT 1 / (SELECT count(*)::int FROM tournament_requests
        WHERE id = ${requestId} AND status = 'pending' AND to_id = ${toId}) AS ok`,
      sql`
        WITH t AS (
          INSERT INTO tournament_teams (tournament, player1_id, player2_id)
          VALUES (${T}, ${fromId}, ${toId})
          RETURNING id, player1_id, player2_id, created_at
        ), m AS (
          INSERT INTO tournament_members (tournament, player_id, team_id)
          SELECT ${T}, x, t.id FROM t, unnest(${both}::text[]) AS x
        )
        SELECT * FROM t
      `,
      sql`UPDATE tournament_requests SET status = 'accepted', decided_at = now() WHERE id = ${requestId}`,
      sql`
        UPDATE tournament_requests SET status = 'expired', decided_at = now()
        WHERE tournament = ${T} AND status = 'pending'
          AND (from_id = ANY(${both}::text[]) OR to_id = ANY(${both}::text[]))
      `,
    ]);
    const t = res[2][0];
    return { id: Number(t.id), player1: t.player1_id, player2: t.player2_id, createdAt: iso(t.created_at) };
  } catch (err) {
    const msg = String((err as Error)?.message ?? err);
    if (/division by zero/i.test(msg)) throw new TournamentError("Diese Anfrage gibt es nicht mehr.");
    if (/unique|duplicate/i.test(msg)) throw new TournamentError("Einer von euch hat inzwischen schon ein Team.");
    throw err;
  }
}
