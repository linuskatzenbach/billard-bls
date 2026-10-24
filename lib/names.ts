// Regeln für Anzeigenamen und die Jahrgangs-Auswahl beim Profil-Anlegen.

export const COHORTS = [
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

export function validateName(name: string): string | null {
  if (name.length < 2) return "Der Name ist zu kurz.";
  if (name.length > 20) return "Bitte höchstens 20 Zeichen.";
  if (!/^[\p{L}][\p{L} .'-]*$/u.test(name)) return "Bitte nur Buchstaben, Leerzeichen, Punkt und Bindestrich.";
  return null;
}
