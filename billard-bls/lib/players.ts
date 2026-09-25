// Hier trägst DU als Entwickler die Spieler ein.
// Besucher der Website können diese Liste NICHT über die Website verändern.
//
// "id" muss eindeutig sein (keine Leerzeichen/Umlaute, z.B. "linus", "max_m").
// "name" ist der Anzeigename auf der Website.
//
// Neuen Spieler hinzufügen: einfach eine neue Zeile einfügen, committen und
// zu GitHub pushen - Vercel deployt automatisch neu. Der neue Spieler
// bekommt beim ersten Aufruf der Website automatisch eine Start-Elo von 1500.

export type Player = {
  id: string;
  name: string;
};

export const PLAYERS: Player[] = [
  { id: "linus", name: "Linus" },
  { id: "spieler2", name: "Spieler 2" },
  { id: "spieler3", name: "Spieler 3" },
  { id: "spieler4", name: "Spieler 4" },
];

export function getPlayerName(id: string): string {
  return PLAYERS.find((p) => p.id === id)?.name ?? id;
}
