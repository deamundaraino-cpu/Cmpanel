import { requireAdmin } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { DEFAULT_AI_DAILY_LIMIT } from "@/lib/quota";
import AdminUserRow from "@/components/AdminUserRow";

export const dynamic = "force-dynamic";

type AdminUser = {
  id: string;
  email: string;
  role: string;
  created_at: string;
  last_synced_at: string | null;
  ai_daily_limit: number | null;
  onboarded: number;
  ig_username: string | null;
  ai_today: number;
  ai_week: number;
};

const df = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short" }) : "—";

export default async function AdminPage() {
  await requireAdmin();
  const sql = getSql();
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);

  const users = await sql<AdminUser[]>`
    SELECT
      u.id, u.email, u.role, u.created_at, u.last_synced_at, u.ai_daily_limit, u.onboarded,
      (SELECT value FROM settings s WHERE s.user_id = u.id AND s.key = 'ig_username') AS ig_username,
      COALESCE((SELECT SUM(a.count)::int FROM ai_usage a
        WHERE a.user_id = u.id AND a.date = ${today}), 0) AS ai_today,
      COALESCE((SELECT SUM(a.count)::int FROM ai_usage a
        WHERE a.user_id = u.id AND a.date >= ${weekAgo}), 0) AS ai_week
    FROM users u
    ORDER BY u.created_at DESC
  `;

  const connected = users.filter((u) => u.ig_username).length;
  const aiTodayTotal = users.reduce((a, u) => a + u.ai_today, 0);

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-semibold tracking-tight">Administración</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
        {users.length} usuarios · {connected} con Instagram conectado ·{" "}
        {aiTodayTotal} operaciones de IA hoy (todas las cuentas). Límite por
        defecto: {DEFAULT_AI_DAILY_LIMIT}/día — déjalo vacío para usarlo, o
        pon un número para personalizar.
      </p>

      <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900 text-left text-xs text-zinc-500">
              <th className="px-3 py-2.5 font-medium">Usuario</th>
              <th className="px-3 py-2.5 font-medium">Instagram</th>
              <th className="px-3 py-2.5 font-medium">Registro</th>
              <th className="px-3 py-2.5 font-medium">Último sync</th>
              <th className="px-3 py-2.5 text-right font-medium">IA hoy</th>
              <th className="px-3 py-2.5 text-right font-medium">IA 7 días</th>
              <th className="px-3 py-2.5 font-medium">Límite IA/día</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/70">
            {users.map((u) => (
              <tr key={u.id} className="bg-zinc-950/40 hover:bg-zinc-900/60">
                <td className="px-3 py-2.5">
                  <p className="text-zinc-200">
                    {u.email}
                    {u.role === "admin" && (
                      <span className="ml-2 rounded-md bg-indigo-600/20 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-300">
                        ADMIN
                      </span>
                    )}
                  </p>
                  {!u.onboarded && (
                    <p className="text-[11px] text-zinc-600">sin completar onboarding</p>
                  )}
                </td>
                <td className="px-3 py-2.5 text-zinc-300">
                  {u.ig_username ? `@${u.ig_username}` : <span className="text-zinc-600">—</span>}
                </td>
                <td className="px-3 py-2.5 text-xs text-zinc-400">{df(u.created_at)}</td>
                <td className="px-3 py-2.5 text-xs text-zinc-400">{df(u.last_synced_at)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-zinc-300">{u.ai_today}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-zinc-300">{u.ai_week}</td>
                <td className="px-3 py-2.5">
                  <AdminUserRow
                    userId={u.id}
                    currentLimit={u.ai_daily_limit}
                    defaultLimit={DEFAULT_AI_DAILY_LIMIT}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
