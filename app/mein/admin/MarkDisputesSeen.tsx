"use client";

import { useEffect } from "react";

export default function MarkDisputesSeen({ needed }: { needed: boolean }) {
  useEffect(() => {
    if (!needed) return;
    fetch("/api/admin/disputes", { method: "POST" })
      .then(() => window.dispatchEvent(new Event("billard:seen")))
      .catch(() => {});
  }, [needed]);
  return null;
}
