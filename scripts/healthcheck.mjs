#!/usr/bin/env node
/**
 * Diagnosi rapida dell'app pubblicata (o locale).
 *
 *   npm run healthcheck                                  -> http://localhost:3000
 *   npm run healthcheck -- https://progettoelia.vercel.app
 *
 * Non modifica nulla: fa solo letture.
 */
const base = (process.argv[2] || process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
let failures = 0;

async function get(path) {
  try {
    const r = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(20_000) });
    let body = null;
    try { body = await r.json(); } catch { /* non JSON */ }
    return { status: r.status, body };
  } catch (e) {
    return { status: 0, body: String(e?.cause?.code || e?.message || e) };
  }
}

function check(ok, label, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "✅" : "❌"} ${label}${detail ? `  — ${detail}` : ""}`);
}

console.log(`\nApp: ${base}\n`);

const health = await get("/api/health");
check(health.status !== 0, "App raggiungibile", health.status === 0 ? health.body : `HTTP ${health.status}`);
if (health.status === 0) process.exit(1);

const db = health.body?.db;
check(db === "ok", "Database collegato", db === "not_configured"
  ? "manca DATABASE_URL: collega un database Neon al progetto Vercel (vedi README)"
  : db === "error" ? "database configurato ma non raggiungibile (vedi i log di Vercel)" : `${health.body?.slots} slot`);
check(health.body?.staffPin === true, "PIN operatore impostato", health.body?.staffPin ? "" : "aggiungi STAFF_PIN (min. 6 caratteri) su Vercel");

if (db === "ok") {
  const state = await get("/api/state");
  const days = state.body?.days ?? [];
  const sys = state.body?.system ?? {};
  check(state.status === 200 && days.length > 0, "Giorni prenotabili", `${days.length} giorni`);
  console.log(`   ↳ periodo ${sys.event_start} → ${sys.event_end}${sys.period_confirmed ? "" : " (provvisorio: impostalo da /checkin)"}`);
  const open = days.filter((d) => d.free > 0);
  if (open.length) console.log(`   ↳ primo giorno con posti: ${open[0].date} (${open[0].free} posti liberi)`);
  if (sys.intake_suspended) console.log("   ⚠️  Le prenotazioni risultano SOSPESE in questo momento.");
}

console.log(failures ? `\n${failures} controlli falliti.\n` : "\nTutto ok 🎄\n");
process.exit(failures ? 1 : 0);
