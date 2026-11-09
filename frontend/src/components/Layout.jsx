import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth.jsx";

const NAV = [
  { to: "/", label: "Painel", end: true },
  { to: "/clientes", label: "Clientes" },
  { to: "/chamados", label: "Chamados" },
];

export default function Layout() {
  const { usuario, sair } = useAuth();
  return (
    <div className="min-h-screen">
      <header className="bg-brand text-white">
        <div className="mx-auto flex h-14 max-w-[1360px] items-center gap-8 px-4 sm:px-8">
          <span className="font-display text-lg tracking-tight" style={{ fontWeight: 800 }}>
            Radar
          </span>
          <nav className="flex gap-1" aria-label="Principal">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 text-sm font-medium ${isActive ? "bg-white/15 text-white" : "text-white/70 hover:text-white"}`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-white/80 sm:inline">
              {usuario?.nome} <span className="text-white/50">({usuario?.papel})</span>
            </span>
            <button type="button" onClick={sair} className="rounded-md px-2 py-1 text-white/70 hover:text-white">
              Sair
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1360px] px-4 py-8 sm:px-8">
        <Outlet />
      </main>
    </div>
  );
}
