import { connection } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getOverview } from "@/lib/server";
import { BADGES, BADGE_TOTAL, FOUNDER_BADGE, TIER_METAL, badgeLabel } from "@/lib/achievements";
import Medal from "../Medal";

const NEW_MS = 3 * 86_400_000;
const shortDate = (iso: string) =>
  new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "numeric", month: "numeric" }).format(new Date(iso));

export default async function AbzeichenPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const sp = await searchParams;
  const [{ ov }, session] = await Promise.all([getOverview(), getSession()]);
  const id = typeof sp.spieler === "string" ? sp.spieler : session?.playerId;
  const s = id ? ov.byId[id] : undefined;
  if (!s || s.hidden) {
    if (!id) {
      return (
        <div className="auth">
          <h1>Abzeichen</h1>
          <p className="subtitle">Melde dich an, um deine Abzeichen zu sehen.</p>
          <Link href="/mein" className="bigbtn">
            Anmelden
          </Link>
        </div>
      );
    }
    notFound();
  }
  const own = s.id === session?.playerId;
  const a = ov.ach[s.id];
  const earned = new Map(a.badges.map((b) => [b.key, b]));
  const now = Date.now();

  // Nächstes Ziel: gestuftes Abzeichen, bei dem am wenigsten fehlt (relativ).
  let near: { name: string; missing: number; unit: string; tier: string } | null = null;
  let bestRatio = -1;
  for (const def of BADGES) {
    const p = a.progress[def.id];
    if (!def.tiers || !p || p.next === null || p.nextTier === null) continue;
    const prevN = p.nextTier > 0 ? def.tiers[p.nextTier - 1] : def.id === "aufsteiger" ? 1500 : 0;
    const ratio = (p.value - prevN) / (p.next - prevN);
    if (ratio > bestRatio) {
      bestRatio = ratio;
      near = {
        name: `${def.name} ${["I", "II", "III"][p.nextTier]}`,
        missing: p.next - p.value,
        unit: def.unit ?? "",
        tier: ["Bronze", "Silber", "Gold"][p.nextTier],
      };
    }
  }

  return (
    <>
      <Link href={own ? "/mein" : `/spieler/${s.id}`} className="back-link">
        ← {own ? "Profil" : s.name}
      </Link>
      <h1>Abzeichen</h1>
      <p className="subtitle">
        {own ? "" : `${s.name} · `}
        {a.badges.length} von {BADGE_TOTAL} freigeschaltet
      </p>
      <div className="bar thin badge-bar">
        <span style={{ width: `${Math.round((a.badges.length / BADGE_TOTAL) * 100)}%` }} />
      </div>

      {near && own && (
        <div className="goal card">
          <span className="goal-icon">🎯</span>
          <div>
            <div className="goal-title">Fast geschafft: {near.name}</div>
            <div className="goal-sub">
              Noch {near.missing.toLocaleString("de-DE")} {near.unit} bis {near.tier}
            </div>
          </div>
        </div>
      )}

      <div className="badges">
        {BADGES.map((def) => {
          if (def.tiers) {
            const top = [2, 1, 0].find((t) => earned.has(`${def.id}:${t}`));
            const p = a.progress[def.id];
            const e = top !== undefined ? earned.get(`${def.id}:${top}`)! : null;
            const label = badgeLabel({ id: def.id, tier: top ?? 0 });
            const nextN = p?.next;
            const prevN = p && p.nextTier !== null && p.nextTier > 0 ? def.tiers[p.nextTier - 1] : def.id === "aufsteiger" ? 1500 : 0;
            return (
              <div key={def.id} className={`badge card${e ? "" : " is-locked"}`}>
                <Medal metal={TIER_METAL[top ?? 0]} icon={def.icon} locked={!e} isNew={!!e && now - new Date(e.at).getTime() < NEW_MS} />
                <span className="badge-name">{e ? label.name : def.name}</span>
                <span className="badge-desc">
                  {nextN ? `${(p!.value).toLocaleString("de-DE")} / ${nextN.toLocaleString("de-DE")} ${def.unit}` : "Gold erreicht!"}
                </span>
                {nextN && (
                  <span className="bar thin">
                    <span style={{ width: `${Math.max(0, Math.min(100, Math.round(((p!.value - prevN) / (nextN - prevN)) * 100)))}%` }} />
                  </span>
                )}
              </div>
            );
          }
          const e = earned.get(def.id) ?? null;
          const hidden = def.secret && !e;
          return (
            <div key={def.id} className={`badge card${e ? "" : " is-locked"}`}>
              <Medal metal={def.metal ?? "bronze"} icon={hidden ? "?" : def.icon} locked={!e} isNew={!!e && now - new Date(e.at).getTime() < NEW_MS} />
              <span className="badge-name">{hidden ? "???" : def.name}</span>
              <span className="badge-desc">{hidden ? "Geheimes Abzeichen" : def.desc}</span>
              {e && <span className="badge-date">seit {shortDate(e.at)}</span>}
            </div>
          );
        })}
      </div>

      <div className="card xp-rules">
        <b>XP für Abzeichen</b>
        <span>Bronze +50 · Silber +150 · Gold +400 · besondere Abzeichen +25 bis +500</span>
      </div>

      {s.founder && (
        <p className="founder-note">
          {FOUNDER_BADGE.icon} {FOUNDER_BADGE.name} – {FOUNDER_BADGE.desc.toLowerCase()}
        </p>
      )}
    </>
  );
}
