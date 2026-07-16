import { createHmac, timingSafeEqual } from "crypto";
import { redirect } from "next/navigation";
import { getSupabaseServer } from "./supabase";
import { getSql } from "./db";

export type Auth = {
  userId: string;
  email: string;
  role: "user" | "admin";
  onboarded: boolean;
};

/**
 * Identidad de la petición actual (JWT de Supabase verificado en local
 * + fila espejo en public.users para rol/onboarding). null si no hay sesión.
 */
export async function getAuth(): Promise<Auth | null> {
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;
  const userId = String(claims.sub);
  const email = typeof claims.email === "string" ? claims.email : "";

  const sql = getSql();
  let rows = await sql`
    SELECT role, onboarded FROM users WHERE id = ${userId}
  `;
  if (!rows.length) {
    // Fila espejo si el trigger aún no existía cuando se creó la cuenta.
    rows = await sql`
      INSERT INTO users (id, email) VALUES (${userId}, ${email})
      ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email
      RETURNING role, onboarded
    `;
  }
  const row = rows[0] as { role: string; onboarded: number };
  return {
    userId,
    email,
    role: row.role === "admin" ? "admin" : "user",
    onboarded: Boolean(row.onboarded),
  };
}

/** Para páginas server del panel: redirige a /login si no hay sesión. */
export async function requireUser(): Promise<Auth> {
  const auth = await getAuth();
  if (!auth) redirect("/login");
  return auth;
}

/** Para páginas/API solo de admin. */
export async function requireAdmin(): Promise<Auth> {
  const auth = await requireUser();
  if (auth.role !== "admin") redirect("/dashboard");
  return auth;
}

// ---- HMAC firmado con SESSION_SECRET (state del OAuth de Instagram) ----

function getSecret() {
  return process.env.SESSION_SECRET || "bp-secret-dev";
}

export function signPayload(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

export function verifyPayload(payload: string, signature: string): boolean {
  const expected = signPayload(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
