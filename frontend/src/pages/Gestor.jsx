import { Navigate } from "react-router-dom";
import { api } from "../api/client.js";
import { fmt } from "../api/format.js";
import { useAuth } from "../auth.jsx";
import PerguntaRadar from "../components/PerguntaRadar.jsx";
import { BotoesRelatorio, EmptyState, ErrorState, PageHeader, Section, SkeletonRows, useData } from "../components/ui.jsx";

export default function Gestor() {
  const { usuario } = useAuth();
  if (usuario?.papel !== "gestor") return <Navigate to="/" replace />;
  return <GestorConteudo />;
}

function GestorConteudo() {
  const { data, error, loading, reload } = useData(() => api.insightsProduto(), []);
  const itens = data?.itens ?? [];
  return (
    <>
      <PageHeader title="Visão do gestor" meta="Onde os problemas se concentram na carteira">
        <BotoesRelatorio papel="gestor" rotuloPdf="Baixar PDF para a diretoria" />
      </PageHeader>
      <div className="flex flex-col gap-6">
        <Section title="Insights de produto">
          {error ? (
            <ErrorState error={error} onRetry={reload} />
          ) : loading ? (
            <SkeletonRows rows={5} cols={5} />
          ) : itens.length === 0 ? (
            <EmptyState title="Nenhum insight de produto no período" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-sm">
                <thead className="text-left text-xs text-ink-faint">
                  <tr>
                    <th className="pb-2 pr-4 font-medium">Serviço</th>
                    <th className="pb-2 pr-4 font-medium">Assunto</th>
                    <th className="pb-2 pr-4 text-right font-medium">Chamados</th>
                    <th className="pb-2 pr-4 text-right font-medium">Satisfação média</th>
                    <th className="pb-2 pr-4 text-right font-medium">Clientes afetados</th>
                    <th className="pb-2 font-medium">Descrição</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {itens.map((i) => (
                    <tr key={`${i.servico}-${i.assunto}`}>
                      <td className="py-2.5 pr-4 font-semibold">{i.servico || fmt.dash}</td>
                      <td className="py-2.5 pr-4">{i.assunto || fmt.dash}</td>
                      <td className="py-2.5 pr-4 text-right">{fmt.num(i.atendimentos)}</td>
                      <td className="py-2.5 pr-4 text-right">{fmt.nota(i.satisfacao_media)}</td>
                      <td className="py-2.5 pr-4 text-right">{fmt.num(i.clientes_afetados)}</td>
                      <td className="py-2.5 text-ink-soft">{i.descricao || fmt.dash}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
        <PerguntaRadar />
      </div>
    </>
  );
}
