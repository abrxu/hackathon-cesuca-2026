// Componentes visuais do Radar, seguindo o manual de identidade visual (frontend/design).
// As telas só usam estes componentes e os tokens de src/index.css.
import { useEffect, useId, useMemo, useRef, useState } from "react";
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

// ---------------------------------------------------------------------------
// Filtros, busca e ordenação (usados por todas as telas com tabela).
// ---------------------------------------------------------------------------

// Texto sem acento e minúsculo, para busca tolerante ("satisfacao" acha "Satisfação").
export const normalizar = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Busca por vários campos: cada palavra digitada precisa aparecer em algum campo.
export function filtrarPorBusca(itens, termo, campos) {
  const lista = itens ?? [];
  const tokens = normalizar(termo).split(/\s+/).filter(Boolean);
  if (!tokens.length) return lista;
  return lista.filter((it) => {
    const texto = campos.map((f) => normalizar(f(it))).join(" ");
    return tokens.every((t) => texto.includes(t));
  });
}

function comparar(a, b) {
  const vazioA = a === null || a === undefined || a === "" || Number.isNaN(a);
  const vazioB = b === null || b === undefined || b === "" || Number.isNaN(b);
  if (vazioA || vazioB) return vazioA === vazioB ? 0 : vazioA ? 1 : -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "pt-BR", { numeric: true, sensitivity: "base" });
}

// Ordenação local por coluna. colunas = { id: { get: (item) => valor, primeiro: "asc" | "desc" } }.
// Clique alterna: primeira direção → oposta → ordem original. Valores vazios ficam sempre no fim.
export function useOrdenacao(itens, colunas, inicial = null) {
  const [ordem, setOrdem] = useState(inicial);
  const ordenados = useMemo(() => {
    const lista = itens ?? [];
    const col = ordem && colunas[ordem.id];
    if (!col) return lista;
    const sinal = ordem.dir === "asc" ? 1 : -1;
    return lista
      .map((it, i) => ({ it, i, v: col.get(it) }))
      .sort((x, y) => {
        const vx = x.v, vy = y.v;
        const vazioX = vx === null || vx === undefined || vx === "" || Number.isNaN(vx);
        const vazioY = vy === null || vy === undefined || vy === "" || Number.isNaN(vy);
        if (vazioX || vazioY) return vazioX === vazioY ? x.i - y.i : vazioX ? 1 : -1;
        return comparar(vx, vy) * sinal || x.i - y.i;
      })
      .map((x) => x.it);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itens, ordem]);
  function alternar(id) {
    const primeiro = colunas[id]?.primeiro ?? "asc";
    setOrdem((o) => {
      if (!o || o.id !== id) return { id, dir: primeiro };
      if (o.dir === primeiro) return { id, dir: primeiro === "asc" ? "desc" : "asc" };
      return null;
    });
  }
  return { ordenados, ordem, alternar, limpar: () => setOrdem(null), th: (id) => ({ id, ordem, onOrdenar: alternar }) };
}

function IconeOrdem({ dir }) {
  return (
    <svg width="10" height="14" viewBox="0 0 10 14" aria-hidden className="shrink-0">
      <path d="M5 1 9 5.5H1Z" fill="currentColor" opacity={dir === "asc" ? 1 : dir ? 0.2 : 0.35} />
      <path d="M5 13 1 8.5h8Z" fill="currentColor" opacity={dir === "desc" ? 1 : dir ? 0.2 : 0.35} />
    </svg>
  );
}

// Cabeçalho de coluna clicável. Use com useOrdenacao: <Th {...ord.th("nome")}>Cliente</Th>
export function Th({ id, ordem, onOrdenar, children, alinhar = "left", className = "" }) {
  const ativo = ordem?.id === id;
  const dir = ativo ? ordem.dir : null;
  if (!onOrdenar) return <th className={`font-semibold ${alinhar === "right" ? "text-right" : ""} ${className}`}>{children}</th>;
  return (
    <th
      className={`font-semibold ${alinhar === "right" ? "text-right" : ""} ${className}`}
      aria-sort={ativo ? (dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onOrdenar(id)}
        title="Ordenar por esta coluna"
        className={`-mx-1.5 inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 whitespace-nowrap hover:bg-brand-soft hover:text-ink ${ativo ? "text-ink" : ""} ${alinhar === "right" ? "flex-row-reverse" : ""}`}
      >
        {children}
        <IconeOrdem dir={dir} />
      </button>
    </th>
  );
}

function Chevron({ aberto }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className={`shrink-0 transition-transform ${aberto ? "rotate-180" : ""}`}>
      <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const ROTULO_FILTRO = "text-xs font-bold uppercase tracking-wide text-ink-soft";

// Combobox de filtro: lista suspensa com busca (quando há muitas opções) e teclado.
// options: ["A", "B"] ou [["valor", "Rótulo"], ...]. value vazio = "Todos".
export function Select({ label, value, onChange, options, allLabel = "Todos", className = "" }) {
  const id = useId();
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState("");
  const [ativo, setAtivo] = useState(0);
  const raiz = useRef(null);
  const botao = useRef(null);
  const campo = useRef(null);
  const lista = useRef(null);

  const opcoes = useMemo(() => (options ?? []).map((o) => (Array.isArray(o) ? { v: String(o[0]), l: o[1] } : { v: String(o), l: o })), [options]);
  const comBusca = opcoes.length > 6;
  const visiveis = useMemo(
    () => [{ v: "", l: allLabel }, ...opcoes.filter((o) => !termo || normalizar(o.l).includes(normalizar(termo)))],
    [opcoes, termo, allLabel],
  );
  const selecionado = String(value ?? "");
  const atual = opcoes.find((o) => o.v === selecionado);

  useEffect(() => {
    if (!aberto) return undefined;
    const fora = (e) => { if (!raiz.current?.contains(e.target)) setAberto(false); };
    document.addEventListener("mousedown", fora);
    (comBusca ? campo.current : lista.current)?.focus();
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto, comBusca]);

  useEffect(() => {
    if (aberto) lista.current?.children[ativo]?.scrollIntoView({ block: "nearest" });
  }, [ativo, aberto]);

  function abrir() {
    setTermo("");
    setAtivo(Math.max(0, opcoes.findIndex((o) => o.v === selecionado) + 1));
    setAberto(true);
  }
  function fechar() {
    setAberto(false);
    botao.current?.focus();
  }
  function escolher(o) {
    if (!o) return;
    onChange(o.v || undefined);
    fechar();
  }
  function teclaBotao(e) {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      abrir();
    }
  }
  function teclaLista(e) {
    if (e.key === "ArrowDown") { e.preventDefault(); setAtivo((i) => Math.min(visiveis.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setAtivo((i) => Math.max(0, i - 1)); }
    else if (e.key === "Home") { e.preventDefault(); setAtivo(0); }
    else if (e.key === "End") { e.preventDefault(); setAtivo(visiveis.length - 1); }
    else if (e.key === "Enter") { e.preventDefault(); escolher(visiveis[ativo]); }
    else if (e.key === "Escape") { e.preventDefault(); fechar(); }
    else if (e.key === "Tab") setAberto(false);
  }

  return (
    <div ref={raiz} className={`relative flex flex-col gap-1 ${className}`}>
      <span id={`${id}-rotulo`} className={ROTULO_FILTRO}>{label}</span>
      <button
        ref={botao}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-labelledby={`${id}-rotulo ${id}-valor`}
        onClick={() => (aberto ? setAberto(false) : abrir())}
        onKeyDown={teclaBotao}
        className={`flex h-10 min-w-36 items-center justify-between gap-3 rounded-control border px-3 text-left text-sm ${
          atual ? "border-ink bg-brand-soft font-bold text-ink" : "border-ink/40 bg-surface text-ink hover:border-ink"
        } ${aberto ? "border-ink ring-2 ring-ink/15" : ""}`}
      >
        <span id={`${id}-valor`} className="truncate">{atual ? atual.l : allLabel}</span>
        <Chevron aberto={aberto} />
      </button>
      {aberto && (
        <div className="absolute left-0 top-full z-30 mt-1 w-max min-w-full max-w-xs rounded-control border border-ink bg-surface p-1 shadow-[0_8px_24px_-8px_rgb(15_23_42/0.35)]" onKeyDown={teclaLista}>
          {comBusca && (
            <input
              ref={campo}
              value={termo}
              onChange={(e) => { setTermo(e.target.value); setAtivo(e.target.value ? 1 : 0); }}
              placeholder={`Filtrar ${label.toLowerCase()}…`}
              aria-label={`Filtrar opções de ${label}`}
              aria-controls={`${id}-lista`}
              aria-activedescendant={`${id}-op-${ativo}`}
              className="mb-1 h-9 w-full rounded-[0.375rem] border border-ink/30 bg-canvas px-2.5 text-sm outline-none focus:border-ink"
            />
          )}
          <ul ref={lista} id={`${id}-lista`} role="listbox" tabIndex={-1} aria-labelledby={`${id}-rotulo`} aria-activedescendant={`${id}-op-${ativo}`} className="max-h-64 overflow-auto outline-none">
            {visiveis.map((o, i) => {
              const marcado = o.v === selecionado;
              return (
                <li
                  key={o.v || "__todos"}
                  id={`${id}-op-${i}`}
                  role="option"
                  aria-selected={marcado}
                  onMouseEnter={() => setAtivo(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => escolher(o)}
                  className={`flex cursor-pointer items-center gap-2 rounded-[0.375rem] px-2.5 py-2 text-sm ${i === ativo ? "bg-brand-soft" : ""} ${marcado ? "font-bold" : ""} ${!o.v ? "text-ink-soft" : ""}`}
                >
                  <span className="w-3.5 text-center" aria-hidden>{marcado ? "✓" : ""}</span>
                  {o.l}
                </li>
              );
            })}
            {visiveis.length === 1 && termo && <li className="px-2.5 py-2 text-sm text-ink-soft">Nenhuma opção</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

// Campo de busca com ícone e botão de limpar.
export function SearchInput({ label = "Buscar", value, onChange, placeholder, className = "" }) {
  const id = useId();
  return (
    <div className={`flex min-w-56 flex-1 flex-col gap-1 ${className}`}>
      <label htmlFor={id} className={ROTULO_FILTRO}>{label}</label>
      <div className="relative">
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft">
          <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="m11 11 3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape" && value) { e.preventDefault(); onChange(""); } }}
          placeholder={placeholder}
          autoComplete="off"
          className={`h-10 w-full rounded-control border bg-surface pl-9 pr-9 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-ink focus:ring-2 focus:ring-ink/15 ${value ? "border-ink" : "border-ink/40 hover:border-ink"}`}
        />
        {value && (
          <button type="button" onClick={() => onChange("")} aria-label="Limpar busca" className="absolute right-1.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-ink-soft hover:bg-brand-soft hover:text-ink">
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

export function Chip({ children, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-ink bg-brand-soft py-0.5 pl-3 pr-1 text-sm font-semibold">
      {children}
      <button type="button" onClick={onRemove} className="flex size-5 items-center justify-center rounded-full text-xs text-ink-soft hover:bg-ink hover:text-canvas" aria-label={`Remover filtro ${typeof children === "string" ? children : ""}`}>
        ✕
      </button>
    </span>
  );
}

// Barra de filtros: busca + combobox, e abaixo os filtros ativos, contagem e ordenação.
// ativos = [{ chave, rotulo, remover }]; ordenacao = { rotulo, limpar } | null.
export function FilterBar({ children, ativos = [], resumo, ordenacao, onLimpar, compacta = false }) {
  const temRodape = ativos.length > 0 || ordenacao || resumo;
  return (
    <div className={compacta ? "mb-4" : "mb-4 rounded-panel border border-ink bg-surface p-4"}>
      <div className="flex flex-wrap items-end gap-3">{children}</div>
      {temRodape && (
        <div className={`mt-3 flex min-h-7 flex-wrap items-center gap-2 text-sm ${compacta ? "" : "border-t border-line pt-3"}`}>
          {ativos.map((a) => (
            <Chip key={a.chave} onRemove={a.remover}>{a.rotulo}</Chip>
          ))}
          {ordenacao && (
            <span className="inline-flex items-center gap-1 rounded-full border border-ink/30 py-0.5 pl-3 pr-1 text-sm text-ink-soft">
              Ordenado por <span className="font-semibold text-ink">{ordenacao.rotulo}</span>
              <button type="button" onClick={ordenacao.limpar} className="flex size-5 items-center justify-center rounded-full text-xs hover:bg-ink hover:text-canvas" aria-label="Voltar à ordem padrão">✕</button>
            </span>
          )}
          {resumo && <span className="text-ink-soft">{resumo}</span>}
          {(ativos.length > 0 || ordenacao) && onLimpar && (
            <button type="button" onClick={onLimpar} className="ml-auto text-sm font-semibold text-ink underline underline-offset-4 hover:no-underline">
              Limpar tudo
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Rótulo legível da ordenação atual, para a barra de filtros.
export function rotuloOrdenacao(ordem, nomes) {
  if (!ordem || !nomes[ordem.id]) return null;
  return `${nomes[ordem.id]} ${ordem.dir === "asc" ? "↑" : "↓"}`;
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
