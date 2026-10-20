import { NextResponse } from "next/server";
import { errorCode } from "./db";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
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
