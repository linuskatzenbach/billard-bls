import { exportAll } from "./db";

// Sicherung als JSON-Datei. Enthält alles, was man braucht, um die App bei
// Datenverlust wiederherzustellen (Spieler, Spiele, Widersprüche).
export async function buildBackup() {
  const data = await exportAll();
  const createdAt = new Date().toISOString();
  const day = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date());
  const json = JSON.stringify(
    {
      app: "Billard BLS",
      version: 1,
      created_at: createdAt,
      counts: {
        players: data.players.length,
        matches: data.matches.length,
        disputes: data.disputes.length,
      },
      ...data,
    },
    null,
    1
  );
  return { json, filename: `billard-bls-sicherung-${day}.json`, counts: { players: data.players.length, matches: data.matches.length } };
}
