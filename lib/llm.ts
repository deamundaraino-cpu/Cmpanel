import { jsonrepair } from "jsonrepair";
import { getAppSettings } from "./appSettings";

export class LlmError extends Error {
  transient: boolean;
  constructor(message: string, transient = false) {
    super(message);
    this.name = "LlmError";
    this.transient = transient;
  }
}

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

async function callProvider(cfg: ProviderCall, system: string, user: string): Promise<string> {
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.7,
      // Los guiones y carruseles son JSON largos; sin margen el modelo corta la
      // respuesta a medias (o la gasta entera "pensando") y llega vacía.
      max_tokens: 6000,
    }),
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
    throw new LlmError(`El proveedor de IA no devolvió contenido${why}.`, true);
  }
  return content;
}

export async function chat(system: string, user: string): Promise<string> {
  const primary = await getLlmConfig();
  // Ante fallos transitorios (saturación, rate limit o respuesta vacía) se
  // reintenta y, si sigue, se pasa al respaldo. Los errores de configuración o
  // de autenticación se lanzan tal cual: serían iguales en cualquier intento.
  const attempts: { cfg: ProviderCall; tries: number }[] = [{ cfg: primary, tries: 2 }];
  const fallback = await getFallbackLlmConfig();
  if (fallback && fallback.provider !== primary.provider) attempts.push({ cfg: fallback, tries: 2 });

  let last: unknown = new LlmError("La IA no respondió.");
  for (const { cfg, tries } of attempts) {
    for (let i = 0; i < tries; i++) {
      try {
        return await callProvider(cfg, system, user);
      } catch (e) {
        if (!(e instanceof LlmError) || !e.transient) throw e;
        last = e;
      }
    }
  }
  throw last;
}

/** Pide una respuesta JSON y la parsea con tolerancia a texto extra. */
export async function chatJson<T>(system: string, user: string): Promise<T> {
  const raw = await chat(
    system + "\nResponde ÚNICAMENTE con JSON válido, sin texto adicional ni markdown.",
    user
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
