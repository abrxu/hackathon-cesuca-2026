import { Link, Navigate } from "react-router-dom";
import { api } from "../api/client.js";
import { PERFIL_LABEL, fmt } from "../api/format.js";
import { useAuth } from "../auth.jsx";
import { BotoesRelatorio, EmptyState, ErrorState, PageHeader, Section, Skeleton, SkeletonRows, useData } from "../components/ui.jsx";

// Visão do gestor: onde intervir na carteira e o que levar para a diretoria.
// O analista olha cliente a cliente no Painel; aqui ficam só três leituras de carteira.
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
          <Perfis perfis={data?.perfis} loading={loading} />
          <Atrito destaques={data?.produto?.destaques} loading={loading} />
        </div>
      )}
    </>
  );
}

function Kpis({ kpis, backlog, loading }) {
  const antigos = backlog?.faixas?.at(-1)?.total;
  const alto = kpis?.clientes_alto_risco;
  const contatados = kpis?.alto_risco_contatados;
  const itens = [
    {
      label: "Carteira em risco",
      valor: fmt.num(kpis?.clientes_em_risco),
      detalhe: `de ${fmt.num(kpis?.total_clientes)} clientes · ${fmt.num(alto)} em alto risco`,
      to: "/clientes",
    },
    {
      label: "Alto risco já contatado",
      valor: `${fmt.num(contatados)} de ${fmt.num(alto)}`,
      detalhe: "cobertura do time de CS",
      alerta: Number.isFinite(contatados) && Number.isFinite(alto) && contatados < alto,
      to: "/clientes?faixa=alto",
    },
    {
      label: "Chamados há mais de 30 dias",
      valor: fmt.num(antigos),
      detalhe: `de ${fmt.num(backlog?.pendentes)} pendentes`,
      to: "/chamados",
    },
  ];
  return (
    <div className="grid gap-px overflow-hidden rounded-panel border border-ink bg-ink sm:grid-cols-3 lg:col-span-2">
      {itens.map((k) => (
        <Link key={k.label} to={k.to} className="bg-surface px-5 py-4 hover:bg-brand-soft">
          <p className="text-sm font-semibold text-ink-soft">{k.label}</p>
          {loading ? (
            <Skeleton className="mt-2 h-10 w-24" />
          ) : (
            <p className={`mt-2 font-display text-[40px] ${k.alerta ? "text-risk-alto" : ""}`}>{k.valor}</p>
          )}
          <p className="mt-2 text-sm text-ink-soft">{loading ? " " : k.detalhe}</p>
        </Link>
      ))}
    </div>
  );
}

// Perfis de risco viram decisões em escala: um tipo de ação por padrão de comportamento.
const PLAYBOOK = {
  travado: { titulo: "Força-tarefa de suporte", texto: "Chamados parados e uso caindo. Destravar os pendentes primeiro." },
  silencioso: { titulo: "Campanha de reengajamento", texto: "Usam cada vez menos e não reclamam. Contato proativo e treinamento." },
  frustrado: { titulo: "Revisar a qualidade do atendimento", texto: "Satisfação baixa nos chamados." },
  saudavel: { titulo: "Manter e pedir indicação", texto: "Sem sinais de risco. Acompanhamento de rotina." },
};

function Perfis({ perfis, loading }) {
  return (
    <Section title="Perfis de risco: ação em escala">
      {loading ? (
        <SkeletonRows rows={4} cols={2} />
      ) : (perfis ?? []).length === 0 ? (
        <EmptyState title="Sem perfis calculados" />
      ) : (
        <ul className="divide-y divide-line">
          {perfis.map((p) => {
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

// Insight de produto: só os três cruzamentos serviço × assunto com mais chamados.
function Atrito({ destaques, loading }) {
  const top = (destaques ?? []).slice(0, 3);
  return (
    <Section title="Onde o produto gera mais atrito" aside={<span className="text-sm text-ink-soft">jul a set</span>}>
      {loading ? (
        <SkeletonRows rows={3} cols={2} />
      ) : top.length === 0 ? (
        <EmptyState title="Nenhum chamado no período" />
      ) : (
        <ol className="divide-y divide-line">
          {top.map((d, i) => (
            <li key={`${d.servico}-${d.assunto}`} className="grid grid-cols-[40px_1fr] gap-3 py-3">
              <span className="font-display text-[32px] leading-none">{i + 1}</span>
              <span>
                <span className="block font-bold">{d.descricao}</span>
                <span className="text-sm text-ink-soft">
                  {fmt.num(d.atendimentos)} chamados · {fmt.num(d.clientes_afetados)} clientes afetados
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}
