// Elementos visuais do Painel: ícones de linha e mini gráficos dos KPIs.
import { useId } from "react";
import { fmt } from "../api/format.js";

// Ícones de linha dos KPIs, no mesmo traço do símbolo do Radar (contorno fino, pontas arredondadas).
const ICONES = {
  alerta: (
    <>
      <path d="M20 7.5 33.5 31.5H6.5Z" />
      <path d="M20 16.5v7" />
      <circle cx="20" cy="27" r="0.6" fill="currentColor" />
    </>
  ),
  chamado: (
    <>
      <path d="M8 9.5h24a2.5 2.5 0 0 1 2.5 2.5v13a2.5 2.5 0 0 1-2.5 2.5H18l-6.5 5v-5H8A2.5 2.5 0 0 1 5.5 25V12A2.5 2.5 0 0 1 8 9.5Z" />
      <path d="M12 16h16M12 21h10" />
    </>
  ),
  satisfacao: (
    <>
      <path d="m20 6.5 4.1 8.4 9.2 1.3-6.7 6.5 1.6 9.2L20 27.6l-8.2 4.3 1.6-9.2-6.7-6.5 9.2-1.3Z" />
    </>
  ),
  tempo: (
    <>
      <circle cx="20" cy="20" r="13" />
      <path d="M20 13v7l5 3" />
    </>
  ),
};

export function KpiIcon({ tipo, size = 32, className = "text-ink" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden className={`shrink-0 ${className}`}>
      <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        {ICONES[tipo] ?? ICONES.chamado}
      </g>
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

// Cores de cada perfil, derivadas da paleta oficial (sem HEX novos): tinta clara de fundo,
// borda e ponto na cor de origem, texto sempre em azul-noite (contraste AA).
const tom = (cor, pct) => `color-mix(in srgb, var(--color-${cor}) ${pct}%, var(--color-surface))`;
export const PERFIL_CORES = {
  silencioso: { fundo: tom("ink", 7), borda: tom("ink", 55), ponto: "var(--color-ink-faint)" },
  frustrado: { fundo: tom("risk-alto", 9), borda: tom("risk-alto", 55), ponto: "var(--color-risk-alto)" },
  travado: { fundo: tom("risk-atencao", 11), borda: tom("risk-atencao", 60), ponto: "var(--color-risk-atencao)" },
  saudavel: { fundo: tom("risk-saudavel", 9), borda: tom("risk-saudavel", 55), ponto: "var(--color-risk-saudavel)" },
};
