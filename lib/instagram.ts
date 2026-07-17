import { getSetting, setSetting } from "./settings";

const BASE = "https://graph.instagram.com/v23.0";

export class IgError extends Error {}

async function igFetch(clientId: number, path: string, params: Record<string, string>) {
  const token = await getSetting(clientId, "ig_token");
  if (!token) throw new IgError("No hay token de Instagram configurado. Ve a Ajustes.");
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", token);
  const res = await fetch(url.toString());
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new IgError(json.error?.message || `Error de Instagram (${res.status})`);
  }
  return json;
}

export type IgProfile = {
  user_id: string;
  username: string;
  followers_count: number;
  media_count: number;
};

export async function getProfile(clientId: number): Promise<IgProfile> {
  const me = await igFetch(clientId, "/me", {
    fields: "user_id,username,followers_count,media_count",
  });
  return me as IgProfile;
}

export type IgMedia = {
  id: string;
  caption?: string;
  media_type: string;
  media_product_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
};

export async function getMedia(clientId: number, maxPosts = 100): Promise<IgMedia[]> {
  const fields =
    "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count";
  let out: IgMedia[] = [];
  let after: string | undefined;
  while (out.length < maxPosts) {
    const params: Record<string, string> = { fields, limit: "25" };
    if (after) params.after = after;
    const page = await igFetch(clientId, "/me/media", params);
    out = out.concat(page.data || []);
    after = page.paging?.cursors?.after;
    if (!after || !page.data?.length) break;
  }
  return out.slice(0, maxPosts);
}

export type IgInsights = {
  reach: number;
  saved: number;
  shares: number;
  views: number;
  total_interactions: number;
};

export async function getMediaInsights(clientId: number, mediaId: string): Promise<Partial<IgInsights>> {
  const metricSets = [
    "reach,saved,shares,views,total_interactions",
    "reach,saved,total_interactions",
    "reach",
  ];
  for (const metric of metricSets) {
    try {
      const res = await igFetch(clientId, `/${mediaId}/insights`, { metric });
      const out: Partial<IgInsights> = {};
      for (const item of res.data || []) {
        const value = item.total_value?.value ?? item.values?.[0]?.value ?? 0;
        out[item.name as keyof IgInsights] = value;
      }
      return out;
    } catch {
      continue;
    }
  }
  return {};
}

export type IgStory = {
  id: string;
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  caption?: string;
  timestamp?: string;
};

/** Historias activas (Instagram solo expone las de las últimas 24 h). */
export async function getStories(clientId: number): Promise<IgStory[]> {
  const res = await igFetch(clientId, "/me/stories", {
    fields: "id,media_type,media_url,thumbnail_url,caption,timestamp",
  });
  return (res.data || []) as IgStory[];
}

export type IgStoryInsights = {
  views: number;
  reach: number;
  replies: number;
  shares: number;
  total_interactions: number;
  exits: number;
  taps_forward: number;
  taps_back: number;
};

export async function getStoryInsights(clientId: number, storyId: string): Promise<Partial<IgStoryInsights>> {
  const out: Partial<IgStoryInsights> = {};

  // Métricas simples, con fallback si alguna no está disponible para la cuenta.
  const metricSets = [
    "views,reach,replies,shares,total_interactions",
    "views,reach,replies",
    "reach",
  ];
  for (const metric of metricSets) {
    try {
      const res = await igFetch(clientId, `/${storyId}/insights`, {
        metric,
        metric_type: "total_value",
      });
      for (const item of res.data || []) {
        const value = item.total_value?.value ?? item.values?.[0]?.value ?? 0;
        out[item.name as keyof IgStoryInsights] = value;
      }
      break;
    } catch {
      continue;
    }
  }

  // Navegación (salidas y taps) con breakdown; opcional, no bloquea si falla.
  try {
    const res = await igFetch(clientId, `/${storyId}/insights`, {
      metric: "navigation",
      metric_type: "total_value",
      breakdown: "story_navigation_action_type",
    });
    const results =
      res.data?.[0]?.total_value?.breakdowns?.[0]?.results || [];
    for (const r of results) {
      const kind = r.dimension_values?.[0];
      const value = r.value || 0;
      if (kind === "story_exit") out.exits = value;
      if (kind === "tap_forward" || kind === "swipe_forward") {
        out.taps_forward = (out.taps_forward || 0) + value;
      }
      if (kind === "tap_back") out.taps_back = value;
    }
  } catch {
    // sin datos de navegación
  }

  return out;
}

export type IgComment = {
  id: string;
  text?: string;
  like_count?: number;
  timestamp?: string;
};

/** Comentarios de un post (para minería de ideas). */
export async function getComments(clientId: number, mediaId: string, limit = 25): Promise<IgComment[]> {
  try {
    const res = await igFetch(clientId, `/${mediaId}/comments`, {
      fields: "id,text,like_count,timestamp",
      limit: String(limit),
    });
    return (res.data || []) as IgComment[];
  } catch {
    // Posts con comentarios desactivados o sin permiso: no es un error fatal.
    return [];
  }
}

/** Renueva el token de larga duración (caduca a los 60 días). */
export async function refreshToken(clientId: number): Promise<void> {
  const token = await getSetting(clientId, "ig_token");
  if (!token) throw new IgError("No hay token que renovar.");
  const url = new URL("https://graph.instagram.com/refresh_access_token");
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", token);
  const res = await fetch(url.toString());
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new IgError(json.error?.message || "No se pudo renovar el token.");
  }
  await setSetting(clientId, "ig_token", json.access_token);
  await setSetting(clientId, "ig_token_fetched_at", new Date().toISOString());
}
