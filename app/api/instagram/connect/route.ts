import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { guard } from "@/lib/api";
import { signPayload } from "@/lib/auth";

const SCOPES = [
  "instagram_business_basic",
  "instagram_business_manage_insights",
  "instagram_business_manage_comments",
].join(",");

/**
 * Inicia el OAuth de Instagram (Instagram API with Instagram Login).
 * Mientras la app de Meta esté en modo desarrollo, solo funciona para
 * cuentas añadidas como testers; tras el App Review, para cualquiera.
 */
export async function GET() {
  const auth = await guard();
  if (auth instanceof NextResponse) return auth;

  const appId = process.env.INSTAGRAM_APP_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appId || !appUrl) {
    return NextResponse.json(
      { error: "OAuth de Instagram no configurado (INSTAGRAM_APP_ID / NEXT_PUBLIC_APP_URL)." },
      { status: 500 }
    );
  }

  // state firmado: evita CSRF y ata el callback a este usuario.
  const nonce = randomBytes(12).toString("hex");
  const payload = `${auth.userId}.${nonce}`;
  const state = `${payload}.${signPayload(payload)}`;

  const url = new URL("https://www.instagram.com/oauth/authorize");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", `${appUrl}/api/instagram/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("state", state);

  return NextResponse.redirect(url);
}
