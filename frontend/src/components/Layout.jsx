import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { RadarMark } from "./ui.jsx";
import PerguntaRadar from "./PerguntaRadar.jsx";

const NAV = [
  { to: "/", label: "Painel", end: true },
  { to: "/clientes", label: "Clientes" },
  { to: "/chamados", label: "Chamados" },
  { to: "/gestor", label: "Gestor", papel: "gestor" },
];

export default function Layout() {
  const { usuario, sair } = useAuth();
  return (
    <div className="min-h-screen">
      <header className="bg-ink text-canvas">
        <div className="mx-auto flex h-16 max-w-[1360px] items-center gap-8 px-4 sm:px-8">
          <span className="flex items-center gap-2.5 text-lg font-extrabold tracking-tight">
            <RadarMark size={32} className="text-canvas" detail="var(--color-ink)" />
            Radar de Clientes
          </span>
          <nav className="flex gap-1" aria-label="Principal">
            {NAV.filter((n) => !n.papel || n.papel === usuario?.papel).map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `rounded-control px-3 py-2 text-base font-semibold underline-offset-[6px] ${isActive ? "bg-canvas text-ink" : "text-canvas/80 hover:text-canvas hover:underline"}`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-canvas/90 sm:inline">
              {usuario?.nome} <span className="text-canvas/70">({usuario?.papel})</span>
            </span>
            <button type="button" onClick={sair} className="rounded-control border border-canvas/60 px-3 py-1.5 font-semibold text-canvas hover:underline">
              Sair
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1360px] px-4 py-8 sm:px-8">
        <Outlet />
      </main>
      <PerguntaRadar />
    </div>
  );
}
