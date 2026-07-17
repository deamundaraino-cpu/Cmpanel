import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { fail } from "@/lib/api";

/**
 * Registro con puerta de beta cerrada: valida el código de invitación en el
 * servidor (BETA_INVITE_CODE) antes de crear la cuenta en Supabase.
 * Si BETA_INVITE_CODE no está definida, el registro queda abierto (dev).
 */
export async function POST(req: NextRequest) {
  try {
    const { email, password, codigoBeta } = await req.json().catch(() => ({}));

    const requiredCode = process.env.BETA_INVITE_CODE;
    if (requiredCode && String(codigoBeta || "").trim() !== requiredCode) {
      return fail(
        new Error("Código de invitación incorrecto. Pídeselo a quien te invitó a la beta."),
        403
      );
    }

    if (typeof email !== "string" || !email.includes("@")) {
      return fail(new Error("Email inválido"), 400);
    }
    if (typeof password !== "string" || password.length < 8) {
      return fail(new Error("La contraseña debe tener al menos 8 caracteres"), 400);
    }

    const supabase = await getSupabaseServer();
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      const msg = error.message.includes("already registered")
        ? "Ese email ya tiene una cuenta. Inicia sesión."
        : error.message;
      return fail(new Error(msg), 400);
    }

    // session presente = confirm-email desactivado → sesión inmediata.
    return NextResponse.json({ ok: true, hasSession: !!data.session });
  } catch (e) {
    return fail(e);
  }
}
