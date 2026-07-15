import { NextResponse } from "next/server";
import { isAuthed } from "./auth";

export async function guard(): Promise<NextResponse | null> {
  if (await isAuthed()) return null;
  return NextResponse.json({ error: "No autorizado" }, { status: 401 });
}

export function fail(e: unknown, status = 500) {
  const message = e instanceof Error ? e.message : "Error inesperado";
  return NextResponse.json({ error: message }, { status });
}
