import { connection } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getOverview } from "@/lib/server";
import { BADGES, TIER_METAL, TIER_NAME, badgeLabel } from "@/lib/achievements";
import BadgeCard, { type BadgeView } from "./BadgeCard";

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
          <Link href="/profil" className="bigbtn">
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

  // Wer zählt für die Prozentangaben: alle sichtbaren Spieler mit mindestens einem Spiel.
  const players = ov.visible.filter((p) => p.games > 0);
  const N = Math.max(1, players.length);
  const has = (key: string) => players.filter((p) => ov.ach[p.id]?.badges.some((b) => b.key === key));
  const pct = (key: string) => Math.round((has(key).length / N) * 100);
  const fmt = (n: number) => n.toLocaleString("de-DE");

  // Auf fremden Profilen bleiben die geheimen Abzeichen unsichtbar.
  const defs = BADGES.filter((d) => own || !d.secret);
  const total = defs.reduce((n, d) => n + (d.tiers ? d.tiers.length : 1), 0);
  const count = a.badges.filter((b) => defs.some((d) => d.id === b.id)).length;

  const views: BadgeView[] = defs.map((def) => {
    if (def.tiers) {
      const top = [2, 1, 0].find((t) => earned.has(`${def.id}:${t}`));
      const p = a.progress[def.id];
      const e = top !== undefined ? earned.get(`${def.id}:${top}`)! : null;
      const label = badgeLabel({ id: def.id, tier: top ?? 0 });
      const nextN = p?.next ?? null;
      const prevN = p && p.nextTier !== null && p.nextTier > 0 ? def.tiers[p.nextTier - 1] : def.id === "aufsteiger" ? 1500 : 0;
      const value = p?.value ?? 0;
      const valueText = def.desc.replace("{n}", fmt(value));
      // Spitzenreiter dieser Kategorie
      let best = -Infinity;
      let leaders: string[] = [];
      for (const pl of players) {
        const v = ov.ach[pl.id]?.progress[def.id]?.value ?? 0;
        if (v > best) {
          best = v;
          leaders = [pl.name];
        } else if (v === best) leaders.push(pl.name);
      }
      return {
        key: def.id,
        icon: def.icon,
        metal: TIER_METAL[top ?? 0],
        locked: !e,
        isNew: !!e && now - new Date(e.at).getTime() < NEW_MS,
        name: e ? label.name : def.name,
        line: nextN !== null ? `${fmt(value)} / ${fmt(nextN)} ${def.unit}` : valueText,
        bar: nextN !== null ? Math.max(0, Math.min(100, Math.round(((value - prevN) / (nextN - prevN)) * 100))) : undefined,
        detail: {
          title: def.name,
          desc: "Drei Stufen: Bronze, Silber, Gold",
          mine: `${own ? "Dein Stand" : `Stand von ${s.name}`}: ${valueText}`,
          tiers: def.tiers.map((n, t) => ({
            label: `${TIER_NAME[t]} · ${["I", "II", "III"][t]}`,
            metal: TIER_METAL[t],
            need: def.desc.replace("{n}", fmt(n)),
            done: earned.has(`${def.id}:${t}`),
            pct: pct(`${def.id}:${t}`),
          })),
          leader: best > 0 ? `${leaders.slice(0, 3).join(", ")} · ${def.desc.replace("{n}", fmt(best))}` : undefined,
        },
      };
    }
    const e = earned.get(def.id) ?? null;
    const hidden = def.secret && !e;
    const holders = has(def.id)
      .map((pl) => ({ name: pl.name, at: ov.ach[pl.id].badges.find((b) => b.key === def.id)!.at }))
      .sort((x, y) => x.at.localeCompare(y.at));
    return {
      key: def.id,
      icon: hidden ? "?" : def.icon,
      metal: def.metal ?? "bronze",
      locked: !e,
      isNew: !!e && now - new Date(e.at).getTime() < NEW_MS,
      name: hidden ? "???" : def.name,
      line: hidden ? "Geheimes Abzeichen" : def.desc,
      date: e ? `am ${shortDate(e.at)}` : undefined,
      // geheime nur antippbar, wenn man sie schon hat
      detail: hidden
        ? null
        : {
            title: def.name,
            desc: def.desc,
            pct: pct(def.id),
            first: holders[0] ? `${holders[0].name} (${shortDate(holders[0].at)})` : undefined,
          },
    };
  });

  return (
    <>
      <Link href={own ? "/profil" : `/spieler/${s.id}`} className="back-link">
        ← {own ? "Profil" : s.name}
      </Link>
      <h1>Abzeichen</h1>
      <p className="subtitle">
        {own ? "" : `${s.name} · `}
        {count} von {total} freigeschaltet
      </p>
      <div className="bar thin badge-bar">
        <span style={{ width: `${Math.round((count / total) * 100)}%` }} />
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
        {views.map((b) => (
          <BadgeCard key={b.key} b={b} />
        ))}
      </div>
      <p className="badge-hint">Tipp: Abzeichen antippen für Stufen und Statistik.</p>

      <div className="card xp-rules">
        <b>XP für Abzeichen</b>
        <span>Bronze +50 · Silber +150 · Gold +400 · besondere Abzeichen +25 bis +500</span>
      </div>
    </>
  );
}
