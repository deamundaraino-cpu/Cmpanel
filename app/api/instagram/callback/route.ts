import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api";
import { verifyPayload } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { setSetting } from "@/lib/settings";
import { getProfile } from "@/lib/instagram";

function backToSettings(req: NextRequest, params: Record<string, string>) {
  const url = req.nextUrl.clone();
  url.pathname = "/ajustes";
  url.search = new URLSearchParams(params).toString();
  return NextResponse.redirect(url);
}

/** Callback del OAuth de Instagram: code → token corto → token long-lived (60 días). */
export async function GET(req: NextRequest) {
  const auth = await guard();
  if (auth instanceof NextResponse) {
    // Sesión perdida durante el baile OAuth: de vuelta al login.
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state") || "";
  const igError = req.nextUrl.searchParams.get("error_description");

  if (igError) return backToSettings(req, { ig: "error", msg: igError });
  if (!code) return backToSettings(req, { ig: "error", msg: "Instagram no devolvió el código." });

  // Verificar state: firmado por nosotros, del MISMO usuario de la sesión y
  // con el cliente desde el que se inició el flujo.
  const [stateUserId, stateClientId, nonce, signature] = state.split(".");
  if (
    !stateUserId ||
    !stateClientId ||
    !nonce ||
    !signature ||
    stateUserId !== auth.userId ||
    !verifyPayload(`${stateUserId}.${stateClientId}.${nonce}`, signature)
  ) {
    return backToSettings(req, { ig: "error", msg: "Estado OAuth inválido. Inténtalo de nuevo." });
  }

  // El cliente del state debe seguir siendo del usuario.
  const clientId = Number(stateClientId);
  const sql = getSql();
  const owned = await sql<{ id: number }[]>`
    SELECT id FROM clients WHERE id = ${clientId} AND owner_user_id = ${auth.userId}
  `;
  if (!owned.length) {
    return backToSettings(req, { ig: "error", msg: "El cliente del flujo OAuth ya no existe." });
  }

  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appId || !appSecret || !appUrl) {
    return backToSettings(req, { ig: "error", msg: "OAuth no configurado en el servidor." });
  }

  try {
    // 1. code → token corto
    const form = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: "authorization_code",
      redirect_uri: `${appUrl}/api/instagram/callback`,
      code,
    });
    const shortRes = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      body: form,
    });
    const shortJson = await shortRes.json();
    if (!shortRes.ok || !shortJson.access_token) {
      throw new Error(shortJson.error_message || shortJson.error?.message || "Intercambio de código fallido.");
    }

    // 2. token corto → long-lived (60 días)
    const longUrl = new URL("https://graph.instagram.com/access_token");
    longUrl.searchParams.set("grant_type", "ig_exchange_token");
    longUrl.searchParams.set("client_secret", appSecret);
    longUrl.searchParams.set("access_token", shortJson.access_token);
    const longRes = await fetch(longUrl);
    const longJson = await longRes.json();
    if (!longRes.ok || !longJson.access_token) {
      throw new Error(longJson.error?.message || "No se pudo obtener el token de larga duración.");
    }

    // 3. Guardar en los settings del CLIENTE + perfil
    await setSetting(clientId, "ig_token", longJson.access_token);
    await setSetting(clientId, "ig_token_fetched_at", new Date().toISOString());
    const profile = await getProfile(clientId);
    await setSetting(clientId, "ig_user_id", String(profile.user_id ?? ""));
    await setSetting(clientId, "ig_username", profile.username || "");

    return backToSettings(req, { ig: "ok", username: profile.username || "" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error conectando con Instagram.";
    return backToSettings(req, { ig: "error", msg });
  }
}
