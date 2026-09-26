import { neon } from "@neondatabase/serverless";
import { PLAYERS } from "./players";
import { START_ELO } from "./elo";

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
  const currentIds = PLAYERS.map((p) => p.id);
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
