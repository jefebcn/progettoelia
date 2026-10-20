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
  const slots = state.body?.slots ?? [];
  check(state.status === 200 && slots.length > 0, "Orari disponibili", `${slots.length} slot`);
  if (slots.length) {
    const booked = slots.reduce((a, s) => a + s.current_booked, 0);
    const full = slots.filter((s) => s.status === "full").length;
    const susp = slots.filter((s) => s.status === "suspended").length;
    console.log(`   ↳ ${booked} posti prenotati · ${full} slot pieni · ${susp} sospesi`);
  }
  if (state.body?.system?.intake_suspended) console.log("   ⚠️  Le prenotazioni risultano SOSPESE in questo momento.");
}

console.log(failures ? `\n${failures} controlli falliti.\n` : "\nTutto ok 🎄\n");
process.exit(failures ? 1 : 0);
