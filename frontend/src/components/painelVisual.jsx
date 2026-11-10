// Elementos visuais do Painel: ícones "clay" (3D suave, em SVG puro) e mini gráficos dos KPIs.
import { useId } from "react";
import { fmt } from "../api/format.js";

// Paleta dos ícones clay: tom claro (luz), tom base e tom escuro (sombra).
const CLAY = {
  alerta: { luz: "#FCA5A5", base: "#EF4444", sombra: "#B91C1C" },
  chamado: { luz: "#93C5FD", base: "#3B82F6", sombra: "#1D4ED8" },
  satisfacao: { luz: "#FDE68A", base: "#FBBF24", sombra: "#D97706" },
  tempo: { luz: "#C4B5FD", base: "#8B5CF6", sombra: "#6D28D9" },
};

export function ClayIcon({ tipo, size = 56 }) {
  const id = useId().replace(/:/g, "");
  const c = CLAY[tipo] ?? CLAY.chamado;
  const g = `clay-${id}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="shrink-0 drop-shadow-[0_6px_8px_rgba(15,23,42,0.18)]">
      <defs>
        <radialGradient id={`${g}-corpo`} cx="35%" cy="28%" r="80%">
          <stop offset="0%" stopColor={c.luz} />
          <stop offset="55%" stopColor={c.base} />
          <stop offset="100%" stopColor={c.sombra} />
        </radialGradient>
        <radialGradient id={`${g}-branco`} cx="38%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="70%" stopColor="#F1F5F9" />
          <stop offset="100%" stopColor="#CBD5E1" />
        </radialGradient>
        <radialGradient id={`${g}-brilho`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
      </defs>
      {tipo === "alerta" && (
        <>
          <path d="M32 7c2.6 0 4.3 1.4 5.6 3.6l19 33c2.6 4.5-.3 9.4-5.4 9.4H12.8c-5.1 0-8-4.9-5.4-9.4l19-33C27.7 8.4 29.4 7 32 7Z" fill={`url(#${g}-corpo)`} />
          <rect x="28.5" y="20" width="7" height="18" rx="3.5" fill={`url(#${g}-branco)`} />
          <circle cx="32" cy="45" r="4" fill={`url(#${g}-branco)`} />
          <ellipse cx="25" cy="22" rx="5" ry="3" fill={`url(#${g}-brilho)`} transform="rotate(-55 25 22)" />
        </>
      )}
      {tipo === "chamado" && (
        <>
          <path d="M14 10h36c5 0 8 3 8 8v20c0 5-3 8-8 8H30l-11 9c-1.6 1.3-3.5.3-3.3-1.7l.7-7.3H14c-5 0-8-3-8-8V18c0-5 3-8 8-8Z" fill={`url(#${g}-corpo)`} />
          <rect x="15" y="20" width="26" height="5.5" rx="2.75" fill={`url(#${g}-branco)`} />
          <rect x="15" y="30" width="18" height="5.5" rx="2.75" fill={`url(#${g}-branco)`} />
          <ellipse cx="17" cy="14.5" rx="7" ry="2.6" fill={`url(#${g}-brilho)`} />
        </>
      )}
      {tipo === "satisfacao" && (
        <>
          <path d="M32 5.5c1.6 0 2.8.9 3.5 2.4l6 12.2 13.4 2c3.3.5 4.6 4.5 2.2 6.8l-9.7 9.4 2.3 13.3c.6 3.3-2.9 5.8-5.8 4.2L32 49.5l-11.9 6.3c-3 1.6-6.4-.9-5.8-4.2l2.3-13.3-9.7-9.4c-2.4-2.3-1.1-6.3 2.2-6.8l13.4-2 6-12.2c.7-1.5 1.9-2.4 3.5-2.4Z" fill={`url(#${g}-corpo)`} />
          <circle cx="26" cy="31" r="2.6" fill={c.sombra} />
          <circle cx="38" cy="31" r="2.6" fill={c.sombra} />
          <path d="M26.5 38.5c3.2 3 7.8 3 11 0" stroke={c.sombra} strokeWidth="2.6" strokeLinecap="round" fill="none" />
          <ellipse cx="27" cy="17" rx="5" ry="2.4" fill={`url(#${g}-brilho)`} transform="rotate(-30 27 17)" />
        </>
      )}
      {tipo === "tempo" && (
        <>
          <circle cx="32" cy="33" r="25" fill={`url(#${g}-corpo)`} />
          <circle cx="32" cy="33" r="17.5" fill={`url(#${g}-branco)`} />
          <path d="M32 22v11.5l7.5 4.5" stroke={c.sombra} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <circle cx="32" cy="33.5" r="2.6" fill={c.sombra} />
          <ellipse cx="21" cy="17" rx="7" ry="3" fill={`url(#${g}-brilho)`} transform="rotate(-35 21 17)" />
        </>
      )}
    </svg>
  );
}

// Mini gráfico de área com rótulo de mês em cada ponto. cor = classe de texto (currentColor).
export function MiniArea({ valores = [], meses = [], cor = "text-ink", formatar = fmt.num, height = 44 }) {
  const id = useId().replace(/:/g, "");
  const pts = valores.map((v, i) => ({ v, i })).filter((p) => Number.isFinite(p.v));
  if (pts.length < 2) return <div style={{ height: height + 18 }} aria-hidden />;
  const w = 100;
  const max = Math.max(...pts.map((p) => p.v));
  const min = Math.min(...pts.map((p) => p.v));
  const span = max - min || 1;
  const n = valores.length;
  const x = (i) => 6 + (i * (w - 12)) / Math.max(n - 1, 1);
  const y = (v) => 6 + (height - 14) * (1 - (v - min) / span);
  const linha = pts.map((p) => `${x(p.i)},${y(p.v)}`).join(" ");
  const area = `M${x(pts[0].i)},${height} L${linha.replace(/ /g, " L")} L${x(pts[pts.length - 1].i)},${height} Z`;
  const ultimo = pts[pts.length - 1];
  return (
    <div className={cor}>
      <div className="relative">
      <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="block h-11 w-full overflow-visible" role="img"
        aria-label={pts.map((p) => `${fmt.mes(meses[p.i] ?? "")}: ${formatar(p.v)}`).join(", ")}>
        <defs>
          <linearGradient id={`area-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#area-${id})`} />
        <polyline points={linha} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <span className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current ring-2 ring-surface"
        style={{ left: `${x(ultimo.i)}%`, top: `${(y(ultimo.v) / height) * 100}%` }} aria-hidden />
      </div>
      <div className="mt-1 flex justify-between text-xs text-ink-faint">
        {valores.map((v, i) => (
          <span key={i} className={i === n - 1 ? "font-semibold text-ink-soft" : ""}>
            {fmt.mes(meses[i] ?? "")} <span className="tabular-nums">{Number.isFinite(v) ? formatar(v) : fmt.dash}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// Mini barras (contagens por mês). A barra do mês mais recente fica em destaque.
export function MiniBarras({ valores = [], meses = [], cor = "bg-ink", formatar = fmt.num }) {
  const nums = valores.map((v) => (Number.isFinite(v) ? v : 0));
  if (!nums.length) return <div className="h-[62px]" aria-hidden />;
  const max = Math.max(1, ...nums);
  return (
    <div role="img" aria-label={nums.map((v, i) => `${fmt.mes(meses[i] ?? "")}: ${formatar(v)}`).join(", ")}>
      <div className="flex h-11 items-end gap-2">
        {nums.map((v, i) => (
          <span key={i} className={`flex-1 rounded-t-md ${cor} ${i === nums.length - 1 ? "" : "opacity-30"}`}
            style={{ height: `${Math.max(8, (v / max) * 100)}%` }} />
        ))}
      </div>
      <div className="mt-1 flex gap-2 text-xs text-ink-faint">
        {nums.map((v, i) => (
          <span key={i} className={`flex-1 text-center ${i === nums.length - 1 ? "font-semibold text-ink-soft" : ""}`}>
            {fmt.mes(meses[i] ?? "")} {formatar(v)}
          </span>
        ))}
      </div>
    </div>
  );
}

// Cores próprias de cada perfil de risco (distintas das cores de faixa).
export const PERFIL_CORES = {
  silencioso: { fundo: "#E0F2FE", borda: "#0284C7", texto: "#075985", ponto: "#0284C7" },
  frustrado: { fundo: "#FCE7F3", borda: "#DB2777", texto: "#9D174D", ponto: "#DB2777" },
  travado: { fundo: "#EDE9FE", borda: "#7C3AED", texto: "#5B21B6", ponto: "#7C3AED" },
  saudavel: { fundo: "#CCFBF1", borda: "#0D9488", texto: "#115E59", ponto: "#0D9488" },
};
