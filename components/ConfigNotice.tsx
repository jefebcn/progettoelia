import { isSupabaseConfigured } from "@/lib/supabase";

/**
 * Mostra un avviso quando le variabili d'ambiente Supabase non sono configurate,
 * così l'app resta comprensibile anche prima del collegamento al database.
 */
export function ConfigNotice() {
  if (isSupabaseConfigured) return null;
  return (
    <div className="mx-auto mb-4 max-w-md rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
      ⚠️ Supabase non è ancora configurato. Imposta{" "}
      <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> e{" "}
      <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> (vedi
      README) per abilitare prenotazioni e realtime.
    </div>
  );
}
