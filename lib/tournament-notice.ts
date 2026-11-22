// Einmaliger Hinweis im Turnier-Tab über dem goldenen Kasten (bis einschließlich
// "until"). Eigene Datei ohne Datenbank-Code, damit auch die Leiste unten sie nutzen kann.
export const TOURNAMENT_NOTICE = {
  id: "ko-verschoben-relegation",
  text: "Wegen der Relegation verschiebt sich der Start der K.O.-Phase auf Mittwoch, 25.11.",
  until: "2026-11-24",
} as const;
