import { connection } from "next/server";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getOverview } from "@/lib/server";
import { LEVEL_XP, MAX_LEVEL, TIERS } from "@/lib/progress";
import Wreath from "../Wreath";

// Übersicht aller 18 Lorbeerkränze.
export default async function KraenzePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const sp = await searchParams;
  const [{ ov }, session] = await Promise.all([getOverview(), getSession()]);
  const id = typeof sp.spieler === "string" ? sp.spieler : session?.playerId;
  const s = id ? ov.byId[id] : undefined;
  const level = s?.level ?? 0;
  const rank = s?.rank ?? null;

  return (
    <>
      <Link href={s ? (s.id === session?.playerId ? "/profil" : `/spieler/${s.id}`) : "/"} className="back-link">
        ← {s ? (s.id === session?.playerId ? "Profil" : s.name) : "Rangliste"}
      </Link>
      <h1>Lorbeerkränze</h1>
      <p className="subtitle">Jedes Level ein neuer Kranz · {MAX_LEVEL} Level</p>
      {TIERS.map((t, ti) => (
        <section key={t.name} className="tier">
          <h2 className="tier-h">
            <i style={{ background: t.color }} />
            {t.name}
            <span>
              Level {ti * 3 + 1}–{ti * 3 + 3}
            </span>
          </h2>
          <div className="gal">
            {[1, 2, 3].map((k) => {
              const L = ti * 3 + k;
              const cur = L === level;
              return (
                <div key={L} className={`gal-cell${cur ? " cur" : ""}`}>
                  <Wreath level={L} rank={rank} size="64px" locked={L > level} label={`Level ${L}`} />
                  <span className="gal-cap">{cur ? `aktiv · ${L}` : `Level ${L}`}</span>
                  <span className="gal-xp">{LEVEL_XP[L].toLocaleString("de-DE")} XP</span>
                </div>
              );
            })}
          </div>
        </section>
      ))}
      <div className="card xp-rules">
        <b>So gibt es XP</b>
        <span>Jedes Spiel +10 · Sieg +5 · Upset +15</span>
        <span>Wochenaufgaben +40 bis +75, alle drei +50</span>
        <span>Wochenzocker Platz 1–3: +50 / +30 / +15</span>
        <span>Abzeichen +25 bis +500</span>
      </div>
    </>
  );
}
