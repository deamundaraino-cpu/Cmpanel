import { getSql, PostRow } from "./db";
import {
  getProfile,
  getMedia,
  getMediaInsights,
  getStories,
  getStoryInsights,
  getComments,
  refreshToken,
} from "./instagram";
import { recomputeScores } from "./scoring";
import { getSetting, setSetting } from "./settings";

export type SyncResult = {
  synced: number;
  syncedStories: number;
  syncedComments: number;
  scored: number;
  winners: number;
  tokenRefreshed: boolean;
  username: string;
};

/**
 * Sincronización completa con Instagram: perfil, posts, historias y comentarios.
 * `maxPosts`: 100 para el sync manual; 25 para el cron diario (límite de duración de Vercel).
 */
export async function runSync(maxPosts = 100): Promise<SyncResult> {
  const sql = getSql();

  // Auto-renovación del token si tiene más de 45 días (caduca a los 60).
  let tokenRefreshed = false;
  const fetchedAt = await getSetting("ig_token_fetched_at");
  if (fetchedAt) {
    const ageDays = (Date.now() - new Date(fetchedAt).getTime()) / 86400_000;
    if (ageDays > 45) {
      try {
        await refreshToken();
        tokenRefreshed = true;
      } catch {
        // Si falla, el sync sigue con el token actual; la alerta avisará.
      }
    }
  }

  const profile = await getProfile();
  await setSetting("ig_username", profile.username || "");

  const today = new Date().toISOString().slice(0, 10);
  await sql`
    INSERT INTO account_snapshots (date, followers_count, media_count)
    VALUES (${today}, ${profile.followers_count || 0}, ${profile.media_count || 0})
    ON CONFLICT (date) DO UPDATE SET
      followers_count = EXCLUDED.followers_count,
      media_count = EXCLUDED.media_count
  `;

  // Posts + insights
  const media = await getMedia(maxPosts);
  let synced = 0;
  for (const m of media) {
    const insights = await getMediaInsights(m.id);
    await sql`
      INSERT INTO posts (id, caption, media_type, media_product_type, media_url, thumbnail_url,
        permalink, timestamp, like_count, comments_count, reach, saved, shares, views,
        total_interactions, is_demo, last_synced)
      VALUES (${m.id}, ${m.caption || null}, ${m.media_type || null}, ${m.media_product_type || null},
        ${m.media_url || null}, ${m.thumbnail_url || null}, ${m.permalink || null}, ${m.timestamp || null},
        ${m.like_count || 0}, ${m.comments_count || 0}, ${insights.reach || 0}, ${insights.saved || 0},
        ${insights.shares || 0}, ${insights.views || 0}, ${insights.total_interactions || 0}, 0,
        ${new Date().toISOString()})
      ON CONFLICT (id) DO UPDATE SET
        caption = EXCLUDED.caption,
        like_count = EXCLUDED.like_count,
        comments_count = EXCLUDED.comments_count,
        reach = EXCLUDED.reach,
        saved = EXCLUDED.saved,
        shares = EXCLUDED.shares,
        views = EXCLUDED.views,
        total_interactions = EXCLUDED.total_interactions,
        media_url = EXCLUDED.media_url,
        thumbnail_url = EXCLUDED.thumbnail_url,
        last_synced = EXCLUDED.last_synced
    `;
    synced++;
  }

  // Historias activas: la API solo las expone 24 h; aquí se persisten para siempre.
  let syncedStories = 0;
  try {
    const stories = await getStories();
    for (const s of stories) {
      const insights = await getStoryInsights(s.id);
      await sql`
        INSERT INTO stories (id, timestamp, media_type, media_url, thumbnail_url, caption,
          views, reach, replies, shares, total_interactions, exits, taps_forward, taps_back, last_synced)
        VALUES (${s.id}, ${s.timestamp || null}, ${s.media_type || null}, ${s.media_url || null},
          ${s.thumbnail_url || null}, ${s.caption || null}, ${insights.views || 0}, ${insights.reach || 0},
          ${insights.replies || 0}, ${insights.shares || 0}, ${insights.total_interactions || 0},
          ${insights.exits || 0}, ${insights.taps_forward || 0}, ${insights.taps_back || 0},
          ${new Date().toISOString()})
        ON CONFLICT (id) DO UPDATE SET
          views = EXCLUDED.views,
          reach = EXCLUDED.reach,
          replies = EXCLUDED.replies,
          shares = EXCLUDED.shares,
          total_interactions = EXCLUDED.total_interactions,
          exits = EXCLUDED.exits,
          taps_forward = EXCLUDED.taps_forward,
          taps_back = EXCLUDED.taps_back,
          last_synced = EXCLUDED.last_synced
      `;
      syncedStories++;
    }
  } catch {
    // Las historias no deben romper el sync de posts.
  }

  // Comentarios de los 10 posts con más interacción (materia prima para ideas).
  let syncedComments = 0;
  try {
    const topPosts = await sql<PostRow[]>`
      SELECT id FROM posts WHERE is_demo = 0
      ORDER BY (like_count + comments_count + saved + shares) DESC
      LIMIT 10
    `;
    for (const p of topPosts) {
      const comments = await getComments(p.id);
      for (const c of comments) {
        if (!c.text?.trim()) continue;
        await sql`
          INSERT INTO comments (id, post_id, text, like_count, timestamp, last_synced)
          VALUES (${c.id}, ${p.id}, ${c.text}, ${c.like_count || 0}, ${c.timestamp || null},
            ${new Date().toISOString()})
          ON CONFLICT (id) DO UPDATE SET
            text = EXCLUDED.text,
            like_count = EXCLUDED.like_count,
            last_synced = EXCLUDED.last_synced
        `;
        syncedComments++;
      }
    }
  } catch {
    // Comentarios tampoco bloquean el sync.
  }

  const { scored, winners } = await recomputeScores();
  return {
    synced,
    syncedStories,
    syncedComments,
    scored,
    winners,
    tokenRefreshed,
    username: profile.username,
  };
}
