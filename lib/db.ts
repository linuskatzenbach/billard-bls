import { cacheLife, cacheTag } from "next/cache";
import { getSql, type Query, type Row } from "./sql";
import { SEED_PLAYERS, SEED_EMAILS, SEED_ADMINS } from "./players";
import { START_ELO, calculateNewElo } from "./elo";

// Alle Daten, die für Rangliste, Profile und Statistiken gebraucht werden,
// stecken in einem einzigen zwischengespeicherten Paket ("World"). Es wird
// nur neu aus der Datenbank geladen, wenn sich etwas geändert hat (neues
// Spiel, gelöschtes Spiel, neuer/geänderter Spieler). Das schont die
// Gratis-Limits von Neon und Vercel.
export const WORLD_TAG = "world";

export type PlayerRow = {
  id: string;
  name: string;
  email: string | null;
  cohort: string | null;
  hidden: boolean;
  founder: boolean;
  is_admin: boolean;
  created_at: string;
};

export type MatchRow = {
  id: number;
  winner_id: string;
  loser_id: string;
  winner_elo_before: number;
  loser_elo_before: number;
  winner_elo_after: number;
  loser_elo_after: number;
  created_at: string; // ISO
  entered_by: string | null;
};

// Für bestehenden Code, der nur die Elo-Felder braucht.
export type MatchRecord = MatchRow;

export type World = {
  players: PlayerRow[];
  matches: MatchRow[]; // chronologisch, älteste zuerst
};

const iso = (v: unknown): string =>
  v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString();

let schemaReady: Promise<void> | null = null;

async function ensureSchema(): Promise<void> {
  const sql = getSql();

  // Hinweis: DEFAULT-Werte als feste Literale, nicht als ${...}.
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
  await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS entered_by TEXT;`;
  await sql`
    CREATE TABLE IF NOT EXISTS migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      cohort TEXT,
      hidden BOOLEAN NOT NULL DEFAULT false,
      founder BOOLEAN NOT NULL DEFAULT false,
      is_admin BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS players_name_lower ON players (lower(name));`;
  // Neue Anmeldungen für den roten Punkt beim Admin: bestehende Spieler gelten
  // als gesehen, neu angelegte starten als ungesehen.
  await sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS admin_seen BOOLEAN NOT NULL DEFAULT true;`;
  await sql`ALTER TABLE players ALTER COLUMN admin_seen SET DEFAULT false;`;
  await sql`
    CREATE TABLE IF NOT EXISTS login_tokens (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      code_hash TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS disputes (
      id SERIAL PRIMARY KEY,
      match_id INTEGER NOT NULL,
      winner_id TEXT NOT NULL,
      loser_id TEXT NOT NULL,
      entered_by TEXT,
      played_at TIMESTAMPTZ NOT NULL,
      disputed_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      seen BOOLEAN NOT NULL DEFAULT false
    );
  `;

  // Testspiel Julian gegen Linus vom 20.10.2026 entfernen (bereits erledigt).
  await deleteMatchOnce("2026-10-20-testspiel-julian-linus", ["julian", "linus"], "2026-10-20T19:40:00Z");

  // Einmalig: die bisher im Code eingetragenen Spieler in die Datenbank
  // übernehmen. Danach werden Spieler nur noch in der Datenbank verwaltet.
  const seeded = await sql`SELECT 1 FROM migrations WHERE name = 'players-seed-v1';`;
  if (seeded.length === 0) {
    const queries: Query[] = [];
    for (const p of SEED_PLAYERS) {
      const email = SEED_EMAILS[p.id] ?? null;
      queries.push(sql`
        INSERT INTO players (id, name, email, hidden, founder, is_admin, admin_seen)
        VALUES (${p.id}, ${p.name}, ${email}, ${p.hidden ?? false}, true, ${SEED_ADMINS.includes(p.id)}, true)
        ON CONFLICT (id) DO NOTHING
      `);
      queries.push(sql`
        INSERT INTO player_elo (id, elo) VALUES (${p.id}, ${START_ELO}) ON CONFLICT (id) DO NOTHING
      `);
    }
    queries.push(sql`INSERT INTO migrations (name) VALUES ('players-seed-v1')`);
    try {
      await sql.transaction(queries);
    } catch (err) {
      const again = await sql`SELECT 1 FROM migrations WHERE name = 'players-seed-v1';`;
      if (again.length === 0) throw err;
    }
  }
}

// Einmalig: Julian möchte wieder öffentlich in allen Ranglisten stehen.
async function unhideJulian(): Promise<void> {
  const sql = getSql();
  const done = await sql`SELECT 1 FROM migrations WHERE name = 'unhide-julian';`;
  if (done.length > 0) return;
  try {
    await sql.transaction([
      sql`UPDATE players SET hidden = false WHERE id = 'julian'`,
      sql`INSERT INTO migrations (name) VALUES ('unhide-julian')`,
    ]);
  } catch (err) {
    const again = await sql`SELECT 1 FROM migrations WHERE name = 'unhide-julian';`;
    if (again.length === 0) throw err;
  }
}

// Einmalig: "Promotion" und "Mitarbeiter" heißen jetzt zusammen "WissMit".
async function wissMit(): Promise<void> {
  const sql = getSql();
  const done = await sql`SELECT 1 FROM migrations WHERE name = 'cohort-wissmit';`;
  if (done.length > 0) return;
  try {
    await sql.transaction([
      sql`UPDATE players SET cohort = 'WissMit' WHERE cohort IN ('Promotion', 'Mitarbeiter')`,
      sql`INSERT INTO migrations (name) VALUES ('cohort-wissmit')`,
    ]);
  } catch (err) {
    const again = await sql`SELECT 1 FROM migrations WHERE name = 'cohort-wissmit';`;
    if (again.length === 0) throw err;
  }
}

// Einmalig: alle Spieler aus der Startliste sind Jahrgang 2022.
async function founderCohort(): Promise<void> {
  const sql = getSql();
  const done = await sql`SELECT 1 FROM migrations WHERE name = 'founder-cohort-2022';`;
  if (done.length > 0) return;
  try {
    await sql.transaction([
      sql`UPDATE players SET cohort = '2022' WHERE founder = true AND cohort IS NULL`,
      sql`INSERT INTO migrations (name) VALUES ('founder-cohort-2022')`,
    ]);
  } catch (err) {
    const again = await sql`SELECT 1 FROM migrations WHERE name = 'founder-cohort-2022';`;
    if (again.length === 0) throw err;
  }
}

// Einmalig: Tobias heißt in der App jetzt "Tobi".
async function renameTobi(): Promise<void> {
  const sql = getSql();
  const done = await sql`SELECT 1 FROM migrations WHERE name = 'rename-tobi';`;
  if (done.length > 0) return;
  try {
    await sql.transaction([
      sql`UPDATE players SET name = 'Tobi' WHERE id = 'tobias'`,
      sql`INSERT INTO migrations (name) VALUES ('rename-tobi')`,
    ]);
  } catch (err) {
    const again = await sql`SELECT 1 FROM migrations WHERE name = 'rename-tobi';`;
    if (again.length === 0) throw err;
  }
}

// Einmalig: Tobis Sieg vom 29.10.2026 um 14:04 war nicht gegen Linus,
// sondern gegen Jannik. Verlierer tauschen und Elo neu rechnen.
async function fixTobiJannik(): Promise<void> {
  const sql = getSql();
  const name = "2026-10-29-tobi-gegen-jannik-statt-linus";
  const done = await sql`SELECT 1 FROM migrations WHERE name = ${name};`;
  if (done.length > 0) return;
  const rows = await sql`
    SELECT id FROM matches
    WHERE winner_id = 'tobias' AND loser_id = 'linus'
      AND created_at >= '2026-10-29T13:00:00Z' AND created_at < '2026-10-29T13:10:00Z'
    ORDER BY created_at ASC, id ASC
  `;
  if (rows.length !== 1) {
    console.error(`[${name}] erwartet genau 1 Spiel, gefunden: ${rows.length} – nichts geändert`);
    return;
  }
  const mark = sql`INSERT INTO migrations (name) VALUES (${name})`;
  try {
    await changeLoserRecalc(Number(rows[0].id), "jannik", [mark]);
  } catch (err) {
    const again = await sql`SELECT 1 FROM migrations WHERE name = ${name};`;
    if (again.length === 0) throw err;
  }
}

export function ready(): Promise<void> {
  if (!schemaReady) {
    schemaReady = ensureSchema().then(founderCohort).then(unhideJulian).then(wissMit).then(renameTobi).then(fixTobiJannik).catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

// ---------------------------------------------------------------------------
// Lesen (zwischengespeichert)

async function loadWorld(): Promise<World> {
  await ready();
  const sql = getSql();
  const [players, matches] = await Promise.all([
    sql`
      SELECT id, name, email, cohort, hidden, founder, is_admin, created_at
      FROM players ORDER BY created_at ASC, id ASC
    `,
    sql`
      SELECT id, winner_id, loser_id, winner_elo_before, loser_elo_before,
             winner_elo_after, loser_elo_after, created_at, entered_by
      FROM matches ORDER BY created_at ASC, id ASC
    `,
  ]);
  return {
    players: players.map((p) => ({
      id: p.id,
      name: p.name,
      email: p.email ?? null,
      cohort: p.cohort ?? null,
      hidden: Boolean(p.hidden),
      founder: Boolean(p.founder),
      is_admin: Boolean(p.is_admin),
      created_at: iso(p.created_at),
    })),
    matches: matches.map((m) => ({
      id: Number(m.id),
      winner_id: m.winner_id,
      loser_id: m.loser_id,
      winner_elo_before: Number(m.winner_elo_before),
      loser_elo_before: Number(m.loser_elo_before),
      winner_elo_after: Number(m.winner_elo_after),
      loser_elo_after: Number(m.loser_elo_after),
      created_at: iso(m.created_at),
      entered_by: m.entered_by ?? null,
    })),
  };
}

export async function getWorld(): Promise<World> {
  "use cache: remote";
  cacheTag(WORLD_TAG);
  // Nach jeder Änderung wird der Speicher sofort verworfen (refreshWorld).
  // Zur Sicherheit wird er außerdem spätestens jede Minute im Hintergrund
  // erneuert, falls einmal eine Änderung an der App vorbei passiert.
  cacheLife({ stale: 30, revalidate: 60, expire: 3600 });
  return loadWorld();
}

// ---------------------------------------------------------------------------
// Spieler (direkt aus der Datenbank, nicht zwischengespeichert)

const mapPlayer = (p: Row): PlayerRow => ({
  id: p.id,
  name: p.name,
  email: p.email ?? null,
  cohort: p.cohort ?? null,
  hidden: Boolean(p.hidden),
  founder: Boolean(p.founder),
  is_admin: Boolean(p.is_admin),
  created_at: iso(p.created_at),
});

export async function getPlayerById(id: string): Promise<PlayerRow | null> {
  await ready();
  const rows = await getSql()`SELECT * FROM players WHERE id = ${id}`;
  return rows[0] ? mapPlayer(rows[0]) : null;
}

export async function getPlayerByEmail(email: string): Promise<PlayerRow | null> {
  await ready();
  const rows = await getSql()`SELECT * FROM players WHERE lower(email) = lower(${email})`;
  return rows[0] ? mapPlayer(rows[0]) : null;
}

export async function isNameTaken(name: string, exceptId?: string): Promise<boolean> {
  await ready();
  const rows = await getSql()`
    SELECT id FROM players WHERE lower(name) = lower(${name.trim()})
  `;
  return rows.some((r) => r.id !== exceptId);
}

// Freie Spieler-ID aus der Mail ableiten: vorname.nachname → vorname-nachname
export async function createPlayer(params: {
  email: string;
  name: string;
  cohort: string | null;
}): Promise<PlayerRow> {
  await ready();
  const sql = getSql();
  const base =
    params.email
      .split("@")[0]
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "spieler";
  let id = base;
  for (let i = 2; ; i++) {
    const taken = await sql`SELECT 1 FROM players WHERE id = ${id}`;
    if (taken.length === 0) break;
    id = `${base}-${i}`;
  }
  await sql.transaction([
    sql`
      INSERT INTO players (id, name, email, cohort)
      VALUES (${id}, ${params.name.trim()}, ${params.email.toLowerCase()}, ${params.cohort})
    `,
    sql`INSERT INTO player_elo (id, elo) VALUES (${id}, ${START_ELO}) ON CONFLICT (id) DO NOTHING`,
  ]);
  return (await getPlayerById(id))!;
}

export async function updatePlayer(
  id: string,
  fields: { name?: string; email?: string | null; hidden?: boolean; cohort?: string | null }
): Promise<void> {
  await ready();
  const sql = getSql();
  const cur = await getPlayerById(id);
  if (!cur) throw new Error("Unbekannter Spieler.");
  const name = fields.name !== undefined ? fields.name.trim() : cur.name;
  const email =
    fields.email !== undefined ? (fields.email ? fields.email.trim().toLowerCase() : null) : cur.email;
  const hidden = fields.hidden !== undefined ? fields.hidden : cur.hidden;
  const cohort = fields.cohort !== undefined ? fields.cohort : cur.cohort;
  await sql`
    UPDATE players SET name = ${name}, email = ${email}, hidden = ${hidden}, cohort = ${cohort}
    WHERE id = ${id}
  `;
}

// Zeitpunkt, bis zu dem der Spieler seine Benachrichtigungen gesehen hat.
export async function getSeenAt(id: string): Promise<string | null> {
  await ready();
  const rows = await getSql()`SELECT seen_at FROM players WHERE id = ${id}`;
  return rows[0] ? iso(rows[0].seen_at) : null;
}

export async function markSeen(id: string): Promise<void> {
  await ready();
  await getSql()`UPDATE players SET seen_at = now() WHERE id = ${id}`;
}

// Anzahl neuer Spiele, die jemand anderes mit diesem Spieler eingetragen hat.
export async function countUnread(id: string): Promise<number> {
  await ready();
  const rows = await getSql()`
    SELECT count(*)::int AS n FROM matches m, players p
    WHERE p.id = ${id}
      AND (m.winner_id = ${id} OR m.loser_id = ${id})
      AND m.entered_by IS NOT NULL AND m.entered_by <> ${id}
      AND m.created_at > p.seen_at
  `;
  return Number(rows[0]?.n ?? 0);
}

// ---------------------------------------------------------------------------
// Anmeldung

export async function createLoginToken(params: {
  email: string;
  tokenHash: string;
  codeHash: string;
  minutes: number;
}): Promise<void> {
  await ready();
  const sql = getSql();
  const expires = new Date(Date.now() + params.minutes * 60_000).toISOString();
  await sql.transaction([
    // Alte, ungenutzte Links derselben Adresse werden ungültig.
    sql`UPDATE login_tokens SET used_at = now() WHERE email = ${params.email} AND used_at IS NULL`,
    sql`
      INSERT INTO login_tokens (email, token_hash, code_hash, expires_at)
      VALUES (${params.email}, ${params.tokenHash}, ${params.codeHash}, ${expires})
    `,
    sql`DELETE FROM login_tokens WHERE created_at < now() - interval '2 days'`,
  ]);
}

export async function recentTokenCount(email: string, seconds: number): Promise<number> {
  await ready();
  const since = new Date(Date.now() - seconds * 1000).toISOString();
  const rows = await getSql()`
    SELECT count(*)::int AS n FROM login_tokens WHERE email = ${email} AND created_at > ${since}
  `;
  return Number(rows[0]?.n ?? 0);
}

// Löst einen Link ein. Gibt die Mail-Adresse zurück oder null.
export async function consumeToken(tokenHash: string): Promise<string | null> {
  await ready();
  const rows = await getSql()`
    UPDATE login_tokens SET used_at = now()
    WHERE token_hash = ${tokenHash} AND used_at IS NULL AND expires_at > now()
    RETURNING email
  `;
  return rows[0]?.email ?? null;
}

// Prüft einen 6-stelligen Code. Nach 5 Fehlversuchen ist der Code gesperrt.
export async function consumeCode(email: string, codeHash: string): Promise<boolean> {
  await ready();
  const sql = getSql();
  const ok = await sql`
    UPDATE login_tokens SET used_at = now()
    WHERE email = ${email} AND code_hash = ${codeHash}
      AND used_at IS NULL AND expires_at > now() AND attempts < 5
    RETURNING id
  `;
  if (ok.length > 0) return true;
  await sql`
    UPDATE login_tokens SET attempts = attempts + 1
    WHERE email = ${email} AND used_at IS NULL AND expires_at > now()
  `;
  return false;
}

// ---------------------------------------------------------------------------
// Spiele

export async function recordMatch(params: {
  winnerId: string;
  loserId: string;
  enteredBy: string | null;
}): Promise<MatchRow> {
  await ready();
  const sql = getSql();
  const { winnerId, loserId, enteredBy } = params;
  const rows = await sql`SELECT id, elo FROM player_elo WHERE id = ANY(${[winnerId, loserId]})`;
  const eloOf = (id: string) => Number(rows.find((r) => r.id === id)?.elo ?? START_ELO);
  const w = eloOf(winnerId);
  const l = eloOf(loserId);
  const { newWinnerElo, newLoserElo } = calculateNewElo(w, l);

  const [, , inserted] = await sql.transaction([
    sql`
      INSERT INTO player_elo (id, elo) VALUES (${winnerId}, ${newWinnerElo})
      ON CONFLICT (id) DO UPDATE SET elo = EXCLUDED.elo
    `,
    sql`
      INSERT INTO player_elo (id, elo) VALUES (${loserId}, ${newLoserElo})
      ON CONFLICT (id) DO UPDATE SET elo = EXCLUDED.elo
    `,
    sql`
      INSERT INTO matches (
        winner_id, loser_id, winner_elo_before, loser_elo_before,
        winner_elo_after, loser_elo_after, entered_by
      ) VALUES (${winnerId}, ${loserId}, ${w}, ${l}, ${newWinnerElo}, ${newLoserElo}, ${enteredBy})
      RETURNING id, created_at
    `,
  ]);
  return {
    id: Number(inserted[0].id),
    winner_id: winnerId,
    loser_id: loserId,
    winner_elo_before: w,
    loser_elo_before: l,
    winner_elo_after: newWinnerElo,
    loser_elo_after: newLoserElo,
    created_at: iso(inserted[0].created_at),
    entered_by: enteredBy,
  };
}

export async function getMatch(id: number): Promise<MatchRow | null> {
  await ready();
  const rows = await getSql()`SELECT * FROM matches WHERE id = ${id}`;
  const m = rows[0];
  if (!m) return null;
  return {
    id: Number(m.id),
    winner_id: m.winner_id,
    loser_id: m.loser_id,
    winner_elo_before: Number(m.winner_elo_before),
    loser_elo_before: Number(m.loser_elo_before),
    winner_elo_after: Number(m.winner_elo_after),
    loser_elo_after: Number(m.loser_elo_after),
    created_at: iso(m.created_at),
    entered_by: m.entered_by ?? null,
  };
}

// Löscht ein Spiel und rechnet die Elo aller späteren Spiele neu.
// extra: weitere Abfragen, die in derselben Transaktion laufen sollen.
async function deleteMatchRecalc(matchId: number, extra: Query[] = []): Promise<boolean> {
  return recalcAround(matchId, null, extra);
}

// Wie oben, aber das Spiel bleibt stehen – nur der Verlierer wird getauscht
// (z. B. falscher Gegner eingetragen). Elo ab diesem Spiel wird neu gerechnet.
async function changeLoserRecalc(matchId: number, newLoserId: string, extra: Query[] = []): Promise<boolean> {
  return recalcAround(matchId, newLoserId, extra);
}

async function recalcAround(matchId: number, newLoserId: string | null, extra: Query[]): Promise<boolean> {
  const sql = getSql();
  const all = (await sql`
    SELECT id, winner_id, loser_id, winner_elo_after, loser_elo_after
    FROM matches ORDER BY created_at ASC, id ASC
  `) as { id: number; winner_id: string; loser_id: string; winner_elo_after: number; loser_elo_after: number }[];
  const idx = all.findIndex((m) => Number(m.id) === matchId);
  if (idx < 0) return false;

  const queries: Query[] = [...extra];
  if (newLoserId === null) queries.push(sql`DELETE FROM matches WHERE id = ${matchId}`);
  else queries.push(sql`UPDATE matches SET loser_id = ${newLoserId} WHERE id = ${matchId}`);
  const elo: Record<string, number> = {};
  for (const m of all.slice(0, idx)) {
    elo[m.winner_id] = Number(m.winner_elo_after);
    elo[m.loser_id] = Number(m.loser_elo_after);
  }
  const touched = new Set([all[idx].winner_id, all[idx].loser_id]);
  const rest = newLoserId === null ? all.slice(idx + 1) : [{ ...all[idx], loser_id: newLoserId }, ...all.slice(idx + 1)];
  for (const m of rest) {
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
  await sql.transaction(queries);
  return true;
}

async function deleteMatchOnce(name: string, [a, b]: [string, string], before: string): Promise<void> {
  const sql = getSql();
  const done = await sql`SELECT 1 FROM migrations WHERE name = ${name};`;
  if (done.length > 0) return;
  const rows = await sql`
    SELECT id FROM matches
    WHERE ((winner_id = ${a} AND loser_id = ${b}) OR (winner_id = ${b} AND loser_id = ${a}))
      AND created_at < ${before}
    ORDER BY created_at DESC, id DESC LIMIT 1
  `;
  const mark = sql`INSERT INTO migrations (name) VALUES (${name})`;
  try {
    if (rows[0]) await deleteMatchRecalc(Number(rows[0].id), [mark]);
    else await mark;
  } catch (err) {
    const again = await sql`SELECT 1 FROM migrations WHERE name = ${name};`;
    if (again.length === 0) throw err;
  }
}

// "Stimmt nicht": Spiel löschen und für den Admin festhalten.
export async function disputeMatch(matchId: number, disputedBy: string): Promise<MatchRow | null> {
  await ready();
  const sql = getSql();
  const m = await getMatch(matchId);
  if (!m) return null;
  const ok = await deleteMatchRecalc(matchId, [
    sql`
      INSERT INTO disputes (match_id, winner_id, loser_id, entered_by, played_at, disputed_by)
      VALUES (${m.id}, ${m.winner_id}, ${m.loser_id}, ${m.entered_by}, ${m.created_at}, ${disputedBy})
    `,
  ]);
  return ok ? m : null;
}

export type DisputeRow = {
  id: number;
  match_id: number;
  winner_id: string;
  loser_id: string;
  entered_by: string | null;
  played_at: string;
  disputed_by: string;
  created_at: string;
  seen: boolean;
};

export async function getDisputes(): Promise<DisputeRow[]> {
  await ready();
  const rows = await getSql()`SELECT * FROM disputes ORDER BY created_at DESC LIMIT 50`;
  return rows.map((d) => ({
    id: Number(d.id),
    match_id: Number(d.match_id),
    winner_id: d.winner_id,
    loser_id: d.loser_id,
    entered_by: d.entered_by ?? null,
    played_at: iso(d.played_at),
    disputed_by: d.disputed_by,
    created_at: iso(d.created_at),
    seen: Boolean(d.seen),
  }));
}

export async function markDisputesSeen(): Promise<void> {
  await ready();
  await getSql()`UPDATE disputes SET seen = true WHERE seen = false`;
}

// Neue Anmeldungen, die der Admin noch nicht gesehen hat.
export async function getUnseenSignups(): Promise<{ id: string; name: string }[]> {
  await ready();
  const rows = await getSql()`SELECT id, name FROM players WHERE admin_seen = false ORDER BY created_at ASC`;
  return rows.map((r) => ({ id: String(r.id), name: String(r.name) }));
}

export async function countUnseenSignups(): Promise<number> {
  await ready();
  const rows = await getSql()`SELECT count(*)::int AS n FROM players WHERE admin_seen = false`;
  return Number(rows[0]?.n ?? 0);
}

export async function markSignupsSeen(): Promise<void> {
  await ready();
  await getSql()`UPDATE players SET admin_seen = true WHERE admin_seen = false`;
}

export async function countUnseenDisputes(): Promise<number> {
  await ready();
  const rows = await getSql()`SELECT count(*)::int AS n FROM disputes WHERE seen = false`;
  return Number(rows[0]?.n ?? 0);
}
