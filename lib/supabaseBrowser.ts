import { createBrowserClient } from "@supabase/ssr";

/** Cliente de Supabase Auth para componentes cliente (login, registro, logout). */
export function getSupabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
