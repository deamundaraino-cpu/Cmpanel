import { getSql } from "./db";

/**
 * Configuración GLOBAL de la plataforma (tabla app_settings, clave/valor).
 * Solo la toca el super admin desde /admin — no confundir con `settings`,
 * que es por cliente. La IA se resuelve: valor en BD → fallback a env.
 */

export const AI_KEYS = [
  "llm_provider",
  "llm_api_key",
  "llm_model",
  "llm_base_url",
  "tavily_api_key",
] as const;

export async function getAppSettings(
  keys: readonly string[]
): Promise<Record<string, string | null>> {
  const sql = getSql();
  const rows = await sql<{ key: string; value: string }[]>`
    SELECT key, value FROM app_settings WHERE key = ANY(${[...keys]})
  `;
  const out: Record<string, string | null> = {};
  for (const k of keys) out[k] = null;
  for (const r of rows) out[r.key] = r.value;
  return out;
}

export async function setAppSetting(key: string, value: string): Promise<void> {
  const sql = getSql();
  if (value === "") {
    // Vacío = borrar el override y volver al valor de las env vars.
    await sql`DELETE FROM app_settings WHERE key = ${key}`;
    return;
  }
  await sql`
    INSERT INTO app_settings (key, value) VALUES (${key}, ${value})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
}

/** Clave de Tavily efectiva: override del admin en BD → env var. */
export async function getTavilyKey(): Promise<string> {
  try {
    const s = await getAppSettings(["tavily_api_key"]);
    if (s.tavily_api_key) return s.tavily_api_key;
  } catch {
    // Si la tabla aún no existe, se usa la env var.
  }
  return process.env.TAVILY_API_KEY || "";
}
