"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

/**
 * Avvisa quando il database non è ancora collegato (variabile DATABASE_URL
 * mancante su Vercel), così l'app resta comprensibile prima del setup.
 */
export function ConfigNotice() {
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    api.health().then((h) => setMissing(h?.db === "not_configured"));
  }, []);

  if (!missing) return null;
  return (
    <div className="mx-auto mb-4 max-w-md rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
      ⚠️ Il database non è ancora collegato. Su Vercel apri il progetto → Storage →
      crea un database Neon e collegalo (vedi README).
    </div>
  );
}
