import { getSql, PostRow } from "./db";

/**
 * Engagement ponderado: guardados y compartidos pesan más porque son
 * las señales que Instagram premia y las que indican contenido valioso.
 */
export function engagementRate(p: {
  like_count: number;
  comments_count: number;
  saved: number;
  shares: number;
  reach: number;
}, followersFallback: number): number {
  const base = p.reach > 0 ? p.reach : followersFallback;
  if (!base) return 0;
  const weighted = p.like_count + p.comments_count + 2 * p.saved + 3 * p.shares;
  return weighted / base;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Recalcula ER, nota 1-10 (por percentil frente a tu propia media)
 * y marca ganadores (ER >= 1.5x mediana con alcance >= mediana).
 */
export async function recomputeScores(): Promise<{ scored: number; winners: number }> {
  const sql = getSql();
  const posts = await sql<PostRow[]>`SELECT * FROM posts`;
  if (!posts.length) return { scored: 0, winners: 0 };

  const snap = await sql<{ followers_count: number }[]>`
    SELECT followers_count FROM account_snapshots ORDER BY date DESC LIMIT 1
  `;
  const followers = Number(snap[0]?.followers_count || 0);

  const withEr = posts.map((p) => ({ ...p, er: engagementRate(p, followers) }));
  const ers = withEr.map((p) => p.er);
  const medEr = median(ers);
  const medReach = median(withEr.map((p) => p.reach));
  const sorted = [...ers].sort((a, b) => a - b);

  let winners = 0;
  const updates = withEr.map((p) => {
    const rank = sorted.findIndex((v) => v >= p.er);
    const percentile = sorted.length > 1 ? rank / (sorted.length - 1) : 0.5;
    const score = Math.round((1 + percentile * 9) * 10) / 10;
    const isWinner = medEr > 0 && p.er >= 1.5 * medEr && p.reach >= medReach ? 1 : 0;
    winners += isWinner;
    return { id: p.id, er: p.er, score, is_winner: isWinner };
  });

  await sql.begin(async (tx) => {
    for (const u of updates) {
      await tx`
        UPDATE posts SET er = ${u.er}, score = ${u.score}, is_winner = ${u.is_winner}
        WHERE id = ${u.id}
      `;
    }
  });

  return { scored: posts.length, winners };
}

export async function statsSummary() {
  const sql = getSql();
  const posts = await sql<PostRow[]>`SELECT * FROM posts ORDER BY timestamp DESC`;
  const totalReach = posts.reduce((a, p) => a + p.reach, 0);
  const totalInteractions = posts.reduce(
    (a, p) => a + p.like_count + p.comments_count + p.saved + p.shares,
    0
  );
  const avgEr = posts.length
    ? posts.reduce((a, p) => a + p.er, 0) / posts.length
    : 0;
  return { posts, totalReach, totalInteractions, avgEr };
}
