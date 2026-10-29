// Regeln für Anzeigenamen und die Jahrgangs-Auswahl beim Profil-Anlegen.

export const COHORTS = [
  "2018",
  "2019",
  "2020",
  "2021",
  "2022",
  "2023",
  "2024",
  "2025",
  "2026",
  "MLB",
  "WissMit",
];

// Kurzform für Ranglisten: "2022" → "Jg. 2022"
export function cohortShort(c: string | null): string {
  if (!c) return "";
  return /^\d{4}$/.test(c) ? `Jg. ${c}` : c;
}

// Langform für das Profil: "2022" → "Jahrgang 2022"
export function cohortLong(c: string | null): string {
  if (!c) return "";
  return /^\d{4}$/.test(c) ? `Jahrgang ${c}` : c;
}

export function validateName(name: string): string | null {
  if (name.length < 2) return "Der Name ist zu kurz.";
  if (name.length > 20) return "Bitte höchstens 20 Zeichen.";
  if (!/^[\p{L}][\p{L} .'-]*$/u.test(name)) return "Bitte nur Buchstaben, Leerzeichen, Punkt und Bindestrich.";
  return null;
}

// Namen kommen aus der Uni-Mail (vorname.nachname@law-school.de).
const capWord = (w: string) => w.split("-").map((x) => x.charAt(0).toUpperCase() + x.slice(1).toLowerCase()).join("-");

function mailParts(email: string): { first: string; last: string } {
  const parts = email.split("@")[0].split(".").filter(Boolean);
  return { first: capWord(parts[0] ?? ""), last: parts.length > 1 ? capWord(parts[parts.length - 1]) : "" };
}

export function firstNameFromEmail(email: string): string {
  return mailParts(email).first.slice(0, 20);
}

// Kandidaten der Reihe nach: "Simon", "Simon M.", "Simon Meier", "Simon Meier 2", …
export function nameCandidates(email: string): string[] {
  const { first, last } = mailParts(email);
  const out = [first];
  if (last) out.push(`${first} ${last.charAt(0)}.`, `${first} ${last}`);
  const base = out[out.length - 1];
  for (let i = 2; i < 10; i++) out.push(`${base} ${i}`);
  return out.map((n) => n.slice(0, 20));
}
