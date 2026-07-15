import { PostRow, StoryRow } from "./db";

function mondayOf(d: Date): Date {
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return monday;
}

const shortDate = (d: Date) => d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" });

export function weeklyBuckets(posts: PostRow[]): {
  reach: { label: string; value: number }[];
  er: { label: string; value: number }[];
} {
  const map = new Map<string, { reach: number; erSum: number; count: number }>();
  for (const p of posts) {
    if (!p.timestamp) continue;
    const key = mondayOf(new Date(p.timestamp)).toISOString().slice(0, 10);
    const entry = map.get(key) || { reach: 0, erSum: 0, count: 0 };
    entry.reach += p.reach;
    entry.erSum += p.er;
    entry.count += 1;
    map.set(key, entry);
  }
  const sorted = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  return {
    reach: sorted.map(([key, v]) => ({ label: shortDate(new Date(key)), value: v.reach })),
    er: sorted.map(([key, v]) => ({
      label: shortDate(new Date(key)),
      value: v.count ? v.erSum / v.count : 0,
    })),
  };
}

const FORMAT_COLORS: Record<string, string> = {
  Carrusel: "#3987e5",
  Reel: "#199e70",
  Imagen: "#c98500",
};

export function formatBreakdown(posts: PostRow[]) {
  const groups: Record<string, { erSum: number; count: number }> = {
    Carrusel: { erSum: 0, count: 0 },
    Reel: { erSum: 0, count: 0 },
    Imagen: { erSum: 0, count: 0 },
  };
  for (const p of posts) {
    const key =
      p.media_product_type === "REELS"
        ? "Reel"
        : p.media_type === "CAROUSEL_ALBUM"
          ? "Carrusel"
          : "Imagen";
    groups[key].erSum += p.er;
    groups[key].count += 1;
  }
  return Object.entries(groups)
    .filter(([, v]) => v.count > 0)
    .map(([label, v]) => ({
      label,
      value: v.count ? v.erSum / v.count : 0,
      color: FORMAT_COLORS[label],
    }));
}

export function dayOfWeekBreakdown(posts: PostRow[]) {
  const labels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const sums = new Array(7).fill(0);
  const counts = new Array(7).fill(0);
  for (const p of posts) {
    if (!p.timestamp) continue;
    const idx = (new Date(p.timestamp).getDay() + 6) % 7;
    sums[idx] += p.er;
    counts[idx] += 1;
  }
  return labels.map((label, i) => ({ label, value: counts[i] ? sums[i] / counts[i] : 0 }));
}

export function weeklyStories(stories: StoryRow[]): {
  count: { label: string; value: number }[];
  reach: { label: string; value: number }[];
} {
  const map = new Map<string, { count: number; reach: number }>();
  for (const s of stories) {
    if (!s.timestamp) continue;
    const key = mondayOf(new Date(s.timestamp)).toISOString().slice(0, 10);
    const entry = map.get(key) || { count: 0, reach: 0 };
    entry.count += 1;
    entry.reach += s.reach;
    map.set(key, entry);
  }
  const sorted = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  return {
    count: sorted.map(([key, v]) => ({ label: shortDate(new Date(key)), value: v.count })),
    reach: sorted.map(([key, v]) => ({
      label: shortDate(new Date(key)),
      value: v.count ? Math.round(v.reach / v.count) : 0,
    })),
  };
}

export type HeatCell = { value: number; count: number; intensity: number };

/** Matriz 7 días × 4 franjas horarias con ER medio, para el heatmap de publicación. */
export function postingHeatmap(posts: PostRow[]): {
  days: string[];
  slots: string[];
  grid: HeatCell[][];
} {
  const days = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const slots = ["6-12h", "12-17h", "17-21h", "21-6h"];
  const sums: number[][] = Array.from({ length: 4 }, () => new Array(7).fill(0));
  const counts: number[][] = Array.from({ length: 4 }, () => new Array(7).fill(0));

  for (const p of posts) {
    if (!p.timestamp) continue;
    const d = new Date(p.timestamp);
    const day = (d.getDay() + 6) % 7;
    const h = d.getHours();
    const slot = h >= 6 && h < 12 ? 0 : h >= 12 && h < 17 ? 1 : h >= 17 && h < 21 ? 2 : 3;
    sums[slot][day] += p.er;
    counts[slot][day] += 1;
  }

  const avgs = sums.map((row, s) => row.map((v, d) => (counts[s][d] ? v / counts[s][d] : 0)));
  const max = Math.max(...avgs.flat(), 0.0001);
  const grid: HeatCell[][] = avgs.map((row, s) =>
    row.map((v, d) => ({ value: v, count: counts[s][d], intensity: v / max }))
  );
  return { days, slots, grid };
}

export function periodDelta(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? 100 : null;
  return ((current - previous) / previous) * 100;
}
