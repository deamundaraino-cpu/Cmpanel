import { jsonrepair } from "jsonrepair";
import { getAppSettings } from "./appSettings";

export class LlmError extends Error {
  transient: boolean;
  /** Respuesta cortada por max_tokens: reintentar igual no sirve, hay que dar más margen. */
  length: boolean;
  constructor(message: string, transient = false, length = false) {
    super(message);
    this.name = "LlmError";
    this.transient = transient;
    this.length = length;
  }
}

const DEFAULT_MAX_TOKENS = 6000;
const MAX_TOKENS_CAP = 32000;

export const PROVIDERS: Record<string, { baseUrl: string; model: string; label: string }> = {
  groq: {
    baseUrl: "https://api.groq.com/openai/v1",
    model: "llama-3.3-70b-versatile",
    label: "Groq (gratis)",
  },
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    model: "nvidia/nemotron-3-super-120b-a12b:free",
    label: "OpenRouter (modelos :free)",
  },
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-flash-latest",
    label: "Google Gemini (capa gratis)",
  },
  custom: { baseUrl: "", model: "", label: "Personalizado" },
};

// La IA es del dueño de la plataforma: el super admin puede fijar proveedor,
// modelo y llave desde /admin (tabla app_settings); sin override en BD se
// usan las variables de entorno. Los editores no ven ni ponen llaves.
export async function getLlmConfig() {
  let db: Record<string, string | null> = {};
  try {
    db = await getAppSettings(["llm_provider", "llm_api_key", "llm_model", "llm_base_url"]);
  } catch {
    // Tabla app_settings aún no creada: solo env vars.
  }
  const envProvider = process.env.LLM_PROVIDER || "groq";
  const provider = db.llm_provider || envProvider;
  const preset = PROVIDERS[provider] || PROVIDERS.groq;
  const baseUrl = db.llm_base_url || process.env.LLM_BASE_URL || preset.baseUrl;
  const model = db.llm_model || process.env.LLM_MODEL || preset.model;
  // La llave del entorno es de SU proveedor: mandársela a otro solo produce un
  // "Invalid API Key" confuso. Cada proveedor usa la suya o no se usa.
  const envKey = provider === envProvider ? process.env.LLM_API_KEY || "" : "";
  const apiKey = db.llm_api_key || envKey;
  const source: "db" | "env" = db.llm_api_key || db.llm_provider ? "db" : "env";
  if (!apiKey) {
    throw new LlmError(
      db.llm_provider
        ? `La IA está configurada como "${provider}" en /admin pero sin llave propia (la del servidor es de "${envProvider}"). Pega una llave de ${provider} o deja el proveedor vacío.`
        : "La IA no está configurada (ponla en /admin o en las env del servidor)."
    );
  }
  if (!baseUrl) throw new LlmError("Falta la URL base del proveedor de IA.");
  return { provider, baseUrl, model, apiKey, source };
}

type ProviderCall = { provider: string; baseUrl: string; model: string; apiKey: string };

// Respaldo si el proveedor principal falla por saturación (503/429): OpenRouter
// con un modelo :free. Sin llave configurada, simplemente no hay respaldo.
async function getFallbackLlmConfig(): Promise<ProviderCall | null> {
  let db: Record<string, string | null> = {};
  try {
    db = await getAppSettings(["llm_fallback_api_key", "llm_fallback_model", "llm_fallback_base_url"]);
  } catch {
    // Tabla app_settings aún no creada: solo env vars.
  }
  const apiKey = db.llm_fallback_api_key || process.env.OPENROUTER_API_KEY || "";
  if (!apiKey) return null;
  const preset = PROVIDERS.openrouter;
  return {
    provider: "openrouter",
    baseUrl: db.llm_fallback_base_url || preset.baseUrl,
    model: db.llm_fallback_model || preset.model,
    apiKey,
  };
}

/**
 * Opciones de muestreo por llamada. La temperatura era fija en 0.7 para todo,
 * así que dos generaciones del mismo tema no tenían de dónde salir distintas, y
 * una reparación de reglas —que debería ser conservadora— corría igual de suelta
 * que una escritura desde cero.
 */
export type SamplingOptions = {
  temperature?: number;
  seed?: number;
  /** Margen de salida (incluye lo que el modelo gasta "pensando"). */
  maxTokens?: number;
};

/**
 * Escribir y corregir no son la misma tarea: una pide variedad y la otra
 * fidelidad. Antes ambas corrían a 0.7.
 */
export const TEMP = {
  /**
   * Pieza nueva. Cada variante sube un escalón para separarlas más, pero poco:
   * por encima de ~0.9 el modelo empieza a devolver guiones truncados y comillas
   * mal cerradas en un JSON tan largo. La variedad real la dan las familias de
   * gancho (lib/angles.ts), no la temperatura.
   */
  generacion: 0.8,
  escalonVariante: 0.1,
  /** Reparar reglas de marca: se cambia lo mínimo, no se reinventa. */
  reparacion: 0.3,
  /** Aplicar un retoque pedido por el editor. */
  retoque: 0.5,
  /** Reescribir de raíz cuando el feedback cuestiona el fondo. */
  reescritura: 0.9,
} as const;

/** El respaldo de OpenRouter/Groq admite `seed`; Gemini vía capa OpenAI-compat puede rechazarlo. */
const ADMITE_SEED = new Set(["openrouter", "groq"]);

export function buildRequestBody(cfg: ProviderCall, system: string, user: string, opts: SamplingOptions = {}) {
  return {
    model: cfg.model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: opts.temperature ?? 0.7,
    ...(opts.seed !== undefined && ADMITE_SEED.has(cfg.provider) ? { seed: opts.seed } : {}),
    // Los guiones y carruseles son JSON largos; sin margen el modelo corta la
    // respuesta a medias (o la gasta entera "pensando") y llega vacía.
    max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
  };
}

async function callProvider(cfg: ProviderCall, system: string, user: string, opts: SamplingOptions = {}): Promise<string> {
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify(buildRequestBody(cfg, system, user, opts)),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const transient = res.status === 503 || res.status === 429 || res.status >= 500;
    throw new LlmError(json?.error?.message || `Error del proveedor de IA (${res.status})`, transient);
  }
  const choice = json?.choices?.[0];
  const message = choice?.message;
  // Los modelos con razonamiento a veces dejan el contenido vacío y el JSON
  // dentro del razonamiento: se aprovecha antes de darlo por perdido.
  const content = message?.content?.trim() || (/[{[]/.test(message?.reasoning || "") ? message.reasoning : "");
  if (!content) {
    const why = choice?.finish_reason === "length" ? " (se quedó sin espacio)" : choice?.finish_reason ? ` (${choice.finish_reason})` : "";
    // Transitorio: con otro intento, o con el proveedor de respaldo, suele salir.
    throw new LlmError(`El proveedor de IA no devolvió contenido${why}.`, true, choice?.finish_reason === "length");
  }
  return content;
}

export async function chat(system: string, user: string, opts: SamplingOptions = {}): Promise<string> {
  const primary = await getLlmConfig();
  // Ante fallos transitorios (saturación, rate limit o respuesta vacía) se
  // reintenta y, si sigue, se pasa al respaldo. Los errores de configuración o
  // de autenticación se lanzan tal cual: serían iguales en cualquier intento.
  const attempts: { cfg: ProviderCall; tries: number }[] = [{ cfg: primary, tries: 2 }];
  const fallback = await getFallbackLlmConfig();
  if (fallback && fallback.provider !== primary.provider) attempts.push({ cfg: fallback, tries: 2 });

  let last: unknown = new LlmError("La IA no respondió.");
  for (const { cfg, tries } of attempts) {
    let callOpts = opts;
    for (let i = 0; i < tries; i++) {
      try {
        return await callProvider(cfg, system, user, callOpts);
      } catch (e) {
        if (!(e instanceof LlmError) || !e.transient) throw e;
        last = e;
        // Cortada por espacio: el mismo intento volvería a cortarse. Doble margen.
        if (e.length) {
          const actual = callOpts.maxTokens ?? DEFAULT_MAX_TOKENS;
          callOpts = { ...callOpts, maxTokens: Math.min(actual * 2, MAX_TOKENS_CAP) };
        }
      }
    }
  }
  throw last;
}

/** Pide una respuesta JSON y la parsea con tolerancia a texto extra. */
export async function chatJson<T>(system: string, user: string, opts: SamplingOptions = {}): Promise<T> {
  const raw = await chat(
    system + "\nResponde ÚNICAMENTE con JSON válido, sin texto adicional ni markdown.",
    user,
    opts
  );
  const cleaned = raw.replace(/```json|```/g, "").trim();
  const start = cleaned.search(/[{[]/);
  if (start === -1) throw new LlmError("La IA no devolvió JSON.");
  const opener = cleaned[start];
  const closer = opener === "{" ? "}" : "]";
  const end = cleaned.lastIndexOf(closer);
  if (end === -1) throw new LlmError("JSON incompleto de la IA.");
  const slice = cleaned.slice(start, end + 1);
  try {
    return JSON.parse(slice) as T;
  } catch {
    // Los modelos gratuitos a veces devuelven comillas o saltos de línea
    // mal escapados; jsonrepair tolera esos fallos típicos antes de rendirse.
    try {
      return JSON.parse(jsonrepair(slice)) as T;
    } catch {
      throw new LlmError("No se pudo parsear el JSON de la IA.");
    }
  }
}
