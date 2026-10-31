"use client";

import { useState } from "react";

// Alle Mail-Adressen als ein String (für BCC in Rundmails) – mit Kopierknopf.
export default function MailList({ emails }: { emails: string[] }) {
  const [copied, setCopied] = useState(false);
  const text = emails.join("; ");
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }
  return (
    <div className="card mail-list">
      <textarea readOnly value={text} rows={4} onFocus={(e) => e.currentTarget.select()} aria-label="Alle Mail-Adressen" />
      <button type="button" onClick={copy}>
        {copied ? "Kopiert ✓" : `Alle ${emails.length} Adressen kopieren`}
      </button>
    </div>
  );
}
