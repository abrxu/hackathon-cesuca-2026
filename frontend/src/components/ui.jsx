// Componentes visuais do Radar, seguindo o manual de identidade visual (frontend/design).
// As telas só usam estes componentes e os tokens de src/index.css.
import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { FAIXA_LABEL, PERFIL_LABEL, fmt } from "../api/format.js";

// Manual: vermelho sobre fundo claro passa AA; âmbar e verde só como marca gráfica,
// com rótulo em azul-noite (on). Símbolo + texto reforçam a leitura sem depender da cor.
const FAIXA_CLASSES = {
  alto: { text: "text-risk-alto", bg: "bg-risk-alto", soft: "bg-risk-alto-soft", on: "text-canvas", simbolo: "▲" },
  atencao: { text: "text-risk-atencao", bg: "bg-risk-atencao", soft: "bg-risk-atencao-soft", on: "text-ink", simbolo: "◆" },
  saudavel: { text: "text-risk-saudavel", bg: "bg-risk-saudavel", soft: "bg-risk-saudavel-soft", on: "text-ink", simbolo: "●" },
};
export const faixaClasses = (faixa) => FAIXA_CLASSES[faixa] ?? FAIXA_CLASSES.saudavel;

// Pílula de risco: sempre com texto, nunca só a cor.
export function RiskPill({ faixa }) {
  const c = faixaClasses(faixa);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-bold whitespace-nowrap ${c.bg} ${c.on}`}>
      <span className="text-[0.7em]" aria-hidden>{c.simbolo}</span>
      {FAIXA_LABEL[faixa] ?? fmt.dash}
    </span>
  );
}

export function PerfilPill({ perfil }) {
  if (!perfil) return <span className="text-ink-faint">{fmt.dash}</span>;
  return (
    <span className="inline-flex rounded-full border border-ink bg-canvas px-2.5 py-0.5 text-sm font-semibold whitespace-nowrap text-ink">
      {PERFIL_LABEL[perfil] ?? fmt.dash}
    </span>
  );
}

// Barra de score: preenchimento colorido pela faixa, número ao lado.
export function ScoreBar({ score, faixa }) {
  const c = faixaClasses(faixa);
  const valor = Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="w-9 text-right font-bold">{fmt.num(score)}</span>
      <span className="h-2 w-16 overflow-hidden rounded-full bg-line" aria-hidden>
        <span className={`block h-full rounded-full ${c.bg}`} style={{ width: `${valor}%` }} />
      </span>
    </span>
  );
}

// Minilinha dos 3 meses, colorida pela faixa.
export function Sparkline({ valores = [], faixa, width = 72, height = 22 }) {
  const nums = valores.filter((v) => Number.isFinite(v));
  if (nums.length < 2) return <span className="text-ink-faint">{fmt.dash}</span>;
  const max = Math.max(...nums);
  const min = Math.min(...nums);
  const span = max - min || 1;
  const pts = nums.map((v, i) => [2 + (i * (width - 4)) / (nums.length - 1), 2 + (height - 4) * (1 - (v - min) / span)]);
  const [lx, ly] = pts[pts.length - 1];
  const c = faixaClasses(faixa);
  return (
    <svg width={width} height={height} className={c.text} role="img" aria-label={`Uso: ${nums.join(", ")}`}>
      <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r="2.5" fill="currentColor" />
    </svg>
  );
}

// Botões: só um primário por tela.
// Manual: ação primária em azul-noite, IA em índigo, secundária com borda de contraste.
const BTN = {
  primary: "border-ink bg-ink text-canvas hover:underline",
  secondary: "border-ink bg-canvas text-ink hover:bg-surface hover:underline",
  ghost: "border-transparent text-ink hover:underline",
  ai: "border-ai bg-ai text-canvas hover:underline",
};
export function Button({ variant = "secondary", className = "", children, ...props }) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-control border px-4 py-2 text-sm font-bold underline-offset-4 disabled:cursor-not-allowed disabled:border-dashed disabled:opacity-60 disabled:no-underline ${BTN[variant]} ${className}`}
      {...props}
    >
      {variant === "ai" && <span aria-hidden>✦</span>}
      {children}
    </button>
  );
}

// Toda saída de IA usa este contêiner. fonte "regras" = fallback sem IA.
export function AiBlock({ fonte = "ia", children }) {
  const ia = fonte === "ia";
  return (
    <section className={`rounded-panel p-4 ${ia ? "border-2 border-ai bg-ai-soft" : "border border-ink bg-canvas"}`}>
      <p className={`mb-3 text-sm font-bold ${ia ? "text-ai" : "text-ink-soft"}`}>
        {ia ? "✦ gerado por IA" : "sugestão por regras"}
      </p>
      {children}
    </section>
  );
}

export function Skeleton({ className = "" }) {
  return <span className={`block animate-pulse rounded bg-line/70 ${className}`} aria-hidden />;
}

export function SkeletonRows({ rows = 5, cols = 5 }) {
  return (
    <div className="divide-y divide-line" aria-busy="true" aria-label="Carregando">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-6 py-3.5">
          {Array.from({ length: cols }).map((__, j) => (
            <Skeleton key={j} className={`h-4 ${j === 0 ? "w-48" : "w-20"}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ title, hint, action }) {
  return (
    <div className="py-14 text-center">
      <p className="text-lg font-bold">{title}</p>
      {hint && <p className="mt-1 text-sm text-ink-soft">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <EmptyState
      title={error?.message || "Não foi possível carregar os dados."}
      action={onRetry && <Button onClick={onRetry}>Tentar de novo</Button>}
    />
  );
}

// Baixa um relatório pela API (com token) e mostra erro discreto se falhar.
export function BotoesRelatorio({ papel, filtros, rotuloPdf = "Baixar PDF", rotuloExcel = "Baixar Excel" }) {
  const [baixando, setBaixando] = useState(null);
  const [erro, setErro] = useState(null);
  async function baixar(formato) {
    setBaixando(formato);
    setErro(null);
    try {
      await api.baixarRelatorio(papel, formato, filtros);
    } catch (e) {
      setErro(e.message || "Não foi possível baixar o relatório.");
    } finally {
      setBaixando(null);
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button onClick={() => baixar("pdf")} disabled={baixando !== null}>{baixando === "pdf" ? "Gerando…" : rotuloPdf}</Button>
      <Button onClick={() => baixar("xlsx")} disabled={baixando !== null}>{baixando === "xlsx" ? "Gerando…" : rotuloExcel}</Button>
      {erro && <span className="text-sm text-risk-alto" role="alert">{erro}</span>}
    </div>
  );
}

export function Select({ label, value, onChange, options, allLabel = "Todos" }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold text-ink">
      {label}
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="h-10 rounded-control border border-ink bg-surface px-2.5 text-sm font-normal text-ink"
      >
        <option value="">{allLabel}</option>
        {options.map((o) => {
          const [v, l] = Array.isArray(o) ? o : [o, o];
          return <option key={v} value={v}>{l}</option>;
        })}
      </select>
    </label>
  );
}

export function Chip({ children, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-ink bg-surface py-0.5 pl-3 pr-1 text-sm font-semibold">
      {children}
      <button type="button" onClick={onRemove} className="rounded-full px-1.5 text-ink-soft hover:text-ink" aria-label={`Remover filtro ${children}`}>
        ✕
      </button>
    </span>
  );
}

// Carrega dados de uma função assíncrona; recarrega quando deps mudam.
export function useData(loader, deps) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let vivo = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    loader()
      .then((data) => vivo && setState({ data, error: null, loading: false }))
      .catch((error) => vivo && setState({ data: null, error, loading: false }));
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { ...state, reload: () => setTick((t) => t + 1), setData: (data) => setState((s) => ({ ...s, data })) };
}

export function PageHeader({ title, meta, children }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {meta && <p className="mt-1 text-sm text-ink-soft">{meta}</p>}
      </div>
      {children}
    </header>
  );
}

export function Section({ title, aside, children, className = "", tone }) {
  const borda = tone === "ai" ? "border-2 border-ai" : "border border-ink";
  return (
    <section className={`rounded-panel bg-surface p-5 ${borda} ${className}`}>
      {(title || aside) && (
        <div className="mb-4 flex items-baseline justify-between gap-4">
          {title && <h2 className="text-xl font-bold tracking-tight">{title}</h2>}
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

// Símbolo do Radar (círculo com anéis e ponteiro). detail = cor dos anéis.
export function RadarMark({ size = 32, className = "", detail = "var(--color-canvas)" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} aria-hidden>
      <circle cx="20" cy="20" r="19" fill="currentColor" />
      <g fill="none" stroke={detail} strokeWidth="1.7" strokeLinecap="round">
        <circle cx="20" cy="20" r="12" />
        <circle cx="20" cy="20" r="7" />
        <path d="M20 20 29 11" />
      </g>
      <circle cx="20" cy="20" r="2" fill={detail} />
    </svg>
  );
}
