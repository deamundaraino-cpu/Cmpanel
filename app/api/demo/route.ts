import { NextRequest, NextResponse } from "next/server";
import { guard, fail } from "@/lib/api";
import { getSql } from "@/lib/db";
import { recomputeScores } from "@/lib/scoring";

const DEMO_POSTS = [
  { caption: "5 errores que matan tu marca personal en Instagram (el #3 lo comete todo el mundo) 🧵 Guarda este post para no olvidarlo.", type: "CAROUSEL_ALBUM", product: "FEED", likes: 420, comments: 61, reach: 18500, saved: 610, shares: 190, days: 3 },
  { caption: "Cómo pasé de 0 a 10K seguidores sin pagar publicidad. La estrategia completa dentro 👇", type: "CAROUSEL_ALBUM", product: "FEED", likes: 380, comments: 44, reach: 15200, saved: 480, shares: 120, days: 8 },
  { caption: "Mi rutina de creación de contenido: 1 hora los lunes = contenido para toda la semana.", type: "IMAGE", product: "FEED", likes: 150, comments: 12, reach: 5400, saved: 95, shares: 22, days: 12 },
  { caption: "¿Por qué nadie ve tus historias? El algoritmo explicado sin humo.", type: "VIDEO", product: "REELS", likes: 260, comments: 35, reach: 12800, saved: 210, shares: 85, days: 15 },
  { caption: "Frase del día: la constancia le gana al talento cuando el talento no es constante. ✨", type: "IMAGE", product: "FEED", likes: 88, comments: 5, reach: 3100, saved: 18, shares: 6, days: 18 },
  { caption: "3 herramientas gratis de IA que uso todos los días para crear contenido (la #2 casi nadie la conoce).", type: "CAROUSEL_ALBUM", product: "FEED", likes: 310, comments: 52, reach: 14100, saved: 520, shares: 160, days: 21 },
  { caption: "Detrás de cámaras de mi setup 🎥", type: "IMAGE", product: "FEED", likes: 95, comments: 9, reach: 3600, saved: 12, shares: 4, days: 24 },
  { caption: "El guion exacto que uso para mis reels que superan 10K vistas. Copia y pega.", type: "VIDEO", product: "REELS", likes: 290, comments: 48, reach: 13500, saved: 445, shares: 130, days: 27 },
  { caption: "Hoy cumplimos 2 años de proyecto. Gracias por estar ahí 🙏", type: "IMAGE", product: "FEED", likes: 130, comments: 28, reach: 4200, saved: 8, shares: 10, days: 31 },
  { caption: "Cuánto cobrar por tus servicios: la fórmula que uso con mis clientes (con ejemplos reales).", type: "CAROUSEL_ALBUM", product: "FEED", likes: 350, comments: 70, reach: 16800, saved: 700, shares: 210, days: 35 },
  { caption: "Un día conmigo trabajando desde casa ☕", type: "VIDEO", product: "REELS", likes: 120, comments: 14, reach: 6800, saved: 35, shares: 15, days: 38 },
  { caption: "Los 7 ganchos que uso para que la gente no deslice mi contenido. Con plantillas.", type: "CAROUSEL_ALBUM", product: "FEED", likes: 330, comments: 55, reach: 14900, saved: 560, shares: 175, days: 42 },
];

export async function POST(req: NextRequest) {
  const g = await guard();
  if (g) return g;
  try {
    const { action } = await req.json().catch(() => ({}));
    const sql = getSql();

    if (action === "clear") {
      await sql`DELETE FROM posts WHERE is_demo = 1`;
      await sql`DELETE FROM stories WHERE id LIKE 'demo-story-%'`;
      await recomputeScores();
      return NextResponse.json({ ok: true, cleared: true });
    }

    const now = Date.now();
    const nowIso = new Date().toISOString();
    for (let i = 0; i < DEMO_POSTS.length; i++) {
      const p = DEMO_POSTS[i];
      const ts = new Date(now - p.days * 86400_000).toISOString();
      await sql`
        INSERT INTO posts (id, caption, media_type, media_product_type, permalink,
          timestamp, like_count, comments_count, reach, saved, shares, views,
          total_interactions, is_demo, last_synced)
        VALUES (${"demo-" + (i + 1)}, ${p.caption}, ${p.type}, ${p.product},
          'https://instagram.com/p/demo', ${ts}, ${p.likes}, ${p.comments}, ${p.reach},
          ${p.saved}, ${p.shares}, ${Math.round(p.reach * 1.4)},
          ${p.likes + p.comments + p.saved + p.shares}, 1, ${nowIso})
        ON CONFLICT (id) DO UPDATE SET
          like_count = EXCLUDED.like_count,
          reach = EXCLUDED.reach,
          timestamp = EXCLUDED.timestamp,
          last_synced = EXCLUDED.last_synced
      `;
    }

    // Historias demo: ~2 por semana en las últimas 6 semanas.
    for (let i = 0; i < 12; i++) {
      const daysAgo = 2 + i * 3.5;
      const views = 350 + Math.round(Math.sin(i * 1.7) * 120) + i * 8;
      const exits = Math.round(views * (0.12 + (i % 4) * 0.03));
      await sql`
        INSERT INTO stories (id, timestamp, media_type, views, reach, replies, shares,
          total_interactions, exits, taps_forward, taps_back, last_synced)
        VALUES (${"demo-story-" + (i + 1)}, ${new Date(now - daysAgo * 86400_000).toISOString()},
          'IMAGE', ${views}, ${Math.round(views * 0.92)}, ${i % 3 === 0 ? 4 + i : 1}, ${i % 2},
          ${6 + (i % 5)}, ${exits}, ${Math.round(views * 0.4)}, ${Math.round(views * 0.08)}, ${nowIso})
        ON CONFLICT (id) DO UPDATE SET
          views = EXCLUDED.views,
          timestamp = EXCLUDED.timestamp,
          last_synced = EXCLUDED.last_synced
      `;
    }

    const today = new Date().toISOString().slice(0, 10);
    await sql`
      INSERT INTO account_snapshots (date, followers_count, media_count)
      VALUES (${today}, 8450, ${DEMO_POSTS.length})
      ON CONFLICT (date) DO UPDATE SET followers_count = EXCLUDED.followers_count
    `;

    const { winners } = await recomputeScores();
    return NextResponse.json({ ok: true, seeded: DEMO_POSTS.length, winners });
  } catch (e) {
    return fail(e);
  }
}
