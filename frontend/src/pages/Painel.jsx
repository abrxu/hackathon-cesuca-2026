import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { api } from "../api/client.js";
import { FAIXA_LABEL, PERFIL_LABEL, fmt } from "../api/format.js";
import { ClayIcon, MiniArea, MiniBarras, PERFIL_CORES } from "../components/painelVisual.jsx";
import { ErrorState, PageHeader, ScoreBar, Section, Skeleton, SkeletonRows, faixaClasses, useData } from "../components/ui.jsx";

export default function Painel() {
  const { usuario } = useAuth();
  const { data, error, loading, reload } = useData(() => api.painel(), []);

  return (
    <>
      <PageHeader title="Painel" meta="Dados até set/2026" />
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <Kpis kpis={data?.kpis} series={data?.series} loading={loading} />
          <Prioridade itens={data?.prioridade_hoje} loading={loading} />
          <div className="flex flex-col gap-6">
            <Distribuicao dist={data?.distribuicao} perfis={data?.perfis} loading={loading} />
            <PorServico itens={data?.atendimentos_por_servico} loading={loading} />
          </div>
        </div>
      )}
    </>
  );
}

function Kpis({ kpis, series, loading }) {
  const variacao = kpis?.clientes_alto_risco_variacao;
  const meses = series?.meses ?? [];
  const itens = [
    {
      label: "Clientes em alto risco",
      icone: "alerta",
      valor: fmt.num(kpis?.clientes_alto_risco),
      detalhe: Number.isFinite(variacao) ? `${variacao > 0 ? "+" : ""}${variacao} vs ago` : null,
      ruim: variacao > 0,
      destaque: "text-risk-alto",
      to: "/clientes?faixa=alto",
      grafico: <MiniBarras valores={series?.alto_risco ?? []} meses={meses.slice(-2)} cor="bg-risk-alto" />,
    },
    {
      label: "Chamados pendentes",
      icone: "chamado",
      valor: fmt.num(kpis?.atendimentos_pendentes),
      detalhe: `${fmt.num(kpis?.pendentes_prioridade_alta)} de prioridade alta`,
      to: "/chamados",
      grafico: <MiniBarras valores={series?.pendentes ?? []} meses={meses} cor="bg-ink" />,
    },
    {
      label: "Satisfação média",
      icone: "satisfacao",
      valor: fmt.nota(kpis?.satisfacao_media),
      detalhe: "de 5",
      grafico: <MiniArea valores={series?.satisfacao ?? []} meses={meses} cor="text-risk-atencao" formatar={fmt.nota} />,
    },
    {
      label: "Tempo médio de resolução",
      icone: "tempo",
      valor: fmt.minutos(kpis?.tempo_medio_resolucao_min),
      detalhe: "chamados resolvidos",
      grafico: <MiniArea valores={series?.tempo_resolucao_min ?? []} meses={meses} cor="text-ink-soft" formatar={fmt.minutos} />,
    },
  ];
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-2 lg:grid-cols-4">
      {itens.map((k) => {
        const corpo = (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink-soft">{k.label}</p>
                {loading ? (
                  <Skeleton className="mt-2 h-10 w-20" />
                ) : (
                  <p className={`mt-2 font-display text-[40px] ${k.destaque ?? ""}`}>{k.valor}</p>
                )}
                <p className={`mt-2 text-sm ${k.ruim ? "font-bold text-risk-alto" : "text-ink-soft"}`}>{loading ? "\u00a0" : k.detalhe}</p>
              </div>
              <ClayIcon tipo={k.icone} />
            </div>
            <div className="mt-4 border-t border-line pt-3">{loading ? <Skeleton className="h-[62px] w-full" /> : k.grafico}</div>
          </>
        );
        const base = "block rounded-panel border border-ink bg-surface px-5 py-4 shadow-[0_1px_0_rgba(15,23,42,0.04)]";
        return k.to ? (
          <Link key={k.label} to={k.to} className={`${base} transition hover:-translate-y-0.5 hover:shadow-[0_8px_20px_-8px_rgba(15,23,42,0.25)]`}>
            {corpo}
          </Link>
        ) : (
          <div key={k.label} className={base}>{corpo}</div>
        );
      })}
    </div>
  );
}

function Prioridade({ itens, loading }) {
  const navigate = useNavigate();
  return (
    <Section title="Prioridade de contato hoje" aside={<Link to="/clientes" className="text-sm font-semibold text-ink underline underline-offset-4 hover:no-underline">Ver todos</Link>}>
      {loading ? (
        <SkeletonRows rows={5} cols={4} />
      ) : (
        <table className="w-full text-sm">
          <thead className="border-b border-ink text-left text-sm text-ink-soft">
            <tr>
              <th className="pb-2 font-semibold">Cliente</th>
              <th className="pb-2 font-semibold">Porte</th>
              <th className="pb-2 font-semibold">Score</th>
              <th className="pb-2 font-semibold">Motivo principal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {(itens ?? []).map((c) => (
              <tr
                key={c.cliente_id}
                onClick={() => navigate(`/clientes/${c.cliente_id}`)}
                className="cursor-pointer hover:bg-brand-soft"
              >
                <td className="py-3 pr-4">
                  <Link to={`/clientes/${c.cliente_id}`} className="font-semibold hover:underline" onClick={(e) => e.stopPropagation()}>
                    {c.nome}
                  </Link>
                </td>
                <td className="py-3 pr-4 text-ink-soft">{c.porte}</td>
                <td className="py-3 pr-4"><ScoreBar score={c.score} faixa={c.faixa} /></td>
                <td className="py-3">{c.motivo_principal || fmt.dash}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  );
}

function Distribuicao({ dist, perfis, loading }) {
  const ordem = ["alto", "atencao", "saudavel"];
  const total = ordem.reduce((a, f) => a + (dist?.[f] ?? 0), 0) || 1;
  return (
    <Section title="Distribuição de risco">
      {loading ? (
        <Skeleton className="h-10 w-full" />
      ) : (
        <>
          <div className="flex h-10 gap-0.5 overflow-hidden rounded-control">
            {ordem.map((f) =>
              dist?.[f] ? (
                <Link
                  key={f}
                  to={`/clientes?faixa=${f}`}
                  title={`${dist[f]} ${FAIXA_LABEL[f]} — abrir lista`}
                  className={`${faixaClasses(f).bg} hover:opacity-85`}
                  style={{ width: `${(dist[f] / total) * 100}%` }}
                />
              ) : null,
            )}
          </div>
          <ul className="mt-3 flex flex-wrap gap-2 text-base">
            {ordem.map((f) => (
              <li key={f}>
                <Link to={`/clientes?faixa=${f}`} className="group inline-flex items-center rounded-control px-2 py-1 -mx-1 hover:bg-brand-soft">
                  <span className={`mr-1.5 inline-block size-3 rounded-sm ${faixaClasses(f).bg}`} aria-hidden />
                  <span className="font-bold">{fmt.num(dist?.[f])}</span>&nbsp;{FAIXA_LABEL[f].toLowerCase()}
                  <span className="ml-1 text-ink-faint transition group-hover:translate-x-0.5" aria-hidden>›</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-ink pt-3 text-sm font-semibold text-ink-soft">Perfis de risco</p>
          <ul className="mt-2 flex flex-wrap gap-2 text-sm">
            {Object.keys(PERFIL_LABEL).map((p) => {
              const c = PERFIL_CORES[p];
              return (
                <li key={p}>
                  <Link
                    to={`/clientes?perfil=${p}`}
                    title={`Ver clientes com perfil ${PERFIL_LABEL[p]}`}
                    className="group inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1.5 font-semibold shadow-[0_2px_0_0_var(--sombra)] transition hover:-translate-y-0.5 hover:shadow-[0_4px_0_0_var(--sombra)] active:translate-y-0 active:shadow-none"
                    style={{ background: c.fundo, borderColor: c.borda, color: c.texto, "--sombra": c.borda }}
                  >
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: c.ponto }} aria-hidden />
                    <span>{PERFIL_LABEL[p]}</span>
                    <span className="rounded-full bg-surface px-2 text-xs font-bold tabular-nums">{fmt.num(perfis?.[p])}</span>
                    <span className="transition group-hover:translate-x-0.5" aria-hidden>›</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Section>
  );
}

function PorServico({ itens, loading }) {
  const max = Math.max(1, ...(itens ?? []).map((s) => s.total ?? 0));
  return (
    <Section title="Chamados por serviço">
      {loading ? (
        <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-5 w-full" />)}</div>
      ) : (
        <ul className="space-y-3">
          {(itens ?? []).map((s) => (
            <li key={s.servico} className="grid grid-cols-[130px_1fr_auto] items-center gap-3 text-sm">
              <span className="truncate">{s.servico}</span>
              <span className="relative h-3 overflow-hidden rounded-sm bg-brand-soft" aria-hidden>
                <span className="absolute inset-y-0 left-0 bg-brand/25" style={{ width: `${(s.total / max) * 100}%` }} />
                <span className="absolute inset-y-0 left-0 bg-brand" style={{ width: `${(s.pendentes / max) * 100}%` }} />
              </span>
              <span className="text-sm text-ink-soft whitespace-nowrap">
                {fmt.num(s.total)} <span className="text-ink-faint">({fmt.num(s.pendentes)} pendentes)</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
