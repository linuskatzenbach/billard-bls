// Standard-Elo-System wie im Schach.
// K-Faktor bestimmt, wie stark sich ein einzelnes Ergebnis auswirkt.
// 32 ist ein gängiger Wert für "Hobby"-Ligen mit wenigen Spielen.
export const K_FACTOR = 32;
export const START_ELO = 1500;

function expectedScore(eloA: number, eloB: number): number {
  return 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
}

// Berechnet die neuen Elo-Werte nach einem Spiel Gewinner vs. Verlierer.
export function calculateNewElo(
  winnerElo: number,
  loserElo: number
): { newWinnerElo: number; newLoserElo: number } {
  const expectedWinner = expectedScore(winnerElo, loserElo);
  const expectedLoser = expectedScore(loserElo, winnerElo);

  const newWinnerElo = Math.round(winnerElo + K_FACTOR * (1 - expectedWinner));
  const newLoserElo = Math.round(loserElo + K_FACTOR * (0 - expectedLoser));

  return { newWinnerElo, newLoserElo };
}
