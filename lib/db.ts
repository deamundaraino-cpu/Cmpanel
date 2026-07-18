import postgres from "postgres";

let client: ReturnType<typeof postgres> | null = null;

/**
 * Cliente Postgres (Supabase) singleton.
 * Usar el Transaction Pooler de Supabase (puerto 6543) → prepare: false obligatorio.
 */
export function getSql() {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("Falta DATABASE_URL (URI del Transaction Pooler de Supabase).");
    }
    client = postgres(url, {
      ssl: "require",
      max: 5,
      prepare: false,
      idle_timeout: 20,
      // BIGINT (ids de clients/proposals/campaigns…) como number, no string:
      // los ids de esta app nunca se acercan a Number.MAX_SAFE_INTEGER y el
      // código compara ids con === contra numbers (cookies, props).
      types: {
        bigint: {
          to: 20,
          from: [20],
          serialize: (v: number | string) => String(v),
          parse: (v: string) => Number(v),
        },
      },
    });
  }
  return client;
}

export type UserRow = {
  id: string;
  email: string;
  role: string;
  ai_daily_limit: number | null;
  onboarded: number;
  created_at: string;
};

/** Un cliente/marca gestionado por un editor (el límite de tenancy del contenido). */
export type ClientRow = {
  id: number;
  owner_user_id: string;
  created_at: string;
  nombre: string;
  color: string;
  estado: string;
  last_synced_at: string | null;
};

export type PostRow = {
  client_id: number;
  id: string;
  caption: string | null;
  media_type: string | null;
  media_product_type: string | null;
  media_url: string | null;
  thumbnail_url: string | null;
  permalink: string | null;
  timestamp: string | null;
  like_count: number;
  comments_count: number;
  reach: number;
  saved: number;
  shares: number;
  views: number;
  total_interactions: number;
  er: number;
  score: number | null;
  is_winner: number;
  is_demo: number;
  last_synced: string | null;
  campaign_id: number | null;
};

export type ProposalRow = {
  id: number;
  client_id: number;
  post_id: string | null;
  created_at: string;
  status: string;
  formato: string | null;
  slides: string | null;
  caption: string | null;
  hashtags: string | null;
  structure_id: number | null;
  quality: number | null;
  quality_notes: string | null;
  share_token: string | null;
  client_feedback: string | null;
};

export type StructureBeat = { nombre: string; guia: string };

export type StructureRow = {
  id: number;
  user_id: string | null; // null = builtin global; librería del editor, no del cliente
  created_at: string;
  nombre: string;
  descripcion: string | null;
  beats: string;
  is_builtin: number;
};

export type CampaignRow = {
  id: number;
  client_id: number;
  created_at: string;
  nombre: string;
  descripcion: string | null;
  color: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  estado: string;
};

export type CalendarItemRow = {
  id: number;
  client_id: number;
  created_at: string;
  fecha: string;
  titulo: string;
  formato: string | null;
  estado: string;
  campaign_id: number | null;
  proposal_id: number | null;
  notas: string | null;
};

export type ReportRow = {
  id: number;
  client_id: number;
  created_at: string;
  period_days: number;
  content: string;
  share_token: string | null;
};

export type StoryRow = {
  client_id: number;
  id: string;
  timestamp: string | null;
  media_type: string | null;
  media_url: string | null;
  thumbnail_url: string | null;
  caption: string | null;
  views: number;
  reach: number;
  replies: number;
  shares: number;
  total_interactions: number;
  exits: number;
  taps_forward: number;
  taps_back: number;
  last_synced: string | null;
};

export type CommentRow = {
  client_id: number;
  id: string;
  post_id: string;
  text: string | null;
  like_count: number;
  timestamp: string | null;
  last_synced: string | null;
};
