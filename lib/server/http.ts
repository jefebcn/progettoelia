import { NextResponse } from "next/server";
import { errorCode } from "./db";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Data "YYYY-MM-DD" valida (anche come giorno di calendario). */
export function isDate(v: unknown): v is string {
  if (typeof v !== "string" || !DATE_RE.test(v)) return false;
  const d = new Date(`${v}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

export function asInt(v: unknown): number | null {
  return typeof v === "number" && Number.isInteger(v) ? v : null;
}

export function asText(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

/** Stato HTTP coerente con il codice d'errore. */
export function statusFor(code: string): number {
  if (code === "DB_NOT_CONFIGURED") return 503;
  if (code === "SERVER_ERROR") return 500;
  if (code === "NOT_FOUND" || code === "SLOT_NOT_FOUND") return 404;
  if (["BAD_PIN", "PIN_NOT_SET"].includes(code)) return 401;
  if (code === "TOO_MANY_ATTEMPTS") return 429;
  return 409;
}

export function errorResponse(err: unknown) {
  const code = errorCode(err);
  return json({ error: code }, statusFor(code));
}

/** IP del client: su Vercel x-forwarded-for è impostato dalla piattaforma. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] || req.headers.get("x-real-ip") || "unknown").trim();
}
