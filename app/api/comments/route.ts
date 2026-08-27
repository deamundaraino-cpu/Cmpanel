import { NextResponse } from "next/server";
import { guardClient } from "@/lib/api";
import { getSql, CommentRow } from "@/lib/db";

export type CommenterRow = {
  username: string;
  veces: number;
  ultimo: string | null;
  leads: number;
};

export async function GET() {
  const auth = await guardClient();
  if (auth instanceof NextResponse) return auth;
  const sql = getSql();

  const comments = await sql<(CommentRow & { caption: string | null; permalink: string | null })[]>`
    SELECT c.*, p.caption, p.permalink
    FROM comments c
    LEFT JOIN posts p ON p.client_id = c.client_id AND p.id = c.post_id
    WHERE c.client_id = ${auth.clientId}
    ORDER BY c.is_lead DESC, c.timestamp DESC NULLS LAST
    LIMIT 200
  `;

  // Recurrentes: quien vuelve a comentar es lo más cerca que tenemos de
  // "comunidad" con lo que expone la API.
  const recurrentes = await sql<CommenterRow[]>`
    SELECT username,
           COUNT(*)::int AS veces,
           MAX(timestamp) AS ultimo,
           COALESCE(SUM(is_lead), 0)::int AS leads
    FROM comments
    WHERE client_id = ${auth.clientId} AND username IS NOT NULL
    GROUP BY username
    HAVING COUNT(*) > 1
    ORDER BY veces DESC, ultimo DESC
    LIMIT 50
  `;

  const conAutor = comments.filter((c) => c.username).length;

  return NextResponse.json({
    comments,
    recurrentes,
    // Si hay comentarios pero ninguno trae autor, el token no tiene el permiso
    // de comentarios: la UI lo explica en vez de fingir que no hay nadie.
    sinAutores: comments.length > 0 && conAutor === 0,
  });
}
