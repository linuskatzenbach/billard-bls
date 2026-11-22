"use client";

import { useEffect, useState } from "react";

// Hinweis-Box im Turnier-Tab. Roter Punkt, bis man den Hinweis einmal
// gesehen hat (gemerkt im Browser); danach bleibt nur die Box.
export const noticeKey = (id: string) => `billard:notice:${id}`;

export default function Notice({ id, text }: { id: string; text: string }) {
  const [fresh, setFresh] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem(noticeKey(id))) {
        setFresh(true);
        localStorage.setItem(noticeKey(id), "1");
        window.dispatchEvent(new Event("billard:notice-seen"));
      }
    } catch {}
  }, [id]);
  return (
    <div className="tn-notice" role="note">
      {fresh && <span className="tn-notice-dot" aria-label="neu" />}
      <p className="tn-notice-h">Achtung</p>
      <p className="tn-notice-text">{text}</p>
    </div>
  );
}
