"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="logout"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/logout", { method: "POST" }).catch(() => {});
        window.dispatchEvent(new Event("billard:seen"));
        router.push("/profil");
        router.refresh();
        setBusy(false);
      }}
    >
      {busy ? "Ausloggen…" : "Ausloggen"}
    </button>
  );
}
