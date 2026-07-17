import { createHmac, timingSafeEqual } from "crypto";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getSupabaseServer } from "./supabase";
import { getSql } from "./db";

/** Cookie httpOnly con el id del cliente activo del editor. */
export const CLIENT_COOKIE = "bp_client";

export type Auth = {
  userId: string;
  email: string;
  role: "user" | "admin";
  onboarded: boolean;
  /** Cliente activo (null si el editor aún no creó ninguno). */
  clientId: number | null;
  clientNombre: string | null;
};

/** Auth con cliente activo garantizado (para páginas/APIs de contenido). */
export type ClientAuth = Auth & { clientId: number; clientNombre: string };

/**
 * Identidad de la petición actual (JWT de Supabase verificado en local
 * + fila espejo en public.users para rol/onboarding + cliente activo
 * resuelto desde la cookie bp_client). null si no hay sesión.
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

  // Cliente activo: cookie válida → ese; si no, el más antiguo activo.
  const cookieStore = await cookies();
  const cookieClientId = Number(cookieStore.get(CLIENT_COOKIE)?.value || NaN);
  const clients = await sql<{ id: number; nombre: string }[]>`
    SELECT id, nombre FROM clients
    WHERE owner_user_id = ${userId} AND estado = 'activo'
    ORDER BY created_at ASC, id ASC
  `;
  const active =
    clients.find((c) => c.id === cookieClientId) ?? clients[0] ?? null;

  return {
    userId,
    email,
    role: row.role === "admin" ? "admin" : "user",
    onboarded: Boolean(row.onboarded),
    clientId: active?.id ?? null,
    clientNombre: active?.nombre ?? null,
  };
}

/** Para páginas server del panel: redirige a /login si no hay sesión. */
export async function requireUser(): Promise<Auth> {
  const auth = await getAuth();
  if (!auth) redirect("/login");
  return auth;
}

/**
 * Para páginas de contenido: exige sesión Y un cliente activo.
 * Sin clientes todavía → al onboarding (donde se crea el primero).
 */
export async function requireClient(): Promise<ClientAuth> {
  const auth = await requireUser();
  if (auth.clientId == null) redirect("/onboarding");
  return auth as ClientAuth;
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
