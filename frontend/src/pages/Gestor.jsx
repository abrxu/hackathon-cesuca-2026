import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { api } from "../api/client.js";
import { FAIXA_LABEL, PERFIL_LABEL, fmt } from "../api/format.js";
import { useAuth } from "../auth.jsx";
import { BotoesRelatorio, EmptyState, ErrorState, PageHeader, Section, Skeleton, SkeletonRows, faixaClasses, useData } from "../components/ui.jsx";

// Visão do gestor: a carteira inteira (tendência, concentração, execução do time e produto).
// O analista olha cliente a cliente no Painel; aqui o gestor decide onde intervir.
export default function Gestor() {
  const { usuario } = useAuth();
  if (usuario?.papel !== "gestor") return <Navigate to="/" replace />;
  return <GestorConteudo />;
}

function GestorConteudo() {
  const { data, error, loading, reload } = useData(() => api.visaoGestor(), []);
  const total = data?.kpis?.total_clientes;
  return (
    <>
      <PageHeader title="Visão do gestor" meta={`Carteira de ${fmt.num(total)} clientes · jul a set/2026`}>
        <BotoesRelatorio papel="gestor" rotuloPdf="Baixar PDF para a diretoria" />
      </PageHeader>
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Kpis kpis={data?.kpis} backlog={data?.backlog} loading={loading} />
          <Tendencia evolucao={data?.evolucao} kpis={data?.kpis} loading={loading} />
          <Perfis perfis={data?.perfis} loading={loading} />
          <Concentracao segmentos={data?.segmentos} loading={loading} />
          <Execucao cobertura={data?.cobertura} backlog={data?.backlog} loading={loading} />
          <Produto produto={data?.produto} loading={loading} />
        </div>
      )}
    </>
  );
}

const pct = (v) => (Number.isFinite(v) ? `${v > 0 ? "+" : ""}${v}%` : fmt.dash);

function Kpis({ kpis, backlog, loading }) {
  const antigos = backlog?.faixas?.at(-1)?.total;
  const itens = [
    {
      label: "Carteira em risco",
      valor: fmt.num(kpis?.clientes_em_risco),
      detalhe: `de ${fmt.num(kpis?.total_clientes)} clientes · ${fmt.num(kpis?.clientes_alto_risco)} em alto risco`,
      ruim: true,
    },
    {
      label: "Uso dos clientes em risco",
      valor: pct(kpis?.uso_em_risco_variacao_pct),
      detalhe: `jul → set · carteira toda ${pct(kpis?.uso_variacao_pct)}`,
      ruim: kpis?.uso_em_risco_variacao_pct < 0,
    },
    {
      label: "Alto risco já contatado",
      valor: `${fmt.num(kpis?.alto_risco_contatados)} de ${fmt.num(kpis?.clientes_alto_risco)}`,
      detalhe: "cobertura do time de CS",
      ruim: kpis?.alto_risco_contatados < kpis?.clientes_alto_risco,
    },
    {
      label: "Chamados há mais de 30 dias",
      valor: fmt.num(antigos),
      detalhe: `de ${fmt.num(backlog?.pendentes)} pendentes · mais antigo com ${fmt.num(backlog?.mais_antigo_dias)} dias`,
      ruim: antigos > 0,
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-ink bg-ink lg:col-span-2 lg:grid-cols-4">
      {itens.map((k) => (
        <div key={k.label} className="bg-surface px-5 py-4">
          <p className="text-sm font-semibold text-ink-soft">{k.label}</p>
          {loading ? (
            <Skeleton className="mt-2 h-10 w-24" />
          ) : (
            <p className={`mt-2 font-display text-[40px] ${k.ruim ? "text-risk-alto" : ""}`}>{k.valor}</p>
          )}
          <p className="mt-2 text-sm text-ink-soft">{loading ? " " : k.detalhe}</p>
        </div>
      ))}
    </div>
  );
}

// Uso indexado (jul = 100) dos clientes em risco × saudáveis: um eixo só, duas séries.
function Tendencia({ evolucao, kpis, loading }) {
  const [hover, setHover] = useState(null);
  const meses = evolucao ?? [];
  const base = meses[0] ?? {};
  const idx = (m, k) => (base[k] ? Math.round((m[k] / base[k]) * 100) : null);
  const series = [
    { key: "operacoes_em_risco", label: "Clientes em risco", cor: "var(--color-risk-alto)", tracejado: false },
    { key: "operacoes_saudaveis", label: "Clientes saudáveis", cor: "var(--color-risk-saudavel)", tracejado: true },
  ].map((s) => ({ ...s, valores: meses.map((m) => idx(m, s.key)) }));
  const todos = series.flatMap((s) => s.valores).filter(Number.isFinite);
  const min = Math.min(60, ...todos);
  const max = Math.max(140, ...todos);
  const W = 560, H = 220, L = 40, R = 130, T = 16, B = 30;
  const x = (i) => L + (meses.length > 1 ? (i * (W - L - R)) / (meses.length - 1) : 0);
  const y = (v) => T + (H - T - B) * (1 - (v - min) / (max - min));
  const grade = [min, 100, max].filter((v, i, a) => a.indexOf(v) === i);

  return (
    <Section title="Uso da carteira" aside={<span className="text-sm text-ink-soft">operações, julho = 100</span>}>
      {loading ? (
        <Skeleton className="h-52 w-full" />
      ) : meses.length < 2 ? (
        <EmptyState title="Sem meses suficientes para comparar" />
      ) : (
        <>
          <p className="mb-3 text-base">
            No total o uso ficou estável ({pct(kpis?.uso_variacao_pct)}), mas os clientes em risco caíram{" "}
            <strong className="text-risk-alto">{pct(kpis?.uso_em_risco_variacao_pct)}</strong>. O total esconde a queda.
          </p>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Uso indexado por mês, clientes em risco e saudáveis">
            {grade.map((v) => (
              <g key={v}>
                <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--color-line)" strokeDasharray={v === 100 ? "" : "3 4"} />
                <text x={L - 8} y={y(v) + 4} textAnchor="end" fontSize="12" fill="var(--color-ink-soft)">{v}</text>
              </g>
            ))}
            {meses.map((m, i) => (
              <text key={m.mes} x={x(i)} y={H - 8} textAnchor="middle" fontSize="13" fill="var(--color-ink-soft)">{fmt.mes(m.mes)}</text>
            ))}
            {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="var(--color-ink-faint)" />}
            {series.map((s) => {
              const pts = s.valores.map((v, i) => (Number.isFinite(v) ? [x(i), y(v)] : null)).filter(Boolean);
              const ult = pts.at(-1);
              return (
                <g key={s.key}>
                  <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke={s.cor} strokeWidth="2.5"
                    strokeDasharray={s.tracejado ? "6 4" : ""} strokeLinejoin="round" />
                  {pts.map(([px, py], i) => (
                    <circle key={i} cx={px} cy={py} r={hover === i ? 6 : 4.5} fill={s.cor} stroke="var(--color-surface)" strokeWidth="2" />
                  ))}
                  {ult && (
                    <text x={ult[0] + 12} y={ult[1] + 4} fontSize="13" fontWeight="700" fill="var(--color-ink)">
                      {s.label.replace("Clientes ", "")} {s.valores.at(-1)}
                    </text>
                  )}
                </g>
              );
            })}
            {meses.map((m, i) => (
              <rect key={m.mes} x={x(i) - 40} y={T} width={80} height={H - T - B} fill="transparent"
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
            ))}
          </svg>
          <div className="mt-2 flex min-h-12 flex-wrap items-start justify-between gap-3 text-sm">
            <ul className="flex gap-4">
              {series.map((s) => (
                <li key={s.key} className="flex items-center gap-1.5">
                  <svg width="22" height="8" aria-hidden><line x1="0" x2="22" y1="4" y2="4" stroke={s.cor} strokeWidth="2.5" strokeDasharray={s.tracejado ? "6 4" : ""} /></svg>
                  {s.label}
                </li>
              ))}
            </ul>
            {hover !== null && (
              <p className="text-ink-soft">
                <strong className="text-ink">{fmt.mes(meses[hover].mes)}</strong> · em risco {fmt.num(meses[hover].operacoes_em_risco)} op.
                · saudáveis {fmt.num(meses[hover].operacoes_saudaveis)} op. · {fmt.num(meses[hover].atendimentos)} chamados
                · satisfação {fmt.nota(meses[hover].satisfacao_media)}
              </p>
            )}
          </div>
        </>
      )}
    </Section>
  );
}

// Perfis de risco viram decisões em escala: um tipo de ação por padrão de comportamento.
const PLAYBOOK = {
  travado: { titulo: "Força-tarefa de suporte", texto: "Chamados parados e uso caindo. Destravar os pendentes antes de qualquer outra conversa." },
  silencioso: { titulo: "Campanha de reengajamento", texto: "Usam cada vez menos e não reclamam. Contato proativo e treinamento em lote." },
  frustrado: { titulo: "Revisar a qualidade do atendimento", texto: "Satisfação baixa nos chamados. Olhar o serviço e o assunto que mais geram atrito." },
  saudavel: { titulo: "Manter e pedir indicação", texto: "Sem sinais de risco. Acompanhamento de rotina." },
};

function Perfis({ perfis, loading }) {
  return (
    <Section title="Perfis de risco: ação em escala">
      {loading ? (
        <SkeletonRows rows={4} cols={2} />
      ) : (
        <ul className="divide-y divide-line">
          {(perfis ?? []).map((p) => {
            const pb = PLAYBOOK[p.perfil] ?? {};
            return (
              <li key={p.perfil}>
                <Link to={`/clientes?perfil=${p.perfil}`} className="group grid grid-cols-[88px_1fr] gap-4 py-3 hover:bg-brand-soft">
                  <span>
                    <span className="block font-display text-[32px]">{fmt.num(p.clientes)}</span>
                    <span className="text-sm font-semibold">{PERFIL_LABEL[p.perfil] ?? p.perfil}</span>
                  </span>
                  <span>
                    <span className="block font-bold group-hover:underline">{pb.titulo ?? fmt.dash}</span>
                    <span className="block text-sm text-ink-soft">{pb.texto}</span>
                    <span className="mt-1 block text-sm text-ink-soft">
                      Score médio <strong className="text-ink">{fmt.num(p.score_medio)}</strong>
                      {p.alto > 0 && <> · <strong className="text-risk-alto">{fmt.num(p.alto)} em alto risco</strong></>}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

const DIMENSOES = [
  ["porte", "Porte"],
  ["setor", "Setor"],
  ["cidade", "Cidade"],
];

function Concentracao({ segmentos, loading }) {
  const [dim, setDim] = useState("setor");
  const itens = segmentos?.[dim] ?? [];
  const ordem = ["alto", "atencao", "saudavel"];
  return (
    <Section
      title="Onde o risco se concentra"
      aside={
        <div className="flex gap-1" role="tablist" aria-label="Agrupar por">
          {DIMENSOES.map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={dim === k} onClick={() => setDim(k)}
              className={`rounded-control border px-2.5 py-1 text-sm font-semibold ${dim === k ? "border-ink bg-ink text-canvas" : "border-line text-ink hover:border-ink"}`}>
              {l}
            </button>
          ))}
        </div>
      }
    >
      {loading ? (
        <SkeletonRows rows={4} cols={2} />
      ) : (
        <>
          <ul className="space-y-3">
            {itens.map((g) => (
              <li key={g.valor}>
                <Link to={`/clientes?${dim}=${encodeURIComponent(g.valor)}`} className="grid grid-cols-[120px_1fr_96px] items-center gap-3 text-sm hover:underline">
                  <span className="truncate font-semibold">{g.valor}</span>
                  <span className="flex h-6 gap-0.5 overflow-hidden rounded-control" title={`${g.alto} alto risco, ${g.atencao} atenção, ${g.saudavel} saudável`}>
                    {ordem.map((f) =>
                      g[f] ? <span key={f} className={faixaClasses(f).bg} style={{ width: `${(g[f] / g.total) * 100}%` }} /> : null,
                    )}
                  </span>
                  <span className="whitespace-nowrap text-right">
                    <strong>{g.em_risco_pct}%</strong> <span className="text-ink-soft">de {g.total}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t border-line pt-3 text-sm">
            {ordem.map((f) => (
              <li key={f}>
                <span className={`mr-1.5 inline-block size-3 rounded-sm align-[-1px] ${faixaClasses(f).bg}`} aria-hidden />
                {FAIXA_LABEL[f]}
              </li>
            ))}
            <li className="text-ink-soft">% = alto risco + atenção</li>
          </ul>
        </>
      )}
    </Section>
  );
}

function Execucao({ cobertura, backlog, loading }) {
  const navigate = useNavigate();
  const alto = cobertura?.alto_risco ?? 0;
  const feitos = cobertura?.contatados ?? 0;
  const faixas = backlog?.faixas ?? [];
  const max = Math.max(1, ...faixas.map((f) => f.total));
  return (
    <Section title="Execução do time">
      {loading ? (
        <SkeletonRows rows={5} cols={2} />
      ) : (
        <div className="space-y-6">
          <div>
            <div className="flex items-baseline justify-between text-sm">
              <h3 className="font-bold">Cobertura do alto risco</h3>
              <span><strong>{fmt.num(feitos)}</strong> de {fmt.num(alto)} contatados</span>
            </div>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-line" aria-hidden>
              <div className="h-full rounded-full bg-risk-saudavel" style={{ width: `${alto ? (feitos / alto) * 100 : 0}%` }} />
            </div>
            {(cobertura?.por_pessoa ?? []).length > 0 && (
              <p className="mt-2 text-sm text-ink-soft">
                {cobertura.por_pessoa.map((p) => `${p.nome}: ${p.contatos} contato${p.contatos === 1 ? "" : "s"}`).join(" · ")}
              </p>
            )}
            {(cobertura?.sem_contato ?? []).length > 0 && (
              <>
                <p className="mt-3 text-sm font-semibold text-ink-soft">Ainda sem contato</p>
                <ul className="mt-1 divide-y divide-line text-sm">
                  {cobertura.sem_contato.slice(0, 3).map((c) => (
                    <li key={c.cliente_id} onClick={() => navigate(`/clientes/${c.cliente_id}`)}
                      className="flex cursor-pointer items-baseline justify-between gap-3 py-1.5 hover:bg-brand-soft">
                      <Link to={`/clientes/${c.cliente_id}`} className="font-semibold hover:underline" onClick={(e) => e.stopPropagation()}>{c.nome}</Link>
                      <span className="truncate text-ink-soft">{c.porte} · score <strong className="text-risk-alto">{c.score}</strong></span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
          <div>
            <div className="flex items-baseline justify-between text-sm">
              <h3 className="font-bold">Chamados pendentes por idade</h3>
              <Link to="/chamados" className="font-semibold underline underline-offset-4 hover:no-underline">Abrir fila</Link>
            </div>
            <ul className="mt-2 space-y-2">
              {faixas.map((f) => (
                <li key={f.faixa} className="grid grid-cols-[120px_1fr_110px] items-center gap-3 text-sm"
                  title={`${f.total} pendentes, ${f.criticos} de prioridade crítica`}>
                  <span>{f.faixa}</span>
                  <span className="relative h-4 overflow-hidden rounded-sm bg-brand-soft" aria-hidden>
                    <span className="absolute inset-y-0 left-0 bg-ink/25" style={{ width: `${(f.total / max) * 100}%` }} />
                    <span className="absolute inset-y-0 left-0 bg-risk-alto" style={{ width: `${(f.criticos / max) * 100}%` }} />
                  </span>
                  <span className="text-right"><strong>{fmt.num(f.total)}</strong> <span className="text-ink-soft">({fmt.num(f.criticos)} críticos)</span></span>
                </li>
              ))}
            </ul>
            <p className="mt-2 flex items-center gap-4 text-sm text-ink-soft">
              <span><span className="mr-1.5 inline-block size-3 rounded-sm bg-risk-alto align-[-1px]" aria-hidden />Prioridade crítica</span>
              <span><span className="mr-1.5 inline-block size-3 rounded-sm bg-ink/25 align-[-1px]" aria-hidden />Demais</span>
            </p>
          </div>
        </div>
      )}
    </Section>
  );
}

// Mapa serviço × assunto: intensidade = volume de chamados (uma cor, claro → escuro).
function Produto({ produto, loading }) {
  const [sel, setSel] = useState(null);
  const celulas = produto?.celulas ?? [];
  const mapa = new Map(celulas.map((c) => [`${c.servico}|${c.assunto}`, c]));
  const max = Math.max(1, ...celulas.map((c) => c.atendimentos));
  const min = Math.min(max, ...celulas.map((c) => c.atendimentos));
  const intensidade = (n) => (max > min ? (n - min) / (max - min) : 1);
  const destaques = produto?.destaques ?? [];
  return (
    <Section title="Insights de produto" className="lg:col-span-2"
      aside={<span className="text-sm text-ink-soft">chamados por serviço e assunto, jul a set</span>}>
      {loading ? (
        <SkeletonRows rows={4} cols={6} />
      ) : celulas.length === 0 ? (
        <EmptyState title="Nenhum chamado no período" />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] table-fixed border-separate border-spacing-0.5 text-sm">
              <thead>
                <tr>
                  <th className="w-36" />
                  {produto.assuntos.map((a) => (
                    <th key={a} className="px-1 pb-2 text-left align-bottom text-xs font-semibold text-ink-soft">{a}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {produto.servicos.map((s) => (
                  <tr key={s}>
                    <th className="whitespace-nowrap pr-3 text-left font-semibold">{s}</th>
                    {produto.assuntos.map((a) => {
                      const c = mapa.get(`${s}|${a}`);
                      const n = c?.atendimentos ?? 0;
                      const forte = intensidade(n) > 0.5;
                      const ativo = sel && sel.servico === s && sel.assunto === a;
                      return (
                        <td key={a} className="p-0">
                          <button type="button" onClick={() => setSel(c ?? null)} onMouseEnter={() => setSel(c ?? null)}
                            className={`h-11 w-full rounded-sm text-sm font-bold ${forte ? "text-canvas" : "text-ink"} ${ativo ? "outline-2 outline-offset-1 outline-ink" : ""}`}
                            style={{ background: n ? `color-mix(in srgb, var(--color-ink) ${Math.round(10 + intensidade(n) * 80)}%, var(--color-surface))` : "var(--color-canvas)" }}
                            aria-label={`${s}, ${a}: ${n} chamados`}>
                            {n || ""}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 min-h-6 text-sm text-ink-soft">
              {sel ? (
                <>
                  <strong className="text-ink">{sel.servico} · {sel.assunto}</strong>: {fmt.num(sel.atendimentos)} chamados,{" "}
                  {fmt.num(sel.pendentes)} pendentes, satisfação {fmt.nota(sel.satisfacao_media)}
                </>
              ) : (
                "Passe o mouse em uma célula para ver pendentes e satisfação."
              )}
            </p>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-bold">Onde o produto gera mais atrito</h3>
            <ol className="space-y-3">
              {destaques.map((d, i) => (
                <li key={`${d.servico}-${d.assunto}`} className="grid grid-cols-[28px_1fr] gap-2 text-sm">
                  <span className="font-display text-xl">{i + 1}</span>
                  <span>
                    <span className="block font-semibold">{d.descricao}</span>
                    <span className="text-ink-soft">
                      {fmt.num(d.atendimentos)} chamados · {fmt.num(d.clientes_afetados)} clientes · satisfação {fmt.nota(d.satisfacao_media)}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </Section>
  );
}
