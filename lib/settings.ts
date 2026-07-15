import { getSql } from "./db";

export async function getSetting(key: string): Promise<string | null> {
  const sql = getSql();
  const rows = await sql<{ value: string }[]>`SELECT value FROM settings WHERE key = ${key}`;
  return rows[0]?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO settings (key, value) VALUES (${key}, ${value})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
}

export async function getSettings(keys: string[]): Promise<Record<string, string | null>> {
  const sql = getSql();
  const rows = await sql<{ key: string; value: string }[]>`
    SELECT key, value FROM settings WHERE key = ANY(${keys})
  `;
  const out: Record<string, string | null> = {};
  for (const k of keys) out[k] = null;
  for (const r of rows) out[r.key] = r.value;
  return out;
}

// Claves usadas en la app:
// ig_token, ig_token_fetched_at, ig_user_id, ig_username
// llm_provider (groq|openrouter|gemini|custom), llm_api_key, llm_model, llm_base_url
// tavily_api_key
// brand_name, brand_handle, brand_color, brand_color_secondary, brand_visual_style,
// brand_logo, brand_niche, brand_mission, brand_audience, brand_value_prop,
// brand_tone, brand_pillars, brand_objectives, brand_avoid
