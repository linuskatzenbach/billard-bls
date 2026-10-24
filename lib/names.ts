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
  "Master / LL.M.",
  "Promotion",
  "Mitarbeiter",
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
