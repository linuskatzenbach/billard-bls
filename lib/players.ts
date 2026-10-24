// Startliste der Spieler aus der Zeit vor der Uni-Öffnung.
//
// Diese Liste wird nur EINMAL in die Datenbank übernommen (Tabelle
// "players"). Danach legen sich Spieler selbst über ihre Uni-Mail an, und
// Änderungen (Name, Mail, ausblenden) macht der Admin im Admin-Bereich.
// Wer hier steht, bekommt das Sonderabzeichen "Gründungsmitglied".

export type SeedPlayer = {
  id: string;
  name: string;
  hidden?: boolean;
};

export const SEED_PLAYERS: SeedPlayer[] = [
  { id: "linus", name: "Linus" },
  { id: "julian", name: "Julian" },
  { id: "jannik", name: "Jannik" },
  { id: "benedikt", name: "Benedikt" },
  { id: "philip", name: "Philip" },
  { id: "tobias", name: "Tobias" },
];

// Uni-Mails, die von Anfang an mit einem Spieler verknüpft sind. Wer sich
// mit dieser Adresse anmeldet, übernimmt den bestehenden Spieler. Weitere
// Adressen trägt der Admin im Admin-Bereich ein.
export const SEED_EMAILS: Record<string, string> = {
  linus: "linus.katzenbach@law-school.de",
};

// Spieler mit Zugang zum Admin-Bereich.
export const SEED_ADMINS = ["linus"];
