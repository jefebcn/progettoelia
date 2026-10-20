#!/usr/bin/env node
/**
 * Diagnosi rapida del backend Supabase.
 *
 *   npm run healthcheck
 *
 * Legge NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY (o
 * NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) dall'ambiente o da .env.local.
 * Non modifica nulla: fa solo richieste di lettura / funzioni innocue.
 */
import { readFileSync, existsSync } from "node:fs";

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnvFile(".env.local");
loadEnvFile(".env");

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!URL_ || !KEY) {
  console.error("❌ Mancano NEXT_PUBLIC_SUPABASE_URL e/o la anon/publishable key (.env.local).");
  process.exit(1);
}

const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
let failures = 0;

async function req(path, init = {}) {
  try {
    const r = await fetch(`${URL_}${path}`, { ...init, headers, signal: AbortSignal.timeout(10_000) });
    let body = null;
    try { body = await r.json(); } catch { /* corpo non JSON */ }
    return { status: r.status, body };
  } catch (e) {
    return { status: 0, body: String(e?.cause?.code || e?.message || e) };
  }
}
const rpc = (fn, args) => req(`/rest/v1/rpc/${fn}`, { method: "POST", body: JSON.stringify(args) });

function check(ok, label, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "✅" : "❌"} ${label}${detail ? `  — ${detail}` : ""}`);
}

console.log(`\nSupabase: ${URL_}\n`);

// 1. Il progetto risponde?
const ping = await req("/rest/v1/slots?select=id,slot_time,current_booked,max_capacity,status&order=slot_time");
if (ping.status === 0 || ping.status >= 500) {
  check(false, "Progetto raggiungibile", `stato ${ping.status} ${typeof ping.body === "string" ? ping.body : ""}`);
  console.log(
    "\n👉 Il progetto Supabase non risponde. Se è sul piano Free probabilmente è in PAUSA\n" +
      "   (succede dopo 7 giorni senza attività). Vai su https://supabase.com/dashboard,\n" +
      "   apri il progetto e premi «Restore project». Poi riesegui questo script.\n",
  );
  process.exit(1);
}
check(ping.status === 200, "Progetto raggiungibile", `HTTP ${ping.status}`);

// 2. Dati di base
const slots = Array.isArray(ping.body) ? ping.body : [];
check(slots.length > 0, "Tabella slots popolata", `${slots.length} slot`);
if (slots.length) {
  const booked = slots.reduce((a, s) => a + s.current_booked, 0);
  const full = slots.filter((s) => s.status === "full").length;
  const susp = slots.filter((s) => s.status === "suspended").length;
  console.log(`   ↳ ${booked} posti prenotati · ${full} slot pieni · ${susp} sospesi`);
}
const state = await req("/rest/v1/system_state?select=intake_suspended,message&id=eq.true");
check(state.status === 200 && Array.isArray(state.body) && state.body.length === 1, "Riga system_state presente");
if (state.body?.[0]?.intake_suspended) console.log("   ⚠️  Le prenotazioni risultano SOSPESE in questo momento.");

// 3. Migrazione 0003 applicata?
const pass = await rpc("get_pass", { p_id: "00000000-0000-0000-0000-000000000000" });
check(pass.status === 200, "Funzione get_pass (migrazione 0003)", pass.status === 404 ? "manca: esegui 0003_security_and_fixes.sql" : `HTTP ${pass.status}`);
const login = await rpc("staff_login", { p_pin: "__healthcheck__" });
const loginErr = login.body?.error;
check(login.status === 200 && loginErr !== "PIN_NOT_SET", "PIN operatore impostato",
  loginErr === "PIN_NOT_SET" ? "esegui: select private.set_staff_pin('...');" : `risposta: ${loginErr ?? login.status}`);
// Nota: questo tentativo conta come 1 PIN errato (limite 10 ogni 15 min).

// 4. Sicurezza: la anon key NON deve poter leggere o modificare tutto.
const leak = await req("/rest/v1/reservations?select=first_name&limit=1");
check(leak.status !== 200, "Nomi dei visitatori NON leggibili pubblicamente", `HTTP ${leak.status}`);
// Controllo via schema OpenAPI: NON chiamiamo mai reset_day (cancellerebbe tutto).
const spec = await req("/rest/v1/");
const paths = spec.status === 200 && spec.body?.paths ? Object.keys(spec.body.paths) : null;
if (paths) {
  const exposed = ["/rpc/reset_day", "/rpc/quick_entry"].filter((p) => paths.includes(p));
  check(exposed.length === 0, "Funzioni operatore senza PIN NON esposte", exposed.join(", "));
} else {
  console.log("➖ Funzioni operatore esposte: non verificabile (schema OpenAPI non disponibile)");
}

console.log(failures ? `\n${failures} controlli falliti.\n` : "\nTutto ok 🎄\n");
process.exit(failures ? 1 : 0);
