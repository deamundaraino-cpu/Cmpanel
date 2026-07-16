import { NextRequest, NextResponse } from "next/server";
import { guard, fail } from "@/lib/api";
import { getSql } from "@/lib/db";
import { getSettings, setSetting } from "@/lib/settings";
import { getProfile, refreshToken } from "@/lib/instagram";
import { chat } from "@/lib/llm";

// Ajustes por usuario: conexión de Instagram + identidad de marca.
// (Las llaves de IA — LLM/Tavily — son del servidor y no se exponen aquí.)
const KEYS = [
  "ig_token",
  "ig_token_fetched_at",
  "ig_username",
  "brand_name",
  "brand_handle",
  "brand_color",
  "brand_color_secondary",
  "brand_visual_style",
  "brand_logo",
  "brand_niche",
  "brand_mission",
  "brand_audience",
  "brand_value_prop",
  "brand_tone",
  "brand_pillars",
  "brand_objectives",
  "brand_avoid",
];

const SECRET_KEYS = new Set(["ig_token"]);
const IG_KEYS = ["ig_token", "ig_token_fetched_at", "ig_user_id", "ig_username"];

function mask(v: string | null) {
  if (!v) return "";
  return v.length <= 8 ? "••••" : v.slice(0, 4) + "••••" + v.slice(-4);
}

export async function GET() {
  const auth = await guard();
  if (auth instanceof NextResponse) return auth;
  const raw = await getSettings(auth.userId, KEYS);
  const out: Record<string, string> = {};
  for (const k of KEYS) {
    out[k] = SECRET_KEYS.has(k) ? mask(raw[k]) : raw[k] || "";
  }
  return NextResponse.json(out);
}

export async function POST(req: NextRequest) {
  const auth = await guard();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;
  try {
    const body = await req.json();

    if (body.action === "test_ig") {
      const profile = await getProfile(userId);
      await setSetting(userId, "ig_user_id", String(profile.user_id ?? ""));
      await setSetting(userId, "ig_username", profile.username || "");
      return NextResponse.json({ ok: true, profile });
    }

    if (body.action === "refresh_ig_token") {
      await refreshToken(userId);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "disconnect_ig") {
      const sql = getSql();
      await sql`
        DELETE FROM settings WHERE user_id = ${userId} AND key = ANY(${IG_KEYS})
      `;
      return NextResponse.json({ ok: true });
    }

    if (body.action === "test_llm") {
      // Prueba de la IA del servidor (solo admin: los usuarios no la configuran).
      if (auth.role !== "admin") {
        return NextResponse.json({ error: "Solo admin" }, { status: 403 });
      }
      const reply = await chat(
        "Eres un asistente de prueba. Responde en una sola frase corta en español.",
        "Di 'conexión correcta' y el nombre del modelo que eres si lo sabes."
      );
      return NextResponse.json({ ok: true, reply });
    }

    if (typeof body.brand_logo === "string" && body.brand_logo.length > 600_000) {
      return fail(new Error("El logo es demasiado grande. Usa una imagen de menos de 400 KB."), 400);
    }

    // Guardado normal de ajustes
    for (const [k, v] of Object.entries(body)) {
      if (!KEYS.includes(k) || typeof v !== "string") continue;
      // No sobrescribir secretos con el valor enmascarado
      if (SECRET_KEYS.has(k) && (v.includes("••••") || v === "")) continue;
      await setSetting(userId, k, v);
      if (k === "ig_token") {
        await setSetting(userId, "ig_token_fetched_at", new Date().toISOString());
      }
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
