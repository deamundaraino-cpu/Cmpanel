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
    });
  }
  return client;
}

export type UserRow = {
  id: string;
  email: string;
  role: string;
  ai_daily_limit: number | null;
  last_synced_at: string | null;
  onboarded: number;
  created_at: string;
};

export type PostRow = {
  user_id: string;
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
  user_id: string;
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
};

export type StructureBeat = { nombre: string; guia: string };

export type StructureRow = {
  id: number;
  user_id: string | null; // null = builtin global
  created_at: string;
  nombre: string;
  descripcion: string | null;
  beats: string;
  is_builtin: number;
};

export type CampaignRow = {
  id: number;
  user_id: string;
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
  user_id: string;
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
  user_id: string;
  created_at: string;
  period_days: number;
  content: string;
};

export type StoryRow = {
  user_id: string;
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
  user_id: string;
  id: string;
  post_id: string;
  text: string | null;
  like_count: number;
  timestamp: string | null;
  last_synced: string | null;
};
