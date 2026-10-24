"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Ball, poolBall } from "./RankBall";
import Wreath from "./Wreath";
import { showReward } from "./RewardOverlay";
import type { Reward } from "@/lib/reward";
import type { VictoryProps, VictoryResult } from "./VictoryAnimation";

// Die Sieges-Animation wird erst geladen, wenn sie gebraucht wird.
const loadVictory = () => import("./VictoryAnimation");
const VictoryAnimation = dynamic(loadVictory, { ssr: false });

type AnimSetup = Omit<VictoryProps, "result" | "onDone" | "onError">;

// Nach dem Absenden ist auf dem Handy meist noch die Tastatur vom
// Passwortfeld offen. Schließt sie sich erst, nachdem der Tisch vermessen
// wurde, verrutscht die Seite darunter und der Tisch sitzt viel zu weit
// oben. Deshalb erst die Tastatur schließen und warten, bis der sichtbare
// Bereich wieder ruhig ist (höchstens knapp eine Sekunde).
function settleViewport(): Promise<void> {
  const active = document.activeElement;
  const hadInput = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement;
  if (active instanceof HTMLElement) active.blur();
  const vv = window.visualViewport;
  const keyboardOpen = vv ? window.innerHeight - vv.height > 80 : false;
  if (!hadInput && !keyboardOpen) return Promise.resolve();

  return new Promise((resolve) => {
    const start = performance.now();
    let last = "";
    let stableSince = start;
    const check = () => {
      const now = performance.now();
      const state = `${vv?.height ?? 0}|${vv?.offsetTop ?? 0}|${window.innerHeight}|${window.scrollY}`;
      if (state !== last) {
        last = state;
        stableSince = now;
      }
      const closed = !vv || window.innerHeight - vv.height <= 80;
      if ((closed && now - stableSince > 120 && now - start > 250) || now - start > 900) resolve();
      else requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  });
}

import type { Pick } from "@/lib/picks";
export type { Pick };

const ballOf = (p: Pick) => (p.rank ? poolBall(p.rank) : { color: "#f4efe4", kind: "cue" as const });
const initial = (p: Pick) => p.name.charAt(0).toUpperCase();

// Misst die beiden Kugeln im Duell-Feld und den Tisch, der sich darunter
// einblendet. Liegt das Feld nicht ganz im Bild, wird vorher gescrollt.
function measureAnimation(form: HTMLFormElement, winner: Pick, loser: Pick): AnimSetup | null {
  const grid = form.querySelector<HTMLElement>(".duel");
  const wEl = form.querySelector<HTMLElement>(".duel-ball.is-winner .ball");
  const lEl = form.querySelector<HTMLElement>(".duel-ball.is-loser .ball");
  if (!grid || !wEl || !lEl) return null;

  const vh = window.visualViewport?.height ?? window.innerHeight;
  const vw = window.visualViewport?.width ?? window.innerWidth;
  const padX = 12;
  const padY = 34;

  const g0 = grid.getBoundingClientRect();
  const margin = padY + 8;
  let shift = 0;
  if (g0.height + 2 * margin <= vh) {
    if (g0.top < margin) shift = g0.top - margin;
    else if (g0.bottom > vh - margin) shift = g0.bottom - (vh - margin);
  } else {
    shift = (g0.top + g0.bottom) / 2 - vh / 2;
  }
  if (Math.abs(shift) > 1) window.scrollBy({ top: shift, behavior: "instant" as ScrollBehavior });

  const g = grid.getBoundingClientRect();
  const wr = wEl.getBoundingClientRect();
  const lr = lEl.getBoundingClientRect();
  const R = wr.width / 2;
  const wc = { x: wr.left + R, y: wr.top + R };
  const lc = { x: lr.left + R, y: lr.top + R };
  const left = Math.max(6, g.left - padX);
  const right = Math.min(vw - 6, g.right + padX);
  const tTop = Math.max(6, Math.min(g.top - padY, Math.min(wc.y, lc.y) - R - 40));
  const tBottom = Math.min(vh - 6, Math.max(g.bottom + padY, Math.max(wc.y, lc.y) + R + 40));

  const ball = (p: Pick, c: { x: number; y: number }) => ({ name: p.name, label: initial(p), ...ballOf(p), ...c });
  return {
    winner: ball(winner, wc),
    loser: ball(loser, lc),
    radius: R,
    table: { left, top: tTop, width: right - left, height: tBottom - tTop },
  };
}

// "live": echtes Spiel, zählt sofort.
// "test": nur im Admin-Bereich – volle Animation, aber nichts wird gespeichert.
export default function ResultForm({
  mode = "live",
  me,
  opponents,
}: {
  mode?: "live" | "test";
  me: Pick;
  opponents: Pick[];
}) {
  const test = mode === "test";
  const home = test ? "/mein/admin" : "/";
  const router = useRouter();
  const [opponentId, setOpponentId] = useState("");
  const [iWon, setIWon] = useState<boolean | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<
    { type: "idle" } | { type: "loading" } | { type: "error"; message: string } | { type: "success"; message: string }
  >({ type: "idle" });
  const formRef = useRef<HTMLFormElement>(null);
  const duelRef = useRef<HTMLDivElement>(null);
  const [anim, setAnim] = useState<VictoryProps | null>(null);

  const opponent = opponents.find((p) => p.id === opponentId) ?? null;
  const q = query.trim().toLowerCase();
  const shown = q ? opponents.filter((p) => p.name.toLowerCase().includes(q)) : opponents;

  // Beim Verlassen alles auf Anfang stellen (Next.js hebt die Seite auf).
  useEffect(() => {
    return () => {
      setAnim(null);
      setOpponentId("");
      setIWon(null);
      setQuery("");
      setStatus({ type: "idle" });
    };
  }, []);

  useEffect(() => {
    if (opponentId) void loadVictory();
  }, [opponentId]);

  function chooseOpponent(id: string) {
    if (status.type === "error") setStatus({ type: "idle" });
    setOpponentId(id === opponentId ? "" : id);
    setIWon(null);
    if (id !== opponentId) {
      requestAnimationFrame(() => duelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!opponent) {
      setStatus({ type: "error", message: "Bitte zuerst deinen Gegner antippen." });
      return;
    }
    if (iWon === null) {
      setStatus({ type: "error", message: "Bitte die Kugel des Gewinners antippen." });
      return;
    }
    setStatus({ type: "loading" });

    const result: Promise<VictoryResult & { reward: Reward | null }> = (async () => {
      let res: Response;
      try {
        res = await fetch(test ? "/api/test-result" : "/api/results", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ opponentId: opponent.id, won: iWon }),
        });
      } catch {
        throw new Error("Verbindung fehlgeschlagen. Bitte erneut versuchen.");
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Etwas ist schiefgelaufen.");
      return {
        winnerDelta: data.winnerDelta ?? 0,
        loserDelta: data.loserDelta ?? 0,
        reward: (data.reward as Reward) ?? null,
      };
    })();
    let reward: Reward | null = null;
    result.then((r) => (reward = r.reward)).catch(() => {});

    await settleViewport();
    const [winner, loser] = iWon ? [me, opponent] : [opponent, me];
    const setup = formRef.current ? measureAnimation(formRef.current, winner, loser) : null;
    if (setup) {
      setAnim({
        ...setup,
        result,
        onDone: () => {
          if (reward) showReward(reward, test);
          router.push(home);
          router.refresh();
        },
        onError: (message) => {
          setAnim(null);
          setStatus({ type: "error", message });
        },
      });
      return;
    }

    try {
      const r = await result;
      if (r.reward) showReward(r.reward, test);
      setStatus({
        type: "success",
        message: `${test ? "Testspiel durchgespielt, nichts gespeichert" : "Ergebnis gespeichert!"} (+${r.winnerDelta} / −${Math.abs(r.loserDelta)} Elo)`,
      });
      setOpponentId("");
      setIWon(null);
      router.refresh();
    } catch (err) {
      setStatus({ type: "error", message: err instanceof Error ? err.message : "Etwas ist schiefgelaufen." });
    }
  }

  const hint = !opponent
    ? ""
    : iWon === null
      ? "Tippe die Kugel des Gewinners an"
      : iWon
        ? `Du schlägst ${opponent.name}`
        : `${opponent.name} schlägt dich`;

  return (
    <>
      <h1>{test ? "Testspiel" : "Spiel eintragen"}</h1>
      <p className="subtitle">{test ? "Animation wie echt – nichts wird gespeichert" : "Gegen wen hast du gespielt?"}</p>

      <form ref={formRef} onSubmit={handleSubmit} className="result-form">
        {opponents.length > 8 && (
          <input
            type="search"
            className="opp-search"
            placeholder="🔍 Spieler suchen …"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Spieler suchen"
          />
        )}
        <div className="opp-grid" role="listbox" aria-label="Gegner">
          {shown.map((p) => (
            <button
              key={p.id}
              type="button"
              role="option"
              aria-selected={p.id === opponentId}
              className={`opp${p.id === opponentId ? " selected" : ""}`}
              onClick={() => chooseOpponent(p.id)}
            >
              <Wreath level={p.level} rank={p.rank} size="3rem" />
              <span className="opp-name">{p.name}</span>
            </button>
          ))}
          {shown.length === 0 && <p className="empty small">Niemand gefunden.</p>}
        </div>

        {opponent && (
          <div className="duel-wrap" ref={duelRef}>
            <p className="duel-title">Wer hat gewonnen?</p>
            <div className="duel">
              {[
                { p: me, mine: true },
                { p: opponent, mine: false },
              ].map(({ p, mine }) => {
                const role = iWon === null ? "" : iWon === mine ? "is-winner" : "is-loser";
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`duel-ball ${role}${iWon !== null && !role ? "" : ""}`}
                    onClick={() => {
                      if (status.type === "error") setStatus({ type: "idle" });
                      setIWon(mine);
                    }}
                    aria-label={`${mine ? "Ich" : p.name} hat gewonnen`}
                  >
                    {role && <span className="picker-badge">{role === "is-winner" ? "Sieger" : "Verlierer"}</span>}
                    <Ball label={initial(p)} {...ballOf(p)} />
                    <span className="duel-name">{mine ? "Ich" : p.name}</span>
                  </button>
                );
              })}
            </div>
            <p className="picker-hint" aria-live="polite">
              {hint}
            </p>
          </div>
        )}

        {!test && opponent && (
          <p className="result-note">
            Zählt sofort. {opponent.name} sieht das Spiel und kann bei einem Fehler 24 h lang widersprechen.
          </p>
        )}

        <button type="submit" disabled={status.type === "loading" || !opponent || iWon === null}>
          {status.type === "loading"
            ? test
              ? "Läuft…"
              : "Speichert…"
            : test
              ? "Testspiel starten"
              : "Ergebnis speichern"}
        </button>

        {status.type === "error" && <p className="message error">{status.message}</p>}
        {status.type === "success" && <p className="message success">{status.message}</p>}
      </form>

      {anim && <VictoryAnimation {...anim} />}

      <Link href={home} className="nav-link">
        {test ? "← Zurück zum Admin-Bereich" : "← Zurück zur Rangliste"}
      </Link>
    </>
  );
}
