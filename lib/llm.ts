import { jsonrepair } from "jsonrepair";

export class LlmError extends Error {}

export const PROVIDERS: Record<string, { baseUrl: string; model: string; label: string }> = {
  groq: {
    baseUrl: "https://api.groq.com/openai/v1",
    model: "llama-3.3-70b-versatile",
    label: "Groq (gratis)",
  },
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    model: "meta-llama/llama-3.3-70b-instruct:free",
    label: "OpenRouter (modelos :free)",
  },
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-flash-latest",
    label: "Google Gemini (capa gratis)",
  },
  custom: { baseUrl: "", model: "", label: "Personalizado" },
};

// La IA es del dueño de la plataforma: se configura solo con variables de
// entorno del servidor (los usuarios no ven ni ponen llaves).
function getConfig() {
  const provider = process.env.LLM_PROVIDER || "groq";
  const preset = PROVIDERS[provider] || PROVIDERS.groq;
  const baseUrl = process.env.LLM_BASE_URL || preset.baseUrl;
  const model = process.env.LLM_MODEL || preset.model;
  const apiKey = process.env.LLM_API_KEY || "";
  if (!apiKey) {
    throw new LlmError("La IA no está configurada en el servidor (falta LLM_API_KEY).");
  }
  if (!baseUrl) throw new LlmError("Falta la URL base del proveedor de IA (LLM_BASE_URL).");
  return { baseUrl, model, apiKey };
}

export async function chat(system: string, user: string): Promise<string> {
  const { baseUrl, model, apiKey } = getConfig();
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.7,
    }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new LlmError(
      json?.error?.message || `Error del proveedor de IA (${res.status})`
    );
  }
  const content = json?.choices?.[0]?.message?.content;
  if (!content) throw new LlmError("El proveedor de IA no devolvió contenido.");
  return content;
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
