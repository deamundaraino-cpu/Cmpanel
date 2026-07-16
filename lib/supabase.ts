import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Cliente de Supabase Auth para Server Components y Route Handlers.
 * Solo se usa para sesiones (login/registro/JWT); el acceso a datos
 * sigue siendo postgres.js directo vía lib/db.ts.
 */
export async function getSupabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Llamado desde un Server Component (no puede escribir cookies);
            // proxy.ts se encarga de refrescar la sesión.
          }
        },
      },
    }
  );
}
