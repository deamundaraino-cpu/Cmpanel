import { NextRequest, NextResponse } from "next/server";
import { guardAdmin, fail } from "@/lib/api";
import { getAppSettings, setAppSetting, AI_KEYS } from "@/lib/appSettings";
import { chat, getLlmConfig, PROVIDERS } from "@/lib/llm";

// Panel de IA del super admin: overrides globales en app_settings.
// Valor vacío = borrar override y volver a la variable de entorno.

const SECRET_KEYS = new Set(["llm_api_key", "tavily_api_key"]);

function mask(v: string | null) {
  if (!v) return "";
  return v.length <= 8 ? "••••" : v.slice(0, 4) + "••••" + v.slice(-4);
}

export async function GET() {
  const auth = await guardAdmin();
  if (auth instanceof NextResponse) return auth;
  const db = await getAppSettings(AI_KEYS);
  let effective: { provider: string; model: string; source: string } | null = null;
  try {
    const cfg = await getLlmConfig();
    effective = { provider: cfg.provider, model: cfg.model, source: cfg.source };
  } catch {
    // IA sin configurar en BD ni env.
  }
  return NextResponse.json({
    values: {
      llm_provider: db.llm_provider || "",
      llm_model: db.llm_model || "",
      llm_base_url: db.llm_base_url || "",
      llm_api_key: mask(db.llm_api_key),
      tavily_api_key: mask(db.tavily_api_key),
    },
    env: {
      llm_provider: process.env.LLM_PROVIDER || "",
      llm_model: process.env.LLM_MODEL || "",
      llm_api_key: mask(process.env.LLM_API_KEY || null),
      tavily_api_key: mask(process.env.TAVILY_API_KEY || null),
    },
    effective,
    providers: Object.entries(PROVIDERS).map(([value, p]) => ({
      value,
      label: p.label,
      model: p.model,
    })),
  });
}

export async function POST(req: NextRequest) {
  const auth = await guardAdmin();
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await req.json();

    if (body.action === "test") {
      const cfg = await getLlmConfig();
      const reply = await chat(
        "Eres un asistente de prueba. Responde en una sola frase corta en español.",
        "Di 'conexión correcta' y el nombre del modelo que eres si lo sabes."
      );
      return NextResponse.json({
        ok: true,
        reply,
        provider: cfg.provider,
        model: cfg.model,
        source: cfg.source,
      });
    }

    for (const k of AI_KEYS) {
      if (!(k in body) || typeof body[k] !== "string") continue;
      // No sobrescribir secretos con el valor enmascarado.
      if (SECRET_KEYS.has(k) && body[k].includes("••••")) continue;
      await setAppSetting(k, body[k].trim());
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
