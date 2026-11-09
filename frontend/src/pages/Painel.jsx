import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { api } from "../api/client.js";
import { FAIXA_LABEL, PERFIL_LABEL, fmt } from "../api/format.js";
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
          <Kpis kpis={data?.kpis} loading={loading} />
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

function Kpis({ kpis, loading }) {
  const variacao = kpis?.clientes_alto_risco_variacao;
  const itens = [
    {
      label: "Clientes em alto risco",
      valor: fmt.num(kpis?.clientes_alto_risco),
      detalhe: Number.isFinite(variacao) ? `${variacao > 0 ? "+" : ""}${variacao} vs ago` : null,
      ruim: variacao > 0,
    },
    { label: "Chamados pendentes", valor: fmt.num(kpis?.atendimentos_pendentes), detalhe: `${fmt.num(kpis?.pendentes_prioridade_alta)} de prioridade alta` },
    { label: "Satisfação média", valor: fmt.nota(kpis?.satisfacao_media), detalhe: "de 5" },
    { label: "Tempo médio de resolução", valor: fmt.minutos(kpis?.tempo_medio_resolucao_min), detalhe: "chamados resolvidos" },
  ];
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-ink bg-ink lg:col-span-2 lg:grid-cols-4">
      {itens.map((k, i) => (
        <div key={k.label} className="bg-surface px-5 py-4">
          <p className="text-sm font-semibold text-ink-soft">{k.label}</p>
          {loading ? (
            <Skeleton className="mt-2 h-10 w-20" />
          ) : (
            <p className={`mt-2 font-display text-[40px] ${i === 0 ? "text-risk-alto" : ""}`}>{k.valor}</p>
          )}
          <p className={`mt-2 text-sm ${k.ruim ? "font-bold text-risk-alto" : "text-ink-soft"}`}>{loading ? " " : k.detalhe}</p>
        </div>
      ))}
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
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-base">
            {ordem.map((f) => (
              <li key={f}>
                <Link to={`/clientes?faixa=${f}`} className="hover:underline">
                  <span className={`mr-1.5 inline-block size-3 rounded-sm align-[-1px] ${faixaClasses(f).bg}`} aria-hidden />
                  <span className="font-bold">{fmt.num(dist?.[f])}</span> {FAIXA_LABEL[f].toLowerCase()}
                </Link>
              </li>
            ))}
          </ul>
          <ul className="mt-3 flex flex-wrap gap-2 border-t border-ink pt-3 text-sm">
            {Object.keys(PERFIL_LABEL).map((p) => (
              <li key={p}>
                <Link to={`/clientes?perfil=${p}`} className="inline-flex gap-1.5 rounded-full border border-ink bg-canvas px-2.5 py-0.5 text-sm font-semibold text-ink hover:underline">
                  {PERFIL_LABEL[p]} <span>{fmt.num(perfis?.[p])}</span>
                </Link>
              </li>
            ))}
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
