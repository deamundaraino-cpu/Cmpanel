import { NextResponse } from "next/server";
import { getAuth, type Auth } from "./auth";

export type { Auth };

/**
 * Guard de las API routes. Devuelve la identidad del usuario o una
 * respuesta 401 lista para retornar:
 *
 *   const auth = await guard();
 *   if (auth instanceof NextResponse) return auth;
 *   const { userId } = auth;
 */
export async function guard(): Promise<Auth | NextResponse> {
  const auth = await getAuth();
  if (auth) return auth;
  return NextResponse.json({ error: "No autorizado" }, { status: 401 });
}

/** Como guard(), pero exige rol admin. */
export async function guardAdmin(): Promise<Auth | NextResponse> {
  const auth = await guard();
  if (auth instanceof NextResponse) return auth;
  if (auth.role !== "admin") {
    return NextResponse.json({ error: "Solo admin" }, { status: 403 });
  }
  return auth;
}

export function fail(e: unknown, status = 500) {
  const message = e instanceof Error ? e.message : "Error inesperado";
  return NextResponse.json({ error: message }, { status });
}
