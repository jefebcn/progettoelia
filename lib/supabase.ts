import { createClient } from "@supabase/supabase-js";

// Le variabili sono pubbliche (prefisso NEXT_PUBLIC_) e vengono lette a build-time.
// I fallback evitano un crash in fase di build quando l'env non è ancora configurato;
// a runtime, su Vercel, verranno usati i valori reali del progetto Supabase.
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
// Accetta sia la chiave anon "legacy" (eyJ...) sia la nuova publishable key
// (sb_publishable_...), sotto uno dei due nomi di variabile usati da Supabase.
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "public-anon-key-placeholder";

export const isSupabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  (!!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    !!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: { eventsPerSecond: 10 },
  },
  auth: {
    persistSession: false,
  },
});
