import { redirect } from "next/navigation";
import { isAuthed } from "@/lib/auth";
import NavLink from "@/components/NavLink";
import LogoutButton from "@/components/LogoutButton";
import ThemeToggle from "@/components/ThemeToggle";

function NavGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="px-3 pb-1.5 pt-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
        {label}
      </p>
      <div className="grid gap-0.5">{children}</div>
    </div>
  );
}

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await isAuthed())) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col overflow-y-auto border-r border-zinc-800/80 bg-zinc-950/70 px-3 py-5 backdrop-blur-xl">
        <div className="flex items-center gap-3 px-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-sky-500 text-sm font-bold text-white shadow-lg shadow-indigo-500/25">
            B
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight">Brandpanel</p>
            <p className="text-[11px] text-zinc-500">Tu CM con IA</p>
          </div>
        </div>

        <nav className="mt-3 flex-1">
          <NavGroup label="Analiza">
            <NavLink href="/" icon="home">Dashboard</NavLink>
            <NavLink href="/metricas" icon="chart">Métricas</NavLink>
            <NavLink href="/posts" icon="grid">Publicaciones</NavLink>
          </NavGroup>
          <NavGroup label="Planifica">
            <NavLink href="/calendario" icon="calendar">Calendario</NavLink>
            <NavLink href="/pipeline" icon="kanban">Pipeline</NavLink>
            <NavLink href="/campanas" icon="megaphone">Campañas</NavLink>
          </NavGroup>
          <NavGroup label="Crea">
            <NavLink href="/ideas" icon="lightbulb">Ideas y nicho</NavLink>
            <NavLink href="/propuestas" icon="sparkles">Propuestas</NavLink>
            <NavLink href="/estructuras" icon="film">Estructuras</NavLink>
            <NavLink href="/marca" icon="gem">Marca</NavLink>
          </NavGroup>
        </nav>

        <div className="mt-4 grid gap-0.5 border-t border-zinc-800/80 pt-3">
          <NavLink href="/ajustes" icon="sliders">Ajustes</NavLink>
          <ThemeToggle />
          <div className="px-3 py-1.5">
            <LogoutButton />
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-8 py-8 lg:px-10">{children}</main>
    </div>
  );
}
