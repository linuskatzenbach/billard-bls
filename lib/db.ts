import { neon } from "@neondatabase/serverless";
import { PLAYERS } from "./players";
import { START_ELO, calculateNewElo } from "./elo";

// Vercel setzt beim Verbinden einer Neon-Postgres-Datenbank automatisch
// eine dieser Umgebungsvariablen (üblicherweise DATABASE_URL). Die Prüfung
// erfolgt erst beim ersten echten Datenbankzugriff (nicht beim Modul-Import),
// damit "next build" auch ohne gesetzte Umgebungsvariable funktioniert.
function getSql() {
  const connectionString =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_PRISMA_URL;

  if (!connectionString) {
    throw new Error(
      "Keine Datenbank-Verbindung gefunden. Bitte in Vercel unter Storage eine Postgres-Datenbank (Neon) mit diesem Projekt verbinden."
    );
  }

  return neon(connectionString);
}

let schemaReady: Promise<void> | null = null;

// Legt die Tabellen beim allerersten Aufruf an (falls nicht vorhanden) und
// sorgt dafür, dass jeder Spieler aus lib/players.ts einen Elo-Eintrag hat.
// Wird bei jeder Anfrage aufgerufen, ist aber dank "IF NOT EXISTS" /
// "ON CONFLICT DO NOTHING" sehr billig, sobald alles existiert.
async function ensureSchema(): Promise<void> {
  const sql = getSql();

  // Hinweis: Bei CREATE TABLE darf der DEFAULT-Wert keine gebundene
  // Query-Variable sein (Postgres/Neon lehnt das mit "bind message
  // supplies ... parameters, but prepared statement requires 0" ab).
  // Deshalb hier als fester Literal-Wert statt über ${START_ELO}.
  await sql`
    CREATE TABLE IF NOT EXISTS player_elo (
      id TEXT PRIMARY KEY,
      elo INTEGER NOT NULL DEFAULT 1500
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS matches (
      id SERIAL PRIMARY KEY,
      winner_id TEXT NOT NULL,
      loser_id TEXT NOT NULL,
      winner_elo_before INTEGER NOT NULL,
      loser_elo_before INTEGER NOT NULL,
      winner_elo_after INTEGER NOT NULL,
      loser_elo_after INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  for (const player of PLAYERS) {
    await sql`
      INSERT INTO player_elo (id, elo)
      VALUES (${player.id}, ${START_ELO})
      ON CONFLICT (id) DO NOTHING;
    `;
  }

  await sql`
    CREATE TABLE IF NOT EXISTS migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  // Testspiel Julian gegen Linus vom 20.10.2026 entfernen.
  await deleteMatchOnce(
    "2026-10-20-testspiel-julian-linus",
    ["julian", "linus"],
    "2026-10-20T19:40:00Z"
  );
}

// Löscht genau einmal (über die Tabelle "migrations" abgesichert) das
// letzte Spiel zwischen den beiden Spielern vor dem Stichzeitpunkt und
// rechnet die Elo-Zahlen aller späteren Spiele neu.
async function deleteMatchOnce(
  name: string,
  [a, b]: [string, string],
  before: string
): Promise<void> {
  const sql = getSql();
  const done = await sql`SELECT 1 FROM migrations WHERE name = ${name};`;
  if (done.length > 0) return;

  const all = (await sql`
    SELECT id, winner_id, loser_id, winner_elo_after, loser_elo_after,
           created_at < ${before} AS early
    FROM matches
    ORDER BY created_at ASC, id ASC;
  `) as {
    id: number;
    winner_id: string;
    loser_id: string;
    winner_elo_after: number;
    loser_elo_after: number;
    early: boolean;
  }[];
  let idx = -1;
  all.forEach((m, i) => {
    const pair = (m.winner_id === a && m.loser_id === b) || (m.winner_id === b && m.loser_id === a);
    if (pair && m.early) idx = i;
  });

  // Ohne ON CONFLICT: Läuft eine zweite Instanz gleichzeitig, schlägt ihre
  // Transaktion hier fehl und es wird nichts doppelt gelöscht.
  const queries = [sql`INSERT INTO migrations (name) VALUES (${name})`];

  if (idx >= 0) {
    queries.push(sql`DELETE FROM matches WHERE id = ${all[idx].id}`);

    // Stand jedes Spielers direkt vor dem gelöschten Spiel; die Spiele
    // davor bleiben unverändert, nur die danach werden neu berechnet.
    const elo: Record<string, number> = {};
    for (const m of all.slice(0, idx)) {
      elo[m.winner_id] = m.winner_elo_after;
      elo[m.loser_id] = m.loser_elo_after;
    }
    const touched = new Set([a, b]);
    for (const m of all.slice(idx + 1)) {
      const w = elo[m.winner_id] ?? START_ELO;
      const l = elo[m.loser_id] ?? START_ELO;
      const { newWinnerElo, newLoserElo } = calculateNewElo(w, l);
      elo[m.winner_id] = newWinnerElo;
      elo[m.loser_id] = newLoserElo;
      touched.add(m.winner_id).add(m.loser_id);
      queries.push(sql`
        UPDATE matches SET
          winner_elo_before = ${w}, loser_elo_before = ${l},
          winner_elo_after = ${newWinnerElo}, loser_elo_after = ${newLoserElo}
        WHERE id = ${m.id}
      `);
    }
    for (const id of touched) {
      queries.push(sql`UPDATE player_elo SET elo = ${elo[id] ?? START_ELO} WHERE id = ${id}`);
    }
  }

  try {
    await sql.transaction(queries);
  } catch (err) {
    const again = await sql`SELECT 1 FROM migrations WHERE name = ${name};`;
    if (again.length === 0) throw err;
  }
}

// Wird an den Anfang jeder DB-Aktion gestellt; stellt sicher, dass das
// Schema nur einmal pro laufender Serverless-Instanz aufgebaut wird.
export function ready(): Promise<void> {
  if (!schemaReady) {
    schemaReady = ensureSchema();
  }
  return schemaReady;
}

export type LeaderboardEntry = {
  id: string;
  elo: number;
};

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  await ready();
  const sql = getSql();
  const currentIds = PLAYERS.filter((p) => !p.hidden).map((p) => p.id);
  const rows = await sql`
    SELECT id, elo FROM player_elo
    WHERE id = ANY(${currentIds})
    ORDER BY elo DESC;
  `;
  return rows as LeaderboardEntry[];
}

export type MatchRecord = {
  winner_id: string;
  loser_id: string;
  winner_elo_before: number;
  loser_elo_before: number;
  winner_elo_after: number;
  loser_elo_after: number;
  created_at: string;
};

export async function getRecentMatches(limit = 20): Promise<MatchRecord[]> {
  await ready();
  const sql = getSql();
  const rows = await sql`
    SELECT winner_id, loser_id, winner_elo_before, loser_elo_before,
           winner_elo_after, loser_elo_after, created_at
    FROM matches
    ORDER BY created_at DESC
    LIMIT ${limit};
  `;
  return rows as MatchRecord[];
}

export type PlayerMatch = {
  opponent_id: string;
  won: boolean;
  elo_before: number;
  elo_after: number;
  created_at: string;
};

export async function getMatchesForPlayer(
  playerId: string
): Promise<PlayerMatch[]> {
  await ready();
  const sql = getSql();
  const rows = (await sql`
    SELECT winner_id, loser_id, winner_elo_before, loser_elo_before,
           winner_elo_after, loser_elo_after, created_at
    FROM matches
    WHERE winner_id = ${playerId} OR loser_id = ${playerId}
    ORDER BY created_at ASC;
  `) as MatchRecord[];

  return rows.map((m) => {
    const won = m.winner_id === playerId;
    return {
      opponent_id: won ? m.loser_id : m.winner_id,
      won,
      elo_before: won ? m.winner_elo_before : m.loser_elo_before,
      elo_after: won ? m.winner_elo_after : m.loser_elo_after,
      created_at: m.created_at,
    };
  });
}

export async function getElo(playerId: string): Promise<number> {
  await ready();
  const sql = getSql();
  const rows = (await sql`
    SELECT elo FROM player_elo WHERE id = ${playerId};
  `) as { elo: number }[];
  if (rows.length === 0) {
    throw new Error(`Unbekannter Spieler: ${playerId}`);
  }
  return rows[0].elo;
}

export async function recordMatch(params: {
  winnerId: string;
  loserId: string;
  winnerEloBefore: number;
  loserEloBefore: number;
  winnerEloAfter: number;
  loserEloAfter: number;
}): Promise<void> {
  await ready();
  const sql = getSql();
  const {
    winnerId,
    loserId,
    winnerEloBefore,
    loserEloBefore,
    winnerEloAfter,
    loserEloAfter,
  } = params;

  await sql`
    UPDATE player_elo SET elo = ${winnerEloAfter} WHERE id = ${winnerId};
  `;
  await sql`
    UPDATE player_elo SET elo = ${loserEloAfter} WHERE id = ${loserId};
  `;
  await sql`
    INSERT INTO matches (
      winner_id, loser_id,
      winner_elo_before, loser_elo_before,
      winner_elo_after, loser_elo_after
    ) VALUES (
      ${winnerId}, ${loserId},
      ${winnerEloBefore}, ${loserEloBefore},
      ${winnerEloAfter}, ${loserEloAfter}
    );
  `;
}

// Aktuelle Siegesserie je Spieler: Anzahl Siege in Folge seit der letzten Niederlage.
export async function getCurrentStreaks(): Promise<Record<string, number>> {
  await ready();
  const sql = getSql();
  const rows = (await sql`
    SELECT winner_id, loser_id FROM matches
    ORDER BY created_at ASC, id ASC;
  `) as { winner_id: string; loser_id: string }[];

  const streaks: Record<string, number> = {};
  for (const m of rows) {
    streaks[m.winner_id] = (streaks[m.winner_id] ?? 0) + 1;
    streaks[m.loser_id] = 0;
  }
  return streaks;
}

// Alle Spiele chronologisch (älteste zuerst) – Grundlage für die Statistiken.
export async function getAllMatches(): Promise<MatchRecord[]> {
  await ready();
  const sql = getSql();
  const rows = await sql`
    SELECT winner_id, loser_id, winner_elo_before, loser_elo_before,
           winner_elo_after, loser_elo_after, created_at
    FROM matches
    ORDER BY created_at ASC, id ASC;
  `;
  return rows as MatchRecord[];
}
