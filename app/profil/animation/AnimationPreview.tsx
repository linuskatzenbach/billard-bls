"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { poolBall } from "../../RankBall";
import type { TablePlayer } from "../../VictoryTable";

const VictoryTable = dynamic(() => import("../../VictoryTable"), { ssr: false });

// Admin: Sieges-Animation beliebig oft ansehen, ohne etwas zu speichern.
const demo = (name: string, rank: number): TablePlayer => ({ name, label: name.charAt(0), ...poolBall(rank) });
const PEOPLE = [demo("Linus", 3), demo("Jannik", 2), demo("Tobi", 1), demo("Max", 4)];

export default function AnimationPreview() {
  const [run, setRun] = useState<{ pairs: 1 | 2; key: number } | null>(null);
  const start = (pairs: 1 | 2) => setRun({ pairs, key: Date.now() });
  const fake = () => new Promise<{ winnerDelta: number; loserDelta: number }>((ok) => setTimeout(() => ok({ winnerDelta: 14, loserDelta: -14 }), 400));

  return (
    <>
      <h1>Animation</h1>
      <p className="subtitle">Jedes Mal ein neuer Stoß – nichts wird gespeichert</p>
      <div className="anim-preview-btns">
        <button type="button" onClick={() => start(1)}>1 gegen 1 abspielen</button>
        <button type="button" onClick={() => start(2)}>2 gegen 2 abspielen</button>
      </div>
      {run && (
        <VictoryTable
          key={run.key}
          seed={run.key}
          winners={run.pairs === 2 ? PEOPLE.slice(0, 2) : PEOPLE.slice(0, 1)}
          losers={run.pairs === 2 ? PEOPLE.slice(2, 4) : PEOPLE.slice(2, 3)}
          result={fake()}
          onDone={() => setRun(null)}
          onError={() => setRun(null)}
        />
      )}
    </>
  );
}
